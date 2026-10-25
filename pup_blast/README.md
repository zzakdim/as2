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

**Consent.** At launch the app asks Google's consent service (UMP) whether this player needs the consent form, shows it if so, then the iOS tracking prompt, and only then starts ads. The form is required in the EU, UK and some US states. You design it in the AdMob console under Privacy & messaging. Settings shows a **Privacy choices** button when Google says the player must be able to change their answer.

**Remove Ads** ($2.99, non-consumable, `com.bonepile.pupblast.removeads`) turns off interstitials only, so rewarded ads keep working. `www/js/store.js` buys and restores it through StoreKit 2 (`@capgo/native-purchases`). There's no server: Apple's receipt is checked at each launch. Settings has **Restore purchases**, which Apple requires. In a browser a stand-in sheet grants it.

## Leaderboards

`www/js/gamecenter.js` uses Game Center through our own small plugin, `native/ios/GameCenterPlugin.swift`. The trophy button on the home screen opens Apple's leaderboard screen.

| Board | ID | Sent |
|---|---|---|
| Endless, all time | `com.bonepile.pupblast.endless` | after every Endless run, and the saved best at launch |
| Endless, this week | `com.bonepile.pupblast.endless.weekly` (recurring, resets Mondays) | after every Endless run |
| Total stars | `com.bonepile.pupblast.stars` | after every level run, and at launch |

In a browser it keeps your own best per board in the save and lists them.

## Run it

```bash
npm test                 # logic tests (board, dealer, gacha odds and pity, saves, ad pacing)
npm run serve            # http://localhost:8080, then use your browser's device toolbar for a phone view
npm run build:preview    # dist/pup-blast.html, a single-file build for sharing a playtest
```

## Ship it on iOS (needs a Mac with Xcode)

**Accounts first:** an Apple Developer account and an AdMob account.

1. **App Store Connect:**
   - Create the app with your bundle ID, and set the same ID as `appId` in `capacitor.config.json`.
   - Under Game Center, add the three leaderboards from the table above. The weekly one is a "recurring" leaderboard.
   - Under In-App Purchases, add the non-consumable `…removeads`.
   - If your bundle ID isn't `com.bonepile.pupblast`, update the IDs in `www/js/gamecenter.js` and `www/js/store.js`.
2. **AdMob console:**
   - Add the app and create an interstitial unit and a rewarded unit. Put their IDs in `UNITS` in `www/js/ads.js`.
   - Under Privacy & messaging, create the GDPR message and the US states message.
   - Host `app-ads.txt` on your developer website.
3. **Build:** `./scripts/ios-bootstrap.sh --admob-app-id ca-app-pub-XXXX~YYYY` does all of this and a simulator build in one go (the flag is optional: it defaults to Pup Blast's real AdMob app ID). By hand:

```bash
npm install
npx cap add ios
npm run ios:setup -- --admob-app-id ca-app-pub-XXXX~YYYY   # the flag is optional: defaults to Pup Blast's real AdMob app ID
npx cap sync ios
npx cap open ios
```

`ios:setup` copies the Game Center plugin into the app and adds it to the Xcode project. It points `Main.storyboard` at `AppViewController` (which registers the plugin) and adds the Info.plist keys AdMob and the tracking prompt need.

4. **In Xcode,** go to Signing & Capabilities: pick your team, then add **Game Center** and **In-App Purchase**.
5. **Test on a real device:**
   - Test ads.
   - The consent form: use an EU VPN, or set `debugGeography` in `requestConsentInfo`.
   - The Game Center sign-in banner.
   - A sandbox purchase of Remove Ads, then Restore.
6. **Before release:**
   - Bundle the fonts (Fredoka, Gluten for the logo, and Nunito, all OFL) in `www/fonts` so the app works offline.
   - Write a privacy policy (AdMob, the tracking prompt, Game Center and purchases all need one) and link it in App Store Connect and in Settings.
   - In App Store Connect, give each leaderboard a score range, so obviously faked scores are rejected.
   - Add crash reporting (for example Sentry or Firebase Crashlytics) so errors on players' phones reach you.
   - Fill in the App Store privacy labels for ads, tracking, purchases and Game Center.
   - Answer the age rating questionnaire as in `store/LISTING.md` (expected 4+) and do **not** choose "Made for Kids". The Kids category forbids most ad networks. A cute art style is fine, but the audience should be general.

## Store listing

`store/` has everything App Store Connect needs: the 1024px icon, 6.9" iPhone screenshots, and `LISTING.md` with the name, description, keywords, in-app purchase, leaderboard and privacy answers, plus reviewer notes. `privacy-policy.md` and `support.md` are page texts to publish on the web. Regenerate the art with `node store/make-icon.cjs` and `node store/make-screenshots.cjs` (Playwright).

Before an App Store build: `ALLOW_DEV = false` and fill in `LINKS` in `www/js/main.js`.

## Next steps

- More purchases: a starter pack (bones plus a guaranteed Rare) and bone bundles.
- Ad mediation once there's traffic: add bidding networks (AppLovin, Unity, Meta) as AdMob mediation adapters, then the full `SKAdNetworkItems` list.
- Analytics: `window.PB_TRACK(event, params)` gets `run_start`, `run_end`, `gacha_pull`, `power_used`, and the ad request and grant events. Point it at Firebase or GameAnalytics.
- Tune the economy against real data. A weak run of about 250 points earns about 23 bones, which is roughly 4 runs per pull. A typical run of 1,000 to 2,000 points gets a pull every run or two.
- Collection goals: set bonuses (all corgis gives +5%) and a weekly limited-time banner pup.

## Bond

Each pup has a **bond** level from 1 to 10, separate from its copy level. Bond adds **+3% score per level above 1** (+27% at Bond 10) when that pup is your buddy.

- **Play:** a run gives the buddy 1 bond XP per 20 points (a 1,000-point run = 50 XP).
- **Treats:** in the Kennel, feed bones for XP at 1 bone = 1 XP: a 50-bone snack, or straight to the next bond level. This is the bone sink beside digs.
- **Curve:** 100, 300, 600, 1,000, 1,500, 2,100, 2,800, 3,600 and 4,500 total XP for Bond 2 to 10, about 90 average runs with one pup.
- **Balance:** star targets are tuned with no bond, so Worlds 1 and 2 stay fair for basic pups with patience. Bond is headroom for 3-star chasing. Later worlds can lean on it.
- Numbers live in `Pups.BOND` (`www/js/pups.js`). The bonus applies to every point scored, via `scoreBonus` in `Core.createGame`. Dev mode adds Bond −/+ buttons in the Kennel.

## Levels and the map

**Play** opens the map; **Endless** is the classic score chase with first-time milestone bonuses (1,000 to 40,000 points, 25 to 800 bones).

- `www/js/levels.js` holds the worlds. Each level is one entry: name, starting pattern (8 rows of `.` `#` `b` `C` `P` `x` `o` `O` `w` `i` `m` `S`), first-clear reward, helpers, gift pup, squirrel and Leaf Blower rules, and tease. There are 5 worlds of 40 levels. Each world opens when level 30 of the one before it is cleared.
- **World 1, the Living Room** (40 levels): score goals, starting blocks, crates and helpers.
- **World 2, the Dog Park** (40 levels) opens when **Living Room level 30** is cleared, so a player stuck late in the Living Room can move on. It adds **fence posts** (`P`) and **shaped boards** (`x` marks squares off the board: round pen, plus, bone, heart, donut, clover, hourglass). Both count as filled, so lines complete around them, but they never clear and nothing can go on them. Every row and column keeps 0 or at least 4 open squares, and a board only deals pieces that fit its shape. Gift pups: **Domino** at level 20 and **Disco** at level 40. The board turns grass green.
- **World 3, the Beach** (opens at Dog Park 30):
  - **Buried bones** (`o`, or `O` under a block): a line clear over one digs it up for +50 points and 10 bones.
  - **Puddles** (`w`): count as filled and can't be built on. A line cleared through one dries it up, and powers can't.
  - Shaped boards return from level 11. Gifts: Cocoa (20) and Duchess (40). The finale is the Big Dig-Up.
- **World 4, Snowy Hill** (opens at Beach 30):
  - **Ice** (`i`) shrugs off one clear and **mud** (`m`) two, from lines or powers.
  - 7×7 boards from level 11, 6×6 from 26, and buried bones from 21. Gifts: Clover (20) and Merlin (40). The finale is the Frozen Fortress, with mud walls around the crate.
- **World 5, Autumn Backyard** (opens at Snowy Hill 30):
  - **Squirrels** (`S`) hop every 3 moves, after showing where they'll go. A line through one chases it off for +100.
  - From 11 they leave **acorn** blocks behind, and from 31 a chased squirrel comes back after 6 moves. Ice is mixed in from 21.
  - The **Leaf Blower** appears at 20 (every 4 moves) and as the finale boss at 40 (every 3). It marks a row, then pushes it one cell sideways, and the end block falls off. Gifts: Ziggy (20) and DJ Woofles (40).
- Worlds 3–5 were drafted by `node tools/genlevels.mjs`: seeded, mostly symmetric boards on a difficulty ramp. A board is kept only if it passes the level rules and the starter bot neither dies at once nor plays forever. The boards are plain data now; edit them by hand.
- A dig every 5 levels (paid as a free dig token at the Dig Spot), bones otherwise. A 3-star sweep of a world pays a crown on the map and an **Epic dig** token.
- **Gift pups:** Living Room levels 20 and 40 start with a crate holding Sprout and Captain Biscuit. Two line clears through the crate free the pup the moment it breaks, even if the run is then lost, and it never repeats. Powers can't break crates.
- **Helpers (no fouls):** golden bones double a clear's points (from level 15), and tennis balls also clear their row (from level 17).
- **Stars are bot-tuned.** `node tools/bot.mjs tune 120` replays every level with a greedy bot, once with a starter Mochi and once with a maxed epic, and writes `www/js/tuning.js`. 1★ comes from the starter bot. In the Living Room, 3★ comes from the starter bot on levels 1–20 and from the maxed-epic bot on 21–40, so late 3★ needs a leveled pup. The Dog Park is set a notch harder: 3★ uses the maxed-epic bot from level 11. Living Room bot results today:

| Levels | Starter: pass / 3★ | Maxed epic: pass / 3★ |
|---|---|---|
| 1–10 | ~85% / ~55% | 100% / ~99% |
| 11–20 | ~70% / ~20% | 100% / ~88% |
| 21–30 | ~55% / ~1% | ~99% / ~28% |
| 31–40 | ~45% / ~1% | ~99% / ~13% (finale 8%) |

Dog Park bot results:

| Levels | Starter: pass / 3★ | Maxed epic: pass / 3★ |
|---|---|---|
| 1–10 | ~68% / ~24% | ~99% / ~88% |
| 11–20 | ~60% / ~3% | ~99% / ~35% |
| 21–30 | ~50% / ~2% | ~98% / ~19% |
| 31–40 | ~39% / ~0% | ~94% / ~9% (finale 5%) |

Worlds 3–5 ramp from "patience" to "need dogs". The Beach's 1★ is still set against a starter. From Snowy Hill on, 1★ assumes a leveled rare at Bond 5. Every 3★ from the Beach on assumes a maxed epic at Bond 10.

| World | Levels | Starter pass | Leveled rare pass | Maxed + bonded: pass / 3★ |
|---|---|---|---|---|
| Beach | 1–10 → 31–40 | 64% → 38% | | 100% / 30% → 98% / 8% (finale 4%) |
| Snowy Hill | 1–10 → 31–40 | 26% → 12% | 63% → 38% | 97% / 24% → 93% / 7% (finale 3%) |
| Autumn Backyard | 1–10 → 31–40 | 19% → 10% | 59% → 34% | 95% / 19% → 85% / 4% (finale 2%) |

`node tools/bot.mjs 60 w2` prints a world's report, and `node tools/bot.mjs tune 120 w4` retunes one world. People plan ahead better than the greedy bot, so expect real pass rates to be higher. Re-run the tuner whenever a level changes. `node tools/bot.mjs 60` prints the full per-level report.

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