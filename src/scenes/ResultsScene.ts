import * as Phaser from 'phaser';
import { DIVISIONS } from '../config/divisions';
import { addVenue } from '../art/venue';
import { STATIONS } from '../config/stations';
import { formatClock, formatTime } from '../sim/format';
import { loadPb, savePb } from '../storage';
import { COLORS, HEIGHT, WIDTH, hex, monoStyle, textStyle } from '../ui/theme';
import { getSession } from './flow';

const ROW_H = 26;
const TOP = 196;

/** Official-style result: every run and station split, roxzone total, finish time. */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(): void {
    const session = getSession(this);
    const { runs, stations, roxzone, total } = session.race.summary();
    const muted = hex(COLORS.muted);
    addVenue(this);
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x07080a, 0.8).setOrigin(0);

    const previousPb = loadPb(session.division, session.category);
    const isPb = !session.unofficial && (previousPb === undefined || total < previousPb);
    if (isPb) savePb(session.division, session.category, total);

    this.add.text(WIDTH / 2, 28, 'FINISH', textStyle(30, hex(COLORS.accent), { fontStyle: 'bold' })).setOrigin(0.5, 0);
    this.add.text(WIDTH / 2, 66, formatClock(total), monoStyle(52)).setOrigin(0.5, 0);
    const pbLine = session.unofficial
      ? 'Debug shortcuts were used, so this result does not count'
      : isPb || previousPb === undefined
        ? 'NEW PERSONAL BEST'
        : `PB ${formatClock(previousPb)}   (+${formatTime(total - previousPb)})`;
    this.add.text(WIDTH / 2, 130, pbLine, textStyle(16, isPb ? hex(COLORS.good) : muted, { fontStyle: 'bold' })).setOrigin(0.5, 0);
    this.add
      .text(WIDTH / 2, 154, `${DIVISIONS[session.division].name} · ${session.category === 'men' ? 'Men' : 'Women'}`, textStyle(13, muted))
      .setOrigin(0.5, 0);

    const fastest = Math.min(...runs);
    const slowest = Math.max(...runs);
    const runColor = (s: number) => (s === fastest ? hex(COLORS.good) : s === slowest ? hex(COLORS.bad) : '#f2f2f2');

    this.column(150, 'RUNS', runs.map((s, i) => [`Run ${i + 1}`, s, runColor(s)]));
    this.column(530, 'STATIONS', stations.map((s, i) => [STATIONS[i].name, s, '#f2f2f2']));

    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const y = TOP + 9 * ROW_H + 10;
    this.add.rectangle(150, y - 6, 660, 1, COLORS.panelEdge).setOrigin(0);
    this.row(150, y, 'Run total', sum(runs), muted);
    this.row(530, y, 'Station total', sum(stations), muted);
    this.row(150, y + ROW_H, 'Roxzone', roxzone, muted);

    this.add
      .text(WIDTH / 2, 505, 'SPACE / click: back to menu', textStyle(14, muted))
      .setOrigin(0.5);
    const back = () => this.scene.start('Menu');
    this.input.keyboard!.once('keydown-SPACE', back);
    this.input.keyboard!.once('keydown-ENTER', back);
    this.input.once('pointerdown', back);
  }

  private column(x: number, heading: string, rows: [string, number, string][]): void {
    this.add.text(x, TOP, heading, textStyle(12, hex(COLORS.muted), { fontStyle: 'bold' }));
    rows.forEach(([label, seconds, color], i) => this.row(x, TOP + (i + 1) * ROW_H, label, seconds, color));
  }

  private row(x: number, y: number, label: string, seconds: number, color: string): void {
    this.add.text(x, y, label, textStyle(15, color));
    this.add.text(x + 280, y, formatTime(seconds ?? 0), monoStyle(15, color)).setOrigin(1, 0);
  }
}
