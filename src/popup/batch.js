import { $, audit, ensureContentScript, getActiveTab, showError } from './utils.js';
import { renderBatchResults } from './render.js';

let batchData = [];
let batchTabId = null;

export function getBatchData() {
  return batchData;
}

export function setBatchRunning(running) {
  $('batch-start').classList.toggle('hidden', running);
  $('batch-stop').classList.toggle('hidden', !running);
  $('batch-count').disabled = running;
}

export async function startBatch() {
  const count = parseInt($('batch-count').value) || 10;
  audit('batch:start', { count });
  setBatchRunning(true);
  $('batch-results').classList.add('hidden');
  $('batch-progress').classList.remove('hidden');
  $('progress-bar-fill').style.width = '0%';
  $('batch-status').textContent = 'Injecting script...';

  try {
    const tab = await getActiveTab();
    batchTabId = tab?.id;
    if (!tab || !tab.url || !tab.url.includes('upwork.com')) {
      audit('batch:wrongPage', { url: tab?.url });
      showError('Please navigate to an Upwork Best Matches, Most Recent, or Search page first.');
      setBatchRunning(false);
      return;
    }

    await ensureContentScript(tab.id);
    const progressListener = (msg) => {
      if (msg.action !== 'batchProgress') return;
      const pct = Math.round((msg.current / msg.total) * 100);
      $('progress-bar-fill').style.width = pct + '%';
      $('batch-status').textContent = `Extracting ${msg.current}/${msg.total}: ${msg.title || '...'}`;
      if (msg.current === 1 || msg.current === msg.total || msg.current % 5 === 0) {
        audit('batch:progress', { current: msg.current, total: msg.total, title: msg.title });
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);
    $('batch-status').textContent = `Starting batch extraction of ${count} jobs...`;

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'batchExtract', count });
    chrome.runtime.onMessage.removeListener(progressListener);
    setBatchRunning(false);

    if (!response || !response.success) {
      audit('batch:failed', { error: response?.error });
      showError(response?.error || 'Batch extraction failed.');
      return;
    }

    const successJobs = response.results.filter(r => r.success).map(r => r.data);
    $('progress-bar-fill').style.width = '100%';
    $('batch-status').textContent = `Done! Extracted ${successJobs.length} of ${response.total} jobs.`;
    audit('batch:done', { extracted: successJobs.length, total: response.total });
    batchData = renderBatchResults(response.results);
    if (batchData.length) setTimeout(() => $('batch-ask-claude').click(), 300);
  } catch (err) {
    audit('batch:exception', { error: err?.message || String(err) });
    showError('Batch extraction failed. Try refreshing the Upwork page.');
    setBatchRunning(false);
  }
}

export async function stopBatch() {
  audit('batch:stopRequested');
  if (!batchTabId) return;
  try {
    await chrome.tabs.sendMessage(batchTabId, { action: 'batchStop' });
  } catch {}
  $('batch-status').textContent = 'Stopping...';
}
