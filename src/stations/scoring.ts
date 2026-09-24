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
/** Rowing: drive on the beat, finish, then a recovery twice as long as the drive (1:2). */
export const ROW_SHAPE: NoteShape = { press: 0, release: 0.33 };

export function scoreSkiErg(note: HoldNote, w: Windows): StrokeOutcome {
  return scoreStroke(note, w, { short: 'SHORT PULL', slow: 'SLOW RECOVERY' });
}

export function scoreRow(note: HoldNote, w: Windows): StrokeOutcome {
  return scoreStroke(note, w, { short: 'SHORT DRIVE', slow: 'LATE FINISH' });
}

/** Erg strokes: work scales with how cleanly the stroke was caught and finished. */
function scoreStroke(note: HoldNote, w: Windows, labels: { short: string; slow: string }): StrokeOutcome {
  if (note.pressedAt === undefined) return { grade: 'miss', quality: 0, rep: false, label: 'MISSED STROKE' };
  const pressQ = note.pressGrade === 'perfect' ? 1 : 0.8;
  const rel = note.releaseOffset;
  let releaseQ: number;
  let label: string | undefined;
  if (rel === undefined || rel > w.good) {
    releaseQ = 0.6;
    label = labels.slow;
  } else if (rel < -w.good) {
    const held = (note.releasedAt ?? note.pressedAt) - note.pressedAt;
    releaseQ = clamp(held / (note.end - note.start), 0.15, 0.75);
    label = labels.short;
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

/** Burpee broad jump: drop chest to the floor on the beat (press), jump (release) at the end of the bar. */
export const BURPEE_SHAPE: NoteShape = { press: 0, release: 0.45 };
/** Sandbag lunge: step and lower on the beat (press), drive up (release) once the knee is down. */
export const LUNGE_SHAPE: NoteShape = { press: 0, release: 0.5 };

export function scoreBurpee(note: HoldNote, w: Windows): StrokeOutcome {
  return scoreJudgedMove(note, w, 'CHEST NOT DOWN', 'SLOW JUMP');
}

export function scoreLunge(note: HoldNote, w: Windows): StrokeOutcome {
  return scoreJudgedMove(note, w, 'KNEE NOT DOWN', 'SLOW DRIVE');
}

/**
 * Moves a judge checks: coming up too early is a no-rep (no distance); coming up late still
 * counts but loses time.
 */
function scoreJudgedMove(note: HoldNote, w: Windows, noRep: string, slow: string): StrokeOutcome {
  if (note.pressedAt === undefined) return { grade: 'miss', quality: 0, rep: false, label: 'MISSED' };
  const rel = note.releaseOffset;
  if (rel !== undefined && rel < -w.good) return { grade: 'miss', quality: 0, rep: false, label: `NO REP · ${noRep}` };
  if (rel === undefined || rel > w.good) return { grade: 'good', quality: 0.6, rep: true, label: slow };
  const perfect = Math.abs(rel) <= w.perfect && note.pressGrade === 'perfect';
  return { grade: perfect ? 'perfect' : 'good', quality: perfect ? 1 : 0.85, rep: true, label: perfect ? 'PERFECT' : 'GOOD' };
}

/**
 * Sled momentum: builds with clean steps and collapses when you break rhythm, because
 * getting a heavy sled moving again from a standstill is slow.
 */
export class Momentum {
  static readonly START = 0.35;
  value = Momentum.START;

  record(grade: Grade): void {
    this.value =
      grade === 'miss'
        ? Math.max(Momentum.START, this.value - 0.35)
        : Math.min(1, this.value + (grade === 'perfect' ? 0.2 : 0.12));
  }

  stop(): void {
    this.value = Momentum.START;
  }
}

/**
 * Farmers carry grip: drains while carrying (faster with tired forearms and sloppy steps),
 * recovers while the bells are down. Run out and you drop them, and re-gripping costs time.
 */
export class Grip {
  /** Race seconds a fresh grip lasts while carrying. */
  static readonly HOLD_S = 70;
  /** Race seconds to recover fully with the bells down. */
  static readonly RECOVER_S = 18;
  static readonly MISS_COST = 0.04;
  /** Race seconds lost picking the bells back up after a drop. */
  static readonly REGRIP_S = 10;

  level = 1;
  /** Race seconds left re-gripping after a drop. */
  regrip = 0;

  /** Returns true on the frame the bells are dropped. */
  update(dt: number, carrying: boolean, gripFatigue: number): boolean {
    if (this.regrip > 0) {
      this.regrip = Math.max(0, this.regrip - dt);
      this.level = Math.min(1, this.level + dt / Grip.RECOVER_S);
      return false;
    }
    this.level = carrying
      ? this.level - (dt / Grip.HOLD_S) * (1 + gripFatigue)
      : Math.min(1, this.level + dt / Grip.RECOVER_S);
    if (this.level > 0) return false;
    this.level = 0;
    this.regrip = Grip.REGRIP_S;
    return true;
  }

  miss(): void {
    this.level = Math.max(0.001, this.level - Grip.MISS_COST);
  }

  get holding(): boolean {
    return this.regrip === 0;
  }
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
