import type * as Phaser from 'phaser';
import { PX_PER_M } from './body';
import { type Ctx, canvasTexture, cylinder, glow, outline, seededRandom } from './draw';
import { MACHINE, STEEL } from './palette';

const ACCENT = '#ffd400';

/** Layout of equipment textures (px, from the texture's top-left) that scenes attach things to. */
export const EQUIPMENT = {
  skierg: { w: 124, h: 262, pulley: { x: 60, y: 16 }, monitor: { x: 29, y: 95, w: 26, h: 18 } },
  rower: { w: 340, h: 112, footplate: { x: 246, y: 82 }, chainExit: { x: 262, y: 62 }, railY: (x: number) => 80 - (x / 250) * 8, monitor: { x: 238, y: 16, w: 28, h: 18 } },
  sled: { w: 132, h: 124, handles: { x: 16, y: 10 }, hitch: { x: 124, y: 100 } },
  wallBallRig: { w: 80, h: 380 },
  lapGate: { w: 40, h: 300 },
} as const;

export function createEquipmentTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'skierg', EQUIPMENT.skierg.w, EQUIPMENT.skierg.h, drawSkiErg);
  canvasTexture(scene, 'rower', EQUIPMENT.rower.w, EQUIPMENT.rower.h, drawRower);
  canvasTexture(scene, 'rower-seat', 34, 12, (ctx) => {
    ctx.beginPath();
    ctx.roundRect(1, 1, 32, 8, 4);
    ctx.fillStyle = cylinder(ctx, 5, MACHINE);
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#555';
    ctx.fillRect(8, 9, 18, 3);
  });
  canvasTexture(scene, 'sled', EQUIPMENT.sled.w, EQUIPMENT.sled.h, drawSled);
  canvasTexture(scene, 'turf', 256, 34, drawTurf);
  canvasTexture(scene, 'wallball-rig', EQUIPMENT.wallBallRig.w, EQUIPMENT.wallBallRig.h, drawWallBallRig);
  canvasTexture(scene, 'wallball-target', 30, 60, drawTarget);
  canvasTexture(scene, 'medball', 40, 40, drawMedBall);
  canvasTexture(scene, 'kettlebell', 36, 46, drawKettlebell);
  canvasTexture(scene, 'sandbag', 78, 30, drawSandbag);
  canvasTexture(scene, 'lap-gate', EQUIPMENT.lapGate.w, EQUIPMENT.lapGate.h, drawLapGate);
}

function steelRect(ctx: Ctx, x: number, y: number, w: number, h: number, tone = MACHINE, vertical = false): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.3);
  ctx.fillStyle = cylinder(ctx, (vertical ? w : h) / 2, tone, !vertical);
  ctx.fill();
  outline(ctx, 0.6);
  ctx.restore();
}

function drawSkiErg(ctx: Ctx): void {
  const { h } = EQUIPMENT.skierg;
  // Floor stand the athlete stands on.
  steelRect(ctx, 0, h - 10, 118, 9);
  ctx.fillStyle = '#2e333b';
  ctx.fillRect(4, h - 11, 60, 2);
  // Tower.
  steelRect(ctx, 72, 40, 20, h - 48, MACHINE, true);
  // Monitor arm and screen.
  steelRect(ctx, 44, 102, 30, 6);
  ctx.save();
  ctx.translate(40, 104);
  ctx.rotate(-0.12);
  ctx.beginPath();
  ctx.roundRect(-16, -14, 34, 28, 4);
  ctx.fillStyle = '#16181c';
  ctx.fill();
  outline(ctx, 0.8);
  ctx.fillStyle = '#9fb49a';
  ctx.fillRect(-12, -10, 26, 18);
  ctx.restore();
  // Flywheel housing with fan grille.
  ctx.beginPath();
  ctx.roundRect(56, 0, 60, 74, 10);
  ctx.fillStyle = cylinder(ctx, 30, MACHINE, false);
  ctx.save();
  ctx.translate(86, 37);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = MACHINE.base;
  ctx.beginPath();
  ctx.roundRect(56, 0, 60, 74, 10);
  ctx.fill();
  outline(ctx, 0.7);
  ctx.strokeStyle = '#3a3f48';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(88, 38, 22, 0, Math.PI * 2);
  ctx.stroke();
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
    ctx.beginPath();
    ctx.moveTo(88 + Math.cos(a) * 7, 38 + Math.sin(a) * 7);
    ctx.lineTo(88 + Math.cos(a) * 20, 38 + Math.sin(a) * 20);
    ctx.stroke();
  }
  ctx.fillStyle = ACCENT;
  ctx.fillRect(58, 66, 56, 3);
  // Pulleys where the cords come out.
  for (const dy of [0, 8]) {
    ctx.beginPath();
    ctx.arc(62, 12 + dy, 5, 0, Math.PI * 2);
    ctx.fillStyle = STEEL.shadow;
    ctx.fill();
    outline(ctx);
  }
}

function drawRower(ctx: Ctx): void {
  const r = EQUIPMENT.rower;
  // Monorail.
  ctx.save();
  ctx.translate(0, 0);
  ctx.beginPath();
  ctx.moveTo(4, r.railY(4) - 4);
  ctx.lineTo(252, r.railY(252) - 4);
  ctx.lineTo(252, r.railY(252) + 5);
  ctx.lineTo(4, r.railY(4) + 5);
  ctx.closePath();
  const rail = ctx.createLinearGradient(0, 70, 0, 86);
  rail.addColorStop(0, STEEL.light);
  rail.addColorStop(1, STEEL.shadow);
  ctx.fillStyle = rail;
  ctx.fill();
  outline(ctx);
  ctx.restore();
  // Rear leg and front base.
  steelRect(ctx, 2, r.railY(0) + 4, 12, r.h - r.railY(0) - 5, MACHINE, true);
  steelRect(ctx, 236, 96, 100, 12);
  // Footplates.
  ctx.save();
  ctx.translate(r.footplate.x, r.footplate.y - 8);
  ctx.rotate(-0.75);
  steelRect(ctx, -16, -5, 34, 10);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(-10, -6, 20, 2);
  ctx.restore();
  // Flywheel cage.
  ctx.beginPath();
  ctx.arc(292, 62, 34, 0, Math.PI * 2);
  ctx.fillStyle = MACHINE.base;
  ctx.fill();
  outline(ctx, 0.8);
  ctx.strokeStyle = '#3a3f48';
  ctx.lineWidth = 2;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    ctx.beginPath();
    ctx.moveTo(292 + Math.cos(a) * 8, 62 + Math.sin(a) * 8);
    ctx.lineTo(292 + Math.cos(a) * 31, 62 + Math.sin(a) * 31);
    ctx.stroke();
  }
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(292, 62, 6, 0, Math.PI * 2);
  ctx.fill();
  // Monitor arm.
  ctx.strokeStyle = MACHINE.light;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(280, 34);
  ctx.quadraticCurveTo(270, 10, 256, 24);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(r.monitor.x - 4, r.monitor.y - 4, r.monitor.w + 8, r.monitor.h + 8, 3);
  ctx.fillStyle = '#16181c';
  ctx.fill();
  outline(ctx, 0.8);
  ctx.fillStyle = '#9fb49a';
  ctx.fillRect(r.monitor.x, r.monitor.y, r.monitor.w, r.monitor.h);
}

function drawSled(ctx: Ctx): void {
  const { w, h } = EQUIPMENT.sled;
  // Skids with an upturned front.
  ctx.beginPath();
  ctx.moveTo(4, h - 8);
  ctx.lineTo(w - 22, h - 8);
  ctx.quadraticCurveTo(w - 6, h - 8, w - 4, h - 22);
  ctx.lineTo(w - 10, h - 22);
  ctx.quadraticCurveTo(w - 12, h - 2, w - 22, h - 2);
  ctx.lineTo(4, h - 2);
  ctx.closePath();
  ctx.fillStyle = STEEL.base;
  ctx.fill();
  outline(ctx);
  // Body.
  steelRect(ctx, 12, h - 34, w - 34, 26);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(14, h - 32, w - 38, 3);
  // Push poles.
  steelRect(ctx, 11, 6, 10, h - 36, STEEL, true);
  steelRect(ctx, 5, 4, 20, 10, MACHINE);
  // Weight plates standing on the horn.
  for (let i = 0; i < 3; i++) {
    const x = 50 + i * 12;
    ctx.beginPath();
    ctx.roundRect(x, h - 88, 10, 56, 3);
    ctx.fillStyle = cylinder(ctx, 5, MACHINE, false);
    ctx.save();
    ctx.translate(x + 5, 0);
    ctx.restore();
    ctx.fillStyle = i === 1 ? '#2d3138' : '#1f2227';
    ctx.fill();
    outline(ctx, 0.7);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 2, h - 84, 2, 48);
  }
  // Hitch ring for the rope.
  ctx.strokeStyle = STEEL.light;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(w - 8, h - 24, 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTurf(ctx: Ctx): void {
  const w = 256;
  const h = 34;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1f2a22');
  g.addColorStop(1, '#141b16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rand = seededRandom(11);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(90,120,95,0.25)' : 'rgba(0,0,0,0.3)';
    ctx.fillRect(rand() * w, rand() * h, 1, 2);
  }
  ctx.fillStyle = 'rgba(236,236,236,0.7)';
  ctx.fillRect(0, 0, w, 2);
  ctx.fillRect(0, h - 2, w, 2);
}

function drawWallBallRig(ctx: Ctx): void {
  const { h } = EQUIPMENT.wallBallRig;
  steelRect(ctx, 6, h - 10, 70, 9);
  steelRect(ctx, 44, 0, 16, h - 8, MACHINE, true);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let y = 20; y < h - 20; y += 30) ctx.fillRect(49, y, 6, 3);
}

function drawTarget(ctx: Ctx): void {
  const cx = 15;
  const cy = 30;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.42, 1);
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#15171b';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = ACCENT;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#f2f2f2';
  ctx.fill();
  ctx.restore();
}

function drawMedBall(ctx: Ctx): void {
  const g = ctx.createRadialGradient(15, 14, 2, 20, 20, 20);
  g.addColorStop(0, '#5b606a');
  g.addColorStop(0.6, '#2a2d33');
  g.addColorStop(1, '#141518');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(20, 20, 18, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.7);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(20, 20, 7, 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.fillRect(10, 18, 20, 4);
}

function drawKettlebell(ctx: Ctx): void {
  ctx.strokeStyle = '#26292e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(18, 12, 9, Math.PI, 0);
  ctx.lineTo(27, 20);
  ctx.moveTo(9, 12);
  ctx.lineTo(9, 20);
  ctx.stroke();
  const g = ctx.createRadialGradient(13, 26, 2, 18, 30, 16);
  g.addColorStop(0, '#5c616b');
  g.addColorStop(1, '#16181c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(18, 30, 14, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.7);
  ctx.fillStyle = '#16181c';
  ctx.fillRect(10, 42, 16, 3);
}

function drawSandbag(ctx: Ctx): void {
  ctx.beginPath();
  ctx.roundRect(2, 4, 74, 22, 11);
  ctx.save();
  ctx.translate(0, 15);
  ctx.fillStyle = cylinder(ctx, 11, { base: '#2d3226', light: '#4a5240', shadow: '#15180f' });
  ctx.restore();
  ctx.fill();
  outline(ctx, 0.6);
  ctx.strokeStyle = ACCENT;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 8);
  ctx.lineTo(70, 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  for (const x of [22, 56]) {
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, 26);
    ctx.stroke();
  }
}

function drawLapGate(ctx: Ctx): void {
  const { w, h } = EQUIPMENT.lapGate;
  steelRect(ctx, 12, 30, 16, h - 34, MACHINE, true);
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 36, 4);
  ctx.fillStyle = '#111317';
  ctx.fill();
  outline(ctx, 0.8);
  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAP', w / 2, 23);
  glow(ctx, w / 2, 18, 22, '#ffd400', 0.12);
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.arc(w / 2, 44, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** Metres to px at station scale, for placing equipment. */
export const m = (metres: number) => metres * PX_PER_M;
