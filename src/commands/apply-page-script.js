export async function applyPageScript(params) {
  const { coverLetter, rateIncrease, portfolioCount, certCount, skipBoost, selectors } = params;
  const SEL = selectors;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(check, { timeout = 5000, interval = 100 } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const v = check();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function visibleQueryAll(sel, root = document) {
    return Array.from(root.querySelectorAll(sel)).filter(visible);
  }

  function fillTextareaReactSafe(el, value) {
    const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function readBodyText(maxLen = 8000) {
    return (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  }

  function snapshot() {
    return { url: location.href, title: document.title };
  }

  if (!location.pathname.includes('/proposals/job/') || !location.pathname.endsWith('/apply/')) {
    return { ok: false, reason: 'wrong_page', details: `URL is ${location.href}, expected /nx/proposals/job/.../apply/`, ...snapshot() };
  }

  const textarea = await waitFor(() => document.querySelector(SEL.coverLetter), { timeout: 10000 });
  if (!textarea) return { ok: false, reason: 'apply_page_not_ready', details: 'cover letter textarea did not appear within 10s', ...snapshot() };

  const bodyText = readBodyText();
  const warningKeywords = /preferred qualifications|do not meet/i;
  const warningEl = visibleQueryAll(SEL.warningBanner).find((e) => warningKeywords.test(e.innerText || ''));
  const warningInBody = warningKeywords.test(bodyText) && /Earnings|Hours billed|Job success|English|country/i.test(bodyText);
  if (warningEl || warningInBody) {
    const msg = (warningEl?.innerText || bodyText.match(/preferred qualifications[^.]*\./i)?.[0] || 'preferred qualifications mismatch').slice(0, 300);
    return { ok: false, reason: 'qualification_warning', details: msg.replace(/\s+/g, ' ').trim(), ...snapshot() };
  }

  const connectsMatch = bodyText.match(/This proposal requires (\d+) Connects/i);
  const connectsCost = connectsMatch ? Number(connectsMatch[1]) : null;
  fillTextareaReactSafe(textarea, coverLetter);
  await sleep(150);

  let rateIncreaseSet = false;
  if (rateIncrease) {
    const toggle = document.querySelector(SEL.rateDropdownToggle);
    if (toggle) {
      toggle.click();
      const safeRate = rateIncrease.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const optionText = new RegExp(`^${safeRate}$`, 'i');
      const opt = await waitFor(() => {
        const items = visibleQueryAll(SEL.rateMenuItem);
        return items.find((i) => optionText.test((i.innerText || '').trim()));
      }, { timeout: 3000 });
      if (opt) { opt.click(); rateIncreaseSet = true; await sleep(200); }
    }
  }

  const highlightsTrigger = document.querySelector(SEL.highlightsTrigger);
  if (!highlightsTrigger) return { ok: false, reason: 'highlights_trigger_missing', details: 'could not find Add a portfolio project card', connectsCost, ...snapshot() };
  highlightsTrigger.click();

  const modal = await waitFor(() => {
    const m = document.querySelector(SEL.dialog);
    if (!m) return null;
    return /Highlights \(\d\/4\)/i.test(m.innerText || '') ? m : null;
  }, { timeout: 5000 });
  if (!modal) return { ok: false, reason: 'modal_failed_to_open', details: 'highlights modal did not render a Highlights (N/4) header within 5s', connectsCost, ...snapshot() };

  const readLeftCards = () => Array.from(modal.querySelectorAll(SEL.highlightHeaders))
    .filter(visible)
    .map((h) => {
      const card = h.closest(SEL.highlightCardContainer) || h.parentElement;
      const btn = card?.querySelector(SEL.highlightAddButton);
      return { title: (h.innerText || '').replace(/\s+/g, ' ').trim(), card, btn };
    })
    .filter((c) => c.card && c.btn && visible(c.btn));
  const readRightTitles = () => Array.from(modal.querySelectorAll(SEL.selectedItemTitle))
    .filter(visible)
    .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim());

  async function pickNext() {
    const before = readRightTitles().length;
    const cards = readLeftCards();
    for (const c of cards) {
      if (!/^select highlight$/i.test((c.btn.innerText || '').trim())) continue;
      c.btn.click();
      await sleep(300);
      const after = readRightTitles();
      if (after.length <= before) return { ok: false, title: c.title, reason: 'right_panel_count_not_incremented', right: after };
      const last = after[after.length - 1] || '';
      const cleanLast = last.replace(/^\d+\s*-\s*/, '');
      const cardCore = c.title.slice(0, Math.min(20, c.title.length));
      if (!cleanLast.toLowerCase().includes(cardCore.toLowerCase().slice(0, 12))) {
        return { ok: false, title: c.title, reason: 'right_panel_title_mismatch', last, right: after };
      }
      return { ok: true, title: c.title };
    }
    return null;
  }

  const portfolioPicked = [];
  const portfolioErrors = [];
  for (let i = 0; i < portfolioCount; i++) {
    const r = await pickNext();
    if (!r) break;
    if (!r.ok) { portfolioErrors.push(r); break; }
    portfolioPicked.push(r.title.slice(0, 80));
  }

  const certsPicked = [];
  const certErrors = [];
  let certsTabReady = false;
  if (certCount > 0) {
    const certTab = modal.querySelector(SEL.certTabBtn)
      || Array.from(modal.querySelectorAll(SEL.modalButtons)).find((b) => /^certificates$/i.test((b.innerText || '').trim()));
    if (certTab) {
      certTab.click();
      certsTabReady = !!(await waitFor(() => {
        const cards = readLeftCards();
        return cards.some((c) => /^select highlight$/i.test((c.btn.innerText || '').trim())) ? cards : null;
      }, { timeout: 3000 }));
      if (certsTabReady) {
        for (let i = 0; i < certCount; i++) {
          const r = await pickNext();
          if (!r) break;
          if (!r.ok) { certErrors.push(r); break; }
          certsPicked.push(r.title.slice(0, 80));
        }
      } else {
        certErrors.push({ ok: false, reason: 'certs_tab_did_not_render_cards' });
      }
    } else {
      certErrors.push({ ok: false, reason: 'certs_tab_button_not_found' });
    }
  }

  const selectedTitles = readRightTitles().map((t) => t.slice(0, 100));
  const totalPicked = portfolioPicked.length + certsPicked.length;
  if (totalPicked === 0) {
    const cancelBtn = Array.from(modal.querySelectorAll(SEL.modalButtons)).find((b) => /^cancel$/i.test((b.innerText || '').trim()));
    cancelBtn?.click();
    await sleep(200);
    return { ok: false, reason: 'highlights_all_skipped', details: 'No portfolio or cert items were toggled', connectsCost, coverLetterChars: coverLetter.length, rateIncrease: rateIncreaseSet ? rateIncrease : null, highlights: { portfolio: portfolioPicked, certs: certsPicked, selectedTitles, portfolioErrors, certErrors, certsTabReady }, ...snapshot() };
  }

  const commitBtn = visibleQueryAll(SEL.modalButtons).find((b) => /^Add to highlights$/i.test((b.innerText || '').trim()));
  if (!commitBtn) return { ok: false, reason: 'commit_button_missing', details: 'Add to highlights button not found', connectsCost, selectedTitles, ...snapshot() };
  commitBtn.click();
  await sleep(400);

  return { ok: true, connectsCost, coverLetterChars: coverLetter.length, rateIncrease: rateIncreaseSet ? rateIncrease : null, highlights: { portfolio: portfolioPicked, certs: certsPicked, selectedTitles, portfolioErrors: portfolioErrors.length ? portfolioErrors : undefined, certErrors: certErrors.length ? certErrors : undefined, certsTabReady }, boostSkipped: skipBoost, summary: 'Apply page filled. NOT submitted — Amar must click Send for Connects.', ...snapshot() };
}
