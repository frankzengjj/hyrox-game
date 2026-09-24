import type { StationId } from '../config/stations';
import type { HoldNote, NoteShape, Windows } from '../sim/rhythm';
import {
  BURPEE_SHAPE,
  LUNGE_SHAPE,
  ROW_SHAPE,
  SKIERG_SHAPE,
  type StrokeOutcome,
  WALL_BALL_SHAPE,
  scoreBurpee,
  scoreLunge,
  scoreRow,
  scoreSkiErg,
  scoreWallBall,
} from './scoring';

const TEMPO_HINT = 'W / S: tempo   ·   stop to rest';

/** Hold notes: press on ●, release on ◆. */
export interface HoldRules {
  kind: 'hold';
  shape: NoteShape;
  score(note: HoldNote, windows: Windows): StrokeOutcome;
  /** Rep-based stations count one per good rep; others turn quality into metres. */
  repBased: boolean;
  /** Metronome beats per note: slow, big movements take two. */
  beatsPerNote: number;
  labels: { press: string; release: string };
  hint: string;
}

/** Alternating left/right taps (feet or hands). */
export interface StepRules {
  kind: 'steps';
  /** Taps per metronome beat. */
  stepsPerBeat: number;
  labels: { L: string; R: string; caption: string };
  /** Sleds: a missed step stalls the sled. */
  momentum?: boolean;
  /** Farmers carry: grip drains while carrying. */
  grip?: boolean;
  hint: string;
}

export type RhythmRules = HoldRules | StepRules;

const STEP_KEYS = 'A / D, ← / →, or left / right click';

export const RHYTHM_RULES: Record<StationId, RhythmRules> = {
  skierg: {
    kind: 'hold',
    shape: SKIERG_SHAPE,
    score: scoreSkiErg,
    repBased: false,
    beatsPerNote: 1,
    labels: { press: 'PULL on the beat', release: 'FINISH the pull' },
    hint: `SPACE / click: press on ●, release on ◆   ·   ${TEMPO_HINT}`,
  },
  sledPush: {
    kind: 'steps',
    stepsPerBeat: 1,
    momentum: true,
    labels: { L: 'L  A ←', R: 'R  D →', caption: `drive each step on the beat: ${STEP_KEYS} · missed steps stall the sled` },
    hint: `step on the beat: ${STEP_KEYS}   ·   ${TEMPO_HINT}`,
  },
  sledPull: {
    kind: 'steps',
    stepsPerBeat: 1,
    momentum: true,
    labels: { L: 'L hand', R: 'R hand', caption: `hand over hand on the beat: ${STEP_KEYS} · missed pulls stall the sled` },
    hint: `pull on the beat: ${STEP_KEYS}   ·   ${TEMPO_HINT}`,
  },
  burpeeBroadJump: {
    kind: 'hold',
    shape: BURPEE_SHAPE,
    score: scoreBurpee,
    repBased: false,
    beatsPerNote: 2,
    labels: { press: 'DROP chest to floor', release: 'JUMP' },
    hint: `SPACE / click: hold to drop, release to jump on ◆   ·   ${TEMPO_HINT}`,
  },
  row: {
    kind: 'hold',
    shape: ROW_SHAPE,
    score: scoreRow,
    repBased: false,
    beatsPerNote: 2,
    labels: { press: 'DRIVE on the beat', release: 'FINISH, then recover slowly' },
    hint: `SPACE / click: press on ●, release on ◆   ·   ${TEMPO_HINT}`,
  },
  farmersCarry: {
    kind: 'steps',
    stepsPerBeat: 1.25,
    grip: true,
    labels: { L: 'L  A ←', R: 'R  D →', caption: `walk on the beat: ${STEP_KEYS} · watch your grip, rest to recover it` },
    hint: `step on the beat: ${STEP_KEYS}   ·   ${TEMPO_HINT}`,
  },
  sandbagLunges: {
    kind: 'hold',
    shape: LUNGE_SHAPE,
    score: scoreLunge,
    repBased: false,
    beatsPerNote: 2,
    labels: { press: 'LOWER until the knee is down', release: 'DRIVE up' },
    hint: `SPACE / click: hold to lower, release to drive up on ◆   ·   ${TEMPO_HINT}`,
  },
  wallBalls: {
    kind: 'hold',
    shape: WALL_BALL_SHAPE,
    score: scoreWallBall,
    repBased: true,
    beatsPerNote: 1,
    labels: { press: 'SQUAT as the ball drops', release: 'THROW on the beat' },
    hint: `SPACE / click: hold to squat, release to throw on ◆   ·   ${TEMPO_HINT}`,
  },
};
