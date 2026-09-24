import { RUN_COUNT } from '../config/race';

export type Segment =
  | { kind: 'run'; index: number }
  | { kind: 'roxzone'; index: number; leg: 'in' | 'out' }
  | { kind: 'station'; index: number };

/** Run 1 → Roxzone → Station 1 → Roxzone → Run 2 → … → Station 8 (finish). */
export function buildSegments(): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < RUN_COUNT; i++) {
    segments.push({ kind: 'run', index: i });
    segments.push({ kind: 'roxzone', index: i, leg: 'in' });
    segments.push({ kind: 'station', index: i });
    if (i < RUN_COUNT - 1) segments.push({ kind: 'roxzone', index: i, leg: 'out' });
  }
  return segments;
}

export interface Split {
  segment: Segment;
  seconds: number;
}

export interface RaceSummary {
  runs: number[];
  stations: number[];
  roxzone: number;
  total: number;
}

/** Race clock and official splits. */
export class Race {
  readonly segments = buildSegments();
  readonly splits: Split[] = [];
  currentIndex = 0;
  /** Total race time in race seconds. */
  elapsed = 0;
  segmentElapsed = 0;

  get segment(): Segment | undefined {
    return this.segments[this.currentIndex];
  }

  get finished(): boolean {
    return this.currentIndex >= this.segments.length;
  }

  tick(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;
    this.segmentElapsed += dt;
  }

  completeSegment(): void {
    const segment = this.segment;
    if (!segment) return;
    this.splits.push({ segment, seconds: this.segmentElapsed });
    this.currentIndex++;
    this.segmentElapsed = 0;
  }

  summary(): RaceSummary {
    const runs: number[] = [];
    const stations: number[] = [];
    let roxzone = 0;
    for (const { segment, seconds } of this.splits) {
      if (segment.kind === 'run') runs[segment.index] = seconds;
      else if (segment.kind === 'station') stations[segment.index] = seconds;
      else roxzone += seconds;
    }
    return { runs, stations, roxzone, total: this.elapsed };
  }
}
