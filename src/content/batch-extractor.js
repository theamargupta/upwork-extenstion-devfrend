(() => {
  'use strict';

  const JE = globalThis.__jobExtractor;
  const S = JE.SELECTORS.searchList;
  let batchStopped = false;

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function waitForSelector(sel, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const found = document.querySelector(sel);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error('timeout')); }, timeout);
    });
  }

  function getJobListItems() {
    let best = [];
    for (const sel of S.cards) {
      const els = document.querySelectorAll(sel);
      if (els.length > best.length) best = Array.from(els);
    }
    if (best.length > 1) return best;

    const titleLinks = document.querySelectorAll(S.titleLinks);
    if (titleLinks.length) {
      const seen = new Set();
      const cards = [];
      for (const a of titleLinks) {
        const card = a.closest(S.cardContainer) || a;
        if (!seen.has(card)) { seen.add(card); cards.push(card); }
      }
      return cards;
    }
    return [];
  }

  function clickJobCard(card) {
    const link = card.querySelector(S.jobLink)
      || card.querySelector(S.fallbackLink)
      || card.querySelector(S.anyLink);
    if (link) {
      link.click();
      return true;
    }
    card.click();
    return true;
  }

  function isSidebarOpen() {
    return !!document.querySelector(S.sidebar);
  }

  async function waitForSidebarContent() {
    try {
      await waitForSelector(S.sidebarReady, 6000);
    } catch {
      return false;
    }
    await sleep(1500);
    const title = JE.extractTitle();
    if (!title) await sleep(1500);
    return true;
  }

  function closeSidebar() {
    const closeBtn = document.querySelector(S.sidebarClose);
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }

  async function getCopiedUids() {
    try {
      const { copiedJobUids = [] } = await chrome.storage.local.get('copiedJobUids');
      return new Set(copiedJobUids);
    } catch {
      return new Set();
    }
  }

  function sendProgress(current, total, title) {
    chrome.runtime.sendMessage({ action: 'batchProgress', current, total, title: title || '' });
  }

  async function batchExtract(count) {
    batchStopped = false;
    const results = [];
    const seenUrls = new Set();
    const alreadyCopied = await getCopiedUids();
    const cards = getJobListItems();
    const total = Math.min(count, cards.length);
    if (total === 0) {
      return { success: false, error: 'No job cards found on this page. Make sure you are on Best Matches, Most Recent, or Search Results.' };
    }

    for (let i = 0; i < total; i++) {
      if (batchStopped) {
        sendProgress(i, total, 'Stopped by user');
        break;
      }
      const preLink = cards[i].querySelector(S.jobLink);
      const preUid = (preLink?.href || '').match(/~(\w+)/)?.[1] || null;
      if (preUid && alreadyCopied.has(preUid)) {
        sendProgress(i + 1, total, '(already copied, skipped)');
        results.push({ success: false, index: i, skipped: true, uid: preUid });
        continue;
      }
      await extractCard(cards[i], i, total, results, seenUrls);
    }
    return { success: true, results, total };
  }

  async function extractCard(card, index, total, results, seenUrls) {
    sendProgress(index + 1, total, 'Opening...');
    try {
      clickJobCard(card);
      const loaded = await waitForSidebarContent();
      if (!loaded) {
        results.push({ success: false, index, error: 'Sidebar did not load' });
        return;
      }
      const data = JE.extractJobData();
      const jobLink = card.querySelector(S.jobLink);
      if (jobLink) data.url = jobLink.href;
      const uid = data.url.match(/~(\d+)/)?.[1] || data.url;
      if (seenUrls.has(uid)) {
        sendProgress(index + 1, total, '(duplicate, skipped)');
        closeSidebar();
        await sleep(500);
        return;
      }
      seenUrls.add(uid);
      sendProgress(index + 1, total, data.title);
      results.push({ success: true, data });
      closeSidebar();
      await sleep(800);
    } catch (err) {
      results.push({ success: false, index, error: err.message });
      closeSidebar();
      await sleep(500);
    }
  }

  function stopBatch() {
    batchStopped = true;
  }

  Object.assign(JE, { sleep, waitForSelector, getJobListItems, clickJobCard, isSidebarOpen, waitForSidebarContent, closeSidebar, batchExtract, stopBatch });
})();
