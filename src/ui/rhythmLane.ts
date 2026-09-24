import * as Phaser from 'phaser';
import type { BeatTrack, Grade } from '../sim/rhythm';
import { COLORS, textStyle } from './theme';

const LEFT = 40;
const RIGHT = 740;
const Y = 478;
const H = 38;
const HIT_X = 130;

const GRADE_COLORS: Record<Grade, number> = { perfect: COLORS.good, good: 0xffffff, miss: COLORS.bad };

export interface LaneLabels {
  press: string;
  release: string;
}

/** The note highway: notes scroll right-to-left onto the hit line. */
export class RhythmLane {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly status: Phaser.GameObjects.Text;
  private readonly count: Phaser.GameObjects.Text;
  private readonly pxPerMs: number;

  constructor(
    private readonly scene: Phaser.Scene,
    labels: LaneLabels,
    lookaheadMs: number,
  ) {
    this.pxPerMs = (RIGHT - HIT_X) / lookaheadMs;
    this.scene.add.rectangle(LEFT, Y - H / 2, RIGHT - LEFT, H, 0x0b0c0f, 0.82).setOrigin(0).setStrokeStyle(1, COLORS.panelEdge);
    this.scene.add
      .text(LEFT + 4, Y - H / 2 - 16, `●  press: ${labels.press}      ◆  release: ${labels.release}`, textStyle(11, '#c9ccd2'))
      .setOrigin(0, 0);
    this.g = this.scene.add.graphics();
    this.status = this.scene.add.text((HIT_X + RIGHT) / 2, Y, '', textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    this.count = this.scene.add.text(HIT_X + 60, Y, '', textStyle(26, '#ffd400', { fontStyle: 'bold' })).setOrigin(0.5);
  }

  render(now: number, track: BeatTrack, lactate: number): void {
    const g = this.g.clear();
    const x = (t: number) => HIT_X + (t - now) * this.pxPerMs;
    // Tunnel vision: at high lactate the notes vanish before they reach the line.
    const fade = (RIGHT - HIT_X) * Phaser.Math.Clamp((lactate - 0.3) * 0.9, 0, 0.6);
    const alphaAt = (px: number) => (fade > 0 ? Phaser.Math.Clamp((px - HIT_X) / fade, 0, 1) : 1);

    // Hit line.
    g.fillStyle(track.isDown ? COLORS.accent : 0xffffff, track.isDown ? 0.95 : 0.6);
    g.fillRect(HIT_X - 2, Y - H / 2 + 3, 4, H - 6);

    for (const note of track.notes) {
      const xs = x(note.start);
      const xe = x(note.end);
      if (xs > RIGHT + 20) continue;
      const held = note === track.heldNote;
      const a = held ? 1 : alphaAt(xs);
      // Beat tick.
      g.fillStyle(0xffffff, 0.15 * alphaAt(x(note.beat)));
      g.fillRect(x(note.beat) - 0.5, Y - H / 2 + 2, 1, H - 4);
      // Hold bar, press head, release diamond.
      g.fillStyle(held ? COLORS.accent : 0x8b919c, (held ? 0.9 : 0.55) * a);
      g.fillRoundedRect(Math.min(xs, xe), Y - 5, Math.abs(xe - xs), 10, 5);
      g.fillStyle(held ? COLORS.accent : 0xffffff, a);
      g.fillCircle(xs, Y, 9);
      const ta = held ? 1 : alphaAt(xe);
      g.fillStyle(COLORS.accent, ta);
      g.fillTriangle(xe - 9, Y, xe, Y - 10, xe + 9, Y);
      g.fillTriangle(xe - 9, Y, xe, Y + 10, xe + 9, Y);
      g.lineStyle(1.5, 0x000000, 0.6 * ta);
      g.strokeTriangle(xe - 9, Y, xe, Y - 10, xe + 9, Y);
    }
    if (fade > 0) {
      g.fillStyle(0x7a0d10, 0.18);
      g.fillRect(HIT_X + 4, Y - H / 2 + 1, fade, H - 2);
    }

    const ticksLeft = track.countIn.filter((t) => t > now).length;
    this.count.setText(track.state === 'countIn' && ticksLeft > 0 ? String(ticksLeft) : '');
    const pulse = 0.55 + 0.45 * Math.sin(now / 180);
    this.status
      .setText(track.state === 'resting' ? 'SPACE / click to start a set' : '')
      .setAlpha(pulse);
  }

  /** Burst on the hit line for a judged note. */
  flash(grade: Grade): void {
    const ring = this.scene.add.circle(HIT_X, Y, 12).setStrokeStyle(3, GRADE_COLORS[grade]);
    this.scene.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
  }
}
