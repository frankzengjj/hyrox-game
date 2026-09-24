import { describe, expect, it } from 'vitest';
import { StepTrack, type StepEvent } from './steps';

// 150 steps/min = 400 ms between footstrikes; first note at t=1000.
const track = () => new StepTrack(150, 1000);
const grades = (events: StepEvent[]) => events.map((e) => (e.type === 'step' ? `${e.note.foot}:${e.note.grade}` : `stray:${e.foot}`));

describe('StepTrack', () => {
  it('schedules alternating left/right footstrikes at the cadence', () => {
    const t = track();
    expect(t.notes.slice(0, 4).map((n) => [n.foot, n.at])).toEqual([
      ['L', 1000],
      ['R', 1400],
      ['L', 1800],
      ['R', 2200],
    ]);
  });

  it('judges the right foot on the beat and builds form and streak', () => {
    const t = track();
    t.form = 0.5;
    expect(grades(t.press('L', 1010))).toEqual(['L:perfect']);
    expect(grades(t.press('R', 1480))).toEqual(['R:good']);
    expect(t.streak).toBe(2);
    expect(t.form).toBeGreaterThan(0.5);
  });

  it('treats the wrong foot as a stray tap that costs form', () => {
    const t = track();
    const before = t.form;
    expect(grades(t.press('R', 1000))).toEqual(['stray:R']);
    expect(t.form).toBeLessThan(before);
    expect(t.notes[0]).toMatchObject({ foot: 'L', done: false });
  });

  it('misses notes that pass unplayed, and form decays', () => {
    const t = track();
    const events = [...t.update(1200), ...t.update(1600)];
    expect(grades(events)).toEqual(['L:miss', 'R:miss']);
    expect(t.form).toBeLessThan(0.9);
    expect(t.streak).toBe(0);
  });

  it('gives the stride phase for syncing the legs: 0 on left strikes, 0.5 on right', () => {
    const t = track();
    t.update(1000);
    expect(t.phaseAt(1000)).toBeCloseTo(0);
    expect(t.phaseAt(1200)).toBeCloseTo(0.25);
    expect(t.phaseAt(1400)).toBeCloseTo(0.5);
    expect(t.phaseAt(900)).toBeCloseTo(0.875);
  });

  it('applies a cadence change to notes scheduled after it', () => {
    const t = track();
    const scheduled = t.notes.length;
    t.cadence = 200;
    t.update(2000);
    const gaps = t.notes.slice(scheduled - 1).map((n, i, a) => (i ? n.at - a[i - 1].at : 0)).slice(1);
    expect(gaps.every((g) => g === 300)).toBe(true);
  });
});
