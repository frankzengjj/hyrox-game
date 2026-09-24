import type * as Phaser from 'phaser';
import { BODY } from './body';
import { type Ctx, canvasTexture, cylinder, limbPath, outline, smoothPath } from './draw';
import type { Kit } from './palette';

export type PartName = 'thigh' | 'shin' | 'foot' | 'upperArm' | 'forearm' | 'torso' | 'head';

/** Where each part pivots (its joint), as a fraction of its frame size. */
const origins = new Map<string, { x: number; y: number }>();

/** Texture key of a kit's atlas; each part is a frame named after the part. */
export const atlasKey = (kitId: string) => `athlete-${kitId}`;
export const partOrigin = (kitId: string, part: PartName) => origins.get(`${kitId}/${part}`) ?? { x: 0.5, y: 0.5 };

interface PartSpec {
  name: PartName;
  w: number;
  h: number;
  /** Joint position inside the frame. */
  ox: number;
  oy: number;
  draw: (ctx: Ctx) => void;
}

/**
 * All of a kit's limb segments in one atlas texture. Each is drawn pointing along +x
 * from its proximal joint (torso and head point up), shaded as a cylinder so it reads
 * as 3D whichever way it rotates.
 */
export function createAthleteTextures(scene: Phaser.Scene, kitId: string, kit: Kit): void {
  const specs: PartSpec[] = [];
  const part = (name: PartName, w: number, h: number, ox: number, oy: number, draw: (ctx: Ctx) => void) =>
    specs.push({ name, w, h, ox, oy, draw });

  // Thigh with running shorts over the top half.
  part('thigh', BODY.thigh + 26, 36, 12, 18, (ctx) => {
    const len = BODY.thigh;
    limbPath(ctx, len, 10, 6.5, { at: 0.3, top: 2.2, bottom: 1.4 });
    ctx.fillStyle = cylinder(ctx, 12, kit.skin);
    ctx.fill();
    outline(ctx);
    ctx.beginPath();
    ctx.moveTo(-11, -13);
    ctx.lineTo(len * 0.6, -11.5);
    ctx.lineTo(len * 0.62, 11);
    ctx.lineTo(-11, 13);
    ctx.closePath();
    ctx.fillStyle = cylinder(ctx, 13, kit.shorts);
    ctx.fill();
    outline(ctx, 0.6);
    ctx.fillStyle = kit.accent;
    ctx.fillRect(len * 0.6 - 3, -11, 2, 22);
  });

  // Shin with calf, sock at the ankle.
  part('shin', BODY.shin + 18, 28, 9, 14, (ctx) => {
    const len = BODY.shin;
    limbPath(ctx, len, 7, 4.5, { at: 0.28, top: 0.4, bottom: 2.6 });
    ctx.fillStyle = cylinder(ctx, 10, kit.skin);
    ctx.fill();
    outline(ctx);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = kit.sock;
    ctx.fillRect(len * 0.74, -12, 20, 24);
    ctx.fillStyle = kit.accent;
    ctx.fillRect(len * 0.74, -12, 2, 24);
    ctx.restore();
  });

  // Running shoe, ankle joint at the origin, toe pointing +x, sole flat at y = ankle height.
  part('foot', 52, 26, 14, 12, (ctx) => {
    const a = BODY.ankle;
    smoothPath(ctx, [
      [-11, a - 1],
      [-11, -2],
      [-5, -7],
      [4, -6],
      [12, -2],
      [21, 1],
      [27, 4],
      [28, a - 1],
    ]);
    ctx.fillStyle = cylinder(ctx, 8, kit.shoe);
    ctx.fill();
    outline(ctx, 0.6);
    ctx.fillStyle = kit.sole;
    ctx.beginPath();
    ctx.roundRect(-12, a - 3, 41, 4.5, 2);
    ctx.fill();
    outline(ctx, 0.35);
    ctx.strokeStyle = kit.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 1);
    ctx.quadraticCurveTo(6, 4, 18, 0);
    ctx.stroke();
  });

  // Upper arm (bare, tank top): deltoid, biceps, triceps.
  part('upperArm', BODY.upperArm + 20, 28, 10, 14, (ctx) => {
    limbPath(ctx, BODY.upperArm, 7.8, 5, { at: 0.38, top: 1.6, bottom: 1.8 });
    ctx.fillStyle = cylinder(ctx, 10, kit.skin);
    ctx.fill();
    outline(ctx);
  });

  // Forearm plus fist; the fist sits at wrist + grip.
  part('forearm', BODY.forearm + 22, 24, 8, 12, (ctx) => {
    const len = BODY.forearm;
    limbPath(ctx, len, 5.6, 3.8, { at: 0.25, top: 1.4, bottom: 0.6 });
    ctx.fillStyle = cylinder(ctx, 8, kit.skin);
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = kit.shirt.base;
    ctx.fillRect(len - 5, -4.6, 4, 9.2);
    ctx.beginPath();
    ctx.roundRect(len + BODY.grip - 5, -5.2, 10, 10.4, 4);
    ctx.fillStyle = cylinder(ctx, 6, { ...kit.skin, base: kit.skin.shadow });
    ctx.fill();
    outline(ctx);
  });

  // Torso in profile facing right, hip joint at the origin, neck up to the skull.
  part('torso', 50, 96, 22, 78, (ctx) => {
    const top = -(BODY.torso + BODY.neck);
    smoothPath(ctx, [
      [4, 15],
      [10, 3],
      [11.5, -14],
      [13.5, -30],
      [16, -42],
      [12, -53],
      [5.5, -60],
      [5, top],
      [-3, top],
      [-4, -61],
      [-11, -55],
      [-14.5, -44],
      [-12, -28],
      [-10, -14],
      [-14, -2],
      [-15, 8],
      [-8, 16],
    ]);
    ctx.fillStyle = kit.skin.base;
    ctx.fill();
    outline(ctx, 0.5);
    ctx.save();
    ctx.clip();
    // Tank top.
    ctx.beginPath();
    ctx.moveTo(-22, -57);
    ctx.lineTo(-5, -57);
    ctx.quadraticCurveTo(2, -49, 14, -50);
    ctx.lineTo(22, -52);
    ctx.lineTo(22, -5);
    ctx.lineTo(-22, -5);
    ctx.closePath();
    ctx.fillStyle = kit.shirt.base;
    ctx.fill();
    ctx.fillStyle = kit.accent;
    ctx.fillRect(-2, -50, 2.5, 45);
    // Shorts.
    ctx.fillStyle = kit.shorts.base;
    ctx.fillRect(-22, -6, 44, 30);
    ctx.fillStyle = kit.shorts.light;
    ctx.fillRect(-22, -6, 44, 2.5);
    // Volume: darker back, lighter chest.
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(-16, 0, 17, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(-22, top, 44, 100);
    ctx.restore();
  });

  // Head in profile facing right, pivot at the top of the neck.
  part('head', 44, 46, 18, 38, (ctx) => {
    const face: [number, number][] = [
      [4, 2],
      [9.5, -4],
      [12, -9],
      [12.5, -11.5],
      [15, -14],
      [12.5, -17],
      [12.8, -21],
      [10.5, -27],
      [3, -32],
      [-6, -31],
      [-11.5, -24],
      [-11.5, -15],
      [-7.5, -8],
      [-5, 2],
    ];
    smoothPath(ctx, face);
    ctx.fillStyle = cylinder(ctx, 14, kit.skin, false);
    ctx.fill();
    outline(ctx, 0.55);
    ctx.save();
    ctx.clip();
    // Hair: short cut covering the crown and back of the skull.
    ctx.fillStyle = kit.hair;
    ctx.beginPath();
    ctx.moveTo(-16, -8);
    ctx.lineTo(-6, -12);
    ctx.quadraticCurveTo(2, -26, 12, -25);
    ctx.lineTo(14, -40);
    ctx.lineTo(-16, -40);
    ctx.closePath();
    ctx.fill();
    // Headband.
    ctx.fillStyle = kit.accent;
    ctx.beginPath();
    ctx.moveTo(-14, -21);
    ctx.lineTo(14, -26.5);
    ctx.lineTo(14, -22.5);
    ctx.lineTo(-14, -17);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Ear, eye, brow, mouth.
    ctx.fillStyle = kit.skin.shadow;
    ctx.beginPath();
    ctx.ellipse(-2.5, -14, 2.6, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1310';
    ctx.beginPath();
    ctx.ellipse(8.8, -16.6, 1.3, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = kit.hair;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(6.5, -19.2);
    ctx.lineTo(11.5, -19.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,25,15,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, -8.6);
    ctx.lineTo(12.4, -8.9);
    ctx.stroke();
  });

  const GAP = 2;
  const width = specs.reduce((sum, p) => sum + p.w + GAP, 0);
  const height = Math.max(...specs.map((p) => p.h));
  const key = atlasKey(kitId);
  canvasTexture(scene, key, width, height, (ctx) => {
    let x = 0;
    for (const p of specs) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, 0, p.w, p.h);
      ctx.clip();
      ctx.translate(x + p.ox, p.oy);
      p.draw(ctx);
      ctx.restore();
      x += p.w + GAP;
    }
  });
  const texture = scene.textures.get(key);
  let x = 0;
  for (const p of specs) {
    texture.add(p.name, 0, x, 0, p.w, p.h);
    origins.set(`${kitId}/${p.name}`, { x: p.ox / p.w, y: p.oy / p.h });
    x += p.w + GAP;
  }
}
