import type { Loads, MuscleGroup } from '../config/stations';

export const MUSCLE_GROUPS: readonly MuscleGroup[] = ['legs', 'grip', 'upper', 'core'];

export const REST_HR = 60;
export const MAX_HR = 190;
/** Effort above which lactate builds up instead of clearing. */
export const LACTATE_THRESHOLD = 0.8;

const HR_TAU_UP = 12;
const HR_TAU_DOWN = 25;
const LACTATE_GAIN = 0.015;
const LACTATE_CLEAR = 0.015;
const ENERGY_DRAIN = 0.00016;
const FATIGUE_GAIN = 0.002;
const FATIGUE_RECOVERY = 0.004;
/** Share of new fatigue that never recovers during the race. */
const CHRONIC_SHARE = 0.12;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const zeroGroups = (): Record<MuscleGroup, number> => ({ legs: 0, grip: 0, upper: 0, core: 0 });

/**
 * The athlete's body. All times are race seconds and effort is 0 (rest) to 1 (all-out).
 */
export class Athlete {
  hr = REST_HR;
  /** Glycogen tank, 1 = full. */
  energy = 1;
  /** 0 = clear, 1 = legs on fire. */
  lactate = 0;
  private acute = zeroGroups();
  private chronic = zeroGroups();

  update(dt: number, effort: number, loads: Loads, loadScale = 1): void {
    effort = clamp01(effort);

    const hrTarget = Math.min(MAX_HR, REST_HR + (MAX_HR - REST_HR) * (0.25 + 0.7 * effort) + 12 * this.lactate);
    const tau = hrTarget > this.hr ? HR_TAU_UP : HR_TAU_DOWN;
    this.hr += (hrTarget - this.hr) * (1 - Math.exp(-dt / tau));

    const overThreshold = effort - LACTATE_THRESHOLD;
    this.lactate = clamp01(
      this.lactate + (overThreshold > 0 ? overThreshold * LACTATE_GAIN : overThreshold * LACTATE_CLEAR) * dt,
    );

    this.energy = Math.max(0, this.energy - ENERGY_DRAIN * effort ** 1.5 * dt);

    const recovery = Math.exp(-FATIGUE_RECOVERY * dt);
    for (const group of MUSCLE_GROUPS) {
      const gain = FATIGUE_GAIN * (loads[group] ?? 0) * effort * loadScale * dt;
      this.chronic[group] = Math.min(1, this.chronic[group] + gain * CHRONIC_SHARE);
      this.acute[group] = Math.min(1 - this.chronic[group], (this.acute[group] + gain * (1 - CHRONIC_SHARE)) * recovery);
    }
  }

  fatigue(group: MuscleGroup): number {
    return this.acute[group] + this.chronic[group];
  }

  /** Output multiplier (0..1] for an activity that works the given muscles. */
  capacity(loads: Loads): number {
    let total = 0;
    let weighted = 0;
    for (const group of MUSCLE_GROUPS) {
      const load = loads[group] ?? 0;
      total += load;
      weighted += load * this.fatigue(group);
    }
    const groupFatigue = total > 0 ? weighted / total : 0;
    return (1 - 0.25 * this.lactate) * (0.8 + 0.2 * this.energy) * (1 - 0.3 * groupFatigue);
  }

  /** Heart-rate zone 1..5 by % of max HR. */
  get zone(): 1 | 2 | 3 | 4 | 5 {
    const pct = this.hr / MAX_HR;
    if (pct >= 0.9) return 5;
    if (pct >= 0.8) return 4;
    if (pct >= 0.7) return 3;
    if (pct >= 0.6) return 2;
    return 1;
  }
}
