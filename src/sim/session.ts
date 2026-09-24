import { DIVISIONS, type Category, type DivisionId } from '../config/divisions';
import { ROXZONE_DISTANCE_M, RUN_DISTANCE_M } from '../config/race';
import { RUN_LOADS, STATIONS, type Loads } from '../config/stations';
import { Athlete } from './athlete';
import { runSpeed, stationRate } from './performance';
import { Race, type Segment } from './race';

/** One athlete's race: body + clock + progress through the current segment. */
export class Session {
  readonly athlete = new Athlete();
  readonly race = new Race();
  /** Metres or reps done in the current segment. */
  progress = 0;
  /** Progress per race second on the last step (m/s when moving). */
  rate = 0;
  /** Debug shortcuts were used (skip, fast-forward, autoplay), so the result doesn't count. */
  unofficial = false;

  constructor(
    readonly division: DivisionId,
    readonly category: Category,
  ) {}

  get segment(): Segment | undefined {
    return this.race.segment;
  }

  get target(): number {
    const segment = this.segment;
    if (!segment) return 0;
    if (segment.kind === 'run') return RUN_DISTANCE_M;
    if (segment.kind === 'roxzone') return ROXZONE_DISTANCE_M;
    return STATIONS[segment.index].target;
  }

  /**
   * Advance the current segment by dt race seconds at the given effort.
   * Returns true when this step completed the segment.
   */
  advance(dt: number, effort: number): boolean {
    const segment = this.segment;
    if (!segment) return false;

    const capacity = this.capacity;
    this.rate =
      segment.kind === 'station'
        ? stationRate(STATIONS[segment.index], this.difficulty, effort, capacity)
        : runSpeed(effort, capacity);

    // Stop the clock exactly at the line rather than at the end of the frame.
    const remaining = this.target - this.progress;
    const done = this.rate * dt >= remaining;
    const used = done ? remaining / this.rate : dt;

    this.tick(used, effort);
    this.progress = done ? this.target : this.progress + this.rate * used;

    if (done) this.completeSegment();
    return done;
  }

  /** Moves the clock and the body on by dt race seconds without adding work (rhythm stations score strokes separately). */
  tick(dt: number, effort: number): void {
    const segment = this.segment;
    if (!segment) return;
    this.athlete.update(dt, effort, this.loadsFor(segment), segment.kind === 'station' ? this.difficulty : 1);
    this.race.tick(dt);
  }

  /** Adds station work (m or reps). Returns true when it completes the segment. */
  addWork(amount: number): boolean {
    if (!this.segment) return false;
    this.progress = Math.min(this.target, this.progress + amount);
    if (this.progress < this.target) return false;
    this.completeSegment();
    return true;
  }

  /** Output multiplier for the current segment's muscles (fatigue, lactate, energy). */
  get capacity(): number {
    const segment = this.segment;
    return segment ? this.athlete.capacity(this.loadsFor(segment)) : 1;
  }

  get difficulty(): number {
    return DIVISIONS[this.division].difficulty;
  }

  /** Debug shortcut: ends the current segment now. */
  skipSegment(): void {
    this.unofficial = true;
    this.completeSegment();
  }

  private completeSegment(): void {
    this.race.completeSegment();
    this.progress = 0;
  }

  private loadsFor(segment: Segment): Loads {
    return segment.kind === 'station' ? STATIONS[segment.index].loads : RUN_LOADS;
  }
}
