export async function click(tab, args = {}) {
  const { selector, textMatch = null, index = 0 } = args;
  if (!selector) throw new Error('click: missing selector');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel, tmatch, idx) => {
      const all = Array.from(document.querySelectorAll(sel));
      let pool = all;
      if (tmatch) {
        const re = new RegExp(tmatch, 'i');
        pool = all.filter(el => re.test((el.innerText || el.textContent || '').trim()));
      }
      const el = pool[idx];
      if (!el) {
        return {
          clicked: false,
          reason: 'selector not found',
          totalMatched: all.length,
          textMatched: pool.length
        };
      }
      el.click();
      return {
        clicked: true,
        tag: el.tagName,
        text: (el.innerText || el.textContent || '').trim().slice(0, 80)
      };
    },
    args: [selector, textMatch, index]
  });
  return results[0]?.result || null;
}
