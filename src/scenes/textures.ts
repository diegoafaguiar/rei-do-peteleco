// Hand-painted (procedural) textures for floors, tables and play areas.

import * as THREE from 'three';

export type Rng = () => number;

export function rng(seed: number): Rng {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, r: Rng) => void;

const texCache = new Map<string, THREE.CanvasTexture>();

/** A repeating texture for big areas (floors, walls, table tops). */
export function tileTexture(name: string, size: number, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const key = `${name}:${repeatX}:${repeatY}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  PAINTERS[name](cv.getContext('2d')!, size, size, rng(name.length * 977));
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, r: Rng, count: number, colors: string[], size: [number, number]) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

function woodBoards(base: string, line: string, grain: string, boards: number): Painter {
  return (ctx, w, h, r) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const bw = w / boards;
    for (let b = 0; b < boards; b++) {
      ctx.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
      ctx.fillRect(b * bw, 0, bw, h);
      ctx.strokeStyle = grain;
      ctx.lineWidth = 1.2;
      for (let g = 0; g < 7; g++) {
        const x = b * bw + r() * bw;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= h; y += 16) ctx.lineTo(x + Math.sin(y / 40 + g) * 3, y);
        ctx.stroke();
      }
      ctx.fillStyle = line;
      ctx.fillRect(b * bw, 0, 2, h);
    }
  };
}

export const PAINTERS: Record<string, Painter> = {
  // ----- big areas -----
  woodTable: woodBoards('#c98d55', 'rgba(70,35,10,0.45)', 'rgba(110,60,20,0.25)', 4),
  woodDark: woodBoards('#6b3f24', 'rgba(20,8,0,0.5)', 'rgba(30,12,0,0.3)', 4),
  woodFloor: woodBoards('#d9b07a', 'rgba(90,50,15,0.4)', 'rgba(120,70,25,0.2)', 6),
  tiles: (ctx, w, h) => {
    const n = 4;
    const s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#f3efe6' : '#7fb6c9';
        ctx.fillRect(i * s, j * s, s, s);
      }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, h);
      ctx.moveTo(0, i * s);
      ctx.lineTo(w, i * s);
      ctx.stroke();
    }
  },
  marbleTop: (ctx, w, h, r) => PLAY_PAINTERS.marble(ctx, w, h, r),
  mallFloor: (ctx, w, h) => {
    const n = 2;
    const s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#ece7e1' : '#d8d1c8';
        ctx.fillRect(i * s, j * s, s, s);
      }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  },
  sidewalk: (ctx, w, h, r) => {
    ctx.fillStyle = '#b9b4ab';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 900, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)'], [1, 3]);
    ctx.strokeStyle = 'rgba(60,55,50,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  },
  asphaltWide: (ctx, w, h, r) => {
    ctx.fillStyle = '#4a4d52';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 2500, ['#3d4045', '#5a5d62', '#2f3236', '#66696d'], [1, 3]);
  },
  concreteWide: (ctx, w, h, r) => {
    ctx.fillStyle = '#c9c3b8';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 1500, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.07)'], [1, 4]);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  },
  rug: (ctx, w, h) => {
    ctx.fillStyle = '#c94f4f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = w * 0.03;
    ctx.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
    ctx.strokeStyle = '#2f5d8a';
    ctx.lineWidth = w * 0.015;
    ctx.strokeRect(w * 0.16, h * 0.16, w * 0.68, h * 0.68);
  },
  snow: (ctx, w, h, r) => {
    ctx.fillStyle = '#eef6fb';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 900, ['rgba(160,190,220,0.25)', 'rgba(255,255,255,0.9)'], [1, 4]);
  },
  stone: (ctx, w, h, r) => {
    ctx.fillStyle = '#8f8a84';
    ctx.fillRect(0, 0, w, h);
    const rows = 4;
    const rh = h / rows;
    for (let i = 0; i < rows; i++) {
      let x = (i % 2) * (w / 8);
      while (x < w + 10) {
        const bw = w / 4 + r() * 20;
        ctx.fillStyle = `hsl(30, 5%, ${45 + r() * 15}%)`;
        ctx.fillRect(x + 2, i * rh + 2, bw - 4, rh - 4);
        x += bw;
      }
    }
  },
  grassWide: (ctx, w, h, r) => {
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 3000, ['#43a047', '#66bb6a', '#388e3c'], [1, 3]);
  },
  sandWide: (ctx, w, h, r) => {
    ctx.fillStyle = '#ecd29a';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 3000, ['#e0c27f', '#f6e2b3', '#d4b26a'], [1, 2.5]);
  },
  rockWide: (ctx, w, h, r) => {
    ctx.fillStyle = '#3a2f2c';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 2500, ['#2b2220', '#4a3c38', '#1e1716'], [2, 6]);
    ctx.strokeStyle = 'rgba(255,110,20,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      let x = r() * w;
      let y = r() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 60;
        y += (r() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  wall: (ctx, w, h) => {
    ctx.fillStyle = '#f6e7c8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 8, h);
  },
  brick: (ctx, w, h) => {
    ctx.fillStyle = '#d7d1c6';
    ctx.fillRect(0, 0, w, h);
    const rows = 8;
    const rh = h / rows;
    for (let i = 0; i < rows; i++) {
      for (let x = (i % 2) * -(w / 8); x < w; x += w / 4) {
        ctx.fillStyle = i % 3 === 0 ? '#b5523b' : '#c4603f';
        ctx.fillRect(x + 2, i * rh + 2, w / 4 - 4, rh - 4);
      }
    }
  },
};

// ---------- Play areas (the part of the table/floor where the game happens) ----------

export const PLAY_PAINTERS: Record<string, Painter> = {
  tablecloth: (ctx, w, h) => {
    ctx.fillStyle = '#fbf7f0';
    ctx.fillRect(0, 0, w, h);
    const s = w / 8;
    ctx.fillStyle = 'rgba(214,48,49,0.55)';
    for (let x = 0; x < w; x += s * 2) ctx.fillRect(x, 0, s, h);
    for (let y = 0; y < h; y += s * 2) ctx.fillRect(0, y, w, s);
    ctx.fillStyle = 'rgba(214,48,49,0.25)';
    for (let x = 0; x < w; x += s * 2) for (let y = 0; y < h; y += s * 2) ctx.fillRect(x, y, s, s);
  },
  woodDark: (ctx, w, h, r) => PAINTERS.woodDark(ctx, w, h, r),
  asphalt: (ctx, w, h, r) => {
    PAINTERS.asphaltWide(ctx, w, h, r);
    // A worn crosswalk under the game
    ctx.fillStyle = 'rgba(245,245,240,0.85)';
    const bw = w / 9;
    for (let x = bw / 2; x < w; x += bw * 2) ctx.fillRect(x, h * 0.42, bw, h * 0.16);
    noise(ctx, w, h, r, 400, ['rgba(74,77,82,0.6)'], [2, 6]);
  },
  court: (ctx, w, h, r) => {
    ctx.fillStyle = '#3f8f6b';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 1200, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'], [1, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = w * 0.012;
    ctx.beginPath();
    ctx.arc(w / 2, 0, w * 0.32, 0, Math.PI);
    ctx.arc(w / 2, h, w * 0.32, Math.PI, Math.PI * 2);
    ctx.stroke();
    // Hopscotch in chalk
    ctx.strokeStyle = 'rgba(255,240,120,0.7)';
    const s = w * 0.12;
    const x0 = w * 0.08;
    for (let i = 0; i < 5; i++) ctx.strokeRect(x0, h * 0.3 + i * s, s, s);
  },
  marble: (ctx, w, h, r) => {
    ctx.fillStyle = '#ebe6df';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(110,105,115,${0.15 + r() * 0.25})`;
      ctx.lineWidth = 1 + r() * 2.5;
      ctx.beginPath();
      let x = r() * w;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < h) {
        x += (r() - 0.5) * 40;
        y += 20 + r() * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  tray: (ctx, w, h) => {
    ctx.fillStyle = '#f26a10';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < w; x += 14) ctx.fillRect(x, 0, 6, h);
    // Paper placemat in the middle
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(w * 0.12, h * 0.38, w * 0.76, h * 0.24);
    ctx.fillStyle = '#e53935';
    ctx.font = `900 ${Math.round(w * 0.07)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LANCHE', w / 2, h * 0.47);
  },
  ice: (ctx, w, h, r) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#dff4ff');
    g.addColorStop(1, '#b8e3f7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 60; i++) {
      ctx.lineWidth = 0.5 + r() * 1.5;
      ctx.beginPath();
      const x = r() * w;
      const y = r() * h;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80, x + (r() - 0.5) * 160, y + (r() - 0.5) * 160);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(200,40,60,0.5)';
    ctx.lineWidth = w * 0.01;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  },
  chess: (ctx, w, h) => {
    const n = 8;
    const s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j * s < h; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#6d4a2e' : '#ecd9b6';
        ctx.fillRect(i * s, j * s, s, s);
      }
  },
  grass: (ctx, w, h, r) => {
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#3fa34d' : '#4cb85b';
      ctx.fillRect(0, (i * h) / stripes, w, h / stripes + 1);
    }
    noise(ctx, w, h, r, 2000, ['rgba(0,60,0,0.12)', 'rgba(255,255,255,0.06)'], [1, 2]);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = w * 0.012;
    ctx.strokeRect(w * 0.03, h * 0.015, w * 0.94, h * 0.97);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2);
    ctx.stroke();
  },
  sand: (ctx, w, h, r) => {
    PAINTERS.sandWide(ctx, w, h, r);
    // Footprints and a drawn line in the sand
    ctx.fillStyle = 'rgba(160,120,60,0.18)';
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.ellipse(w * 0.85 + (i % 2) * 14, h * (0.1 + i * 0.08), 6, 11, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  lava: (ctx, w, h, r) => PAINTERS.rockWide(ctx, w, h, r),
  carpet: (ctx, w, h, r) => {
    ctx.fillStyle = '#b3122e';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, r, 1500, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.04)'], [1, 2]);
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = w * 0.025;
    ctx.strokeRect(w * 0.04, w * 0.04, w * 0.92, h - w * 0.08);
    ctx.lineWidth = w * 0.008;
    ctx.strokeRect(w * 0.08, w * 0.08, w * 0.84, h - w * 0.16);
  },
};
