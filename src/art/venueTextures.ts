import type * as Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../ui/theme';
import { canvasTexture, glow, seededRandom, withAlpha } from './draw';
import { STAGE } from './stage';

export const CROWD_W = 1024;
export const CROWD_H = STAGE.barrierTop - STAGE.crowdTop + 8;
export const BARRIER_H = STAGE.floorTop - STAGE.barrierTop;
export const FLOOR_H = HEIGHT - STAGE.floorTop;

const ACCENT = '#ffd400';

/** Arena: hall and lights (static), plus tileable crowd, barrier boards and floor for scrolling. */
export function createVenueTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'hall', WIDTH, HEIGHT, drawHall);
  canvasTexture(scene, 'crowd', CROWD_W, CROWD_H, (ctx) => {
    // Drawn sharp off-screen, then blurred and dimmed like a background out of focus.
    const sharp = document.createElement('canvas');
    sharp.width = CROWD_W;
    sharp.height = CROWD_H;
    drawCrowd(sharp.getContext('2d')!);
    ctx.filter = 'blur(1.1px) brightness(0.72) saturate(0.8)';
    ctx.drawImage(sharp, 0, 0);
    ctx.filter = 'none';
  });
  canvasTexture(scene, 'barrier', 1024, BARRIER_H, drawBarrier);
  canvasTexture(scene, 'floor', 512, FLOOR_H, drawFloor);
  canvasTexture(scene, 'vignette', WIDTH, HEIGHT, (ctx) => {
    const g = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 220, WIDTH / 2, HEIGHT / 2, 620);
    g.addColorStop(0, 'rgba(110,0,0,0)');
    g.addColorStop(1, 'rgba(90,0,0,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  });
}

function drawHall(ctx: CanvasRenderingContext2D): void {
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#050608');
  bg.addColorStop(0.45, '#10131a');
  bg.addColorStop(0.7, '#191d26');
  bg.addColorStop(1, '#0d0f13');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Back truss with bracing.
  ctx.strokeStyle = '#2a2f38';
  ctx.lineWidth = 3;
  for (const y of [70, 88]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < WIDTH; x += 18) {
    ctx.moveTo(x, 70);
    ctx.lineTo(x + 9, 88);
    ctx.lineTo(x + 18, 70);
  }
  ctx.stroke();

  // Big screen.
  const sx = 300;
  const sy = 104;
  const sw = 360;
  const sh = 78;
  glow(ctx, sx + sw / 2, sy + sh / 2, 260, '#3a5cff', 0.12);
  ctx.fillStyle = '#0b0e18';
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, 4);
  ctx.fill();
  ctx.strokeStyle = '#2b3140';
  ctx.lineWidth = 3;
  ctx.stroke();
  const screen = ctx.createLinearGradient(0, sy, 0, sy + sh);
  screen.addColorStop(0, '#141a2e');
  screen.addColorStop(1, '#0a0d17');
  ctx.fillStyle = screen;
  ctx.fillRect(sx + 4, sy + 4, sw - 8, sh - 8);
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT;
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 12;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('RACE DAY', sx + sw / 2, sy + 44);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#c9d2ff';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText('8 × 1 KM   ·   8 STATIONS', sx + sw / 2, sy + 66);
  // LED pixel grid.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = sy + 4; y < sy + sh - 4; y += 3) ctx.fillRect(sx + 4, y, sw - 8, 1);

  // Spotlights on the truss, with haze cones.
  ctx.globalCompositeOperation = 'lighter';
  for (const x of [70, 200, 330, 630, 760, 890]) {
    const cone = ctx.createLinearGradient(0, 90, 0, 420);
    cone.addColorStop(0, 'rgba(255,240,210,0.10)');
    cone.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 6, 92);
    ctx.lineTo(x + 6, 92);
    ctx.lineTo(x + 70, 420);
    ctx.lineTo(x - 70, 420);
    ctx.closePath();
    ctx.fill();
    glow(ctx, x, 94, 26, '#fff4dc', 0.5);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const x of [70, 200, 330, 630, 760, 890]) {
    ctx.fillStyle = '#1c1f25';
    ctx.fillRect(x - 7, 84, 14, 8);
  }
}

function drawCrowd(ctx: CanvasRenderingContext2D): void {
  const rand = seededRandom(7);
  // Tiered stands, back rows smaller and darker.
  const rows = [
    { y: 44, scale: 0.62, shade: 0.42 },
    { y: 76, scale: 0.72, shade: 0.52 },
    { y: 110, scale: 0.84, shade: 0.64 },
    { y: 146, scale: 0.96, shade: 0.78 },
  ];
  const stand = ctx.createLinearGradient(0, 0, 0, CROWD_H);
  stand.addColorStop(0, 'rgba(20,23,30,0)');
  stand.addColorStop(0.25, 'rgba(20,23,30,0.9)');
  stand.addColorStop(1, '#1a1e26');
  ctx.fillStyle = stand;
  ctx.fillRect(0, 0, CROWD_W, CROWD_H);

  const shirtColors = ['#2b3442', '#3c2f2f', '#2f3b33', '#3a3a44', '#46412e', '#523a2c', '#d8c24a', '#c9ccd2', '#8e3434', '#2e4a73'];
  const skinColors = ['#c89572', '#9b6a4b', '#6e4a35', '#e0b391', '#b07c5a'];
  for (const row of rows) {
    // Seat step.
    ctx.fillStyle = withAlpha('#2a2f39', row.shade);
    ctx.fillRect(0, row.y + 6, CROWD_W, 4);
    for (let x = rand() * 10; x < CROWD_W; x += 15 * row.scale + rand() * 9) {
      const person = {
        dy: rand() * 4,
        shirt: shirtColors[Math.floor(rand() * shirtColors.length)],
        skin: skinColors[Math.floor(rand() * skinColors.length)],
        hair: rand() < 0.7 ? '#1e1712' : '#5a4632',
        arms: rand() < 0.12,
      };
      for (const wrap of [-CROWD_W, 0, CROWD_W]) drawFan(ctx, x + wrap, row.y - person.dy, row.scale, row.shade, person);
    }
  }
  // Railing in front of the lowest row.
  ctx.fillStyle = '#3a404b';
  ctx.fillRect(0, CROWD_H - 18, CROWD_W, 3);
}

function drawFan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  shade: number,
  p: { shirt: string; skin: string; hair: string; arms: boolean },
): void {
  ctx.globalAlpha = shade;
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.roundRect(x - 8 * s, y - 2 * s, 16 * s, 22 * s, 6 * s);
  ctx.fill();
  if (p.arms) {
    ctx.strokeStyle = p.skin;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y);
    ctx.lineTo(x - 10 * s, y - 20 * s);
    ctx.moveTo(x + 6 * s, y);
    ctx.lineTo(x + 10 * s, y - 20 * s);
    ctx.stroke();
  }
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(x, y - 9 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(x, y - 11 * s, 6 * s, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBarrier(ctx: CanvasRenderingContext2D): void {
  const h = BARRIER_H;
  const boards: { bg: string; fg: string; text: string }[] = [
    { bg: '#111317', fg: ACCENT, text: 'RACE DAY' },
    { bg: ACCENT, fg: '#111317', text: '8 × 1 KM' },
    { bg: '#1c2028', fg: '#f2f2f2', text: 'PACE YOURSELF' },
    { bg: '#111317', fg: ACCENT, text: 'EVERY REP COUNTS' },
  ];
  boards.forEach((board, i) => {
    const x = i * 256;
    ctx.fillStyle = board.bg;
    ctx.fillRect(x, 0, 256, h);
    // Chevrons at the board ends.
    ctx.fillStyle = withAlpha(board.fg, 0.35);
    for (const cx of [x + 10, x + 226]) {
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + k * 9, 10);
        ctx.lineTo(cx + k * 9 + 8, h / 2);
        ctx.lineTo(cx + k * 9, h - 10);
        ctx.lineTo(cx + k * 9 + 4, h - 10);
        ctx.lineTo(cx + k * 9 + 12, h / 2);
        ctx.lineTo(cx + k * 9 + 4, 10);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = board.fg;
    ctx.font = `bold ${board.text.length > 12 ? 15 : 20}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(board.text, x + 128, h / 2 + 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 254, 0, 2, h);
  });
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(255,255,255,0.14)');
  shade.addColorStop(0.1, 'rgba(255,255,255,0)');
  shade.addColorStop(0.8, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 1024, h);
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  const w = 512;
  const h = FLOOR_H;
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#26292f');
  base.addColorStop(0.35, '#1d2025');
  base.addColorStop(1, '#101114');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Rubber speckle.
  const rand = seededRandom(3);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const c = rand();
    ctx.fillStyle = c < 0.08 ? 'rgba(255,212,0,0.25)' : c < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  // Tile seams (every 128 px so it tiles at 512).
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 0; x < w; x += 128) ctx.fillRect(x, 0, 1, h);
  // Lane lines.
  ctx.fillStyle = 'rgba(236,236,236,0.55)';
  ctx.fillRect(0, 6, w, 2);
  ctx.fillRect(0, 74, w, 3);
}
