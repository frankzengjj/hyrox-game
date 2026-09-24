import * as Phaser from 'phaser';
import { DIVISIONS, WEIGHTS, type Category, type DivisionId } from '../config/divisions';
import { STATIONS } from '../config/stations';
import { formatClock } from '../sim/format';
import { Session } from '../sim/session';
import { loadPb } from '../storage';
import { COLORS, WIDTH, hex, textStyle } from '../ui/theme';
import { goToCurrentSegment } from './flow';
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

  constructor() {
    super('Menu');
  }

  create(): void {
    const muted = hex(COLORS.muted);
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

    this.add.text(560, 262, 'CONTROLS', textStyle(12, muted, { fontStyle: 'bold' }));
    this.add.text(
      560,
      284,
      [
        'Run       W / S or wheel: pace',
        '          hold SHIFT: surge',
        'Roxzone   hold W: jog',
        'Stations  hold SPACE / mouse: work',
        '',
        'Watch your heart rate and lactate.',
        'Go out too hard and you pay later.',
      ].join('\n'),
      { ...textStyle(14, '#d0d3d8'), lineSpacing: 6 },
    );

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

  private startRace(): void {
    this.registry.set('session', new Session(this.division, this.category));
    this.registry.set('runLevel', DEFAULT_RUN_LEVEL);
    this.scene.launch('Hud');
    goToCurrentSegment(this);
  }
}
