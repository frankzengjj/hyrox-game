import * as Phaser from 'phaser';
import { DIVISIONS } from '../config/divisions';
import { RUN_COUNT } from '../config/race';
import { STATIONS } from '../config/stations';
import { MUSCLE_GROUPS } from '../sim/athlete';
import { formatClock, formatTime } from '../sim/format';
import type { Segment } from '../sim/race';
import { COLORS, HEIGHT, WIDTH, ZONE_COLORS, hex, monoStyle, textStyle } from '../ui/theme';
import { getSession } from './flow';

const PANEL_X = 776;
const PANEL_Y = 76;
const BAR_X = PANEL_X + 66;
const BAR_W = 96;
const FATIGUE_COLOR = 0xf5a623;

function describe(segment: Segment): { title: string; next: string } {
  const i = segment.index;
  const nextRun = i + 1 < RUN_COUNT ? `Run ${i + 2}` : 'FINISH';
  switch (segment.kind) {
    case 'run':
      return { title: `RUN ${i + 1} / ${RUN_COUNT}`, next: STATIONS[i].name };
    case 'roxzone':
      return { title: 'ROXZONE', next: segment.leg === 'in' ? STATIONS[i].name : nextRun };
    case 'station':
      return { title: `STATION ${i + 1} / ${RUN_COUNT} · ${STATIONS[i].name.toUpperCase()}`, next: nextRun };
  }
}

/** Race clock, heart-rate watch and body readout, drawn over whichever segment scene is running. */
export class HudScene extends Phaser.Scene {
  private clock!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private hr!: Phaser.GameObjects.Text;
  private zonePill!: Phaser.GameObjects.Rectangle;
  private zoneText!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    const session = getSession(this);
    const muted = hex(COLORS.muted);

    this.add.rectangle(0, 0, WIDTH, 60, COLORS.panel).setOrigin(0);
    this.add.rectangle(0, 60, WIDTH, 1, COLORS.panelEdge).setOrigin(0);
    this.add.text(20, 7, 'RACE TIME', textStyle(11, muted));
    this.clock = this.add.text(20, 20, '', monoStyle(28));
    this.title = this.add.text(WIDTH / 2, 10, '', textStyle(18, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5, 0);
    this.sub = this.add.text(WIDTH / 2, 36, '', textStyle(13, muted)).setOrigin(0.5, 0);
    this.add.text(WIDTH - 20, 7, 'HEART RATE', textStyle(11, muted)).setOrigin(1, 0);
    this.hr = this.add.text(WIDTH - 72, 20, '', monoStyle(28)).setOrigin(1, 0);
    this.zonePill = this.add.rectangle(WIDTH - 40, 37, 40, 24, ZONE_COLORS[0]);
    this.zoneText = this.add.text(WIDTH - 40, 37, '', textStyle(14, '#000000', { fontStyle: 'bold' })).setOrigin(0.5);

    this.add.rectangle(PANEL_X, PANEL_Y, 172, 216, 0x0b0c0f, 0.82).setOrigin(0).setStrokeStyle(1, COLORS.panelEdge);
    this.add.text(PANEL_X + 12, PANEL_Y + 10, 'BODY', textStyle(12, muted, { fontStyle: 'bold' }));
    const labels = ['Energy', 'Lactate', ...MUSCLE_GROUPS.map((g) => g[0].toUpperCase() + g.slice(1))];
    labels.forEach((label, i) => this.add.text(PANEL_X + 12, this.barY(i) - 3, label, textStyle(12)));
    this.add.text(PANEL_X + 12, this.barY(2) - 22, 'MUSCLE FATIGUE', textStyle(11, muted));
    this.add.text(
      PANEL_X + 12,
      PANEL_Y + 190,
      `${DIVISIONS[session.division].name} · ${session.category === 'men' ? 'Men' : 'Women'}`,
      textStyle(12, muted),
    );
    this.bars = this.add.graphics();

    this.add.rectangle(0, HEIGHT - 30, WIDTH, 30, COLORS.panel).setOrigin(0);
    this.hint = this.add.text(WIDTH / 2, HEIGHT - 15, '', textStyle(13, '#d0d3d8')).setOrigin(0.5);
  }

  update(): void {
    const session = getSession(this);
    const { athlete, race } = session;

    this.clock.setText(formatClock(race.elapsed));
    if (session.segment) {
      const { title, next } = describe(session.segment);
      this.title.setText(title);
      this.sub.setText(`split ${formatTime(race.segmentElapsed)}   ·   next: ${next}`);
    }

    this.hr.setText(`${Math.round(athlete.hr)}`);
    this.zonePill.setFillStyle(ZONE_COLORS[athlete.zone - 1]);
    this.zoneText.setText(`Z${athlete.zone}`);

    const values: [number, number][] = [
      [athlete.energy, COLORS.good],
      [athlete.lactate, COLORS.bad],
      ...MUSCLE_GROUPS.map((g): [number, number] => [athlete.fatigue(g), FATIGUE_COLOR]),
    ];
    const g = this.bars.clear();
    values.forEach(([value, color], i) => {
      const y = this.barY(i);
      g.fillStyle(0x2c2f37).fillRect(BAR_X, y, BAR_W, 10);
      g.fillStyle(color).fillRect(BAR_X, y, BAR_W * Phaser.Math.Clamp(value, 0, 1), 10);
    });

    this.hint.setText((this.registry.get('hint') as string | undefined) ?? '');
  }

  private barY(row: number): number {
    return PANEL_Y + 36 + row * 22 + (row >= 2 ? 22 : 0);
  }
}
