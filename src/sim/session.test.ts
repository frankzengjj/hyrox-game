import { describe, expect, it } from 'vitest';
import { simulateRace, type Strategy } from './bot';
import { Session } from './session';

const STEADY: Strategy = { runEffort: 0.6, roxzoneEffort: 0.45, stationEffort: 0.85 };

describe('Session', () => {
  it('stops the clock exactly at the finish of a segment', () => {
    const session = new Session('open', 'women');
    let steps = 0;
    while (session.segment?.kind === 'run') {
      session.advance(10, 0.6);
      steps++;
    }
    const [split] = session.race.splits;
    // 10 s steps would overshoot; the split must be the exact crossing time, not a whole number of steps.
    expect(split.seconds).toBeLessThan(steps * 10);
    expect(split.seconds).toBeGreaterThan((steps - 1) * 10);
    expect(session.progress).toBe(0);
    expect(session.segment).toEqual({ kind: 'roxzone', index: 0, leg: 'in' });
  });

  it('makes a race with a skipped segment unofficial', () => {
    const session = new Session('open', 'women');
    expect(session.unofficial).toBe(false);
    session.skipSegment();
    expect(session.unofficial).toBe(true);
    expect(session.segment).toEqual({ kind: 'roxzone', index: 0, leg: 'in' });
  });

  it('makes no station progress while resting', () => {
    const session = new Session('open', 'women');
    while (session.segment?.kind !== 'station') session.advance(1, 0.6);
    session.advance(10, 0.15);
    expect(session.progress).toBe(0);
    session.advance(10, 0.85);
    expect(session.progress).toBeGreaterThan(0);
  });
});

describe('race balance', () => {
  const finish = (strategy: Strategy, division: 'open' | 'pro' = 'open') =>
    simulateRace(new Session(division, 'men'), strategy).race.summary();

  it('a steady Open race lands in a realistic 55–95 min window', () => {
    const { total, runs, stations } = finish(STEADY);
    expect(runs).toHaveLength(8);
    expect(stations).toHaveLength(8);
    expect(total / 60).toBeGreaterThan(55);
    expect(total / 60).toBeLessThan(95);
  });

  it('sprinting every run is slower than pacing it (pacing is the game)', () => {
    const sprint = finish({ ...STEADY, runEffort: 1 });
    const tempo = finish({ ...STEADY, runEffort: 0.72 });
    expect(sprint.total).toBeGreaterThan(tempo.total);
  });

  it('Pro is slower than Open for the same athlete', () => {
    expect(finish(STEADY, 'pro').total).toBeGreaterThan(finish(STEADY, 'open').total);
  });
});

describe('Session rhythm API', () => {
  it('ticks the clock without progress, and completes on added work', () => {
    const session = new Session('open', 'women');
    session.skipSegment();
    session.skipSegment();
    expect(session.segment).toEqual({ kind: 'station', index: 0 });
    session.tick(10, 0.85);
    expect(session.progress).toBe(0);
    expect(session.race.segmentElapsed).toBe(10);
    expect(session.addWork(600)).toBe(false);
    expect(session.addWork(600)).toBe(true);
    expect(session.race.splits.at(-1)).toMatchObject({ segment: { kind: 'station', index: 0 }, seconds: 10 });
  });
});
