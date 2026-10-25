// Renders the App Store "Header and Search Results" image (one 16:9 PNG, 5244x2950, no alpha) from the
// game's own art, fonts and pups. App Store Connect crops it to 21:9 for the header and 3:2 for search
// results, so everything that matters sits in the centre 4425x2247 that both crops keep.
//   PW=$(npm root -g)/playwright node store/make-header.cjs
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');

const GAME = 'file://' + path.resolve(__dirname, '../www/index.html');
const OUT = path.join(__dirname, 'header');
fs.mkdirSync(OUT, { recursive: true });
const W = 1311, H = 737.5; // laid out at a quarter size, drawn at 2x and scaled 2x: 5244 x 2950

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W * 2, height: H * 2 }, deviceScaleFactor: 2 });
  await page.goto(GAME);
  await page.waitForTimeout(800);
  await page.evaluate(({ W, H }) => {
    const P = window.PB.Pups;
    const pup = (id, size, x, y, tilt, wear) => `<div class="hp" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;--t:${tilt}deg">${P.renderPup(P.BY_ID[id], { plain: true, wear })}</div>`;
    // Little block pieces drifting at the edges; colours are the board's.
    const piece = (cells, col, x, y, s, r) => `<div class="hb" style="left:${x}px;top:${y}px;--s:${s}px;transform:rotate(${r}deg)">${cells.map(([cx, cy]) => `<i class="cell b c${col}" style="left:${cx * s}px;top:${cy * s}px"></i>`).join('')}</div>`;
    const el = document.createElement('div');
    el.id = 'hdr';
    el.innerHTML = `
      <style>
        #hdr { position: fixed; inset: 0; width: ${W}px; height: ${H}px; z-index: 99999; overflow: hidden; transform: scale(2); transform-origin: 0 0;
          background: var(--scene-yard) center bottom / cover no-repeat, var(--night); font-family: var(--body); }
        #hdr::after { content: ""; position: absolute; inset: 0; background: radial-gradient(70% 80% at 50% 45%, transparent 55%, #0b0920aa); pointer-events: none; }
        #hdr .glow { position: absolute; left: 50%; top: 46%; width: 760px; height: 420px; translate: -50% -50%; border-radius: 50%;
          background: radial-gradient(closest-side, #ff8fab33, #ffd04a14 60%, transparent); }
        #hdr .hp { position: absolute; rotate: var(--t); filter: drop-shadow(0 10px 0 #00000040); }
        #hdr .hp svg { width: 100%; height: 100%; display: block; }
        #hdr .hb { position: absolute; opacity: .9; }
        #hdr .hb i { position: absolute; width: calc(var(--s) - 4px); height: calc(var(--s) - 4px); border-radius: 7px; }
        #hdr .title { position: absolute; left: 50%; top: 44%; translate: -50% -50%; text-align: center; }
        #hdr .logo-pup { font-size: 118px; text-shadow: 0 8px 0 #b4794a; }
        #hdr .logo-blast { font-size: 142px; text-shadow: 0 10px 0 var(--accent-deep), 0 0 50px rgba(255, 143, 171, .45); }
        #hdr .tag { position: absolute; left: 50%; top: 77%; translate: -50% -50%; white-space: nowrap;
          font: 800 30px var(--display); color: #fff7ec; letter-spacing: .5px; text-shadow: 0 3px 0 #00000055; }
      </style>
      <div class="glow"></div>
      ${piece([[0, 0], [1, 0], [0, 1], [1, 1]], 1, 170, 120, 34, -12)}
      ${piece([[0, 0], [1, 0], [2, 0]], 3, 1060, 112, 30, 10)}
      ${piece([[0, 0], [0, 1], [1, 1]], 4, 1075, 560, 34, -8)}
      ${piece([[0, 0], [1, 0], [1, 1]], 6, 185, 568, 30, 14)}
      ${pup('sunny', 230, 150, 250, -6)}
      ${pup('mochi', 170, 300, 380, 4)}
      ${pup('captain', 170, 841, 380, -4)}
      ${pup('cosmo', 230, 931, 250, 6)}
      <h1 class="logo title"><span class="logo-pup">Pup</span><span class="logo-blast">Blast</span></h1>
      <div class="tag">Collect puppies · Clear lines</div>`;
    document.body.appendChild(el);
  }, { W, H });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const file = path.join(OUT, 'header-16x9.png');
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W * 2, height: H * 2 }, omitBackground: false });
  await browser.close();
  console.log('wrote', file);
})();
