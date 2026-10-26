# Pup Blast: App Store listing kit

Everything App Store Connect asks for, ready to paste. Fill in the **[brackets]** first.

| File | Goes where |
|---|---|
| `icon-1024.png` | Xcode (the app icon). Run `npx @capacitor/assets generate --ios --iconBackgroundColor '#1f1b45'` after copying it to `assets/icon-only.png`, or drag it into Xcode's AppIcon. |
| `header/header-16x9.png` | App Store Connect → Product Page Information → Header and Search Results (see below). |
| `screenshots/*.png` | App Store Connect → your app → iOS App → 6.9" iPhone display. Upload in number order. |
| `privacy-policy.md` | A public web page (Google Sites, Notion, or your own site). Paste its URL in App Store Connect and in `LINKS.privacy` in `www/js/main.js`. |
| `support.md` | Another public page; its URL goes in App Store Connect and `LINKS.support`. |

## Before you submit a build

- [ ] Archive with **Xcode 26 or later** (Apple requires the iOS 26 SDK for uploads). Product → Archive builds a Release build, which automatically turns developer mode and test ads off; nothing to flip by hand.
- [ ] Bump the build number (Xcode → App target → General → Build) for every upload.
- [ ] Check https://zzakdim.github.io/pupblast/privacy.html and support.html open (site/ goes in the zzakdim.github.io repo under pupblast/, app-ads.txt at its root).
- [ ] Then `npx cap sync ios` and archive in Xcode.

AdMob is already wired: app ID `ca-app-pub-6694593592282571~7797930009` (Info.plist), rewarded and interstitial units in `www/js/ads.js`.

---

## App information

- **Name** (30 max): `Pup Blast: Block Puzzle`
- **Subtitle** (30 max): `Collect puppies, clear lines`
- **Primary category:** Games → Puzzle
- **Secondary category:** Games → Casual
- **Content rights:** No, it doesn't contain third-party content (all art is original).
- **Copyright:** `2026 [your full legal name, as on your Apple developer account]`

## Version information

**Promotional text** (170 max, can change any time without review):

```
Dig up puppies, clear the board and conquer 200 cozy levels. New: the Autumn Backyard, where squirrels hop and the Leaf Blower blows!
```

**Description** (4,000 max):

```
Drop blocks, clear lines, and collect a pack of adorable puppies!

Pup Blast is a cozy block puzzle with a twist: every pup you dig up joins your team and brings a special power. Stuck with no room? Let your buddy fetch new pieces, dig out a corner, or clear the whole board.

DIG UP PUPPIES
• 24 hand-drawn pups to find: corgis, pugs, huskies, a shiba named Mochi and many more
• Rare, Epic and Legendary pups with bigger powers
• Every extra copy levels your pup up for more charges per game
• Build a bond with your buddy as you play for a score bonus
• Name your pups and dress them up with signature items from Epic and Legendary pups

200 LEVELS, 5 WORLDS
• Living Room, Dog Park, Beach, Snowy Hill and the Autumn Backyard
• Fence posts, shaped boards, buried bones, puddles, ice and mud
• Cheeky squirrels that hop around the board, and a Leaf Blower boss
• Free a trapped pup on the 20th and 40th level of every world
• Earn up to 3 stars per level. The later stars are a real challenge!

ENDLESS MODE
• Classic block puzzle, no timer, no pressure
• Chase your best score and climb the weekly Game Center leaderboard

MADE TO RELAX
• Easy to learn, satisfying combos, golden bones and tennis balls
• Plays offline
• Optional reward ads for bonus digs and second chances
• Remove Ads with a one-time purchase

Grab a pup, drop some blocks, and see how far your pack can go!
```

**Keywords** (100 max, commas, no spaces, don't repeat words from the name or subtitle):

```
blocks,cube,brick,tile,line,clear,dog,puppy,pet,cute,collect,gacha,brain,relax,offline,classic
```

- **Support URL:** `https://zzakdim.github.io/pupblast/support.html`
- **Marketing URL:** `https://zzakdim.github.io` (AdMob reads app-ads.txt from this site)
- **Version:** `1.0`

## Header and Search Results (optional, iOS 27+)

Product Page Information → **Header and Search Results**. Upload `header/header-16x9.png` (5244x2950, 16:9, no transparency) as the **universal** image and tick **Use header asset in search results**. App Store Connect crops it to 21:9 for the product page header and 3:2 for search results; the pups, logo and tagline sit in the centre both crops keep. Check it with **Preview**, then submit it with the version. Older iOS versions, and apps without one, show screenshots there instead. Rebuild with `PW=$(npm root -g)/playwright node store/make-header.cjs`.

## In-app purchase: Remove Ads

- **Type:** Non-Consumable
- **Reference name:** `Remove Ads`
- **Product ID:** `com.bonepile.pupblast.removeads` (must match `PRODUCTS.removeAds` in `www/js/store.js`)
- **Price:** $2.99 (Tier 3)
- **Display name:** `Remove Ads`
- **Description:** `No more ads between games. Bonus ads stay optional.`
- **Review screenshot:** a screenshot of the Settings sheet showing the Remove Ads button (take one in the Simulator).
- Tick **"Add for review"** with your first app version.

## Game Center leaderboards

Create these in App Store Connect → your app → Game Center. The IDs must match `BOARDS` in `www/js/gamecenter.js`.

| Reference name | Leaderboard ID | Type | Score format | Sort | Score range |
|---|---|---|---|---|---|
| Endless all time | `com.bonepile.pupblast.endless` | Classic | Integer | High to low | 0 – 100,000,000 |
| Endless this week | `com.bonepile.pupblast.endless.weekly` | Recurring, every 7 days, starting a Monday | Integer | High to low | 0 – 100,000,000 |
| Total stars | `com.bonepile.pupblast.stars` | Classic | Integer | High to low | 0 – 600 |

The score range only rejects obviously faked scores; Game Center silently drops anything above the max, so the Endless cap is generous (combos stack with no limit). Stars top out at exactly 600 (200 levels x 3). Display names: "Endless: All Time", "Endless: This Week", "Total Stars".

## Age rating

Answer Apple's questionnaire truthfully. For this game:
- No violence, horror, profanity, mature themes, medical content or user-generated content.
- **Gambling:** none. The pup "digs" are random rewards paid for with in-game bones or watching an ad, never with money.
- **Loot boxes:** No. Apple defines them as randomized items *for purchase*; digs can't be bought. (If bone packs are ever sold, this becomes Yes, and the odds must show before purchase.)
- **Contests:** Infrequent (Game Center leaderboards).
- **Advertising:** yes, the app shows ads. Ads are capped to "General" content in the code; also set AdMob → Blocking controls → Maximum ad content rating → G.
- **Parental controls / age assurance:** none. **User-generated content:** none (pup names stay on the device).
- Expected result: **4+**.
- **Made for Kids:** **No.** Kids-category apps can't use most ad networks.

## App Privacy ("nutrition label")

The game has no servers; save data stays on the device. The label covers **Google AdMob** (below) plus the game's own anonymous gameplay statistics through **TelemetryDeck** (Usage data → Product interaction, for Analytics, not linked, not tracking, which the AdMob row already includes). Check Google's current list before answering: search "AdMob data disclosure Apple App Store", Google's help page lists exactly what to declare. At the time of writing it is:

| Data type | Used for | Linked to user | Used for tracking |
|---|---|---|---|
| Identifiers → Device ID | Third-party advertising, Analytics | No | Yes (only after the player allows tracking) |
| Location → Coarse location (from IP) | Third-party advertising, Analytics | No | No |
| Usage data → Product interaction, Advertising data | Third-party advertising, Analytics | No | No |
| Diagnostics → Crash data, Performance data, Other diagnostic data | Analytics | No | No |
| Purchases → Purchase history | Analytics | No | No |

- **Purchases:** declare Purchase history (Analytics, not linked, not tracking): the anonymous statistics note when Remove Ads is bought. Payment details are Apple's and never reach the game.
- **Game Center:** Apple's own service; nothing to declare for it.

## Notes for the reviewer

Paste into App Review Information → Notes:

```
Pup Blast is a single-player block puzzle. No account or login is needed.

- Remove Ads (non-consumable): open the menu (top-left on the home screen) → Remove ads. "Restore purchases" is in the same menu.
- Game Center: the trophy button on the home screen opens the leaderboards. Scores are sent after Endless runs and level runs.
- Ads: Google AdMob. Rewarded ads are optional (bonus digs, "Keep playing", double bones). Interstitials appear between games, never in the first 3 games.
- The iOS tracking prompt (and, in regions that require it, Google's consent form just before it) appears right after the short tutorial ends, not at first launch. To reach it quickly: during the first game tap the back arrow, then "Skip tutorial". "Privacy choices" in the menu reopens the consent form.
- The privacy policy is linked in the menu.

Thank you!
```

- **Sign-in required:** No.
- **Contact info:** your name, phone and email (only Apple sees these).
