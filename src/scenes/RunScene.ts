import * as Phaser from 'phaser';
import { PX_PER_M } from '../art/body';
import { EQUIPMENT } from '../art/equipmentTextures';
import { gaitFrequency, locomotionPose } from '../art/poses';
import { AthleteRig } from '../art/rig';
import { STAGE } from '../art/stage';
import { type Venue, addShadow, addVenue } from '../art/venue';
import { LAPS_PER_RUN, RUN_COUNT, RUN_DISTANCE_M, TIME_SCALE } from '../config/race';
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

const LAP_M = RUN_DISTANCE_M / LAPS_PER_RUN;
/**
 * The camera plays at real-time speed while the race clock runs TIME_SCALE× faster,
 * so one race metre scrolls by PX_PER_M / TIME_SCALE px.
 */
const WORLD_PX_PER_M = PX_PER_M / TIME_SCALE;
const RUNNER_X = 300;

// Minimap: a small stadium track.
const MAP = { cx: 84, cy: 122, straight: 56, radius: 24 };
const MAP_PERIMETER = 2 * MAP.straight + 2 * Math.PI * MAP.radius;

/** Point on the minimap's lane, `s` px anticlockwise from the lap line (middle of the bottom straight). */
function mapPoint(s: number): { x: number; y: number } {
  const { cx, cy, straight, radius } = MAP;
  const half = straight / 2;
  const arc = Math.PI * radius;
  let d = ((s % MAP_PERIMETER) + MAP_PERIMETER) % MAP_PERIMETER;
  if (d < half) return { x: cx + d, y: cy + radius };
  d -= half;
  if (d < arc) {
    const a = Math.PI / 2 - d / radius;
    return { x: cx + half + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }
  d -= arc;
  if (d < straight) return { x: cx + half - d, y: cy - radius };
  d -= straight;
  if (d < arc) {
    const a = -Math.PI / 2 - d / radius;
    return { x: cx - half + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }
  return { x: cx - half + (d - arc), y: cy + radius };
}

/** Side-view 1 km run: 4 laps of the hall, the arena scrolling past. */
export class RunScene extends SegmentScene {
  private level = DEFAULT_RUN_LEVEL;
  private lastWheel = 0;
  private venue!: Venue;
  private rig!: AthleteRig;
  private shadow!: Phaser.GameObjects.Ellipse;
  private gates: Phaser.GameObjects.Image[] = [];
  private phase = 0;
  private scrollX = 0;
  private speedPx = 0;
  private mapDot!: Phaser.GameObjects.Arc;
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
    const segment = this.session.segment;
    const runIndex = segment?.kind === 'run' ? segment.index : 0;

    this.venue = addVenue(this);
    this.venue.setScreen(`RUN ${runIndex + 1}`, `${RUN_COUNT - runIndex - 1} to go after this one`);
    this.gates = [0, 1].map(() => this.add.image(0, STAGE.floorY + 6, 'lap-gate').setOrigin(0.5, 1));
    this.shadow = addShadow(this, RUNNER_X);
    this.rig = new AthleteRig(this);
    this.scrollX = this.session.progress * WORLD_PX_PER_M;
    this.phase = 0;
    this.speedPx = this.session.rate * PX_PER_M;

    this.drawInfoPanel();
    this.drawLevelSelector();

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
    this.render(0);
  }

  update(_time: number, delta: number): void {
    const surging = isHeld('ShiftLeft', 'ShiftRight');
    if (this.advance(delta, surging ? SURGE_EFFORT : RUN_LEVELS[this.level].effort)) return;
    this.surgeLabel.setAlpha(surging ? 1 : 0.25);
    this.levelBoxes.forEach(({ box, label }, i) => {
      const active = i === this.level && !surging;
      box.setFillStyle(active ? COLORS.accent : COLORS.panel, active ? 1 : 0.85);
      label.setColor(active ? '#000000' : '#f2f2f2');
    });
    this.render(delta);
  }

  private render(delta: number): void {
    const { progress, rate } = this.session;
    // The legs follow the floor's actual scroll speed, so feet never skate.
    const target = progress * WORLD_PX_PER_M;
    const dt = Math.min(delta, 100) / 1000;
    if (dt > 0) this.speedPx = Phaser.Math.Linear(this.speedPx, (target - this.scrollX) / dt, 0.15);
    this.scrollX = target;
    this.phase += dt * gaitFrequency(this.speedPx, 'run');

    this.venue.scroll(this.scrollX);
    this.rig.setPose(locomotionPose(RUNNER_X, STAGE.floorY, this.phase, Math.max(this.speedPx, 60), 'run'));
    this.shadow.setX(this.rig.joints.hip.x);

    // Lap gantries at every 250 m, placed in world space.
    const lapPx = LAP_M * WORLD_PX_PER_M;
    const nextLap = Math.floor(progress / LAP_M);
    this.gates.forEach((gate, i) => {
      const x = RUNNER_X + (nextLap + i) * lapPx - this.scrollX + EQUIPMENT.lapGate.w;
      gate.setX(x).setVisible(x > -60 && x < 1020);
    });

    const lap = Math.min(LAPS_PER_RUN, Math.floor(progress / LAP_M) + 1);
    const p = mapPoint(((progress % LAP_M) / LAP_M) * MAP_PERIMETER);
    this.mapDot.setPosition(p.x, p.y);
    this.lapText.setText(`LAP ${lap} / ${LAPS_PER_RUN}`);
    this.distanceText.setText(`${Math.floor(progress)} / ${RUN_DISTANCE_M} m`);
    this.paceText.setText(formatPace(rate));
  }

  private drawInfoPanel(): void {
    this.add.rectangle(16, 72, 270, 100, 0x0b0c0f, 0.78).setOrigin(0).setStrokeStyle(1, COLORS.panelEdge);
    const g = this.add.graphics();
    const { cx, cy, straight, radius } = MAP;
    g.lineStyle(9, COLORS.track);
    g.strokeRoundedRect(cx - straight / 2 - radius, cy - radius, straight + 2 * radius, 2 * radius, radius);
    g.fillStyle(COLORS.trackLine).fillRect(cx - 1, cy + radius - 5, 2, 10);
    this.mapDot = this.add.circle(0, 0, 5, COLORS.accent).setStrokeStyle(1.5, 0x000000);
    this.lapText = this.add.text(160, 82, '', textStyle(20, '#ffffff', { fontStyle: 'bold' }));
    this.distanceText = this.add.text(160, 110, '', textStyle(14, hex(COLORS.muted)));
    this.paceText = this.add.text(160, 132, '', textStyle(20, hex(COLORS.accent), { fontStyle: 'bold' }));
  }

  private drawLevelSelector(): void {
    const boxW = 66;
    const y = 482;
    const startX = 480 - ((RUN_LEVELS.length - 1) * (boxW + 6)) / 2 - 40;
    this.levelBoxes = RUN_LEVELS.map((lvl, i) => {
      const x = startX + i * (boxW + 6);
      const box = this.add.rectangle(x, y, boxW, 26, COLORS.panel, 0.85).setStrokeStyle(1, COLORS.panelEdge);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setLevel(i));
      const label = this.add.text(x, y, lvl.name, textStyle(13)).setOrigin(0.5);
      return { box, label };
    });
    this.surgeLabel = this.add
      .text(startX + RUN_LEVELS.length * (boxW + 6) + 12, y, 'SURGE', textStyle(14, hex(COLORS.bad), { fontStyle: 'bold' }))
      .setOrigin(0, 0.5);
  }

  private setLevel(level: number): void {
    this.level = Phaser.Math.Clamp(level, 0, RUN_LEVELS.length - 1);
    this.registry.set('runLevel', this.level);
  }
}
