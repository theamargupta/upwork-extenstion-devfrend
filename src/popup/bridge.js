import {
  BRIDGE_BASE,
  BRIDGE_HEALTH_TIMEOUT_MS,
  BRIDGE_POLL_MS,
  BRIDGE_URL
} from '../shared/constants.js';
import { $, audit } from './utils.js';
import { executeCommand } from '../commands/index.js';

let bridgeOnline = null;
let listenTimer = null;

export async function checkBridgeHealth() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), BRIDGE_HEALTH_TIMEOUT_MS);
    const r = await fetch(BRIDGE_BASE + '/health', { signal: ctrl.signal });
    clearTimeout(t);
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : (e.message || String(e)) };
  }
}

export async function refreshBridgeStatus() {
  const res = await checkBridgeHealth();
  const banner = $('bridge-banner');
  const detail = $('bridge-banner-detail');
  if (res.ok) {
    if (bridgeOnline !== true) {
      audit('bridge:health:up');
      bridgeOnline = true;
    }
    banner.classList.add('hidden');
  } else {
    if (bridgeOnline !== false) {
      audit('bridge:health:down', { error: res.error || `status ${res.status}` });
      bridgeOnline = false;
    }
    banner.classList.remove('hidden');
    detail.textContent = res.error ? `(${res.error})` : res.status ? `(status ${res.status})` : '';
  }
  refreshStartGate();
}

export function refreshStartGate() {
  const startBtn = $('batch-start');
  const listenBanner = $('listen-banner');
  const listenOn = !!listenTimer;
  const bridgeOk = bridgeOnline === true;

  if (!listenOn) listenBanner.classList.remove('hidden');
  else listenBanner.classList.add('hidden');

  if (bridgeOk && listenOn) {
    startBtn.disabled = false;
    startBtn.title = '';
  } else {
    startBtn.disabled = true;
    if (!bridgeOk) startBtn.title = 'Bridge offline — run `node bridge/server.js`';
    else startBtn.title = 'Listen is off — turn it on to receive bridge commands';
  }
}

export async function pollCommands() {
  try {
    const r = await fetch(BRIDGE_BASE + '/command');
    if (!r.ok) return;
    const data = await r.json();
    if (!data.id) return;
    const statusEl = $('listen-status');
    statusEl.textContent = `Running #${data.id} (${data.type})...`;
    audit('bridge:command:received', { id: data.id, type: data.type });
    let payload;
    try {
      const result = await executeCommand(data);
      payload = { id: data.id, ok: true, result };
      statusEl.textContent = `#${data.id} ${data.type}: done.`;
      audit('bridge:command:done', { id: data.id, type: data.type });
    } catch (err) {
      payload = { id: data.id, ok: false, error: err.message || String(err) };
      statusEl.textContent = `#${data.id} ${data.type}: ${err.message}`;
      audit('bridge:command:error', { id: data.id, type: data.type, error: err.message });
    }
    await fetch(BRIDGE_BASE + '/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    $('listen-status').textContent = `Poll error: ${err.message}`;
  }
}

export function setListen(on) {
  audit('listen:toggle', { on });
  if (on) {
    if (!listenTimer) {
      listenTimer = setInterval(pollCommands, BRIDGE_POLL_MS);
      $('listen-status').textContent = 'Listening...';
    }
  } else {
    if (listenTimer) {
      clearInterval(listenTimer);
      listenTimer = null;
    }
    $('listen-status').textContent = 'Off';
  }
  refreshStartGate();
}

export async function askClaudeBridge(prompt) {
  const start = Date.now();
  audit('bridge:askClaude:start', { promptChars: prompt.length });
  try {
    const r = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await r.json().catch(() => ({ error: 'bad json from bridge' }));
    if (!r.ok) {
      audit('bridge:askClaude:error', { status: r.status, error: data.error, ms: Date.now() - start });
      throw new Error(data.error || `bridge error ${r.status}`);
    }
    audit('bridge:askClaude:done', { ms: Date.now() - start, replyChars: (data.reply || '').length });
    return data;
  } catch (e) {
    audit('bridge:askClaude:exception', { error: e.message || String(e), ms: Date.now() - start });
    throw e;
  }
}
