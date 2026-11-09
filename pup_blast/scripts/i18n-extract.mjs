// Lists the English text the game can show, for translating: node scripts/i18n-extract.mjs
// Reads every string and template literal in www/js (and the text in www/index.html), turns each
// ${...} into a {0}/{1} placeholder, splits HTML into its text pieces and keeps the ones that read
// like words. Writes i18n/catalog.json (sorted). i18n/ignore.json lists pieces that aren't UI text.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_FILES = new Set(['i18n.js', 'analytics.js', 'tuning.js']); // no player-facing text
const out = new Set();

// String and template literals, with nesting inside ${ } handled.
function literals(src) {
  const found = [];
  let i = 0;
  const n = src.length;
  function readTemplate() { // at the char after the opening backtick
    let text = '';
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { text += src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        let depth = 1;
        const start = i;
        while (i < n && depth > 0) {
          const c = src[i];
          if (c === '`') { i++; found.push(...[readTemplate()].filter(Boolean)); continue; }
          if (c === "'" || c === '"') { found.push(readQuoted(c)); continue; }
          if (c === '{') depth++;
          else if (c === '}') depth--;
          i++;
        }
        text += '\u0000' + src.slice(start, i - 1) + '\u0001';
        continue;
      }
      text += src[i++];
    }
    i++; // closing backtick
    return text;
  }
  function readQuoted(q) { // at the opening quote
    i++;
    let text = '';
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') { const e = src[i + 1]; text += e === 'n' ? '\n' : e; i += 2; continue; }
      if (src[i] === '\n') break;
      text += src[i++];
    }
    i++;
    return text;
  }
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === '`') { i++; found.push(readTemplate()); continue; }
    if (c === "'" || c === '"') { found.push(readQuoted(c)); continue; }
    // Regex literals after = ( , : ! & | ? ; [ { or return: skip to the closing slash.
    if (c === '/' && /[=(,:!&|?;[{]\s*$|return\s*$/.test(src.slice(Math.max(0, i - 8), i))) {
      i++;
      let cls = false;
      while (i < n && (src[i] !== '/' || cls)) { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; }
      i++;
      continue;
    }
    i++;
  }
  return found;
}

// Text pieces of one literal: HTML tags split it, ${} become numbered placeholders.
function pieces(lit) {
  const res = [];
  // Attributes players hear (VoiceOver) or see as tooltips.
  for (const m of lit.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]+)"/g)) {
    let k = 0;
    const v = m[1].replace(/\u0000[^\u0001]*\u0001/g, () => `{${k++}}`).trim();
    if (/\p{L}{2,}/u.test(v)) res.push(v);
  }
  const noTags = lit.replace(/<[^>]*>/g, '\u0002');
  for (let seg of noTags.split(/\u0002|\n/)) {
    let k = 0;
    seg = seg.replace(/\u0000[^\u0001]*\u0001/g, () => `{${k++}}`);
    seg = seg.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/\p{L}{2,}/u.test(seg)) continue;
    // Strip leading/trailing separators the runtime trims anyway.
    res.push(seg);
  }
  return res;
}

const looksLikeCode = (s) =>
  /^[A-Z_]{3,}$/.test(s) ||
  /^[a-z]+$/.test(s) || /\|\||\.\w+$/.test(s) && !/ \w+ /.test(s) || // lone lowercase words are identifiers (real ones go in extra.json)
  /="|translate\(|url\(|^use strict$|^[a-z]{1,3}$/.test(s) ||
  /`|\$\{| \? |^'|'$|',|\('|\[0-9a-z]'|^--|^[.#\w]{8}$(?<=[.#].*)|\(prefers-|\.repeat\(|\.join\(|^\{0\}ms$|^(cell|b|gameover|buddy-stage) /.test(s) ||
  /^[.#A-Za-z]{8}$/.test(s) && /[.#]/.test(s) ||
  /^[a-z][\w-]*$/.test(s) && !/^[a-z]+$/.test(s) || // kebab/camel identifiers
  /[{;=]\s*$|(?<!\{\d+)\}\s*$|=>|\(\)|\bvar\(|\bpx\b|#[0-9a-f]{3}|https?:|\.(js|css|png|html|txt)\b|^\.|^#|^\[|ca-app-pub|\bdata-|\bclass=|^[\w-]+:[\w-]+/i.test(s);

const dir = 'www/js';
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && !SKIP_FILES.has(f)).map((f) => join(dir, f));
for (const f of files) for (const lit of literals(readFileSync(f, 'utf8'))) for (const p of pieces(lit)) if (!looksLikeCode(p)) out.add(p);
// The page itself: text between tags and the attributes players can hear or see.
const html = readFileSync('www/index.html', 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, '');
for (const m of html.matchAll(/>([^<>]+)</g)) for (const p of pieces(m[1])) out.add(p);
for (const m of html.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]+)"/g)) out.add(m[1]);

for (const k of existsSync('i18n/extra.json') ? JSON.parse(readFileSync('i18n/extra.json', 'utf8')) : []) out.add(k);
const ignore = new Set(existsSync('i18n/ignore.json') ? JSON.parse(readFileSync('i18n/ignore.json', 'utf8')) : []);
const keys = [...out].filter((k) => !ignore.has(k)).sort((a, b) => a.localeCompare(b));
mkdirSync('i18n', { recursive: true });
writeFileSync('i18n/catalog.json', JSON.stringify(keys, null, 1) + '\n');
console.log(`${keys.length} strings → i18n/catalog.json (${ignore.size} ignored)`);
