import * as Phaser from 'phaser';
import { DIVISIONS, WEIGHTS, type Category, type DivisionId } from '../config/divisions';
import { standPose } from '../art/poses';
import { AthleteRig } from '../art/rig';
import { STAGE } from '../art/stage';
import { addShadow, addVenue } from '../art/venue';
import { unlockAudio } from '../audio';
import { STATIONS } from '../config/stations';
import { formatClock } from '../sim/format';
import { Session } from '../sim/session';
import { loadPb } from '../storage';
import { COLORS, HEIGHT, WIDTH, hex, textStyle } from '../ui/theme';
import { UNOFFICIAL, goToCurrentSegment } from './flow';
import { DEFAULT_RUN_LEVEL } from './RunScene';

interface Option<T> {
  value: T;
  label: string;
}

const DIVISION_OPTIONS: Option<DivisionId>[] = [
  { value: 'open', label: DIVISIONS.open.name },
  { value: 'pro', label: DIVISIONS.pro.name },
];
const CATEGORY_OPTIONS: Option<Category>[] = [
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
];

export class MenuScene extends Phaser.Scene {
  private division: DivisionId = 'open';
  private category: Category = 'men';
  private focusRow = 0;
  private optionTexts: Phaser.GameObjects.Text[][] = [];
  private rowLabels: Phaser.GameObjects.Text[] = [];
  private stationWeights: Phaser.GameObjects.Text[] = [];
  private pbText!: Phaser.GameObjects.Text;
  private hero!: AthleteRig;

  constructor() {
    super('Menu');
  }

  create(): void {
    const muted = hex(COLORS.muted);
    addVenue(this);
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x07080a, 0.8).setOrigin(0);
    addShadow(this, 905);
    this.hero = new AthleteRig(this);
    this.add.text(WIDTH / 2, 44, 'HYROX GAME', textStyle(52, hex(COLORS.accent), { fontStyle: 'bold' })).setOrigin(0.5, 0);
    this.add.text(WIDTH / 2, 108, '8 × 1 km run  +  8 stations.  Pace yourself.', textStyle(18, '#d0d3d8')).setOrigin(0.5, 0);

    this.rowLabels = [];
    this.optionTexts = [
      this.optionRow(0, 'Division', DIVISION_OPTIONS, () => this.division, (v) => (this.division = v)),
      this.optionRow(1, 'Category', CATEGORY_OPTIONS, () => this.category, (v) => (this.category = v)),
    ];

    this.add.text(120, 262, 'STATIONS', textStyle(12, muted, { fontStyle: 'bold' }));
    const rowY = (i: number) => 284 + i * 22;
    STATIONS.forEach((station, i) => {
      this.add.text(120, rowY(i), `${i + 1}. ${station.name}`, textStyle(14));
      this.add.text(340, rowY(i), `${station.target} ${station.unit}`, textStyle(14, '#d0d3d8')).setOrigin(1, 0);
    });
    this.stationWeights = STATIONS.map((_, i) => this.add.text(360, rowY(i), '', textStyle(14, muted)));

    this.add.text(540, 262, 'CONTROLS', textStyle(12, muted, { fontStyle: 'bold' }));
    const controls: [string, string][] = [
      ['Run', 'step on the beat: A / D, ← / →, mouse L / R'],
      ['', 'W / S or wheel: pace · SHIFT: surge'],
      ['Roxzone', 'hold W: jog'],
      ['SkiErg', 'rhythm: press on ●, release on ◆'],
      ['Wall Balls', 'W / S: tempo · stop playing to rest'],
      ['Others', 'hold SPACE / mouse to work'],
      ['Sound', 'M: mute'],
    ];
    controls.forEach(([label, value], i) => {
      this.add.text(540, 284 + i * 19, label, textStyle(13, hex(COLORS.accent)));
      this.add.text(622, 284 + i * 19, value, textStyle(13, '#d0d3d8'));
    });
    this.add.text(540, 424, 'Tired athletes get tighter timing windows:\ngo out too hard and you pay later.', textStyle(12, muted));

    this.pbText = this.add.text(WIDTH / 2, 470, '', textStyle(14, muted)).setOrigin(0.5);
    const start = this.add
      .text(WIDTH / 2, 505, '  START RACE  ·  SPACE  ', textStyle(20, '#000000', { fontStyle: 'bold', backgroundColor: hex(COLORS.accent) }))
      .setOrigin(0.5)
      .setPadding(10, 6, 10, 6)
      .setInteractive({ useHandCursor: true });
    start.on('pointerdown', () => this.startRace());

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'ArrowDown':
          this.focusRow = 1 - this.focusRow;
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          if (this.focusRow === 0) this.division = this.division === 'open' ? 'pro' : 'open';
          else this.category = this.category === 'men' ? 'women' : 'men';
          break;
        case 'Space':
        case 'Enter':
          this.startRace();
          return;
      }
      this.refresh();
    });

    this.refresh();
  }

  private optionRow<T>(row: number, label: string, options: Option<T>[], get: () => T, set: (v: T) => void) {
    const y = 160 + row * 40;
    this.rowLabels.push(this.add.text(300, y, label, textStyle(18)).setOrigin(0, 0.5));
    return options.map((option, i) =>
      this.add
        .text(440 + i * 120, y, option.label, textStyle(18))
        .setOrigin(0, 0.5)
        .setPadding(10, 4, 10, 4)
        .setData('value', option.value)
        .setData('selected', () => get() === option.value)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          set(option.value);
          this.focusRow = row;
          this.refresh();
        }),
    );
  }

  private refresh(): void {
    this.rowLabels.forEach((label, row) => label.setColor(row === this.focusRow ? hex(COLORS.accent) : '#f2f2f2'));
    for (const texts of this.optionTexts) {
      for (const text of texts) {
        const selected = (text.getData('selected') as () => boolean)();
        text.setColor(selected ? '#000000' : '#f2f2f2').setBackgroundColor(selected ? hex(COLORS.accent) : hex(COLORS.panel));
      }
    }

    const weights = WEIGHTS[this.division][this.category];
    STATIONS.forEach((station, i) => this.stationWeights[i].setText(weights[station.id] ?? ''));

    const pb = loadPb(this.division, this.category);
    this.pbText.setText(pb === undefined ? 'No personal best yet in this division' : `Personal best: ${formatClock(pb)}`);
  }

  update(time: number): void {
    this.hero.setPose(standPose(905, STAGE.floorY, time / 1000));
  }

  private startRace(): void {
    unlockAudio();
    const session = new Session(this.division, this.category);
    session.unofficial = UNOFFICIAL;
    this.registry.set('session', session);
    this.registry.set('runLevel', DEFAULT_RUN_LEVEL);
    this.scene.launch('Hud');
    goToCurrentSegment(this);
  }
}
