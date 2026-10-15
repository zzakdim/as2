// Ads: a pacing policy plus two providers.
// - AdMob through @capacitor-community/admob when running inside the iOS app.
// - A mock overlay in the browser, so the pacing can be felt during playtests.
// Start-up order inside the app (Google's recommended flow):
//   1. Consent: ask Google's UMP SDK whether this player needs the consent form (EU/UK and some
//      US states) and show it if so. The form itself is designed in the AdMob console (Privacy & messaging).
//   2. App Tracking Transparency: iOS's "allow tracking?" prompt, once.
//   3. Start the ads SDK only if consent allows ads (canRequestAds).
// Players can reopen the form later from Settings → Privacy choices when Google says it's required.
(function (root) {
  'use strict';

  // Google's public test unit IDs. Replace with real IDs in capacitor/ad-units.json before release.
  const UNITS = {
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    banner: 'ca-app-pub-3940256099942544/2934735716',
  };

  const POLICY = {
    graceGames: 3, // no interstitials during a player's first 3 games
    everyNGames: 2, // then at most one per 2 finished games
    minGapMs: 90 * 1000, // and never closer than 90s apart
  };

  function canShowInterstitial(state, now) {
    if (state.settings.noAds) return false;
    if (state.stats.games < POLICY.graceGames) return false;
    if (state.ads.gamesSinceInterstitial < POLICY.everyNGames) return false;
    return now - state.ads.lastInterstitialAt >= POLICY.minGapMs;
  }

  function noteInterstitialShown(state, now) {
    state.ads.gamesSinceInterstitial = 0;
    state.ads.lastInterstitialAt = now;
  }

  // ---- Providers (browser only) ----

  function admobPlugin() {
    const cap = root.Capacitor;
    return cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.AdMob;
  }

  const TESTING = UNITS.rewarded.startsWith('ca-app-pub-3940256099942544');

  function createAdMobProvider(AdMob) {
    let ready = false;
    let privacyRequired = false;
    // Runs the consent step. Returns whether ads may be requested.
    async function consent() {
      try {
        let info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
        privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
        return info.canRequestAds !== false;
      } catch (e) {
        return true; // UMP unreachable (offline): Google falls back to non-personalized ads
      }
    }
    return {
      kind: 'admob',
      async init() {
        const canRequest = await consent();
        try {
          // App Tracking Transparency prompt (iOS 14.5+). Ads still serve if declined, just non-personalized.
          const status = await AdMob.trackingAuthorizationStatus();
          if (status.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
        } catch (e) { /* older plugin or simulator */ }
        if (!canRequest) return; // the player declined in a region that needs consent: no ads this session
        await AdMob.initialize({ initializeForTesting: TESTING });
        ready = true;
        AdMob.prepareInterstitial({ adId: UNITS.interstitial }).catch(() => {});
        AdMob.prepareRewardVideoAd({ adId: UNITS.rewarded }).catch(() => {});
      },
      async interstitial() {
        if (!ready) return false;
        try { await AdMob.showInterstitial(); return true; } catch (e) { return false; }
        finally { AdMob.prepareInterstitial({ adId: UNITS.interstitial }).catch(() => {}); }
      },
      async rewarded() {
        if (!ready) return false;
        try {
          const reward = await AdMob.showRewardVideoAd();
          return !!reward;
        } catch (e) { return false; }
        finally { AdMob.prepareRewardVideoAd({ adId: UNITS.rewarded }).catch(() => {}); }
      },
      privacyOptionsRequired: () => privacyRequired,
      async showPrivacyOptions() {
        try { await AdMob.showPrivacyOptionsForm(); } catch (e) { /* form unavailable */ }
      },
    };
  }

  // A stand-in ad: a full-screen card with a countdown. Rewarded ones pay out only if watched to the end.
  function createMockProvider(doc) {
    function show(kind, seconds) {
      return new Promise((resolve) => {
        const el = doc.createElement('div');
        el.className = 'mock-ad';
        el.innerHTML =
          `<div class="mock-ad-card"><p class="mock-ad-tag">${kind === 'rewarded' ? 'Rewarded ad' : 'Interstitial ad'} · test slot</p>` +
          `<p class="mock-ad-body">AdMob fills this space in the iOS build.</p>` +
          `<p class="mock-ad-count" aria-live="polite"></p>` +
          `<div class="mock-ad-actions"><button type="button" class="btn ghost" data-act="skip">${kind === 'rewarded' ? 'Skip (no reward)' : 'Close'}</button></div></div>`;
        doc.body.appendChild(el);
        const count = el.querySelector('.mock-ad-count');
        const skip = el.querySelector('[data-act="skip"]');
        let left = seconds;
        const finish = (granted) => { clearInterval(timer); el.remove(); resolve(granted); };
        const tick = () => {
          if (left <= 0) {
            count.textContent = kind === 'rewarded' ? 'Reward ready' : 'Done';
            skip.textContent = kind === 'rewarded' ? 'Claim reward' : 'Close';
            skip.classList.remove('ghost');
            skip.hidden = false;
            skip.onclick = () => finish(true);
            clearInterval(timer);
            return;
          }
          count.textContent = `${left}s`;
          left--;
        };
        skip.onclick = () => finish(false);
        if (kind !== 'rewarded') skip.hidden = true;
        const timer = setInterval(tick, 1000);
        tick();
      });
    }
    return {
      kind: 'mock',
      async init() {},
      interstitial: () => show('interstitial', 3),
      rewarded: () => show('rewarded', 4),
      privacyOptionsRequired: () => false,
      async showPrivacyOptions() {},
    };
  }

  function createProvider(doc) {
    const plugin = admobPlugin();
    return plugin ? createAdMobProvider(plugin) : createMockProvider(doc);
  }

  const Ads = { UNITS, POLICY, canShowInterstitial, noteInterstitialShown, createProvider };

  root.PB = root.PB || {};
  root.PB.Ads = Ads;
  if (typeof module !== 'undefined' && module.exports) module.exports = Ads;
})(typeof globalThis !== 'undefined' ? globalThis : this);
