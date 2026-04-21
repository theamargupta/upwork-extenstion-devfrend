import '../shared/selectors.js';
import { $, audit, copyToClipboard, getActiveTab, showToast } from './utils.js';
import { renderDebug } from './render.js';

let captureData = null;

function pageTextSelectors() {
  return globalThis.__jobExtractor.SELECTORS.pageText;
}

export function updateCaptureCharCount() {
  const t = $('capture-text').value;
  $('capture-char-count').textContent = `${t.length.toLocaleString()} chars`;
}

export function buildCaptureMarkdown() {
  const title = $('capture-title').value.trim();
  const url = $('capture-url').value.trim();
  const text = $('capture-text').value;
  return `# ${title}\n\nURL: ${url}\n\n${text}`;
}

export async function extractPageInfo(tabId, clean) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (cleanPage, selectors) => {
      const hideSelectors = selectors.hideChrome.join(',');
      let style = null;
      if (cleanPage) {
        style = document.createElement('style');
        style.textContent = `${hideSelectors}{display:none !important}`;
        document.head.appendChild(style);
        void document.body.offsetHeight;
      }

      const dialog = document.querySelector(selectors.dialog);
      const dialogVisible = !!(dialog && dialog.offsetParent !== null);
      const cleanText = (s) => (s || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      let dialogText = '';
      let pageText = '';

      if (dialogVisible) {
        dialogText = cleanText(dialog.innerText);
        const prevCss = dialog.style.cssText;
        dialog.style.setProperty('display', 'none', 'important');
        void document.body.offsetHeight;
        pageText = cleanText(document.body.innerText);
        dialog.style.cssText = prevCss;
      } else {
        pageText = cleanText(document.body.innerText);
      }

      let text = pageText;
      if (dialogText) text = text ? `${text}\n\n--- OPEN MODAL / DIALOG ---\n\n${dialogText}` : dialogText;
      if (style) style.remove();
      return {
        text,
        title: document.title || '',
        url: location.href,
        pageTextLen: pageText.length,
        dialogTextLen: dialogText.length,
        dialogDetected: !!dialog,
        dialogVisible,
        dialogTag: dialog?.tagName || null,
        dialogRole: dialog?.getAttribute?.('role') || null
      };
    },
    args: [clean, pageTextSelectors()]
  });
  return {
    frameCount: results.length,
    result: results[0]?.result || null,
    firstFrameError: results[0]?.error || null
  };
}

export async function runCapture() {
  audit('tools:capture:start');
  const btn = $('capture-btn');
  const statusEl = $('capture-status');
  btn.disabled = true;
  btn.textContent = 'Capturing...';
  statusEl.classList.remove('hidden');
  statusEl.textContent = 'Attaching debugger (yellow bar is expected)...';
  $('capture-result').classList.add('hidden');
  const debug = { startedAt: new Date().toISOString() };

  try {
    const tab = await getActiveTab();
    debug.tab = tab ? { id: tab.id, url: tab.url, title: tab.title, status: tab.status } : null;
    if (!tab) throw new Error('No active tab');
    statusEl.textContent = 'Capturing screenshot + text...';
    const clean = $('capture-clean').checked;
    debug.clean = clean;
    const [extractResult, shotResp] = await Promise.all([
      extractPageInfo(tab.id, clean).catch(e => ({ error: e.message, stack: e.stack })),
      chrome.runtime.sendMessage({ action: 'captureFullPage', tabId: tab.id })
    ]);
    debug.extract = extractResult;
    debug.screenshot = shotResp
      ? { success: shotResp.success, error: shotResp.error, dataUrlLen: shotResp.dataUrl?.length || 0 }
      : null;
    if (!shotResp || !shotResp.success) throw new Error(shotResp?.error || 'Screenshot failed');

    const info = extractResult?.result || null;
    captureData = { dataUrl: shotResp.dataUrl, text: info?.text || '', title: info?.title || tab.title || '', url: info?.url || tab.url || '' };
    $('capture-image').src = captureData.dataUrl;
    $('capture-image').classList.remove('expanded');
    $('capture-title').value = captureData.title;
    $('capture-url').value = captureData.url;
    $('capture-text').value = captureData.text;
    updateCaptureCharCount();
    $('capture-result').classList.remove('hidden');

    if (!captureData.text) statusEl.textContent = 'Screenshot ok, but no text extracted. Open Debug info below and share.';
    else if (info?.dialogVisible) statusEl.textContent = `Done — page ${info.pageTextLen.toLocaleString()} + modal ${info.dialogTextLen.toLocaleString()} chars.`;
    else statusEl.textContent = `Done — ${captureData.text.length.toLocaleString()} chars. Edit if needed, then copy.`;
    debug.captureData = { textLen: captureData.text.length, title: captureData.title, url: captureData.url };
    debug.finishedAt = new Date().toISOString();
    renderDebug(debug);
  } catch (err) {
    debug.error = { message: err.message, stack: err.stack };
    renderDebug(debug);
    $('capture-result').classList.remove('hidden');
    statusEl.textContent = 'Error: ' + (err.message || err);
    showToast('Capture failed');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Capture Current Page';
  }
}

export async function copyCaptureBoth() {
  if (!captureData) return;
  const markdown = buildCaptureMarkdown();
  try {
    const blob = await (await fetch(captureData.dataUrl)).blob();
    const item = new ClipboardItem({
      'image/png': blob,
      'text/plain': new Blob([markdown], { type: 'text/plain' })
    });
    await navigator.clipboard.write([item]);
    showToast('Copied image + text!');
  } catch {
    await navigator.clipboard.writeText(markdown);
    showToast('Image copy failed — text copied');
  }
}

export async function copyCaptureText() {
  if (!captureData) return;
  await copyToClipboard(buildCaptureMarkdown());
}
