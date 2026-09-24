import * as Phaser from 'phaser';
import { STAGE } from '../art/stage';
import { type Venue, addStrainOverlay, addVenue } from '../art/venue';
import { click, footstep, hitSound, scuff } from '../audio';
import { DIVISIONS, WEIGHTS } from '../config/divisions';
import { RUN_COUNT, TIME_SCALE } from '../config/race';
import { STATIONS, type StationDef, type StationId } from '../config/stations';
import { formatTime } from '../sim/format';
import {
  FLOW_EFFORT_SAVING,
  STATION_REST_EFFORT,
  STRIDE_FLOW_AT,
  TEMPO_LEVELS,
  workPerStroke,
} from '../sim/performance';
import { BeatTrack, DEFAULT_TRACK_OPTIONS, type Grade, type TrackEvent, windowsFor } from '../sim/rhythm';
import { type StepEvent, StepTrack } from '../sim/steps';
import { type HoldRules, RHYTHM_RULES, type StepRules } from '../stations/rhythmRules';
import { Combo, Grip, Momentum, type StrokeOutcome } from '../stations/scoring';
import {
  BurpeeView,
  FarmersView,
  type HoldView,
  LungeView,
  RowView,
  SkiErgView,
  SledPullView,
  SledPushView,
  type StepView,
  WallBallView,
} from '../stations/views';
import { popup } from '../ui/popup';
import { RhythmInput } from '../ui/rhythmInput';
import { RhythmLane } from '../ui/rhythmLane';
import { StepInput } from '../ui/stepInput';
import { StepLane } from '../ui/stepLane';
import { COLORS, hex, textStyle } from '../ui/theme';
import { AUTOPLAY, getSession, raceDelta } from './flow';
import { SegmentScene } from './SegmentScene';

const DEFAULT_TEMPO = 1;
const COUNT_IN_EFFORT = 0.3;
const FLOW_WORK_BONUS = 1.05;
const STEP_QUALITY: Record<Grade, number> = { perfect: 1, good: 0.8, miss: 0 };
const GRADE_COLORS: Record<Grade, string> = { perfect: hex(COLORS.good), good: '#ffffff', miss: hex(COLORS.bad) };
const POPUP_X = 150;
const POPUP_Y = STAGE.floorY - 18;

interface HoldMode {
  kind: 'hold';
  rules: HoldRules;
  track: BeatTrack;
  lane: RhythmLane;
  view: HoldView;
  combo: Combo;
}

interface StepMode {
  kind: 'steps';
  rules: StepRules;
  track: StepTrack;
  lane: StepLane;
  view: StepView;
  momentum?: Momentum;
  grip?: Grip;
  lastHitAt: number;
}

/** Side-view station played as a rhythm mini-game: hold notes, or left/right taps. */
export class StationScene extends SegmentScene {
  private def!: StationDef;
  private venue!: Venue;
  private mode!: HoldMode | StepMode;
  private level = DEFAULT_TEMPO;
  private tempoBoxes: { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private meter?: { bar: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text };
  private comboText!: Phaser.GameObjects.Text;
  private strain!: (lactate: number, hr: number) => void;
  /** Beat times (or note ids) already sent to the audio clock. */
  private sounded = new Set<number>();
  private sets = 0;
  /** Recent (race time, metres) samples for erg monitors. */
  private samples: [number, number][] = [];

  constructor() {
    super('Station');
  }

  create(): void {
    const segment = getSession(this).segment ?? { kind: 'station', index: 0 };
    this.def = STATIONS[segment.index];
    const rules = RHYTHM_RULES[this.def.id];
    this.beginSegment(rules.hint);
    this.sounded = new Set();
    this.sets = 0;
    this.samples = [];
    this.level = (this.registry.get('stationTempo') as number | undefined) ?? DEFAULT_TEMPO;

    this.venue = addVenue(this);
    this.venue.setScreen(`STATION ${segment.index + 1} / ${RUN_COUNT}`, this.def.name.toUpperCase());
    this.drawInfoPanel(rules.kind === 'steps' && (rules.momentum || rules.grip) ? (rules.grip ? 'GRIP' : 'MOMENTUM') : undefined);

    const now = performance.now();
    const windows = windowsFor(this.session.capacity, this.session.difficulty);
    if (rules.kind === 'hold') {
      const track = new BeatTrack(TEMPO_LEVELS[this.level].bpm / rules.beatsPerNote, rules.shape, windows, {
        ...DEFAULT_TRACK_OPTIONS,
        countInSpacing: 1 / rules.beatsPerNote,
      });
      this.mode = {
        kind: 'hold',
        rules,
        track,
        lane: new RhythmLane(this, rules.labels, track.options.lookaheadMs),
        view: this.holdView(this.def.id),
        combo: new Combo(),
      };
      const input = new RhythmInput(this.game.canvas, (t) => this.onPress(t), (t) => this.onRelease(t));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => input.destroy());
    } else {
      const track = new StepTrack(TEMPO_LEVELS[this.level].bpm * rules.stepsPerBeat, now, 1500, windows, 0.9, {
        restAfterMisses: 3,
        countInSteps: 3,
      });
      this.mode = {
        kind: 'steps',
        rules,
        track,
        lane: new StepLane(this, track.lookaheadMs, rules.labels),
        view: this.stepView(this.def.id),
        momentum: rules.momentum ? new Momentum() : undefined,
        grip: rules.grip ? new Grip() : undefined,
        lastHitAt: -Infinity,
      };
      const input = new StepInput(this.game.canvas, (foot, t) => this.handleSteps(this.mode.kind === 'steps' ? this.mode.track.press(foot, t) : [], t));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => input.destroy());
    }

    this.comboText = this.add.text(740, 446, '', textStyle(14, '#ffffff', { fontStyle: 'bold' })).setOrigin(1, 0.5);
    this.strain = addStrainOverlay(this);
    this.bindTempoKeys();
    this.setTempo(this.level);
  }

  update(_time: number, delta: number): void {
    const now = performance.now();
    const leaving = this.mode.kind === 'hold' ? this.updateHold(now, delta) : this.updateSteps(now, delta);
    if (leaving) return;
    this.renderProgress();
    this.strain(this.session.athlete.lactate, this.session.athlete.hr);
  }

  // ------------------------------------------------------------ hold notes

  private holdView(id: StationId): HoldView {
    switch (id) {
      case 'wallBalls':
        return new WallBallView(this, this.session.category === 'men' ? 3 : 2.7);
      case 'row':
        return new RowView(this);
      case 'burpeeBroadJump':
        return new BurpeeView(this, this.venue);
      case 'sandbagLunges':
        return new LungeView(this, this.venue);
      default:
        return new SkiErgView(this);
    }
  }

  /** Returns true once the scene is leaving. */
  private updateHold(now: number, delta: number): boolean {
    const m = this.mode as HoldMode;
    if (AUTOPLAY) this.autoplayHold(now);
    if (this.handleHold(m.track.update(now))) return true;

    const tempo = TEMPO_LEVELS[this.level];
    const effort =
      m.track.state === 'active'
        ? tempo.effort - (m.combo.inFlow ? FLOW_EFFORT_SAVING : 0)
        : m.track.state === 'countIn'
          ? COUNT_IN_EFFORT
          : STATION_REST_EFFORT;
    if (this.tick(delta, effort)) return true;
    m.track.windows = windowsFor(this.session.capacity, this.session.difficulty);

    for (const t of m.track.countIn) this.scheduleSound(Math.round(t), () => click(t, true));
    for (const note of m.track.notes) this.scheduleSound(Math.round(note.beat), () => click(note.beat, false));

    m.view.update(now, delta, m.track.isDown, m.track.interval);
    m.lane.render(now, m.track, this.session.athlete.lactate);
    this.showCombo(m.combo.count, m.combo.inFlow);
    return false;
  }

  private onPress(t: number): void {
    if (this.mode.kind === 'hold') this.handleHold(this.mode.track.press(t));
  }

  private onRelease(t: number): void {
    if (this.mode.kind !== 'hold') return;
    const m = this.mode;
    const moving = m.track.state === 'active';
    const events = m.track.release(t);
    if (moving && m.view.release) {
      const note = events.find((e) => e.type === 'note');
      const outcome = note?.type === 'note' ? m.rules.score(note.note, m.track.windows) : undefined;
      m.view.release(performance.now(), m.track.interval, outcome);
    }
    this.handleHold(events);
  }

  /** Applies track events. Returns true if the station finished. */
  private handleHold(events: TrackEvent[]): boolean {
    const m = this.mode as HoldMode;
    for (const event of events) {
      if (event.type === 'note') {
        const outcome = m.rules.score(event.note, m.track.windows);
        m.combo.record(outcome);
        this.judge(outcome);
        if (this.addStrokeWork(outcome)) {
          m.track.stop();
          return true;
        }
      } else if (event.type === 'stray') {
        m.combo.breakStreak();
        popup(this, POPUP_X, POPUP_Y, 'OFF BEAT', '#c9ccd2', 16);
      } else {
        this.onSet(event.type === 'setStart');
        if (event.type === 'setEnd') m.combo.breakStreak();
      }
    }
    return false;
  }

  private addStrokeWork(outcome: StrokeOutcome): boolean {
    const m = this.mode as HoldMode;
    const work = m.rules.repBased
      ? outcome.rep
        ? 1
        : 0
      : workPerStroke(this.def, this.session.difficulty, TIME_SCALE) *
        m.rules.beatsPerNote *
        outcome.quality *
        this.session.capacity *
        (m.combo.inFlow ? FLOW_WORK_BONUS : 1);
    if (work <= 0) return false;
    if (this.addWork(work)) return true;
    this.updateMonitor();
    return false;
  }

  private judge(outcome: StrokeOutcome): void {
    hitSound(outcome.grade);
    (this.mode as HoldMode).lane.flash(outcome.grade);
    popup(this, POPUP_X, POPUP_Y, outcome.label, GRADE_COLORS[outcome.grade], outcome.grade === 'perfect' ? 22 : 18);
  }

  private autoplayHold(now: number): void {
    const track = (this.mode as HoldMode).track;
    if (track.state === 'resting') {
      this.onPress(now);
      this.onRelease(now);
      return;
    }
    const held = track.heldNote;
    if (track.isDown && held && now >= held.end) this.onRelease(held.end);
    const next = track.notes.find((n) => n.pressedAt === undefined);
    if (!track.isDown && next && now >= next.start) this.onPress(next.start);
  }

  // ------------------------------------------------------------ left/right steps

  private stepView(id: StationId): StepView {
    if (id === 'sledPull') return new SledPullView(this);
    if (id === 'farmersCarry') return new FarmersView(this, this.venue);
    return new SledPushView(this, this.venue);
  }

  private updateSteps(now: number, delta: number): boolean {
    const m = this.mode as StepMode;
    if (AUTOPLAY) this.autoplaySteps(now);
    if (this.handleSteps(m.track.update(now), now)) return true;

    const holding = m.grip?.holding ?? true;
    const moving = m.track.state === 'active' && holding;
    const working = moving && now - m.lastHitAt < 3 * m.track.interval;
    const tempo = TEMPO_LEVELS[this.level];
    const effort = working
      ? tempo.effort - (m.track.streak >= STRIDE_FLOW_AT ? FLOW_EFFORT_SAVING : 0)
      : m.track.state === 'countIn'
        ? COUNT_IN_EFFORT
        : STATION_REST_EFFORT;
    if (m.grip?.update(raceDelta(delta), m.track.state === 'active', this.session.athlete.fatigue('grip'))) {
      popup(this, POPUP_X, POPUP_Y, 'DROPPED! RE-GRIPPING', hex(COLORS.bad), 20);
      scuff();
    }
    if (this.tick(delta, effort)) return true;
    m.track.windows = windowsFor(this.session.capacity, this.session.difficulty);

    for (const t of m.track.countIn) this.scheduleSound(Math.round(t), () => click(t, true));
    for (const note of m.track.notes) this.scheduleSound(Math.round(note.at), () => footstep(note.at, note.foot === 'L'));

    m.view.update({
      now,
      dtMs: delta,
      phase: m.track.phaseAt(now),
      stepMs: m.track.stepIntervalAt(now),
      moving,
      progress: this.session.progress / this.def.target,
      metres: this.session.progress / TIME_SCALE,
    });
    m.lane.render(now, m.track, this.session.athlete.lactate);
    this.showCombo(m.track.streak, m.track.streak >= STRIDE_FLOW_AT);
    const meter = m.grip ? m.grip.level : m.momentum?.value;
    if (meter !== undefined) this.renderMeter(meter, m.grip ? (m.grip.holding ? 'GRIP' : 'RE-GRIPPING') : 'MOMENTUM');
    return false;
  }

  /** Applies step events. Returns true if the station finished. */
  private handleSteps(events: StepEvent[], now = performance.now()): boolean {
    if (this.mode.kind !== 'steps') return false;
    const m = this.mode;
    for (const e of events) {
      if (e.type === 'setStart' || e.type === 'setEnd') {
        this.onSet(e.type === 'setStart');
        if (e.type === 'setEnd') m.momentum?.stop();
        continue;
      }
      if (e.type === 'stray') {
        scuff();
        m.lane.flash(e.foot, 'miss');
        continue;
      }
      const grade = e.note.grade ?? 'miss';
      m.lane.flash(e.note.foot, grade);
      if (grade === 'miss') {
        scuff();
        const stalled = (m.momentum?.value ?? 0) > 0.7;
        m.momentum?.record('miss');
        m.grip?.miss();
        if (stalled) popup(this, POPUP_X, POPUP_Y, 'STALLED', hex(COLORS.bad), 18);
        continue;
      }
      m.lastHitAt = now;
      m.momentum?.record(grade);
      if (m.track.streak === STRIDE_FLOW_AT) popup(this, POPUP_X, POPUP_Y, 'IN THE ZONE', hex(COLORS.accent), 18);
      if (!(m.grip?.holding ?? true)) continue;
      const work =
        (workPerStroke(this.def, this.session.difficulty, TIME_SCALE) / m.rules.stepsPerBeat) *
        STEP_QUALITY[grade] *
        this.session.capacity *
        (m.momentum?.value ?? 1) *
        (m.track.streak >= STRIDE_FLOW_AT ? FLOW_WORK_BONUS : 1);
      if (this.addWork(work)) {
        m.track.notes.length = 0;
        return true;
      }
    }
    return false;
  }

  private autoplaySteps(now: number): void {
    const m = this.mode as StepMode;
    if (m.track.state === 'resting') {
      if (m.grip && m.grip.level < 0.6) return; // let the grip recover before the next set
      this.handleSteps(m.track.press('L', now), now);
      return;
    }
    // Put the bells down in time: ending a set takes three missed steps, which still drain grip.
    if (m.grip && m.grip.level < 0.25) return;
    for (const note of [...m.track.notes]) if (note.at <= now) this.handleSteps(m.track.press(note.foot, note.at), note.at);
  }

  // ------------------------------------------------------------ shared

  private onSet(start: boolean): void {
    if (start) this.sets++;
    popup(this, POPUP_X, POPUP_Y, start ? `SET ${this.sets}` : 'RESTING', start ? '#ffffff' : '#c9ccd2', 18);
  }

  private scheduleSound(key: number, play: () => void): void {
    if (this.sounded.has(key)) return;
    this.sounded.add(key);
    play();
    if (this.sounded.size > 64) for (const k of [...this.sounded].slice(0, 32)) this.sounded.delete(k);
  }

  private updateMonitor(): void {
    const view = (this.mode as HoldMode).view;
    if (!view.setMonitor) return;
    this.samples.push([this.session.race.segmentElapsed, this.session.progress]);
    if (this.samples.length > 6) this.samples.shift();
    const [t0, m0] = this.samples[0];
    const [t1, m1] = this.samples[this.samples.length - 1];
    view.setMonitor(this.session.progress, m1 > m0 ? formatTime((500 * (t1 - t0)) / (m1 - m0)) : '--:--');
  }

  private showCombo(count: number, inFlow: boolean): void {
    this.comboText
      .setText(count > 1 ? `COMBO ${count}${inFlow ? '  ·  FLOW' : ''}` : '')
      .setColor(inFlow ? hex(COLORS.accent) : '#ffffff');
  }

  private bindTempoKeys(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const onTap = (step: number) => (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      if (!event.repeat) this.setTempo(this.level + step);
    };
    for (const code of [K.W, K.UP]) kb.addKey(code).on('down', onTap(1));
    for (const code of [K.S, K.DOWN]) kb.addKey(code).on('down', onTap(-1));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.setTempo(this.level + (dy < 0 ? 1 : -1));
    });
  }

  /** Tempo box label: what you actually hear, notes (or steps) per minute. */
  private notesPerMinute(bpm: number): number {
    return Math.round(this.mode.kind === 'hold' ? bpm / this.mode.rules.beatsPerNote : bpm * this.mode.rules.stepsPerBeat);
  }

  private setTempo(level: number): void {
    this.level = Phaser.Math.Clamp(level, 0, TEMPO_LEVELS.length - 1);
    this.registry.set('stationTempo', this.level);
    const perMinute = this.notesPerMinute(TEMPO_LEVELS[this.level].bpm);
    if (this.mode.kind === 'hold') this.mode.track.bpm = perMinute;
    else this.mode.track.cadence = perMinute;
    this.tempoBoxes.forEach(({ box, label }, i) => {
      box.setFillStyle(i === this.level ? COLORS.accent : COLORS.panel, 0.9);
      label.setColor(i === this.level ? '#000000' : '#f2f2f2');
    });
  }

  private drawInfoPanel(meterLabel?: string): void {
    const weight = WEIGHTS[this.session.division][this.session.category][this.def.id];
    const spec = [`${this.def.target} ${this.def.unit}`, weight, DIVISIONS[this.session.division].name].filter(Boolean).join('  ·  ');
    this.add.rectangle(16, 72, 300, 128, 0x0b0c0f, 0.8).setOrigin(0).setStrokeStyle(1, COLORS.panelEdge);
    const name = this.add.text(28, 80, this.def.name.toUpperCase(), textStyle(24, hex(COLORS.accent), { fontStyle: 'bold' }));
    if (name.width > 276) name.setFontSize(Math.floor((24 * 276) / name.width));
    this.add.text(28, 112, spec, textStyle(13, '#c9ccd2'));
    this.progressText = this.add.text(304, 130, '', textStyle(13, '#ffffff', { fontStyle: 'bold' })).setOrigin(1, 0);
    this.progressBar = this.add.graphics();
    if (meterLabel) this.meter = { bar: this.add.graphics(), text: this.add.text(28, 147, '', textStyle(10, '#c9ccd2', { fontStyle: 'bold' })) };
    else this.meter = undefined;

    const rules = RHYTHM_RULES[this.def.id];
    const perMinute = (bpm: number) => Math.round(rules.kind === 'hold' ? bpm / rules.beatsPerNote : bpm * rules.stepsPerBeat);
    this.tempoBoxes = TEMPO_LEVELS.map((tempo, i) => {
      const x = 54 + i * 56;
      const box = this.add.rectangle(x, 180, 52, 28, COLORS.panel, 0.9).setStrokeStyle(1, COLORS.panelEdge);
      const label = this.add.text(x, 180, `${tempo.name}\n${perMinute(tempo.bpm)}`, textStyle(10, '#f2f2f2', { align: 'center' })).setOrigin(0.5);
      return { box, label };
    });
  }

  private renderMeter(value: number, label: string): void {
    if (!this.meter) return;
    const color = value > 0.6 ? COLORS.good : value > 0.3 ? COLORS.accent : COLORS.bad;
    this.meter.bar.clear().fillStyle(0x2c2f37).fillRect(150, 150, 154, 7).fillStyle(color).fillRect(150, 150, 154 * value, 7);
    this.meter.text.setText(`${label} ${Math.round(value * 100)}%`);
  }

  private renderProgress(): void {
    const { progress } = this.session;
    const t = Math.min(1, progress / this.def.target);
    const decimals = this.def.unit === 'reps' || this.def.target >= 200 ? 0 : 1;
    this.progressText.setText(`${progress.toFixed(decimals)} / ${this.def.target} ${this.def.unit}`);
    const g = this.progressBar.clear();
    g.fillStyle(0x2c2f37).fillRect(28, 136, 170, 8);
    g.fillStyle(COLORS.accent).fillRect(28, 136, 170 * t, 8);
  }
}
