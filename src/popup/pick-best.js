import { formatBatchMarkdown } from './format.js';
import { wrapAsPickBestPrompt } from './prompts.js';
import { askClaudeBridge } from './bridge.js';
import { getBatchData } from './batch.js';
import { markJobCopied } from './sync.js';
import { $, audit, showToast } from './utils.js';

let lastClaudeReply = '';
let lastPickedJob = null;

export function getLastClaudeReply() {
  return lastClaudeReply;
}

export function getLastPickedJob() {
  return lastPickedJob;
}

export async function askForBestJob() {
  const batchData = getBatchData();
  if (!batchData.length) return showToast('Run a batch first');
  audit('pickBest:start', { batchCount: batchData.length });
  const btn = $('batch-ask-claude');
  const block = $('claude-reply-block');
  const statusEl = $('claude-reply-status');
  const pre = $('claude-reply');
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Asking...';
  block.classList.remove('hidden');
  statusEl.textContent = 'Sending full batch detail to local Claude CLI bridge (localhost:8787)...';
  pre.textContent = '';
  $('claude-reply-open').classList.add('hidden');
  $('claude-reply-autoapply').classList.add('hidden');
  lastPickedJob = null;
  try {
    const prompt = wrapAsPickBestPrompt(formatBatchMarkdown(batchData), batchData.length);
    const { reply, ms } = await askClaudeBridge(prompt);
    lastClaudeReply = reply;
    pre.textContent = reply;
    handlePickedJob(reply, ms, batchData);
    markJobCopied(batchData.map(j => j.url));
  } catch (err) {
    statusEl.textContent = 'Bridge error: ' + err.message + '. Is `node bridge/server.js` running?';
    showToast('Bridge error');
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function handlePickedJob(reply, ms, batchData) {
  const statusEl = $('claude-reply-status');
  const openBtn = $('claude-reply-open');
  const autoBtn = $('claude-reply-autoapply');
  const pick = reply.match(/BEST\s*:\s*\[?\s*(\d+)\s*\]?/i);
  if (!pick) {
    lastPickedJob = null;
    openBtn.classList.add('hidden');
    autoBtn.classList.add('hidden');
    statusEl.textContent = `Done in ${(ms / 1000).toFixed(1)}s. (No BEST: [N] line parsed — see reply.)`;
    return;
  }
  const idx = parseInt(pick[1], 10) - 1;
  lastPickedJob = batchData[idx] || null;
  audit('pickBest:picked', { index: idx + 1, jobUrl: lastPickedJob?.url, jobTitle: lastPickedJob?.title });
  if (lastPickedJob?.url) {
    openBtn.classList.remove('hidden');
    openBtn.textContent = `Open Job ${pick[1]}`;
    autoBtn.classList.remove('hidden');
    autoBtn.textContent = `Auto-Apply #${pick[1]}`;
  } else {
    openBtn.classList.add('hidden');
    autoBtn.classList.add('hidden');
  }
  statusEl.textContent = `Done in ${(ms / 1000).toFixed(1)}s. Claude picked job [${pick[1]}].`;
}
