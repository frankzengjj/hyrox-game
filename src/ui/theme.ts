import type * as Phaser from 'phaser';

export const WIDTH = 960;
export const HEIGHT = 540;

export const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelEdge: 0x2c2f37,
  track: 0x9c3b2e,
  trackLine: 0xe8e2d6,
  infield: 0x1d3326,
  floor: 0x2a2d34,
  accent: 0xffd400,
  muted: 0x9aa0a6,
  good: 0x5cc05c,
  bad: 0xe5484d,
};

/** Heart-rate zone colours, index 0 = zone 1. */
export const ZONE_COLORS = [0x9aa0a6, 0x4f9dde, 0x5cc05c, 0xf5a623, 0xe5484d];

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function textStyle(
  size: number,
  color = '#f2f2f2',
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2, ...extra };
}

export function monoStyle(size: number, color = '#f2f2f2'): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: MONO, fontSize: `${size}px`, color, resolution: 2 };
}
