# hyrox-game

A 2D browser game where you race a full Hyrox-style fitness competition (8 × 1 km runs + 8 workout stations) using mouse and keyboard. Pacing is the game: go out too hard and you pay for it at the wall balls.

Design notes and roadmap: [docs/brainstorm.md](docs/brainstorm.md).

## Status: M1

- **Realistic 2D look**: a shaded, jointed athlete (kit, shoes, headband) posed with inverse kinematics, in a race-day arena with lights, a big screen, a crowd, barrier boards and a rubber floor. All art is drawn in code; there are no image files.
- **Full race loop**: Run → Roxzone → Station → Roxzone → … → Wall Balls → results with official-style splits and a personal best per division.
- **Rhythm runs**: tap left/right on every footstrike. The cadence comes from your pace level (112 steps/min walking up to 188 surging), and the runner's feet land on the beat. Clean steps keep your form high; sloppy or missing steps cost up to 20% of your speed and waste energy, and a long clean streak ("in the zone") makes running cheaper. Side view with the arena scrolling past, lap gantries every 250 m and a track minimap.
- **Rhythm stations (SkiErg, Wall Balls)**: each stroke or rep is a hold note on a metronome. The timing windows are tight and get tighter as you tire. You choose the tempo. Missed or rushed wall balls are no-reps, stopping ends the set so you can rest, and at high lactate the notes fade before the hit line.
- **Other six stations**: realistic animations (sled push/pull, burpee broad jumps, rowing, farmers carry, lunges), but still hold-to-work until M2.
- **Athlete body model**: heart-rate zones, lactate, energy, and fatigue per muscle group. The race clock runs about 6× real time, so an ~80 min race plays in ~13 min.

## Controls

| Where | Controls |
|---|---|
| Run | step on the beat: `A`/`D`, `←`/`→`, or left/right click · `W`/`S`, `↑`/`↓` or mouse wheel: pace · hold `Shift`: surge |
| Roxzone | hold `W` / `→`: jog |
| SkiErg, Wall Balls | `Space` or mouse: press on ●, release on ◆ · `W`/`S`: tempo · stop playing to rest, press again for a new set |
| Other stations | hold `Space` or mouse button: work · release: rest |
| Anywhere | `M`: mute |

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (simulation + balance)
npm run build      # typecheck + production build into dist/
```

Debug URL options (combine them with `&`):

- `?debug` enables `]` to skip the current segment. Races using any debug shortcut don't count as a PB.
- `&speed=10` fast-forwards the race clock. Rhythm stations still play at real tempo, so their splits come out inflated.
- `&autoplay` plays the rhythm stations and run steps perfectly.
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
