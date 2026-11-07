# Magic Boba — Game Design Draft (v0.1)

> Working title. App Store listing: **Magic Boba: Bubble Tea Sort**
> Subtitle (keyword slot): *Potion & water sort puzzle*

## 1. Pitch

You run a tiny bubble-tea shop for witches, ghosts and forest spirits.
Pour enchanted teas between cups to sort them into the exact drinks your
customers ordered — but magic ingredients don't behave like water. Pearls
sink, fizz floats, and some flavours react the moment they touch.

**One-liner:** *Water sort, but the drinks are alive.*

## 2. Pillars

1. **Instantly familiar** – the core pour-to-sort loop is the genre standard;
   zero tutorial friction for the millions who've played one.
2. **Magic that changes the puzzle** – every world adds one ingredient rule
   that adds a new way to think, not just more colours.
3. **Delicious to touch** – liquid wobble, pour arcs, fizz, clinks and
   haptics on every move. Feel is the cheapest differentiator in the genre.
4. **A shop worth coming back to** – customers, decor and a recipe book give
   a reason to play tomorrow.

## 3. Core loop

```
 ┌──────────── Level (1–3 min) ────────────┐
 │ Read orders → pour & sort → serve cups  │
 └──────────────────┬──────────────────────┘
                    ▼
        Earn coins + recipe stamps
                    ▼
   Decorate shop / unlock cups / new customers
                    ▼
          Next level (or daily brew)
```

## 4. Base rules (World 1, no magic)

- Each cup holds **4 layers**.
- Tap a cup, then tap another: the **top contiguous run of one flavour**
  pours across, as many layers as fit.
- You may pour only onto an **empty cup** or onto the **same flavour**.
- A cup that is full of one flavour **seals with a lid** and is served.
- Level is won when every order is served.
- Standard tools: **Undo** and **+1 empty cup** (limited, refilled by
  rewarded ads or coins).

### Orders (the boba twist on plain sorting)
Customers queue at the counter with an order card. Early on, orders are
just "a full cup of Taro". Later orders become **recipes**:

| Order | Requires |
|---|---|
| Classic Taro | 4 × Taro |
| Taro Pearl | 1 × Pearls (bottom) + 3 × Taro |
| Moon Milk Tea | 2 × Black Tea + 2 × Moon Milk (milk on top) |

Recipe orders mean "sorted" isn't always "one colour" — you're building
specific stacks, which is fresh for the genre and fits the theme.

Customers have patience meters in **Rush** levels only; normal levels have
no timer (the core audience plays to relax).

## 5. Magic ingredients (one per world)

| World | Ingredient | Rule | Puzzle effect |
|---|---|---|---|
| 1 Cozy Corner | — | Base rules | Learn the loop |
| 2 Pearl Grotto | **Tapioca pearls** | Solid: always **sink to the bottom** of the cup they're poured into | Pouring pearls onto a cup slides them *under* its liquid — can bury or rescue a layer |
| 3 Fizz Falls | **Sparkle soda** | Always **floats to the top** | Mirror of pearls; together they reorder cups for you |
| 4 Mystery Market | **Fog tea** | Layer colour is **hidden** until it reaches the top | Information puzzle; plan under uncertainty |
| 5 Alchemy Lab | **Reactive pairs** | e.g. Strawberry touching Milk → **Strawberry Milk** (both layers fuse into one new flavour) | Reactions can be a trap or a shortcut; orders may *require* brewed flavours |
| 6 Frost Peak | **Frozen layers** | Ice can't pour; **thaws** after N moves or when warm tea lands on it | Timing & sequencing |
| 7 Cauldron Court | **Cauldron cup** | Special vessel: anything poured in becomes the cauldron's colour | Powerful, limited-use tool |
| 8+ | Mix of all | Combined rules | Late-game depth |

Each new ingredient is introduced with a 1-level **"spell lesson"**
(scripted, can't fail), then 2–3 easy levels, then mixed in.

## 6. Special cups (late-game variety)

- **Tall cup** (6 layers), **Mini cup** (2 layers)
- **Twin cup** – two chambers joined by a valve; pouring into one fills both
- **Locked cup** – opens when a specific order is served
- **Sealed jar** – needs a key ingredient poured on top

## 7. Meta & progression

- **Shop decorating:** coins buy furniture, signage, lights, plants.
  Purely cosmetic; drives return visits and screenshots.
- **Customers:** each world brings a new regular (frog wizard, ghost
  grandma, sleepy dragon…) with a short 2-line story beat per visit.
- **Recipe book:** every unique order served stamps a page — collection
  completion.
- **Cup skins:** cosmetic cups/straws; seasonal sets.
- **Familiar:** a shop cat that reacts to your play (sleeps, cheers,
  knocks over a cup as an easter egg).

## 8. Retention features

- **Daily Brew:** one hand-tuned puzzle per day, same for everyone.
  Shareable result card (moves used, emoji grid) — Wordle-style.
- **Weekly Rush:** timed order event with a leaderboard (Game Center).
- **Seasonal events:** Halloween cauldron, winter cocoa, Lunar New Year
  red-bean, summer fruit tea — new cups, decor, customers.
- **Streaks** for the Daily Brew.

## 9. Monetisation (genre-standard, player-friendly)

- **Rewarded ads:** extra Undo, +1 empty cup, double coins after a level.
- **Interstitials:** light — only after every 3rd level, never before
  level 10, never mid-level.
- **IAP:**
  - Remove Ads (one-time) — the top earner in this genre
  - Coin/booster packs
  - Cosmetic bundles (seasonal cup + decor sets)
  - Optional **Magic Pass** (season pass) later, once retention is proven

## 10. Level generation

- **Generate backwards** from a solved state by applying random legal
  *reverse* moves (respecting magic rules), so every level is solvable by
  construction.
- **Solver** (BFS / A* over cup states) verifies solvability, finds the
  optimal move count, and scores difficulty by branching factor & dead ends.
- Curated difficulty curve: hand-pick from generated candidates; ~1 in 10
  levels is a "breather"; every world ends on a showcase level.
- Target: 300+ levels at launch, generator for endless mode later.

## 11. Look & feel

- **Art:** soft pastel night palette (lavender, mint, warm lamp light),
  chunky rounded cups, cute-not-childish characters. Think cozy
  witch-café.
- **Liquid:** shader-based wobble on pickup, a real pour arc, settling
  ripple; pearls bounce as they sink, fizz bubbles stream upward.
- **Audio:** soft lo-fi shop music; satisfying glug/pour, lid "pop",
  sparkle on reactions; customers make tiny happy sounds.
- **Haptics:** light tick on select, rolling buzz during pour, firm thud
  on seal.

## 12. Tech plan

| Phase | Goal | Stack |
|---|---|---|
| 0. Paper/greybox | Validate rules & orders are fun | HTML5 canvas prototype (fast iteration, playable in mobile Safari) |
| 1. Vertical slice | World 1–2, shop screen, polish one pour | **SpriteKit + Swift** (native feel, haptics, Metal shaders) |
| 2. Soft launch | 100 levels, ads, IAP, analytics | Test market (e.g. Philippines / Canada) |
| 3. Global launch | 300+ levels, events, Daily Brew | App Store featuring push |

Shared: level data as JSON, generator + solver as a standalone tool
(TypeScript or Swift) so designers can batch-produce levels.

## 13. App Store / ASO notes

- Name: **Magic Boba** (no exact-match app found on the App Store as of
  Nov 2026; nearest is *Boba Story*, a café sim — do a trademark check
  before committing).
- Keyword fields: water sort, color sort, liquid, potion, bubble tea,
  boba, puzzle, relaxing, brain.
- Screenshots: lead with the satisfying pour + a reaction, not the menu.
- Short-form video (TikTok/Reels) of reactions & pearl sinks is the
  primary UA creative angle.

## 14. Open questions

- Do recipe orders confuse players who expect "one colour per cup"?
  → Test in prototype; fallback is recipes only from World 3.
- How punishing should reactions be? Lean toward shortcuts more often
  than traps.
- Portrait-only? (Yes, assumed.)
- Character/IP depth: light story, or none?
- Name alternatives if trademark clashes: *Brew & Boba*, *Witchy Sips*,
  *Spellsip*, *Pearl Potions*.
