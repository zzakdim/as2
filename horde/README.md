# After Dark

A co-op horde shooter in the spirit of **Left 4 Dead 2**, built in **Godot 4.5**.
You and three AI teammates fight from saferoom to saferoom through a city
that's procedurally generated every run, while an AI Director decides when
and where the infected come at you.

Characters are realistic-proportioned CC0 Quaternius bodies wearing
Quaternius' modular outfits (Ranger leathers on the survivors, mostly
Peasant clothes on the infected, recoloured per character with procedural
grime and blood), driven by the Universal Animation Library (including its
zombie walk/idle/scratch set). Stylized KayKit models and
fast placeholder boxes are one toggle away. The procedural city is dressed with Quaternius' Downtown City MegaKit
(brick and trim facades, shopfronts, cornices, AC units) via MultiMesh;
guns are Quaternius' CC0 Ultimate Gun Pack; impacts are recorded CC0 sounds
and everything else is synthesized.

## Running it

1. Download Godot 4.5 (standard build, not .NET): https://godotengine.org/download
2. Open Godot → **Import** → pick `horde/project.godot`.
3. Press **F5**.

### Controls

| Action | Key |
| --- | --- |
| Move / jump / crouch / walk | WASD / Space / Ctrl / Shift |
| Fire / shove | LMB / RMB |
| Reload / use (hold to revive) | R / E |
| Weapons & items | 1 primary · 2 secondary · 3 throwable · 4 medkit · 5 pills · Q last · wheel |
| Flashlight / ping a special | F / Z |
| Stats / Director overlay / pause | Tab / F3 / Esc |

Medkit: select it (4), hold LMB to heal yourself or hold RMB on a teammate.

**Melee (greatsword / machete)** — Darktide-style:

| Action | Input |
| --- | --- |
| Light attack chain | tap LMB |
| Charged heavy | hold LMB, release |
| Block | hold RMB (costs stamina per hit blocked) |
| Push | LMB while blocking |
| Push-attack (thrust) | LMB right after a push |
| Dodge | Space while moving sideways or backwards |

Blocking right before a hit lands is a **perfect block**: no stamina cost,
and the attacker reels. Heavies held to full charge flash and hit harder.
Weapons: greatsword (cleaving sweeps), fire axe (armor-cracking chops),
sledgehammer (slow; the overhead slam knocks everything down), machete.

The **Melee Sandbox** on the title screen drops you in an arena with the
greatsword and an endless horde, with every weapon laid out around you.
F5 spawns a horde, F6 a special, F9 elites (shield, rager, gunner), F8 a Tank, F7 toggles god mode.

**Options:** the title screen cycles *Characters* between Realistic
(Quaternius), Stylized (KayKit, `--kaykit`) and placeholder boxes
(`--box-rigs`),
and the pause menu has FOV and mouse sensitivity.

**Solo testing:** toggle *Bot teammates* on the title screen or pause menu
(or pass `--no-bots`). Without bots, only death ends the run, and you can hold
E while downed to get yourself back up.

## What's in it

**Campaign.** Three maps. Each one runs start saferoom → streets, alleys,
plazas and a warehouse → a **crescendo gate** (press the button, hold out
against waves until it opens) → end saferoom (close the door with everyone
inside). The last map ends in a **radio finale**: survive the waves and two
Tanks, then get to the extraction zone. Your health and gear carry over
between maps.

**AI Director** (`scripts/ai/director.gd`). Modeled on Valve's published
design. It tracks each survivor's intensity (damage taken, incaps, pins, close
kills) and cycles **Build-up → Peak → Relax**. While building up it keeps
wanderers populated ahead of the team, sends mobs on a timer and spawns
specials. Everything it spawns appears out of sight of every survivor and
somewhere that can reach you. It also places the Tank (at a random point
along the map) and Witches. Press F3 in game to watch it work.

**Infected**
- Commons: wander, sit and idle. Gunfire and flashlights wake them. They path
  with a flow field, so 100+ can swarm. They can be shoved, gibbed, set on fire
  and lured.
- **Hunter**: stalks, screeches, pounces and pins. You can shove it off, or
  shove it mid-air to skeet it.
- **Smoker**: tongue-grabs from range and drags the victim. Break the hold by
  shooting the Smoker, shoving the victim or breaking line of sight.
- **Boomer**: bile calls a horde onto whoever it hits, and it bursts when
  killed. Shove it first.
- **Charger**: straight-line charge that scatters the team, then carries one
  victim off and pummels them.
- **Spitter**: lobs acid that burns harder the longer you stand in it.
- **Tank**: thousands of HP, punches send you flying, throws concrete. Gets
  its own music.
- **Witch**: sits sobbing. Proximity, flashlights and noise make her angrier
  until she charges whoever set her off and drops them in one hit.

**Elites** (Darktide-style, mixed into mobs from Normal up)
- **Shieldbearer**: armored. Light sweeps glance off and stop dead;
  overheads, thrusts, axe chops and the sledgehammer go through. Hits hard
  with a long, readable windup.
- **Rager**: closes fast and attacks in three-hit flurries. Block, perfect
  block or dodge them; a push interrupts the flurry.
- **Gunner**: hangs back and shoots. A blinking red laser telegraphs the
  aim, then a burst follows. The aim trails you, so sprint across the line
  of fire, dodge, break line of sight, or close in and cut it down. Bots
  prioritise them.

Hits soaked by toughness flash the screen edge pale blue; health damage
flashes red. Either way the flash is strongest on the side the hit came from.

**Survivors**
- **Toughness** (Darktide): a shield bar above health that soaks most hits.
  It regenerates when you avoid damage for 3 s, faster with teammates
  within 8 m (coherency), and melee kills refill it, so fighting
  aggressively in melee keeps you alive.
- Health plus temporary health (pills) that decays.
- Incap → revive → black & white on your last life → death.
- Limping at low health. Friendly fire scales with difficulty.

**Melee** (`scripts/weapons/melee.gd`). Movesets are data: each attack is
a swing direction, an arc, timings (windup, strike, follow-through, recover),
damage, a cleave budget and an impact force. The same camera-space blade
transform drives the first-person view *and* the hit sweep, so what you see
is exactly what you hit. Feel comes from:
- weapon-side drag on contact (the swing slows as it carves through
  bodies, the Vermintide/Darktide approach, instead of global hit-stop)
- a camera punch in the swing direction and a fading swing trail
- the cleave budget: the horde soaks it up, and armored targets stop the
  blade dead
- directional staggers and flinches on survivors of a hit, plus a
  procedural hit reaction: every blade or bullet hit springs the torso and
  head away from the blow on top of the animation (headshots snap the head)
- ragdolls launched along the swing, with cut-dependent gore: decapitation,
  head splits, lost arms, and heavy sweeps cutting bodies in half
- blood that follows the edge, stains the blade, and splashes the screen
  on close kills

`--input-test` drives the real first-person controls through every melee
state, the medkit, pills and throwables, and fails if any are unreachable.

`--spawn=gunner,rager` (with `--autotest`) drops those enemies 12 m in front
of the player, for screenshot checks of a specific fight.

`--hit-test=/dir` renders three zombies taking scripted side, thrust and
head hits frame by frame. `--gun-sheet=/dir` renders each gun in first person (grip and scale check).

To check swing arcs without playing, render a pose contact sheet:
`xvfb-run godot --path horde --rendering-driver opengl3 -- --autotest --sandbox --no-bots --seconds=200 --melee-poses=/tmp/poses`

**Weapons**: pistol / dual pistols / magnum / machete / greatsword, SMG, pump & auto
shotgun, assault rifle, hunting rifle. Also pipe bombs (lure + explode),
molotovs and bile jars. Damage numbers follow L4D2's published stats,
including headshots, penetration and shotgun falloff.

**Bots** (`scripts/ai/bot_brain.gd`)
- Follow you and prioritise specials pinning a teammate.
- Shove commons, revive the downed and heal themselves.
- Grab better guns and call out what they see. They never shoot the Witch.

Also included: car alarms that summon a mob, Darktide-style pinging (Z marks
a special for the team), four difficulties, and a stats screen.

## Project layout

```
horde/
  project.godot           Engine config (Jolt physics, Forward+)
  scenes/main.tscn        Entry scene; everything else is built in code
  scripts/
    game.gd               Autoload: shared refs, difficulty tables, input map
    main.gd               Menus, map loading, carry-over, soak test
    level/                Procedural map generator, flow fields, props, pickups
    actors/               Survivor, player controller, common + special infected, rigs
    ai/                   Director, bot brain
    weapons/              Weapon table, throwables, projectiles, fire/acid hazards
    fx/                   Materials/textures, particles, decals
    audio/sfx.gd          Procedural sound synthesis + music layers
    ui/hud.gd             HUD, menus, scoreboard
```

## Headless soak test

Bots play the whole campaign with no window, logging the Director state.
This catches script errors and stuck states without anyone playing:

```
godot --headless --path horde --time-scale 4 -- --autotest --seconds=600
```

To grab screenshots (software rendering works):
`xvfb-run godot --path horde --rendering-driver opengl3 -- --autotest --seconds=20 --shot=10:/tmp/a.png`

## Roadmap / bells and whistles

Next up, roughly in order of impact:

- **More clothing and zombie variety.** Any outfit for the Universal Base
  Characters rig can be added with `tools/build_outfit_model.py` and listed
  in `SkinnedRig.HUMAN_MODELS`; modern streetwear and rotting variants are
  the next to find or make. Survivor voice lines.
- **Hand-authored set pieces** mixed into the procedural layout, plus
  interiors with stairs and multiple floors.
- **Darktide layer**
  - Classes with abilities (Veteran, Zealot, Psyker, Ogryn-style).
  - Toughness that regenerates near teammates (coherency).
  - Heavy/light melee combos with stamina and blocking.
  - Loadouts and progression between runs.
- **More L4D2**: Jockey, rescue closets for dead teammates, ledge hangs, more
  melee weapons, laser sights / incendiary ammo, gas can scavenge finales,
  weather (Hard Rain).
- **Online co-op** (Godot's high-level multiplayer) and versus mode.
