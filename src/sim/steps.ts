import { BASE_WINDOWS, type Grade, type Windows, gradeOffset } from './rhythm';

/**
 * Footstrike rhythm for runs: alternating left/right tap notes at the running cadence.
 * Times are milliseconds on the performance.now() clock.
 */

export type Foot = 'L' | 'R';

export interface StepNote {
  id: number;
  foot: Foot;
  at: number;
  hitAt?: number;
  grade?: Grade;
  done: boolean;
}

export type StepEvent = { type: 'step'; note: StepNote } | { type: 'stray'; foot: Foot };

const QUALITY: Record<Grade, number> = { perfect: 1, good: 0.8, miss: 0 };
/** How fast form follows recent steps (per step). */
const FORM_SMOOTHING = 0.12;
/** A tap with no note of that foot nearby (wrong foot, or off the beat). */
const STRAY_FORM_PENALTY = 0.06;
/** Beats kept for gait syncing after they pass. */
const HISTORY_MS = 3000;

export class StepTrack {
  /** Upcoming, unjudged notes, oldest first. */
  readonly notes: StepNote[] = [];
  windows: Windows;
  /** Rolling step quality, 0 (shambling) .. 1 (every step on the beat). */
  form: number;
  streak = 0;
  bestStreak = 0;
  /** Every scheduled footstrike (judged or not), for syncing the runner's legs. */
  private readonly beats: { foot: Foot; at: number }[] = [];
  private nextAt: number;
  private nextFoot: Foot = 'L';
  private nextId = 1;

  constructor(
    public cadence: number,
    startAt: number,
    readonly lookaheadMs = 1500,
    windows: Windows = BASE_WINDOWS,
    form = 0.9,
  ) {
    this.windows = windows;
    this.form = form;
    this.nextAt = startAt;
    // Virtual strides before the first note so the gait is defined from the start.
    this.beats.push({ foot: 'L', at: startAt - 2 * this.interval }, { foot: 'R', at: startAt - this.interval });
    this.schedule(startAt);
  }

  /** Milliseconds between footstrikes. */
  get interval(): number {
    return 60000 / this.cadence;
  }

  update(t: number): StepEvent[] {
    this.schedule(t);
    const events: StepEvent[] = [];
    for (const note of [...this.notes]) {
      if (t > note.at + this.windows.good) {
        note.grade = 'miss';
        events.push(this.finish(note));
      }
    }
    while (this.beats.length > 4 && this.beats[1].at < t - HISTORY_MS) this.beats.shift();
    return events;
  }

  press(foot: Foot, t: number): StepEvent[] {
    const note = this.notes.find((n) => n.foot === foot && Math.abs(t - n.at) <= this.windows.good);
    if (!note) {
      this.form = Math.max(0, this.form - STRAY_FORM_PENALTY);
      this.streak = 0;
      return [{ type: 'stray', foot }];
    }
    note.hitAt = t;
    note.grade = gradeOffset(t - note.at, this.windows);
    return [this.finish(note)];
  }

  /** Stride phase at t: 0 on a left footstrike beat, 0.5 on a right one. */
  phaseAt(t: number): number {
    const [b, n] = this.beatsAround(t);
    const frac = n ? Math.min(1, Math.max(0, (t - b.at) / (n.at - b.at))) : 0;
    return ((b.foot === 'L' ? 0 : 0.5) + frac * 0.5) % 1;
  }

  /** Time between the footstrikes around t (the cadence actually being run, through tempo changes). */
  stepIntervalAt(t: number): number {
    const [b, n] = this.beatsAround(t);
    return n ? n.at - b.at : this.interval;
  }

  private beatsAround(t: number): [{ foot: Foot; at: number }, { foot: Foot; at: number } | undefined] {
    let i = this.beats.length - 1;
    while (i > 0 && this.beats[i].at > t) i--;
    return [this.beats[i], this.beats[i + 1]];
  }

  private schedule(t: number): void {
    while (this.nextAt - this.lookaheadMs <= t) {
      const beat = { foot: this.nextFoot, at: this.nextAt };
      this.beats.push(beat);
      this.notes.push({ id: this.nextId++, ...beat, done: false });
      this.nextAt += this.interval;
      this.nextFoot = this.nextFoot === 'L' ? 'R' : 'L';
    }
  }

  private finish(note: StepNote): StepEvent {
    note.done = true;
    this.notes.splice(this.notes.indexOf(note), 1);
    const grade = note.grade ?? 'miss';
    this.form += (QUALITY[grade] - this.form) * FORM_SMOOTHING;
    this.streak = grade === 'miss' ? 0 : this.streak + 1;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    return { type: 'step', note };
  }
}
