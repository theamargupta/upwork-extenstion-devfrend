export async function readPage(tab, args = {}) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (maxChars) => ({
      title: document.title || '',
      url: location.href,
      text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, maxChars)
    }),
    args: [args.maxChars || 500]
  });
  return results[0]?.result || null;
}
