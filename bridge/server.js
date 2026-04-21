#!/usr/bin/env node
// Local bridge: extension <-> this server <-> `claude -p` subprocess.
// Run: node bridge/server.js   (keep terminal open while using the extension)

import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = 8787;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const TIMEOUT_MS = 120_000;

// --- Command queue (curl -> bridge -> extension poll -> result back) ---
// commands: id -> { id, type, args, status, result, createdAt, finishedAt }
// status: 'pending' | 'done' | 'error'
const commands = new Map();
let nextId = 1;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, ['-p', prompt], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const killTimer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`claude timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(killTimer);
      if (code !== 0) return reject(new Error(stderr.trim() || `claude exited ${code}`));
      resolve(stdout.trim());
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = req.url;

  if (req.method === 'GET' && url === '/health') {
    return json(res, 200, { ok: true, claude: CLAUDE_BIN, queued: [...commands.values()].filter(c => c.status === 'pending').length });
  }

  // --- One-shot: ask Claude ---
  if (req.method === 'POST' && url === '/shortlist') {
    try {
      const body = await readBody(req);
      const { prompt } = JSON.parse(body || '{}');
      if (!prompt || typeof prompt !== 'string') return json(res, 400, { error: 'missing prompt' });
      const started = Date.now();
      const reply = await askClaude(prompt);
      return json(res, 200, { reply, ms: Date.now() - started });
    } catch (err) {
      return json(res, 500, { error: err.message || String(err) });
    }
  }

  // --- Queue a command (I POST this from curl) ---
  // Body: { "type": "read_page", "args": {...} }
  if (req.method === 'POST' && url === '/command') {
    try {
      const body = await readBody(req);
      const { type, args = {} } = JSON.parse(body || '{}');
      if (!type || typeof type !== 'string') return json(res, 400, { error: 'missing type' });
      const id = nextId++;
      const cmd = { id, type, args, status: 'pending', result: null, createdAt: Date.now(), finishedAt: null };
      commands.set(id, cmd);
      console.log(`[cmd] queued #${id} type=${type}`);
      return json(res, 200, { id });
    } catch (err) {
      return json(res, 500, { error: err.message || String(err) });
    }
  }

  // --- Extension polls: GET next pending command ---
  if (req.method === 'GET' && url === '/command') {
    const pending = [...commands.values()].find(c => c.status === 'pending');
    return json(res, 200, pending ? { id: pending.id, type: pending.type, args: pending.args } : { id: null });
  }

  // --- Extension reports result ---
  // Body: { "id": 1, "ok": true, "result": {...} } or { "id": 1, "ok": false, "error": "..." }
  if (req.method === 'POST' && url === '/result') {
    try {
      const body = await readBody(req);
      const { id, ok, result, error } = JSON.parse(body || '{}');
      const cmd = commands.get(id);
      if (!cmd) return json(res, 404, { error: `command ${id} not found` });
      cmd.status = ok ? 'done' : 'error';
      cmd.result = ok ? result : { error };
      cmd.finishedAt = Date.now();
      console.log(`[cmd] ${cmd.status} #${id} (${cmd.finishedAt - cmd.createdAt}ms)`);
      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 500, { error: err.message || String(err) });
    }
  }

  // --- I fetch result: GET /result/:id ---
  const m = url.match(/^\/result\/(\d+)$/);
  if (req.method === 'GET' && m) {
    const cmd = commands.get(parseInt(m[1], 10));
    if (!cmd) return json(res, 404, { error: 'not found' });
    return json(res, 200, cmd);
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] listening on http://localhost:${PORT}`);
  console.log(`[bridge] using claude binary: ${CLAUDE_BIN}`);
  console.log(`[bridge] endpoints:`);
  console.log(`  GET  /health`);
  console.log(`  POST /shortlist { prompt }          -> { reply, ms }`);
  console.log(`  POST /command   { type, args }      -> { id }      (queue command)`);
  console.log(`  GET  /command                       -> { id, type, args } | { id: null }   (extension polls)`);
  console.log(`  POST /result    { id, ok, result }  -> { ok }      (extension reports)`);
  console.log(`  GET  /result/:id                    -> command record`);
});
