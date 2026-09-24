import type * as Phaser from 'phaser';
import type { Tone } from './palette';

export type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

/** Draws into a new canvas texture (replacing any texture with that key). */
export function canvasTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, Math.ceil(width), Math.ceil(height));
  if (!texture) throw new Error(`Could not create texture ${key}`);
  draw(texture.context);
  texture.refresh();
}

/** Deterministic PRNG (mulberry32) so generated crowds look the same every run. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Closed smooth outline through the points (Catmull-Rom converted to Béziers). */
export function smoothPath(ctx: Ctx, pts: Pt[]): void {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
  ctx.closePath();
}

export interface Bulge {
  /** Position along the limb, 0..1. */
  at?: number;
  /** Extra width on the -y side (front of a hanging limb). */
  top?: number;
  /** Extra width on the +y side (back of a hanging limb). */
  bottom?: number;
}

/** Tapered, rounded limb along +x from (0,0) to (len,0). */
export function limbPath(ctx: Ctx, len: number, r0: number, r1: number, { at = 0.35, top = 0, bottom = 0 }: Bulge = {}): void {
  const rm = r0 + (r1 - r0) * at;
  ctx.beginPath();
  ctx.moveTo(0, -r0);
  ctx.quadraticCurveTo(len * at, -(rm + 2 * top), len, -r1);
  ctx.arc(len, 0, r1, -Math.PI / 2, Math.PI / 2);
  ctx.quadraticCurveTo(len * at, rm + 2 * bottom, 0, r0);
  ctx.arc(0, 0, r0, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

/** Gradient across a limb (or any shape) of the given half-width: rim shadow, highlight, body. */
export function cylinder(ctx: Ctx, half: number, tone: Tone, vertical = true): CanvasGradient {
  const g = vertical ? ctx.createLinearGradient(0, -half, 0, half) : ctx.createLinearGradient(-half, 0, half, 0);
  g.addColorStop(0, tone.shadow);
  g.addColorStop(0.28, tone.light);
  g.addColorStop(0.55, tone.base);
  g.addColorStop(1, tone.shadow);
  return g;
}

export function outline(ctx: Ctx, alpha = 0.45, width = 1): void {
  ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Soft radial glow (light sources, spotlights). */
export function glow(ctx: Ctx, x: number, y: number, radius: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** '#rrggbb' + alpha → 'rgba(...)'. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
