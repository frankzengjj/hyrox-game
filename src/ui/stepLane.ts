import * as Phaser from 'phaser';
import type { Grade } from '../sim/rhythm';
import type { Foot, StepTrack } from '../sim/steps';
import { COLORS, textStyle } from './theme';

const LEFT = 40;
const RIGHT = 740;
const Y = 478;
const H = 44;
const HIT_X = 130;
const ROW_Y: Record<Foot, number> = { L: Y - 10, R: Y + 10 };
const FOOT_COLORS: Record<Foot, number> = { L: 0x62b6ff, R: COLORS.accent };
const GRADE_COLORS: Record<Grade, number> = { perfect: COLORS.good, good: 0xffffff, miss: COLORS.bad };

/** Two-row footstrike highway: left foot on top, right foot below. */
export class StepLane {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly pxPerMs: number;

  constructor(
    private readonly scene: Phaser.Scene,
    lookaheadMs: number,
  ) {
    this.pxPerMs = (RIGHT - HIT_X) / lookaheadMs;
    scene.add.rectangle(LEFT, Y - H / 2, RIGHT - LEFT, H, 0x0b0c0f, 0.82).setOrigin(0).setStrokeStyle(1, COLORS.panelEdge);
    scene.add.text(LEFT + 8, ROW_Y.L, 'L  A ←', textStyle(10, '#9fd3ff')).setOrigin(0, 0.5);
    scene.add.text(LEFT + 8, ROW_Y.R, 'R  D →', textStyle(10, '#ffe680')).setOrigin(0, 0.5);
    scene.add
      .text(LEFT + 4, Y - H / 2 - 14, 'step on the beat: left foot = A / ← / left click · right foot = D / → / right click', textStyle(11, '#c9ccd2'))
      .setOrigin(0, 0);
    this.g = scene.add.graphics();
  }

  render(now: number, track: StepTrack, lactate: number): void {
    const g = this.g.clear();
    const fade = (RIGHT - HIT_X) * Phaser.Math.Clamp((lactate - 0.3) * 0.9, 0, 0.6);
    const alphaAt = (px: number) => (fade > 0 ? Phaser.Math.Clamp((px - HIT_X) / fade, 0, 1) : 1);
    g.fillStyle(0xffffff, 0.6).fillRect(HIT_X - 2, Y - H / 2 + 3, 4, H - 6);
    for (const note of track.notes) {
      const x = HIT_X + (note.at - now) * this.pxPerMs;
      if (x > RIGHT - 8) continue;
      const a = alphaAt(x);
      g.fillStyle(FOOT_COLORS[note.foot], a).fillCircle(x, ROW_Y[note.foot], 7);
      g.lineStyle(1.5, 0x000000, 0.6 * a).strokeCircle(x, ROW_Y[note.foot], 7);
    }
    if (fade > 0) g.fillStyle(0x7a0d10, 0.18).fillRect(HIT_X + 4, Y - H / 2 + 1, fade, H - 2);
  }

  flash(foot: Foot, grade: Grade): void {
    const ring = this.scene.add.circle(HIT_X, ROW_Y[foot], 8).setStrokeStyle(2.5, GRADE_COLORS[grade]);
    this.scene.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
  }
}
