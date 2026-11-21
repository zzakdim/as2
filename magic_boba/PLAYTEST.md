# Magic Boba: first play test plan

Goal: learn whether new players understand the game without help, where they get stuck, and whether
they want to keep playing. 5–10 people is enough for a first round.

## Two ways to share it

| | Browser link (today) | TestFlight (after the iOS build) |
|---|---|---|
| Setup | Share the Claude artifact (Share menu) | Upload a build, invite testers by email |
| Feels like the real app | Mostly (no native haptics, simulated ads) | Yes |
| Events visible | In dev mode (`#dev`) on the tester's device only | In Xcode / your analytics SDK |

Start with the browser link to test rules and tutorial. Move to TestFlight to test feel, haptics
and ads.

## Session script (15 minutes, in person or on a call)

1. Hand over the phone on the title screen. Say only: "This is a puzzle game. Think out loud."
2. **Don't help** unless they're stuck for more than a minute. Each time you help, note what was unclear.
3. Let them play as far as they like. Note where they slow down, sigh or smile.
4. Afterwards, ask:
   - "What were you trying to do?" (Do they understand sorting and orders?)
   - "What do pearls / soda do?" (Did the coach marks land?)
   - "Would you play this on the bus? What would make you come back tomorrow?"
   - "Which look do you like best?" (Show the four themes in the shop.)

## What to write down

| Watch for | Healthy | Worry |
|---|---|---|
| First pour in 1-1 | Within 10 s, following the hand | Taps randomly, ignores the hand |
| Understanding orders (1-5) | Pours into the customer's cup without help | Tries to sort only |
| Pearls / soda (2-1, 3-1) | Uses sinking / floating on purpose | Thinks it's a bug |
| Getting stuck | Uses undo or the vial button | Quits |
| Vial ad | Takes it when stuck and is glad of it | Feels forced, or never notices it |
| Shop | Wants to save up for something | Doesn't care about coins |
| Session length | 10+ levels in one sitting | Stops before level 5 |

## Numbers to watch once analytics are connected

- **Level funnel:** the percentage of players reaching levels 5, 10, 20 and 30. A cliff marks a level that needs tuning.
- **Stuck rate per level** (`stuck` ÷ `level_start`). Above about 40% means the level needs easing (regenerate it with a tighter cap).
- **Vial uptake** (`vial_granted` ÷ `stuck`). This is the ad-revenue engine; 20–40% is healthy.
- **Day-1 return:** whether players come back the next day. Casual puzzle games aim for 35–45%.

## Tuning knobs (no code changes)

- Difficulty: `target` moves and the `tier` caps in `proto/generate.js`, then `node proto/generate.js`
- Prices: `SHOP` in `proto/play.html`
- Rewards: base coins, star bonus and tip odds in `celebrate()` in `proto/play.html`
- Vial sizes per level: `bonusVials` (default 2 → 3 → 4)
