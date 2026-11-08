// Draws a character seen from above. Used by the 2D table and by the menus.

import type { CharDef } from '../game/packs';

const SKIN = '#f2c49b';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function eyes(ctx: CanvasRenderingContext2D, r: number, angry = false) {
  for (const side of [-1, 1]) {
    const ex = r * 0.38;
    const ey = side * r * 0.3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(ex + r * 0.07, ey, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    if (angry) {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(ex + r * 0.25, ey - side * r * 0.05);
      ctx.lineTo(ex + r * 0.12, ey + side * r * 0.22);
      ctx.stroke();
    }
  }
}

function spikes(ctx: CanvasRenderingContext2D, r: number, count: number, len: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const a1 = a - Math.PI / count;
    const a2 = a + Math.PI / count;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a1) * r * 0.92, Math.sin(a1) * r * 0.92);
    ctx.lineTo(Math.cos(a) * r * len, Math.sin(a) * r * len);
    ctx.lineTo(Math.cos(a2) * r * 0.92, Math.sin(a2) * r * 0.92);
    ctx.fill();
  }
}

/**
 * Draws a character at (cx, cy) with radius r pixels.
 * face: screen angle the character looks toward.
 * fallT: 0 standing, 1 lying down along fallAngle.
 */
export function drawChar(
  ctx: CanvasRenderingContext2D,
  ch: CharDef,
  cx: number,
  cy: number,
  r: number,
  face: number,
  fallT = 0,
  fallAngle = 0,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(r * 0.15, r * 0.2, r * (1.05 + fallT * 0.9), r * 1.05, fallT > 0 ? fallAngle : 0, 0, Math.PI * 2);
  ctx.fill();

  if (fallT > 0) {
    // Lying down: stretched along the direction it fell.
    ctx.rotate(fallAngle);
    ctx.translate(r * fallT * 0.9, 0);
    ctx.scale(1 + fallT * 0.9, 1 - fallT * 0.15);
    ctx.rotate(-fallAngle);
  }
  ctx.rotate(face);

  switch (ch.shape) {
    case 'monster':
      ctx.fillStyle = ch.accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(r * 0.1, side * r * 0.6);
        ctx.lineTo(-r * 0.5, side * r * 1.35);
        ctx.lineTo(-r * 0.35, side * r * 0.45);
        ctx.fill();
      }
      break;
    case 'evo':
      spikes(ctx, r, 9, 1.4, ch.accent);
      break;
    case 'ice':
      spikes(ctx, r, 6, 1.3, '#e0f7fa');
      break;
  }

  // Body
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  const bodyColor = ch.color;
  grad.addColorStop(0, shade(bodyColor, 0.18));
  grad.addColorStop(1, shade(bodyColor, -0.12));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.strokeStyle = shade(bodyColor, -0.35);
  ctx.stroke();

  switch (ch.shape) {
    case 'buddy':
      ctx.fillStyle = ch.accent;
      ctx.beginPath();
      ctx.arc(-r * 0.25, 0, r * 0.35, 0, Math.PI * 2);
      ctx.globalAlpha = alpha * 0.5;
      ctx.fill();
      ctx.globalAlpha = alpha;
      eyes(ctx, r);
      break;
    case 'monster':
      eyes(ctx, r);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -r * 0.12);
      ctx.lineTo(r * 0.92, 0);
      ctx.lineTo(r * 0.7, r * 0.12);
      ctx.fill();
      break;
    case 'evo':
      eyes(ctx, r, true);
      break;
    case 'ice':
      ctx.strokeStyle = ch.accent;
      ctx.lineWidth = r * 0.1;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.55 - r * 0.2, Math.sin(a) * r * 0.55);
        ctx.lineTo(-Math.cos(a) * r * 0.55 - r * 0.2, -Math.sin(a) * r * 0.55);
        ctx.stroke();
      }
      eyes(ctx, r);
      break;
    case 'chess': {
      ctx.rotate(-face); // keep the glyph upright on screen
      ctx.fillStyle = ch.accent;
      ctx.font = `${Math.round(r * 1.5)}px "Segoe UI Symbol", "Apple Symbols", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch.symbol ?? '♟', 0, r * 0.08);
      break;
    }
    case 'ball': {
      // Shirt ring around a big head
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b2314';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, Math.PI * 0.55, Math.PI * 1.45);
      ctx.fill();
      eyes(ctx, r * 0.8);
      // Shirt number on the back
      ctx.save();
      ctx.translate(-r * 0.86, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ch.accent;
      ctx.font = `bold ${Math.round(r * 0.42)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ch.number ?? ''), 0, 0);
      ctx.restore();
      break;
    }
    case 'king': {
      eyes(ctx, r * 0.9);
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      const pts = 5;
      for (let i = 0; i <= pts * 2; i++) {
        const a = (i / (pts * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? r * 0.55 : r * 0.32;
        const x = Math.cos(a) * rr - r * 0.25;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
  }

  if (fallT > 0) {
    ctx.fillStyle = `rgba(0,0,0,${0.25 * fallT})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A small portrait image (data URL) of a character, for the menus. */
export function portrait(ch: CharDef, size = 72): string {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.height = size * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawChar(ctx, ch, size / 2, size / 2, size * 0.3, -Math.PI / 2);
  return cv.toDataURL();
}
