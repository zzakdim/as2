const test = require('node:test');
const assert = require('node:assert');
const Pups = require('../www/js/pups.js');
const Gacha = require('../www/js/gacha.js');
const State = require('../www/js/state.js');
const Ads = require('../www/js/ads.js');
const { mulberry32 } = require('../www/js/core.js');

test('roster ids are unique and every rarity has pups', () => {
  const ids = new Set(Pups.ROSTER.map((p) => p.id));
  assert.strictEqual(ids.size, Pups.ROSTER.length);
  for (const r of Object.keys(Gacha.RATES)) assert.ok(Pups.ROSTER.some((p) => p.rarity === r), r);
  assert.ok(Math.abs(Object.values(Gacha.RATES).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('every pup renders an svg', () => {
  for (const p of Pups.ROSTER) {
    const svg = Pups.renderPup(p);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.ok(!svg.includes('undefined'), p.id);
  }
});

test('observed rates are close to the published odds', () => {
  const state = State.freshState();
  const rng = mulberry32(7);
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const N = 50000;
  for (let i = 0; i < N; i++) counts[Gacha.pull(state, rng).rarity]++;
  // Pity raises Epic+ above the base 11%, so check commons and rares loosely and Epic+ against pity.
  assert.ok(counts.common / N > 0.5 && counts.common / N < 0.64);
  assert.ok(counts.rare / N > 0.22 && counts.rare / N < 0.29);
  assert.ok(counts.legendary / N >= 0.02);
});

test('pity guarantees Epic+ every 10 pulls and Legendary every 60', () => {
  const state = State.freshState();
  const alwaysCommon = () => 0.999; // rolls the lowest bucket every time
  const results = [];
  for (let i = 0; i < 60; i++) results.push(Gacha.pull(state, alwaysCommon).rarity);
  for (let i = 9; i < 60; i += 10) assert.ok(['epic', 'legendary'].includes(results[i]), `pull ${i + 1}`);
  assert.strictEqual(results[59], 'legendary');
});

test('duplicates refund bones and level up', () => {
  const state = State.freshState();
  state.pups = {};
  const rng = () => 0.999; // common, first pup in pool
  const first = Gacha.pull(state, rng);
  assert.ok(first.isNew);
  const bones = state.bones;
  const second = Gacha.pull(state, rng);
  assert.ok(!second.isNew && second.leveledUp);
  assert.strictEqual(state.pups[first.pup.id].level, 2);
  assert.strictEqual(state.bones, bones + Pups.RARITY.common.refund);
});

test('daily rollover grants a login bonus once per day and tracks streaks', () => {
  const s = State.freshState();
  const day1 = new Date(2026, 9, 15, 9).getTime();
  assert.ok(State.rollDaily(s, day1) > 0);
  assert.strictEqual(State.rollDaily(s, day1 + 3600e3), 0);
  s.daily.freePullsLeft = 0;
  const bonus2 = State.rollDaily(s, day1 + 86400e3);
  assert.strictEqual(s.daily.streak, 2);
  assert.strictEqual(bonus2, State.DAILY_LOGIN_BONES + 10);
  assert.strictEqual(s.daily.freePullsLeft, State.DAILY_FREE_PULLS);
});

test('old or broken saves load safely', () => {
  const mem = { v: '{"bones": 5, "buddy": "nope"}', getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  const s = State.load(mem);
  assert.strictEqual(s.bones, 5);
  assert.strictEqual(s.buddy, Pups.STARTER_ID);
  assert.ok(s.settings.sound);
  mem.v = '{not json';
  assert.strictEqual(State.load(mem).bones, State.STARTING_BONES);
});

test('interstitial pacing respects grace games, frequency and gap', () => {
  const s = State.freshState();
  const now = 10_000_000;
  s.stats.games = 2; s.ads.gamesSinceInterstitial = 5;
  assert.ok(!Ads.canShowInterstitial(s, now), 'grace period');
  s.stats.games = 3;
  assert.ok(Ads.canShowInterstitial(s, now));
  Ads.noteInterstitialShown(s, now);
  s.ads.gamesSinceInterstitial = 2;
  assert.ok(!Ads.canShowInterstitial(s, now + 30_000), 'too soon');
  assert.ok(Ads.canShowInterstitial(s, now + 91_000));
  s.settings.noAds = true;
  assert.ok(!Ads.canShowInterstitial(s, now + 91_000));
});

test('weekly pull is granted once per week and respects its minimum rarity', () => {
  const s = State.freshState();
  const mon = new Date(2026, 9, 12, 10).getTime(); // Monday
  assert.ok(State.rollWeekly(s, mon));
  assert.strictEqual(s.weekly.pullsLeft, State.WEEKLY_FREE_PULLS);
  s.weekly.pullsLeft = 0;
  assert.ok(!State.rollWeekly(s, mon + 5 * 86400e3), 'same week (Saturday)');
  assert.ok(State.rollWeekly(s, mon + 7 * 86400e3), 'next Monday');
  assert.strictEqual(s.weekly.pullsLeft, State.WEEKLY_FREE_PULLS);
  const r = Gacha.pull(s, () => 0.999, { minRarity: 'rare' });
  assert.strictEqual(r.rarity, 'rare');
});

test('levels cap at 5 and duplicates past the cap still refund', () => {
  const s = State.freshState();
  s.pups = {};
  const rng = () => 0.999;
  for (let i = 0; i < 11; i++) { s.pity.sinceEpic = 0; Gacha.pull(s, rng); }
  const id = Object.keys(s.pups)[0];
  assert.strictEqual(s.pups[id].level, 5);
  const bones = s.bones;
  const extra = Gacha.pull(s, rng);
  assert.ok(!extra.leveledUp);
  assert.strictEqual(s.pups[id].level, 5);
  assert.strictEqual(s.bones, bones + extra.refund);
});
