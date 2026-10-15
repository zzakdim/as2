const test = require('node:test');
const assert = require('node:assert');
const Leaderboards = require('../www/js/gamecenter.js');
const Ads = require('../www/js/ads.js');

test('browser leaderboards keep the best score per board', async () => {
  const state = {};
  let shown = null;
  const lb = Leaderboards.createLeaderboards(() => state, (rows) => { shown = rows; });
  assert.strictEqual(lb.kind, 'local');
  await lb.submit('endless', 1200);
  await lb.submit('endless', 800);
  await lb.submit('stars', 7);
  assert.strictEqual(state.boards.endless, 1200);
  assert.strictEqual(state.boards.stars, 7);
  await lb.show();
  assert.deepStrictEqual(shown.map((r) => r.score), [1200, 0, 7]);
});

test('Remove Ads stops interstitials', () => {
  const state = { settings: { noAds: true }, stats: { games: 50 }, ads: { gamesSinceInterstitial: 9, lastInterstitialAt: 0 } };
  assert.strictEqual(Ads.canShowInterstitial(state, Date.now()), false);
  state.settings.noAds = false;
  assert.strictEqual(Ads.canShowInterstitial(state, Date.now()), true);
});
