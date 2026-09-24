export interface Vec {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Smooth 0→1 ease. */
export const smooth = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
/** Point at `length` along `angle` (radians, screen coords: 0 = right, +π/2 = down). */
export const polar = (origin: Vec, angle: number, length: number): Vec => ({
  x: origin.x + Math.cos(angle) * length,
  y: origin.y + Math.sin(angle) * length,
});

export interface TwoBone {
  /** Middle joint (knee / elbow). */
  joint: Vec;
  /** End effector actually reached (equals the target when in reach). */
  end: Vec;
  angle1: number;
  angle2: number;
}

/**
 * Two-bone inverse kinematics (law of cosines). `bend` picks which side the middle
 * joint goes: +1 bends anticlockwise-first (knees forward for a right-facing body),
 * -1 the other way (elbows back).
 */
export function solveTwoBone(root: Vec, target: Vec, len1: number, len2: number, bend: 1 | -1): TwoBone {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const dist = clamp(Math.hypot(dx, dy), Math.abs(len1 - len2) + 1e-3, len1 + len2 - 1e-3);
  const base = Math.atan2(dy, dx);
  const cos = clamp((len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist), -1, 1);
  const angle1 = base - bend * Math.acos(cos);
  const joint = polar(root, angle1, len1);
  const reach = polar(root, base, dist);
  const angle2 = Math.atan2(reach.y - joint.y, reach.x - joint.x);
  return { joint, end: polar(joint, angle2, len2), angle1, angle2 };
}
