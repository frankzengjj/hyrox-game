import { describe, expect, it } from 'vitest';
import { BASE_WINDOWS, type HoldNote } from '../sim/rhythm';
import { Combo, Grip, Momentum, scoreBurpee, scoreLunge, scoreRow, scoreSkiErg, scoreWallBall } from './scoring';

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

describe('scoreBurpee / scoreLunge / scoreRow', () => {
  const pressed = { pressedAt: 1000, pressGrade: 'perfect' as const };

  it('no-reps coming up too early, and counts a slow finish at reduced quality', () => {
    expect(scoreBurpee(note({ ...pressed, releaseOffset: -200 }), BASE_WINDOWS)).toMatchObject({ rep: false, label: 'NO REP · CHEST NOT DOWN' });
    expect(scoreLunge(note({ ...pressed, releaseOffset: -200 }), BASE_WINDOWS)).toMatchObject({ rep: false, label: 'NO REP · KNEE NOT DOWN' });
    expect(scoreLunge(note({ ...pressed, releaseOffset: 250 }), BASE_WINDOWS)).toMatchObject({ rep: true, quality: 0.6, label: 'SLOW DRIVE' });
    expect(scoreBurpee(note({ ...pressed, releaseOffset: 10 }), BASE_WINDOWS)).toMatchObject({ grade: 'perfect', quality: 1 });
  });

  it('labels a short rowing drive', () => {
    expect(scoreRow(note({ ...pressed, releasedAt: 1100, releaseOffset: -150 }), BASE_WINDOWS).label).toBe('SHORT DRIVE');
  });
});

describe('Momentum', () => {
  it('builds with clean steps and collapses on a miss', () => {
    const m = new Momentum();
    for (let i = 0; i < 5; i++) m.record('perfect');
    expect(m.value).toBe(1);
    m.record('miss');
    expect(m.value).toBeCloseTo(0.65);
    m.stop();
    expect(m.value).toBe(Momentum.START);
  });
});

describe('Grip', () => {
  it('drains while carrying, faster with tired forearms, and recovers with the bells down', () => {
    const fresh = new Grip();
    const tired = new Grip();
    fresh.update(20, true, 0);
    tired.update(20, true, 0.5);
    expect(tired.level).toBeLessThan(fresh.level);
    const before = fresh.level;
    fresh.update(5, false, 0);
    expect(fresh.level).toBeGreaterThan(before);
  });

  it('drops the bells when grip runs out, then costs time to re-grip', () => {
    const g = new Grip();
    let dropped = false;
    for (let t = 0; t < 100 && !dropped; t++) dropped = g.update(1, true, 0);
    expect(dropped).toBe(true);
    expect(g.holding).toBe(false);
    g.update(Grip.REGRIP_S, true, 0);
    expect(g.holding).toBe(true);
    expect(g.level).toBeGreaterThan(0);
  });
});
