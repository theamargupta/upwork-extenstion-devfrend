import { BRIDGE_HEALTH_INTERVAL_MS } from '../shared/constants.js';
import { $, audit, buildAppDebugArtifact, clearAuditTrail, clearLastAppScreenshot, copyToClipboard, getActiveTab, getLastAppScreenshot, showToast, sleep } from './utils.js';
import { loadUserContext } from './context.js';
import { setAuthMode, handleAuth, handleLogout } from './auth.js';
import { saveBatchToSupabase } from './sync.js';
import { getCurrentTabState, switchTo } from './tabs.js';
import { getBatchData, startBatch, stopBatch } from './batch.js';
import { copyCaptureBoth, copyCaptureText, runCapture, updateCaptureCharCount } from './capture.js';
import { refreshBridgeStatus, setListen } from './bridge.js';
import { executeCommand } from '../commands/index.js';
import { expandTruncations, runAutoApply } from './auto-apply.js';
import { askForBestJob, getLastClaudeReply, getLastPickedJob } from './pick-best.js';
import {
  captureAppScreenshot,
  captureAppSnapshot,
  copyAppDebugWithScreenshot,
  initAppDebugRenderer,
  renderAppDebug
} from './render.js';

let bridgeHealthTimer = null;

function wireTabs() {
  document.querySelectorAll('#top-tabs .tab').forEach(t => {
    t.addEventListener('click', () => switchTo(t.dataset.group));
  });
  document.querySelectorAll('.subtabs').forEach(row => {
    row.querySelectorAll('.subtab').forEach(t => {
      t.addEventListener('click', () => switchTo(row.dataset.group, t.dataset.sub));
    });
  });
}

function wireBatchAndBridge() {
  $('batch-start').addEventListener('click', startBatch);
  $('batch-stop').addEventListener('click', stopBatch);
  $('listen-toggle').addEventListener('change', (e) => setListen(e.target.checked));
  $('batch-save-supabase').addEventListener('click', () => {
    const batchData = getBatchData();
    if (batchData.length) saveBatchToSupabase(batchData, $('batch-save-supabase'));
  });
  $('batch-ask-claude').addEventListener('click', askForBestJob);
  $('claude-reply-copy').addEventListener('click', () => {
    const lastClaudeReply = getLastClaudeReply();
    if (!lastClaudeReply) return showToast('No reply yet');
    copyToClipboard(lastClaudeReply);
  });
  $('claude-reply-open').addEventListener('click', () => {
    const lastPickedJob = getLastPickedJob();
    if (!lastPickedJob?.url) return showToast('No picked job URL');
    chrome.tabs.create({ url: lastPickedJob.url });
  });
  $('claude-reply-autoapply').addEventListener('click', () => {
    const lastPickedJob = getLastPickedJob();
    if (!lastPickedJob?.url) return showToast('No picked job');
    const from = $('autoapply-from')?.value || 'navigate';
    runAutoApply(lastPickedJob, { from });
  });
}

function wireCapture() {
  $('capture-btn').addEventListener('click', runCapture);
  $('capture-copy-all').addEventListener('click', copyCaptureBoth);
  $('capture-copy-text').addEventListener('click', copyCaptureText);
  $('capture-text').addEventListener('input', updateCaptureCharCount);
  $('capture-image').addEventListener('click', () => $('capture-image').classList.toggle('expanded'));
  $('capture-debug-copy').addEventListener('click', () => {
    copyToClipboard($('capture-debug').textContent || '(empty)');
  });
}

function wireManualAutoApply() {
  $('manual-autoapply').addEventListener('click', async () => {
    const from = $('manual-autoapply-from')?.value || 'cover';
    const statusEl = $('manual-autoapply-status');
    let job = getLastPickedJob();
    if (!job) job = await buildJobFromActiveTab(from, statusEl);
    if (!job) return;
    audit('manualAutoApply:trigger', { from, usingPickedJob: !!getLastPickedJob(), hasPageText: !!job.pageText, pageTextChars: job.pageText?.length || 0, jobUrl: job.url });
    runAutoApply(job, { from });
  });
}

async function buildJobFromActiveTab(from, statusEl) {
  const tab = await getActiveTab();
  if (!tab) {
    statusEl.textContent = 'No active tab.';
    showToast('No active tab');
    return null;
  }
  const job = { url: tab.url, title: tab.title };
  if (!(from === 'cover' || from === 'apply' || from === 'navigate')) return job;
  statusEl.textContent = 'Expanding truncated sections...';
  const exp = await expandTruncations();
  audit('manualAutoApply:expandTruncations', exp);
  if (exp.clicked > 0) await sleep(400);
  statusEl.textContent = 'Reading page content for cover-letter context...';
  try {
    const snap = await executeCommand({ type: 'read_page', args: { maxChars: 16000 } });
    if (snap?.text) {
      job.pageText = snap.text;
      job.title = snap.title || job.title;
      job.url = snap.url || job.url;
      audit('manualAutoApply:pageTextCaptured', { chars: snap.text.length, url: snap.url, expanded: exp.clicked || 0 });
      statusEl.textContent = `Using page content (${snap.text.length.toLocaleString()} chars, expanded ${exp.clicked || 0} section(s)).`;
    }
  } catch (e) {
    statusEl.textContent = 'Could not read page — continuing with URL + title only.';
    audit('manualAutoApply:pageTextError', { error: e.message || String(e) });
  }
  return job;
}

function wireAppDebug() {
  $('app-debug-btn').addEventListener('click', () => {
    const block = $('app-debug-panel');
    if (block.classList.contains('hidden')) renderAppDebug();
    else block.classList.add('hidden');
  });
  $('app-debug-close').addEventListener('click', () => $('app-debug-panel').classList.add('hidden'));
  $('app-debug-clear').addEventListener('click', () => {
    clearAuditTrail();
    clearLastAppScreenshot();
    audit('appDebug:cleared');
    renderAppDebug();
  });
  $('app-debug-capture').addEventListener('click', captureDebugNow);
  $('app-debug-copy').addEventListener('click', () => copyToClipboard(JSON.stringify(buildAppDebugArtifact(), null, 2)));
  $('app-debug-copy-all').addEventListener('click', copyAppDebugWithScreenshot);
  $('app-debug-image').addEventListener('click', () => $('app-debug-image').classList.toggle('expanded'));
}

async function captureDebugNow() {
  const btn = $('app-debug-capture');
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Capturing...';
  try {
    const shot = await captureAppScreenshot();
    if (shot.error) audit('appDebug:captureFailed', { error: shot.error });
    else audit('appDebug:captured', { url: getLastAppScreenshot()?.url });
    await captureAppSnapshot();
    renderAppDebug();
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function wireAuthAndMisc() {
  const retry = () => {
    const { currentGroup, currentSub } = getCurrentTabState();
    switchTo(currentGroup, currentSub[currentGroup]);
  };
  $('retry-btn').addEventListener('click', retry);
  $('reload-ext-btn').addEventListener('click', () => {
    showToast('Reloading extension...');
    setTimeout(() => chrome.runtime.reload(), 200);
  });
  $('auth-tab-login').addEventListener('click', () => setAuthMode('login'));
  $('auth-tab-signup').addEventListener('click', () => setAuthMode('signup'));
  $('auth-submit').addEventListener('click', handleAuth);
  $('auth-logout').addEventListener('click', handleLogout);
  $('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuth();
  });
}

function init() {
  initAppDebugRenderer();
  wireTabs();
  wireBatchAndBridge();
  wireCapture();
  wireManualAutoApply();
  wireAppDebug();
  wireAuthAndMisc();
  loadUserContext();
  switchTo('extract');
  audit('app:init', { ts: new Date().toISOString() });
  $('batch-start').disabled = true;
  $('batch-start').title = 'Checking bridge...';
  refreshBridgeStatus();
  bridgeHealthTimer = setInterval(refreshBridgeStatus, BRIDGE_HEALTH_INTERVAL_MS);
  $('listen-toggle').checked = true;
  setListen(true);
}

init();
