#!/usr/bin/env node
// MCP stdio server that exposes the Upwork extension's browser primitives as tools.
// Claude Code connects to this via `claude mcp add upwork-agent -- node <path>/mcp-server.js`.
// This process talks to bridge/server.js over HTTP; bridge/server.js talks to the extension.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const BRIDGE = process.env.UPWORK_BRIDGE || 'http://localhost:8787';
const POLL_MS = 150;
const POLL_TIMEOUT_MS = 30_000;

async function queueCommand(type, args) {
  const post = await fetch(`${BRIDGE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, args })
  });
  if (!post.ok) throw new Error(`bridge /command ${post.status}`);
  const { id } = await post.json();
  if (!id) throw new Error('bridge did not return command id');
  return id;
}

async function waitForResult(id) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const r = await fetch(`${BRIDGE}/result/${id}`);
    if (!r.ok) throw new Error(`bridge /result/${id} ${r.status}`);
    const cmd = await r.json();
    if (cmd.status === 'done') return cmd.result;
    if (cmd.status === 'error') throw new Error(cmd.result?.error || 'command errored');
    await new Promise((res) => setTimeout(res, POLL_MS));
  }
  throw new Error(`command ${id} timed out (extension Listen off?)`);
}

async function runCommand(type, args = {}) {
  const id = await queueCommand(type, args);
  return waitForResult(id);
}

function textResult(obj) {
  return {
    content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }]
  };
}

function errorResult(message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }]
  };
}

// Tool schemas
const TOOLS = [
  {
    name: 'upwork_read_page',
    description:
      'Get the current active tab URL, title, and visible text. Use this first to understand where you are on Upwork. Text is trimmed and whitespace-collapsed.',
    inputSchema: {
      type: 'object',
      properties: {
        maxChars: { type: 'number', description: 'Max characters of visible text to return (default 4000)', default: 4000 }
      }
    }
  },
  {
    name: 'upwork_query_dom',
    description:
      'Query the DOM for elements matching a CSS selector. Returns tag, visible text (trimmed), visibility, bounding rect, and requested attributes. Use textMatch to filter by case-insensitive regex on visible text. Essential for discovering selectors before clicking.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector (comma-separated allowed)' },
        textMatch: { type: 'string', description: 'Optional regex string (JS syntax, case-insensitive) to filter elements by visible text' },
        attrs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Attributes to include on each returned element',
          default: ['id', 'class', 'role', 'aria-label', 'data-test', 'href']
        },
        limit: { type: 'number', description: 'Max elements to return (default 20)', default: 20 },
        textLen: { type: 'number', description: 'Max text length per element (default 120)', default: 120 },
        index: { type: 'number', description: 'If set, return only the Nth filtered element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'upwork_click',
    description:
      'Click an element. When textMatch is provided, clicks the Nth (index, default 0) element whose visible text matches. NEVER click Submit / Send / Submit Proposal — always stop before final submission for user review.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        textMatch: { type: 'string', description: 'Optional regex to filter by visible text (case-insensitive)' },
        index: { type: 'number', description: 'Which match to click after textMatch filter (default 0)', default: 0 }
      },
      required: ['selector']
    }
  },
  {
    name: 'upwork_fill',
    description:
      'Fill a textarea or input with the given text. Dispatches proper input + change events so frameworks pick it up.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'upwork_navigate',
    description: 'Navigate the active tab to a URL. Use sparingly — prefer clicking real UI when possible.',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    }
  },
  {
    name: 'upwork_screenshot',
    description:
      'Full-page screenshot of the active tab, returned as an image. Use when the DOM dump is unclear or you need to verify visual state (e.g. did a modal open, is a button highlighted).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'upwork_done',
    description:
      'Signal that the goal is achieved (or can go no further safely). Provide a short summary. After calling this, stop.',
    inputSchema: {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary']
    }
  }
];

const server = new Server(
  { name: 'upwork-agent', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'upwork_read_page': {
        const res = await runCommand('read_page', { maxChars: args.maxChars ?? 4000 });
        return textResult(res);
      }
      case 'upwork_query_dom': {
        const res = await runCommand('query_dom', args);
        return textResult(res);
      }
      case 'upwork_click': {
        const res = await runCommand('click', args);
        return textResult(res);
      }
      case 'upwork_fill': {
        const res = await runCommand('fill', args);
        return textResult(res);
      }
      case 'upwork_navigate': {
        const res = await runCommand('navigate', args);
        return textResult(res);
      }
      case 'upwork_screenshot': {
        const res = await runCommand('screenshot', {});
        const dataUrl = res?.dataUrl || '';
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        if (!base64) return errorResult('screenshot returned empty dataUrl');
        return {
          content: [
            { type: 'text', text: JSON.stringify({ url: res.url, title: res.title }) },
            { type: 'image', data: base64, mimeType: 'image/png' }
          ]
        };
      }
      case 'upwork_done': {
        return textResult({ ok: true, summary: args.summary || '' });
      }
      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return errorResult(err?.message || String(err));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// Log to stderr so it doesn't corrupt the stdio JSON-RPC stream.
console.error(`[upwork-mcp] connected via stdio, bridge=${BRIDGE}`);
