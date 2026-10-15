# Pup Blast

An 8×8 block puzzle (the Block Blast loop) with a puppy gacha on top. You clear lines to earn bones, spend bones at the Pup-a-Matic, and collect pups. Your chosen pup comes along as a buddy and gives a bone bonus plus one power per run.

The game is plain HTML/CSS/JS in `www/`, wrapped for iOS with Capacitor. It has no build step and no framework. All the logic is in pure modules covered by `npm test`.

## Concepts we considered

| Concept | Core loop | Why it did or didn't win |
|---|---|---|
| **Pup Blast** (built) | Block Blast placement, clears pay bones, bones buy pup capsules | The core loop is proven, and sessions are 2 to 5 minutes, which gives natural ad breaks. Gacha gives a reason to come back after the score chase gets stale. |
| Kibble Merge | Suika-style drop-and-merge where merges climb breed tiers | Strong toy feel, but it needs a physics engine and tuning. Gacha overlaps with the merge ladder. |
| Doggy Daycare | Idle tycoon: pups generate coins and you pull for rarer earners | Highest ad volume, but the "game" is mostly menus. Weak hook in the first minute. |

## Loops

**Minute to minute.** Drag three pieces onto the board. Full rows and columns clear. Clearing on consecutive turns builds a combo, which survives two non-clearing moves. About 18% of pieces carry a bone treat that pays 5 bones when cleared. The dealer guarantees that at least one piece in every tray fits, and 35% of trays include a piece that can complete a line, so good moments come often.

**Per run.** Bones = score ÷ 20 + treats × 5, times the buddy bonus. When you get stuck you first get a nudge to use your buddy's power. After that comes the game-over sheet with two rewarded ads (keep playing, double bones).

**Per day.** Login bonus of 50 bones plus 10 per streak day (up to 6), and 3 free ad pulls.

**Long term.** 24 pups across 4 rarities. Duplicates refund bones and level pups up (level N needs N copies, max 10). Each level adds +2% bones, and level 5 gives a second power charge.

### Pups and powers

| Rarity | Count | Odds | Bone bonus | Powers |
|---|---|---|---|---|
| Common | 10 | 62% | +5% | Fetch (new pieces), Dig (clear a 3×3) |
| Rare | 7 | 27% | +12% | Fetch, Dig, Zoomies (clear the fullest row and column) |
| Epic | 5 | 9% | +25% | Fetch, Dig, Zoomies. These are costume pups (Disco Pug, Captain Biscuit…) |
| Legendary | 2 | 2% | +50% | Guardian: saves the run once, automatically |

Pity: Epic or better every 10 pulls, Legendary every 60. A pull costs 100 bones and a 10-pull costs 900. Odds are shown on the gacha screen and in settings, which App Store guideline 3.1.1 requires for loot boxes.

New pups are one line of data in `www/js/pups.js`. Portraits are generated SVG built from traits (ears, pattern, accessory), so there are no art files yet.

## Ads

All ad code is in `www/js/ads.js`. Inside the iOS app it uses AdMob through `@capacitor-community/admob`. In a browser it shows a stand-in ad with a countdown, so playtests feel the real pacing.

| Placement | Type | Trigger |
|---|---|---|
| Keep playing | Rewarded | Game-over sheet, once per run |
| Double bones | Rewarded | Game-over sheet |
| Free pull | Rewarded | Pup-a-Matic, 3 per day |
| Between runs | Interstitial | After a run ends: never in the first 3 games, at most every 2nd game, at least 90 s apart |

The design leans on rewarded ads. Players opt in to them, they pay the best eCPM, and the gacha gives every one of them a reason to exist. Interstitials are capped so they don't drive players away. Banners are left out because they earn little and take space from the board. If you want one, put it on the Kennel screen only.

"Remove ads" ($2.99) turns off interstitials only, so rewarded ads keep working. The button is a stub until StoreKit is wired up (see Next steps).

## Run it

```bash
npm test                 # logic tests (board, dealer, gacha odds and pity, saves, ad pacing)
npm run serve            # http://localhost:8080, then use your browser's device toolbar for a phone view
npm run build:preview    # dist/pup-blast.html, a single-file build for sharing a playtest
```

## Ship it on iOS (needs a Mac with Xcode)

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

Then in Xcode:

1. In `ios/App/App/Info.plist`, add:
   - `GADApplicationIdentifier`: your AdMob app ID. While testing, use `ca-app-pub-3940256099942544~1458002511`.
   - `NSUserTrackingUsageDescription`: for example "We use this to show you more relevant ads and keep Pup Blast free."
   - `SKAdNetworkItems`: Google's list from the AdMob iOS docs.
2. Replace the test unit IDs in `www/js/ads.js` (`UNITS`) with your real ones.
3. Bundle the two fonts (Baloo 2 and Nunito, both under the OFL license) in `www/fonts` and swap the Google Fonts link, so the app works offline.
4. Before launch, move saves from `localStorage` to `@capacitor/preferences`. iOS can clear WebView storage.
5. Set the age rating to 12+ and do **not** choose "Made for Kids". The Kids category forbids most ad networks. A cute art style is fine, but the audience should be general.

## Next steps

- StoreKit purchases: Remove Ads, a starter pack (bones plus a guaranteed Rare), and bone bundles.
- Ad consent (UMP/GDPR) through the AdMob plugin's `requestConsentInfo` before `initialize`.
- Analytics: `window.PB_TRACK(event, params)` gets `run_start`, `run_end`, `gacha_pull`, `power_used`, and the ad request and grant events. Point it at Firebase or GameAnalytics.
- Tune the economy against real data. A weak run of about 250 points earns about 23 bones, which is roughly 4 runs per pull. A typical run of 1,000 to 2,000 points gets a pull every run or two.
- Collection goals: set bonuses (all corgis gives +5%) and a weekly limited-time banner pup.
