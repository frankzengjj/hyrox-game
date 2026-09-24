import { BODY, HIP_HEIGHT } from './body';
import { type Vec, clamp, lerp, lerpVec, smooth, vec } from './geom';
import type { LimbTargets, Pose } from './rig';

const TAU = Math.PI * 2;
const ANKLE_Y = (floorY: number) => floorY - BODY.ankle;
const wrap = (p: number) => ((p % 1) + 1) % 1;

export function shoulderOf(hip: Vec, torso: number): Vec {
  return { x: hip.x + Math.sin(torso) * BODY.torso, y: hip.y - Math.cos(torso) * BODY.torso };
}

/** Point in the torso's frame: `forward` along the chest normal, `down` from the shoulder. */
function onTorso(hip: Vec, torso: number, forward: number, down: number): Vec {
  const s = shoulderOf(hip, torso);
  return { x: s.x + Math.cos(torso) * forward - Math.sin(torso) * down, y: s.y + Math.sin(torso) * forward + Math.cos(torso) * down };
}

/** Wrist position for an arm swinging from the shoulder (angles from vertical, + forward). */
function swingArm(shoulder: Vec, upperAngle: number, elbowBend: number): Vec {
  const elbow = vec(shoulder.x + Math.sin(upperAngle) * BODY.upperArm, shoulder.y + Math.cos(upperAngle) * BODY.upperArm);
  const f = upperAngle + elbowBend;
  return vec(elbow.x + Math.sin(f) * BODY.forearm, elbow.y + Math.cos(f) * BODY.forearm);
}

function lerpLimb(a: LimbTargets, b: LimbTargets, t: number): LimbTargets {
  return { hand: lerpVec(a.hand, b.hand, t), foot: lerpVec(a.foot, b.foot, t), footAngle: lerp(a.footAngle ?? 0, b.footAngle ?? 0, t) };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpVec(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    near: lerpLimb(a.near, b.near, t),
    far: lerpLimb(a.far, b.far, t),
  };
}

/** Pose relative to (0, floor): x offsets from the athlete's position, y above the floor (negative up). */
type RelPose = Pose;

function place(rel: RelPose, x: number, floorY: number): Pose {
  const at = (v: Vec) => vec(x + v.x, floorY + v.y);
  const limb = (l: LimbTargets): LimbTargets => ({ hand: at(l.hand), foot: at(l.foot), footAngle: l.footAngle });
  return { hip: at(rel.hip), torso: rel.torso, head: rel.head, near: limb(rel.near), far: limb(rel.far) };
}

/** Smoothly blends through keyframes at phase 0..1 (the last frame should match the first for loops). */
function keyframes(frames: [number, RelPose][], phase: number): RelPose {
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, a] = frames[i];
    const [t1, b] = frames[i + 1];
    if (phase <= t1) return lerpPose(a, b, smooth((phase - t0) / (t1 - t0)));
  }
  return frames[frames.length - 1][1];
}

// ---------------------------------------------------------------- standing

export function standPose(x: number, floorY: number, time = 0): Pose {
  const breathe = Math.sin(time * 2.2) * 1.2;
  const hip = vec(x, floorY - HIP_HEIGHT + 1);
  const torso = 0.03 + breathe * 0.004;
  const shoulder = shoulderOf(hip, torso);
  return {
    hip,
    torso,
    near: { hand: swingArm(shoulder, 0.1, 0.25), foot: vec(x - 5, ANKLE_Y(floorY)) },
    far: { hand: swingArm(shoulder, 0.02, 0.2), foot: vec(x + 6, ANKLE_Y(floorY)) },
  };
}

// ---------------------------------------------------------------- walking / running

export type Gait = 'walk' | 'run';

/** Stride cycles per second for a given screen speed (px/s). */
export function gaitFrequency(speed: number, gait: Gait): number {
  return gait === 'run' ? 1.25 + speed / 1400 : 0.7 + speed / 700;
}

interface GaitShape {
  stance: number;
  stride: number;
  lift: number;
  heelKick: number;
  /** Horizontal offset of the stance range from the hip (sled push drives from behind). */
  center: number;
}

function gaitFoot(p: number, g: GaitShape, x: number, floorY: number): { foot: Vec; footAngle: number } {
  const front = g.center + g.stride * 0.35;
  const back = front - g.stride;
  if (p < g.stance) {
    const u = p / g.stance;
    const roll = u > 0.7 ? (u - 0.7) / 0.3 : 0;
    const angle = roll * 0.6;
    return { foot: vec(x + lerp(front, back, u), ANKLE_Y(floorY) - Math.sin(angle) * 22), footAngle: angle };
  }
  const q = (p - g.stance) / (1 - g.stance);
  const dx = lerp(back, front, (1 - Math.cos(Math.PI * q)) / 2) - g.heelKick * Math.sin(Math.PI * q) * (1 - q);
  const dy = g.lift * Math.sin(Math.PI * Math.pow(q, 0.8));
  return { foot: vec(x + dx, ANKLE_Y(floorY) - Math.sin(0.6) * 22 * (1 - q) - dy), footAngle: lerp(0.6, -0.2, smooth(q)) };
}

/**
 * Walk or run cycle at `phase` (cycles), moving at `speed` px/s. The hip stays at x.
 * `frequency` (strides/s) overrides the natural cadence, e.g. to match a footstrike rhythm.
 */
export function locomotionPose(
  x: number,
  floorY: number,
  phase: number,
  speed: number,
  gait: Gait,
  frequency = gaitFrequency(speed, gait),
): Pose {
  const f = frequency;
  const run = gait === 'run';
  const stance = run ? clamp(0.42 - speed / 3000, 0.28, 0.42) : 0.62;
  const shape: GaitShape = {
    stance,
    stride: (speed * stance) / f,
    lift: run ? 18 + speed * 0.05 : 9,
    heelKick: run ? 10 + speed * 0.04 : 0,
    center: 0,
  };
  const p = wrap(phase);
  const near = gaitFoot(p, shape, x, floorY);
  const far = gaitFoot(wrap(p + 0.5), shape, x, floorY);

  const bob = (run ? 4 : 2) * Math.cos(TAU * 2 * (p - stance / 2));
  const hip = vec(x, floorY - HIP_HEIGHT + (run ? 7 : 2) + bob);
  const torso = run ? 0.1 + speed / 5000 : 0.04;
  const shoulder = shoulderOf(hip, torso);
  const swing = Math.cos(TAU * (p - 0.5));
  const amp = run ? 0.45 + speed / 1600 : 0.35;
  const bend = run ? 1.45 : 0.3;
  return {
    hip,
    torso,
    head: -torso * 0.5,
    near: { hand: swingArm(shoulder, swing * amp, bend), foot: near.foot, footAngle: near.footAngle },
    far: { hand: swingArm(shoulder, -swing * amp, bend), foot: far.foot, footAngle: far.footAngle },
  };
}

// ---------------------------------------------------------------- SkiErg

/** SkiErg stroke: pull 0 = tall with arms up at the handles, 1 = hinged with hands past the knees. */
export function skiErgPose(x: number, floorY: number, pull: number): Pose {
  const e = smooth(pull);
  const top: RelPose = {
    hip: vec(0, -HIP_HEIGHT + 2),
    torso: 0.06,
    head: -0.05,
    near: { hand: vec(40, -212), foot: vec(-4, -BODY.ankle) },
    far: { hand: vec(46, -208), foot: vec(8, -BODY.ankle) },
  };
  const bottom: RelPose = {
    hip: vec(-18, -84),
    torso: 0.95,
    head: -0.55,
    near: { hand: vec(22, -86), foot: vec(-4, -BODY.ankle) },
    far: { hand: vec(28, -84), foot: vec(8, -BODY.ankle) },
  };
  const pose = place(lerpPose(top, bottom, e), x, floorY);
  const bow = Math.sin(Math.PI * e) * 16;
  pose.near.hand.x += bow;
  pose.far.hand.x += bow;
  return pose;
}

// ---------------------------------------------------------------- Wall balls

/** Where the ball sits against the chest for a given hip/torso. */
export function wallBallChest(hip: Vec, torso: number): Vec {
  return onTorso(hip, torso, 24, 14);
}

/**
 * Wall ball: squat 0..1 (holding the ball at the chest), then extend 0..1 (drive up and
 * throw, arms overhead). Returns the pose plus where the ball is while held.
 */
export function wallBallPose(x: number, floorY: number, squat: number, extend: number): { pose: Pose; ball: Vec } {
  const s = smooth(squat);
  const hipStand = vec(x, floorY - HIP_HEIGHT + 3);
  const hipLow = vec(x - 18, floorY - 58);
  const hipToes = vec(x + 3, floorY - HIP_HEIGHT - 6);
  const e = smooth(extend);
  const hip = lerpVec(lerpVec(hipStand, hipLow, s), hipToes, e);
  const torso = lerp(lerp(0.05, 0.5, s), -0.06, e);
  const chest = wallBallChest(hip, torso);
  const overhead = vec(x + 34, floorY - 232);
  const ball = lerpVec(chest, overhead, e);
  const heel = e * 0.45;
  const lift = Math.sin(heel) * 22;
  return {
    ball,
    pose: {
      hip,
      torso,
      head: lerp(-s * 0.35, -0.25, e),
      near: { hand: vec(ball.x - 12, ball.y + 7), foot: vec(x - 10, ANKLE_Y(floorY) - lift), footAngle: heel },
      far: { hand: vec(ball.x - 6, ball.y + 3), foot: vec(x + 9, ANKLE_Y(floorY) - lift), footAngle: heel },
    },
  };
}

// ---------------------------------------------------------------- Rowing

/** Rower: x is the footplate; drive 0 = catch (knees up), 1 = finish (legs down, lean back, handle at chest). */
export function rowPose(x: number, floorY: number, drive: number): Pose {
  const legs = smooth(drive / 0.55);
  const back = smooth((drive - 0.3) / 0.45);
  const arms = smooth((drive - 0.55) / 0.45);
  const hip = vec(x - lerp(52, 92, legs), floorY - 44);
  const torso = lerp(0.5, -0.42, back);
  const reach = vec(x - 8, floorY - 78 + back * 4);
  const chest = onTorso(hip, torso, 20, 26);
  const hand = lerpVec(reach, chest, arms);
  const foot = vec(x, floorY - 30);
  return {
    hip,
    torso,
    head: -torso * 0.6,
    near: { hand, foot, footAngle: -0.75 },
    far: { hand: vec(hand.x + 5, hand.y - 2), foot: vec(x + 6, floorY - 30), footAngle: -0.75 },
  };
}

// ---------------------------------------------------------------- Sleds

/** Sled push: low, driving from behind the hips, hands on the poles. */
export function sledPushPose(x: number, floorY: number, phase: number, handles: Vec): Pose {
  const shape: GaitShape = { stance: 0.68, stride: 58, lift: 14, heelKick: 0, center: -28 };
  const p = wrap(phase);
  const near = gaitFoot(p, shape, x, floorY);
  const far = gaitFoot(wrap(p + 0.5), shape, x, floorY);
  const hip = vec(x, floorY - 82 + Math.cos(TAU * 2 * p) * 2);
  return {
    hip,
    torso: 1.0,
    head: -0.75,
    near: { hand: vec(handles.x, handles.y + 4), foot: near.foot, footAngle: near.footAngle },
    far: { hand: vec(handles.x + 4, handles.y), foot: far.foot, footAngle: far.footAngle },
  };
}

/** Sled pull: leaning back in a split stance, pulling the rope hand over hand. */
export function sledPullPose(x: number, floorY: number, phase: number): Pose {
  const hand = (p: number) => {
    const u = wrap(p);
    const pullOut = vec(x + 58, floorY - 126);
    const pullIn = vec(x + 2, floorY - 100);
    if (u < 0.55) return lerpVec(pullOut, pullIn, smooth(u / 0.55));
    const r = (u - 0.55) / 0.45;
    const v = lerpVec(pullIn, pullOut, smooth(r));
    return vec(v.x, v.y - Math.sin(Math.PI * r) * 14);
  };
  const lean = Math.sin(TAU * phase * 2) * 0.03;
  return {
    hip: vec(x - 8, floorY - 94),
    torso: -0.32 + lean,
    head: 0.3,
    near: { hand: hand(phase), foot: vec(x + 16, ANKLE_Y(floorY)), footAngle: -0.05 },
    far: { hand: hand(phase + 0.5), foot: vec(x - 26, ANKLE_Y(floorY)), footAngle: 0.1 },
  };
}

// ---------------------------------------------------------------- Burpee broad jump

const A = -BODY.ankle;
const BURPEE: [number, RelPose][] = [
  [0, { hip: vec(0, -HIP_HEIGHT + 1), torso: 0.05, near: { hand: vec(2, -104), foot: vec(-4, A) }, far: { hand: vec(8, -106), foot: vec(6, A) } }],
  [0.18, { hip: vec(-8, -56), torso: 1.0, head: -0.6, near: { hand: vec(36, -8), foot: vec(-4, A) }, far: { hand: vec(42, -8), foot: vec(6, A) } }],
  [0.34, { hip: vec(-52, -24), torso: 1.5, head: -1.1, near: { hand: vec(26, -8), foot: vec(-122, A), footAngle: 1.2 }, far: { hand: vec(32, -8), foot: vec(-118, A), footAngle: 1.2 } }],
  [0.5, { hip: vec(-8, -56), torso: 1.0, head: -0.6, near: { hand: vec(36, -8), foot: vec(-4, A) }, far: { hand: vec(42, -8), foot: vec(6, A) } }],
  [0.66, { hip: vec(48, -134), torso: 0.25, head: -0.2, near: { hand: vec(86, -196), foot: vec(34, -44), footAngle: 0.5 }, far: { hand: vec(92, -192), foot: vec(44, -40), footAngle: 0.5 } }],
  [0.8, { hip: vec(86, -60), torso: 0.7, head: -0.4, near: { hand: vec(122, -84), foot: vec(96, A) }, far: { hand: vec(128, -82), foot: vec(106, A) } }],
  [1, { hip: vec(100, -HIP_HEIGHT + 1), torso: 0.05, near: { hand: vec(102, -104), foot: vec(96, A) }, far: { hand: vec(108, -106), foot: vec(106, A) } }],
];
/** Horizontal distance covered by one burpee broad jump, px. */
export const BURPEE_JUMP = 100;

export function burpeePose(x: number, floorY: number, phase: number): Pose {
  return place(keyframes(BURPEE, clamp(phase, 0, 1)), x, floorY);
}

// ---------------------------------------------------------------- Farmers carry

export function farmersPose(x: number, floorY: number, phase: number, speed: number, frequency?: number): Pose {
  const walk = locomotionPose(x, floorY, phase, speed, 'walk', frequency);
  const hip = vec(walk.hip.x, walk.hip.y + 3);
  const shoulder = shoulderOf(hip, 0.02);
  const sway = Math.sin(TAU * phase) * 2;
  return {
    ...walk,
    hip,
    torso: 0.02,
    head: 0,
    near: { ...walk.near, hand: vec(shoulder.x + 4 + sway, shoulder.y + 61) },
    far: { ...walk.far, hand: vec(shoulder.x + 8 - sway, shoulder.y + 61) },
  };
}

// ---------------------------------------------------------------- Sandbag lunges

/** Distance covered by one lunge step, px. */
export const LUNGE_STEP = 72;

/** One walking lunge rep (phase 0..1) starting at x; the lead leg alternates each rep. */
export function lungePose(x: number, floorY: number, phase: number, leadNear: boolean): Pose {
  const L = LUNGE_STEP;
  const stand = (dx: number): [Vec, Vec] => [vec(dx - 3, A), vec(dx + 5, A)];
  const frames: [number, { hip: Vec; lead: Vec; trail: Vec; trailAngle: number }][] = [
    [0, { hip: vec(0, -HIP_HEIGHT + 1), lead: stand(0)[1], trail: stand(0)[0], trailAngle: 0 }],
    [0.3, { hip: vec(L * 0.45, -84), lead: vec(L, A), trail: vec(-4, A - 6), trailAngle: 0.5 }],
    [0.55, { hip: vec(L * 0.5, -58), lead: vec(L, A), trail: vec(-10, A - 12), trailAngle: 1.1 }],
    [0.8, { hip: vec(L * 0.85, -92), lead: vec(L, A), trail: vec(L * 0.55, A - 22), trailAngle: 0.4 }],
    [1, { hip: vec(L, -HIP_HEIGHT + 1), lead: stand(L)[1], trail: stand(L)[0], trailAngle: 0 }],
  ];
  const u = clamp(phase, 0, 1);
  let k = frames[frames.length - 1][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, a] = frames[i];
    const [t1, b] = frames[i + 1];
    if (u <= t1) {
      const t = smooth((u - t0) / (t1 - t0));
      k = { hip: lerpVec(a.hip, b.hip, t), lead: lerpVec(a.lead, b.lead, t), trail: lerpVec(a.trail, b.trail, t), trailAngle: lerp(a.trailAngle, b.trailAngle, t) };
      break;
    }
  }
  const hip = vec(x + k.hip.x, floorY + k.hip.y);
  const torso = 0.04;
  const shoulder = shoulderOf(hip, torso);
  const bagHand = vec(shoulder.x + 4, shoulder.y - 8);
  const lead: LimbTargets = { hand: bagHand, foot: vec(x + k.lead.x, floorY + k.lead.y) };
  const trail: LimbTargets = { hand: vec(bagHand.x - 6, bagHand.y + 2), foot: vec(x + k.trail.x, floorY + k.trail.y), footAngle: k.trailAngle };
  return { hip, torso, near: leadNear ? lead : trail, far: leadNear ? trail : lead };
}
