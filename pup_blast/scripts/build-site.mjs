// Builds the small public website (site/) from store/privacy-policy.md and store/support.md.
// The site holds what Apple and AdMob need a URL for: the privacy policy, the support page and app-ads.txt.
// Fill in the placeholders in store/*.md (or SITE below), run `node scripts/build-site.mjs`, then upload site/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site');
// The site lives at zzakdim.github.io/pupblast/ (the root belongs to another app); app-ads.txt goes at the root.

const SITE = {
  // AdMob publisher ID (the number in every ad unit ID). Used for app-ads.txt.
  publisher: 'pub-6694593592282571',
  date: new Date().toISOString().slice(0, 10),
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Inline markdown: links, bold, italics, bare URLs.
const inline = (s) => esc(s)
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*])_([^_]+)_/g, '$1<i>$2</i>')
  .replace(/(^|[\s(])(https:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');

function md(src) {
  const html = [];
  let list = false;
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (t.startsWith('- ')) {
      if (!list) { html.push('<ul>'); list = true; }
      html.push(`<li>${inline(t.slice(2))}</li>`);
      continue;
    }
    if (list) { html.push('</ul>'); list = false; }
    if (!t) continue;
    const h = t.match(/^(#{1,3}) (.*)$/);
    html.push(h ? `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>` : `<p>${inline(t)}</p>`);
  }
  if (list) html.push('</ul>');
  return html.join('\n');
}

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; --bg: #fffaf3; --ink: #2b2247; --muted: #5d5880; --accent: #d9577a; }
  @media (prefers-color-scheme: dark) { :root { --bg: #16133a; --ink: #fff7ec; --muted: #b9b2e6; --accent: #ff8fab; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.6 ui-rounded, -apple-system, system-ui, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 32px max(20px, env(safe-area-inset-left)) 64px; }
  h1 { font-size: 34px; line-height: 1.15; margin: 0 0 12px; }
  h2 { font-size: 22px; margin: 32px 0 6px; }
  p, li { color: var(--ink); }
  i { color: var(--muted); }
  a { color: var(--accent); }
  nav { display: flex; gap: 18px; margin-bottom: 28px; font-weight: 700; }
</style>
</head>
<body><main>
<nav><a href="./">Pup Blast</a><a href="privacy.html">Privacy</a><a href="support.html">Support</a></nav>
${body}
</main></body>
</html>
`;

const fill = (s) => s
  .replace('[date you publish this page]', SITE.date)
  .replace('[Privacy policy]([URL of your privacy policy page])', '[Privacy policy](privacy.html)');

mkdirSync(out, { recursive: true });
const privacy = fill(readFileSync(join(root, 'store', 'privacy-policy.md'), 'utf8'));
const support = fill(readFileSync(join(root, 'store', 'support.md'), 'utf8'));
writeFileSync(join(out, 'privacy.html'), page('Pup Blast Privacy Policy', md(privacy)));
writeFileSync(join(out, 'support.html'), page('Pup Blast Support', md(support)));
writeFileSync(join(out, 'index.html'), page('Pup Blast', md(`# Pup Blast

A cozy block puzzle where every pup you dig up joins your team. Free on iPhone.

- [Privacy policy](privacy.html)
- [Support](support.html)`)));
// Google's line for AdMob, so ad buyers can verify the ads in Pup Blast are really yours.
writeFileSync(join(out, 'app-ads.txt'), `google.com, ${SITE.publisher}, DIRECT, f08c47fec0942fa0\n`);
// GitHub Pages: serve files as-is (no Jekyll processing).
writeFileSync(join(out, '.nojekyll'), '');

const left = [privacy, support].join('').match(/\[(Your LLC legal name|support email)\]/g);
console.log(`site/ written${left ? `. Still to fill in store/*.md: ${[...new Set(left)].join(', ')}` : ''}`);
