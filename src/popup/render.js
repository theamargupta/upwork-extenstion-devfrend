import {
  $,
  audit,
  buildAppDebugArtifact,
  copyToClipboard,
  escapeHtml,
  getActiveTab,
  getLastAppScreenshot,
  setAuditRenderer,
  setLastAppScreenshot,
  showToast
} from './utils.js';
import { executeCommand } from '../commands/index.js';

export function renderBatchResults(results) {
  const successJobs = results.filter(r => r.success).map(r => r.data);
  successJobs.sort((a, b) => b.score - a.score);

  const applyCount = successJobs.filter(j => j.score >= 8).length;
  const maybeCount = successJobs.filter(j => j.score >= 5 && j.score < 8).length;
  const skipCount = successJobs.filter(j => j.score < 5).length;

  $('batch-summary').innerHTML = `
    <div class="summary-stat"><span class="label">Total</span><span class="value">${successJobs.length}</span></div>
    <div class="summary-stat"><span class="label" style="color:#22C55E">Apply</span><span class="value" style="color:#22C55E">${applyCount}</span></div>
    <div class="summary-stat"><span class="label" style="color:#EAB308">Maybe</span><span class="value" style="color:#EAB308">${maybeCount}</span></div>
    <div class="summary-stat"><span class="label" style="color:#EF4444">Skip</span><span class="value" style="color:#EF4444">${skipCount}</span></div>
  `;

  $('batch-list').innerHTML = successJobs.map(job => {
    const sl = job.scoreLabel;
    return `
      <div class="batch-item">
        <span class="batch-item-score" style="background:${sl.color};color:${job.score >= 5 && job.score < 8 ? '#0F172A' : '#FFF'}">${job.score}/10</span>
        <div class="batch-item-info">
          <div class="batch-item-title">${escapeHtml(job.title || 'Unknown')}</div>
          <div class="batch-item-meta">
            ${job.budget.amount} ${job.budget.type} &middot; ${job.proposals} proposals &middot; ${job.client.paymentVerified ? 'Verified' : 'Not Verified'}
          </div>
        </div>
      </div>
    `;
  }).join('');

  $('batch-results').classList.remove('hidden');
  $('batch-progress').classList.add('hidden');
  $('batch-start').disabled = false;
  $('batch-start').textContent = 'Start';
  return successJobs;
}

export function renderDebug(obj) {
  $('capture-debug').textContent = JSON.stringify(obj, null, 2);
}

export async function captureAppScreenshot() {
  try {
    const tab = await getActiveTab();
    if (!tab) return { error: 'no active tab' };
    const shot = await chrome.runtime.sendMessage({ action: 'captureFullPage', tabId: tab.id });
    if (shot?.success) {
      setLastAppScreenshot({
        dataUrl: shot.dataUrl,
        url: tab.url,
        title: tab.title,
        ts: new Date().toISOString()
      });
      return { ok: true };
    }
    return { error: shot?.error || 'screenshot failed' };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

export async function captureAppSnapshot() {
  try {
    const snap = await executeCommand({ type: 'read_page', args: { maxChars: 1500 } });
    audit('appDebug:snapshot', {
      url: snap?.url,
      title: snap?.title,
      textPreview: (snap?.text || '').slice(0, 240)
    });
  } catch (e) {
    audit('appDebug:snapshotError', { error: e.message || String(e) });
  }
}

export function renderAppDebug() {
  const block = $('app-debug-panel');
  const img = $('app-debug-image');
  const pre = $('app-debug');
  const status = $('app-debug-status');
  const lastAppScreenshot = getLastAppScreenshot();
  if (!block) return;
  block.classList.remove('hidden');
  if (lastAppScreenshot?.dataUrl) {
    img.src = lastAppScreenshot.dataUrl;
    img.style.display = '';
  } else {
    img.style.display = 'none';
  }
  const artifact = buildAppDebugArtifact();
  status.textContent = `Session ${(artifact.sessionMs / 1000).toFixed(1)}s · ${artifact.entries} steps${lastAppScreenshot ? ' · screenshot attached' : ''}`;
  pre.textContent = JSON.stringify(artifact, null, 2);
}

export async function captureDebugArtifact(_trace, err, job) {
  audit('autoApply:finalize', { error: err?.message || null, jobUrl: job?.url });
  await captureAppScreenshot();
  await captureAppSnapshot();
  return buildAppDebugArtifact();
}

export function renderAutoApplyDebug() {
  renderAppDebug();
}

export async function copyAppDebugWithScreenshot() {
  const text = JSON.stringify(buildAppDebugArtifact(), null, 2);
  const lastAppScreenshot = getLastAppScreenshot();
  if (!lastAppScreenshot?.dataUrl) {
    await copyToClipboard(text);
    return;
  }
  try {
    const blob = await (await fetch(lastAppScreenshot.dataUrl)).blob();
    const item = new ClipboardItem({
      'image/png': blob,
      'text/plain': new Blob([text], { type: 'text/plain' })
    });
    await navigator.clipboard.write([item]);
    showToast('Copied screenshot + debug!');
  } catch {
    await navigator.clipboard.writeText(text);
    showToast('Image copy failed — debug text copied');
  }
}

export function initAppDebugRenderer() {
  setAuditRenderer(renderAppDebug);
}
