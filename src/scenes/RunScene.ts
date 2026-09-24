import * as Phaser from 'phaser';
import { LAPS_PER_RUN, RUN_DISTANCE_M } from '../config/race';
import { formatPace } from '../sim/format';
import { isHeld } from '../ui/heldKeys';
import { COLORS, hex, textStyle } from '../ui/theme';
import { SegmentScene } from './SegmentScene';

export const RUN_LEVELS = [
  { name: 'Walk', effort: 0.2 },
  { name: 'Easy', effort: 0.45 },
  { name: 'Steady', effort: 0.6 },
  { name: 'Tempo', effort: 0.75 },
  { name: 'Hard', effort: 0.88 },
] as const;
export const DEFAULT_RUN_LEVEL = 2;
const SURGE_EFFORT = 1;
const WHEEL_COOLDOWN_MS = 120;

// Stadium-shaped track, in px.
const CX = 380;
const CY = 290;
const STRAIGHT = 300;
const RADIUS = 115;
const LANE = 28;
const PERIMETER = 2 * STRAIGHT + 2 * Math.PI * RADIUS;
const LAP_M = RUN_DISTANCE_M / LAPS_PER_RUN;

/** Point on the lane's centre line, `s` px anticlockwise from the lap line (middle of the bottom straight). */
function trackPoint(s: number): { x: number; y: number } {
  const half = STRAIGHT / 2;
  const arc = Math.PI * RADIUS;
  let d = ((s % PERIMETER) + PERIMETER) % PERIMETER;
  if (d < half) return { x: CX + d, y: CY + RADIUS };
  d -= half;
  if (d < arc) {
    const a = Math.PI / 2 - d / RADIUS;
    return { x: CX + half + RADIUS * Math.cos(a), y: CY + RADIUS * Math.sin(a) };
  }
  d -= arc;
  if (d < STRAIGHT) return { x: CX + half - d, y: CY - RADIUS };
  d -= STRAIGHT;
  if (d < arc) {
    const a = -Math.PI / 2 - d / RADIUS;
    return { x: CX - half + RADIUS * Math.cos(a), y: CY + RADIUS * Math.sin(a) };
  }
  return { x: CX - half + (d - arc), y: CY + RADIUS };
}

/** Top-down 1 km run: 4 laps of the hall's track. */
export class RunScene extends SegmentScene {
  private level = DEFAULT_RUN_LEVEL;
  private lastWheel = 0;
  private runner!: Phaser.GameObjects.Arc;
  private lapText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private paceText!: Phaser.GameObjects.Text;
  private levelBoxes: { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private surgeLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Run');
  }

  create(): void {
    this.beginSegment('W / S or mouse wheel: set pace   ·   hold SHIFT: surge');
    this.level = (this.registry.get('runLevel') as number | undefined) ?? DEFAULT_RUN_LEVEL;

    this.drawTrack();
    this.runner = this.add.circle(0, 0, 9, COLORS.accent).setStrokeStyle(2, 0x000000);

    this.lapText = this.add.text(CX, CY - 72, '', textStyle(26, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    this.distanceText = this.add.text(CX, CY - 38, '', textStyle(16, hex(COLORS.muted))).setOrigin(0.5);
    this.paceText = this.add.text(CX, CY - 6, '', textStyle(22, hex(COLORS.accent))).setOrigin(0.5);

    const boxW = 64;
    const startX = CX - ((RUN_LEVELS.length - 1) * (boxW + 6)) / 2;
    this.levelBoxes = RUN_LEVELS.map((lvl, i) => {
      const x = startX + i * (boxW + 6);
      const box = this.add.rectangle(x, CY + 40, boxW, 26, COLORS.panel).setStrokeStyle(1, COLORS.panelEdge);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setLevel(i));
      const label = this.add.text(x, CY + 40, lvl.name, textStyle(13)).setOrigin(0.5);
      return { box, label };
    });
    this.surgeLabel = this.add.text(CX, CY + 72, 'SURGE', textStyle(14, hex(COLORS.bad), { fontStyle: 'bold' })).setOrigin(0.5);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    // Events rather than polling: a quick tap can go down and up within one frame.
    // Auto-repeat is ignored so a W still held from the Roxzone doesn't ramp the pace up.
    const onTap = (step: number) => (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      if (!event.repeat) this.setLevel(this.level + step);
    };
    for (const code of [K.W, K.UP]) kb.addKey(code).on('down', onTap(1));
    for (const code of [K.S, K.DOWN]) kb.addKey(code).on('down', onTap(-1));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.time.now - this.lastWheel < WHEEL_COOLDOWN_MS || dy === 0) return;
      this.lastWheel = this.time.now;
      this.setLevel(this.level + (dy < 0 ? 1 : -1));
    });
  }

  update(_time: number, delta: number): void {
    const surging = isHeld('ShiftLeft', 'ShiftRight');
    if (this.advance(delta, surging ? SURGE_EFFORT : RUN_LEVELS[this.level].effort)) return;

    const { progress, rate } = this.session;
    const lap = Math.min(LAPS_PER_RUN, Math.floor(progress / LAP_M) + 1);
    const pos = trackPoint(((progress % LAP_M) / LAP_M) * PERIMETER);
    this.runner.setPosition(pos.x, pos.y).setFillStyle(surging ? COLORS.bad : COLORS.accent);

    this.lapText.setText(`LAP ${lap} / ${LAPS_PER_RUN}`);
    this.distanceText.setText(`${Math.floor(progress)} / ${RUN_DISTANCE_M} m`);
    this.paceText.setText(formatPace(rate));
    this.levelBoxes.forEach(({ box, label }, i) => {
      const active = i === this.level && !surging;
      box.setFillStyle(active ? COLORS.accent : COLORS.panel);
      label.setColor(active ? '#000000' : '#f2f2f2');
    });
    this.surgeLabel.setAlpha(surging ? 1 : 0.25);
  }

  private setLevel(level: number): void {
    this.level = Phaser.Math.Clamp(level, 0, RUN_LEVELS.length - 1);
    this.registry.set('runLevel', this.level);
  }

  private drawTrack(): void {
    const g = this.add.graphics();
    const outer = RADIUS + LANE / 2;
    const inner = RADIUS - LANE / 2;
    g.fillStyle(COLORS.track);
    g.fillRoundedRect(CX - STRAIGHT / 2 - outer, CY - outer, STRAIGHT + 2 * outer, 2 * outer, outer);
    g.fillStyle(COLORS.infield);
    g.fillRoundedRect(CX - STRAIGHT / 2 - inner, CY - inner, STRAIGHT + 2 * inner, 2 * inner, inner);

    // Lap line / timing mat.
    g.fillStyle(COLORS.trackLine);
    g.fillRect(CX - 2, CY + inner, 4, LANE);
    this.add.text(CX, CY + outer + 12, 'LAP COUNTER', textStyle(11, hex(COLORS.muted))).setOrigin(0.5);
    this.add
      .text(CX + STRAIGHT / 2 + outer + 16, CY, 'ROXZONE\n(after lap 4)', textStyle(12, hex(COLORS.muted), { align: 'left' }))
      .setOrigin(0, 0.5);
  }
}
