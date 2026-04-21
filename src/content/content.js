(() => {
  'use strict';

  const JE = globalThis.__jobExtractor;

  function getPageText(request, sendResponse) {
    try {
      let text = '';
      let style = null;
      if (request.clean) {
        const hideSelectors = JE.SELECTORS.pageText.hideChrome.join(',');
        style = document.createElement('style');
        style.textContent = `${hideSelectors}{display:none !important}`;
        document.head.appendChild(style);
        void document.body.offsetHeight;
      }
      text = document.body.innerText || '';
      if (text.length < 200) text = JE.deepTextWalk(document.body);
      if (style) style.remove();
      text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      sendResponse({ success: true, text, title: document.title || '', url: location.href });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'extractJob') {
      try {
        const data = JE.extractJobData();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }

    if (request.action === 'getPageText') getPageText(request, sendResponse);

    if (request.action === 'batchExtract') {
      const count = request.count || 10;
      JE.batchExtract(count).then(result => {
        sendResponse(result);
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (request.action === 'batchStop') {
      JE.stopBatch();
      sendResponse({ success: true });
    }

    if (request.action === 'getJobCount') {
      const cards = JE.getJobListItems();
      sendResponse({ success: true, count: cards.length });
    }

    return true;
  });
})();
