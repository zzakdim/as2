# Magic Boba for iOS

A native Swift app that hosts the game (`magic_boba/proto`) in a full-screen web view. The
gameplay, art and sound are the same tested code as the browser version. The Swift side adds what
only a native app can do:

| Native piece | File | What it does |
|---|---|---|
| Game host | `Sources/GameViewController.swift` | Full-screen WKWebView, offline bundle, safe areas, pause/resume, crash recovery |
| Haptics | `Sources/Haptics.swift` | Taptic Engine pattern for every game sound (select, pour, complete, win…) |
| Save | `Sources/SaveStore.swift` | Coins, stars, unlocks and settings in UserDefaults, injected before the game starts |
| Rewarded ads | `Sources/Ads.swift` | Bonus-vial ads. Simulated by default; AdMob once you add the package |
| Analytics | `Sources/Analytics.swift` | Receives every game event; logs to Xcode's console until you plug in an SDK |
| Ratings | `GameViewController.swift` | App Store review prompt after the 6th win with 3 stars (once per install) |
| Audio | `Sources/MagicBobaApp.swift` | `.ambient` session: respects the silent switch and lets the player's own music keep playing |

> **Status:** written in a Linux container with no Xcode. Every Swift file passes a syntax check
> (`swiftc -parse`), and `SaveStore` was compiled and unit-tested with Swift 6 on Linux. The UIKit,
> WebKit and StoreKit parts can only be **compiled on a Mac**, which hasn't happened yet. The web game
> inside is covered by automated tests. Expect a small fix or two on the first Xcode build, most
> likely in the AdMob part, which only compiles once you add that package.

## Build and run (about 10 minutes)

You need a Mac with Xcode 15 or newer.

1. Install XcodeGen (generates the `.xcodeproj` from `project.yml`):
   ```bash
   brew install xcodegen
   ```
2. Generate the project:
   ```bash
   cd magic_boba/ios && xcodegen generate
   ```
3. Open it:
   ```bash
   open MagicBoba.xcodeproj
   ```
4. In Xcode, select the **MagicBoba** target ▸ **Signing & Capabilities**. Pick your team and change
   the bundle ID from `com.example.magicboba` to one you own.
5. Pick an iPhone simulator or your phone and press **Run**.

Each build runs `build_web.py` first, which bundles the latest game from `magic_boba/proto` into
`MagicBoba/Web/index.html`. Fonts are bundled too, so the app works fully offline.

**Debugging the game inside the app:** in a Debug build, open Safari ▸ Develop ▸ (your device) ▸
Magic Boba to get the web inspector and console.

## Turning on real ads (AdMob)

1. Create an AdMob account, add an iOS app, and create a **Rewarded** ad unit.
2. In `project.yml`, uncomment the `packages:` block and the `dependencies:` lines, then run
   `xcodegen generate` again.
3. In `project.yml`, replace `GADApplicationIdentifier` (currently Google's **test** app ID) with
   yours, and put your rewarded unit ID in `BobaRewardedAdUnitID`.
4. Before release, add Google's `SKAdNetworkItems` list to the Info.plist properties. If you want
   personalised ads, also add App Tracking Transparency (`NSUserTrackingUsageDescription`).

`Ads.swift` targets Google Mobile Ads SDK 12 (Swift names such as `RewardedAd` and `MobileAds`). On
SDK 11, use the `GAD`-prefixed names instead. Test with Google's test unit first: it always fills.

The game only grants the vial when the ad reports a reward. It tells the player when no ad is ready,
and when the ad was closed early.

## Analytics

Every event the game sends shows up in Xcode's console with a 📊 prefix. To send events to a real
service, implement `AnalyticsSink` (for example with TelemetryDeck, which is privacy-friendly and needs
no consent banner) and set `Analytics.shared.sink` in `AppDelegate`.

| Event | When | Useful for |
|---|---|---|
| `level_start` / `level_win` (moves, stars, vials, secs) | each level | difficulty curve, drop-off |
| `stuck` (moves) | no legal moves left | which levels frustrate |
| `vial_offer` / `vial_granted` / `ad_closed` / `ad_unavailable` | rewarded ads | ad revenue funnel |
| `level_restart` | restart tapped | hidden difficulty |
| `shop_buy` / `shop_insufficient` / `equip` | shop | economy balance |
| `tutorial_done` (step) | each coach mark finished | onboarding |
| `screen`, `app_open` | navigation | session flow |

## Shipping to testers (TestFlight)

1. In App Store Connect, create the app with your bundle ID.
2. In Xcode: **Product ▸ Archive**, then **Distribute App ▸ App Store Connect ▸ Upload**.
3. In App Store Connect ▸ TestFlight, add testers by email (internal testers need no review).

See `../PLAYTEST.md` for what to watch during the first play tests.

## Before the App Store

- [ ] Real bundle ID, team, and AdMob IDs (replace the test IDs)
- [ ] Privacy policy URL, and an App Privacy questionnaire that matches your ad and analytics SDKs
- [ ] Screenshots: 6.9" and 6.5" iPhone
- [ ] Remove Ads in-app purchase (StoreKit 2): not built yet, and the most common purchase in this genre
- [ ] Test on a real device: haptics, the silent switch, backgrounding mid-pour, low-power mode
