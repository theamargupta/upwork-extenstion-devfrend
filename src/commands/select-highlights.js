import '../shared/selectors.js';
import { selectHighlightsScript } from './select-highlights-script.js';

function applySelectors() {
  return globalThis.__jobExtractor.SELECTORS.apply;
}

export async function selectHighlights(tab, args = {}) {
  const {
    portfolioCount = 2,
    certCount = 2,
    portfolioTitles = [],
    certTitles = [],
    commit = true
  } = args;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: selectHighlightsScript,
    args: [{
      portfolioCount,
      certCount,
      portfolioTitles,
      certTitles,
      commit,
      selectors: applySelectors()
    }]
  });

  return results[0]?.result || { ok: false, reason: 'no_result', details: 'executeScript returned empty' };
}
