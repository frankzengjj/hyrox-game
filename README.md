# hyrox-game

A 2D browser game where you race a full Hyrox-style fitness competition (8 × 1 km runs + 8 workout stations) using mouse and keyboard. Pacing is the game: go out too hard and you pay for it at the wall balls.

Design notes and roadmap: [docs/brainstorm.md](docs/brainstorm.md).

## Status: M0 (skeleton)

- Full race loop: Run → Roxzone → Station → Roxzone → … → Wall Balls → results with official-style splits.
- Running on a top-down track with 5 pace levels plus a surge.
- Athlete body model: heart-rate zones, lactate, energy, and fatigue per muscle group (legs, grip, upper, core).
- A simulated race clock (~6× faster than real time), so a ~80 min race plays in ~13 min.
- Personal bests saved per division.
- Stations use one placeholder mechanic for now (hold to work, release to rest). Real mini-games come next (M1).

## Controls

| Where | Controls |
|---|---|
| Run | `W`/`S`, `↑`/`↓` or mouse wheel: pace · hold `Shift`: surge |
| Roxzone | hold `W` / `→`: jog |
| Stations | hold `Space` or mouse button: work · release: rest |

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (simulation + balance)
npm run build      # typecheck + production build into dist/
```

Debug URL options: `?debug` enables `]` to skip the current segment (the result then won't count as a PB). `?debug&speed=10` fast-forwards the race clock.

## Layout

```
src/
  config/   race constants, stations (distances, muscle loads), divisions & weights
  sim/      pure-TS simulation: athlete body, race clock/splits, session, bot; unit tested
  scenes/   Phaser scenes: Menu, Run, Roxzone, Station, Hud (overlay), Results
  ui/       theme (colours, text styles)
```

The simulation doesn't depend on Phaser. Scenes read input, call `session.advance(dt, effort)`, and draw the result.
