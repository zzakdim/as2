// Translations. The game is written in English; this module swaps English text for the player's language
// as it appears on screen, so the game code (and the analytics it sends) stays in English.
// - Each language file (js/lang/*.js) calls PB.I18N.add(code, { 'English text': 'translation', ... }).
// - Keys with {0}, {1}… are patterns: "Find {0} {1} more times" matches "Find Biscuit 5 more times".
//   What a placeholder caught is translated too when it's a key itself (a power name, a level name).
// - A MutationObserver translates every text node and the aria-label/title/placeholder/alt attributes
//   as they're added or changed. Anything inside [data-no-i18n] (names the player typed) is left alone.
(function (root) {
  'use strict';

  // Native names, shown in the Settings language picker.
  const LANGS = { en: 'English', es: 'Español', pt: 'Português', de: 'Deutsch', fr: 'Français', ja: '日本語', ko: '한국어', id: 'Bahasa Indonesia' };
  const tables = {};
  let lang = 'en';
  let exact = new Map();
  let patterns = [];
  const misses = new Set(); // English text seen with no translation (for checking coverage)
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  const LETTER = /\p{L}/u;

  function add(code, table) { tables[code] = Object.assign(tables[code] || {}, table); if (code === lang) compile(); }

  // The language to use: a saved choice, else the first of the phone's languages we have, else English.
  function detect(pref, langs) {
    if (pref && pref !== 'auto' && LANGS[pref]) return pref;
    const list = langs || (root.navigator && (root.navigator.languages || [root.navigator.language])) || [];
    for (const l of list) { const c = String(l || '').toLowerCase().split(/[-_]/)[0]; if (LANGS[c]) return c; }
    return 'en';
  }

  const esc = (s) => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  function compile() {
    exact = new Map();
    patterns = [];
    const table = lang === 'en' ? {} : tables[lang] || {};
    for (const [k, v] of Object.entries(table)) {
      if (!v) continue;
      if (!/\{\d+\}/.test(k)) { exact.set(k, v); continue; }
      // A key splits into literal text and numbered holes; a quick regex rules out most text first.
      const parts = k.split(/(\{\d+\})/).filter((x) => x !== '');
      const quick = new RegExp('^' + parts.map((x) => (/^\{\d+\}$/.test(x) ? '[\\s\\S]*?' : esc(x))).join('') + '$', 'u');
      patterns.push({ parts, quick, out: v, literal: k.replace(/\{\d+\}/g, '').length });
    }
    patterns.sort((a, b) => b.literal - a.literal); // the most specific pattern is tried first
  }

  // How well a hole's text fits: 2 = it translates too, 1 = no words (a number, a price), 0 = name-like
  // (short, no sentence punctuation: a pup's name), -1 = doesn't fit (so the pattern isn't used).
  function fit(v, depth) {
    if (!LETTER.test(v)) return 1;
    const c = v.trim();
    if (exact.has(c) || (depth < 3 && viaPattern(c, depth + 1) !== null)) return 2;
    return c.length <= 16 && !/[.!?:;]\s|[.!?]$/.test(c) ? 0 : -1;
  }

  // Every way the holes can split the text; the split whose holes fit best wins.
  function bestSplit(parts, text, depth) {
    let best = null;
    const got = [];
    (function go(pi, at, score) {
      if (pi === parts.length) { if (at === text.length && (!best || score > best.score)) best = { score, got: got.slice() }; return; }
      const part = parts[pi];
      const hole = /^\{(\d+)\}$/.exec(part);
      if (!hole) { if (text.startsWith(part, at)) go(pi + 1, at + part.length, score); return; }
      const next = parts[pi + 1];
      for (let end = at; end <= text.length; end++) {
        if (next !== undefined && !/^\{\d+\}$/.test(next) && !text.startsWith(next, end)) continue;
        if (next === undefined && end !== text.length) continue;
        const v = text.slice(at, end);
        const f = fit(v, depth);
        if (f < 0) continue;
        got.push([+hole[1], v]);
        go(pi + 1, end, score + f);
        got.pop();
      }
    })(0, 0, 0);
    return best;
  }

  function viaPattern(core, depth) {
    for (const p of patterns) {
      if (!p.quick.test(core)) continue;
      const best = bestSplit(p.parts, core, depth);
      if (!best) continue;
      const got = Object.fromEntries(best.got);
      return p.out.replace(/\{(\d+)\}/g, (_, n) => (got[n] === undefined ? '' : t(got[n], depth + 1)));
    }
    return null;
  }

  // Translates one string. Leading/trailing whitespace is kept; text without letters is returned as is.
  function t(s, depth) {
    if (lang === 'en' || typeof s !== 'string' || !LETTER.test(s)) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    const core = s.trim();
    const hit = exact.get(core);
    if (hit !== undefined) return lead + hit + trail;
    let viaP = viaPattern(core, depth || 0);
    // A line that starts with a filled-in word still starts with a capital, like the English ("Weekly dig").
    if (viaP !== null && !depth && /^\P{L}*\p{Lu}/u.test(core)) viaP = viaP.replace(/^(\P{L}*)(\p{Ll})/u, (m, pre, c) => pre + c.toUpperCase());
    if (viaP !== null) return lead + viaP + trail;
    if (!depth) misses.add(core);
    return s;
  }

  // ---- the DOM side
  const done = new WeakMap(); // node → the text we last wrote, so our own writes aren't translated again
  function skip(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !el || !!el.closest('script,style,[data-no-i18n]');
  }
  function doText(node) {
    if (done.get(node) === node.data || skip(node)) return;
    const out = t(node.data);
    if (out !== node.data) node.data = out;
    done.set(node, node.data);
  }
  function doAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const key = 'attr:' + a;
      if (el[key] === v || skip(el)) continue;
      const out = t(v);
      if (out !== v) el.setAttribute(a, out);
      el[key] = out;
    }
  }
  function walk(rootNode) {
    if (rootNode.nodeType === 3) { doText(rootNode); return; }
    if (rootNode.nodeType !== 1 && rootNode.nodeType !== 11) return;
    if (rootNode.nodeType === 1) doAttrs(rootNode);
    const doc = rootNode.ownerDocument || rootNode;
    const it = doc.createTreeWalker(rootNode, 5 /* elements + text */);
    for (let n = it.nextNode(); n; n = it.nextNode()) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }

  let observer = null;
  function watch(doc) {
    if (observer || !root.MutationObserver) return;
    observer = new root.MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
    observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // Picks the language, translates what's already on the page and keeps translating what's added.
  function start(pref, doc) {
    lang = detect(pref);
    compile();
    if (!doc) return lang;
    doc.documentElement.lang = lang;
    doc.documentElement.dataset.lang = lang;
    if (lang !== 'en') { walk(doc.body); watch(doc); }
    return lang;
  }

  const I18N = { LANGS, add, detect, start, t, lang: () => lang, tables, misses };
  root.PB = root.PB || {};
  root.PB.I18N = I18N;
  if (typeof module !== 'undefined' && module.exports) module.exports = I18N;
})(typeof globalThis !== 'undefined' ? globalThis : this);
