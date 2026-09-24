import type * as Phaser from 'phaser';
import { textStyle } from './theme';

/** Short-lived judgement text that drifts up and fades. */
export function popup(scene: Phaser.Scene, x: number, y: number, text: string, color: string, size = 18): void {
  const label = scene.add
    .text(x, y, text, textStyle(size, color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }))
    .setOrigin(0, 0.5)
    .setDepth(800);
  scene.tweens.add({ targets: label, y: y - 12, alpha: 0, duration: 650, ease: 'Cubic.out', onComplete: () => label.destroy() });
}
