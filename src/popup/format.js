export function formatMarkdown(data) {
  const lines = [];
  lines.push(`# ${data.title}`);
  lines.push('');
  lines.push(`**URL:** ${data.url}`);
  lines.push(`**Score:** ${data.score}/10 — ${data.scoreLabel.label}`);
  lines.push('');
  lines.push('## Key Metrics');
  lines.push(`- **Budget:** ${data.budget.amount} (${data.budget.type})`);
  lines.push(`- **Experience Level:** ${data.experienceLevel}`);
  lines.push(`- **Posted:** ${data.postedDate}`);
  lines.push(`- **Location:** ${data.location}`);
  lines.push(`- **Proposals:** ${data.proposals}`);
  lines.push(`- **Project Length:** ${data.projectLength || 'N/A'}`);
  lines.push(`- **Project Type:** ${data.projectType || 'N/A'}`);
  lines.push('');
  lines.push('## Activity');
  lines.push(`- **Last Viewed:** ${data.lastViewed}`);
  lines.push(`- **Interviewing:** ${data.interviewing}`);
  lines.push(`- **Invites Sent:** ${data.invitesSent}`);
  lines.push('');
  lines.push('## Bid Range');
  lines.push(`- **High:** ${data.bidRange.high} | **Avg:** ${data.bidRange.avg} | **Low:** ${data.bidRange.low}`);
  lines.push('');
  lines.push('## Connects');
  lines.push(`- **Required:** ${data.connectsRequired}`);
  lines.push(`- **Available:** ${data.connectsAvailable}`);
  lines.push('');
  lines.push('## Skills');
  lines.push(data.skills.length ? data.skills.map(s => `\`${s}\``).join(', ') : 'None listed');
  lines.push('');
  lines.push('## Client Info');
  lines.push(`- **Payment:** ${data.client.paymentVerified ? 'Verified' : 'Not Verified'}`);
  lines.push(`- **Location:** ${data.client.location}`);
  lines.push(`- **Hire Rate:** ${data.client.hireRate}`);
  lines.push(`- **Open Jobs:** ${data.client.openJobs}`);
  lines.push(`- **Total Spent:** ${data.client.totalSpent}`);
  lines.push(`- **Member Since:** ${data.client.memberSince}`);
  lines.push(`- **Rating:** ${data.client.rating}`);
  lines.push(`- **Reviews:** ${data.client.reviews}`);
  lines.push('');
  lines.push('## Description');
  lines.push(data.description || 'No description available');
  return lines.join('\n');
}

const COUNTRY_SHORT = {
  'United States': 'US', 'United Kingdom': 'UK', 'Canada': 'CA', 'Australia': 'AU',
  'Germany': 'DE', 'France': 'FR', 'Netherlands': 'NL', 'Ireland': 'IE',
  'New Zealand': 'NZ', 'Switzerland': 'CH', 'Sweden': 'SE', 'Norway': 'NO',
  'Denmark': 'DK', 'Finland': 'FI', 'Israel': 'IL', 'Japan': 'JP',
  'Singapore': 'SG', 'Hong Kong': 'HK', 'South Korea': 'KR',
  'United Arab Emirates': 'UAE', 'Saudi Arabia': 'SA',
  'India': 'IN', 'Pakistan': 'PK', 'Bangladesh': 'BD', 'Philippines': 'PH',
  'Indonesia': 'ID', 'Vietnam': 'VN', 'Thailand': 'TH', 'Malaysia': 'MY',
  'Brazil': 'BR', 'Mexico': 'MX', 'Argentina': 'AR',
  'Spain': 'ES', 'Italy': 'IT', 'Portugal': 'PT', 'Poland': 'PL',
  'Ukraine': 'UA', 'Russia': 'RU', 'Turkey': 'TR', 'Egypt': 'EG',
  'South Africa': 'ZA', 'Nigeria': 'NG', 'Kenya': 'KE'
};

export function formatAmount(s) {
  const n = parseFloat(String(s).replace(/[$,]/g, ''));
  if (!isFinite(n)) return String(s);
  if (n >= 1000) {
    const k = n / 1000;
    return '$' + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return '$' + (Number.isInteger(n) ? n : n.toFixed(2).replace(/\.00$/, ''));
}

export function compactBudget(b) {
  if (!b || !b.amount || b.amount === 'Not specified') return 'unspecified';
  const isHourly = b.type === 'Hourly';
  const tail = isHourly ? '/hr' : ' fixed';
  const matches = b.amount.match(/\$[\d,]+(?:\.\d+)?/g);
  if (!matches || !matches.length) return `${b.amount}${tail}`;
  if (matches.length >= 2) return `${formatAmount(matches[0])}-${formatAmount(matches[1]).replace('$', '')}${tail}`;
  return `${formatAmount(matches[0])}${tail}`;
}

export function compactCountry(location) {
  if (!location || location === 'Not specified') return '?';
  if (/worldwide/i.test(location)) return 'WW';
  const parts = location.split(',').map(s => s.trim());
  const last = parts[parts.length - 1];
  return COUNTRY_SHORT[last] || last;
}

export function compactClient(c) {
  const bits = [];
  if (c.totalSpent && c.totalSpent !== 'Not specified') bits.push(`${c.totalSpent} spent`);
  if (c.hireRate && c.hireRate !== 'Not specified') {
    const pct = parseInt(c.hireRate, 10) || 0;
    const flag = pct > 0 && pct < 30 ? ' ⚠️' : '';
    bits.push(`${c.hireRate} hire${flag}`);
  }
  if (c.reviews && c.reviews !== 'Not specified' && c.reviews !== '0') bits.push(`${c.reviews} reviews`);
  if (c.paymentVerified === false) bits.push('⚠️ not verified');
  return bits.join(', ');
}

export function compactUrl(url) {
  if (!url) return '?';
  const m = url.match(/~(\w+)/);
  return m ? `~${m[1]}` : url.split('?')[0];
}

export function shortenAsk(desc) {
  if (!desc) return 'No description';
  const cleaned = desc.replace(/\s+/g, ' ').trim();
  const firstSentence = cleaned.match(/^[^.!?\n]{20,220}[.!?]/);
  let snippet = firstSentence ? firstSentence[0] : cleaned;
  if (snippet.length > 220) snippet = snippet.slice(0, 217) + '...';
  return snippet.trim();
}

export function formatCompact(data, index) {
  const prefix = typeof index === 'number' ? `[${index + 1}] ` : '';
  const title = (data.title || 'Untitled').replace(/\s+/g, ' ').trim();
  const score = `${data.score}/10 ${data.scoreLabel.label}`;
  const stack = (data.skills && data.skills.length) ? data.skills.join(', ') : 'not listed';
  return [
    `${prefix}${title} | ${score}`,
    `${compactBudget(data.budget)} | ${compactCountry(data.client?.location)} | ${compactClient(data.client || {})}`,
    shortenAsk(data.description),
    `Stack: ${stack}`,
    compactUrl(data.url)
  ].join('\n');
}

export function formatBatchMarkdown(jobs) {
  return jobs.map((j, i) => `---\n\n## Job ${i + 1}\n\n${formatMarkdown(j)}`).join('\n\n');
}

export function formatBatchCompact(jobs) {
  const now = new Date().toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
  const header = `Batch of ${jobs.length} jobs pulled at ${now}`;
  return `${header}\n\n` + jobs.map((j, i) => formatCompact(j, i)).join('\n\n');
}
