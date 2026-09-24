import * as Phaser from 'phaser';
import { STAGE } from '../art/stage';
import { type Venue, addStrainOverlay, addVenue } from '../art/venue';
import { DIVISIONS, WEIGHTS } from '../config/divisions';
import { RUN_COUNT, TIME_SCALE } from '../config/race';
import { STATIONS, type StationDef } from '../config/stations';
import { click, hitSound } from '../audio';
import { formatTime } from '../sim/format';
import {
  FLOW_EFFORT_SAVING,
  STATION_REST_EFFORT,
  STATION_WORK_EFFORT,
  TEMPO_LEVELS,
  workPerStroke,
} from '../sim/performance';
import { BeatTrack, type Grade, type TrackEvent, windowsFor } from '../sim/rhythm';
import { RHYTHM_RULES, type RhythmRules } from '../stations/rhythmRules';
import { Combo, type StrokeOutcome } from '../stations/scoring';
import { MovementView, SkiErgView, WallBallView } from '../stations/views';
import { isHeld } from '../ui/heldKeys';
import { RhythmInput } from '../ui/rhythmInput';
import { RhythmLane } from '../ui/rhythmLane';
import { COLORS, hex, textStyle } from '../ui/theme';
import { AUTOPLAY, getSession } from './flow';
import { SegmentScene } from './SegmentScene';

const DEFAULT_TEMPO = 1;
const COUNT_IN_EFFORT = 0.3;
const FLOW_WORK_BONUS = 1.05;
const GRADE_COLORS: Record<Grade, string> = { perfect: hex(COLORS.good), good: '#ffffff', miss: hex(COLORS.bad) };

interface Rhythm {
  rules: RhythmRules;
  track: BeatTrack;
  combo: Combo;
  lane: RhythmLane;
  input: RhythmInput;
  level: number;
  tempoBoxes: { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[];
  comboText: Phaser.GameObjects.Text;
  clicked: Set<number>;
  sets: number;
  /** Recent (race time, metres) samples for the SkiErg monitor's split. */
  samples: [number, number][];
}

/** Side-view station: rhythm mini-game where available, hold-to-work otherwise. */
export class StationScene extends SegmentScene {
  private def!: StationDef;
  private venue!: Venue;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private strain!: (lactate: number, hr: number) => void;
  private rhythm?: Rhythm;
  private skierg?: SkiErgView;
  private wallBall?: WallBallView;
  private movement?: MovementView;

  constructor() {
    super('Station');
  }

  create(): void {
    const segment = getSession(this).segment ?? { kind: 'station', index: 0 };
    this.def = STATIONS[segment.index];
    const rules = RHYTHM_RULES[this.def.id];
    this.beginSegment(rules?.hint ?? 'hold SPACE or mouse button to work   ·   release to rest and recover');
    this.rhythm = undefined;
    this.skierg = this.wallBall = this.movement = undefined;

    this.venue = addVenue(this);
    this.venue.setScreen(`STATION ${segment.index + 1} / ${RUN_COUNT}`, this.def.name.toUpperCase());
    this.drawInfoPanel(!!rules);

    if (this.def.id === 'skierg') this.skierg = new SkiErgView(this);
    else if (this.def.id === 'wallBalls') this.wallBall = new WallBallView(this, this.session.category === 'men' ? 3 : 2.7);
    else this.movement = new MovementView(this, this.def.id, this.venue);

    if (rules) this.setupRhythm(rules);
    else this.add.text(28, 200, 'Rhythm mini-game coming soon: hold to work for now', textStyle(12, '#c9ccd2', { fontStyle: 'italic' }));
    this.strain = addStrainOverlay(this);
  }

  update(time: number, delta: number): void {
    if (this.rhythm) this.updateRhythm(delta);
    else this.updateHold(time, delta);
    this.renderProgress();
    this.strain(this.session.athlete.lactate, this.session.athlete.hr);
  }

  // ------------------------------------------------------------ hold-to-work

  private updateHold(time: number, delta: number): void {
    const working = isHeld('Space') || this.input.activePointer.isDown;
    if (this.advance(delta, working ? STATION_WORK_EFFORT : STATION_REST_EFFORT)) return;
    this.movement?.update(this.session.progress / TIME_SCALE, this.session.progress / this.def.target, time / 1000);
  }

  // ------------------------------------------------------------ rhythm

  private setupRhythm(rules: RhythmRules): void {
    const level = (this.registry.get('stationTempo') as number | undefined) ?? DEFAULT_TEMPO;
    const track = new BeatTrack(TEMPO_LEVELS[level].bpm, rules.shape, windowsFor(this.session.capacity, this.session.difficulty));
    const input = new RhythmInput(
      this.game.canvas,
      (t) => this.onPress(t),
      (t) => this.onRelease(t),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => input.destroy());

    const tempoBoxes = TEMPO_LEVELS.map((tempo, i) => {
      const x = 54 + i * 56;
      const box = this.add.rectangle(x, 178, 52, 30, COLORS.panel, 0.9).setStrokeStyle(1, COLORS.panelEdge);
      const label = this.add.text(x, 178, `${tempo.name}\n${tempo.bpm}`, textStyle(11, '#f2f2f2', { align: 'center' })).setOrigin(0.5);
      return { box, label };
    });
    this.rhythm = {
      rules,
      track,
      combo: new Combo(),
      lane: new RhythmLane(this, rules.labels, track.options.lookaheadMs),
      input,
      level,
      tempoBoxes,
      comboText: this.add.text(740, 446, '', textStyle(14, '#ffffff', { fontStyle: 'bold' })).setOrigin(1, 0.5),
      clicked: new Set(),
      sets: 0,
      samples: [],
    };
    this.setTempo(level);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const onTap = (step: number) => (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      if (!event.repeat && this.rhythm) this.setTempo(this.rhythm.level + step);
    };
    for (const code of [K.W, K.UP]) kb.addKey(code).on('down', onTap(1));
    for (const code of [K.S, K.DOWN]) kb.addKey(code).on('down', onTap(-1));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.rhythm && dy !== 0) this.setTempo(this.rhythm.level + (dy < 0 ? 1 : -1));
    });
  }

  private updateRhythm(delta: number): void {
    const r = this.rhythm!;
    const now = performance.now();
    if (AUTOPLAY) this.autoplay(now);
    if (this.handle(r.track.update(now))) return;

    const tempo = TEMPO_LEVELS[r.level];
    const effort =
      r.track.state === 'active'
        ? tempo.effort - (r.combo.inFlow ? FLOW_EFFORT_SAVING : 0)
        : r.track.state === 'countIn'
          ? COUNT_IN_EFFORT
          : STATION_REST_EFFORT;
    if (this.tick(delta, effort)) return;
    r.track.windows = windowsFor(this.session.capacity, this.session.difficulty);

    // Metronome: schedule clicks as soon as their beats are known.
    for (const t of r.track.countIn) this.scheduleClick(t, true);
    for (const note of r.track.notes) this.scheduleClick(note.beat, false);

    this.skierg?.update(delta, r.track.isDown, r.track.interval);
    this.wallBall?.update(now, delta, r.track.isDown, r.track.interval);
    r.lane.render(now, r.track, this.session.athlete.lactate);
    r.comboText
      .setText(r.combo.count > 1 ? `COMBO ${r.combo.count}${r.combo.inFlow ? '  ·  FLOW' : ''}` : '')
      .setColor(r.combo.inFlow ? hex(COLORS.accent) : '#ffffff');
  }

  private onPress(t: number): void {
    if (this.rhythm) this.handle(this.rhythm.track.press(t));
  }

  private onRelease(t: number): void {
    const r = this.rhythm;
    if (!r) return;
    const throwing = r.track.state === 'active';
    const events = r.track.release(t);
    const note = events.find((e) => e.type === 'note');
    // A released squat always throws; only a scored good rep reaches the target.
    if (this.wallBall && throwing) {
      const outcome = note && note.type === 'note' ? r.rules.score(note.note, r.track.windows) : undefined;
      this.wallBall.throw(performance.now(), r.track.interval, !!outcome?.rep);
    }
    this.handle(events);
  }

  /** Applies track events. Returns true if the station finished (scene is leaving). */
  private handle(events: TrackEvent[]): boolean {
    const r = this.rhythm!;
    for (const event of events) {
      if (event.type === 'note') {
        const outcome = r.rules.score(event.note, r.track.windows);
        r.combo.record(outcome);
        this.judge(outcome);
        if (this.applyWork(outcome)) {
          r.track.stop();
          return true;
        }
      } else if (event.type === 'stray') {
        r.combo.breakStreak();
        this.popup('OFF BEAT', '#c9ccd2', 16);
      } else if (event.type === 'setStart') {
        r.sets++;
        this.popup(`SET ${r.sets}`, '#ffffff', 18);
      } else {
        r.combo.breakStreak();
        this.popup('RESTING', '#c9ccd2', 18);
      }
    }
    return false;
  }

  private applyWork(outcome: StrokeOutcome): boolean {
    const r = this.rhythm!;
    const work = r.rules.repBased
      ? outcome.rep
        ? 1
        : 0
      : workPerStroke(this.def, this.session.difficulty, TIME_SCALE) *
        outcome.quality *
        this.session.capacity *
        (r.combo.inFlow ? FLOW_WORK_BONUS : 1);
    if (work <= 0) return false;
    if (this.addWork(work)) return true;
    if (this.skierg) {
      r.samples.push([this.session.race.segmentElapsed, this.session.progress]);
      if (r.samples.length > 6) r.samples.shift();
      const [t0, m0] = r.samples[0];
      const [t1, m1] = r.samples[r.samples.length - 1];
      const split = m1 > m0 ? formatTime((500 * (t1 - t0)) / (m1 - m0)) : '--:--';
      this.skierg.setMonitor(this.session.progress, split);
    }
    return false;
  }

  private judge(outcome: StrokeOutcome): void {
    hitSound(outcome.grade);
    this.rhythm!.lane.flash(outcome.grade);
    this.popup(outcome.label, GRADE_COLORS[outcome.grade], outcome.grade === 'perfect' ? 22 : 18);
  }

  private autoplay(now: number): void {
    const track = this.rhythm!.track;
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

  private scheduleClick(t: number, countIn: boolean): void {
    const clicked = this.rhythm!.clicked;
    const key = Math.round(t);
    if (clicked.has(key)) return;
    clicked.add(key);
    click(t, countIn);
    if (clicked.size > 64) for (const k of [...clicked].slice(0, 32)) clicked.delete(k);
  }

  private setTempo(level: number): void {
    const r = this.rhythm!;
    r.level = Phaser.Math.Clamp(level, 0, TEMPO_LEVELS.length - 1);
    r.track.bpm = TEMPO_LEVELS[r.level].bpm;
    this.registry.set('stationTempo', r.level);
    r.tempoBoxes.forEach(({ box, label }, i) => {
      box.setFillStyle(i === r.level ? COLORS.accent : COLORS.panel, 0.9);
      label.setColor(i === r.level ? '#000000' : '#f2f2f2');
    });
  }

  // ------------------------------------------------------------ shared UI

  private drawInfoPanel(rhythm: boolean): void {
    const weight = WEIGHTS[this.session.division][this.session.category][this.def.id];
    const spec = [`${this.def.target} ${this.def.unit}`, weight, DIVISIONS[this.session.division].name].filter(Boolean).join('  ·  ');
    this.add.rectangle(16, 72, 300, rhythm ? 128 : 112, 0x0b0c0f, 0.8).setOrigin(0).setStrokeStyle(1, COLORS.panelEdge);
    const name = this.add.text(28, 80, this.def.name.toUpperCase(), textStyle(24, hex(COLORS.accent), { fontStyle: 'bold' }));
    if (name.width > 276) name.setFontSize(Math.floor((24 * 276) / name.width));
    this.add.text(28, 112, spec, textStyle(13, '#c9ccd2'));
    this.progressText = this.add.text(304, 130, '', textStyle(13, '#ffffff', { fontStyle: 'bold' })).setOrigin(1, 0);
    this.progressBar = this.add.graphics();
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

  /** Judgement text just above the note lane's hit line, where the player is looking. */
  private popup(text: string, color: string, size: number): void {
    const label = this.add
      .text(150, STAGE.floorY - 18, text, textStyle(size, color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }))
      .setOrigin(0, 0.5);
    this.tweens.add({ targets: label, y: label.y - 12, alpha: 0, duration: 650, ease: 'Cubic.out', onComplete: () => label.destroy() });
  }
}
