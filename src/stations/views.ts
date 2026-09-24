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
import { AthleteRig } from '../art/rig';
import { STAGE } from '../art/stage';
import { type Venue, addShadow } from '../art/venue';
import type { StationId } from '../config/stations';

const FLOOR = STAGE.floorY;

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

export class SkiErgView {
  static readonly X = 380;
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
    this.update(0, false, 600);
  }

  update(dtMs: number, down: boolean, interval: number): void {
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

export class WallBallView {
  static readonly X = 540;
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
  throw(now: number, interval: number, hit: boolean): void {
    this.extend = 1;
    this.squat = 0;
    const from = vec(WallBallView.X + 34, FLOOR - 236);
    const peak = hit ? vec(this.targetPoint.x - 16, this.targetPoint.y) : vec(this.targetPoint.x - 46, this.targetPoint.y + 70);
    this.flight = { start: now, up: Math.max(140, 0.28 * interval), down: Math.max(140, 0.27 * interval), from, peak, hit };
    if (hit) this.target.scene.tweens.add({ targets: this.target, scale: 1.25, duration: 70, yoyo: true, delay: this.flight.up - 40 });
  }
}

// ---------------------------------------------------------------- Stations still on the hold-to-work mechanic

/** Visual metres covered per movement cycle (stride, pull, rep, stroke). */
const CYCLE_M: Partial<Record<StationId, number>> = {
  sledPush: 0.9,
  sledPull: 1.2,
  burpeeBroadJump: BURPEE_JUMP / PX_PER_M,
  row: 8,
  farmersCarry: 1.3,
  sandbagLunges: LUNGE_STEP / PX_PER_M,
};

/** Side-view animation for a station driven by distance covered (m, at 1× real-time speed). */
export class MovementView {
  private readonly rig: AthleteRig;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly props: Phaser.GameObjects.Image[] = [];
  private readonly extra: Phaser.GameObjects.Graphics;
  private turf?: Phaser.GameObjects.TileSprite;
  private sled?: Phaser.GameObjects.Image;
  private seat?: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private readonly id: StationId,
    private readonly venue: Venue,
  ) {
    if (id === 'sledPush' || id === 'sledPull') {
      this.turf = scene.add.tileSprite(0, FLOOR - 14, 960, 34, 'turf').setOrigin(0);
    }
    this.shadow = addShadow(scene, 0);
    if (id === 'sledPush') this.sled = scene.add.image(470, FLOOR + 2, 'sled').setOrigin(0, 1);
    if (id === 'sledPull') this.sled = scene.add.image(0, FLOOR + 2, 'sled').setOrigin(0, 1).setFlipX(true);
    if (id === 'row') {
      scene.add.image(470 - EQUIPMENT.rower.footplate.x, FLOOR + 2, 'rower').setOrigin(0, 1);
      this.seat = scene.add.image(0, 0, 'rower-seat');
    }
    this.rig = new AthleteRig(scene);
    this.extra = scene.add.graphics();
    if (id === 'farmersCarry') {
      for (const layer of [this.rig.layers.farHand, this.rig.layers.nearHand]) {
        const bell = scene.add.image(0, 0, 'kettlebell').setOrigin(0.5, 0.2);
        layer.add(bell);
        this.props.push(bell);
      }
    }
    if (id === 'sandbagLunges') this.rig.layers.behind.add(this.extra);
    if (id === 'row' || id === 'sledPull') this.rig.layers.nearHand.add(this.extra);
    this.update(0, 0, 0);
  }

  /** `metres`: visual distance covered; `t`: station progress 0..1; `time`: seconds (idle breathing). */
  update(metres: number, t: number, time: number): void {
    const cycles = metres / (CYCLE_M[this.id] ?? 1);
    const phase = cycles - Math.floor(cycles);
    const scroll = metres * PX_PER_M;
    const g = this.extra.clear();
    switch (this.id) {
      case 'sledPush': {
        this.venue.scroll(scroll);
        this.turf!.tilePositionX = scroll;
        const s = this.sled!;
        const handles = vec(s.x + EQUIPMENT.sled.handles.x, FLOOR + 2 - EQUIPMENT.sled.h + EQUIPMENT.sled.handles.y);
        this.pose(sledPushPose(s.x - 58, FLOOR, cycles, handles));
        this.shadow.setPosition(s.x - 10, FLOOR + 2).setSize(170, 12);
        break;
      }
      case 'sledPull': {
        const x = 200;
        const s = this.sled!.setX(lerp(700, x + 110, t));
        this.pose(sledPullPose(x, FLOOR, cycles));
        const grip = this.rig.joints.near.grip;
        g.lineStyle(3, 0xc8b88a).beginPath();
        g.moveTo(s.x + EQUIPMENT.sled.w - EQUIPMENT.sled.hitch.x, FLOOR - 22);
        g.lineTo(grip.x, grip.y);
        g.strokePath();
        this.shadow.setPosition(x, FLOOR + 2);
        break;
      }
      case 'burpeeBroadJump': {
        this.venue.scroll(scroll);
        this.pose(burpeePose(330 - phase * BURPEE_JUMP, FLOOR, phase));
        break;
      }
      case 'row': {
        const drive = phase < 0.4 ? phase / 0.4 : 1 - (phase - 0.4) / 0.6;
        this.pose(rowPose(470, FLOOR, metres > 0 ? drive : 0));
        const { hip, near } = this.rig.joints;
        const rowerX = 470 - EQUIPMENT.rower.footplate.x;
        this.seat!.setPosition(hip.x, FLOOR + 2 - EQUIPMENT.rower.h + EQUIPMENT.rower.railY(hip.x - rowerX) - 8);
        const exit = vec(rowerX + EQUIPMENT.rower.chainExit.x, FLOOR + 2 - EQUIPMENT.rower.h + EQUIPMENT.rower.chainExit.y);
        g.lineStyle(1.5, 0x222222).lineBetween(exit.x, exit.y, near.grip.x, near.grip.y);
        g.fillStyle(0x1b1d22).fillRoundedRect(near.grip.x - 3, near.grip.y - 9, 6, 18, 3);
        break;
      }
      case 'farmersCarry': {
        this.venue.scroll(scroll);
        const speed = 1.5 * PX_PER_M;
        this.pose(farmersPose(330, FLOOR, cycles, speed));
        const { near, far } = this.rig.joints;
        this.props[0].setPosition(far.grip.x, far.grip.y);
        this.props[1].setPosition(near.grip.x, near.grip.y);
        break;
      }
      case 'sandbagLunges': {
        this.venue.scroll(scroll);
        const rep = Math.floor(cycles);
        this.pose(lungePose(330 - phase * LUNGE_STEP, FLOOR, phase, rep % 2 === 0));
        const { neck } = this.rig.joints;
        g.fillStyle(0x2d3226).fillEllipse(neck.x - 9, neck.y + 6, 30, 26);
        g.lineStyle(1, 0x000000, 0.6).strokeEllipse(neck.x - 9, neck.y + 6, 30, 26);
        g.fillStyle(0xffd400).fillRect(neck.x - 22, neck.y + 4, 26, 2);
        break;
      }
      default:
        this.pose(standPose(330, FLOOR, time));
    }
  }

  private pose(pose: Parameters<AthleteRig['setPose']>[0]): void {
    this.rig.setPose(pose);
    if (this.id !== 'sledPush' && this.id !== 'sledPull') this.shadow.setPosition(this.rig.joints.hip.x, FLOOR + 2);
  }
}
