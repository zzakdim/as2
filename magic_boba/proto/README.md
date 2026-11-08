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

## Feel: animation & audio (`fx.js`, `audio.js`)

Everything is generated in code: no image or sound files.

**Pour choreography.** The cup lifts, flies over the target and tips about its lip. A wobbling
stream falls, the source drains layer by layer while the target fills, splash droplets land, and
the cup swings home. Input reopens as soon as the liquid lands, so fast players are never held up
by the return trip. Pearls fall as particles and drop in under the liquid, which rises to make room.

**Reward ladder** (each step bigger than the one before):

| Moment | Visual | Sound |
|---|---|---|
| Select | Springy lift, liquid sloshes | Glass clink, pitched by how full the cup is |
| Pour | Stream, splash, fill | Stream noise that rises as the cup fills, glugs, bubbles, a plucked note per layer climbing the scale |
| Wrong move | Target cup shakes | Soft muted "bonk" (never a buzzer) |
| Cup complete | Lid and straw drop on, cup squashes, star burst, shockwave, praise text | Lid pop and a 3-note chime that climbs with the streak |
| Order served | Customer hops, hearts, slides away; the next one walks in | Bell "ding-ding" and a happy chirp; a door chime for the new customer |
| Streak | "Nice! → Sweet! → … → LEGENDARY!", bigger each time | Chimes climb the scale; a whoosh |
| Win | Victory lap (cups hop in a wave), confetti, stars pop in one by one, coins count up | Fanfare, a rising bell per star, coin ticks |
| Random tip | 15% chance of a **golden tip** (×6 coins) | Jackpot arpeggio |
| Ad vial | Vial spins in from above, sparkle ring | Magic harp glissando |

**Audio design rules** (rationale in comments at the top of `audio.js`):
- Every tonal sound uses the same key as the music (F-major pentatonic), so overlapping sounds stay in harmony.
- Pour pitch follows the physics of a filling vessel: the shorter the air column, the higher the pitch.
- Bubbles use the standard synthesized bubble: a fast upward sine chirp.
- Clinks use inharmonic glass overtones.
- Sounds escalate with streaks, get a little random pitch on each repeat so they don't wear thin, and keep a clear loudness order. Measured peaks: wrong move 0.25 < pour 0.26–0.36 < complete ≈ win 0.49.
- The music ducks under big rewards. The lo-fi loop (80 BPM, swung) is scheduled with a look-ahead clock.
- Sound effects and music each have a toggle, saved per device. Haptics use `navigator.vibrate` where the browser supports it; the iOS build would use `UIImpactFeedbackGenerator`.
- `prefers-reduced-motion` turns off flights, shakes, confetti and ambient motion.

## Skins (visual A/B/C candidates)

Tap 🎨 in the header to cycle looks. The game logic is the same in all three; only CSS variables,
the flavour palette and the background particles change. Your choice is remembered per device.

| Skin | Mood | Signature details |
|---|---|---|
| **Night Café** (default) | Cozy, witchy, dark | Warm lamp glow, wooden shelf, white dome lid + pink straw, rising dust motes |
| **Sakura Pastel** | Cute, light, casual-friendly | Cups have faces: they blink, look surprised when lifted, sleep when empty and beam with blush when done. Falling petals, pink lid with a heart. |
| **Potion Lab** | Mystical, glowing, striking | Test tubes on a brass rack, neon liquids, corks instead of lids, finished potions pulse with light, rising bubbles |

Shared polish: shelf planks and contact shadows (the shadow shrinks when a cup lifts), a moving
liquid surface, fizz, a selection glow in the liquid's colour, an "almost done" pulse when a cup is
one layer from finished, rows balanced so no cup sits alone, and a themed counter for customers.

Comparison screenshots are in `magic_boba/design/` (`skins-play.jpg`, `skins-orders.jpg`, `skins-win.jpg`).
