export async function selectHighlightsScript(params = {}) {
  const {
    portfolioCount = 2,
    certCount = 2,
    portfolioTitles = [],
    certTitles = [],
    commit = true,
    selectors
  } = params;
  const SEL = selectors;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(check, { timeout = 5000, interval = 100 } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = check();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function visibleQueryAll(selector, root = document) {
    return Array.from(root.querySelectorAll(selector)).filter(visible);
  }

  function text(el) {
    return (el?.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function snapshot() {
    return { url: location.href, title: document.title };
  }

  function normalizeTitle(value) {
    return String(value || '')
      .replace(/^\d+\s*-\s*/, '')
      .replace(/\.\.\.$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function kindFor(itemText) {
    if (/portfolio/i.test(itemText)) return 'portfolio';
    if (/cert/i.test(itemText)) return 'cert';
    return 'unknown';
  }

  function readRightItems(modal) {
    return Array.from(modal.querySelectorAll('li.highlights-item'))
      .filter(visible)
      .map((item) => {
        const itemText = text(item);
        const title = text(item.querySelector(SEL.selectedItemTitle)) || itemText;
        return {
          item,
          kind: kindFor(itemText),
          title
        };
      });
  }

  function findRemoveTarget(item) {
    const itemRect = item.getBoundingClientRect();
    const raw = Array.from(item.querySelectorAll('button, a, [role="button"], svg, [class*="icon"]'));
    const candidates = [];
    const seen = new Set();
    for (const el of raw) {
      const target = el.closest('button, a, [role="button"]') || el;
      if (seen.has(target) || !visible(target)) continue;
      seen.add(target);
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const inItem = centerY >= itemRect.top && centerY <= itemRect.bottom;
      const onRightEdge = centerX > itemRect.left + itemRect.width * 0.72;
      if (inItem && onRightEdge) candidates.push(target);
    }
    return candidates[candidates.length - 1] || null;
  }

  async function removeItem(modal, item) {
    const before = readRightItems(modal).length;
    const target = findRemoveTarget(item.item);
    if (!target) return { ok: false, reason: 'remove_target_missing', title: item.title };
    target.click();
    const after = await waitFor(() => {
      const items = readRightItems(modal);
      return items.length < before ? items : null;
    }, { timeout: 2000 });
    if (!after) return { ok: false, reason: 'remove_did_not_change_count', title: item.title };
    return { ok: true, title: item.title };
  }

  async function enforceMax(modal, kind, wanted) {
    const removed = [];
    const errors = [];
    while (true) {
      const items = readRightItems(modal).filter((item) => item.kind === kind);
      if (items.length <= wanted) break;
      const result = await removeItem(modal, items[items.length - 1]);
      if (!result.ok) {
        errors.push(result);
        break;
      }
      removed.push(result.title);
      await sleep(250);
    }
    return { removed, errors };
  }

  async function activateTab(modal, dataEvLabel, textRegex) {
    const tab = modal.querySelector(`button.air3-tab-btn[data-ev-label="${dataEvLabel}"]`)
      || visibleQueryAll('button[role="tab"], button.air3-tab-btn', modal)
        .find((button) => textRegex.test(text(button)));
    if (!tab) return false;
    tab.click();
    return !!(await waitFor(() => {
      if (!/is-active/.test(tab.className || '')) return null;
      return readLeftCards(modal).some((card) => /select highlight|selected/i.test(text(card.button)));
    }, { timeout: 3000 }));
  }

  function readLeftCards(modal) {
    return Array.from(modal.querySelectorAll(SEL.highlightHeaders || 'h5'))
      .filter(visible)
      .map((header) => {
        const card = header.closest(SEL.highlightCardContainer) || header.parentElement;
        const button = card ? visibleQueryAll(SEL.highlightAddButton || 'button.item-add', card)[0] : null;
        return {
          title: text(header),
          card,
          button
        };
      })
      .filter((card) => card.title && card.card && card.button);
  }

  function chooseCard(cards, preferredTitlesForKind) {
    const selectable = cards.filter((card) => /^select highlight$/i.test(text(card.button)));
    if (selectable.length === 0) return null;
    for (const preferred of preferredTitlesForKind) {
      const needle = normalizeTitle(preferred);
      const match = selectable.find((card) => normalizeTitle(card.title).includes(needle));
      if (match) return match;
    }
    return selectable[0];
  }

  async function addMissing(modal, kind, wanted, preferredTitlesForKind) {
    const picked = [];
    const errors = [];
    while (readRightItems(modal).filter((item) => item.kind === kind).length < wanted) {
      const before = readRightItems(modal).length;
      const card = chooseCard(readLeftCards(modal), preferredTitlesForKind);
      if (!card) {
        errors.push({ ok: false, reason: 'no_selectable_card', kind });
        break;
      }
      card.button.click();
      const after = await waitFor(() => {
        const items = readRightItems(modal);
        return items.length > before ? items : null;
      }, { timeout: 2500 });
      if (!after) {
        errors.push({ ok: false, reason: 'right_panel_count_not_incremented', kind, title: card.title });
        break;
      }
      picked.push(card.title);
      await sleep(250);
    }
    return { picked, errors };
  }

  const modalAlreadyOpen = document.querySelector(SEL.dialog);
  if (!modalAlreadyOpen && !location.pathname.includes('/proposals/job/')) {
    return { ok: false, reason: 'wrong_page', details: 'Expected an Upwork proposal apply page or open highlights modal', ...snapshot() };
  }

  let modal = modalAlreadyOpen;
  if (!modal || !/Highlights \(\d\/4\)/i.test(text(modal))) {
    const trigger = document.querySelector(SEL.highlightsTrigger)
      || visibleQueryAll('[data-test="portfolio"], [data-test="certifications"], button, div[role="button"], div')
        .find((el) => /^Add a portfolio project$/i.test(text(el)) || /^Add a certificate$/i.test(text(el)));
    if (!trigger) return { ok: false, reason: 'highlights_trigger_missing', ...snapshot() };
    trigger.click();
    modal = await waitFor(() => {
      const candidate = document.querySelector(SEL.dialog);
      return candidate && /Highlights \(\d\/4\)/i.test(text(candidate)) ? candidate : null;
    }, { timeout: 5000 });
  }
  if (!modal) return { ok: false, reason: 'modal_failed_to_open', ...snapshot() };

  const removedPortfolio = await enforceMax(modal, 'portfolio', portfolioCount);
  const removedCerts = await enforceMax(modal, 'cert', certCount);

  const portfolioReady = await activateTab(modal, 'portfolio', /^portfolio$/i);
  const addedPortfolio = portfolioReady
    ? await addMissing(modal, 'portfolio', portfolioCount, portfolioTitles)
    : { picked: [], errors: [{ ok: false, reason: 'portfolio_tab_not_ready' }] };

  const certReady = await activateTab(modal, 'certifications', /^certificates$/i);
  const addedCerts = certReady
    ? await addMissing(modal, 'cert', certCount, certTitles)
    : { picked: [], errors: [{ ok: false, reason: 'certs_tab_not_ready' }] };

  const selected = readRightItems(modal).map((item) => ({ kind: item.kind, title: item.title.slice(0, 100) }));
  const portfolioSelected = selected.filter((item) => item.kind === 'portfolio').length;
  const certSelected = selected.filter((item) => item.kind === 'cert').length;

  if (commit) {
    const commitBtn = visibleQueryAll(SEL.modalButtons || 'button', modal)
      .find((button) => /^Add to highlights$/i.test(text(button)) || /^Add \d\/4$/i.test(text(button)));
    if (!commitBtn) {
      return { ok: false, reason: 'commit_button_missing', selected, ...snapshot() };
    }
    commitBtn.click();
    await waitFor(() => {
      const stillOpen = document.querySelector(SEL.dialog);
      return !stillOpen || !/Highlights \(\d\/4\)/i.test(text(stillOpen));
    }, { timeout: 3000 });
  }

  const ok = portfolioSelected === portfolioCount && certSelected === certCount;
  return {
    ok,
    reason: ok ? undefined : 'selected_count_mismatch',
    requested: { portfolioCount, certCount },
    selectedCounts: { portfolio: portfolioSelected, certs: certSelected },
    selected,
    removed: {
      portfolio: removedPortfolio.removed,
      certs: removedCerts.removed
    },
    added: {
      portfolio: addedPortfolio.picked,
      certs: addedCerts.picked
    },
    errors: [
      ...removedPortfolio.errors,
      ...removedCerts.errors,
      ...addedPortfolio.errors,
      ...addedCerts.errors
    ].filter(Boolean),
    committed: !!commit,
    ...snapshot()
  };
}
