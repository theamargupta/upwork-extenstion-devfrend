import '../shared/selectors.js';
import { $, audit, extractJobUid, getActiveTab, showToast, sleep } from './utils.js';
import { askClaudeBridge } from './bridge.js';
import { wrapAsCoverLetterPrompt } from './prompts.js';
import { executeCommand } from '../commands/index.js';
import { captureDebugArtifact, renderAppDebug } from './render.js';
import { pickHighlights } from './auto-apply-highlights.js';
function selectors() {
  return globalThis.__jobExtractor.SELECTORS.autoApply;
}

const STEP_ORDER = ['navigate', 'apply', 'cover', 'rate', 'highlight', 'certificate'];
const stepIndex = (s) => Math.max(0, STEP_ORDER.indexOf(s));
const shouldRun = (step, from) => stepIndex(step) >= stepIndex(from);

export async function pollForSelector(selector, { timeoutMs = 10000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await executeCommand({ type: 'query_dom', args: { selector, limit: 1, textLen: 20 } });
    if (res?.items?.length) return res;
    await sleep(intervalMs);
  }
  return null;
}

export async function expandTruncations() {
  try {
    const tab = await getActiveTab();
    if (!tab) return { expanded: 0, total: 0 };
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector) => {
        const btns = Array.from(document.querySelectorAll(selector));
        let clicked = 0;
        for (const b of btns) {
          const label = (b.innerText || b.textContent || '').trim().toLowerCase();
          if (/^(more|show more|read more|view more|…more|\.\.\.more)$/i.test(label)) {
            try { b.click(); clicked++; } catch {}
          }
        }
        return { clicked, total: btns.length };
      },
      args: [selectors().truncationButtons]
    });
    return results[0]?.result || { clicked: 0, total: 0 };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

export async function runAutoApply(job, { from = 'navigate' } = {}) {
  const S = selectors();
  const statusEl = $('claude-reply-status');
  const btn = $('claude-reply-autoapply');
  btn.disabled = true;
  const origText = btn.textContent;
  const t0 = Date.now();
  audit('autoApply:start', { jobUrl: job?.url, jobTitle: job?.title, from });
  const logStep = (name, data = {}) => audit(`autoApply:${name}`, data);
  const runCmd = async (label, cmd) => {
    const start = Date.now();
    try {
      const result = await executeCommand(cmd);
      audit(`autoApply:${label}`, { cmd, ms: Date.now() - start, result });
      return result;
    } catch (e) {
      audit(`autoApply:${label}`, { cmd, ms: Date.now() - start, error: e.message || String(e) });
      throw e;
    }
  };

  try {
    if (shouldRun('navigate', from)) {
      btn.textContent = '1/7 navigating...';
      statusEl.textContent = 'Navigating to job page...';
      await runCmd('navigate:jobUrl', { type: 'navigate', args: { url: job.url } });
      const applyFound = await pollForSelector(S.applyButton, { timeoutMs: 10000 });
      logStep('pollForSelector:applyBtn', { found: !!applyFound, items: applyFound?.items?.length || 0 });
      if (!applyFound) throw new Error('Apply button not found (selector drift?)');
    } else {
      audit('autoApply:skip', { step: 'navigate' });
    }

    if (shouldRun('apply', from)) {
      btn.textContent = '2/7 clicking Apply...';
      statusEl.textContent = 'Clicking Apply, waiting for drawer or /apply/ page...';
      const urlBefore = await runCmd('readPage:preApply', { type: 'read_page', args: { maxChars: 1 } });
      await runCmd('click:applyBtn', { type: 'click', args: { selector: S.applyButton } });
      const surface = await waitForApplySurface(S, urlBefore, t0);
      logStep('surfaceDetect', { surface, elapsedMs: Date.now() - t0 });
      statusEl.textContent = surface
        ? `Apply surface: ${surface}. Looking for cover-letter textarea...`
        : 'No drawer / no URL change after Apply click. Will try fallback navigate...';
    } else {
      audit('autoApply:skip', { step: 'apply' });
    }

    if (shouldRun('cover', from)) await draftAndFillCover(job, from, btn, statusEl, runCmd, logStep, S);
    else audit('autoApply:skip', { step: 'cover' });

    if (shouldRun('rate', from)) await setRateIncrease(btn, statusEl, runCmd, logStep, S);
    else audit('autoApply:skip', { step: 'rate' });

    if (shouldRun('highlight', from)) {
      btn.textContent = '6/7 portfolio...';
      const res = await pickHighlights({ tab: 'portfolio', wantCount: 2, labelPrefix: 'portfolio', statusEl, runCmd, pollForSelector, logStep });
      if (!res.ok) audit('autoApply:portfolioSkipped', res);
    } else {
      audit('autoApply:skip', { step: 'highlight' });
    }

    if (shouldRun('certificate', from)) {
      btn.textContent = '7/7 certificate...';
      const res = await pickHighlights({ tab: 'certifications', wantCount: 2, labelPrefix: 'certificate', statusEl, runCmd, pollForSelector, logStep });
      if (!res.ok) audit('autoApply:certificateSkipped', res);
    } else {
      audit('autoApply:skip', { step: 'certificate' });
    }

    statusEl.textContent = 'Done — cover letter, rate, portfolio + certificate highlights set. Review and click Submit when ready.';
    showToast('Ready to submit — review first!');
    btn.textContent = 'Filled ✓';
    logStep('done', { totalMs: Date.now() - t0 });
  } catch (err) {
    statusEl.textContent = 'Auto-Apply failed: ' + err.message + ' — see debug below';
    showToast('Auto-Apply failed — debug captured');
    btn.textContent = origText;
    logStep('error', { message: err?.message || String(err), stack: err?.stack || null });
    try { await captureDebugArtifact(null, err, job); } catch (inner) { audit('autoApply:captureError', { error: inner.message || String(inner) }); }
    renderAppDebug();
    return;
  } finally {
    btn.disabled = false;
  }

  try { await captureDebugArtifact(null, null, job); } catch (inner) { audit('autoApply:captureError', { error: inner.message || String(inner) }); }
  renderAppDebug();
}

async function waitForApplySurface(S, urlBefore, t0) {
  const surfaceDeadline = Date.now() + 10000;
  while (Date.now() < surfaceDeadline) {
    const drawer = await executeCommand({ type: 'query_dom', args: { selector: S.drawer, limit: 1, textLen: 20 } });
    if (drawer?.items?.length) return 'drawer';
    const now = await executeCommand({ type: 'read_page', args: { maxChars: 1 } });
    if (now?.url && now.url !== urlBefore?.url && /\/apply\/?/.test(now.url)) return 'page';
    await sleep(500);
  }
  audit('autoApply:surfaceTimeout', { elapsedMs: Date.now() - t0 });
  return null;
}

async function draftAndFillCover(job, _from, btn, statusEl, runCmd, logStep, S) {
  btn.textContent = '3/7 drafting...';
  const coverPromise = askClaudeBridge(wrapAsCoverLetterPrompt(job));
  let textareaHit = await pollForSelector(S.coverTextarea, { timeoutMs: 10000 });
  logStep('pollForSelector:coverTextarea', { found: !!textareaHit });
  if (!textareaHit) {
    const uid = extractJobUid(job.url);
    if (!uid) throw new Error('Cover-letter textarea not found and could not extract job UID for fallback');
    const applyUrl = `https://www.upwork.com/nx/proposals/job/~${uid}/apply/`;
    statusEl.textContent = `Fallback: navigating to ${applyUrl}`;
    await runCmd('navigate:fallbackApplyUrl', { type: 'navigate', args: { url: applyUrl } });
    textareaHit = await pollForSelector(S.coverTextarea, { timeoutMs: 10000 });
    logStep('pollForSelector:coverTextareaFallback', { found: !!textareaHit });
    if (!textareaHit) throw new Error('Cover-letter textarea not found even after fallback navigate');
  }
  const snap = await runCmd('readPage:preFill', { type: 'read_page', args: { maxChars: 500 } });
  statusEl.textContent = `On: ${snap?.url?.slice(0, 80) || '?'} — filling...`;
  btn.textContent = '4/7 filling...';
  const { reply: coverLetter } = await coverPromise;
  logStep('coverLetter:received', { len: coverLetter?.length || 0 });
  if (!coverLetter?.trim()) throw new Error('Empty cover letter from Claude');
  await runCmd('fill:coverLetter', { type: 'fill', args: { selector: S.coverTextarea, text: coverLetter.trim() } });
}

async function setRateIncrease(btn, statusEl, runCmd, logStep, S) {
  btn.textContent = '5/7 rate increase...';
  statusEl.textContent = 'Opening rate-increase dropdown...';
  const toggleHit = await pollForSelector(S.rateToggle, { timeoutMs: 5000 });
  logStep('pollForSelector:rateToggle', { found: !!toggleHit });
  if (!toggleHit) {
    statusEl.textContent = 'Rate-increase dropdown not found — skipping. Cover letter is filled, review manually.';
    return;
  }
  await runCmd('click:rateToggle', { type: 'click', args: { selector: S.rateToggle } });
  await sleep(400);
  const menuHit = await pollForSelector(S.rateOptions, { timeoutMs: 5000 });
  logStep('pollForSelector:rateOptions', { found: !!menuHit, count: menuHit?.items?.length || 0 });
  if (!menuHit) {
    statusEl.textContent = 'Rate-increase menu did not open — review manually.';
    return;
  }
  const clickRes = await runCmd('click:rateNever', { type: 'click', args: { selector: S.rateOptions, textMatch: '^\\s*Never\\b' } });
  if (!clickRes?.clicked) {
    const dump = await executeCommand({ type: 'query_dom', args: { selector: S.rateOptions, limit: 10, textLen: 120 } });
    audit('autoApply:rateOptionsDump', { totalMatched: clickRes?.totalMatched || 0, textMatched: clickRes?.textMatched || 0, items: dump?.items || [] });
    statusEl.textContent = `"Never" option not found (${clickRes?.totalMatched || 0} options matched selector). See debug log for the actual texts.`;
  }
}
