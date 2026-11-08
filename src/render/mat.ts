// The play area: the scene's surface (tablecloth, asphalt, ice...) plus the game markings.
// Drawn once per scene and table size, shared by 2D and 3D.
// Canvas row 0 is the far end (y = L), so it maps straight onto the table seen by player 0.

import { LAUNCH_EDGE, TABLE_W } from '../game/sim';
import { PLAY_PAINTERS, rng } from '../scenes/textures';

const PPU = 8; // canvas pixels per world unit
const cache = new Map<string, HTMLCanvasElement>();

export function matCanvas(L: number, surface = 'tablecloth'): HTMLCanvasElement {
  const key = `${surface}:${L}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = TABLE_W;
  const cv = document.createElement('canvas');
  cv.width = W * PPU;
  cv.height = Math.min(4096, L * PPU);
  const k = cv.height / L; // pixels per unit vertically
  const ctx = cv.getContext('2d')!;
  const w = cv.width;
  const h = cv.height;
  const Y = (y: number) => (L - y) * k; // world y -> canvas row

  (PLAY_PAINTERS[surface] ?? PLAY_PAINTERS.tablecloth)(ctx, w, h, rng(L * 31 + surface.length));

  // Team zones behind the flick lines
  for (const [y0, y1, color] of [
    [0, LAUNCH_EDGE - 4, 'rgba(47,111,224,0.22)'],
    [L - LAUNCH_EDGE + 4, L, 'rgba(224,64,90,0.22)'],
  ] as const) {
    ctx.fillStyle = color;
    roundRect(ctx, PPU * 1.5, Y(y1) + PPU * 1.5, w - PPU * 3, Y(y0) - Y(y1) - PPU * 3, PPU * 3);
    ctx.fill();
  }

  // Flick lines (white outline so they read on any surface)
  ctx.lineCap = 'round';
  for (const [y, color] of [
    [LAUNCH_EDGE, '#2f6fe0'],
    [L - LAUNCH_EDGE, '#e0405a'],
  ] as const) {
    ctx.setLineDash([PPU * 2, PPU * 1.4]);
    ctx.lineWidth = PPU * 1.1;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(PPU * 2.5, Y(y));
    ctx.lineTo(w - PPU * 2.5, Y(y));
    ctx.stroke();
    ctx.lineWidth = PPU * 0.6;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Small crown in the middle
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, PPU * 4.2, 0, Math.PI * 2);
  ctx.fill();
  drawCrown(ctx, w / 2, h / 2, PPU * 2.6);
  ctx.globalAlpha = 1;

  // Edge of the play area
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = PPU * 0.45;
  ctx.setLineDash([PPU * 1.2, PPU * 0.8]);
  roundRect(ctx, PPU * 0.6, PPU * 0.6, w - PPU * 1.2, h - PPU * 1.2, PPU * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  cache.set(key, cv);
  return cv;
}

function drawCrown(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.55);
  ctx.lineTo(-s, -s * 0.35);
  ctx.lineTo(-s * 0.5, s * 0.1);
  ctx.lineTo(0, -s * 0.65);
  ctx.lineTo(s * 0.5, s * 0.1);
  ctx.lineTo(s, -s * 0.35);
  ctx.lineTo(s, s * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#ffc93c';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.12;
  ctx.strokeStyle = '#e69a00';
  ctx.stroke();
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
