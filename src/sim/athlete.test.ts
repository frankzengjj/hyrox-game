import { describe, expect, it } from 'vitest';
import { Athlete, MAX_HR, REST_HR } from './athlete';

const simulate = (athlete: Athlete, seconds: number, effort: number, loads = {}) => {
  for (let t = 0; t < seconds; t++) athlete.update(1, effort, loads);
};

describe('Athlete', () => {
  it('raises heart rate with effort and recovers at rest', () => {
    const a = new Athlete();
    simulate(a, 120, 0.9);
    expect(a.hr).toBeGreaterThan(165);
    expect(a.hr).toBeLessThanOrEqual(MAX_HR);
    expect(a.zone).toBe(5);

    simulate(a, 180, 0);
    expect(a.hr).toBeLessThan(100);
    expect(a.hr).toBeGreaterThan(REST_HR);
  });

  it('builds lactate above threshold and clears it below', () => {
    const a = new Athlete();
    simulate(a, 120, 0.6);
    expect(a.lactate).toBe(0);

    simulate(a, 180, 1);
    const peak = a.lactate;
    expect(peak).toBeGreaterThan(0.4);

    simulate(a, 120, 0.4);
    expect(a.lactate).toBeLessThan(peak);
  });

  it('only fatigues the muscles that are worked', () => {
    const a = new Athlete();
    simulate(a, 180, 0.85, { legs: 1 });
    expect(a.fatigue('legs')).toBeGreaterThan(0.2);
    expect(a.fatigue('grip')).toBe(0);
    expect(a.capacity({ legs: 1 })).toBeLessThan(a.capacity({ grip: 1 }));
  });

  it('recovers acute fatigue but keeps some for the rest of the race', () => {
    const a = new Athlete();
    simulate(a, 180, 0.85, { legs: 1 });
    const afterSled = a.fatigue('legs');
    simulate(a, 1200, 0.2);
    expect(a.fatigue('legs')).toBeLessThan(afterSled / 2);
    expect(a.fatigue('legs')).toBeGreaterThan(0.03);
  });

  it('drains energy faster at higher effort', () => {
    const easy = new Athlete();
    const hard = new Athlete();
    simulate(easy, 600, 0.4);
    simulate(hard, 600, 0.9);
    expect(hard.energy).toBeLessThan(easy.energy);
  });
});
