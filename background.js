// Job Extractor — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('Job Extractor installed');
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Forward batch progress from content script to side panel
  if (request.action === 'batchProgress') {
    chrome.runtime.sendMessage(request).catch(() => {
      // Side panel may not be open — ignore
    });
    return;
  }

  if (request.action === 'captureFullPage') {
    captureFullPage(request.tabId).then(sendResponse);
    return true;
  }
});

async function captureFullPage(tabId) {
  const target = { tabId };
  let attached = false;
  let overridden = false;
  try {
    await chrome.debugger.attach(target, '1.3');
    attached = true;

    // Measure full page
    const metrics = await chrome.debugger.sendCommand(target, 'Page.getLayoutMetrics', {});
    const size = metrics.cssContentSize || metrics.contentSize || {};
    const viewport = metrics.cssLayoutViewport || {};
    const width = Math.ceil(size.width || viewport.clientWidth || 1280);
    // Cap at 16384 (Chrome max) to avoid texture errors on very long pages.
    const height = Math.min(Math.ceil(size.height || 800), 16384);

    // Resize viewport to match full content so fixed/sticky elements paint once.
    await chrome.debugger.sendCommand(target, 'Emulation.setDeviceMetricsOverride', {
      mobile: false,
      width,
      height,
      deviceScaleFactor: 1
    });
    overridden = true;

    // Let layout settle after the resize.
    await new Promise(r => setTimeout(r, 350));

    const result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
      format: 'png',
      fromSurface: true
    });

    return { success: true, dataUrl: 'data:image/png;base64,' + result.data };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  } finally {
    if (overridden) {
      try {
        await chrome.debugger.sendCommand(target, 'Emulation.clearDeviceMetricsOverride', {});
      } catch {}
    }
    if (attached) {
      try { await chrome.debugger.detach(target); } catch {}
    }
  }
}
