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

**Per run.** Bones = score ÷ 25 + treats × 5 (tuned for a free player who never watches ads). Your buddy pup brings its power with one charge per level. When you get stuck you first get a nudge to use a charge. After that comes the game-over sheet with two rewarded ads (keep playing, double bones).

**Per week.** One free weekly pull, Rare or better, that resets Monday 00:00 local time. This is the headline pull.

**Per day.** Login bonus of 50 bones plus 10 per streak day (up to 6), and 1 bonus pull for watching an ad.

**Long term.** Companions are the whole meta. 24 pups, and each one has its **own** power. Duplicates level a pup up, and **each level is one more charge per run**. Max level is 5 (5 charges). Copies per level scale by rarity: 5 for a common, 4 for a rare, 3 for an epic and 2 for a legendary. That makes 21, 17, 13 and 9 copies to max, so every rarity maxes out in roughly 1 to 4 months. Every duplicate fills a visible progress bar, and duplicates past max still refund bones.

The pull sources live in one config block (`ECONOMY` in `www/js/gacha.js`). For a strict one-pull-a-week game, set `BONE_PULLS: false` and `DAILY_AD_PULLS: 0`.

### Pups and powers

Targeted powers work in two taps: the first shows which blocks will clear, and the second confirms.

| Pup | Breed | Rarity | Power |
|---|---|---|---|
| Mochi (starter) | Shiba Inu | Common | **Fetch**: swap your three pieces for new ones |
| Biscuit | Corgi | Common | **Good Sit**: swap your worst piece for a 2×2 square |
| Pudding | Beagle | Common | **Scratch**: clear a 2×2 patch you tap |
| Noodle | Dachshund | Common | **Stick!**: swap your worst piece for a 4-long stick |
| Peanut | Pug | Common | **Nap Time**: swap in three small pieces |
| Waffles | Black Labrador | Common | **Spin**: rotate all your pieces a quarter turn |
| Pickles | Chihuahua | Common | **Nibble**: clear one block you tap |
| Toffee | Pomeranian | Common | **Pampered**: turn your pieces into single blocks |
| Bean | French Bulldog | Common | **Shake Off**: clear 4 random blocks |
| Muffin | Golden Retriever | Common | **Treat Toss**: hide 4 bone treats in your blocks |
| Sprout | Dalmatian | Rare | **Spotted**: clear 8 random blocks |
| Clover | Husky | Rare | **Howl**: clear the fullest row |
| Marshmallow | Samoyed | Rare | **Dig**: clear a 3×3 patch you tap |
| Domino | Border Collie | Rare | **Pounce**: clear a column you tap |
| Cocoa | Poodle | Rare | **Zigzag**: clear both diagonals |
| Ziggy | Bernese | Rare | **Tail Wag**: clear a row you tap |
| Scoop | Shih Tzu | Rare | **Sniff Out**: tap a block to clear every block of its color |
| Disco | Pug | Epic | **Zoomies**: clear the fullest row and column |
| Captain Biscuit | Corgi | Epic | **Cannonball**: clear a 5×5 area you tap |
| Duchess | Pomeranian | Epic | **Do-Over**: undo your last move |
| Merlin | Shiba Inu | Epic | **Crystal Ball**: get three pieces that each complete a line |
| DJ Woofles | Husky | Epic | **Bass Drop**: clear the middle 4×4 |
| Sunny | Golden Retriever | Legendary | **Guardian** (automatic): saves your run when you get stuck |
| Cosmo | Samoyed (halo) | Legendary | **Big Bang**: clear the entire board |

**Power tiers.** Each power has a tier, and a test enforces that it matches the pup's rarity. Tier 1 (common) covers piece tools and tiny clears of 1 to 4 blocks. Tier 2 (rare) clears one line or area of about 8 to 9 blocks. Tier 3 (epic) is big or clever: 15 to 25 blocks, undo, or made-to-fit pieces. Tier 4 (legendary) changes the game.

**Reserved for future pups (DLC, events).** These are built and tested but not on anyone yet: Avalanche (gravity, then clear lines, which is very strong), Herd (push left, then clear lines), Hopscotch (checkerboard, 32 blocks), Trim (outer edge, 28) and Drop the Beat (two fullest rows and columns, about 28).

Odds: Common 62%, Rare 27%, Epic 9%, Legendary 2%. Pity: Epic or better every 10 pulls, Legendary every 60. A bone pull costs 100 bones and a 10-pull costs 900. Odds are shown on the gacha screen and in settings, which App Store guideline 3.1.1 requires for loot boxes.

Powers live in `www/js/powers.js`, and each one is a small function on the board. A new pup is one line in `www/js/pups.js`. Portraits are generated SVG built from traits (ears, pattern, accessory), so there are no art files yet.

## Ads

All ad code is in `www/js/ads.js`. Inside the iOS app it uses AdMob through `@capacitor-community/admob`. In a browser it shows a stand-in ad with a countdown, so playtests feel the real pacing.

| Placement | Type | Trigger |
|---|---|---|
| Keep playing | Rewarded | Game-over sheet, once per run |
| Double bones | Rewarded | Game-over sheet |
| Bonus pull | Rewarded | Pup-a-Matic, 1 per day |
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

## Levels and the map

**Play** opens the map; **Endless** is the classic score chase with first-time milestone bonuses (1,000 to 40,000 points, 25 to 800 bones).

- `www/js/levels.js` holds the worlds. World 1, the **Living Room**, has 40 levels, each one entry: name, starting pattern (8 rows of `.` `#` `b` `C`), first-clear reward, helpers, gift pup and tease. Worlds 2–5 (Dog Park, Beach, Snowy Hill, Autumn Backyard) show as "coming soon" until their mechanics land.
- A dig every 5 levels (paid as a free dig token at the Dig Spot), bones otherwise. A 3-star sweep of a world pays a crown on the map and an **Epic dig** token.
- **Gift pups:** levels 20 and 40 start with a crate holding Sprout and Captain Biscuit. Two line clears through the crate free the pup the moment it breaks, even if the run is then lost, and it never repeats. Powers can't break crates.
- **Helpers (no fouls):** golden bones double a clear's points (from level 15), and tennis balls also clear their row (from level 17).
- **Stars are bot-tuned.** `node tools/bot.mjs tune 120` replays every level with a greedy bot, once with a starter Mochi and once with a maxed epic, and writes `www/js/tuning.js`. 1★ comes from the starter bot. 3★ comes from the starter bot on levels 1–20 and from the maxed-epic bot on 21–40, so late 3★ needs a leveled pup. Bot results today:

| Levels | Starter: pass / 3★ | Maxed epic: pass / 3★ |
|---|---|---|
| 1–10 | ~85% / ~55% | 100% / ~99% |
| 11–20 | ~70% / ~20% | 100% / ~88% |
| 21–30 | ~55% / ~1% | ~99% / ~28% |
| 31–40 | ~45% / ~1% | ~99% / ~13% (finale 8%) |

People plan ahead better than the greedy bot, so expect real pass rates to be higher. Re-run the tuner whenever a level changes. `node tools/bot.mjs 60` prints the full per-level report.

## Tutorial

New players start inside a scripted first run (in `www/js/main.js`, the tutorial section). Mochi coaches with a speech bubble, a paw demonstrates each gesture, and a spotlight dims everything except the one thing to tap.

1. Drag a piece into the gap. Only the right spot accepts it.
2. Fill a corner to clear a row and a column at once, collecting a bone treat on the way.
3. Get stuck, then tap Fetch.
4. Play Level 1 for real.
5. Go home, open the Dig Spot, and use the free weekly dig. The first dig is guaranteed Rare or better.
6. A closing line about the Kennel and buddies.

Each step is saved, so closing the app resumes at the right step. A Skip link is always available. Saves from before the tutorial existed skip it automatically, and dev mode has a **Replay tutorial** button.

## Developer mode

Settings → Developer mode shows an orange **DEV** tab on the left edge of every screen. While `ALLOW_DEV` is true, a brand-new save starts with it on, so a wiped save never hides the tools. It has tools for bones, free pulls, unlocking or maxing every pup, resetting pity, pulling a chosen rarity, skipping ads, unlimited power charges, and in-run helpers (refill charges, new pieces, clear the board, get stuck on purpose, +score). While it's on, the Kennel detail sheet also gets Level −/+ buttons. Set `ALLOW_DEV = false` in `www/js/main.js` for App Store builds.

## Art direction

The pups use the **bean** style: full-body sitting pups with a wobbly colored line. A **sticker** alternate is drawn from the same breed data, and dev mode can switch the game to it. Both styles come from `renderPup` in `www/js/pups.js`, which builds each pup from breed traits (ear type, snout, markings, tail, body). Commons and rares are 17 different breeds. Epics and legendaries are dressed-up versions of those breeds, and rares wear a bandana.

`art/concepts.html` (built by `node art/build.mjs`) shows the whole roster in both styles, generated from the game's own renderer.

## Pull sequence

The default is the **Dig Spot** (`dig` in `www/js/pullfx.js`). Tap a backyard mound to dig: a paw swipes, dirt sprays and the hole deepens. A glow rises through the dirt and steps through the rarity colors with rising notes and vibration. Commons take 3 digs and legendaries take 6. On the last dig, the pup's dark silhouette peeks out ears first and wiggles, epics and legendaries shoot light beams, and then it bursts into the shared reveal (pup pops out, stars ding, NEW stamp or level meter). A 10-dig is a yard of 10 mounds: tap them one at a time or use Dig them all. After 7 seconds of no taps, it digs by itself.

The older gumball machine (crank, capsule drop, color build-up, crack) is still there. Dev mode → "Gumball machine instead of dig" switches to it, and the screen name and button words follow (Dig Spot / Pup-a-Matic, Dig / Pull).