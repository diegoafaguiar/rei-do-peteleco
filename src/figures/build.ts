// Builds toy figures (soft vinyl, clear jelly, metal, glossy) from a small spec.
// Every figure stands on y = 0, faces -Z and has a footprint radius of 1 before scaling.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Style = 'vinyl' | 'jelly' | 'metal' | 'gloss';
export type Body = 'blob' | 'bean' | 'pear' | 'ghost' | 'block' | 'squat' | 'chess' | 'critter4' | 'critter2';
export type Eyes = 'big' | 'angry' | 'sleepy' | 'cyclops' | 'mask' | 'happy' | 'none';
export type Mouth = 'smile' | 'grin' | 'fangs' | 'o' | 'frown' | 'none';
export type Top =
  | 'horns'
  | 'ears'
  | 'catEars'
  | 'spikes'
  | 'crown'
  | 'leaf'
  | 'antenna'
  | 'helmet'
  | 'hair'
  | 'flame'
  | 'crystal'
  | 'bun'
  | 'fin'
  | 'longEars'
  | 'leafCrown';
export type Extra =
  | 'arms'
  | 'belly'
  | 'tail'
  | 'wings'
  | 'shirt'
  | 'cheeks'
  | 'feet'
  | 'bolt'
  | 'scarf'
  | 'shield'
  | 'shell'
  | 'snout'
  | 'stripes'
  | 'spiral'
  | 'leafTail';
export type ChessPiece = 'rei' | 'rainha' | 'torre' | 'cavalo' | 'bispo' | 'peao';

export interface FigSpec {
  style: Style;
  body: Body;
  color: string;
  color2?: string; // painted details (horns, belly, helmet...)
  color3?: string; // hair, helmet band
  skin?: string; // face patch (hood opening, big heads)
  eyes?: Eyes;
  mouth?: Mouth;
  top?: Top[];
  extras?: Extra[];
  piece?: ChessPiece;
  number?: number;
}

// ---------- Materials ----------

const matCache = new Map<string, THREE.Material>();

function material(style: Style, color: string): THREE.Material {
  const key = `${style}:${color}`;
  let m = matCache.get(key);
  if (m) return m;
  switch (style) {
    case 'jelly':
      m = new THREE.MeshPhysicalMaterial({
        color,
        transmission: 0.82,
        thickness: 1.6,
        roughness: 0.12,
        ior: 1.45,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        attenuationColor: new THREE.Color(color),
        attenuationDistance: 1.4,
        specularIntensity: 1,
      });
      break;
    case 'metal':
      m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.95, roughness: 0.22, clearcoat: 0.6 });
      break;
    case 'gloss':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 });
      break;
    default:
      // Soft painted vinyl, like a little rubber toy.
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  }
  matCache.set(key, m);
  return m;
}

/** Darker version of a color, for features molded into clear plastic. */
function darker(hex: string, k = 0.45): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

const PAINT = {
  white: '#fbfbf8',
  black: '#1a1420',
  mouth: '#4a1626',
  gold: '#f6c445',
  pink: '#ff8fb1',
};

// ---------- Body profiles (radius, height) ----------

type Lathe = Exclude<Body, 'block' | 'chess' | 'critter4' | 'critter2'>;

const PROFILES: Record<Lathe, [number, number][]> = {
  blob: [[0, 0], [0.94, 0], [1, 0.14], [1, 0.62], [0.93, 1.08], [0.74, 1.48], [0.42, 1.74], [0, 1.82]],
  bean: [[0, 0], [0.86, 0], [0.92, 0.2], [0.9, 1.0], [0.86, 1.6], [0.67, 2.0], [0.36, 2.22], [0, 2.27]],
  pear: [[0, 0], [1, 0], [1.03, 0.3], [0.92, 0.78], [0.74, 1.08], [0.8, 1.32], [0.84, 1.7], [0.68, 2.06], [0.36, 2.26], [0, 2.3]],
  ghost: [[0, 0], [1.06, 0], [0.98, 0.12], [0.82, 0.5], [0.8, 1.0], [0.84, 1.5], [0.72, 1.96], [0.42, 2.26], [0.12, 2.44], [0, 2.46]],
  squat: [[0, 0], [1.02, 0], [1.08, 0.28], [1.04, 0.78], [0.86, 1.18], [0.52, 1.4], [0, 1.45]],
};

const FACE_Y: Record<Lathe | 'block', number> = {
  blob: 1.0,
  bean: 1.42,
  pear: 1.72,
  ghost: 1.55,
  squat: 0.82,
  block: 1.05,
};

const DEPTH = 0.86; // bodies are a bit flatter front-to-back

interface Shape {
  radiusAt(y: number): number; // horizontal radius (x)
  depthAt(y: number): number; // front distance (z)
  top: number;
  faceY: number;
}

function latheShape(profile: [number, number][]): Shape {
  const radiusAt = (y: number) => {
    for (let i = 1; i < profile.length; i++) {
      const [r1, y1] = profile[i];
      const [r0, y0] = profile[i - 1];
      if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
    }
    return 0;
  };
  return { radiusAt, depthAt: (y) => radiusAt(y) * DEPTH, top: profile[profile.length - 1][1], faceY: 0 };
}

/** Point on the body surface at height y, angle a (0 = front, + = right). */
function surface(s: Shape, y: number, a: number, out = 0) {
  const rx = s.radiusAt(y) + out;
  const rz = s.depthAt(y) + out;
  return new THREE.Vector3(Math.sin(a) * rx, y, -Math.cos(a) * rz);
}

function sphere(r: number, m: THREE.Material, seg = 24) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), m);
}

/** Group placed on the surface, local +Z pointing out of the body. */
function onSurface(g: THREE.Group, s: Shape, y: number, a: number, out = 0) {
  const holder = new THREE.Group();
  const p = surface(s, y, a, out);
  holder.position.copy(p);
  const n = new THREE.Vector3(Math.sin(a) / Math.max(0.2, s.radiusAt(y)), 0, -Math.cos(a) / Math.max(0.2, s.depthAt(y))).normalize();
  holder.lookAt(p.clone().add(n));
  g.add(holder);
  return holder;
}

// ---------- Face ----------

function addEyes(g: THREE.Group, s: Shape, spec: FigSpec, painted: boolean) {
  const kind = spec.eyes ?? 'big';
  if (kind === 'none') return;
  const fy = s.faceY;
  const fs = s.radiusAt(fy);
  const body = material(spec.style, spec.color);
  const white = painted ? material('gloss', PAINT.white) : material('jelly', '#ffffff');
  const black = painted ? material('gloss', PAINT.black) : material('jelly', darker(spec.color, 0.3));
  const eyeY = fy + fs * 0.12;

  const eye = (a: number, size: number, lid: boolean) => {
    const h = onSurface(g, s, eyeY, a, -size * 0.25);
    const w = sphere(size, white);
    w.scale.set(1, 1.18, 0.55);
    h.add(w);
    const p = sphere(size * 0.52, black);
    p.scale.set(1, 1.1, 0.5);
    p.position.set(0, -size * 0.1, size * 0.36);
    h.add(p);
    if (painted) {
      const shine = sphere(size * 0.17, material('gloss', '#ffffff'), 10);
      shine.position.set(size * 0.2, size * 0.18, size * 0.62);
      h.add(shine);
    }
    if (lid) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(size * 1.08, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), body);
      l.rotation.x = 0.35;
      l.scale.set(1, 1.18, 0.62);
      h.add(l);
    }
    return h;
  };

  if (kind === 'cyclops') {
    eye(0, fs * 0.36, false);
    return;
  }
  if (kind === 'mask') {
    const band = onSurface(g, s, eyeY, 0, -0.02);
    const mask = new THREE.Mesh(new RoundedBoxGeometry(fs * 1.25, fs * 0.36, fs * 0.2, 3, fs * 0.09), black);
    band.add(mask);
    for (const side of [-1, 1]) {
      const slit = new THREE.Mesh(new RoundedBoxGeometry(fs * 0.34, fs * 0.13, fs * 0.08, 2, fs * 0.05), white);
      slit.position.set(side * fs * 0.28, 0, fs * 0.09);
      slit.rotation.z = side * -0.2;
      band.add(slit);
    }
    return;
  }
  if (kind === 'happy') {
    for (const side of [-1, 1]) {
      const h = onSurface(g, s, eyeY, side * 0.36, 0);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(fs * 0.13, fs * 0.04, 8, 16, Math.PI), black);
      h.add(arc);
    }
    return;
  }
  const size = fs * (kind === 'big' ? 0.26 : 0.23);
  for (const side of [-1, 1]) {
    const h = eye(side * 0.37, size, kind === 'sleepy');
    if (kind === 'angry') {
      const brow = new THREE.Mesh(new RoundedBoxGeometry(size * 1.9, size * 0.42, size * 0.4, 2, size * 0.15), black);
      brow.position.set(-side * size * 0.15, size * 1.05, size * 0.3);
      brow.rotation.z = side * 0.42;
      h.add(brow);
    }
  }
}

function addMouth(g: THREE.Group, s: Shape, spec: FigSpec, painted: boolean) {
  const kind = spec.mouth ?? 'smile';
  if (kind === 'none') return;
  const fy = s.faceY;
  const fs = s.radiusAt(fy);
  const dark = painted ? material('vinyl', PAINT.mouth) : material('jelly', darker(spec.color, 0.3));
  const white = painted ? material('gloss', PAINT.white) : material('jelly', '#ffffff');
  const my = fy - fs * 0.32;
  const h = onSurface(g, s, my, 0, -0.03);

  if (kind === 'smile' || kind === 'fangs' || kind === 'frown') {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(fs * 0.24, fs * 0.055, 10, 20, Math.PI), dark);
    arc.rotation.z = kind === 'frown' ? 0 : Math.PI;
    arc.position.y = kind === 'frown' ? -fs * 0.12 : fs * 0.1;
    h.add(arc);
    if (kind === 'fangs') {
      for (const side of [-1, 1]) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(fs * 0.06, fs * 0.16, 8), white);
        fang.rotation.z = Math.PI;
        fang.position.set(side * fs * 0.14, -fs * 0.13, fs * 0.04);
        h.add(fang);
      }
    }
  } else if (kind === 'grin') {
    const m = new THREE.Mesh(new RoundedBoxGeometry(fs * 0.7, fs * 0.28, fs * 0.12, 3, fs * 0.1), dark);
    h.add(m);
    for (let i = 0; i < 6; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(fs * 0.085, fs * 0.08, fs * 0.05), white);
      tooth.position.set((i - 2.5) * fs * 0.1, fs * 0.08, fs * 0.05);
      h.add(tooth);
      const low = tooth.clone();
      low.position.y = -fs * 0.08;
      h.add(low);
    }
  } else if (kind === 'o') {
    const o = sphere(fs * 0.11, dark, 16);
    o.scale.set(1, 1.2, 0.4);
    h.add(o);
  }
}

// ---------- Decorations ----------

function addTops(g: THREE.Group, s: Shape, spec: FigSpec) {
  const c2 = material(spec.style, spec.color2 ?? spec.color);
  const body = material(spec.style, spec.color);
  const top = s.top;
  const r = s.radiusAt(top * 0.82);
  for (const t of spec.top ?? []) {
    switch (t) {
      case 'horns':
        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.75, 14), c2);
          horn.position.set(side * r * 0.7, top * 0.92, 0);
          horn.rotation.z = -side * 0.75;
          g.add(horn);
        }
        break;
      case 'ears':
        for (const side of [-1, 1]) {
          const ear = sphere(0.3, body);
          ear.scale.set(0.55, 1, 0.35);
          ear.position.set(side * r * 0.9, top * 0.84, 0.05);
          ear.rotation.z = -side * 0.6;
          g.add(ear);
        }
        break;
      case 'catEars':
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 4), body);
          ear.position.set(side * r * 0.6, top * 0.93, 0);
          ear.rotation.set(0, Math.PI / 4, -side * 0.35);
          g.add(ear);
        }
        break;
      case 'spikes':
        for (let i = 0; i < 4; i++) {
          const y = top * (0.98 - i * 0.18);
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 10), c2);
          const p = surface(s, y, Math.PI, 0.02);
          sp.position.copy(p);
          sp.rotation.x = -0.9 + i * 0.25;
          g.add(sp);
        }
        break;
      case 'fin': {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 3), c2);
        fin.scale.z = 0.3;
        fin.position.set(0, top + 0.18, 0.1);
        g.add(fin);
        break;
      }
      case 'crown': {
        const gold = material('metal', PAINT.gold);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.6, 0.22, 24, 1, true), gold);
        band.position.y = top - 0.02;
        g.add(band);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 8), gold);
          tip.position.set(Math.cos(a) * r * 0.55, top + 0.2, Math.sin(a) * r * 0.55);
          g.add(tip);
          const gem = sphere(0.05, material('gloss', '#e11d48'), 8);
          gem.position.set(Math.cos(a) * r * 0.59, top + 0.02, Math.sin(a) * r * 0.59);
          g.add(gem);
        }
        break;
      }
      case 'leaf': {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 8), c2);
        stem.position.y = top + 0.1;
        g.add(stem);
        for (const side of [-1, 1]) {
          const leaf = sphere(0.22, c2, 16);
          leaf.scale.set(1, 0.25, 0.55);
          leaf.position.set(side * 0.2, top + 0.24, 0);
          leaf.rotation.z = side * 0.45;
          g.add(leaf);
        }
        break;
      }
      case 'antenna':
        for (const side of [-1, 1]) {
          const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), body);
          stick.position.set(side * 0.22, top + 0.18, 0);
          stick.rotation.z = -side * 0.35;
          g.add(stick);
          const ball = sphere(0.1, c2, 12);
          ball.position.set(side * 0.31, top + 0.42, 0);
          g.add(ball);
        }
        break;
      case 'helmet': {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), c2);
        cap.position.y = top - r * 0.62;
        g.add(cap);
        const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.94, 0.08, 10, 32), material(spec.style, spec.color3 ?? '#9ec5e8'));
        band.rotation.x = Math.PI / 2;
        band.position.y = top - r * 0.5;
        band.scale.y = DEPTH;
        g.add(band);
        break;
      }
      case 'hair': {
        const hair = material(spec.style, spec.color3 ?? spec.color2 ?? spec.color);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.0, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), hair);
        cap.position.set(0, top - r * 0.66, 0.06);
        cap.scale.z = DEPTH;
        g.add(cap);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 8), hair);
          tuft.position.set(Math.cos(a) * r * 0.32, top - 0.02, Math.sin(a) * r * 0.32 + 0.08);
          tuft.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
          g.add(tuft);
        }
        break;
      }
      case 'flame':
        for (const [x, h, sc] of [
          [0, 0.75, 1],
          [-0.22, 0.5, 0.75],
          [0.22, 0.55, 0.8],
        ] as const) {
          const f = new THREE.Mesh(new THREE.ConeGeometry(0.2 * sc, h, 12), material(spec.style, spec.color2 ?? '#ffcc33'));
          f.position.set(x, top + h * 0.3, 0.05);
          g.add(f);
        }
        break;
      case 'crystal': {
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), material('jelly', spec.color2 ?? '#a5f3fc'));
        cr.scale.y = 1.7;
        cr.position.y = top + 0.3;
        g.add(cr);
        break;
      }
      case 'longEars':
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 6, 12), body);
          ear.position.set(side * r * 0.6, top + 0.28, 0.04);
          ear.rotation.z = -side * 0.28;
          g.add(ear);
          const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 6, 10), material(spec.style, spec.color2 ?? PAINT.pink));
          inner.scale.z = 0.4;
          inner.position.set(side * r * 0.6 - side * 0.02, top + 0.28, -0.07);
          inner.rotation.z = -side * 0.28;
          g.add(inner);
        }
        break;
      case 'leafCrown':
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const leaf = sphere(0.32, c2, 16);
          leaf.scale.set(0.38, 1, 0.14);
          leaf.position.set(Math.cos(a) * 0.16, top + 0.32, Math.sin(a) * 0.16);
          leaf.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
          g.add(leaf);
        }
        break;
      case 'bun': {
        const bun = sphere(0.24, c2);
        bun.position.y = top + 0.1;
        g.add(bun);
        break;
      }
    }
  }
}

function addExtras(g: THREE.Group, s: Shape, spec: FigSpec) {
  const body = material(spec.style, spec.color);
  const c2 = material(spec.style, spec.color2 ?? spec.color);
  for (const e of spec.extras ?? []) {
    switch (e) {
      case 'arms':
        for (const side of [-1, 1]) {
          const y = s.faceY * 0.55;
          const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 6, 12), body);
          const p = surface(s, y, side * Math.PI * 0.5, -0.04);
          arm.position.copy(p);
          arm.rotation.z = side * 0.55;
          arm.rotation.x = 0.35;
          g.add(arm);
        }
        break;
      case 'feet':
        for (const side of [-1, 1]) {
          const foot = sphere(0.26, body);
          foot.scale.set(1, 0.55, 1.2);
          foot.position.set(side * 0.42, 0.12, -s.depthAt(0.1) * 0.75);
          g.add(foot);
        }
        break;
      case 'belly': {
        const h = onSurface(g, s, s.faceY * 0.42, 0, -0.12);
        const b = sphere(s.radiusAt(s.faceY * 0.42) * 0.62, c2);
        b.scale.set(1, 1.1, 0.42);
        h.add(b);
        break;
      }
      case 'cheeks':
        for (const side of [-1, 1]) {
          const h = onSurface(g, s, s.faceY - 0.12, side * 0.62, -0.02);
          const c = sphere(0.1, material('vinyl', PAINT.pink), 12);
          c.scale.set(1.3, 0.8, 0.3);
          h.add(c);
        }
        break;
      case 'tail': {
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 12), body);
        tail.position.set(0.15, 0.25, s.depthAt(0.25) + 0.2);
        tail.rotation.set(-1.2, 0, 0.3);
        g.add(tail);
        break;
      }
      case 'wings':
        for (const side of [-1, 1]) {
          const w = sphere(0.45, c2, 18);
          w.scale.set(0.35, 0.8, 0.12);
          w.position.set(side * s.radiusAt(1) * 0.75, s.faceY * 0.9, s.depthAt(1) * 0.75);
          w.rotation.set(0.2, side * 0.6, -side * 0.5);
          g.add(w);
        }
        break;
      case 'shirt': {
        const y0 = 0.05;
        const y1 = s.faceY * 0.62;
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i <= 8; i++) {
          const y = y0 + ((y1 - y0) * i) / 8;
          pts.push(new THREE.Vector2(s.radiusAt(y) + 0.025, y));
        }
        const shirt = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), c2);
        shirt.scale.z = DEPTH;
        g.add(shirt);
        if (spec.number != null) {
          const plate = new THREE.Mesh(
            new THREE.PlaneGeometry(0.62, 0.48),
            new THREE.MeshBasicMaterial({ map: numberTexture(String(spec.number)), transparent: true }),
          );
          const y = (y0 + y1) / 2;
          plate.position.set(0, y, s.depthAt(y) + 0.04);
          g.add(plate);
        }
        break;
      }
      case 'scarf': {
        const y = s.faceY - s.radiusAt(s.faceY) * 0.62;
        const sc = new THREE.Mesh(new THREE.TorusGeometry(s.radiusAt(y) * 0.98, 0.1, 10, 32), c2);
        sc.rotation.x = Math.PI / 2;
        sc.scale.y = DEPTH;
        sc.position.y = y;
        g.add(sc);
        break;
      }
      case 'bolt': {
        const h = onSurface(g, s, s.faceY * 0.45, 0, -0.03);
        const shape = new THREE.Shape();
        shape.moveTo(0.06, 0.22);
        shape.lineTo(-0.1, -0.02);
        shape.lineTo(0.0, -0.02);
        shape.lineTo(-0.06, -0.22);
        shape.lineTo(0.1, 0.04);
        shape.lineTo(0.0, 0.04);
        shape.closePath();
        const bolt = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }), c2);
        h.add(bolt);
        break;
      }
      case 'shield': {
        const sh = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.6, 0.1, 2, 0.05), c2);
        const p = surface(s, s.faceY * 0.5, Math.PI * 0.32, 0.05);
        sh.position.copy(p);
        sh.rotation.y = -0.6;
        g.add(sh);
        break;
      }
    }
  }
}

// ---------- Chess ----------

function chessFigure(spec: FigSpec): THREE.Group {
  const g = new THREE.Group();
  const m = material(spec.style, spec.color);
  const c2 = material(spec.style === 'jelly' ? 'jelly' : 'metal', spec.color2 ?? PAINT.gold);
  const piece = spec.piece ?? 'peao';
  const h = { rei: 2.9, rainha: 2.7, torre: 1.9, cavalo: 2.1, bispo: 2.4, peao: 1.6 }[piece];
  const prof: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 0.14],
    [0.86, 0.26],
    [0.62, 0.42],
    [0.55, h * 0.48],
    [0.48, h * 0.74],
    [0.7, h * 0.8],
    [0.7, h * 0.86],
    [piece === 'torre' ? 0.66 : 0.38, h * 0.9],
    [0, h * 0.92],
  ];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40), m));
  const top = h * 0.92;
  if (piece === 'rei') {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), c2);
    v.position.y = top + 0.27;
    const hz = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.14), c2);
    hz.position.y = top + 0.34;
    g.add(v, hz);
  } else if (piece === 'rainha') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const b = sphere(0.09, c2, 10);
      b.position.set(Math.cos(a) * 0.32, top + 0.05, Math.sin(a) * 0.32);
      g.add(b);
    }
    const b = sphere(0.14, c2, 12);
    b.position.y = top + 0.18;
    g.add(b);
  } else if (piece === 'torre') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), m);
      b.position.set(Math.cos(a) * 0.5, top + 0.12, Math.sin(a) * 0.5);
      b.rotation.y = -a;
      g.add(b);
    }
  } else if (piece === 'cavalo') {
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.8, 0.72, 3, 0.2), m);
    head.position.set(0, top + 0.36, 0);
    g.add(head);
    const snout = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.42, 0.6, 3, 0.16), m);
    snout.position.set(0, top + 0.2, -0.42);
    g.add(snout);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), m);
      ear.position.set(side * 0.22, top + 0.86, 0.05);
      g.add(ear);
      const nostril = sphere(0.04, material('gloss', PAINT.black), 8);
      nostril.position.set(side * 0.12, top + 0.22, -0.72);
      g.add(nostril);
    }
    const mane = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.9, 0.34, 2, 0.08), c2);
    mane.position.set(0, top + 0.42, 0.36);
    g.add(mane);
  } else if (piece === 'bispo') {
    const cap = sphere(0.36, m);
    cap.scale.y = 1.45;
    cap.position.y = top + 0.3;
    g.add(cap);
    const tip = sphere(0.09, c2, 10);
    tip.position.y = top + 0.85;
    g.add(tip);
  } else {
    const ball = sphere(0.42, m);
    ball.position.y = top + 0.3;
    g.add(ball);
  }
  // A little face, because every piece here is a character.
  const faceShape: Shape = { radiusAt: () => 0.42, depthAt: () => 0.42, top, faceY: top + 0.3 };
  if (piece === 'cavalo') {
    const hs: Shape = { radiusAt: () => 0.36, depthAt: () => 0.38, top, faceY: top + 0.5 };
    addEyes(g, hs, { ...spec, eyes: 'big' }, true);
  } else if (piece === 'peao') {
    addEyes(g, faceShape, { ...spec, eyes: 'big' }, true);
    addMouth(g, faceShape, { ...spec, mouth: 'smile' }, true);
  } else {
    const fs: Shape = { radiusAt: () => 0.5, depthAt: () => 0.5, top, faceY: h * 0.62 };
    addEyes(g, fs, { ...spec, eyes: spec.eyes ?? 'big' }, true);
  }
  return g;
}

// ---------- Critters (little animals on legs) ----------

function critterFigure(spec: FigSpec): THREE.Group {
  const g = new THREE.Group();
  const body = material(spec.style, spec.color);
  const c2 = material(spec.style, spec.color2 ?? spec.color);
  const painted = spec.style !== 'jelly';
  const ex = spec.extras ?? [];
  const four = spec.body === 'critter4';
  let head: THREE.Vector3;
  let headR: number;

  if (four) {
    const torso = sphere(0.62, body, 28);
    torso.scale.set(0.95, 0.78, 1.2);
    torso.position.set(0, 0.62, 0.12);
    g.add(torso);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.18, 6, 12), body);
        leg.position.set(sx * 0.4, 0.26, 0.12 + sz * 0.45);
        g.add(leg);
      }
    }
    headR = 0.52;
    head = new THREE.Vector3(0, 1.0, -0.62);
    if (ex.includes('belly')) {
      const b = sphere(0.5, c2, 20);
      b.scale.set(0.85, 0.5, 1.05);
      b.position.set(0, 0.42, 0.12);
      g.add(b);
    }
    if (ex.includes('shell')) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), c2);
      dome.scale.set(0.98, 0.8, 1.15);
      dome.position.set(0, 0.62, 0.18);
      g.add(dome);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 10, 36), material(spec.style, darker(spec.color2 ?? spec.color, 0.7)));
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(0.98, 1.15, 1);
      rim.position.set(0, 0.64, 0.18);
      g.add(rim);
      // Plates on the shell
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const plate = sphere(0.16, material(spec.style, darker(spec.color2 ?? spec.color, 0.8)), 12);
        plate.scale.set(1, 0.35, 1);
        plate.position.set(Math.cos(a) * 0.36, 1.12 - 0.08, 0.18 + Math.sin(a) * 0.42);
        g.add(plate);
      }
    }
    if (ex.includes('stripes')) {
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.08, 0.14, 2, 0.04), c2);
        st.position.set(0, 1.06 - Math.abs(i - 1) * 0.04, 0.0 + i * 0.32);
        g.add(st);
      }
    }
  } else {
    const torso = sphere(0.6, body, 28);
    torso.scale.set(0.95, 1.0, 0.85);
    torso.position.set(0, 0.78, 0);
    g.add(torso);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.2, 6, 12), body);
      leg.position.set(sx * 0.3, 0.24, 0);
      g.add(leg);
      const foot = sphere(0.2, body, 14);
      foot.scale.set(1, 0.5, 1.4);
      foot.position.set(sx * 0.32, 0.08, -0.14);
      g.add(foot);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 6, 12), body);
      arm.position.set(sx * 0.6, 0.9, -0.08);
      arm.rotation.set(0.4, 0, sx * 0.75);
      g.add(arm);
    }
    headR = 0.56;
    head = new THREE.Vector3(0, 1.58, -0.04);
    if (ex.includes('belly') || ex.includes('spiral')) {
      const b = sphere(0.44, c2, 20);
      b.scale.set(1, 1.1, 0.5);
      b.position.set(0, 0.74, -0.36);
      g.add(b);
    }
    if (ex.includes('spiral')) {
      const dark = material(painted ? 'vinyl' : spec.style, darker(spec.color2 ?? spec.color, 0.35));
      for (const [r, t] of [
        [0.3, 0.035],
        [0.18, 0.035],
        [0.07, 0.04],
      ]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 28), dark);
        ring.position.set(0, 0.76, -0.58);
        g.add(ring);
      }
    }
    if (ex.includes('stripes')) {
      for (const y of [0.55, 0.95]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 32), c2);
        band.rotation.x = Math.PI / 2;
        band.scale.y = 0.85;
        band.position.y = y;
        g.add(band);
      }
    }
  }

  // Tail
  if (ex.includes('tail') || ex.includes('leafTail')) {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, four ? 0.8 : 0.6, 12), body);
    tail.position.set(0, four ? 0.72 : 0.45, four ? 0.98 : 0.55);
    tail.rotation.x = Math.PI / 2 - 0.6;
    g.add(tail);
    if (ex.includes('leafTail')) {
      const leaf = sphere(0.26, c2, 16);
      leaf.scale.set(0.9, 0.18, 1.3);
      leaf.position.set(0, four ? 1.0 : 0.7, four ? 1.38 : 0.85);
      g.add(leaf);
    }
  }

  // Head with the face
  const hg = new THREE.Group();
  hg.position.copy(head);
  g.add(hg);
  const hs = sphere(headR, body, 28);
  hs.scale.z = 0.95;
  hg.add(hs);
  const hr = (y: number) => Math.sqrt(Math.max(0.0001, headR * headR - y * y));
  const hShape: Shape = { radiusAt: hr, depthAt: (y) => hr(y) * 0.95, top: headR, faceY: 0 };
  if (ex.includes('snout')) {
    const beak = sphere(headR * 0.48, c2, 18);
    beak.scale.set(1.15, 0.5, 1);
    beak.position.set(0, -headR * 0.28, -headR * 0.88);
    hg.add(beak);
  }
  if (ex.includes('cheeks')) {
    for (const side of [-1, 1]) {
      const h = onSurface(hg, hShape, -headR * 0.22, side * 0.75, -0.02);
      const ch = sphere(0.1, material('vinyl', '#ff5a5f'), 12);
      ch.scale.set(1.2, 1, 0.3);
      h.add(ch);
    }
  }
  addTops(hg, hShape, spec);
  addEyes(hg, hShape, spec, painted);
  addMouth(hg, hShape, spec, painted);
  return g;
}

// ---------- Public ----------

export function buildFigure(spec: FigSpec): THREE.Group {
  let g: THREE.Group;
  if (spec.body === 'chess') {
    g = chessFigure(spec);
  } else if (spec.body === 'critter4' || spec.body === 'critter2') {
    g = critterFigure(spec);
  } else {
    g = new THREE.Group();
    const body = material(spec.style, spec.color);
    let shape: Shape;
    if (spec.body === 'block') {
      const geo = new RoundedBoxGeometry(1.86, 1.72, 1.86 * DEPTH, 5, 0.34);
      geo.translate(0, 0.86, 0);
      g.add(new THREE.Mesh(geo, body));
      shape = { radiusAt: () => 0.93, depthAt: () => 0.93 * DEPTH, top: 1.72, faceY: 0 };
    } else {
      const prof = PROFILES[spec.body];
      const lathe = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48), body);
      lathe.scale.z = DEPTH;
      g.add(lathe);
      shape = latheShape(prof);
    }
    shape.faceY = FACE_Y[spec.body];

    // Face patch: hood opening or a big skin-colored face.
    if (spec.skin) {
      const fy = shape.faceY;
      const h = onSurface(g, shape, fy, 0, -0.32);
      const patch = sphere(shape.radiusAt(fy) * 0.72, material(spec.style, spec.skin), 28);
      patch.scale.set(1, 1.02, 0.6);
      h.add(patch);
      const depth = shape.depthAt;
      shape = { ...shape, depthAt: (y) => depth(y) + (Math.abs(y - fy) < shape.radiusAt(fy) * 0.6 ? 0.04 : 0) };
    }

    const painted = spec.style !== 'jelly';
    addExtras(g, shape, spec);
    addTops(g, shape, spec);
    addEyes(g, shape, spec, painted);
    addMouth(g, shape, spec, painted);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function numberTexture(text: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 72;
  const ctx = cv.getContext('2d')!;
  ctx.font = '900 60px "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a1420';
  ctx.strokeText(text, 48, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 48, 40);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
