import * as Phaser from 'phaser';
import {
  burpeePose,
  farmersPose,
  locomotionPose,
  lungePose,
  rowPose,
  skiErgPose,
  sledPullPose,
  sledPushPose,
  standPose,
  wallBallPose,
} from '../art/poses';
import { AthleteRig } from '../art/rig';
import { vec } from '../art/geom';
import type { Pose } from '../art/rig';
import { textStyle } from '../ui/theme';

type PoseAt = (x: number, floorY: number, t: number) => Pose;

/** Debug view (`?debug&gallery`): every pose, animated, for checking the rig. */
export class GalleryScene extends Phaser.Scene {
  private entries: { rig: AthleteRig; x: number; floorY: number; pose: PoseAt; offset: number }[] = [];
  private frozen?: number;

  constructor() {
    super('Gallery');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#3a3d44');
    const params = new URLSearchParams(window.location.search);
    this.frozen = params.has('t') ? Number(params.get('t')) : undefined;
    const poses: [string, PoseAt][] = [
      ['stand', (x, f, t) => standPose(x, f, t)],
      ['walk', (x, f, t) => locomotionPose(x, f, t * 0.9, 150, 'walk')],
      ['jog', (x, f, t) => locomotionPose(x, f, t * 1.5, 330, 'run')],
      ['sprint', (x, f, t) => locomotionPose(x, f, t * 1.65, 560, 'run')],
      ['skierg', (x, f, t) => skiErgPose(x, f, (Math.sin(t * 3) + 1) / 2)],
      ['wall ball', (x, f, t) => wallBallPose(x, f, Math.max(0, Math.sin(t * 3)), Math.max(0, -Math.sin(t * 3))).pose],
      ['row', (x, f, t) => rowPose(x + 60, f, (Math.sin(t * 2.5) + 1) / 2)],
      ['sled push', (x, f, t) => sledPushPose(x, f, t, vec(x + 62, f - 118))],
      ['sled pull', (x, f, t) => sledPullPose(x, f, t * 0.8)],
      ['burpee', (x, f, t) => burpeePose(x - 40, f, (t * 0.4) % 1)],
      ['farmers', (x, f, t) => farmersPose(x, f, t * 0.9, 140)],
      ['lunge', (x, f, t) => lungePose(x - 36, f, (t * 0.5) % 1, true)],
    ];
    // `&strip=<name>`: one pose at 8 points of its cycle (period in seconds via `&period=`).
    const strip = poses.find(([name]) => name === params.get('strip'));
    if (strip) {
      const period = Number(params.get('period')) || 1;
      for (let i = 0; i < 8; i++) this.addEntry(strip[0], strip[1], 70 + i * 118, 330, (i / 8) * period);
      return;
    }
    poses.forEach(([name, pose], i) => this.addEntry(name, pose, 80 + (i % 6) * 160, 250 + Math.floor(i / 6) * 265, 0));
  }

  update(time: number): void {
    const t = this.frozen ?? time / 1000;
    for (const { rig, x, floorY, pose, offset } of this.entries) rig.setPose(pose(x, floorY, t + offset));
  }

  private addEntry(name: string, pose: PoseAt, x: number, floorY: number, offset: number): void {
    this.add.rectangle(x - 60, floorY, 130, 2, 0x111111).setOrigin(0, 0);
    this.add.text(x - 50, floorY + 6, offset ? `+${offset.toFixed(2)}s` : name, textStyle(12));
    this.entries.push({ rig: new AthleteRig(this), x, floorY, pose, offset });
  }
}
