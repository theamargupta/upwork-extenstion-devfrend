export async function queryDom(tab, args = {}) {
  const {
    selector,
    attrs = ['href', 'id', 'class', 'aria-label', 'data-test'],
    limit = 20,
    textLen = 120,
    textMatch = null,
    index = null
  } = args;
  if (!selector) throw new Error('query_dom: missing selector');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel, attrList, lim, tlen, tmatch, idx) => {
      const re = tmatch ? new RegExp(tmatch, 'i') : null;
      const all = Array.from(document.querySelectorAll(sel));
      const filtered = re ? all.filter(el => re.test((el.innerText || el.textContent || '').trim())) : all;
      const chosen = idx != null ? [filtered[idx]].filter(Boolean) : filtered.slice(0, lim);
      const out = [];
      for (const el of chosen) {
        const r = el.getBoundingClientRect();
        const row = {
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, tlen),
          visible: r.width > 0 && r.height > 0,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        };
        for (const a of attrList) {
          const v = el.getAttribute(a);
          if (v != null) row[a] = v;
        }
        out.push(row);
      }
      return { total: all.length, filtered: filtered.length, returned: out.length, items: out };
    },
    args: [selector, attrs, limit, textLen, textMatch, index]
  });
  return results[0]?.result || null;
}
