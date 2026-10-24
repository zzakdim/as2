// Renders App Store screenshots (6.9" iPhone, 1320x2868) from the real game, with a caption on top.
//   PW=$(npm root -g)/playwright node store/make-screenshots.cjs
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');

const GAME = 'file://' + path.resolve(__dirname, '../www/index.html');
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

// A save that looks like a player a week in: some pups, stars on the map, bones to spend.
function seed(s) {
  s.tutorial = { step: 5, done: true };
  s.settings.dev = true; s.settings.devSkipAds = true; // tools for staging; the DEV tab is hidden below
  s.bones = 2450;
  const owned = { mochi: [3, 'common', 260], biscuit: [2], pudding: [2], noodle: [1], peanut: [2], waffles: [1], bean: [1], muffin: [2], sprout: [2], clover: [1], domino: [1], scoop: [1], captain: [2], disco: [1], sunny: [1] };
  s.pups = {};
  for (const [id, [lv, , bond]] of Object.entries(owned)) s.pups[id] = { level: lv, dupes: 1, bond: bond || 0 };
  s.buddy = 'mochi';
  const stars = [3, 3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 2, 3, 1, 2, 3, 2, 2, 1, 2, 2, 1, 2, 1];
  s.levels = {};
  stars.forEach((st, k) => { s.levels[`w1-${String(k + 1).padStart(2, '0')}`] = { stars: st, best: 1000 + k * 120 }; });
  s.gifts = { 'w1-20': true };
  return s;
}

const SHOTS = [
  { file: '1-play', title: 'Drop blocks. Clear lines.', sub: 'A cozy block puzzle with a pup by your side' },
  { file: '2-dig', title: 'Dig up puppies!', sub: '24 pups to collect, each with a power' },
  { file: '3-kennel', title: 'Build your pack', sub: 'Level up pups and grow your bond' },
  { file: '4-map', title: '200 levels, 5 worlds', sub: 'From the Living Room to the Backyard' },
  { file: '5-worlds', title: 'Squirrels & a Leaf Blower', sub: 'New surprises in every world' },
];

(async () => {
  const browser = await chromium.launch();
  const game = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const hide = '.dev-btn{display:none!important} .toast{display:none!important}';
  async function boot() {
    await game.goto(GAME);
    await game.evaluate((seedSrc) => {
      const seed = new Function('return ' + seedSrc)();
      const k = 'pupblast.v1';
      localStorage.setItem(k, JSON.stringify(seed(JSON.parse(localStorage.getItem(k)))));
    }, seed.toString());
    await game.reload();
    await game.addStyleTag({ content: hide });
    await game.waitForTimeout(600);
  }
  const bb = async () => game.locator('#board').boundingBox();
  // Drags tray pieces onto the board, filling from the bottom up, `n` times.
  async function play(n) {
    for (let m = 0; m < n; m++) {
      const box = await bb();
      const pitch = (box.width - 12 + 3) / 8;
      let placed = false;
      const slots = await game.$$('#tray .slot');
      for (let s = 0; s < 3 && !placed; s++) {
        if (!(await slots[s].$('.piece'))) continue;
        const sb = await slots[s].boundingBox();
        for (let r = 7; r >= 0 && !placed; r--) for (let c = 0; c < 8 && !placed; c++) {
          await game.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
          await game.mouse.down();
          const g = await game.evaluate(() => { const el = document.querySelector('.piece.ghost'); if (!el) return null; const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; });
          if (!g) { await game.mouse.up(); break; }
          const lift = Math.max(pitch * 1.4, 56);
          await game.mouse.move(box.x + 6 + c * pitch + g.w / 2, box.y + 6 + r * pitch + g.h + 3 + lift - pitch / 2);
          placed = await game.evaluate(() => document.querySelectorAll('#board .preview').length > 0);
          await game.mouse.up();
        }
      }
      await game.waitForTimeout(450);
    }
  }
  async function openLevel(world, id) {
    await game.click('#btn-play'); await game.waitForTimeout(300);
    await game.click(`.world-card[data-world="${world}"]`); await game.waitForTimeout(900);
    await game.click(`[data-level="${id}"]`, { force: true }); await game.waitForTimeout(250);
    await game.click('[data-act="play"]'); await game.waitForTimeout(1900); // title card, then the board
  }
  const raw = {};
  const snap = async (name) => { raw[name] = path.join(OUT, `raw-${name}.png`); await game.waitForTimeout(1400); await game.screenshot({ path: raw[name] }); };

  // 1. Gameplay: a Living Room level a few moves in.
  await boot(); await openLevel('w1', 'w1-11'); await play(5);
  for (let k = 0; k < 6 && (await game.$$('#tray .piece')).length < 3; k++) await play(1); // a full tray looks better
  await snap('1-play');
  // 2. A dig: force a legendary reveal.
  await boot(); await game.click('#btn-gacha'); await game.waitForTimeout(300);
  await game.addStyleTag({ content: hide });
  await game.evaluate(() => document.querySelector('#dev-btn').click());
  await game.click('[data-dev="pull-legendary"]');
  await game.waitForTimeout(600);
  for (let i = 0; i < 8; i++) { await game.click('.dig-stage', { force: true }).catch(() => {}); await game.waitForTimeout(260); }
  await game.waitForTimeout(3200); await snap('2-dig');
  // 3. Kennel.
  await boot(); await game.click('#btn-kennel'); await game.waitForTimeout(500); await snap('3-kennel');
  // 4. The worlds.
  await boot(); await game.click('#btn-play'); await game.waitForTimeout(500); await snap('4-map');
  // 5. Autumn Backyard with the Leaf Blower and a squirrel.
  await boot(); await openLevel('w5', 'w5-20'); await play(3); await snap('5-worlds');

  // Compose: caption on top, the game below in a rounded frame.
  const shot = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });
  for (const s of SHOTS) {
    const img = 'data:image/png;base64,' + fs.readFileSync(raw[s.file]).toString('base64');
    await shot.setContent(`<!doctype html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@700&display=swap" rel="stylesheet">
      <style>
        html,body{margin:0;width:440px;height:956px;overflow:hidden;background:radial-gradient(120% 70% at 50% 0%,#4a3fa8 0%,#2c2763 45%,#1f1b45 100%)}
        h1{margin:58px 24px 6px;text-align:center;color:#fff7ec;font:700 34px/1.05 'Fredoka',sans-serif}
        p{margin:0 28px;text-align:center;color:#ffd0dc;font:700 17px/1.3 Nunito,sans-serif}
        .phone{position:absolute;left:50%;top:190px;width:356px;transform:translateX(-50%);border-radius:44px;overflow:hidden;
          box-shadow:0 0 0 7px #120f2c,0 0 0 9px #4a3fa8,0 24px 50px rgba(0,0,0,.45)}
        .phone img{display:block;width:100%}
      </style></head><body><h1>${s.title}</h1><p>${s.sub}</p><div class="phone"><img src="${img}"></div></body></html>`);
    await shot.waitForTimeout(700);
    await shot.screenshot({ path: path.join(OUT, `${s.file}.png`) });
    fs.unlinkSync(raw[s.file]);
  }
  await browser.close();
  console.log('wrote', SHOTS.length, 'screenshots to', OUT);
})();
