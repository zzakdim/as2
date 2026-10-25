const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const main = fs.readFileSync(path.join(__dirname, '../www/js/main.js'), 'utf8');

test('dev mode can never be hard-wired on for release builds', () => {
  assert.ok(!/const ALLOW_DEV = true/.test(main), 'ALLOW_DEV must come from the build, not a constant');
  // Capacitor.DEBUG reads true in Release builds too (prebuilt xcframework), so it must not decide this.
  assert.ok(!/ALLOW_DEV = [^\n]*Capacitor\.DEBUG/.test(main), 'ALLOW_DEV must not trust Capacitor.DEBUG');
  assert.ok(/const ALLOW_DEV = !native \|\| window\.PB_DEBUG_BUILD === true/.test(main));
  // The flag is only ever set inside the app target's Debug-only block.
  const avc = fs.readFileSync(path.join(__dirname, '../native/ios/AppViewController.swift'), 'utf8');
  assert.match(avc, /#if DEBUG\s+webView\?\.configuration\.userContentController\.addUserScript\(\s+WKUserScript\(source: "window\.PB_DEBUG_BUILD = true;"[^)]*\)\)\s+#endif/);
  assert.strictEqual(avc.split('PB_DEBUG_BUILD').length - 1, 1, 'PB_DEBUG_BUILD is set in exactly one place');
});

test('the real ad units are configured', () => {
  const ads = fs.readFileSync(path.join(__dirname, '../www/js/ads.js'), 'utf8');
  assert.ok(ads.includes("rewarded: 'ca-app-pub-6694593592282571/"));
  assert.ok(ads.includes("interstitial: 'ca-app-pub-6694593592282571/"));
});

test('the iOS project ships the privacy manifest, Game Center entitlement and real icon', () => {
  const ios = path.join(__dirname, '../ios/App/App');
  assert.ok(fs.existsSync(path.join(ios, 'PrivacyInfo.xcprivacy')));
  assert.ok(fs.readFileSync(path.join(ios, 'App.entitlements'), 'utf8').includes('com.apple.developer.game-center'));
  const pbx = fs.readFileSync(path.join(__dirname, '../ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  assert.ok(pbx.includes('PrivacyInfo.xcprivacy in Resources'));
  assert.strictEqual((pbx.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) || []).length, 2);
  const icon = fs.readFileSync(path.join(ios, 'Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
  const store = fs.readFileSync(path.join(__dirname, '../store/icon-1024.png'));
  assert.ok(icon.equals(store), 'the app icon is the Pup Blast icon');
});
