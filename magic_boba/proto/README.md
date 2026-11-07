# Magic Boba — level prototype

A throwaway HTML prototype for testing rules and levels before the SpriteKit build.

| File | What it is |
|---|---|
| `engine.js` | Rules (pouring, pearls sink, order cups) + BFS solver + random-play "stuck rate" |
| `generate.js` | Builds the test pack: deals many random seeds per level spec, solves each, keeps the one closest to the target move count |
| `levels.json` / `levels.js` | Generated pack (same data; `.js` is for the browser) |
| `play.html` | Playable, touch-friendly test page with Undo / Restart / Hint |

## Play

Open `play.html` in a browser (works straight from the file system). To play on a phone:

```bash
cd magic_boba/proto && python3 -m http.server 8000
```

then open `http://<your-computer-ip>:8000/play.html` on the phone.

## Regenerate levels

```bash
node magic_boba/proto/generate.js
```

Edit the `PACK` array in `generate.js` to add or tune levels. Each level gets:

- `optimal` – fewest possible moves (proven by the solver; drives the star rating)
- `branching` – average legal moves per position (higher = more choice)
- `randomPlayStuckPct` – % of random playthroughs that dead-end; a rough "how punishing" score

## Rules implemented

- Cups hold 4 layers. Pour the top run of one ingredient; as much as fits moves.
- Liquids pour onto an empty cup, the same liquid, or a pearl bed.
- **Pearls** pour into any cup with room and **sink below the liquid**.
- **Sort mode:** win when every cup is full of one ingredient.
- **Orders mode:** customers wait at the counter (`slots` at a time). Pour into an order cup only the
  ingredient its recipe needs next (bottom → top). Finished orders leave; win when everyone is served.
