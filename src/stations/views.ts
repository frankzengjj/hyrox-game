import * as Phaser from 'phaser';
import { PX_PER_M } from '../art/body';
import { EQUIPMENT } from '../art/equipmentTextures';
import { type Vec, lerp, vec } from '../art/geom';
import {
  BURPEE_JUMP,
  LUNGE_STEP,
  burpeePose,
  farmersPose,
  lungePose,
  rowPose,
  skiErgPose,
  sledPullPose,
  sledPushPose,
  standPose,
  wallBallPose,
} from '../art/poses';
import type { StrokeOutcome } from './scoring';
import { AthleteRig } from '../art/rig';
import { STAGE } from '../art/stage';
import { type Venue, addShadow } from '../art/venue';

const FLOOR = STAGE.floorY;

/** Station driven by hold notes: animates from the button state, and reacts to each release. */
export interface HoldView {
  readonly x: number;
  update(now: number, dtMs: number, down: boolean, noteInterval: number): void;
  release?(now: number, noteInterval: number, outcome: StrokeOutcome | undefined): void;
  setMonitor?(metres: number, split: string): void;
}

/** Station driven by left/right taps: the limbs follow the step beats. */
export interface StepView {
  readonly x: number;
  /** `phase`: stride phase from the beats; `moving`: in a set (not resting or re-gripping). */
  update(state: { now: number; dtMs: number; phase: number; stepMs: number; moving: boolean; progress: number; metres: number }): void;
}

/** Eases a displayed value towards a target that moves in steps (work arrives per stroke). */
function follow(value: number, target: number, dtMs: number, ms = 160): number {
  return value + (target - value) * (1 - Math.exp(-dtMs / ms));
}

/** Moves `value` towards `target`, taking `ms` for a full 0→1 sweep. */
function approach(value: number, target: number, dtMs: number, ms: number): number {
  const step = dtMs / Math.max(ms, 1);
  return target > value ? Math.min(target, value + step) : Math.max(target, value - step);
}

function quad(a: Vec, c: Vec, b: Vec, t: number): Vec {
  const u = 1 - t;
  return vec(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y);
}

// ---------------------------------------------------------------- SkiErg

export class SkiErgView implements HoldView {
  static readonly X = 380;
  readonly x = SkiErgView.X;
  private readonly rig: AthleteRig;
  private readonly cords: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics];
  private readonly monitor: Phaser.GameObjects.Text;
  private readonly pulley: Vec;
  private pull = 0;

  constructor(scene: Phaser.Scene) {
    const x = SkiErgView.X;
    const machineX = x + 14;
    const { h, pulley, monitor } = EQUIPMENT.skierg;
    addShadow(scene, x + 40, 150);
    scene.add.image(machineX, FLOOR + 2, 'skierg').setOrigin(0, 1);
    this.pulley = vec(machineX + pulley.x, FLOOR + 2 - h + pulley.y);
    this.monitor = scene.add
      .text(machineX + monitor.x + monitor.w / 2, FLOOR + 2 - h + monitor.y + monitor.h / 2 + 1, '', {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '7px',
        color: '#1d2a1b',
        align: 'center',
        resolution: 3,
      })
      .setOrigin(0.5)
      .setRotation(-0.12);
    this.rig = new AthleteRig(scene);
    this.cords = [scene.add.graphics(), scene.add.graphics()];
    this.rig.layers.farHand.add(this.cords[0]);
    this.rig.layers.nearHand.add(this.cords[1]);
    this.update(0, 0, false, 600);
  }

  update(_now: number, dtMs: number, down: boolean, interval: number): void {
    this.pull = approach(this.pull, down ? 1 : 0, dtMs, down ? 0.42 * interval : 0.55 * interval);
    this.rig.setPose(skiErgPose(SkiErgView.X, FLOOR, this.pull));
    const { far, near } = this.rig.joints;
    [far, near].forEach((side, i) => {
      const g = this.cords[i].clear();
      g.lineStyle(1.5, 0x111111, 0.9).lineBetween(this.pulley.x, this.pulley.y + i * 8, side.grip.x, side.grip.y);
      g.fillStyle(0x1b1d22).fillRoundedRect(side.grip.x - 3, side.grip.y - 8, 6, 16, 3);
    });
  }

  setMonitor(metres: number, split: string): void {
    this.monitor.setText(`${Math.floor(metres)}m\n${split}`);
  }
}

// ---------------------------------------------------------------- Wall balls

interface Flight {
  start: number;
  up: number;
  down: number;
  from: Vec;
  peak: Vec;
  hit: boolean;
}

export class WallBallView implements HoldView {
  static readonly X = 540;
  readonly x = WallBallView.X;
  private readonly rig: AthleteRig;
  private readonly ball: Phaser.GameObjects.Image;
  private readonly target: Phaser.GameObjects.Image;
  private readonly targetPoint: Vec;
  private squat = 0;
  private extend = 0;
  private flight?: Flight;

  constructor(scene: Phaser.Scene, targetHeightM: number) {
    const rigX = WallBallView.X + 106;
    addShadow(scene, WallBallView.X, 80);
    scene.add.image(rigX, FLOOR + 2, 'wallball-rig').setOrigin(0, 1);
    this.targetPoint = vec(rigX + 36, FLOOR - targetHeightM * PX_PER_M);
    this.target = scene.add.image(this.targetPoint.x, this.targetPoint.y, 'wallball-target');
    this.rig = new AthleteRig(scene);
    this.ball = scene.add.image(0, 0, 'medball').setScale(0.9);
    this.update(0, 0, false, 600);
  }

  update(now: number, dtMs: number, down: boolean, interval: number): void {
    this.squat = approach(this.squat, down ? 1 : 0, dtMs, down ? 0.45 * interval : 90);
    this.extend = approach(this.extend, 0, dtMs, 260);
    const { pose, ball } = wallBallPose(WallBallView.X, FLOOR, this.squat, this.extend);
    this.rig.setPose(pose);

    const f = this.flight;
    if (!f) {
      this.ball.setPosition(ball.x, ball.y);
      return;
    }
    const t = now - f.start;
    if (t < f.up) {
      const p = quad(f.from, vec(f.from.x + 20, f.peak.y - 50), f.peak, t / f.up);
      this.ball.setPosition(p.x, p.y);
    } else if (t < f.up + f.down) {
      const p = quad(f.peak, vec(f.peak.x - 30, f.peak.y + 10), ball, (t - f.up) / f.down);
      this.ball.setPosition(p.x, p.y);
    } else {
      this.flight = undefined;
      this.ball.setPosition(ball.x, ball.y);
    }
    this.ball.setRotation(this.ball.rotation + dtMs * 0.004);
  }

  /** Release: drive up and throw. A good rep hits the target; a no-rep falls short. */
  release(now: number, interval: number, outcome: StrokeOutcome | undefined): void {
    const hit = !!outcome?.rep;
    this.extend = 1;
    this.squat = 0;
    const from = vec(WallBallView.X + 34, FLOOR - 236);
    const peak = hit ? vec(this.targetPoint.x - 16, this.targetPoint.y) : vec(this.targetPoint.x - 46, this.targetPoint.y + 70);
    this.flight = { start: now, up: Math.max(140, 0.28 * interval), down: Math.max(140, 0.27 * interval), from, peak, hit };
    if (hit) this.target.scene.tweens.add({ targets: this.target, scale: 1.25, duration: 70, yoyo: true, delay: this.flight.up - 40 });
  }
}

// ---------------------------------------------------------------- Rowing

export class RowView implements HoldView {
  /** Footplate position. */
  static readonly X = 470;
  readonly x = 400;
  private readonly rig: AthleteRig;
  private readonly seat: Phaser.GameObjects.Image;
  private readonly chain: Phaser.GameObjects.Graphics;
  private readonly monitor: Phaser.GameObjects.Text;
  private readonly rowerX = RowView.X - EQUIPMENT.rower.footplate.x;
  private drive = 0;

  constructor(scene: Phaser.Scene) {
    const { h, monitor } = EQUIPMENT.rower;
    addShadow(scene, RowView.X - 60, 300);
    scene.add.image(this.rowerX, FLOOR + 2, 'rower').setOrigin(0, 1);
    this.monitor = scene.add
      .text(this.rowerX + monitor.x + monitor.w / 2, FLOOR + 2 - h + monitor.y + monitor.h / 2 + 1, '', {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '7px',
        color: '#1d2a1b',
        align: 'center',
        resolution: 3,
      })
      .setOrigin(0.5);
    this.seat = scene.add.image(0, 0, 'rower-seat');
    this.rig = new AthleteRig(scene);
    this.chain = scene.add.graphics();
    this.rig.layers.nearHand.add(this.chain);
    this.update(0, 0, false, 1200);
  }

  update(_now: number, dtMs: number, down: boolean, interval: number): void {
    // Drive while held; the recovery back up the slide takes the rest of the stroke.
    this.drive = approach(this.drive, down ? 1 : 0, dtMs, down ? 0.33 * interval : 0.6 * interval);
    this.rig.setPose(rowPose(RowView.X, FLOOR, this.drive));
    const { hip, near } = this.rig.joints;
    const { h, railY, chainExit } = EQUIPMENT.rower;
    this.seat.setPosition(hip.x, FLOOR + 2 - h + railY(hip.x - this.rowerX) - 8);
    const exit = vec(this.rowerX + chainExit.x, FLOOR + 2 - h + chainExit.y);
    const g = this.chain.clear();
    g.lineStyle(1.5, 0x222222).lineBetween(exit.x, exit.y, near.grip.x, near.grip.y);
    g.fillStyle(0x1b1d22).fillRoundedRect(near.grip.x - 3, near.grip.y - 9, 6, 18, 3);
  }

  setMonitor(metres: number, split: string): void {
    this.monitor.setText(`${Math.floor(metres)}m\n${split}`);
  }
}

// ---------------------------------------------------------------- Burpee broad jumps and lunges

/** Plank position in the burpee cycle (chest on the floor). */
const BURPEE_DOWN = 0.34;
/** Bottom of the lunge (knee down). */
const LUNGE_DOWN = 0.55;

/**
 * Moves that go down while held and complete on release (burpee broad jump, lunge),
 * travelling forward one step per rep with the arena scrolling.
 */
abstract class TravellingMoveView implements HoldView {
  readonly x = 330;
  protected readonly rig: AthleteRig;
  protected p = 0;
  protected reps = 0;
  private finishing?: { start: number; from: number; duration: number };

  constructor(
    scene: Phaser.Scene,
    private readonly venue: Venue,
    private readonly bottom: number,
    private readonly stepPx: number,
  ) {
    this.rig = new AthleteRig(scene);
  }

  update(now: number, dtMs: number, down: boolean, interval: number): void {
    const f = this.finishing;
    if (f) {
      const t = Math.min(1, (now - f.start) / f.duration);
      this.p = lerp(f.from, 1, t);
      if (t >= 1) {
        this.finishing = undefined;
        this.reps++;
        this.p = 0;
      }
    } else if (down) {
      this.p = approach(this.p, this.bottom, dtMs, 0.45 * interval);
    } else {
      this.p = approach(this.p, 0, dtMs, 220);
    }
    this.venue.scroll((this.reps + this.p) * this.stepPx);
    this.draw();
  }

  release(now: number, interval: number): void {
    if (this.finishing || this.p < 0.05) return;
    this.finishing = { start: now, from: this.p, duration: 0.5 * interval };
  }

  protected abstract draw(): void;

  /** Pose origin so the body stays near the same screen spot while it travels. */
  protected get baseX(): number {
    return this.x - this.p * this.stepPx;
  }
}

export class BurpeeView extends TravellingMoveView {
  private readonly shadow: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, venue: Venue) {
    const shadow = addShadow(scene, 330);
    super(scene, venue, BURPEE_DOWN, BURPEE_JUMP);
    this.shadow = shadow;
    this.update(0, 0, false, 1200);
  }

  protected draw(): void {
    this.rig.setPose(burpeePose(this.baseX, FLOOR, this.p));
    this.shadow.setX(this.rig.joints.hip.x);
  }
}

export class LungeView extends TravellingMoveView {
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly bag: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, venue: Venue) {
    const shadow = addShadow(scene, 330);
    super(scene, venue, LUNGE_DOWN, LUNGE_STEP);
    this.shadow = shadow;
    this.bag = scene.add.graphics();
    this.rig.layers.behind.add(this.bag);
    this.update(0, 0, false, 1200);
  }

  protected draw(): void {
    this.rig.setPose(lungePose(this.baseX, FLOOR, this.p, this.reps % 2 === 0));
    this.shadow.setX(this.rig.joints.hip.x);
    const { neck } = this.rig.joints;
    const g = this.bag.clear();
    g.fillStyle(0x2d3226).fillEllipse(neck.x - 9, neck.y + 6, 30, 26);
    g.lineStyle(1, 0x000000, 0.6).strokeEllipse(neck.x - 9, neck.y + 6, 30, 26);
    g.fillStyle(0xffd400).fillRect(neck.x - 22, neck.y + 4, 26, 2);
  }
}

// ---------------------------------------------------------------- Sleds and farmers carry (steps)

export class SledPushView implements StepView {
  readonly x = 412;
  private readonly rig: AthleteRig;
  private readonly sled: Phaser.GameObjects.Image;
  private readonly turf: Phaser.GameObjects.TileSprite;
  private scroll = 0;
  private phase = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly venue: Venue,
  ) {
    this.turf = scene.add.tileSprite(0, FLOOR - 14, 960, 34, 'turf').setOrigin(0);
    addShadow(scene, 460, 170);
    this.sled = scene.add.image(470, FLOOR + 2, 'sled').setOrigin(0, 1);
    this.rig = new AthleteRig(scene);
    this.update({ now: 0, dtMs: 0, phase: 0, stepMs: 500, moving: false, progress: 0, metres: 0 });
  }

  update({ dtMs, phase, moving, metres }: Parameters<StepView['update']>[0]): void {
    this.scroll = follow(this.scroll, metres * PX_PER_M, dtMs);
    this.venue.scroll(this.scroll);
    this.turf.tilePositionX = this.scroll;
    if (moving) this.phase = phase;
    const { handles, h } = EQUIPMENT.sled;
    this.rig.setPose(sledPushPose(this.sled.x - 58, FLOOR, this.phase, vec(this.sled.x + handles.x, FLOOR + 2 - h + handles.y)));
  }
}

export class SledPullView implements StepView {
  readonly x = 200;
  private readonly rig: AthleteRig;
  private readonly sled: Phaser.GameObjects.Image;
  private readonly rope: Phaser.GameObjects.Graphics;
  private sledX = 700;
  private phase = 0;

  constructor(scene: Phaser.Scene) {
    scene.add.tileSprite(0, FLOOR - 14, 960, 34, 'turf').setOrigin(0);
    addShadow(scene, this.x, 80);
    this.sled = scene.add.image(this.sledX, FLOOR + 2, 'sled').setOrigin(0, 1).setFlipX(true);
    this.rig = new AthleteRig(scene);
    this.rope = scene.add.graphics();
    this.rig.layers.nearHand.add(this.rope);
    this.update({ now: 0, dtMs: 0, phase: 0, stepMs: 500, moving: false, progress: 0, metres: 0 });
  }

  update({ dtMs, phase, moving, progress }: Parameters<StepView['update']>[0]): void {
    this.sledX = follow(this.sledX, lerp(700, this.x + 110, progress), dtMs);
    this.sled.setX(this.sledX);
    if (moving) this.phase = phase;
    this.rig.setPose(sledPullPose(this.x, FLOOR, this.phase));
    const grip = this.rig.joints.near.grip;
    const g = this.rope.clear();
    g.lineStyle(3, 0xc8b88a).beginPath();
    g.moveTo(this.sledX + EQUIPMENT.sled.w - EQUIPMENT.sled.hitch.x, FLOOR - 22);
    g.lineTo(grip.x, grip.y);
    g.strokePath();
  }
}

export class FarmersView implements StepView {
  readonly x = 330;
  private readonly rig: AthleteRig;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly bells: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private scroll = 0;
  private speed = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly venue: Venue,
  ) {
    this.shadow = addShadow(scene, this.x);
    this.rig = new AthleteRig(scene);
    this.bells = [this.rig.layers.farHand, this.rig.layers.nearHand].map((layer) => {
      const bell = scene.add.image(0, 0, 'kettlebell').setOrigin(0.5, 0.2);
      layer.add(bell);
      return bell;
    }) as [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
    this.update({ now: 0, dtMs: 0, phase: 0, stepMs: 500, moving: false, progress: 0, metres: 0 });
  }

  update({ now, dtMs, phase, stepMs, moving, metres }: Parameters<StepView['update']>[0]): void {
    const before = this.scroll;
    this.scroll = follow(this.scroll, metres * PX_PER_M, dtMs);
    if (dtMs > 0) this.speed = follow(this.speed, ((this.scroll - before) * 1000) / dtMs, dtMs, 300);
    this.venue.scroll(this.scroll);
    if (moving) {
      this.rig.setPose(farmersPose(this.x, FLOOR, phase, Math.max(this.speed, 40), 500 / stepMs));
      const { near, far } = this.rig.joints;
      this.bells[0].setPosition(far.grip.x, far.grip.y);
      this.bells[1].setPosition(near.grip.x, near.grip.y);
    } else {
      // Resting or re-gripping: bells down on the floor either side.
      this.rig.setPose(standPose(this.x, FLOOR, now / 1000));
      this.bells[0].setPosition(this.x + 16, FLOOR - 37);
      this.bells[1].setPosition(this.x - 14, FLOOR - 37);
    }
    this.shadow.setX(this.rig.joints.hip.x);
  }
}
