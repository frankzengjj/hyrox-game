# Hyrox Web Game — Brainstorm

Status: early brainstorm, nothing decided yet. Open questions are at the bottom.

## The real thing (what we're simulating)

A Hyrox race is 8 × 1 km runs. After each run comes one workout station, always in this order:

| # | Station | Work |
|---|---------|------|
| 1 | SkiErg | 1000 m |
| 2 | Sled Push | 50 m |
| 3 | Sled Pull | 50 m |
| 4 | Burpee Broad Jumps | 80 m |
| 5 | Rowing | 1000 m |
| 6 | Farmers Carry | 200 m |
| 7 | Sandbag Lunges | 100 m |
| 8 | Wall Balls | 100 reps |

- **Roxzone**: the transition area between the running track and the stations. Time spent there is tracked as its own split.
- **Divisions**: Open, Pro (heavier), Doubles (2 athletes split station work), Relay (4 athletes).
- **Judges** call no-reps (for example a shallow wall ball squat, or a ball that doesn't reach the target).
- Typical finish times run from about 55 min (elite) to 90+ min (most athletes). Pacing is what separates people.

Approximate division weights as game config defaults (check against the current season rulebook):

| | Open W | Open M | Pro W | Pro M |
|---|---|---|---|---|
| Sled Push (incl. sled) | 102 kg | 152 kg | 152 kg | 202 kg |
| Sled Pull (incl. sled) | 78 kg | 103 kg | 103 kg | 153 kg |
| Farmers Carry | 2×16 kg | 2×24 kg | 2×24 kg | 2×32 kg |
| Sandbag Lunges | 10 kg | 20 kg | 20 kg | 30 kg |
| Wall Ball | 4 kg / 2.7 m | 6 kg / 3 m | 6 kg / 2.7 m | 9 kg / 3 m |

## Design pillars

1. **Pacing is the game (strategy layer).** Going out too fast on run 1 should hurt you at the wall balls, like it does in real life.
2. **Every station feels different (skill layer).** Each station gets its own mouse or keyboard mini-game, so the race never turns into one repeated button-mash.
3. **Race-day atmosphere (flavor layer).** Roxzone, crowd noise, judges, lap counters, and an official-style splits screen at the end.

## Core system: the athlete's body

A small simulation shared by every scene, written as pure TypeScript so it can be unit tested:

- **Heart rate (zones 1–5)**: rises with effort and falls when you ease off. Time in zone 5 builds up **lactate**, which lowers your output until it clears.
- **Energy tank (glycogen)**: slowly drains over the whole race. A water station in the Roxzone gives a small top-up.
- **Muscle fatigue per group**: **Legs**, **Grip/Arms**, **Push (shoulders/chest)**, **Core**. Each station loads specific groups. For example, Sled Push hits legs hard, and Farmers Carry hits grip.
- **"Compromised running"** (a signature Hyrox feeling): after heavy-leg stations, the first ~200 m of the next run has sluggish controls and a slower pace.
- **Form / efficiency**: good rhythm in the mini-games means less energy per rep. Sloppy input wastes energy and draws no-reps.

## Running segments

The segments between stations need to be more than holding W:

- **Pace control**: W/S or the mouse wheel sets target pace. A pace/HR readout on a "watch" HUD shows the cost.
- **Surge**: hold Shift to overtake. It's expensive in HR.
- **Steering**: A/D or mouse to take the inside line on corners, pass AI athletes, and avoid traffic.
- **Lap counting**: a real 1 km is several laps of the hall. Miss a lap and you get a penalty. The lap count is only visible by glancing at your watch (Tab), which is a small attention tax.
- **Crowd hype zones**: passing the grandstand while pushing builds a short boost.

## Roxzone

A top-down transition map. Find your station lane (the wrong lane costs time), optionally grab water, then enter the station. Roxzone time is its own split on the results screen.

## Stations (mouse + keyboard mini-games)

| # | Station | Controls idea | Skill tested | Failure / no-rep |
|---|---------|---------------|--------------|------------------|
| 1 | SkiErg | Drag mouse **down** to pull, let it rise to recover. Pick a damper setting (1–10) beforehand: more power per stroke vs. more fatigue | Stroke timing against a power curve | Short or rushed strokes waste energy |
| 2 | Sled Push | Alternate **A/D** for steps while holding **Space** to drive low. 4 lengths of 12.5 m with a turn at each end | Cadence vs. traction | Stepping too fast makes you slip and stall |
| 3 | Sled Pull | Hand-over-hand: alternate **left/right click** while dragging the mouse down. Walk back (**S**) to reset position | Rhythm, staying in the box | Leaving the athlete box gets a judge penalty |
| 4 | Burpee Broad Jumps | Combo: **S** (chest to floor) → **W** (stand) → hold and release **Space** (jump, power meter sets distance) | Clean sequence, jump power | Chest not touching or feet split: no-rep |
| 5 | Rowing | Drag mouse **back fast** (drive), return **slowly** (recovery). Aim for a ~1:2 drive:recovery ratio. Shows 500 m split and stroke rate | Rhythm ratio | Rushing the recovery burns energy |
| 6 | Farmers Carry | Hold **both mouse buttons** (one per hand, grip meters drain), **W** to walk, **A/D** to stop the bells swaying | Grip management | Drop = time lost re-gripping. You can also set them down on purpose to rest |
| 7 | Sandbag Lunges | Alternate **Q/E** legs. Hold until the knee touches (depth meter), release to stand. Mouse keeps the bag balanced | Depth + balance | Knee doesn't touch: no-rep |
| 8 | Wall Balls ("final boss") | Hold mouse to **squat** (depth indicator), release to **throw**. Power timing must hit the target band, then catch into the next rep. Press **R** to break sets and rest | Rhythm under max fatigue, choosing set sizes | Shallow squat or ball under the target: no-rep |

## Time compression

A real race takes 60–90 minutes, but a full game race should take about **10–15 minutes** of play.

- The on-screen **race clock is simulated Hyrox time** (for example "1:07:43"), computed from the player's pace and station output.
- Runs play at roughly 5–6× compression.
- Stations use real rep and meter counts where it feels good. Where 1 rep = 1 input would drag on (100 wall balls), use batching or faster rhythm.

## Opponents & modes

- **Race vs. AI heat**: AI athletes with personalities, e.g. the *Fast Starter* who blows up at the sleds, the *Metronome* who never changes pace, and the *Runner* who is slow at stations.
- **PB ghost**: race your own best run.
- **Station Practice**: play any single station.
- **Doubles (single-player twist)**: you control two athletes. Press Tab to swap who is working while the partner recovers. Deciding when to swap is the strategy.
- **Relay**: 4 athletes, each doing 2 runs + 2 stations.
- Later: online leaderboards, and a career mode (train between races to qualify for "Worlds").

## Results screen

An official-style breakdown:

- Run 1–8 splits, Station 1–8 splits, total Roxzone time, and total time.
- Placing in the heat and division.
- Chart of your splits vs. the field average and vs. your PB.
- Shareable result card image.

## Tech options

| Option | Pros | Cons |
|---|---|---|
| **Phaser 3 + TypeScript + Vite** *(leaning)* | Mature 2D engine; scenes, input, tweens, audio, and physics included; fast to make mini-games | 2D only |
| Three.js / Babylon.js | 3D visuals | Much more art and camera work; slower to reach "fun" |
| PixiJS | Fast renderer | You build your own game framework |
| Plain Canvas | Zero deps | Reinventing everything |

Leaning towards Phaser 3 + TS + Vite, with:

- **Visual style**: 2D. Top-down for the running track and Roxzone, side-view close-ups for stations (in the style of classic *Track & Field* games). Start with geometric placeholders, and later move to pixel art or free asset packs.
- **Architecture**: one Phaser scene per station, plus Run, Roxzone, HUD overlay, Menu, and Results. A shared `Athlete` model (HR, energy, fatigue) and `RaceState` (splits, clock) in pure TS, tested with Vitest. Station and division numbers live in data/config files.
- **Deploy**: GitHub Pages via GitHub Actions.

## Rough roadmap

- **M0 — Skeleton**: Vite + Phaser + TS scaffold, scene flow (Menu → Run → Station → … → Results), race clock, splits screen, all with placeholder graphics.
- **M1 — First fun**: running with pace/HR, athlete body model, and 2 real stations (SkiErg + Wall Balls) as a playable "mini race".
- **M2 — Full race**: all 8 stations with basic mechanics, plus Roxzone.
- **M3 — Race day**: AI heat, judges/no-reps, crowd, audio, art pass.
- **M4 — Modes**: practice, doubles, PB ghost, leaderboard.

## Open questions

1. **Feel**: arcade/party (mashing, quick laughs) or simulation (realistic pacing, strategy)? Or a hybrid, as sketched above?
2. **Visuals**: 2D (top-down + side-view) or 3D?
3. **Players**: single-player first? Is local or online multiplayer important?
4. **Length**: is 10–15 minutes for a full race right?
5. **Audience**: personal/for fun, or public release? HYROX is a trademark, so a public game should use an original name and no official logos.
