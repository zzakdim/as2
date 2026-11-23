// Builds the iMessage sticker pack (native/ios/Stickers.xcstickers) from the game's own pup art:
// one 408x408 transparent sticker per pup (the "regular" grid size), plus the Messages app icons.
//   PW=$(npm root -g)/playwright node store/make-stickers.cjs
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const GAME = 'file://' + path.join(ROOT, 'www/index.html');
const OUT = path.join(ROOT, 'native/ios/Stickers.xcstickers');
const PACK = path.join(OUT, 'Sticker Pack.stickerpack');
const ICONS = path.join(OUT, 'iMessage App Icon.stickersiconset');
const INFO = { author: 'xcode', version: 1 };
const json = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');

// Every slot of a Messages extension icon set: [idiom, size in points, scale, platform].
const ICON_SLOTS = [
  ['iphone', '29x29', 2], ['iphone', '29x29', 3], ['iphone', '60x45', 2], ['iphone', '60x45', 3],
  ['ipad', '29x29', 2], ['ipad', '67x50', 2], ['ipad', '74x55', 2],
  ['universal', '27x20', 2, 'ios'], ['universal', '27x20', 3, 'ios'], ['universal', '32x24', 2, 'ios'], ['universal', '32x24', 3, 'ios'],
  ['ios-marketing', '1024x768', 1, 'ios'], ['ios-marketing', '1024x1024', 1, 'ios'],
];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(PACK, { recursive: true });
  fs.mkdirSync(ICONS, { recursive: true });
  json(path.join(OUT, 'Contents.json'), { info: INFO });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await page.goto(GAME);
  await page.waitForTimeout(600);
  const roster = await page.evaluate(() => PB.Pups.ROSTER.map((p) => ({ id: p.id, name: p.name })));

  // Stickers: the "sticker" art style (ink outline, white border), centred on a transparent square.
  const stickers = [];
  for (const pup of roster) {
    await page.evaluate((id) => {
      document.body.innerHTML = `<div id="s" style="position:fixed;left:0;top:0;width:408px;height:408px;display:grid;place-items:center;background:transparent">
        <div style="width:392px;height:392px">${PB.Pups.renderPup(PB.Pups.BY_ID[id], { style: 'sticker', plain: true })}</div></div>`;
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      document.querySelector('#s svg').setAttribute('width', '100%');
      document.querySelector('#s svg').setAttribute('height', '100%');
    }, pup.id);
    const dir = path.join(PACK, `${pup.name}.sticker`);
    fs.mkdirSync(dir, { recursive: true });
    const file = `${pup.id}.png`;
    await page.screenshot({ path: path.join(dir, file), clip: { x: 0, y: 0, width: 408, height: 408 }, omitBackground: true });
    json(path.join(dir, 'Contents.json'), { info: INFO, properties: { filename: file } });
    stickers.push({ filename: `${pup.name}.sticker` });
  }
  json(path.join(PACK, 'Contents.json'), { info: INFO, properties: { 'grid-size': 'regular' }, stickers });

  // Icons: Mochi and Cosmo on the night sky with the logo; square slots get a square crop.
  const iconImages = [];
  for (const [idiom, size, scale, platform] of ICON_SLOTS) {
    const [w, h] = size.split('x').map(Number);
    const pw = w * scale, ph = h * scale;
    const file = `icon-${size}@${scale}x.png`;
    await page.setViewportSize({ width: Math.max(pw, 100), height: Math.max(ph, 100) });
    await page.evaluate(({ pw, ph }) => {
      const P = PB.Pups, u = Math.min(pw, ph);
      document.body.innerHTML = `<div id="i" style="position:fixed;left:0;top:0;width:${pw}px;height:${ph}px;overflow:hidden;
        background:radial-gradient(circle at 50% 55%, #4a3fa8, #1f1b45 70%);display:flex;align-items:flex-end;justify-content:center;gap:${u * 0.02}px">
        <div style="width:${u * 0.62}px;height:${u * 0.62}px;margin-bottom:${u * 0.06}px">${P.renderPup(P.BY_ID.mochi, { plain: true })}</div>
        ${pw > ph ? `<div style="width:${u * 0.62}px;height:${u * 0.62}px;margin-bottom:${u * 0.06}px">${P.renderPup(P.BY_ID.cosmo, { plain: true })}</div>` : ''}</div>`;
      document.querySelectorAll('#i svg').forEach((s) => { s.setAttribute('width', '100%'); s.setAttribute('height', '100%'); });
    }, { pw, ph });
    await page.screenshot({ path: path.join(ICONS, file), clip: { x: 0, y: 0, width: pw, height: ph } });
    const entry = { filename: file, idiom, scale: `${scale}x`, size };
    if (platform) entry.platform = platform;
    iconImages.push(entry);
  }
  json(path.join(ICONS, 'Contents.json'), { images: iconImages, info: INFO });
  await browser.close();
  console.log(`${stickers.length} stickers and ${iconImages.length} icons → ${path.relative(ROOT, OUT)}`);
})();
