import * as Phaser from 'phaser';
import { ROXZONE_DISTANCE_M } from '../config/race';
import { STATIONS } from '../config/stations';
import { isHeld } from '../ui/heldKeys';
import { COLORS, hex, textStyle } from '../ui/theme';
import { SegmentScene } from './SegmentScene';

const WALK_EFFORT = 0.2;
const JOG_EFFORT = 0.5;
const LANE_LEFT = 80;
const LANE_RIGHT = 680;
const LANE_Y = 300;

/** Transition between the track and a station. Its time is its own split, so don't dawdle. */
export class RoxzoneScene extends SegmentScene {
  private athlete!: Phaser.GameObjects.Arc;

  constructor() {
    super('Roxzone');
  }

  create(): void {
    this.beginSegment('hold W / → to jog (walking is slower but easier)');
    const segment = this.session.segment;
    const index = segment?.kind === 'roxzone' ? segment.index : 0;
    const into = segment?.kind === 'roxzone' && segment.leg === 'in';
    const destination = into ? STATIONS[index].name.toUpperCase() : `RUN ${index + 2}`;
    const origin = into ? `RUN ${index + 1}` : STATIONS[index].name.toUpperCase();

    this.add.text(LANE_LEFT, 120, 'ROXZONE', textStyle(34, hex(COLORS.accent), { fontStyle: 'bold' }));
    this.add.text(LANE_LEFT, 165, 'Transition time counts towards your result.', textStyle(16, hex(COLORS.muted)));

    const g = this.add.graphics();
    g.fillStyle(COLORS.floor);
    g.fillRect(LANE_LEFT, LANE_Y - 40, LANE_RIGHT - LANE_LEFT, 80);
    g.lineStyle(2, COLORS.panelEdge);
    g.strokeRect(LANE_LEFT, LANE_Y - 40, LANE_RIGHT - LANE_LEFT, 80);
    for (let x = LANE_LEFT + 60; x < LANE_RIGHT; x += 60) g.fillStyle(0x3a3e47).fillTriangle(x, LANE_Y - 8, x, LANE_Y + 8, x + 12, LANE_Y);

    this.add.text(LANE_LEFT, LANE_Y + 52, `from ${origin}`, textStyle(14, hex(COLORS.muted)));
    this.add.text(LANE_RIGHT, LANE_Y + 52, `${destination} →`, textStyle(18, '#ffffff', { fontStyle: 'bold' })).setOrigin(1, 0);

    this.athlete = this.add.circle(LANE_LEFT, LANE_Y, 11, COLORS.accent).setStrokeStyle(2, 0x000000);

    this.input.keyboard!.addCapture('UP,RIGHT');
  }

  update(_time: number, delta: number): void {
    const jogging = isHeld('KeyW', 'KeyD', 'ArrowRight', 'ArrowUp');
    if (this.advance(delta, jogging ? JOG_EFFORT : WALK_EFFORT)) return;
    const t = this.session.progress / ROXZONE_DISTANCE_M;
    this.athlete.setX(LANE_LEFT + 12 + t * (LANE_RIGHT - LANE_LEFT - 24));
  }
}
