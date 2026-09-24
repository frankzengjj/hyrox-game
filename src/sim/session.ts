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
  /** A segment was skipped (debug), so the result doesn't count. */
  skipped = false;

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

    const loads = this.loadsFor(segment);
    const capacity = this.athlete.capacity(loads);
    const difficulty = DIVISIONS[this.division].difficulty;
    this.rate =
      segment.kind === 'station'
        ? stationRate(STATIONS[segment.index], difficulty, effort, capacity)
        : runSpeed(effort, capacity);

    // Stop the clock exactly at the line rather than at the end of the frame.
    const remaining = this.target - this.progress;
    const done = this.rate * dt >= remaining;
    const used = done ? remaining / this.rate : dt;

    this.athlete.update(used, effort, loads, segment.kind === 'station' ? difficulty : 1);
    this.race.tick(used);
    this.progress = done ? this.target : this.progress + this.rate * used;

    if (done) this.completeSegment();
    return done;
  }

  /** Debug shortcut: ends the current segment now. */
  skipSegment(): void {
    this.skipped = true;
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
