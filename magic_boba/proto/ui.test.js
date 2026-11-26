// End-to-end tests for the game page, driven like a player on an iPhone-sized screen.
// Run: node magic_boba/proto/ui.test.js      (needs Playwright + Chromium)
// A fake `window.webkit.messageHandlers.boba` stands in for the iOS app, so these tests also
// check every message the native side would receive.
const assert = require('assert');
const path = require('path');
const { chromium, devices } = require('playwright');

const PAGE = 'file://' + path.join(__dirname, 'play.html');

(async () => {
  const browser = await chromium.launch();
  let passed = 0;
  const step = async (name, fn) => { await fn(); passed++; console.log('  ✓', name); };

  async function open({ native = false, save = null } = {}) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(({ native, save }) => {
      if (native) {
        window.__native = [];
        window.webkit = { messageHandlers: { boba: { postMessage: (m) => window.__native.push(m) } } };
      }
    }, { native, save });
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    await page.goto(PAGE);
    if (save) { // seed once, then reload so the game boots from it (an init script would re-seed on every reload)
      await page.evaluate((sv) => localStorage.setItem('boba.save.v1', JSON.stringify(sv)), save);
      await page.reload();
    }
    await page.waitForTimeout(400);
    return page;
  }
  const settle = (p) => p.waitForFunction(() => !document.querySelector('.flying'), null, { timeout: 5000 }).catch(() => {});
  async function solveCurrent(p) {
    const sol = await p.evaluate(() => LEVELS[idx].solution);
    for (const [a, b] of sol) {
      await p.locator('#board .cup').nth(a).click();
      if (typeof b === 'number') await p.locator('#board .cup').nth(b).click();
      else await p.locator('#counter .order').nth(+b.slice(1)).click();
      await settle(p);
      await p.waitForFunction(() => !busy || document.querySelector('#win.show'), null, { timeout: 10000 }); // customers collecting jars
      await p.waitForTimeout(60);
    }
    await p.waitForSelector('#win.show', { timeout: 8000 });
    await p.waitForFunction(() => !busy, null, { timeout: 15000 });
  }

  // ---------------------------------------------------------------------------------------
  let p = await open();
  await step('opens on the title screen', async () => {
    assert.ok(await p.isVisible('#titleScreen'));
    assert.match(await p.textContent('#playSub'), /Level 1-1/);
  });
  await step('Play starts level 1-1 with a tutorial hand', async () => {
    await p.click('#playBtn');
    await p.waitForTimeout(1100);
    assert.ok(!(await p.isVisible('#titleScreen')));
    assert.match(await p.textContent('#lvlTitle'), /^1-1/);
    if (await p.evaluate(() => level.tutorial === 'basics')) assert.ok(await p.isVisible('#coach .hand'), 'coach hand visible');
  });
  await step('winning saves stars, coins and unlocks the next level', async () => {
    await solveCurrent(p);
    const sv = await p.evaluate(() => Save.get());
    assert.strictEqual(sv.stars['1-1'], 3);
    assert.ok(sv.coins >= 26, 'coins ' + sv.coins);
    assert.strictEqual(sv.current, 1);
    assert.strictEqual(sv.tutorials.basics, true);
  });
  await step('level map shows 1-2 open and 1-3 locked', async () => {
    await p.click('#winLevels');
    await p.waitForTimeout(300);
    const lv = p.locator('#worlds .lvl');
    assert.ok(!(await lv.nth(1).isDisabled()));
    assert.ok(await lv.nth(2).isDisabled());
    assert.match(await p.textContent('#starsTotal'), /★ 3 \//);
  });
  await step('shop refuses a theme you cannot afford', async () => {
    await p.click('[data-back]:visible');
    await p.click('#shopBtn');
    await p.locator('#shopGrid .item').nth(3).locator('button').click(); // Potion Lab, 300
    const sv = await p.evaluate(() => Save.get());
    assert.ok(!sv.owned.skins.includes('lab'));
    assert.ok(await p.isVisible('.toast'));
  });
  await step('buying a straw spends coins and equips it', async () => {
    const before = await p.evaluate(() => Save.get().coins);
    await p.click('[data-tab="straws"]');
    await p.locator('#shopGrid .item').nth(1).locator('button').click(); // Mint, 60? only if affordable
    const sv = await p.evaluate(() => Save.get());
    if (before >= 60) {
      assert.ok(sv.owned.straws.includes('mint'));
      assert.strictEqual(sv.straw, 'mint');
      assert.strictEqual(sv.coins, before - 60);
      assert.match(await p.evaluate(() => document.documentElement.style.getPropertyValue('--straw')), /9df2c9/);
    } else assert.ok(!sv.owned.straws.includes('mint'));
  });
  await step('progress survives a reload', async () => {
    await p.reload(); await p.waitForTimeout(400);
    const sv = await p.evaluate(() => Save.get());
    assert.strictEqual(sv.stars['1-1'], 3);
    assert.match(await p.textContent('#playSub'), /Level 1-2/);
  });
  await step('settings: reset needs two taps and clears progress', async () => {
    await p.click('#titleScreen [data-open="settings"]');
    await p.click('#resetBtn');
    assert.strictEqual(await p.evaluate(() => Save.get().stars['1-1']), 3, 'one tap does nothing');
    await p.click('#resetBtn');
    assert.deepStrictEqual(await p.evaluate(() => Save.get().stars), {});
  });
  assert.deepStrictEqual(p.errors, []);
  await p.context().close();

  // ---------------------------------------------------------------------------------------
  const owned = { v: 1, coins: 500, current: 0, stars: {}, skin: 'twilight', straw: 'classic', owned: { skins: ['twilight'], straws: ['classic'] }, settings: { haptics: true }, tutorials: { basics: true, vial: true }, wins: 0 };
  p = await open({ native: true, save: owned });
  await step('native bridge: saves, haptics and analytics reach the app', async () => {
    await p.click('#playBtn'); await p.waitForTimeout(700);
    const sol = await p.evaluate(() => LEVELS[idx].solution);
    await p.locator('#board .cup').nth(sol[0][0]).click();
    await p.locator('#board .cup').nth(sol[0][1]).click(); await settle(p);
    const msgs = await p.evaluate(() => window.__native);
    const types = new Set(msgs.map((m) => m.type));
    for (const t of ['save', 'haptic', 'track']) assert.ok(types.has(t), 'missing ' + t);
    assert.ok(msgs.some((m) => m.type === 'haptic' && m.kind === 'pour'));
    assert.ok(msgs.some((m) => m.type === 'track' && m.name === 'level_start'));
    assert.ok(JSON.parse(msgs.filter((m) => m.type === 'save').pop().json).v === 1);
  });
  await step('native rewarded ad: vial only when the ad is watched', async () => {
    const cups = await p.locator('#board .cup').count();
    await p.click('#vial');
    let ask = await p.evaluate(() => window.__native.filter((m) => m.type === 'showRewardedAd').pop());
    await p.evaluate((id) => BobaNative.adResult(id, false, 'closed'), ask.id); await p.waitForTimeout(200);
    assert.strictEqual(await p.locator('#board .cup').count(), cups, 'no vial when closed early');
    await p.click('#vial');
    ask = await p.evaluate(() => window.__native.filter((m) => m.type === 'showRewardedAd').pop());
    await p.evaluate((id) => BobaNative.adResult(id, true, 'earned'), ask.id); await p.waitForTimeout(300);
    assert.strictEqual(await p.locator('#board .cup').count(), cups + 1, 'vial added');
  });
  await step('buying a theme switches the whole look', async () => {
    await p.click('#menuBtn'); await p.click('[data-back]:visible'); await p.click('#shopBtn');
    await p.locator('#shopGrid .item').nth(3).locator('button').click(); // Potion Lab
    assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.skin), 'lab');
    assert.strictEqual(await p.evaluate(() => Save.get().coins), 200);
  });
  await step('haptics switch silences native haptics', async () => {
    await p.click('[data-back]:visible'); await p.click('#titleScreen [data-open="settings"]'); await p.click('#hapBtn');
    const n = await p.evaluate(() => window.__native.filter((m) => m.type === 'haptic').length);
    await p.evaluate(() => BobaHaptics('select'));
    assert.strictEqual(await p.evaluate(() => window.__native.filter((m) => m.type === 'haptic').length), n);
  });
  assert.deepStrictEqual(p.errors, []);
  await p.context().close();

  // ---------------------------------------------------------------------------------------
  p = await open({ save: { ...owned, tutorials: {} } });
  await step('every level loads and its stored solution wins through the UI (4 per world, incl. customer levels)', async () => {
    const picks = await p.evaluate(() => LEVELS.map((l, i) => [l.id, i]).filter(([id]) => /-(1|2|4|5)$/.test(id)).map(([, i]) => i));
    for (const i of picks) {
      await p.evaluate((i) => { closeScreens(); load(i); }, i); await p.waitForTimeout(500);
      await solveCurrent(p);
      await p.evaluate(() => $('win').classList.remove('show'));
    }
  });
  await step('regulars: favourite drinks mostly match, surprises explain themselves', async () => {
    const r = await p.evaluate(() => LEVELS.filter((l) => l.orders).map((l) => castFor(l).map((c, i) => ({ c, recipe: l.orders[i] }))).flat()
      .map(({ c, recipe }) => ({ match: recipe.includes(REGULARS.find((x) => x.emoji === c.emoji).fav), surprise: c.surprise, line: c.line })));
    assert.ok(r.every((x) => x.match !== x.surprise), 'surprise flag agrees with favourite');
    assert.ok(r.every((x) => !x.surprise || x.line), 'every surprise has a line');
    const perLevel = await p.evaluate(() => LEVELS.filter((l) => l.orders).map((l) => castFor(l).filter((c) => c.surprise).length));
    assert.ok(perLevel.every((n) => n <= 1), 'at most one surprise per level: ' + perLevel);
    assert.ok(await p.evaluate(() => LEVELS.filter((l) => l.orders).every((l) => { const c = castFor(l), k = l.slots || 2; return c.every((x, i) => !c.slice(Math.max(0, i - k + 1), i).some((y) => y.emoji === x.emoji)); })), 'never the same regular twice at the counter');
    const share = r.filter((x) => x.match).length / r.length;
    assert.ok(share > 0.6, 'mostly favourites: ' + share.toFixed(2));
    const lvl = await p.evaluate(() => LEVELS.findIndex((l) => l.orders));
    await p.evaluate((i) => { closeScreens(); load(i); }, lvl); await p.waitForTimeout(700);
    const shown = await p.$$eval('#counter .cust', (els) => els.map((e) => e.textContent));
    const want = await p.evaluate(() => state.open.map((o) => cast[o.i].emoji));
    assert.deepStrictEqual(shown, want);
  });
  await step('developer mode (Settings) unlocks every level and persists', async () => {
    await p.evaluate(() => { $('win').classList.remove('show'); Save.reset(); showScreen('titleScreen'); });
    await p.click('#titleScreen [data-open="settings"]'); await p.click('#devBtn'); await p.click('#settingsDone');
    await p.click('#levelsBtn'); await p.waitForTimeout(300);
    assert.strictEqual(await p.locator('#worlds .lvl:disabled').count(), 0);
    assert.ok(await p.evaluate(() => document.body.classList.contains('dev')));
    await p.reload(); await p.waitForTimeout(400);
    assert.ok(await p.evaluate(() => isDev()), 'still on after reload');
  });
  assert.deepStrictEqual(p.errors, []);
  await browser.close();
  console.log(`${passed} UI checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
