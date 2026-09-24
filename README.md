# hyrox-game

**Pace Yourself** (working title): a 2D browser game where you race a full Hyrox-style fitness competition (8 × 1 km runs + 8 workout stations) using mouse and keyboard. Pacing is the game: go out too hard and you pay for it at the wall balls.

Design notes and roadmap: [docs/brainstorm.md](docs/brainstorm.md).

## Status: M2 (the whole race is rhythm-based)

- **Realistic 2D look**: a shaded, jointed athlete (kit, shoes, headband) posed with inverse kinematics, in a race-day arena with lights, a big screen, a crowd, barrier boards and a rubber floor. All art is drawn in code; there are no image files.
- **Full race loop**: Run → Roxzone → Station → Roxzone → … → Wall Balls → results with official-style splits and a personal best per division.
- **Rhythm runs**: tap left/right on every footstrike. The cadence comes from your pace level (112 steps/min walking up to 188 surging), and the runner's feet land on the beat. Clean steps keep your form high; sloppy or missing steps cost up to 20% of your speed and waste energy, and a long clean streak ("in the zone") makes running cheaper. Side view with the arena scrolling past, lap gantries every 250 m and a track minimap.
- **Rhythm stations**: all eight stations are rhythm mini-games on a metronome, with tight timing windows that get tighter as you tire. You choose the tempo (faster = more work per minute, more lactate). Stop playing and the set ends so you can rest; play again for a count-in and a new set. At high lactate the notes fade before the hit line.
  - **Hold notes** (press on ●, release on ◆): SkiErg, rowing (with the 1:2 drive-to-recovery ratio), burpee broad jumps (up too early = no-rep, chest not down), sandbag lunges (no-rep, knee not down) and wall balls (no-rep for a rushed or late throw).
  - **Left/right taps**: sled push and sled pull build *momentum*, and a missed step stalls the sled. Farmers carry drains your *grip* as you walk (faster when your forearms are tired). Rest to recover it, or run out and drop the bells, which costs time re-gripping.
- **Athlete body model**: heart-rate zones, lactate, energy, and fatigue per muscle group. The race clock runs about 6× real time, so an ~80 min race plays in ~13 min.

## Controls

| Where | Controls |
|---|---|
| Run | step on the beat: `A`/`D`, `←`/`→`, or left/right click · `W`/`S`, `↑`/`↓` or mouse wheel: pace · hold `Shift`: surge |
| Roxzone | hold `W` / `→`: jog |
| SkiErg, rowing, burpees, lunges, wall balls | `Space` or mouse: press on ●, release on ◆ · `W`/`S`: tempo · stop playing to rest, press again for a new set |
| Sled push, sled pull, farmers carry | left/right on the beat (`A`/`D`, `←`/`→`, or left/right click) · `W`/`S`: tempo · stop to rest |
| Anywhere | `M`: mute |

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (simulation + balance)
npm run build      # typecheck + production build into dist/
```

`npm run build` produces a static site in `dist/` with relative paths, so it can be hosted anywhere (a claude.ai artifact, GitHub Pages, Netlify and so on).

Debug URL options (combine them with `&`):

- `?debug` enables `]` to skip the current segment. Races using any debug shortcut don't count as a PB.
- `&speed=10` fast-forwards the race clock. Rhythm stations still play at real tempo, so their splits come out inflated.
- `&autoplay` plays every run and station perfectly (and rests the farmers-carry grip).
- `&gallery` shows every athlete pose, animated. Add `&strip=jog` for one movement at 8 phases, or `&t=0.5` to freeze time.

## Layout

```
src/
  art/       canvas-drawn textures (athlete atlas, arena, equipment), IK rig, pose library
  config/    race constants, stations (distances, muscle loads), divisions & weights
  sim/       pure-TS simulation: athlete body, race clock/splits, session, bot, rhythm engine; unit tested
  stations/  rhythm scoring and rules per station, station animations
  scenes/    Phaser scenes: Boot, Menu, Run, Roxzone, Station, Hud (overlay), Results, Gallery (debug)
  ui/        theme, note lane, rhythm input, held keys
  audio.ts   synthesised metronome and hit sounds
```

The simulation and rhythm engine don't depend on Phaser. Scenes read input, call `session.advance(dt, effort)` (or `tick` + `addWork` for rhythm stations), and draw the result.
