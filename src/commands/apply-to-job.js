import '../shared/selectors.js';
import { applyPageScript } from './apply-page-script.js';

function applySelectors() {
  return globalThis.__jobExtractor.SELECTORS.apply;
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}

export async function applyToJob(tab, args = {}) {
  const {
    jobId,
    coverLetter,
    rateIncrease = 'Never',
    portfolioCount = 2,
    certCount = 2,
    skipBoost = true
  } = args;
  if (!jobId || typeof jobId !== 'string') throw new Error('apply_to_job: missing jobId');
  if (!coverLetter || typeof coverLetter !== 'string') throw new Error('apply_to_job: missing coverLetter');

  const cleanId = jobId.startsWith('~') ? jobId : `~${jobId}`;
  const applyUrl = `https://www.upwork.com/nx/proposals/job/${cleanId}/apply/`;
  await chrome.tabs.update(tab.id, { url: applyUrl });
  await waitForTabComplete(tab.id);

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: applyPageScript,
    args: [{ coverLetter, rateIncrease, portfolioCount, certCount, skipBoost, selectors: applySelectors() }]
  });
  return results[0]?.result || { ok: false, reason: 'no_result', details: 'executeScript returned empty' };
}
