(() => {
  'use strict';

  const JE = globalThis.__jobExtractor;
  const S = JE.SELECTORS;
  const J = S.jobDetail;
  const C = S.client;
  const { qs, qsAll, textOf, allTextOf } = JE;

  function extractTitle() {
    return textOf(J.title);
  }

  function extractDescription() {
    const el = qs(J.description);
    if (el) return el.innerText.trim();
    const paragraphs = document.querySelectorAll(J.descriptionFallback);
    let longest = '';
    for (const p of paragraphs) {
      const t = p.innerText.trim();
      if (t.length > longest.length) longest = t;
    }
    return longest;
  }

  function extractBudget() {
    let budgetEl = qs(J.fixedBudget);
    if (budgetEl) {
      const li = budgetEl.closest('li') || budgetEl.parentElement;
      const fullText = li ? li.textContent.trim() : budgetEl.textContent.trim();
      const amountMatch = fullText.match(/\$[\d,.]+(?:\s*-\s*\$[\d,.]+)?/);
      return { amount: amountMatch ? amountMatch[0] : fullText, type: 'Fixed-Price' };
    }
    budgetEl = qs(J.hourlyBudget);
    if (budgetEl) {
      const li = budgetEl.closest('li') || budgetEl.parentElement;
      const fullText = li ? li.textContent.trim() : budgetEl.textContent.trim();
      const amountMatch = fullText.match(/\$[\d,.]+(?:\s*\/\s*hr)?(?:\s*-\s*\$[\d,.]+(?:\s*\/\s*hr)?)?/);
      return { amount: amountMatch ? amountMatch[0] : fullText, type: 'Hourly' };
    }
    const features = qsAll(J.features);
    for (const f of features) {
      const text = f.textContent.trim();
      if (/\$[\d,]+/.test(text)) {
        const amountMatch = text.match(/\$[\d,.]+(?:\s*-\s*\$[\d,.]+)?/);
        return { amount: amountMatch ? amountMatch[0] : text, type: /hour/i.test(text) ? 'Hourly' : 'Fixed-Price' };
      }
    }
    const budgetMatch = document.body.innerText.match(/(?:Budget|Est\.\s*Budget)[:\s]*(\$[\d,]+(?:\.\d+)?(?:\s*-\s*\$[\d,]+(?:\.\d+)?)?)/i);
    if (budgetMatch) return { amount: budgetMatch[1], type: /hour/i.test(budgetMatch[0]) ? 'Hourly' : 'Fixed-Price' };
    return { amount: 'Not specified', type: 'Unknown' };
  }

  function extractExperienceLevel() {
    const text = textOf(J.experience);
    if (text) return text;
    for (const f of qsAll(J.features)) {
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
    return allTextOf(J.skills);
  }

  function extractPostedDate() {
    const t = textOf(J.postedDate);
    if (t) return t;
    const m = document.body.innerText.match(/Posted\s+([\w\s]+ago)/i);
    return m ? m[1].trim() : 'Not specified';
  }

  function extractLocation() {
    const t = textOf(J.location);
    if (t) return t;
    const postedLine = qs(J.postedLine);
    if (postedLine) {
      const locP = postedLine.querySelector(J.postedLineLocation);
      if (locP) return locP.textContent.trim();
    }
    if (/\bWorldwide\b/i.test(document.body.innerText)) return 'Worldwide';
    return 'Not specified';
  }

  function extractProjectInfo() {
    const info = { projectLength: '', projectType: '' };
    for (const item of qsAll(J.projectInfo)) {
      const t = item.textContent.trim();
      if (/month|week|year|less than|more than/i.test(t) && /to/i.test(t)) {
        const durMatch = t.match(/(?:Less than|More than|\d+)\s+to\s+\d+\s+(?:month|week|year)s?/i)
          || t.match(/(?:Less than|More than)\s+\d+\s+(?:month|week|year)s?/i);
        info.projectLength = durMatch ? durMatch[0] : t.split('\n')[0].trim();
      }
      if (/one-time|ongoing|complex/i.test(t)) {
        const typeMatch = t.match(/(one-time project|ongoing project|complex project)/i);
        info.projectType = typeMatch ? typeMatch[1] : t;
      }
    }
    return info;
  }

  function extractProposals() {
    const t = textOf(J.proposals);
    if (t) return t;
    const m = document.body.innerText.match(/(Less than \d+|(\d+)\s*to\s*(\d+)|\d+\+?)\s*Proposal/i);
    return m ? m[0].replace(/Proposals?/i, '').trim() : 'Not specified';
  }

  function extractActivity() {
    const activity = {};
    const body = document.body.innerText;
    const lvMatch = body.match(/Last\s*viewed\s*by\s*client[:\s]*([\w\s]+ago)/i);
    const intMatch = body.match(/Interviewing[:\s]*(\d+)/i);
    const invMatch = body.match(/Invites?\s*sent[:\s]*(\d+)/i);
    const unMatch = body.match(/Unanswered\s*invites?[:\s]*(\d+)/i);
    activity.lastViewed = lvMatch ? lvMatch[1].trim() : 'Not specified';
    activity.interviewing = intMatch ? intMatch[1] : 'Not specified';
    activity.invitesSent = invMatch ? invMatch[1] : 'Not specified';
    activity.unansweredInvites = unMatch ? unMatch[1] : 'Not specified';
    return activity;
  }

  function extractBidRange() {
    const body = document.body.innerText;
    const combined = body.match(/Bid\s*range[^$]*High\s*\$([\d,.]+)\s*Avg\s*\$([\d,.]+)\s*Low\s*\$([\d,.]+)/i);
    if (combined) return { high: '$' + combined[1], avg: '$' + combined[2], low: '$' + combined[3] };
    const highMatch = body.match(/High[:\s]*\$([\d][\d,.]*)/i);
    const avgMatch = body.match(/Avg[:\s]*\$([\d][\d,.]*)/i);
    const lowMatch = body.match(/Low[:\s]*\$([\d][\d,.]*)/i);
    return {
      high: highMatch ? '$' + highMatch[1] : 'N/A',
      avg: avgMatch ? '$' + avgMatch[1] : 'N/A',
      low: lowMatch ? '$' + lowMatch[1] : 'N/A'
    };
  }

  function extractConnects() {
    const body = document.body.innerText;
    const reqMatch = body.match(/(?:proposal\s*for[:\s]*|submit\s*a\s*proposal[:\s]*)(\d+)\s*Connects?/i)
      || body.match(/(\d+)\s*Connects?\s*(?:required|to submit)/i);
    const availMatch = body.match(/Available\s*Connects?[:\s]*(\d+)/i)
      || body.match(/You\s*have\s*(\d+)\s*Connects?/i);
    return { required: reqMatch ? reqMatch[1] : 'Not specified', available: availMatch ? availMatch[1] : 'Not specified' };
  }

  function extractClientInfo() {
    const client = {};
    const searchArea = qs(C.container) || document.body;
    const text = searchArea.innerText;
    if (/payment\s*(method\s*)?not\s*verified/i.test(text)) client.paymentVerified = false;
    else {
      const verifiedEl = searchArea.querySelector(C.paymentVerified);
      const notVerifiedEl = searchArea.querySelector(C.paymentNotVerified);
      client.paymentVerified = notVerifiedEl ? false : verifiedEl ? true : /payment\s*(method\s*)?verified/i.test(text) && !/not\s*verified/i.test(text);
    }
    const locEl = searchArea.querySelector(C.location);
    if (locEl) {
      const country = locEl.querySelector(C.country)?.textContent.trim() || '';
      const city = locEl.querySelector(C.city)?.textContent.trim() || '';
      client.location = [city, country].filter(Boolean).join(', ') || locEl.textContent.trim();
    } else {
      const locMatch = text.match(/(?:Location|Client\s*Location)[:\s]*([^\n]+)/i);
      client.location = locMatch ? locMatch[1].trim() : 'Not specified';
    }
    const hireMatch = text.match(/(\d+)%\s*(?:hire\s*rate)/i);
    const jobsMatch = text.match(/(\d+)\s*open\s*jobs?/i) || text.match(/(\d+)\s*jobs?\s*(?:posted|open)/i);
    const spentMatch = text.match(/\$[\d,.]+[KkMm]?\s*(?:total\s*)?spent/i) || text.match(/(?:total\s*)?spent[:\s]*\$[\d,.]+[KkMm]?/i);
    const memberMatch = text.match(/Member\s*since\s*([A-Z][a-z]+\s*\d{1,2},?\s*\d{4})/i) || text.match(/Member\s*since\s*([A-Z][a-z]+\s*\d{4})/i);
    const ratingMatch = text.match(/([\d.]+)\s*(?:of\s*5|\/\s*5|\s*stars?)/i);
    const reviewMatch = text.match(/(\d+)\s*reviews?/i);
    client.hireRate = hireMatch ? hireMatch[1] + '%' : 'Not specified';
    client.openJobs = jobsMatch ? jobsMatch[1] : 'Not specified';
    client.totalSpent = spentMatch ? (spentMatch[0].match(/\$[\d,.]+[KkMm]?/)?.[0] || 'Not specified') : 'Not specified';
    client.memberSince = memberMatch ? memberMatch[1].trim() : 'Not specified';
    client.rating = ratingMatch ? ratingMatch[1] : 'Not specified';
    client.reviews = reviewMatch ? reviewMatch[1] : 'Not specified';
    return client;
  }

  Object.assign(JE, { extractTitle, extractDescription, extractBudget, extractExperienceLevel, extractSkills, extractPostedDate, extractLocation, extractProjectInfo, extractProposals, extractActivity, extractBidRange, extractConnects, extractClientInfo });
})();
