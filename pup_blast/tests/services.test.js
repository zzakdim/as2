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

test('a rewarded ad with nothing to show reports it, so the game can say so', async () => {
  const listeners = {};
  const AdMob = {
    requestConsentInfo: async () => ({ status: 'NOT_REQUIRED', canRequestAds: true }),
    trackingAuthorizationStatus: async () => ({ status: 'authorized' }),
    initialize: async () => {},
    prepareInterstitial: async () => {},
    prepareRewardVideoAd: async () => {},
    addListener: (ev, fn) => { listeners[ev] = fn; return { remove() {} }; },
    showRewardVideoAd: async () => { throw new Error('no ad loaded'); }, // AdMob had no ad to fill
  };
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { AdMob } };
  try {
    const ads = Ads.createProvider(null, () => false);
    assert.strictEqual(ads.kind, 'admob');
    await ads.init();
    assert.strictEqual(await ads.rewarded(), false);
    assert.strictEqual(ads.lastFailed(), true);
    // A filled ad that's watched to the end clears it.
    AdMob.showRewardVideoAd = async () => { listeners.onRewardedVideoAdReward(); listeners.onRewardedVideoAdDismissed(); };
    assert.strictEqual(await ads.rewarded(), true);
    assert.strictEqual(ads.lastFailed(), false);
  } finally {
    delete globalThis.Capacitor;
  }
});
