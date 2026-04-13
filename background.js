// Upwork Job Extractor — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('Upwork Job Extractor installed');
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

  if (request.action === 'saveJob') {
    chrome.storage.local.get({ jobs: [] }, (result) => {
      const jobs = result.jobs;
      // Avoid duplicates by URL
      const idx = jobs.findIndex(j => j.url === request.data.url);
      if (idx !== -1) jobs.splice(idx, 1);
      jobs.unshift(request.data);
      // Keep last 50
      if (jobs.length > 50) jobs.length = 50;
      chrome.storage.local.set({ jobs }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});
