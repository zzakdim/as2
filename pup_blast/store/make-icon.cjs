// Renders the App Store icon (1024x1024, no transparency) from the game's own pup art.
//   PW=$(npm root -g)/playwright node store/make-icon.cjs
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const Pups = require('../www/js/pups.js');

const pup = Pups.renderPup(Pups.BY_ID.mochi, { style: 'bean' });
const block = (x, y, c, r) => `<div class="b" style="left:${x}px;top:${y}px;background:${c};transform:rotate(${r}deg)"></div>`;
const html = `<!doctype html><html><head><style>
  html,body{margin:0;width:1024px;height:1024px;overflow:hidden}
  .bg{position:absolute;inset:0;background:radial-gradient(90% 80% at 50% 30%,#4a3fa8 0%,#2c2763 55%,#1f1b45 100%)}
  .glow{position:absolute;left:162px;top:150px;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(255,143,171,.45),transparent 65%)}
  .b{position:absolute;width:150px;height:150px;border-radius:30px;box-shadow:inset 0 -16px 0 rgba(0,0,0,.2),inset 0 12px 0 rgba(255,255,255,.35)}
  .pup{position:absolute;left:142px;top:110px;width:740px;height:740px;filter:drop-shadow(0 22px 0 rgba(0,0,0,.25))}
  .pup svg{width:100%;height:100%}
</style></head><body><div class="bg"></div><div class="glow"></div>
${block(-30, 760, '#5fd98a', -8)}${block(118, 812, '#4fc0f5', 4)}${block(756, 800, '#ffd84d', -6)}${block(900, 740, '#ff6f6f', 9)}
${block(-40, 90, '#9a86ff', 12)}${block(884, 70, '#ff86cf', -10)}
<div class="pup">${pup}</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.setContent(html);
  const out = path.join(__dirname, 'icon-1024.png');
  await page.screenshot({ path: out, omitBackground: false });
  await browser.close();
  console.log('wrote', out);
})();
