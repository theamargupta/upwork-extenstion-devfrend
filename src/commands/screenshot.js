export async function screenshot(tab) {
  const shot = await chrome.runtime.sendMessage({ action: 'captureFullPage', tabId: tab.id });
  if (!shot?.success) throw new Error(shot?.error || 'screenshot failed');
  return { dataUrl: shot.dataUrl, url: tab.url, title: tab.title };
}
