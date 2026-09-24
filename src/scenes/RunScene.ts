import * as Phaser from 'phaser';
import { PX_PER_M } from '../art/body';
import { EQUIPMENT } from '../art/equipmentTextures';
import { locomotionPose } from '../art/poses';
import { AthleteRig } from '../art/rig';
import { STAGE } from '../art/stage';
import { type Venue, addShadow, addStrainOverlay, addVenue } from '../art/venue';
import { footstep, scuff } from '../audio';
import { LAPS_PER_RUN, RUN_COUNT, RUN_DISTANCE_M, TIME_SCALE } from '../config/race';
import { formatPace } from '../sim/format';
import { STRIDE_FLOW_AT, STRIDE_FLOW_SAVING, formSpeed, formWaste } from '../sim/performance';
import { windowsFor } from '../sim/rhythm';
import { type Foot, type StepEvent, StepTrack } from '../sim/steps';
import { isHeld } from '../ui/heldKeys';
import { popup } from '../ui/popup';
import { StepInput } from '../ui/stepInput';
import { StepLane } from '../ui/stepLane';
import { COLORS, hex, textStyle } from '../ui/theme';
import { AUTOPLAY } from './flow';
import { SegmentScene } from './SegmentScene';

/** Pace levels: effort, and the footstrike cadence (steps/min) you tap to. */
export const RUN_LEVELS = [
  { name: 'Walk', effort: 0.2, cadence: 112 },
  { name: 'Easy', effort: 0.45, cadence: 150 },
  { name: 'Steady', effort: 0.6, cadence: 160 },
  { name: 'Tempo', effort: 0.75, cadence: 170 },
  { name: 'Hard', effort: 0.88, cadence: 178 },
] as const;
export const DEFAULT_RUN_LEVEL = 2;
const SURGE = { effort: 1, cadence: 188 };
const WHEEL_COOLDOWN_MS = 120;
const LEAD_IN_MS = 1200;
const LOOKAHEAD_MS = 1500;
const START_FORM = 0.85;

const LAP_M = RUN_DISTANCE_M / LAPS_PER_RUN;
/**
 * The camera plays at real-time speed while the race clock runs TIME_SCALE× faster,
 * so one race metre scrolls by PX_PER_M / TIME_SCALE px.
 */
const WORLD_PX_PER_M = PX_PER_M / TIME_SCALE;
const RUNNER_X = 300;

// Minimap: a small stadium track.
const MAP = { cx: 84, cy: 120, straight: 56, radius: 24 };
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

/** Side-view 1 km run: 4 laps of the hall, stepping to the footstrike rhythm. */
export class RunScene extends SegmentScene {
  private level = DEFAULT_RUN_LEVEL;
  private lastWheel = 0;
  private venue!: Venue;
  private rig!: AthleteRig;
  private shadow!: Phaser.GameObjects.Ellipse;
  private gates: Phaser.GameObjects.Image[] = [];
  private scrollX = 0;
  private speedPx = 0;
  private steps!: StepTrack;
  private lane!: StepLane;
  private sounded = new Set<number>();
  private lastStumble = 0;
  private strain!: (lactate: number, hr: number) => void;
  private mapDot!: Phaser.GameObjects.Arc;
  private lapText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private paceText!: Phaser.GameObjects.Text;
  private formBar!: Phaser.GameObjects.Graphics;
  private formText!: Phaser.GameObjects.Text;
  private levelBoxes: { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private surgeBox!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Run');
  }

  create(): void {
    this.beginSegment('step on the beat: A / D, ← / →, or left / right click   ·   W / S or wheel: pace   ·   hold SHIFT: surge');
    this.level = (this.registry.get('runLevel') as number | undefined) ?? DEFAULT_RUN_LEVEL;
    const segment = this.session.segment;
    const runIndex = segment?.kind === 'run' ? segment.index : 0;

    this.venue = addVenue(this);
    this.venue.setScreen(`RUN ${runIndex + 1}`, `${RUN_COUNT - runIndex - 1} to go after this one`);
    this.gates = [0, 1].map(() => this.add.image(0, STAGE.floorY + 6, 'lap-gate').setOrigin(0.5, 1));
    this.shadow = addShadow(this, RUNNER_X);
    this.rig = new AthleteRig(this);
    this.scrollX = this.session.progress * WORLD_PX_PER_M;
    this.speedPx = this.session.rate * PX_PER_M;

    this.steps = new StepTrack(
      RUN_LEVELS[this.level].cadence,
      performance.now() + LEAD_IN_MS,
      LOOKAHEAD_MS,
      windowsFor(this.session.capacity, 1),
      START_FORM,
    );
    this.sounded = new Set();
    this.lastStumble = 0;
    this.lane = new StepLane(this, LOOKAHEAD_MS);
    const input = new StepInput(this.game.canvas, (foot, t) => this.onStep(foot, t));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => input.destroy());

    this.drawInfoPanel();
    this.strain = addStrainOverlay(this);

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
    this.setLevel(this.level);
    this.render(performance.now(), 0);
  }

  update(_time: number, delta: number): void {
    const now = performance.now();
    if (AUTOPLAY) this.autoplay(now);
    this.handle(this.steps.update(now));

    const surging = isHeld('ShiftLeft', 'ShiftRight');
    const pace = surging ? SURGE : RUN_LEVELS[this.level];
    this.steps.cadence = pace.cadence;
    const inFlow = this.steps.streak >= STRIDE_FLOW_AT;
    const effort = pace.effort + formWaste(this.steps.form) - (inFlow ? STRIDE_FLOW_SAVING : 0);
    if (this.advance(delta, effort, formSpeed(this.steps.form))) return;
    this.steps.windows = windowsFor(this.session.capacity, 1);

    for (const note of this.steps.notes) {
      if (this.sounded.has(note.id)) continue;
      this.sounded.add(note.id);
      footstep(note.at, note.foot === 'L');
    }
    if (this.sounded.size > 64) for (const id of [...this.sounded].slice(0, 32)) this.sounded.delete(id);

    this.surgeBox.setFillStyle(surging ? COLORS.bad : COLORS.panel, 0.85);
    this.levelBoxes.forEach(({ box, label }, i) => {
      const active = i === this.level && !surging;
      box.setFillStyle(active ? COLORS.accent : COLORS.panel, active ? 1 : 0.85);
      label.setColor(active ? '#000000' : '#f2f2f2');
    });
    this.render(now, delta);
  }

  private onStep(foot: Foot, t: number): void {
    this.handle(this.steps.press(foot, t));
  }

  private handle(events: StepEvent[]): void {
    for (const e of events) {
      if (e.type === 'stray') {
        scuff();
        this.lane.flash(e.foot, 'miss');
        continue;
      }
      const grade = e.note.grade ?? 'miss';
      this.lane.flash(e.note.foot, grade);
      if (grade === 'miss') {
        scuff();
        if (this.time.now - this.lastStumble > 700) {
          this.lastStumble = this.time.now;
          popup(this, 150, STAGE.floorY - 18, 'STUMBLE', hex(COLORS.bad), 16);
        }
      } else if (this.steps.streak === STRIDE_FLOW_AT) {
        popup(this, 150, STAGE.floorY - 18, 'IN THE ZONE', hex(COLORS.accent), 18);
      }
    }
  }

  private autoplay(now: number): void {
    for (const note of [...this.steps.notes]) if (note.at <= now) this.onStep(note.foot, note.at);
  }

  private render(now: number, delta: number): void {
    const { progress, rate } = this.session;
    // The legs follow the floor's actual scroll speed and the footstrike beats, so feet never skate.
    const target = progress * WORLD_PX_PER_M;
    const dt = Math.min(delta, 100) / 1000;
    if (dt > 0) this.speedPx = Phaser.Math.Linear(this.speedPx, (target - this.scrollX) / dt, 0.15);
    this.scrollX = target;
    this.venue.scroll(this.scrollX);

    const strideHz = 500 / this.steps.stepIntervalAt(now);
    const gait = this.level === 0 && !isHeld('ShiftLeft', 'ShiftRight') ? 'walk' : 'run';
    this.rig.setPose(locomotionPose(RUNNER_X, STAGE.floorY, this.steps.phaseAt(now), Math.max(this.speedPx, 60), gait, strideHz));
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

    const form = this.steps.form;
    const color = form > 0.8 ? COLORS.good : form > 0.55 ? COLORS.accent : COLORS.bad;
    this.formBar.clear().fillStyle(0x2c2f37).fillRect(200, 150, 84, 7).fillStyle(color).fillRect(200, 150, 84 * form, 7);
    this.formText.setText(`FORM ${Math.round(form * 100)}%${this.steps.streak >= STRIDE_FLOW_AT ? ' · ZONE' : ''}`);

    this.lane.render(now, this.steps, this.session.athlete.lactate);
    this.strain(this.session.athlete.lactate, this.session.athlete.hr);
  }

  private drawInfoPanel(): void {
    this.add.rectangle(16, 72, 324, 128, 0x0b0c0f, 0.8).setOrigin(0).setStrokeStyle(1, COLORS.panelEdge);
    const g = this.add.graphics();
    const { cx, cy, straight, radius } = MAP;
    g.lineStyle(9, COLORS.track);
    g.strokeRoundedRect(cx - straight / 2 - radius, cy - radius, straight + 2 * radius, 2 * radius, radius);
    g.fillStyle(COLORS.trackLine).fillRect(cx - 1, cy + radius - 5, 2, 10);
    this.mapDot = this.add.circle(0, 0, 5, COLORS.accent).setStrokeStyle(1.5, 0x000000);
    this.lapText = this.add.text(160, 78, '', textStyle(19, '#ffffff', { fontStyle: 'bold' }));
    this.distanceText = this.add.text(160, 102, '', textStyle(13, hex(COLORS.muted)));
    this.paceText = this.add.text(160, 120, '', textStyle(19, hex(COLORS.accent), { fontStyle: 'bold' }));
    this.formText = this.add.text(28, 147, '', textStyle(11, '#c9ccd2', { fontStyle: 'bold' }));
    this.formBar = this.add.graphics();

    const box = (x: number, text: string) => {
      const rect = this.add.rectangle(x, 180, 48, 28, COLORS.panel, 0.85).setStrokeStyle(1, COLORS.panelEdge);
      const label = this.add.text(x, 180, text, textStyle(10, '#f2f2f2', { align: 'center' })).setOrigin(0.5);
      return { box: rect, label };
    };
    this.levelBoxes = RUN_LEVELS.map((lvl, i) => box(50 + i * 52, `${lvl.name}\n${lvl.cadence}`));
    this.surgeBox = box(50 + RUN_LEVELS.length * 52, `SHIFT\n${SURGE.cadence}`).box;
  }

  private setLevel(level: number): void {
    this.level = Phaser.Math.Clamp(level, 0, RUN_LEVELS.length - 1);
    this.registry.set('runLevel', this.level);
  }
}
