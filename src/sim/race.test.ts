import { describe, expect, it } from 'vitest';
import { Race, buildSegments } from './race';

describe('buildSegments', () => {
  it('interleaves 8 runs, 8 stations and 15 roxzone transitions', () => {
    const segments = buildSegments();
    expect(segments).toHaveLength(31);
    expect(segments.slice(0, 5).map((s) => s.kind)).toEqual(['run', 'roxzone', 'station', 'roxzone', 'run']);
    expect(segments.at(-1)).toEqual({ kind: 'station', index: 7 });
    expect(segments.filter((s) => s.kind === 'roxzone')).toHaveLength(15);
  });
});

describe('Race', () => {
  it('records splits and sums roxzone time', () => {
    const race = new Race();
    race.tick(300); // run 1
    race.completeSegment();
    race.tick(20); // roxzone in
    race.completeSegment();
    race.tick(240); // SkiErg
    race.completeSegment();
    race.tick(15); // roxzone out
    race.completeSegment();

    expect(race.summary()).toMatchObject({ runs: [300], stations: [240], roxzone: 35, total: 575 });
    expect(race.segment).toEqual({ kind: 'run', index: 1 });
  });

  it('stops the clock once finished', () => {
    const race = new Race();
    while (!race.finished) race.completeSegment();
    race.tick(100);
    expect(race.elapsed).toBe(0);
  });
});
