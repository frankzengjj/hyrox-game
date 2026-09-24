import { describe, expect, it } from 'vitest';
import { BASE_WINDOWS, type HoldNote } from '../sim/rhythm';
import { Combo, scoreSkiErg, scoreWallBall } from './scoring';

const note = (fields: Partial<HoldNote>): HoldNote => ({ id: 1, beat: 1000, start: 1000, end: 1250, done: true, ...fields });

describe('scoreSkiErg', () => {
  it('gives full work for a perfect stroke', () => {
    const out = scoreSkiErg(note({ pressedAt: 1000, pressGrade: 'perfect', releasedAt: 1250, releaseOffset: 0 }), BASE_WINDOWS);
    expect(out).toMatchObject({ grade: 'perfect', quality: 1, label: 'PERFECT' });
  });

  it('scales down a short pull by how much of the drive was held', () => {
    const out = scoreSkiErg(note({ pressedAt: 1000, pressGrade: 'perfect', releasedAt: 1100, releaseOffset: -150 }), BASE_WINDOWS);
    expect(out.label).toBe('SHORT PULL');
    expect(out.quality).toBeCloseTo(0.4);
  });

  it('gives nothing for a missed stroke', () => {
    expect(scoreSkiErg(note({}), BASE_WINDOWS)).toMatchObject({ grade: 'miss', quality: 0 });
  });
});

describe('scoreWallBall', () => {
  const pressed = { pressedAt: 800, pressGrade: 'perfect' as const };

  it('counts a rep thrown on the beat', () => {
    expect(scoreWallBall(note({ ...pressed, releasedAt: 1260, releaseOffset: 10 }), BASE_WINDOWS)).toMatchObject({ rep: true, grade: 'perfect' });
  });

  it('no-reps a rushed throw (not deep enough) and a late one (below target)', () => {
    expect(scoreWallBall(note({ ...pressed, releaseOffset: -200 }), BASE_WINDOWS).label).toBe('NO REP · NOT DEEP ENOUGH');
    expect(scoreWallBall(note({ ...pressed, releaseOffset: 200 }), BASE_WINDOWS).label).toBe('NO REP · BELOW TARGET');
    expect(scoreWallBall(note({}), BASE_WINDOWS).rep).toBe(false);
  });
});

describe('Combo', () => {
  it('builds flow on a clean streak and resets on a miss', () => {
    const combo = new Combo();
    const good = { grade: 'good' as const, quality: 0.85, rep: true, label: '' };
    for (let i = 0; i < Combo.FLOW_AT; i++) combo.record(good);
    expect(combo.inFlow).toBe(true);
    combo.record({ ...good, grade: 'miss' });
    expect(combo.count).toBe(0);
    expect(combo.best).toBe(Combo.FLOW_AT);
  });
});
