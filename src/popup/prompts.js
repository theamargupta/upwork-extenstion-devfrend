import { contextBlock } from './context.js';
import { formatMarkdown } from './format.js';

export function wrapAsShortlistPrompt(compactText, jobCount) {
  return `# Job Shortlist

${contextBlock()}I've extracted ${jobCount} Upwork job${jobCount === 1 ? '' : 's'} via my Chrome extension. Each row is:

- Line 1: \`[N] Title | score/10 LABEL\`
- Line 2: \`budget | country | client signal\` (⚠️ = red flag: low hire rate or unverified payment)
- Line 3: one-line ask (first sentence of the description)
- Line 4: \`Stack: <skills>\`
- Line 5: \`~<UID>\` (Upwork job id)

Rank them best-to-worst given my profile. For each, give one-line reasoning. Call out red flags explicitly.

---

${compactText}`;
}

export function wrapAsPickBestPrompt(fullMarkdown, jobCount) {
  return `# Pick the best Upwork job to apply to

${contextBlock()}I've extracted ${jobCount} Upwork job${jobCount === 1 ? '' : 's'} with full detail (budget, client history, description, skills, activity). Everything you need is below — no need to ask me for more info.

**Your task:**
1. Pick **ONE** single best job to apply to right now, given my profile and filter rules above.
2. Start your reply with exactly: \`BEST: [N]\` (N = the job number).
3. Then 2-3 lines of reasoning (why this one beats the others, what's the risk).
4. Then a **cover-letter hook** — 3-4 sentences I can paste/edit. Open with the client's specific need (not "I'm Amar"), name the concrete MCP/agent angle from my stack that fits, and end with one question that proves I read the brief.

Do **not** list or discuss the rejected jobs — only the winner. Reply in casual Hinglish as per my profile.

---

${fullMarkdown}`;
}

export function wrapAsCoverLetterPrompt(job) {
  const details = job?.score != null
    ? formatMarkdown(job)
    : (job?.pageText
      ? `# ${job.title || 'Upwork job'}\n**URL:** ${job.url || ''}\n\n${job.pageText}`
      : `# ${job?.title || 'Upwork job'}\n**URL:** ${job?.url || ''}`);
  return `${contextBlock()}You are writing an Upwork cover letter for me (profile above).

Job details:
${details}

Write a cover letter:
- 4-5 sentences max
- Open with the concrete stack/need fit (NOT "I'm Amar")
- Name one shipped product of mine that maps to their need (sathi.devfrend.com, mcp.devfrend.com, ai.chat.devfrend.com, devfrend.com, amargupta.tech)
- End with ONE sharp question that proves I read the brief
- Professional English (this goes to the client, NOT Hinglish)
- No preamble, no markdown headings, no signature, just the letter body

Reply with ONLY the letter text. Nothing else.`;
}
