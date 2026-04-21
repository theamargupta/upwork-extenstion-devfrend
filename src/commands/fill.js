export async function fill(tab, args = {}) {
  const { selector, text } = args;
  if (!selector || text == null) throw new Error('fill: need selector + text');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel, value) => {
      const el = document.querySelector(sel);
      if (!el) return { filled: false, reason: 'selector not found' };
      const tag = el.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'input') {
        const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.textContent = value;
      }
      return { filled: true, tag };
    },
    args: [selector, text]
  });
  return results[0]?.result || null;
}
