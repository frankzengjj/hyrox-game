import * as Phaser from 'phaser';
import { DEBUG } from './scenes/flow';
import { BootScene } from './scenes/BootScene';
import { GalleryScene } from './scenes/GalleryScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultsScene } from './scenes/ResultsScene';
import { RoxzoneScene } from './scenes/RoxzoneScene';
import { RunScene } from './scenes/RunScene';
import { StationScene } from './scenes/StationScene';
import { COLORS, HEIGHT, WIDTH, hex } from './ui/theme';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: hex(COLORS.bg),
  // Right-click will be a control (farmers carry grips), so keep the browser menu out of the way.
  disableContextMenu: true,
  // Phaser 4's multi-texture batching dropped triangles from some sprites (seen in Chromium);
  // one texture per batch costs a few extra draw calls, which these scenes can easily afford.
  render: { maxTextures: 1 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Scenes render in this order, so the HUD (last) draws over the segment scenes.
  scene: [BootScene, MenuScene, RunScene, RoxzoneScene, StationScene, ResultsScene, GalleryScene, HudScene],
});

// Handy for poking at the game from the console (and for browser tests).
if (DEBUG) Object.assign(window, { game });
