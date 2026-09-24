import type { StationId } from '../config/stations';
import type { HoldNote, NoteShape, Windows } from '../sim/rhythm';
import { SKIERG_SHAPE, type StrokeOutcome, WALL_BALL_SHAPE, scoreSkiErg, scoreWallBall } from './scoring';

export interface RhythmRules {
  shape: NoteShape;
  score(note: HoldNote, windows: Windows): StrokeOutcome;
  /** Rep-based stations count one per good rep; others turn stroke quality into metres. */
  repBased: boolean;
  labels: { press: string; release: string };
  hint: string;
}

/** Stations that already have their rhythm mini-game. The rest still use hold-to-work. */
export const RHYTHM_RULES: Partial<Record<StationId, RhythmRules>> = {
  skierg: {
    shape: SKIERG_SHAPE,
    score: scoreSkiErg,
    repBased: false,
    labels: { press: 'PULL on the beat', release: 'FINISH the pull' },
    hint: 'SPACE / click: press on ●, release on ◆   ·   W / S: tempo   ·   stop to rest',
  },
  wallBalls: {
    shape: WALL_BALL_SHAPE,
    score: scoreWallBall,
    repBased: true,
    labels: { press: 'SQUAT as the ball drops', release: 'THROW on the beat' },
    hint: 'SPACE / click: hold to squat, release to throw on ◆   ·   W / S: tempo   ·   stop to rest',
  },
};
