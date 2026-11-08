// Fun effects drawn on a transparent canvas above the table: stars, dust puffs,
// comic "POW!" words and confetti. Works the same for the 2D and 3D views.

export type Project = (x: number, y: number, h: number) => { x: number; y: number };

interface Particle {
  x: number;
  y: number;
  h: number;
  vx: number;
  vy: number;
  vh: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: 'star' | 'puff' | 'spark';
  spin: number;
}

interface Word {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  tilt: number;
}

interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  w: number;
  h: number;
}

const CONFETTI_COLORS = ['#ff5a5f', '#ffd23f', '#3d8bff', '#4cd07d', '#b45cff', '#ff9f1c'];
const WORDS = ['POW!', 'BUM!', 'TOING!', 'PLAFT!', 'ZAS!', 'CABUM!'];

export class Fx {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private parts: Particle[] = [];
  private words: Word[] = [];
  private confetti: Confetto[] = [];
  shake = 0;

  constructor() {
    this.canvas.className = 'fx';
  }

  burst(x: number, y: number, color: string, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 8 + Math.random() * 18;
      this.parts.push({
        x,
        y,
        h: 2 + Math.random() * 3,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        vh: 14 + Math.random() * 16,
        life: 0,
        max: 0.7 + Math.random() * 0.4,
        color: i % 3 === 0 ? '#ffe066' : color,
        size: 0.9 + Math.random() * 0.8,
        kind: i % 2 === 0 ? 'star' : 'spark',
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  puff(x: number, y: number, count = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({
        x,
        y,
        h: 0.5,
        vx: Math.cos(a) * 4,
        vy: Math.sin(a) * 4,
        vh: 2,
        life: 0,
        max: 0.5 + Math.random() * 0.3,
        color: 'rgba(255,255,255,0.8)',
        size: 1.2 + Math.random(),
        kind: 'puff',
        spin: 0,
      });
    }
  }

  word(x: number, y: number, text?: string, color = '#ffdd00') {
    this.words.push({
      x,
      y,
      text: text ?? WORDS[Math.floor(Math.random() * WORDS.length)],
      color,
      life: 0,
      max: 0.9,
      tilt: (Math.random() - 0.5) * 0.5,
    });
  }

  celebrate() {
    const w = this.canvas.clientWidth;
    for (let i = 0; i < 160; i++) {
      this.confetti.push({
        x: Math.random() * w,
        y: -20 - Math.random() * 400,
        vx: (Math.random() - 0.5) * 80,
        vy: 80 + Math.random() * 160,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 8,
      });
    }
  }

  clear() {
    this.parts.length = 0;
    this.words.length = 0;
    this.confetti.length = 0;
    this.shake = 0;
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.h = Math.max(0, p.h + p.vh * dt);
      if (p.kind !== 'puff') p.vh -= 60 * dt;
      p.vx *= 1 - dt * 2;
      p.vy *= 1 - dt * 2;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const w of this.words) w.life += dt;
    this.words = this.words.filter((w) => w.life < w.max);
    const hgt = this.canvas.clientHeight;
    for (const c of this.confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      c.vx += Math.sin(c.y / 40) * 20 * dt;
    }
    this.confetti = this.confetti.filter((c) => c.y < hgt + 30);
    this.shake = Math.max(0, this.shake - dt * 3);
  }

  draw(project: Project, pxPerUnit: number) {
    const cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = cv.clientWidth;
    const ch = cv.clientHeight;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    for (const p of this.parts) {
      const s = project(p.x, p.y, p.h);
      const t = p.life / p.max;
      const size = p.size * pxPerUnit;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalAlpha = 1 - t;
      if (p.kind === 'puff') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, size * (0.6 + t * 1.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'star') {
        ctx.rotate(p.spin * p.life);
        star(ctx, Math.max(4, size * 1.1), p.color);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, size * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const w of this.words) {
      const s = project(w.x, w.y, 10);
      const t = w.life / w.max;
      const pop = t < 0.2 ? 0.4 + (t / 0.2) * 0.8 : 1.2 - (t - 0.2) * 0.25;
      ctx.save();
      ctx.translate(s.x, s.y - t * 30);
      ctx.rotate(w.tilt);
      ctx.scale(pop, pop);
      ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      ctx.font = '900 34px "Lilita One", "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#2a1458';
      ctx.strokeText(w.text, 0, 0);
      ctx.fillStyle = w.color;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }

    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, (-c.h / 2) * Math.abs(Math.cos(c.rot * 1.3)), c.w, c.h * Math.abs(Math.cos(c.rot * 1.3)));
      ctx.restore();
    }
  }
}

function star(ctx: CanvasRenderingContext2D, r: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.strokeStyle = 'rgba(80,40,0,0.5)';
  ctx.stroke();
}
