// The colorful play mat on top of the table. Drawn once per table size and shared by 2D and 3D.
// Canvas row 0 is the far end (y = L), so it maps straight onto the table seen by player 0.

import { LAUNCH_EDGE, TABLE_W } from '../game/sim';

const PPU = 10; // canvas pixels per world unit
const cache = new Map<number, HTMLCanvasElement>();

export function matCanvas(L: number): HTMLCanvasElement {
  const hit = cache.get(L);
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

  // Two halves: red team far, blue team near.
  const far = ctx.createLinearGradient(0, 0, 0, h / 2);
  far.addColorStop(0, '#ff9aa8');
  far.addColorStop(1, '#ffd3d9');
  ctx.fillStyle = far;
  ctx.fillRect(0, 0, w, h / 2);
  const near = ctx.createLinearGradient(0, h / 2, 0, h);
  near.addColorStop(0, '#cfe6ff');
  near.addColorStop(1, '#8fc2ff');
  ctx.fillStyle = near;
  ctx.fillRect(0, h / 2, w, h / 2);

  // Soft polka dots
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  const step = 9 * PPU;
  for (let yy = step / 2; yy < h; yy += step) {
    for (let xx = (Math.round(yy / step) % 2) * (step / 2) + step / 4; xx < w; xx += step) {
      ctx.beginPath();
      ctx.arc(xx, yy, PPU * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Middle stripe with a crown
  ctx.fillStyle = '#fff6e6';
  ctx.fillRect(0, h / 2 - PPU * 1.2, w, PPU * 2.4);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, PPU * 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = PPU * 0.8;
  ctx.strokeStyle = '#ffd166';
  ctx.stroke();
  drawCrown(ctx, w / 2, h / 2, PPU * 4.2);

  // Flick lines
  ctx.setLineDash([PPU * 2, PPU * 1.4]);
  ctx.lineCap = 'round';
  ctx.lineWidth = PPU * 0.7;
  for (const [y, color] of [
    [LAUNCH_EDGE, '#2f6fe0'],
    [L - LAUNCH_EDGE, '#e0405a'],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(PPU * 2.5, Y(y));
    ctx.lineTo(w - PPU * 2.5, Y(y));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Home zones behind the flick lines
  for (const [y0, y1, color] of [
    [0, LAUNCH_EDGE - 4, 'rgba(47,111,224,0.16)'],
    [L - LAUNCH_EDGE + 4, L, 'rgba(224,64,90,0.16)'],
  ] as const) {
    ctx.fillStyle = color;
    roundRect(ctx, PPU * 1.5, Y(y1) + PPU * 1.5, w - PPU * 3, Y(y0) - Y(y1) - PPU * 3, PPU * 3);
    ctx.fill();
  }

  // Stitched border
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = PPU * 0.5;
  ctx.setLineDash([PPU * 1.2, PPU * 0.8]);
  roundRect(ctx, PPU * 0.8, PPU * 0.8, w - PPU * 1.6, h - PPU * 1.6, PPU * 3);
  ctx.stroke();
  ctx.setLineDash([]);

  cache.set(L, cv);
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
