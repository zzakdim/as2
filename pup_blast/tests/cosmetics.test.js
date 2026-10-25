const test = require('node:test');
const assert = require('node:assert');
const Pups = require('../www/js/pups.js');
const State = require('../www/js/state.js');

test('signature items come from the Epic and Legendary pups', () => {
  const ids = Pups.COSMETICS.map((c) => c.id).sort();
  assert.deepStrictEqual(ids, ['captain', 'crown', 'halo', 'headphones', 'shades', 'tiara', 'wizard']);
  for (const c of Pups.COSMETICS) assert.ok(['epic', 'legendary'].includes(Pups.BY_ID[c.from].rarity));
});

test('names are cleaned: no markup, trimmed, capped', () => {
  assert.strictEqual(Pups.cleanName('  Nugget  '), 'Nugget');
  assert.strictEqual(Pups.cleanName('<img src=x onerror=alert(1)>'), 'img src=x on');
  assert.strictEqual(Pups.cleanName('Sir   Wigglesworth III'), 'Sir Wigglesw');
  assert.strictEqual(Pups.cleanName('a&b"c\'d`e'), 'abc’de');
  assert.strictEqual(Pups.cleanName(''), '');
});

test('saves keep names and items, and drop bad ones', () => {
  const raw = State.freshState();
  raw.pups.mochi = { level: 2, dupes: 0, bond: 400, name: ' Nugget<b> ', wear: 'crown' };
  raw.pups.biscuit = { level: 1, dupes: 0, name: 42, wear: 'jetpack' };
  raw.pups.pudding = { level: 1, dupes: 0, wear: 'none' };
  const s = State.normalize(JSON.parse(JSON.stringify(raw)));
  assert.strictEqual(s.pups.mochi.name, 'Nuggetb');
  assert.strictEqual(s.pups.mochi.wear, 'crown');
  assert.strictEqual(s.pups.biscuit.name, undefined);
  assert.strictEqual(s.pups.biscuit.wear, undefined);
  assert.strictEqual(s.pups.pudding.wear, 'none');
});

test('renderPup draws the item a pup is wearing, and opts.wear previews one', () => {
  const mochi = Pups.BY_ID.mochi;
  assert.ok(!Pups.renderPup(mochi).includes('#ffe680'));
  assert.ok(Pups.renderPup(mochi, { wear: 'halo' }).includes('#ffe680')); // the halo's gold
  const cosmo = Pups.BY_ID.cosmo;
  assert.ok(Pups.renderPup(cosmo).includes('#ffe680'));
  assert.ok(!Pups.renderPup(cosmo, { wear: 'none' }).includes('<ellipse cx="60" cy="8" rx="20"'));
});

test('daily and weekly rewards only roll forward (no clock or time-zone flipping)', () => {
  const s = State.freshState();
  const sun = new Date(2026, 9, 25, 23, 30).getTime(); // Sunday 23:30 local
  const mon = new Date(2026, 9, 26, 0, 20).getTime(); // Monday 00:20 local
  State.rollDaily(s, sun); State.rollWeekly(s, sun);
  const bones0 = s.bones;
  let weekly = 0, daily = 0;
  for (let i = 0; i < 10; i++) {
    for (const t of [mon, sun]) { daily += State.rollDaily(s, t) > 0 ? 1 : 0; weekly += State.rollWeekly(s, t) ? 1 : 0; }
  }
  assert.strictEqual(daily, 1, 'one new day');
  assert.strictEqual(weekly, 1, 'one new week');
  assert.ok(s.bones - bones0 < 100);
});
