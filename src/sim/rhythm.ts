/**
 * Rhythm engine for the stations. Every stroke or rep is a "hold note": press on its start,
 * release on its end. Times are milliseconds on one clock (performance.now / event.timeStamp).
 */

export type Grade = 'perfect' | 'good' | 'miss';

/** Half-widths of the timing windows, ms. */
export interface Windows {
  perfect: number;
  good: number;
}

export const BASE_WINDOWS: Windows = { perfect: 45, good: 105 };

export function gradeOffset(offsetMs: number, windows: Windows): Grade {
  const a = Math.abs(offsetMs);
  return a <= windows.perfect ? 'perfect' : a <= windows.good ? 'good' : 'miss';
}

/** Fatigue (capacity < 1) and heavier divisions tighten the windows: the challenge grows as you tire. */
export function windowsFor(capacity: number, difficulty: number): Windows {
  const scale = Math.min(1, Math.max(0.4, (0.5 + 0.5 * capacity) / difficulty));
  return { perfect: BASE_WINDOWS.perfect * scale, good: BASE_WINDOWS.good * scale };
}

/** Where a note's press and release fall relative to its beat, as fractions of the beat interval. */
export interface NoteShape {
  press: number;
  release: number;
  /** A press up to this fraction of the interval early still catches the note (graded good). */
  earlyPress?: number;
}

export interface HoldNote {
  id: number;
  beat: number;
  /** Press target. */
  start: number;
  /** Release target. */
  end: number;
  pressedAt?: number;
  pressGrade?: Grade;
  releasedAt?: number;
  /** releasedAt − end. Undefined when held past the release window. */
  releaseOffset?: number;
  done: boolean;
}

export type SetState = 'resting' | 'countIn' | 'active';

export interface TrackOptions {
  countInBeats: number;
  /** Notes are scheduled (and shown) this far ahead. */
  lookaheadMs: number;
  /** Missing this many notes in a row ends the set (the athlete stops to rest). */
  restAfterMisses: number;
}

export const DEFAULT_TRACK_OPTIONS: TrackOptions = { countInBeats: 3, lookaheadMs: 1800, restAfterMisses: 2 };

export type TrackEvent =
  | { type: 'note'; note: HoldNote }
  | { type: 'stray' }
  | { type: 'setStart' }
  | { type: 'setEnd' };

/**
 * A metronome-driven track of hold notes, organised in sets. The first press starts a set with a
 * count-in; stop playing and the set ends so the athlete can rest; press again for a new set.
 */
export class BeatTrack {
  state: SetState = 'resting';
  /** Upcoming and in-progress notes, oldest first. */
  readonly notes: HoldNote[] = [];
  /** Count-in tick times of the current set. */
  countIn: number[] = [];
  windows: Windows;
  private nextBeat = 0;
  private nextId = 1;
  private misses = 0;
  private down = false;
  private held?: HoldNote;

  constructor(
    public bpm: number,
    readonly shape: NoteShape,
    windows: Windows = BASE_WINDOWS,
    readonly options: TrackOptions = DEFAULT_TRACK_OPTIONS,
  ) {
    this.windows = windows;
  }

  get interval(): number {
    return 60000 / this.bpm;
  }

  get isDown(): boolean {
    return this.down;
  }

  /** The note currently being held, if the press caught one. */
  get heldNote(): HoldNote | undefined {
    return this.held;
  }

  press(t: number): TrackEvent[] {
    if (this.down) return [];
    this.down = true;
    if (this.state === 'resting') {
      this.startSet(t);
      return [{ type: 'setStart' }];
    }
    const early = Math.max(this.windows.good, (this.shape.earlyPress ?? 0) * this.interval);
    const note = this.notes.find(
      (n) => !n.done && n.pressedAt === undefined && t >= n.start - early && t <= n.start + this.windows.good,
    );
    if (!note) return this.state === 'active' ? [{ type: 'stray' }] : [];
    const offset = t - note.start;
    note.pressedAt = t;
    note.pressGrade = offset < -this.windows.good ? 'good' : gradeOffset(offset, this.windows);
    this.held = note;
    return [];
  }

  release(t: number): TrackEvent[] {
    if (!this.down) return [];
    this.down = false;
    const note = this.held;
    this.held = undefined;
    if (!note || note.done) return [];
    note.releasedAt = t;
    note.releaseOffset = t - note.end;
    return this.finish(note);
  }

  update(t: number): TrackEvent[] {
    if (this.state === 'resting') return [];
    if (this.state === 'countIn' && t >= this.countIn[this.countIn.length - 1]) this.state = 'active';

    while (this.nextBeat + this.shape.press * this.interval - this.options.lookaheadMs <= t) {
      const i = this.interval;
      this.notes.push({
        id: this.nextId++,
        beat: this.nextBeat,
        start: this.nextBeat + this.shape.press * i,
        end: this.nextBeat + this.shape.release * i,
        done: false,
      });
      this.nextBeat += i;
    }

    const events: TrackEvent[] = [];
    for (const note of [...this.notes]) {
      const unpressedTooLate = note.pressedAt === undefined && t > note.start + this.windows.good;
      const heldTooLong = note.pressedAt !== undefined && t > note.end + this.windows.good;
      if (!unpressedTooLate && !heldTooLong) continue;
      if (this.held === note) this.held = undefined;
      const finished = this.finish(note);
      events.push(...finished);
      if (finished.some((e) => e.type === 'setEnd')) break;
    }
    return events;
  }

  /** Ends the set immediately (station finished). */
  stop(): void {
    this.state = 'resting';
    this.notes.length = 0;
    this.countIn = [];
    this.held = undefined;
  }

  private startSet(t: number): void {
    const i = this.interval;
    this.state = 'countIn';
    this.misses = 0;
    this.notes.length = 0;
    this.countIn = Array.from({ length: this.options.countInBeats }, (_, k) => t + (k + 1) * i);
    this.nextBeat = t + (this.options.countInBeats + 1) * i;
  }

  private finish(note: HoldNote): TrackEvent[] {
    note.done = true;
    this.notes.splice(this.notes.indexOf(note), 1);
    const events: TrackEvent[] = [{ type: 'note', note }];
    this.misses = note.pressedAt === undefined ? this.misses + 1 : 0;
    if (this.misses >= this.options.restAfterMisses) {
      this.stop();
      events.push({ type: 'setEnd' });
    }
    return events;
  }
}
