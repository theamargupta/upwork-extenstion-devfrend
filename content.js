// Upwork Job Extractor — Content Script
// Extracts job data from Upwork job pages using multiple fallback selectors.

(() => {
  'use strict';

  // --- Selector helpers ---

  function qs(selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function qsAll(selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length) return Array.from(els);
    }
    return [];
  }

  function textOf(selectors) {
    const el = qs(selectors);
    return el ? el.textContent.trim() : '';
  }

  function allTextOf(selectors) {
    return qsAll(selectors).map(el => el.textContent.trim()).filter(Boolean);
  }

  // --- Extraction functions ---

  function extractTitle() {
    // Upwork wraps the title text inside h4 > span.flex-1, not on h4 itself
    return textOf([
      'h4 span.flex-1',
      'h1 span.flex-1',
      'h4.flex-1',
      'h1.flex-1',
      'h4[data-test="job-title"]',
      'h1[data-test="job-title"]',
      '.job-details-header h4',
      '.job-details-header h1',
      'header h4',
      'header h1',
      'h4',
      'h1'
    ]);
  }

  function extractDescription() {
    const el = qs([
      '.text-body-sm.multiline-text',
      '[data-test="Description"]',
      '[data-test="description"]',
      '.break.word-break',
      '.break',
      '.job-description',
      '.description .text-body',
      'section .text-body-sm',
      '[data-cy="description"]'
    ]);
    if (el) return el.innerText.trim();

    // Fallback: look for a large text block in the page
    const paragraphs = document.querySelectorAll('p, div.text-body-sm');
    let longest = '';
    for (const p of paragraphs) {
      const t = p.innerText.trim();
      if (t.length > longest.length) longest = t;
    }
    return longest;
  }

  function extractBudget() {
    // The [data-cy="fixed-price"] attribute is on the SVG icon container, not the price.
    // Walk up to the parent <li> to get the full text including the dollar amount.
    let budgetEl = qs([
      '[data-cy="fixed-price"]',
      '[data-test="fixed-price"]',
      '[data-test="budget"]',
      '.features [data-cy="fixed-price"]'
    ]);
    if (budgetEl) {
      // Walk up to the nearest <li> to get the amount text
      const li = budgetEl.closest('li') || budgetEl.parentElement;
      const fullText = li ? li.textContent.trim() : budgetEl.textContent.trim();
      const amountMatch = fullText.match(/\$[\d,.]+(?:\s*-\s*\$[\d,.]+)?/);
      const amount = amountMatch ? amountMatch[0] : fullText;
      return { amount, type: 'Fixed-Price' };
    }

    // Hourly — same pattern: data-cy is on icon, amount is in parent <li>
    budgetEl = qs([
      '[data-cy="hourly-rate"]',
      '[data-test="hourly-rate"]',
      '[data-test="hourly-budget"]'
    ]);
    if (budgetEl) {
      const li = budgetEl.closest('li') || budgetEl.parentElement;
      const fullText = li ? li.textContent.trim() : budgetEl.textContent.trim();
      const amountMatch = fullText.match(/\$[\d,.]+(?:\s*\/\s*hr)?(?:\s*-\s*\$[\d,.]+(?:\s*\/\s*hr)?)?/);
      const amount = amountMatch ? amountMatch[0] : fullText;
      return { amount, type: 'Hourly' };
    }

    // Generic features scan
    const features = qsAll(['.features li', '.job-features li', '[data-test="features"] li']);
    for (const f of features) {
      const text = f.textContent.trim();
      if (/\$[\d,]+/.test(text)) {
        const isHourly = /hour/i.test(text);
        const amountMatch = text.match(/\$[\d,.]+(?:\s*-\s*\$[\d,.]+)?/);
        return { amount: amountMatch ? amountMatch[0] : text, type: isHourly ? 'Hourly' : 'Fixed-Price' };
      }
    }

    // Scan all text for budget pattern
    const allText = document.body.innerText;
    const budgetMatch = allText.match(/(?:Budget|Est\.\s*Budget)[:\s]*(\$[\d,]+(?:\.\d+)?(?:\s*-\s*\$[\d,]+(?:\.\d+)?)?)/i);
    if (budgetMatch) {
      return { amount: budgetMatch[1], type: /hour/i.test(budgetMatch[0]) ? 'Hourly' : 'Fixed-Price' };
    }

    return { amount: 'Not specified', type: 'Unknown' };
  }

  function extractExperienceLevel() {
    const text = textOf([
      '[data-test="experience-level"]',
      '[data-cy="experience-level"]',
      '.experience-level'
    ]);
    if (text) return text;

    const features = qsAll(['.features li', '.job-features li', '[data-test="features"] li']);
    for (const f of features) {
      const t = f.textContent.trim();
      if (/entry.level/i.test(t)) return 'Entry Level';
      if (/intermediate/i.test(t)) return 'Intermediate';
      if (/expert/i.test(t)) return 'Expert';
    }

    const body = document.body.innerText;
    if (/Expert/i.test(body) && /experience\s*level/i.test(body)) return 'Expert';
    if (/Intermediate/i.test(body) && /experience\s*level/i.test(body)) return 'Intermediate';
    if (/Entry\s*Level/i.test(body)) return 'Entry Level';

    return 'Not specified';
  }

  function extractSkills() {
    return allTextOf([
      '.air3-badge-highlight',
      '.skills-list .badge',
      '.skills-list a',
      '[data-test="Ede Skills"] .air3-badge',
      '[data-test="skills-list"] .air3-badge',
      '.skill-badge',
      '.skills a.badge',
      '.up-skill-badge',
      'a[data-test="attr-item"]'
    ]);
  }

  function extractPostedDate() {
    const t = textOf([
      '[data-test="PostedOn"]',
      '[data-test="posted-on"]',
      '.posted-on',
      'time'
    ]);
    if (t) return t;

    // Regex scan
    const body = document.body.innerText;
    const m = body.match(/Posted\s+([\w\s]+ago)/i);
    return m ? m[1].trim() : 'Not specified';
  }

  function extractLocation() {
    const t = textOf([
      '[data-test="location"]',
      '[data-cy="location"]',
      '.location'
    ]);
    if (t) return t;

    // Upwork shows location near the posted-on line with a map icon
    // Look for the text in .posted-on-line or nearby elements
    const postedLine = qs(['.posted-on-line', '.d-flex.posted-on-line']);
    if (postedLine) {
      const locP = postedLine.querySelector('p.text-light-on-muted');
      if (locP) return locP.textContent.trim();
    }

    const body = document.body.innerText;
    if (/\bWorldwide\b/i.test(body)) return 'Worldwide';

    return 'Not specified';
  }

  function extractProjectInfo() {
    const items = qsAll([
      '.features li',
      '.job-features li',
      '[data-test="features"] li',
      '.segmentations li'
    ]);
    const info = { projectLength: '', projectType: '' };
    for (const item of items) {
      const t = item.textContent.trim();
      if (/month|week|year|less than|more than/i.test(t) && /to/i.test(t)) {
        // Extract clean duration: "1 to 3 months" — avoid duplicate text
        const durMatch = t.match(/(?:Less than|More than|\d+)\s+to\s+\d+\s+(?:month|week|year)s?/i)
          || t.match(/(?:Less than|More than)\s+\d+\s+(?:month|week|year)s?/i);
        info.projectLength = durMatch ? durMatch[0] : t.split('\n')[0].trim();
      }
      if (/one-time|ongoing|complex/i.test(t)) {
        // Extract just the type value, not the label
        const typeMatch = t.match(/(one-time project|ongoing project|complex project)/i);
        info.projectType = typeMatch ? typeMatch[1] : t;
      }
    }
    return info;
  }

  function extractProposals() {
    const t = textOf([
      '[data-test="proposals"]',
      '[data-cy="proposals"]',
      '.proposals'
    ]);
    if (t) return t;

    const body = document.body.innerText;
    const m = body.match(/(Less than \d+|(\d+)\s*to\s*(\d+)|\d+\+?)\s*Proposal/i);
    return m ? m[0].replace(/Proposals?/i, '').trim() : 'Not specified';
  }

  function extractActivity() {
    const activity = {};
    const body = document.body.innerText;

    // Last viewed
    const lvMatch = body.match(/Last\s*viewed\s*by\s*client[:\s]*([\w\s]+ago)/i);
    activity.lastViewed = lvMatch ? lvMatch[1].trim() : 'Not specified';

    // Interviewing
    const intMatch = body.match(/Interviewing[:\s]*(\d+)/i);
    activity.interviewing = intMatch ? intMatch[1] : 'Not specified';

    // Invites sent
    const invMatch = body.match(/Invites?\s*sent[:\s]*(\d+)/i);
    activity.invitesSent = invMatch ? invMatch[1] : 'Not specified';

    // Unanswered invites
    const unMatch = body.match(/Unanswered\s*invites?[:\s]*(\d+)/i);
    activity.unansweredInvites = unMatch ? unMatch[1] : 'Not specified';

    return activity;
  }

  function extractBidRange() {
    const body = document.body.innerText;
    const range = {};

    // Look for the combined line first: "Bid range - High $200.00  Avg $200.00  Low $200.00"
    const combined = body.match(/Bid\s*range[^$]*High\s*\$([\d,.]+)\s*Avg\s*\$([\d,.]+)\s*Low\s*\$([\d,.]+)/i);
    if (combined) {
      range.high = '$' + combined[1];
      range.avg = '$' + combined[2];
      range.low = '$' + combined[3];
      return range;
    }

    // Fallback: individual matches — require at least 1 digit after $
    const highMatch = body.match(/High[:\s]*\$([\d][\d,.]*)/i);
    const avgMatch = body.match(/Avg[:\s]*\$([\d][\d,.]*)/i);
    const lowMatch = body.match(/Low[:\s]*\$([\d][\d,.]*)/i);

    range.high = highMatch ? '$' + highMatch[1] : 'N/A';
    range.avg = avgMatch ? '$' + avgMatch[1] : 'N/A';
    range.low = lowMatch ? '$' + lowMatch[1] : 'N/A';

    return range;
  }

  function extractConnects() {
    const body = document.body.innerText;
    // "Send a proposal for: 9 Connects" or "X Connects required/to submit"
    const reqMatch = body.match(/(?:proposal\s*for[:\s]*|submit\s*a\s*proposal[:\s]*)(\d+)\s*Connects?/i)
      || body.match(/(\d+)\s*Connects?\s*(?:required|to submit)/i);
    const availMatch = body.match(/Available\s*Connects?[:\s]*(\d+)/i)
      || body.match(/You\s*have\s*(\d+)\s*Connects?/i);

    return {
      required: reqMatch ? reqMatch[1] : 'Not specified',
      available: availMatch ? availMatch[1] : 'Not specified'
    };
  }

  function extractClientInfo() {
    const client = {};
    const container = qs([
      '[data-test="about-client-container"]',
      '[data-test="AboutClientBanner"]',
      '.about-client',
      '.client-info',
      '[data-cy="about-client"]'
    ]);

    const searchArea = container || document.body;
    const text = searchArea.innerText;

    // Payment verified — check for "not verified" FIRST to avoid false positives
    if (/payment\s*(method\s*)?not\s*verified/i.test(text)) {
      client.paymentVerified = false;
    } else {
      // Check for the explicit .payment-verified class (not .payment-not-verified)
      const verifiedEl = searchArea.querySelector('.payment-verified:not(.payment-not-verified)');
      const notVerifiedEl = searchArea.querySelector('.payment-not-verified');
      if (notVerifiedEl) {
        client.paymentVerified = false;
      } else if (verifiedEl) {
        client.paymentVerified = true;
      } else {
        client.paymentVerified = /payment\s*(method\s*)?verified/i.test(text)
          && !/not\s*verified/i.test(text);
      }
    }

    // Client location — Upwork uses [data-qa="client-location"] with country in <strong>
    const locEl = searchArea.querySelector('[data-qa="client-location"], [data-test="client-location"], [data-cy="client-location"]');
    if (locEl) {
      const countryEl = locEl.querySelector('strong');
      const cityEl = locEl.querySelector('.nowrap');
      const country = countryEl ? countryEl.textContent.trim() : '';
      const city = cityEl ? cityEl.textContent.trim() : '';
      client.location = [city, country].filter(Boolean).join(', ') || locEl.textContent.trim();
    } else {
      const locMatch = text.match(/(?:Location|Client\s*Location)[:\s]*([^\n]+)/i);
      client.location = locMatch ? locMatch[1].trim() : 'Not specified';
    }

    // Hire rate
    const hireMatch = text.match(/(\d+)%\s*(?:hire\s*rate)/i);
    client.hireRate = hireMatch ? hireMatch[1] + '%' : 'Not specified';

    // Open jobs — "1 open job" or "3 jobs posted" or "5 open jobs"
    const jobsMatch = text.match(/(\d+)\s*open\s*jobs?/i)
      || text.match(/(\d+)\s*jobs?\s*(?:posted|open)/i);
    client.openJobs = jobsMatch ? jobsMatch[1] : 'Not specified';

    // Total spent
    const spentMatch = text.match(/\$[\d,.]+[KkMm]?\s*(?:total\s*)?spent/i)
      || text.match(/(?:total\s*)?spent[:\s]*\$[\d,.]+[KkMm]?/i);
    if (spentMatch) {
      const amt = spentMatch[0].match(/\$[\d,.]+[KkMm]?/);
      client.totalSpent = amt ? amt[0] : 'Not specified';
    } else {
      client.totalSpent = 'Not specified';
    }

    // Member since
    const memberMatch = text.match(/Member\s*since\s*([A-Z][a-z]+\s*\d{1,2},?\s*\d{4})/i)
      || text.match(/Member\s*since\s*([A-Z][a-z]+\s*\d{4})/i);
    client.memberSince = memberMatch ? memberMatch[1].trim() : 'Not specified';

    // Rating
    const ratingMatch = text.match(/([\d.]+)\s*(?:of\s*5|\/\s*5|\s*stars?)/i);
    client.rating = ratingMatch ? ratingMatch[1] : 'Not specified';

    // Reviews
    const reviewMatch = text.match(/(\d+)\s*reviews?/i);
    client.reviews = reviewMatch ? reviewMatch[1] : 'Not specified';

    return client;
  }

  // --- Scoring ---

  function parseDollarAmount(str) {
    if (!str || str === 'Not specified') return 0;
    // Handle ranges like "$10 - $50" — take the higher end
    const amounts = str.match(/\$[\d,.]+[KkMm]?/g);
    if (!amounts) return 0;
    let max = 0;
    for (const a of amounts) {
      let num = parseFloat(a.replace(/[$,]/g, ''));
      if (/[Kk]/.test(a)) num *= 1000;
      if (/[Mm]/.test(a)) num *= 1000000;
      if (num > max) max = num;
    }
    return max;
  }

  function calculateScore(data) {
    let score = 5; // Start at midpoint

    // Budget scoring — more granular
    const budget = parseDollarAmount(data.budget.amount);
    if (budget >= 1000) score += 3;
    else if (budget >= 500) score += 2;
    else if (budget >= 200) score += 1;
    else if (budget > 0) score -= 1;

    // Payment verified
    if (data.client.paymentVerified) score += 1;
    else score -= 2;

    // Hire rate
    const hireRate = parseInt(data.client.hireRate) || 0;
    if (hireRate > 50) score += 2;
    else if (hireRate > 20) score += 1;
    else if (data.client.hireRate !== 'Not specified' && hireRate === 0) score -= 1;

    // Proposals — penalize competition more aggressively
    const proposalText = data.proposals.toLowerCase();
    if (/less than 5|fewer than 5/i.test(proposalText)) {
      score += 2;
    } else if (/5 to 10/i.test(proposalText)) {
      score += 1;
    } else if (/10 to 15/i.test(proposalText)) {
      score += 0; // neutral
    } else if (/15 to 20/i.test(proposalText)) {
      score -= 1;
    } else if (/20 to 50/i.test(proposalText)) {
      score -= 2;
    } else if (/50/i.test(proposalText)) {
      score -= 3;
    }

    // Posted recently
    const posted = data.postedDate.toLowerCase();
    if (/minute|just now/i.test(posted)) score += 1;

    // Client total spent — more granular
    const spent = parseDollarAmount(data.client.totalSpent);
    if (spent >= 10000) score += 2;
    else if (spent >= 1000) score += 1;

    // Clamp to 1-10
    return Math.max(1, Math.min(10, score));
  }

  function getScoreLabel(score) {
    if (score >= 8) return { label: 'APPLY', color: '#22C55E' };
    if (score >= 5) return { label: 'MAYBE', color: '#EAB308' };
    return { label: 'SKIP', color: '#EF4444' };
  }

  // --- Main extraction ---

  function extractJobData() {
    const projectInfo = extractProjectInfo();
    const connects = extractConnects();
    const activity = extractActivity();
    const bidRange = extractBidRange();

    const data = {
      title: extractTitle(),
      description: extractDescription(),
      budget: extractBudget(),
      experienceLevel: extractExperienceLevel(),
      skills: extractSkills(),
      postedDate: extractPostedDate(),
      location: extractLocation(),
      projectLength: projectInfo.projectLength,
      projectType: projectInfo.projectType,
      proposals: extractProposals(),
      lastViewed: activity.lastViewed,
      interviewing: activity.interviewing,
      invitesSent: activity.invitesSent,
      bidRange: bidRange,
      connectsRequired: connects.required,
      connectsAvailable: connects.available,
      client: extractClientInfo(),
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };

    data.score = calculateScore(data);
    data.scoreLabel = getScoreLabel(data.score);

    return data;
  }

  // --- Batch extraction helpers ---

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function waitForSelector(sel, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(sel);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error('timeout')); }, timeout);
    });
  }

  function getJobListItems() {
    // Upwork job list cards — multiple selector fallbacks, most specific first

    const selectors = [
      // Current Upwork layout: each job card is a <section> with air3-card-hover and opening UID
      'section.air3-card-section.air3-card-hover[data-ev-opening_uid]',
      // Job tile list section items
      '[data-test="job-tile-list"] > section',
      '[data-test="job-tile-list"] article',
      // Best matches / search results
      'section.up-card-section .job-tile-list article',
      '.job-tile-list .job-tile',
      // Each job card with impression tracking
      'section[data-ev-sublocation="job_feed_tile"]',
      '.air3-card-section[data-ev-opening_uid]',
      // Generic fallbacks
      '.job-tile',
      'article[data-ev-opening_uid]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 1) return Array.from(els);
    }

    // Last resort: find elements containing job title links
    const titleLinks = document.querySelectorAll(
      '[data-test="job-tile-list"] a[href*="/jobs/"], a[href*="/jobs/~"], a[href*="/best-matches/details/"]'
    );
    if (titleLinks.length) {
      // Walk up to the card container, dedup
      const seen = new Set();
      const cards = [];
      for (const a of titleLinks) {
        const card = a.closest('section[data-ev-opening_uid], section.air3-card-section, article') || a;
        if (!seen.has(card)) { seen.add(card); cards.push(card); }
      }
      return cards;
    }

    return [];
  }

  function clickJobCard(card) {
    // Find the clickable title link or the card itself
    const link = card.querySelector('a[href*="/jobs/~"], a[href*="/best-matches/details/"]')
      || card.querySelector('h4 a, h3 a, .job-title a')
      || card.querySelector('a');

    if (link) {
      link.click();
      return true;
    }
    // Try clicking the card directly
    card.click();
    return true;
  }

  function isSidebarOpen() {
    return !!document.querySelector(
      '.air3-slider[role="dialog"], .air3-slider-job-details, [data-test="air3-slider"]'
    );
  }

  async function waitForSidebarContent() {
    // Wait for the sidebar to appear and have meaningful content loaded
    try {
      await waitForSelector('.air3-slider[role="dialog"], .air3-slider-job-details', 6000);
    } catch {
      return false;
    }
    // Wait a bit more for content inside to render (description, client info, etc.)
    await sleep(1500);
    // Check that we have at least a title
    const title = extractTitle();
    if (!title) {
      await sleep(1500); // extra wait if title isn't there yet
    }
    return true;
  }

  function closeSidebar() {
    const closeBtn = document.querySelector(
      '[data-test="slider-close-mobile"], .air3-slider-close-mobile, .air3-slider .air3-btn-link[data-test="slider-go-back"]'
    );
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    // Try pressing Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }

  let batchStopped = false;

  async function batchExtract(count) {
    batchStopped = false;
    const results = [];
    const seenUrls = new Set();
    const cards = getJobListItems();
    const total = Math.min(count, cards.length);

    if (total === 0) {
      return { success: false, error: 'No job cards found on this page. Make sure you are on the Best Matches or Search Results page.' };
    }

    // Send progress update
    function sendProgress(current, total, title) {
      chrome.runtime.sendMessage({
        action: 'batchProgress',
        current,
        total,
        title: title || ''
      });
    }

    for (let i = 0; i < total; i++) {
      if (batchStopped) {
        sendProgress(i, total, 'Stopped by user');
        break;
      }
      sendProgress(i + 1, total, 'Opening...');

      try {
        // Click the job card
        clickJobCard(cards[i]);

        // Wait for sidebar to load
        const loaded = await waitForSidebarContent();
        if (!loaded) {
          results.push({ success: false, index: i, error: 'Sidebar did not load' });
          continue;
        }

        // Extract
        const data = extractJobData();
        // Override URL with the job-specific link if available
        const jobLink = cards[i].querySelector('a[href*="/jobs/~"], a[href*="/best-matches/details/"]');
        if (jobLink) {
          data.url = jobLink.href;
        }

        // Deduplicate by job UID extracted from URL
        const uidMatch = data.url.match(/~(\d+)/);
        const uid = uidMatch ? uidMatch[1] : data.url;
        if (seenUrls.has(uid)) {
          sendProgress(i + 1, total, '(duplicate, skipped)');
          closeSidebar();
          await sleep(500);
          continue;
        }
        seenUrls.add(uid);

        sendProgress(i + 1, total, data.title);
        results.push({ success: true, data });

        // Close sidebar before moving to next
        closeSidebar();
        await sleep(800);
      } catch (err) {
        results.push({ success: false, index: i, error: err.message });
        // Try to close sidebar in case it's still open
        closeSidebar();
        await sleep(500);
      }
    }

    return { success: true, results, total };
  }

  // --- Message listener ---

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'extractJob') {
      try {
        const data = extractJobData();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }

    if (request.action === 'batchExtract') {
      const count = request.count || 10;
      batchExtract(count).then(result => {
        sendResponse(result);
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (request.action === 'batchStop') {
      batchStopped = true;
      sendResponse({ success: true });
    }

    if (request.action === 'getJobCount') {
      const cards = getJobListItems();
      sendResponse({ success: true, count: cards.length });
    }

    return true; // keep channel open for async
  });
})();
