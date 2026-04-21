import { audit, sleep } from './utils.js';
import { executeCommand } from '../commands/index.js';
import '../shared/selectors.js';

function selectors(tab) {
  const S = globalThis.__jobExtractor.SELECTORS.autoApply;
  return {
    card: tab === 'portfolio' ? S.portfolioCard : S.certificationsCard,
    tabButton: S.highlightTabButton.replace('{tab}', tab),
    panelActive: S.highlightPanelActive.replace('{tab}', tab),
    selectButton: S.highlightSelectButton.replace('{tab}', tab),
    buttons: S.highlightButtons,
    modal: S.highlightsModal
  };
}

export async function pickHighlights({
  tab,
  wantCount,
  labelPrefix,
  statusEl,
  runCmd,
  pollForSelector,
  logStep
}) {
  const S = selectors(tab);

  statusEl.textContent = `Opening ${tab} picker...`;
  await runCmd(`click:${labelPrefix}Card`, { type: 'click', args: { selector: S.card } });
  const modalOpen = await pollForSelector(S.modal, { timeoutMs: 4000 });
  logStep(`pollForSelector:${labelPrefix}ModalOpen`, { found: !!modalOpen });
  if (!modalOpen) {
    statusEl.textContent = `${tab} modal did not open — skipping.`;
    return { ok: false, reason: 'modal-not-open' };
  }

  await sleep(300);
  await runCmd(`click:${labelPrefix}Tab`, { type: 'click', args: { selector: S.tabButton } });
  const panelActive = await pollForSelector(S.panelActive, { timeoutMs: 4000 });
  logStep(`pollForSelector:${labelPrefix}PanelActive`, { found: !!panelActive });
  if (!panelActive) {
    statusEl.textContent = `${tab} tab did not activate — skipping.`;
    return { ok: false, reason: 'panel-not-active' };
  }

  let unselected = 0;
  for (let safety = 0; safety < 8; safety++) {
    const res = await runCmd(`click:${labelPrefix}Unselect`, {
      type: 'click',
      args: { selector: S.selectButton, textMatch: '^\\s*Selected\\s*$', index: 0 }
    });
    if (!res?.clicked) break;
    unselected++;
    await sleep(200);
  }
  audit(`autoApply:${labelPrefix}Unselected`, { count: unselected });

  let selected = 0;
  for (let i = 0; i < wantCount; i++) {
    const res = await runCmd(`click:${labelPrefix}Select:${i + 1}`, {
      type: 'click',
      args: { selector: S.selectButton, textMatch: '^\\s*Select highlight\\s*$', index: 0 }
    });
    if (!res?.clicked) break;
    selected++;
    await sleep(300);
  }
  audit(`autoApply:${labelPrefix}Selected`, { count: selected, wanted: wantCount });
  if (selected === 0) {
    statusEl.textContent = `No "Select highlight" buttons available in ${tab} — skipping commit.`;
    return { ok: false, reason: 'none-selectable' };
  }

  await sleep(300);
  const strict = await runCmd(`click:${labelPrefix}Add`, {
    type: 'click',
    args: { selector: S.buttons, textMatch: '^\\s*Add to highlights?\\s*$', index: 0 }
  });
  let commitClicked = strict?.clicked;
  if (!commitClicked) {
    const loose = await runCmd(`click:${labelPrefix}Add:loose`, {
      type: 'click',
      args: { selector: S.buttons, textMatch: 'Add to highlights', index: 0 }
    });
    commitClicked = loose?.clicked;
  }
  if (!commitClicked) {
    statusEl.textContent = `${tab} "Add to highlights" button not found (selected ${selected}).`;
    return { ok: false, reason: 'add-btn-not-found', selected };
  }

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const stillOpen = await executeCommand({
      type: 'query_dom',
      args: { selector: S.modal, limit: 1 }
    });
    if (!stillOpen?.items?.length) break;
    await sleep(200);
  }
  return { ok: true, selected };
}
