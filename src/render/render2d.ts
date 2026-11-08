// Table seen from above. The figures are pictures of the 3D toys, standing up.

import { getSprite } from '../figures/sprites';
import type { Match, Owner, Piece } from '../game/sim';
import { backdrop } from '../scenes/backdrop';
import { getScene } from '../scenes/scenes';
import { roundRect } from './mat';
import { HUD_TOP, type AimView, type Renderer } from './types';

const SPRITE_HEIGHT = 0.8; // how much a unit of height lifts on screen

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
  private lastMatch: Match | null = null;
  private introT = 1; // 0..1 table pops in at the start of a match
  private flipT = 1; // 0..1 table spins when the turn passes in a duel
  private trails = new Map<number, { x: number; y: number }[]>();

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
    // Leave room around the table so the scenery shows.
    const pad = Math.max(26, cw * 0.11);
    const top = HUD_TOP + 22;
    const bottom = 64;
    this.scale = Math.min((cw - pad * 2) / m.W, (ch - top - bottom) / m.L);
    this.ox = (cw - m.W * this.scale) / 2;
    this.oy = top + (ch - top - bottom - m.L * this.scale) / 2;
  }

  worldToScreen(x: number, y: number, h = 0) {
    const s = this.scale;
    if (this.view === 0) return { x: this.ox + x * s, y: this.oy + (this.L - y) * s - h * s * SPRITE_HEIGHT };
    return { x: this.ox + (this.W - x) * s, y: this.oy + y * s - h * s * SPRITE_HEIGHT };
  }

  screenToWorld(sx: number, sy: number) {
    const s = this.scale;
    if (this.view === 0) return { x: (sx - this.ox) / s, y: this.L - (sy - this.oy) / s };
    return { x: this.W - (sx - this.ox) / s, y: (sy - this.oy) / s };
  }

  pxPerUnit() {
    return this.scale;
  }

  render(m: Match, aim: AimView | null, viewOwner: Owner, dt: number) {
    this.time += dt;
    if (m !== this.lastMatch) {
      this.lastMatch = m;
      this.introT = 0;
      this.flipT = 1;
      this.trails.clear();
    } else if (viewOwner !== this.view) {
      this.flipT = 0;
    }
    this.introT = Math.min(1, this.introT + dt / 0.7);
    this.flipT = Math.min(1, this.flipT + dt / 0.6);
    this.view = viewOwner;
    this.fit(m);
    const ctx = this.ctx;
    const cw = this.canvas.clientWidth;
    const chh = this.canvas.clientHeight;
    const s = this.scale;

    const scene = getScene(m.scene);
    ctx.fillStyle = scene.fog;
    ctx.fillRect(0, 0, cw, chh);
    const shot = backdrop({
      sceneId: m.scene,
      W: m.W,
      L: m.L,
      view: viewOwner,
      cw,
      ch: chh,
      dpr: Math.min(2, window.devicePixelRatio || 1),
      scale: s,
      ox: Math.round(this.ox * 100) / 100,
      oy: Math.round(this.oy * 100) / 100,
    });

    // Intro pop and duel spin, around the middle of the table.
    ctx.save();
    const cx = this.ox + (m.W * s) / 2;
    const cy = this.oy + (m.L * s) / 2;
    const pop = backOut(this.introT);
    const spin = (1 - easeInOut(this.flipT)) * Math.PI;
    ctx.globalAlpha = Math.min(1, this.introT * 2);
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
    ctx.translate(-cx, -cy);
    ctx.drawImage(shot, 0, 0, cw, chh);

    if (aim) this.drawAim(m, aim);

    // Shadows and team rings first, then the figures back to front.
    const pieces = [...m.pieces].sort((a, b) => this.worldToScreen(a.x, a.y).y - this.worldToScreen(b.x, b.y).y);
    for (const p of pieces) this.drawBase(m, p);
    this.drawTrails(m);
    for (const p of pieces) this.drawFigure(m, p, viewOwner);
    ctx.restore();
  }

  /** Speed streaks behind sliding pieces. */
  private drawTrails(m: Match) {
    const ctx = this.ctx;
    const alive = new Set<number>();
    for (const p of m.pieces) {
      alive.add(p.id);
      let t = this.trails.get(p.id);
      const moving = Math.hypot(p.vx, p.vy) > 12 && !p.out;
      if (!t) {
        if (!moving) continue;
        t = [];
        this.trails.set(p.id, t);
      }
      if (moving) t.push({ x: p.x, y: p.y });
      else t.shift();
      if (t.length > 10) t.shift();
      if (t.length === 0) {
        this.trails.delete(p.id);
        continue;
      }
      const r = p.char.radius * this.scale;
      for (let i = 0; i < t.length; i++) {
        const sp = this.worldToScreen(t[i].x, t[i].y);
        const k = (i + 1) / t.length;
        ctx.fillStyle = p.owner === 0 ? `rgba(120,170,255,${0.35 * k})` : `rgba(255,130,150,${0.35 * k})`;
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, r * 0.9 * k, r * 0.55 * k, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const id of this.trails.keys()) if (!alive.has(id)) this.trails.delete(id);
  }

  private drawBase(m: Match, p: Piece) {
    if (p.out) return;
    const ctx = this.ctx;
    const sp = this.worldToScreen(p.x, p.y);
    const r = p.char.radius * this.scale;
    const lying = p.fallT;
    // Shadow (shrinks while the piece is in the air)
    const air = Math.max(0.5, 1 - p.h * 0.15);
    ctx.fillStyle = `rgba(40,20,70,${0.28 * air})`;
    ctx.beginPath();
    ctx.ellipse(sp.x + r * 0.15, sp.y + r * 0.1, r * (1.05 + lying * 0.9) * air, r * 0.62 * air, 0, 0, Math.PI * 2);
    ctx.fill();
    if (lying > 0.5 || p.h > 0.3) return;
    // Team ring
    ctx.lineWidth = Math.max(2.5, r * 0.22);
    ctx.strokeStyle = p.owner === 0 ? '#2f6fe0' : '#e0405a';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, r * 1.12, r * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (p.id === m.selected) {
      const pulse = 1 + Math.sin(this.time * 6) * 0.08;
      ctx.lineWidth = Math.max(3, r * 0.25);
      ctx.strokeStyle = '#ffe14d';
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, r * 1.45 * pulse, r * 0.92 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawFigure(m: Match, p: Piece, viewOwner: Owner) {
    const ctx = this.ctx;
    const s = this.scale;
    const r = p.char.radius;
    // Your own team shows its back; the other team looks at you.
    const sprite = getSprite(p.char, p.owner === viewOwner ? 'back' : 'front');
    const k = (r * s) / sprite.unitPx; // sprite pixels -> screen pixels
    let hop = 0;
    if (p.id === m.selected) hop = Math.abs(Math.sin(this.time * 5)) * r * s * 0.25;
    const sp = this.worldToScreen(p.x, p.y, p.h);

    ctx.save();
    ctx.translate(sp.x, sp.y - hop);
    if (p.roll !== 0) {
      // Tumbling: spin the picture around its middle, the way it's moving across the screen.
      const ahead = this.worldToScreen(p.x + Math.cos(p.rollDir), p.y + Math.sin(p.rollDir));
      const base = this.worldToScreen(p.x, p.y);
      const sx = ahead.x - base.x;
      const sy = ahead.y - base.y;
      // Moving up/down the screen looks like a flip (squash), sideways looks like a spin.
      const side = Math.abs(sx) / (Math.hypot(sx, sy) || 1);
      const mid = r * s * 0.95;
      ctx.translate(0, -mid);
      ctx.rotate(Math.sign(sx || 1) * p.roll * side);
      ctx.scale(1, 1 - (1 - Math.abs(Math.cos(p.roll))) * (1 - side) * 0.55);
      ctx.translate(0, mid);
    }
    if (p.out) {
      const t = p.outT;
      ctx.globalAlpha = 1 - t;
      ctx.scale(1 - t * 0.6, 1 - t * 0.6);
    }
    if (p.fallT > 0) {
      // Tip over sideways, toward the side it was hit from.
      const dirScreen = this.worldToScreen(p.x + Math.cos(p.fallDir), p.y + Math.sin(p.fallDir));
      const side = dirScreen.x >= sp.x ? 1 : -1;
      const t = easeOutBounce(p.fallT);
      ctx.rotate(side * t * Math.PI * 0.5);
    }
    if (p.char.fig.style === 'jelly') ctx.globalAlpha *= 0.92;
    ctx.drawImage(sprite.canvas, -sprite.anchorX * k, -sprite.anchorY * k, sprite.canvas.width * k, sprite.canvas.height * k);
    ctx.restore();

    // A little bouncing arrow over the piece you can flick.
    if (p.id === m.selected && !m.cpu[m.turn]) {
      const top = this.worldToScreen(p.x, p.y, r * 3.4);
      const bob = Math.sin(this.time * 5) * 4;
      ctx.fillStyle = '#ffe14d';
      ctx.strokeStyle = '#7a3e00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(top.x - 8, top.y - 12 + bob);
      ctx.lineTo(top.x + 8, top.y - 12 + bob);
      ctx.lineTo(top.x, top.y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawAim(m: Match, aim: AimView) {
    const ctx = this.ctx;
    const from = this.worldToScreen(aim.x, aim.y);
    const pull = this.worldToScreen(aim.pullX, aim.pullY);

    // Rubber band to the finger
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(pull.x, pull.y);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(pull.x, pull.y, 9, 0, Math.PI * 2);
    ctx.fill();

    // Guide dots in the flick direction, ending in an arrow
    const len = m.L * 0.85 * m.guide * Math.max(0.15, aim.power);
    const steps = 14;
    const hue = 120 - aim.power * 120;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * len;
      const p = this.worldToScreen(aim.x + aim.dx * t, aim.y + aim.dy * t);
      ctx.fillStyle = `hsla(${hue},90%,60%,${1 - (i / steps) * 0.6})`;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 - (i / steps) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const end = this.worldToScreen(aim.x + aim.dx * len, aim.y + aim.dy * len);
    const prev = this.worldToScreen(aim.x + aim.dx * (len - 1), aim.y + aim.dy * (len - 1));
    const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
    ctx.save();
    ctx.translate(end.x, end.y);
    ctx.rotate(ang);
    ctx.fillStyle = `hsl(${hue},90%,55%)`;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -10);
    ctx.lineTo(-6, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Power meter beside the piece
    const bw = 16;
    const bh = 80;
    const bx = from.x + 34;
    const by = from.y - bh + 10;
    ctx.fillStyle = 'rgba(30,10,60,0.55)';
    roundRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 10);
    ctx.fill();
    const grad = ctx.createLinearGradient(0, by + bh, 0, by);
    grad.addColorStop(0, '#4cd07d');
    grad.addColorStop(0.5, '#ffd23f');
    grad.addColorStop(1, '#ff4d4d');
    ctx.fillStyle = grad;
    const fillH = bh * aim.power;
    roundRect(ctx, bx, by + bh - fillH, bw, fillH, 7);
    ctx.fill();
  }
}

function backOut(t: number) {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutBounce(t: number) {
  if (t < 0.7) return (t / 0.7) * (t / 0.7);
  const u = (t - 0.7) / 0.3;
  return 1 - Math.sin(u * Math.PI) * 0.08;
}
