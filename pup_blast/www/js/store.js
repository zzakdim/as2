// In-app purchases: one non-consumable, "Remove Ads".
// Inside the iOS app it uses StoreKit 2 through @capgo/native-purchases (no server needed:
// Apple keeps the receipt, and restorePurchases/getPurchases read it back).
// In the browser a stand-in confirm sheet grants it, so the flow can be tested.
(function (root) {
  'use strict';

  // Must match the product ID created in App Store Connect (In-App Purchases → Non-Consumable).
  const PRODUCTS = { removeAds: 'com.bonepile.pupblast.removeads' };
  const FALLBACK_PRICE = '$2.99';

  function nativePlugin() {
    const cap = root.Capacitor;
    return cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.NativePurchases;
  }

  function createNativeStore(NP) {
    let price = FALLBACK_PRICE;
    // Current entitlements only: excludes refunded purchases and other Apple IDs' history on shared devices.
    const ownsRemoveAds = async () => {
      const { purchases } = await NP.getPurchases({ productType: 'inapp', onlyCurrentEntitlements: true });
      return purchases.some((t) => t.productIdentifier === PRODUCTS.removeAds && !t.revocationDate);
    };
    let onGrant = null;
    return {
      kind: 'storekit',
      async init(grant) {
        onGrant = grant;
        // Purchases that finish outside the buy sheet (Ask to Buy approvals, another device).
        try {
          NP.addListener('transactionUpdated', (t) => {
            if (t && t.productIdentifier === PRODUCTS.removeAds && !t.revocationDate && onGrant) onGrant();
          });
        } catch (e) { /* older plugin */ }
        try {
          const { product } = await NP.getProduct({ productIdentifier: PRODUCTS.removeAds, productType: 'inapp' });
          if (product && product.priceString) price = product.priceString;
        } catch (e) { /* offline or product not live yet: keep the fallback price */ }
        try { return { removeAds: await ownsRemoveAds() }; } catch (e) { return { removeAds: null }; }
      },
      price: () => price,
      // Resolves true when the player now owns Remove Ads. A cancelled sheet resolves false.
      async buyRemoveAds() {
        try {
          const t = await NP.purchaseProduct({ productIdentifier: PRODUCTS.removeAds, productType: 'inapp' });
          return !!t && t.productIdentifier === PRODUCTS.removeAds;
        } catch (e) { return false; }
      },
      async restore() {
        try { await NP.restorePurchases(); return { removeAds: await ownsRemoveAds() }; } catch (e) { return { removeAds: false, error: true }; }
      },
    };
  }

  function createMockStore(doc) {
    const confirm = (title, body, yes) => new Promise((resolve) => {
      const el = doc.createElement('div');
      el.className = 'mock-ad';
      el.innerHTML = `<div class="mock-ad-card mock-store"><p class="mock-ad-tag">App Store · test purchase</p>
        <p class="mock-store-title">${title}</p><p class="mock-ad-body">${body}</p>
        <div class="mock-ad-actions"><button type="button" class="btn" data-act="yes">${yes}</button>
        <button type="button" class="btn ghost" data-act="no">Cancel</button></div></div>`;
      doc.body.appendChild(el);
      el.onclick = (e) => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        el.remove();
        resolve(a.dataset.act === 'yes');
      };
    });
    return {
      kind: 'mock',
      async init() { return { removeAds: null }; }, // null = no answer; keep the saved flag
      price: () => FALLBACK_PRICE,
      buyRemoveAds: () => confirm('Remove Ads', `${FALLBACK_PRICE} · StoreKit handles this in the iOS build.`, `Buy for ${FALLBACK_PRICE}`),
      async restore() { return { removeAds: null }; },
    };
  }

  function createStore(doc) {
    const plugin = nativePlugin();
    return plugin ? createNativeStore(plugin) : createMockStore(doc);
  }

  const Store = { PRODUCTS, createStore };

  root.PB = root.PB || {};
  root.PB.Store = Store;
  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
