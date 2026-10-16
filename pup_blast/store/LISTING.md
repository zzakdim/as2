# Pup Blast: App Store listing kit

Everything App Store Connect asks for, ready to paste. Fill in the **[brackets]** first.

| File | Goes where |
|---|---|
| `icon-1024.png` | Xcode (the app icon). Run `npx @capacitor/assets generate --ios --iconBackgroundColor '#1f1b45'` after copying it to `assets/icon-only.png`, or drag it into Xcode's AppIcon. |
| `screenshots/*.png` | App Store Connect → your app → iOS App → 6.9" iPhone display. Upload in number order. |
| `privacy-policy.md` | A public web page (Google Sites, Notion, or your own site). Paste its URL in App Store Connect and in `LINKS.privacy` in `www/js/main.js`. |
| `support.md` | Another public page; its URL goes in App Store Connect and `LINKS.support`. |

## Before you submit a build

- [ ] `www/js/main.js`: set `ALLOW_DEV = false`. While it's true, every new player starts in developer mode, which shows **Google's test ads (you earn nothing)** and unlocks cheats.
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

## In-app purchase: Remove Ads

- **Type:** Non-Consumable
- **Reference name:** `Remove Ads`
- **Product ID:** `[your bundle ID].removeads` (must match `PRODUCTS.removeAds` in `www/js/store.js`)
- **Price:** $2.99 (Tier 3)
- **Display name:** `Remove Ads`
- **Description:** `No more ads between games. Bonus ads stay optional.`
- **Review screenshot:** a screenshot of the Settings sheet showing the Remove Ads button (take one in the Simulator).
- Tick **"Add for review"** with your first app version.

## Game Center leaderboards

Create these in App Store Connect → your app → Game Center. The IDs must match `BOARDS` in `www/js/gamecenter.js`.

| Reference name | Leaderboard ID | Type | Score format | Sort | Score range |
|---|---|---|---|---|---|
| Endless all time | `[bundle ID].endless` | Classic | Integer | High to low | 0 – 500,000 |
| Endless this week | `[bundle ID].endless.weekly` | Recurring, every 7 days, starting a Monday | Integer | High to low | 0 – 500,000 |
| Total stars | `[bundle ID].stars` | Classic | Integer | High to low | 0 – 600 |

The score range rejects obviously faked scores. Display names: "Endless: All Time", "Endless: This Week", "Total Stars".

## Age rating

Answer Apple's questionnaire truthfully. For this game:
- No violence, horror, profanity, mature themes, medical content or user-generated content.
- **Gambling:** no real-money gambling. The pup "digs" are random rewards paid for with in-game bones or watching an ad, never with money.
- **Advertising:** yes, the app shows ads.
- **Made for Kids:** **No.** Kids-category apps can't use most ad networks.

## App Privacy ("nutrition label")

The game itself has no servers and collects nothing; save data stays on the device. The data in the label comes from **Google AdMob**. Check Google's current list before answering: search "AdMob data disclosure Apple App Store", Google's help page lists exactly what to declare. At the time of writing it is:

| Data type | Used for | Linked to user | Used for tracking |
|---|---|---|---|
| Identifiers → Device ID | Third-party advertising, Analytics | No | Yes (only after the player allows tracking) |
| Location → Coarse location (from IP) | Third-party advertising, Analytics | No | No |
| Usage data → Product interaction, Advertising data | Third-party advertising, Analytics | No | No |
| Diagnostics → Crash data, Performance data, Other diagnostic data | Analytics | No | No |

- **Purchases:** Apple handles them; you don't collect purchase data, so don't declare it.
- **Game Center:** Apple's own service; nothing to declare for it.

## Notes for the reviewer

Paste into App Review Information → Notes:

```
Pup Blast is a single-player block puzzle. No account or login is needed.

- Remove Ads (non-consumable): open the menu (top-left on the home screen) → Remove ads. "Restore purchases" is in the same menu.
- Game Center: the trophy button on the home screen opens the leaderboards. Scores are sent after Endless runs and level runs.
- Ads: Google AdMob. Rewarded ads are optional (bonus digs, "Keep playing", double bones). Interstitials appear between games, never in the first 3 games.
- On first launch, players in regions that require it see Google's consent form, then the iOS tracking prompt. "Privacy choices" in the menu reopens the consent form.
- The privacy policy is linked in the menu.

Thank you!
```

- **Sign-in required:** No.
- **Contact info:** your name, phone and email (only Apple sees these).
