import * as Phaser from 'phaser';
import { gaitFrequency, locomotionPose } from '../art/poses';
import { AthleteRig } from '../art/rig';
import { STAGE } from '../art/stage';
import { addShadow, addVenue } from '../art/venue';
import { ROXZONE_DISTANCE_M, TIME_SCALE } from '../config/race';
import { STATIONS } from '../config/stations';
import { isHeld } from '../ui/heldKeys';
import { COLORS, hex, textStyle } from '../ui/theme';
import { SegmentScene } from './SegmentScene';

const WALK_EFFORT = 0.2;
const JOG_EFFORT = 0.5;
const START_X = 70;
const END_X = 610;

/** Transition between the track and a station, walked across the arena floor. Its time is its own split. */
export class RoxzoneScene extends SegmentScene {
  private rig!: AthleteRig;
  private shadow!: Phaser.GameObjects.Ellipse;
  private phase = 0;

  constructor() {
    super('Roxzone');
  }

  create(): void {
    this.beginSegment('hold W / → to jog (walking is slower but lets you recover)');
    const segment = this.session.segment;
    const index = segment?.kind === 'roxzone' ? segment.index : 0;
    const into = segment?.kind === 'roxzone' && segment.leg === 'in';
    const destination = into ? STATIONS[index].name.toUpperCase() : `RUN ${index + 2}`;

    const venue = addVenue(this);
    venue.setScreen('ROXZONE', `next: ${destination.toLowerCase()}`);

    // Floor markings and the sign at the lane entrance.
    const g = this.add.graphics();
    g.fillStyle(COLORS.accent, 0.8);
    for (let x = START_X + 40; x < END_X; x += 70) {
      g.fillTriangle(x, STAGE.floorY + 22, x, STAGE.floorY + 36, x + 14, STAGE.floorY + 29);
    }
    this.add.text(START_X, STAGE.floorY + 44, 'ROXZONE', textStyle(22, hex(COLORS.accent), { fontStyle: 'bold' })).setAlpha(0.35);
    const signX = END_X + 80;
    g.fillStyle(0x1c1f25).fillRect(signX - 4, STAGE.floorY - 150, 8, 150);
    this.add.rectangle(signX, STAGE.floorY - 168, 150, 42, 0x111317).setStrokeStyle(2, COLORS.accent);
    this.add.text(signX, STAGE.floorY - 168, `${destination} →`, textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);

    this.shadow = addShadow(this, START_X);
    this.rig = new AthleteRig(this);
    this.phase = 0;
  }

  update(_time: number, delta: number): void {
    const jogging = isHeld('KeyW', 'KeyD', 'ArrowRight', 'ArrowUp');
    if (this.advance(delta, jogging ? JOG_EFFORT : WALK_EFFORT)) return;
    const { progress, rate } = this.session;
    const x = START_X + (progress / ROXZONE_DISTANCE_M) * (END_X - START_X);
    // Screen speed of the athlete, so the stride matches the ground covered.
    const speed = (rate * TIME_SCALE * (END_X - START_X)) / ROXZONE_DISTANCE_M;
    const gait = jogging ? 'run' : 'walk';
    this.phase += (Math.min(delta, 100) / 1000) * gaitFrequency(speed, gait);
    this.rig.setPose(locomotionPose(x, STAGE.floorY, this.phase, speed, gait));
    this.shadow.setX(x);
  }
}
