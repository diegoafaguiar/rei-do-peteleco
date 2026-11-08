// Table seen from above, drawn on a 2D canvas.

import { forward, launchY, type Match, type Owner } from '../game/sim';
import { drawChar } from './draw';
import { HUD_TOP, type AimView, type Renderer } from './types';

export class Renderer2D implements Renderer {
  readonly kind = '2d' as const;
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private W = 60;
  private L = 100;
  private view: Owner = 0;
  private time = 0;

  mount(el: HTMLElement) {
    el.appendChild(this.canvas);
  }

  unmount() {
    this.canvas.remove();
  }

  private fit(m: Match) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = m.W;
    this.L = m.L;
    const pad = 16;
    const top = HUD_TOP + 8;
    const bottom = 56;
    this.scale = Math.min((cw - pad * 2) / m.W, (ch - top - bottom) / m.L);
    this.ox = (cw - m.W * this.scale) / 2;
    this.oy = top + (ch - top - bottom - m.L * this.scale) / 2;
  }

  worldToScreen(x: number, y: number) {
    const s = this.scale;
    if (this.view === 0) return { x: this.ox + x * s, y: this.oy + (this.L - y) * s };
    return { x: this.ox + (this.W - x) * s, y: this.oy + y * s };
  }

  screenToWorld(sx: number, sy: number) {
    const s = this.scale;
    if (this.view === 0) return { x: (sx - this.ox) / s, y: this.L - (sy - this.oy) / s };
    return { x: this.W - (sx - this.ox) / s, y: (sy - this.oy) / s };
  }

  /** Screen angle of a world direction. */
  private screenAngle(dx: number, dy: number) {
    const a = this.worldToScreen(0, 0);
    const b = this.worldToScreen(dx, dy);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  render(m: Match, aim: AimView | null, viewOwner: Owner, dt: number) {
    this.time += dt;
    this.view = viewOwner;
    this.fit(m);
    const ctx = this.ctx;
    const cw = this.canvas.clientWidth;
    const chh = this.canvas.clientHeight;
    const s = this.scale;

    // Room floor
    const bg = ctx.createLinearGradient(0, 0, 0, chh);
    bg.addColorStop(0, '#1e3a5f');
    bg.addColorStop(1, '#0f2238');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, chh);

    // Table
    const tl = { x: this.ox, y: this.oy };
    const tw = m.W * s;
    const th = m.L * s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, tl.x + 6, tl.y + 8, tw, th, 14);
    ctx.fill();
    const wood = ctx.createLinearGradient(tl.x, 0, tl.x + tw, 0);
    wood.addColorStop(0, '#c58b4f');
    wood.addColorStop(0.5, '#d9a066');
    wood.addColorStop(1, '#c08447');
    ctx.fillStyle = wood;
    roundRect(ctx, tl.x, tl.y, tw, th, 14);
    ctx.fill();
    ctx.strokeStyle = '#7a4a22';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Wood grain
    ctx.strokeStyle = 'rgba(122,74,34,0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 9; i++) {
      const x = tl.x + (tw * i) / 9;
      ctx.beginPath();
      ctx.moveTo(x, tl.y + 4);
      ctx.lineTo(x + Math.sin(i) * 6, tl.y + th - 4);
      ctx.stroke();
    }

    // Flick lines and middle line
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    for (const owner of [0, 1] as Owner[]) {
      const y = launchY(m, owner);
      const a = this.worldToScreen(2, y);
      const b = this.worldToScreen(m.W - 2, y);
      ctx.strokeStyle = owner === 0 ? 'rgba(59,130,246,0.7)' : 'rgba(239,68,68,0.7)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const ma = this.worldToScreen(0, m.L / 2);
    const mb = this.worldToScreen(m.W, m.L / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(ma.x, ma.y);
    ctx.lineTo(mb.x, mb.y);
    ctx.stroke();

    // Aim guide (drawn under the pieces)
    if (aim) this.drawAim(m, aim);

    // Pieces: back to front
    const pieces = [...m.pieces].sort((a, b) => this.worldToScreen(a.x, a.y).y - this.worldToScreen(b.x, b.y).y);
    for (const p of pieces) {
      const sp = this.worldToScreen(p.x, p.y);
      const r = p.char.radius * s;
      const canPick = m.phase === 'aim' && p.owner === m.turn && !m.cpu[m.turn];
      if (p.id === m.selected) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r + 4 + Math.sin(this.time * 6) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (canPick) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Team marker ring
      if (p.fallT < 0.5 && !p.out) {
        ctx.fillStyle = p.owner === 0 ? '#3b82f6' : '#ef4444';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r + Math.max(3, r * 0.22), 0, Math.PI * 2);
        ctx.fill();
      }
      const face = this.screenAngle(0, forward(p.owner));
      const fall = this.screenAngle(Math.cos(p.fallDir), Math.sin(p.fallDir));
      const shrink = p.out ? 1 - p.outT * 0.6 : 1;
      drawChar(ctx, p.char, sp.x, sp.y, r * shrink, face, p.fallT, fall, p.out ? 1 - p.outT : 1);
    }
  }

  private drawAim(m: Match, aim: AimView) {
    const ctx = this.ctx;
    const from = this.worldToScreen(aim.x, aim.y);
    const pull = this.worldToScreen(aim.pullX, aim.pullY);

    // Rubber band to the finger
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(pull.x, pull.y);
    ctx.stroke();

    // Dotted guide in the flick direction
    const len = m.L * 0.85 * m.guide * Math.max(0.15, aim.power);
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * len;
      const p = this.worldToScreen(aim.x + aim.dx * t, aim.y + aim.dy * t);
      ctx.fillStyle = `rgba(255,255,255,${0.9 - (i / steps) * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Power bar next to the piece
    const bw = 70;
    const bh = 10;
    const bx = from.x - bw / 2;
    const by = from.y + 26;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, bx - 2, by - 2, bw + 4, bh + 4, 6);
    ctx.fill();
    const hue = 120 - aim.power * 120;
    ctx.fillStyle = `hsl(${hue},85%,50%)`;
    roundRect(ctx, bx, by, bw * aim.power, bh, 5);
    ctx.fill();
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
