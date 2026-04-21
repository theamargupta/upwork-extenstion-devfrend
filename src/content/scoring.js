(() => {
  'use strict';

  const JE = globalThis.__jobExtractor;

  function parseDollarAmount(str) {
    if (!str || str === 'Not specified') return 0;
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

  function effectiveBudget(data) {
    const raw = parseDollarAmount(data.budget.amount);
    if (raw > 0 && raw <= 50) {
      const avg = parseDollarAmount(data.bidRange && data.bidRange.avg);
      if (avg > raw) return avg;
    }
    return raw;
  }

  function calculateScore(data) {
    let score = 5;
    const budget = effectiveBudget(data);
    if (budget >= 1000) score += 3;
    else if (budget >= 500) score += 2;
    else if (budget >= 200) score += 1;
    else if (budget > 0) score -= 1;

    if (data.client.paymentVerified) score += 1;
    else score -= 2;

    const hireRate = parseInt(data.client.hireRate) || 0;
    if (hireRate > 50) score += 2;
    else if (hireRate > 20) score += 1;
    else if (data.client.hireRate !== 'Not specified' && hireRate === 0) score -= 1;

    const proposalText = data.proposals.toLowerCase();
    if (/less than 5|fewer than 5/i.test(proposalText)) score += 2;
    else if (/5 to 10/i.test(proposalText)) score += 1;
    else if (/10 to 15/i.test(proposalText)) score += 0;
    else if (/15 to 20/i.test(proposalText)) score -= 1;
    else if (/20 to 50/i.test(proposalText)) score -= 2;
    else if (/50/i.test(proposalText)) score -= 3;

    const posted = data.postedDate.toLowerCase();
    if (/minute|just now/i.test(posted)) score += 1;

    const spent = parseDollarAmount(data.client.totalSpent);
    if (spent >= 10000) score += 2;
    else if (spent >= 1000) score += 1;
    return Math.max(1, Math.min(10, score));
  }

  function getScoreLabel(score) {
    if (score >= 8) return { label: 'APPLY', color: '#22C55E' };
    if (score >= 5) return { label: 'MAYBE', color: '#EAB308' };
    return { label: 'SKIP', color: '#EF4444' };
  }

  function extractJobData() {
    const projectInfo = JE.extractProjectInfo();
    const connects = JE.extractConnects();
    const activity = JE.extractActivity();
    const bidRange = JE.extractBidRange();
    const data = {
      title: JE.extractTitle(),
      description: JE.extractDescription(),
      budget: JE.extractBudget(),
      experienceLevel: JE.extractExperienceLevel(),
      skills: JE.extractSkills(),
      postedDate: JE.extractPostedDate(),
      location: JE.extractLocation(),
      projectLength: projectInfo.projectLength,
      projectType: projectInfo.projectType,
      proposals: JE.extractProposals(),
      lastViewed: activity.lastViewed,
      interviewing: activity.interviewing,
      invitesSent: activity.invitesSent,
      bidRange,
      connectsRequired: connects.required,
      connectsAvailable: connects.available,
      client: JE.extractClientInfo(),
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };
    data.score = calculateScore(data);
    data.scoreLabel = getScoreLabel(data.score);
    return data;
  }

  Object.assign(JE, { parseDollarAmount, effectiveBudget, calculateScore, getScoreLabel, extractJobData });
})();
