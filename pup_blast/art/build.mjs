// Builds art/concepts.html from the game's own renderer, so the page always matches the game.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Pups = require('../www/js/pups.js');

const STARS = { common: 1, rare: 2, epic: 3, legendary: 4 };
const tile = (p, style) => `<figure class="pup r-${p.rarity}"><div class="art">${Pups.renderPup(p, { style })}</div>
  <figcaption><b>${p.name}</b><span>${p.breed}</span><i>${'★'.repeat(STARS[p.rarity])}</i></figcaption></figure>`;
const grid = (style) => `<div class="grid">${Pups.ROSTER.map((p) => tile(p, style)).join('')}</div>`;

const PAIRS = [['peanut', 'disco'], ['biscuit', 'captain'], ['toffee', 'duchess'], ['mochi', 'merlin'], ['clover', 'dj'], ['muffin', 'sunny'], ['marshmallow', 'cosmo']];
const pairs = (style) => `<div class="pairs">${PAIRS.map(([a, b]) => `<div class="pair">${tile(Pups.BY_ID[a], style)}<span class="arrow" aria-hidden="true">→</span>${tile(Pups.BY_ID[b], style)}</div>`).join('')}</div>`;

const html = `<title>Pup Art Directions</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito+Sans:opsz,wght@6..12,400;6..12,700;6..12,800&display=swap">
<style>
/* Layout: one reading column; each style is a band with the full roster on the game's own panel color. */
:root {
  --bg: #f6f3fb; --fg: #231d3d; --muted: #645d80; --line: #ddd6ee; --accent: #d9577a;
  --stage: #2c2763; --stage-ink: #fff7ec; --stage-muted: #b9b2e6;
  --common: #9fdcb4; --rare: #62bdff; --epic: #c38cff; --legend: #ffd04a;
  --display: 'Baloo 2', 'Trebuchet MS', system-ui, sans-serif;
  --body: 'Nunito Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #151230; --fg: #f1edff; --muted: #a9a2cc; --line: #2f2a57; --accent: #ff8fab; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #151230; --fg: #f1edff; --muted: #a9a2cc; --line: #2f2a57; --accent: #ff8fab; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 16px/1.55 var(--body); margin: 0; }
main { max-width: 980px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 40px 64px; display: grid; gap: 44px; }
h1 { font-family: var(--display); font-weight: 800; font-size: clamp(36px, 7vw, 56px); line-height: 1; margin: 0; text-wrap: balance; }
h2 { font-family: var(--display); font-weight: 800; font-size: 30px; line-height: 1.05; margin: 0; text-wrap: balance; }
.lede, .sub { color: var(--muted); max-width: 64ch; margin: 10px 0 0; }
.key { font: 800 13px/1 var(--body); letter-spacing: .1em; text-transform: uppercase; color: var(--accent); display: block; margin-bottom: 6px; }
section { display: grid; gap: 14px; }
.stage { background: var(--stage); border-radius: 22px; padding: 16px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; }
.pup { margin: 0; display: grid; justify-items: center; gap: 2px; min-width: 0; color: var(--stage-ink); }
.pup .art { width: 100%; max-width: 132px; aspect-ratio: 1; }
.pup svg { width: 100%; height: 100%; display: block; }
figcaption { display: grid; justify-items: center; line-height: 1.2; text-align: center; min-width: 0; }
figcaption b { font: 700 15px var(--display); }
figcaption span { color: var(--stage-muted); font-size: 12px; }
figcaption i { font-style: normal; font-size: 11px; letter-spacing: 1px; }
.r-common i { color: var(--common); } .r-rare i { color: var(--rare); } .r-epic i { color: var(--epic); } .r-legendary i { color: var(--legend); }
.pairs { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.pair { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 4px; background: rgba(255,255,255,.04); border-radius: 16px; padding: 8px; }
.arrow { color: var(--stage-muted); font: 800 22px var(--display); }
.notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px 28px; margin: 0; }
.notes dt { font-weight: 800; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.notes dd { margin: 2px 0 0; }
.refs { font-size: 14px; color: var(--muted); margin: 0; }
.refs a { color: var(--accent); }
</style>
<main>
  <header>
    <h1>Pup Art Directions</h1>
    <p class="lede">Bean pups are now the game's art. Sticker sheet is drawn from the same breed data, so either can ship, and dev mode can switch the game between them. Commons and rares are 17 different breeds. Epics and legendaries are dressed-up versions of those breeds.</p>
  </header>

  <section>
    <div><span class="key">In the game</span><h2>Bean pups</h2>
    <p class="sub">Full-body sitting pups with a hand-wobbled colored line. Each breed gets its own ears, snout, markings and tail. Faces mix 10 eye styles (round, puppy, sparkly, happy, wink, almond, sleepy, pug, husky blue, lashes) with dog mouths: an open pant with the tongue out, a wide grin, a small smile, or a pug mouth. Rares wear a bandana in the rare color.</p></div>
    <div class="stage">${grid('bean')}</div>
  </section>

  <section>
    <div><span class="key">Alternate</span><h2>Sticker sheet</h2>
    <p class="sub">Head-only stickers with an ink outline and die-cut white border. The Shiba is redrawn: cream cheeks and brows without outlines, thicker ears and a longer snout.</p></div>
    <div class="stage">${grid('sticker')}</div>
  </section>

  <section>
    <div><span class="key">Rarer versions</span><h2>Same breed, dressed up</h2>
    <p class="sub">The breed stays recognizable, and the rarity shows in what the pup wears: sunglasses, a captain's hat, a tiara, a wizard hat, headphones, then a crown or halo with a glow for legendaries.</p></div>
    <div class="stage">${pairs('bean')}</div>
    <div class="stage">${pairs('sticker')}</div>
  </section>

  <dl class="notes">
    <div><dt>What makes them dogs</dt><dd>No cat-style ω mouths: dogs pant with their tongue out or grin wide. Big noses on a wide snout, prick ears that are broad at the base with rounded, fluffy tips, and a dog's tail: curled, plumed, otter or nub.</dd></div>
    <div><dt>Before final art</dt><dd>These are drawn by code from about 15 traits per breed. A single illustrator should redraw the final set from this sheet so the line and proportions match.</dd></div>
  </dl>
  <p class="refs">Mood references: <a href="https://fanlore.org/wiki/Neko_Atsume" target="_blank" rel="noopener">Neko Atsume</a> and <a href="https://motherboard.vice.com/en/article/wnx8gb/japanese-cat-collecting-game-neko-atsume-has-been-cloned-for-dog-people" target="_blank" rel="noopener">its dog follower Boku to Wanko</a> for the soft, collectible feel.</p>
</main>
`;
writeFileSync(new URL('./concepts.html', import.meta.url), html);
console.log('art/concepts.html', (html.length / 1024).toFixed(0) + ' KB');
