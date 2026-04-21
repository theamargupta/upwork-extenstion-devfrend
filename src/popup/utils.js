import { CONTENT_SCRIPT_FILES } from '../shared/constants.js';

export const $ = (id) => document.getElementById(id);

const APP_SESSION_T0 = Date.now();
const auditTrail = [];
let auditRenderer = null;
let lastAppScreenshot = null;

export function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg || 'Copied!';
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 1500);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied!');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied!');
  }
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function uidFromUrl(url) {
  const m = (url || '').match(/~(\w+)/);
  return m ? m[1] : null;
}

export const extractJobUid = uidFromUrl;

export function showError(msg) {
  $('loading').classList.add('hidden');
  $('batch-panel').classList.add('hidden');
  $('error').classList.remove('hidden');
  $('error-msg').textContent = msg;
}

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_SCRIPT_FILES
    });
  } catch {
    // Already injected by the manifest or this page disallows injection.
  }
  await sleep(200);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setAuditRenderer(renderer) {
  auditRenderer = renderer;
}

export function audit(step, data = {}) {
  const entry = { t: Date.now() - APP_SESSION_T0, step, ...data };
  auditTrail.push(entry);
  if (auditTrail.length > 500) auditTrail.splice(0, auditTrail.length - 500);
  const block = $('app-debug-panel');
  if (block && !block.classList.contains('hidden') && auditRenderer) auditRenderer();
  return entry;
}

export function clearAuditTrail() {
  auditTrail.length = 0;
}

export function setLastAppScreenshot(value) {
  lastAppScreenshot = value;
}

export function getLastAppScreenshot() {
  return lastAppScreenshot;
}

export function clearLastAppScreenshot() {
  lastAppScreenshot = null;
}

export function buildAppDebugArtifact() {
  return {
    ts: new Date().toISOString(),
    sessionMs: Date.now() - APP_SESSION_T0,
    entries: auditTrail.length,
    screenshot: lastAppScreenshot
      ? { url: lastAppScreenshot.url, title: lastAppScreenshot.title, ts: lastAppScreenshot.ts }
      : null,
    trail: auditTrail
  };
}
