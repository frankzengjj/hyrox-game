import type { Grade, HoldNote, NoteShape, Windows } from '../sim/rhythm';

export interface StrokeOutcome {
  grade: Grade;
  /** Share of a full stroke's work, 0..1. */
  quality: number;
  /** Counts as a rep (judged stations such as wall balls). */
  rep: boolean;
  label: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** SkiErg: catch the handles on the beat (press), finish the pull (release) at the end of the bar. */
export const SKIERG_SHAPE: NoteShape = { press: 0, release: 0.42 };

export function scoreSkiErg(note: HoldNote, w: Windows): StrokeOutcome {
  if (note.pressedAt === undefined) return { grade: 'miss', quality: 0, rep: false, label: 'MISSED STROKE' };
  const pressQ = note.pressGrade === 'perfect' ? 1 : 0.8;
  const rel = note.releaseOffset;
  let releaseQ: number;
  let label: string | undefined;
  if (rel === undefined || rel > w.good) {
    releaseQ = 0.6;
    label = 'SLOW RECOVERY';
  } else if (rel < -w.good) {
    const held = (note.releasedAt ?? note.pressedAt) - note.pressedAt;
    releaseQ = clamp(held / (note.end - note.start), 0.15, 0.75);
    label = 'SHORT PULL';
  } else {
    releaseQ = Math.abs(rel) <= w.perfect ? 1 : 0.85;
  }
  const quality = pressQ * releaseQ;
  const grade: Grade = quality >= 0.95 ? 'perfect' : quality >= 0.45 ? 'good' : 'miss';
  return { grade, quality, rep: grade !== 'miss', label: label ?? (grade === 'perfect' ? 'PERFECT' : 'GOOD') };
}

/**
 * Wall balls: drop into the squat (press) as the ball comes down, drive up and throw (release)
 * on the beat. Release early and you never reached depth; release late and the ball falls short.
 */
export const WALL_BALL_SHAPE: NoteShape = { press: -0.45, release: 0, earlyPress: 0.3 };

export function scoreWallBall(note: HoldNote, w: Windows): StrokeOutcome {
  const noRep = (label: string): StrokeOutcome => ({ grade: 'miss', quality: 0, rep: false, label: `NO REP · ${label}` });
  if (note.pressedAt === undefined) return noRep('MISSED CATCH');
  const rel = note.releaseOffset;
  if (rel === undefined || rel > w.good) return noRep('BELOW TARGET');
  if (rel < -w.good) return noRep('NOT DEEP ENOUGH');
  const perfect = Math.abs(rel) <= w.perfect && note.pressGrade === 'perfect';
  return { grade: perfect ? 'perfect' : 'good', quality: 1, rep: true, label: perfect ? 'PERFECT' : 'GOOD REP' };
}

/** Consecutive clean strokes. A long streak puts the athlete in "flow": the same work for less effort. */
export class Combo {
  count = 0;
  best = 0;

  static readonly FLOW_AT = 8;

  record(outcome: StrokeOutcome): void {
    this.count = outcome.grade === 'miss' ? 0 : this.count + 1;
    this.best = Math.max(this.best, this.count);
  }

  breakStreak(): void {
    this.count = 0;
  }

  get inFlow(): boolean {
    return this.count >= Combo.FLOW_AT;
  }
}
