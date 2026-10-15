// One-time iOS wiring after `npx cap add ios` (run on the Mac, from the project root):
//   node scripts/ios-setup.mjs [--admob-app-id ca-app-pub-XXXX~YYYY]
// It copies the Game Center plugin into the app, points Main.storyboard at AppViewController,
// and adds the Info.plist keys AdMob and App Tracking Transparency need. Safe to run twice.
// What it can't do (Xcode project settings) is printed at the end.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511'; // Google's sample app ID
const argIdx = process.argv.indexOf('--admob-app-id');
const admobAppId = argIdx > 0 ? process.argv[argIdx + 1] : TEST_APP_ID;
if (!/^ca-app-pub-\d+~\d+$/.test(admobAppId || '')) {
  console.error(`--admob-app-id needs an AdMob app ID like ca-app-pub-1234567890123456~1234567890 (got "${admobAppId}")`);
  process.exit(1);
}

const app = join('ios', 'App', 'App');
if (!existsSync(app)) {
  console.error('No ios/App/App folder. Run `npx cap add ios` first.');
  process.exit(1);
}

// 1. Native files, copied in and added to the App target (next to AppDelegate.swift).
const SWIFT = ['GameCenterPlugin.swift', 'AppViewController.swift'];
for (const f of SWIFT) {
  copyFileSync(join('native', 'ios', f), join(app, f));
  console.log(`copied ${f}`);
}
const pbxPath = join('ios', 'App', 'App.xcodeproj', 'project.pbxproj');
let pbx = readFileSync(pbxPath, 'utf8');
const xid = (s) => createHash('md5').update(s).digest('hex').slice(0, 24).toUpperCase();
let manual = false;
for (const f of SWIFT) {
  if (pbx.includes(`/* ${f} */`)) continue;
  const ref = xid('ref:' + f), build = xid('build:' + f);
  const steps = [
    [/(\t*\w{24} \/\* AppDelegate\.swift in Sources \*\/ = \{isa = PBXBuildFile;[^\n]*\n)/, `$1\t\t${build} /* ${f} in Sources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${f} */; };\n`],
    [/(\t*\w{24} \/\* AppDelegate\.swift \*\/ = \{isa = PBXFileReference;[^\n]*\n)/, `$1\t\t${ref} /* ${f} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${f}; sourceTree = "<group>"; };\n`],
    [/(\n(\t+)\w{24} \/\* AppDelegate\.swift \*\/,\n)/, `$1$2${ref} /* ${f} */,\n`],
    [/(\n(\t+)\w{24} \/\* AppDelegate\.swift in Sources \*\/,\n)/, `$1$2${build} /* ${f} in Sources */,\n`],
  ];
  if (!steps.every(([re]) => re.test(pbx))) { manual = true; continue; }
  for (const [re, to] of steps) pbx = pbx.replace(re, to);
  console.log(`added ${f} to the App target`);
}
writeFileSync(pbxPath, pbx);
if (manual) console.warn('! Could not add the Swift files to the Xcode project automatically. Drag them into the App folder in Xcode (target: App).');

// 2. Use our view controller so the local plugin gets registered. Capacitor 8 creates the root view
//    controller in SceneDelegate.swift; older templates use the storyboard. Patch both.
const sdPath = join(app, 'SceneDelegate.swift');
if (existsSync(sdPath)) {
  const sd = readFileSync(sdPath, 'utf8');
  if (sd.includes('AppViewController()')) console.log('SceneDelegate already set');
  else {
    const out = sd.replace(/rootViewController = CAPBridgeViewController\(\)/, 'rootViewController = AppViewController()');
    if (out === sd) console.warn('! Set `window?.rootViewController = AppViewController()` in SceneDelegate.swift by hand.');
    else { writeFileSync(sdPath, out); console.log('SceneDelegate now uses AppViewController'); }
  }
}
const sbPath = join(app, 'Base.lproj', 'Main.storyboard');
let sb = readFileSync(sbPath, 'utf8');
if (sb.includes('customClass="AppViewController"')) console.log('storyboard already set');
else if (sb.includes('customClass="CAPBridgeViewController"')) {
  sb = sb.replace(/customClass="CAPBridgeViewController" customModule="Capacitor"/, 'customClass="AppViewController" customModule="App" customModuleProvider="target"');
  writeFileSync(sbPath, sb);
  console.log('storyboard now uses AppViewController');
} else console.warn('! Could not find CAPBridgeViewController in Main.storyboard. Set the view controller class to AppViewController by hand.');

// 3. Info.plist keys.
const plistPath = join(app, 'Info.plist');
let plist = readFileSync(plistPath, 'utf8');
const keys = [
  ['GADApplicationIdentifier', `<string>${admobAppId}</string>`],
  ['NSUserTrackingUsageDescription', '<string>We use this to show you more relevant ads and keep Pup Blast free.</string>'],
  // Google's own ad network ID. Add the full list from the AdMob iOS docs when you turn on mediation.
  ['SKAdNetworkItems', '<array><dict><key>SKAdNetworkIdentifier</key><string>cstr6suwn9.skadnetwork</string></dict></array>'],
  ['ITSAppUsesNonExemptEncryption', '<false/>'],
];
const added = [];
// The AdMob app ID is replaced on every run, so running again with the release ID updates it.
const gad = /(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/;
if (gad.test(plist)) plist = plist.replace(gad, `$1${admobAppId}$2`);
for (const [key, value] of keys) {
  if (plist.includes(`<key>${key}</key>`)) continue;
  plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${value}\n</dict>\n</plist>\n`);
  added.push(key);
}
writeFileSync(plistPath, plist);
console.log(added.length ? `Info.plist: added ${added.join(', ')}` : 'Info.plist already has every key');
if (admobAppId === TEST_APP_ID) console.log('  (using Google\'s test AdMob app ID; pass --admob-app-id for release)');

console.log(`
Still to do in Xcode (npx cap open ios):
  1. Signing & Capabilities: pick your team, then + Capability → Game Center, and + In-App Purchase.
  2. Build to a real device and check: consent form (use a VPN to the EU, or the UMP debug
     geography), test ads, Game Center sign-in banner, and a sandbox Remove Ads purchase.`);
