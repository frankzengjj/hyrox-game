import * as Phaser from 'phaser';
import { WIDTH, textStyle } from '../ui/theme';
import { STAGE } from './stage';
import { BARRIER_H, CROWD_H, FLOOR_H } from './venueTextures';

/** Parallax factors: the crowd is far away, the barrier is just behind the lane. */
const CROWD_PARALLAX = 0.35;
const BARRIER_PARALLAX = 0.85;

export interface Venue {
  /** Scroll the world by `x` px (as seen at the athlete's depth). */
  scroll(x: number): void;
  /** Text on the big screen above the arena. */
  setScreen(title: string, subtitle?: string): void;
}

/** Adds the arena backdrop (hall, crowd, barrier boards, floor) behind everything else. */
export function addVenue(scene: Phaser.Scene): Venue {
  scene.add.image(0, 0, 'hall').setOrigin(0);
  const crowd = scene.add.tileSprite(0, STAGE.crowdTop, WIDTH, CROWD_H, 'crowd').setOrigin(0);
  const barrier = scene.add.tileSprite(0, STAGE.barrierTop, WIDTH, BARRIER_H, 'barrier').setOrigin(0);
  const floor = scene.add.tileSprite(0, STAGE.floorTop, WIDTH, FLOOR_H, 'floor').setOrigin(0);

  const screen = scene.add.rectangle(304, 108, 352, 70, 0x10152a).setOrigin(0).setVisible(false);
  const title = scene.add.text(480, 132, '', textStyle(30, '#ffd400', { fontStyle: 'bold' })).setOrigin(0.5);
  const subtitle = scene.add.text(480, 162, '', textStyle(14, '#c9d2ff')).setOrigin(0.5);

  // The crowd sways a little so the arena feels alive.
  scene.tweens.add({ targets: crowd, y: STAGE.crowdTop - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

  return {
    scroll(x: number) {
      crowd.tilePositionX = x * CROWD_PARALLAX;
      barrier.tilePositionX = x * BARRIER_PARALLAX;
      floor.tilePositionX = x;
    },
    setScreen(text: string, sub = '') {
      screen.setVisible(true);
      title.setText(text);
      subtitle.setText(sub);
    },
  };
}

/** Soft contact shadow under an athlete or object. */
export function addShadow(scene: Phaser.Scene, x: number, width = 70): Phaser.GameObjects.Ellipse {
  return scene.add.ellipse(x, STAGE.floorY + 2, width, 12, 0x000000, 0.4);
}

/** Red edges that pulse with the heartbeat as lactate builds. Call the returned function every frame. */
export function addStrainOverlay(scene: Phaser.Scene): (lactate: number, hr: number) => void {
  const overlay = scene.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0).setDepth(900);
  return (lactate, hr) => {
    const strain = Phaser.Math.Clamp((lactate - 0.3) * 1.2, 0, 0.75);
    const beat = Math.sin((scene.time.now / 1000) * (hr / 60) * Math.PI * 2);
    overlay.setAlpha(strain * (0.8 + 0.2 * beat));
  };
}
