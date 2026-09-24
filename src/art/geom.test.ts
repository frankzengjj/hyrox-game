import { describe, expect, it } from 'vitest';
import { solveTwoBone, vec } from './geom';

describe('solveTwoBone', () => {
  it('reaches a target within range with bones of the right length', () => {
    const root = vec(0, 0);
    const target = vec(20, 70);
    const { joint, end } = solveTwoBone(root, target, 48, 46, 1);
    expect(end.x).toBeCloseTo(target.x, 3);
    expect(end.y).toBeCloseTo(target.y, 3);
    expect(Math.hypot(joint.x - root.x, joint.y - root.y)).toBeCloseTo(48, 3);
    expect(Math.hypot(end.x - joint.x, end.y - joint.y)).toBeCloseTo(46, 3);
  });

  it('bends knees forward (+1) and elbows back (-1) for a limb hanging down', () => {
    const knee = solveTwoBone(vec(0, 0), vec(0, 80), 48, 46, 1).joint;
    const elbow = solveTwoBone(vec(0, 0), vec(0, 55), 35, 29, -1).joint;
    expect(knee.x).toBeGreaterThan(0);
    expect(elbow.x).toBeLessThan(0);
  });

  it('straightens towards a target out of reach', () => {
    const { end } = solveTwoBone(vec(0, 0), vec(0, 200), 48, 46, 1);
    expect(end.y).toBeCloseTo(94, 1);
    expect(end.x).toBeCloseTo(0, 1);
  });
});
