import * as Phaser from 'phaser';
import { type PartName, atlasKey, partOrigin } from './athleteTextures';
import { BODY } from './body';
import { type Vec, add, polar, solveTwoBone } from './geom';

export interface LimbTargets {
  /** Wrist target. */
  hand: Vec;
  /** Ankle target. */
  foot: Vec;
  /** Shoe rotation: 0 flat, + toe down, - toe up. */
  footAngle?: number;
}

/** A body position in scene coordinates. The rig solves elbows and knees to reach the targets. */
export interface Pose {
  hip: Vec;
  /** Torso angle from vertical, + leaning forward (right). */
  torso: number;
  /** Extra head tilt relative to the torso. */
  head?: number;
  near: LimbTargets;
  far: LimbTargets;
}

export interface SideJoints {
  knee: Vec;
  ankle: Vec;
  elbow: Vec;
  wrist: Vec;
  /** Middle of the fist: where handles, balls and kettlebells go. */
  grip: Vec;
  forearmAngle: number;
}

export interface Joints {
  hip: Vec;
  shoulder: Vec;
  neck: Vec;
  near: SideJoints;
  far: SideJoints;
}

/** Layers props can be added to, from back to front. */
export type RigLayer = 'behind' | 'farHand' | 'chest' | 'nearHand' | 'front';

/** Multiply tint that pushes the far-side limbs back into shade. */
const FAR_TINT = 0x8a8a8a;

interface LimbImages {
  thigh: Phaser.GameObjects.Image;
  shin: Phaser.GameObjects.Image;
  foot: Phaser.GameObjects.Image;
  upperArm: Phaser.GameObjects.Image;
  forearm: Phaser.GameObjects.Image;
}

/** Side-view athlete made of shaded cut-out parts, posed with IK (facing right). */
export class AthleteRig {
  readonly root: Phaser.GameObjects.Container;
  readonly layers: Record<RigLayer, Phaser.GameObjects.Container>;
  joints!: Joints;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly near: LimbImages;
  private readonly far: LimbImages;

  constructor(scene: Phaser.Scene, kitId = 'player') {
    const image = (part: PartName, far = false) => {
      const origin = partOrigin(kitId, part);
      const img = scene.add.image(0, 0, atlasKey(kitId), part).setOrigin(origin.x, origin.y);
      if (far) img.setTint(FAR_TINT);
      return img;
    };
    const limbs = (far: boolean): LimbImages => ({
      thigh: image('thigh', far),
      shin: image('shin', far),
      foot: image('foot', far),
      upperArm: image('upperArm', far),
      forearm: image('forearm', far),
    });
    const layer = () => scene.add.container();

    this.far = limbs(true);
    this.near = limbs(false);
    this.torso = image('torso');
    this.head = image('head');
    this.layers = { behind: layer(), farHand: layer(), chest: layer(), nearHand: layer(), front: layer() };

    this.root = scene.add.container(0, 0, [
      this.layers.behind,
      this.far.upperArm,
      this.far.forearm,
      this.layers.farHand,
      this.far.thigh,
      this.far.shin,
      this.far.foot,
      this.torso,
      this.head,
      this.layers.chest,
      this.near.thigh,
      this.near.shin,
      this.near.foot,
      this.near.upperArm,
      this.near.forearm,
      this.layers.nearHand,
      this.layers.front,
    ]);
  }

  setPose(pose: Pose): this {
    const up = { x: Math.sin(pose.torso), y: -Math.cos(pose.torso) };
    const shoulder = add(pose.hip, { x: up.x * BODY.torso, y: up.y * BODY.torso });
    const neck = add(pose.hip, { x: up.x * (BODY.torso + BODY.neck), y: up.y * (BODY.torso + BODY.neck) });

    this.torso.setPosition(pose.hip.x, pose.hip.y).setRotation(pose.torso);
    this.head.setPosition(neck.x, neck.y).setRotation(pose.torso + (pose.head ?? 0));

    this.joints = {
      hip: pose.hip,
      shoulder,
      neck,
      far: this.poseSide(this.far, pose.hip, shoulder, pose.far),
      near: this.poseSide(this.near, pose.hip, shoulder, pose.near),
    };
    return this;
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  private poseSide(images: LimbImages, hip: Vec, shoulder: Vec, target: LimbTargets): SideJoints {
    const leg = solveTwoBone(hip, target.foot, BODY.thigh, BODY.shin, 1);
    images.thigh.setPosition(hip.x, hip.y).setRotation(leg.angle1);
    images.shin.setPosition(leg.joint.x, leg.joint.y).setRotation(leg.angle2);
    images.foot.setPosition(leg.end.x, leg.end.y).setRotation(target.footAngle ?? 0);

    const arm = solveTwoBone(shoulder, target.hand, BODY.upperArm, BODY.forearm, -1);
    images.upperArm.setPosition(shoulder.x, shoulder.y).setRotation(arm.angle1);
    images.forearm.setPosition(arm.joint.x, arm.joint.y).setRotation(arm.angle2);

    return {
      knee: leg.joint,
      ankle: leg.end,
      elbow: arm.joint,
      wrist: arm.end,
      grip: polar(arm.end, arm.angle2, BODY.grip),
      forearmAngle: arm.angle2,
    };
  }
}
