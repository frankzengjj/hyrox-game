import * as Phaser from 'phaser';
import { DIVISIONS, WEIGHTS } from '../config/divisions';
import { STATIONS, type StationDef } from '../config/stations';
import { STATION_REST_EFFORT, STATION_WORK_EFFORT } from '../sim/performance';
import { isHeld } from '../ui/heldKeys';
import { COLORS, hex, textStyle } from '../ui/theme';
import { SegmentScene } from './SegmentScene';

const FLOOR = 380;
const LEFT = 60;
const RIGHT = 740;
const BAR_Y = 420;
/** Work animation cycles per real second. */
const CYCLE_HZ = 1.4;
const PROP = 0x4b5160;

interface Pose {
  x: number;
  /** 0 standing … 1 deep squat. */
  crouch?: number;
  /** Torso lean, + forwards (right). */
  lean?: number;
  hands: { x: number; y: number };
  /** Lift off the floor (jumps), px. */
  lift?: number;
  /** Seated (rower): hip height and where the feet are. */
  seat?: { hipY: number; feetX: number };
}

/**
 * Side-view station. For now every station shares one placeholder mechanic
 * (hold to work, release to rest); the real mini-games replace it station by station.
 */
export class StationScene extends SegmentScene {
  private def!: StationDef;
  private gfx!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private phase = 0;

  constructor() {
    super('Station');
  }

  create(): void {
    this.beginSegment('hold SPACE or mouse button to work   ·   release to rest and recover');
    const segment = this.session.segment;
    const index = segment?.kind === 'station' ? segment.index : 0;
    this.def = STATIONS[index];
    this.phase = 0;

    const weight = WEIGHTS[this.session.division][this.session.category][this.def.id];
    const spec = [`${this.def.target} ${this.def.unit}`, weight, DIVISIONS[this.session.division].name].filter(Boolean);

    this.add.text(LEFT, 92, this.def.name.toUpperCase(), textStyle(34, hex(COLORS.accent), { fontStyle: 'bold' }));
    this.add.text(LEFT, 142, spec.join('   ·   '), textStyle(16));
    this.add.text(LEFT, 166, 'Placeholder mechanic: the real mini-game comes in a later milestone.', textStyle(12, hex(COLORS.muted), { fontStyle: 'italic' }));

    this.statusText = this.add.text(RIGHT, 88, '', textStyle(16, '#ffffff', { fontStyle: 'bold' })).setOrigin(1, 0);
    this.progressText = this.add.text(RIGHT, BAR_Y - 24, '', textStyle(16)).setOrigin(1, 0);
    this.gfx = this.add.graphics();

    this.input.keyboard!.addCapture('SPACE');
  }

  update(_time: number, delta: number): void {
    const working = isHeld('Space') || this.input.activePointer.isDown;
    if (this.advance(delta, working ? STATION_WORK_EFFORT : STATION_REST_EFFORT)) return;
    if (working) this.phase += (Math.min(delta, 100) / 1000) * CYCLE_HZ * Math.PI * 2;

    const { progress } = this.session;
    const t = progress / this.def.target;
    const decimals = this.def.unit === 'reps' || this.def.target >= 200 ? 0 : 1;
    this.progressText.setText(`${progress.toFixed(decimals)} / ${this.def.target} ${this.def.unit}`);
    this.statusText.setText(working ? 'WORKING' : 'RESTING').setColor(working ? hex(COLORS.good) : hex(COLORS.muted));

    const g = this.gfx.clear();
    g.fillStyle(COLORS.floor).fillRect(LEFT - 20, FLOOR, RIGHT - LEFT + 40, 6);
    this.drawStation(g, t, Math.sin(this.phase));
    g.fillStyle(COLORS.panel).fillRect(LEFT, BAR_Y, RIGHT - LEFT, 20);
    g.fillStyle(COLORS.accent).fillRect(LEFT, BAR_Y, (RIGHT - LEFT) * t, 20);
    g.lineStyle(1, COLORS.panelEdge).strokeRect(LEFT, BAR_Y, RIGHT - LEFT, 20);
  }

  /** Station props plus the athlete, at progress t (0..1) and animation wave s (-1..1). */
  private drawStation(g: Phaser.GameObjects.Graphics, t: number, s: number): void {
    const up = (s + 1) / 2;
    const travel = (margin: number) => LEFT + 20 + t * (RIGHT - LEFT - margin);
    switch (this.def.id) {
      case 'skierg': {
        const mx = 440;
        g.fillStyle(PROP).fillRect(mx, FLOOR - 170, 22, 170);
        const handY = FLOOR - 150 + up * 80;
        g.lineStyle(2, 0x8b919c).lineBetween(mx + 2, FLOOR - 160, mx - 6, handY);
        this.drawFigure(g, { x: 400, crouch: up * 0.7, lean: 0.3 + up * 0.5, hands: { x: mx - 6, y: handY } });
        break;
      }
      case 'sledPush': {
        const x = travel(120);
        g.fillStyle(PROP).fillRect(x + 46, FLOOR - 40, 56, 40);
        g.lineStyle(4, 0x8b919c).lineBetween(x + 50, FLOOR - 40, x + 46, FLOOR - 78);
        this.drawFigure(g, { x: x + s * 2, crouch: 0.55, lean: 1.5, hands: { x: x + 46, y: FLOOR - 76 } });
        break;
      }
      case 'sledPull': {
        const ax = RIGHT - 20;
        const sx = LEFT + t * (ax - LEFT - 110);
        const hands = { x: ax - 32 - up * 16, y: FLOOR - 72 + up * 12 };
        g.fillStyle(PROP).fillRect(sx, FLOOR - 36, 56, 36);
        g.lineStyle(2, 0xc8b88a).lineBetween(sx + 56, FLOOR - 20, hands.x, hands.y);
        this.drawFigure(g, { x: ax, crouch: 0.3, lean: -0.9, hands });
        break;
      }
      case 'burpeeBroadJump': {
        const x = travel(60);
        const down = Math.max(0, -s);
        this.drawFigure(g, {
          x,
          crouch: down,
          lean: down * 1.8,
          hands: { x: x + 18 + down * 26, y: FLOOR - 62 + down * 58 },
          lift: Math.max(0, s) * 28,
        });
        break;
      }
      case 'row': {
        g.fillStyle(PROP).fillRect(330, FLOOR - 14, 250, 10);
        g.fillCircle(590, FLOOR - 30, 26);
        const hipX = 400 + up * 90;
        this.drawFigure(g, {
          x: hipX,
          lean: 0.9 - up * 1.4,
          hands: { x: 560 - up * 90 + 30, y: FLOOR - 58 },
          seat: { hipY: FLOOR - 24, feetX: 540 },
        });
        break;
      }
      case 'farmersCarry': {
        const x = travel(40);
        const bob = s * 2;
        g.fillStyle(PROP).fillRect(x - 2, FLOOR - 38 + bob, 16, 18);
        this.drawFigure(g, { x, lean: 0.05, hands: { x: x + 6, y: FLOOR - 40 + bob } });
        break;
      }
      case 'sandbagLunges': {
        const x = travel(40);
        const shoulders = { x: x + 1, y: FLOOR - 92 + up * 20 };
        g.fillStyle(0xa08e62).fillRoundedRect(shoulders.x - 18, shoulders.y - 10, 36, 14, 5);
        this.drawFigure(g, { x, crouch: up * 0.9, lean: 0.05, hands: { x: x + 10, y: shoulders.y } });
        break;
      }
      case 'wallBalls': {
        const wx = 600;
        g.fillStyle(PROP).fillRect(wx, FLOOR - 250, 24, 250);
        g.fillStyle(COLORS.accent).fillRect(wx - 6, FLOOR - 212, 6, 24);
        const squat = Math.max(0, -s);
        const flight = Math.max(0, s);
        const ball = flight > 0 ? { x: 510 + flight * 80, y: FLOOR - 100 - flight * 100 } : { x: 520, y: FLOOR - 92 + squat * 20 };
        this.drawFigure(g, { x: 480, crouch: squat, lean: 0.2, hands: flight > 0 ? { x: 500, y: FLOOR - 130 } : { x: ball.x - 6, y: ball.y } });
        g.fillStyle(0x8f6b4a).fillCircle(ball.x, ball.y, 11);
        break;
      }
    }
  }

  private drawFigure(g: Phaser.GameObjects.Graphics, pose: Pose): void {
    const crouch = pose.crouch ?? 0;
    const lean = pose.lean ?? 0;
    const lift = pose.lift ?? 0;
    const hipY = (pose.seat?.hipY ?? FLOOR - 52 + crouch * 22) - lift;
    const shoulder = { x: pose.x + lean * 20, y: hipY - 40 + Math.abs(lean) * 8 };

    g.lineStyle(7, COLORS.accent);
    if (pose.seat) {
      g.lineBetween(pose.x, hipY, (pose.x + pose.seat.feetX) / 2, hipY - 22);
      g.lineBetween((pose.x + pose.seat.feetX) / 2, hipY - 22, pose.seat.feetX, FLOOR - 8);
    } else {
      const stride = 12 + crouch * 10;
      g.lineBetween(pose.x, hipY, pose.x - stride, FLOOR - lift);
      g.lineBetween(pose.x, hipY, pose.x + stride, FLOOR - lift);
    }
    g.lineBetween(pose.x, hipY, shoulder.x, shoulder.y);
    g.lineStyle(5, COLORS.accent).lineBetween(shoulder.x, shoulder.y, pose.hands.x, pose.hands.y);
    g.fillStyle(COLORS.accent).fillCircle(shoulder.x + lean * 5, shoulder.y - 15, 11);
  }
}
