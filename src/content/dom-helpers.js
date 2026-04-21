(() => {
  'use strict';

  const JE = globalThis.__jobExtractor = globalThis.__jobExtractor || {};
  const BLOCK_TAGS = new Set([
    'ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','BR','DD','DIV','DL','DT','FIELDSET',
    'FIGCAPTION','FIGURE','FOOTER','FORM','H1','H2','H3','H4','H5','H6','HEADER',
    'HR','LI','MAIN','NAV','OL','P','PRE','SECTION','TABLE','TR','UL'
  ]);
  const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','IFRAME','SVG']);

  function deepTextWalk(root) {
    const parts = [];
    const win = root.ownerDocument?.defaultView || window;
    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.nodeValue;
        if (t && t.trim()) parts.push(t.replace(/\s+/g, ' '));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (SKIP_TAGS.has(tag)) return;
      let cs;
      try { cs = win.getComputedStyle(node); } catch { cs = null; }
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return;
      if (node.shadowRoot) for (const c of node.shadowRoot.childNodes) walk(c);
      for (const c of node.childNodes) walk(c);
      if (BLOCK_TAGS.has(tag)) parts.push('\n');
    }
    walk(root);
    return parts.join('');
  }

  function qs(selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function qsAll(selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length) return Array.from(els);
    }
    return [];
  }

  function textOf(selectors) {
    const el = qs(selectors);
    return el ? el.textContent.trim() : '';
  }

  function allTextOf(selectors) {
    return qsAll(selectors).map(el => el.textContent.trim()).filter(Boolean);
  }

  Object.assign(JE, { deepTextWalk, qs, qsAll, textOf, allTextOf });
})();
