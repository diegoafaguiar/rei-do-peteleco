// Scenery objects built from simple shapes. Units: 1 ≈ 6 mm, so a toy piece (radius ~2.6)
// is about 3 cm wide and a mug is about 8 cm. Every prop stands on y = 0.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildFigure, type ChessPiece } from '../figures/build';
import { rng } from './textures';

const mats = new Map<string, THREE.Material>();
export function mat(color: string, opts: { rough?: number; metal?: number; emissive?: string; glass?: boolean; side?: THREE.Side } = {}) {
  const key = JSON.stringify([color, opts]);
  let m = mats.get(key);
  if (!m) {
    if (opts.glass) {
      m = new THREE.MeshPhysicalMaterial({ color, transmission: 0.9, roughness: 0.05, thickness: 1, ior: 1.4, transparent: true, opacity: 0.6 });
    } else {
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: opts.rough ?? 0.55,
        metalness: opts.metal ?? 0,
        emissive: opts.emissive ?? '#000000',
        emissiveIntensity: opts.emissive ? 0.75 : 0,
        side: opts.side ?? THREE.FrontSide,
      });
    }
    mats.set(key, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

const cyl = (rt: number, rb: number, h: number, seg = 28) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w: number, h: number, d: number, r = 0) => (r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d));
const ball = (r: number, seg = 24) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7));

function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

/** Place a prop and turn it to face a direction (degrees). */
export function put(parent: THREE.Object3D, obj: THREE.Object3D, x: number, z: number, rotDeg = 0, scale = 1, y = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = (rotDeg * Math.PI) / 180;
  obj.scale.multiplyScalar(scale);
  parent.add(obj);
  return obj;
}

// ---------- Kitchen & living room ----------

export function mug(color = '#e85d75') {
  const g = group(
    mesh(new THREE.CylinderGeometry(5, 4.6, 13, 32, 1, true), mat(color, { side: THREE.DoubleSide }), 0, 6.5, 0),
    mesh(cyl(4.6, 4.6, 0.8), mat(color), 0, 0.4, 0),
    mesh(cyl(4.7, 4.7, 0.4), mat('#5b3216', { rough: 0.2 }), 0, 10.5, 0),
  );
  const handle = mesh(new THREE.TorusGeometry(3, 0.9, 10, 24, Math.PI * 1.2), mat(color), 5.2, 6.5, 0);
  handle.rotation.z = -Math.PI * 0.6;
  g.add(handle);
  return g;
}

export function plate(r = 14, food: 'bread' | 'cake' | 'none' = 'none') {
  const g = group(mesh(cyl(r, r * 0.75, 1.4, 40), mat('#ffffff', { rough: 0.25 }), 0, 0.7, 0));
  const rim = mesh(new THREE.TorusGeometry(r * 0.92, 0.5, 8, 40), mat('#7fb6c9', { rough: 0.3 }), 0, 1.4, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  if (food === 'bread') {
    for (const [x, z, a] of [
      [-3, 0, 0.3],
      [4, 2, -0.4],
    ]) {
      const b = mesh(new THREE.CapsuleGeometry(2.6, 6, 6, 12), mat('#d99a4e'), x, 3.6, z);
      b.rotation.set(Math.PI / 2, 0, a);
      g.add(b);
    }
  } else if (food === 'cake') {
    g.add(mesh(cyl(7, 7, 6, 32), mat('#f7d1e0'), 0, 4.4, 0), mesh(cyl(7.2, 7.2, 1.2, 32), mat('#ffffff'), 0, 7.8, 0));
    g.add(mesh(ball(1.4), mat('#e53935', { rough: 0.2 }), 0, 9.2, 0));
  }
  return g;
}

export function fruitBowl() {
  const bowl = mesh(new THREE.SphereGeometry(16, 36, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#f2f2f2', { rough: 0.2, side: THREE.DoubleSide }), 0, 9, 0);
  bowl.scale.y = 0.55;
  const g = group(bowl, mesh(cyl(6, 7, 1.2), mat('#f2f2f2', { rough: 0.2 }), 0, 0.6, 0));
  const r = rng(5);
  const fruit: [string, number][] = [
    ['#ff9800', 5],
    ['#ff9800', 5],
    ['#d32f2f', 4.6],
    ['#d32f2f', 4.6],
    ['#8bc34a', 4.4],
    ['#ff9800', 5],
  ];
  fruit.forEach(([c, s], i) => {
    const a = (i / fruit.length) * Math.PI * 2;
    g.add(mesh(ball(s), mat(c, { rough: 0.45 }), Math.cos(a) * 7, 9 + r() * 2, Math.sin(a) * 7));
  });
  const banana = mesh(new THREE.TorusGeometry(8, 1.8, 10, 24, Math.PI * 0.7), mat('#ffe14d'), 0, 13, 0);
  banana.rotation.set(Math.PI / 2.4, 0, 0.6);
  g.add(banana);
  return g;
}

export function shakers() {
  const one = (c: string, x: number) =>
    group(mesh(cyl(2.2, 2.4, 8), mat('#ffffff', { glass: true }), x, 4, 0), mesh(cyl(2.3, 2.3, 1.2), mat('#c0c0c0', { metal: 0.9, rough: 0.2 }), x, 8.6, 0), mesh(cyl(1.8, 1.8, 3), mat(c), x, 2, 0));
  return group(one('#f5f5f5', -3), one('#333333', 3));
}

export function napkinHolder() {
  return group(mesh(box(12, 1, 6, 0.4), mat('#b0bec5', { metal: 0.6, rough: 0.3 }), 0, 0.5, 0), mesh(box(10, 9, 2.5), mat('#ffffff'), 0, 5, 0));
}

export function cuttingBoard() {
  const g = group(mesh(box(26, 1.6, 16, 0.6), mat('#d7a86e', { rough: 0.6 }), 0, 0.8, 0));
  for (let i = 0; i < 4; i++) {
    const c = mesh(cyl(1.2, 1.2, 1.2, 16), mat('#ff7f27'), -6 + i * 3.4, 2, 2);
    g.add(c);
  }
  const carrot = mesh(new THREE.ConeGeometry(1.6, 10, 12), mat('#ff7f27'), 6, 2.2, -3);
  carrot.rotation.z = Math.PI / 2;
  g.add(carrot);
  return g;
}

export function book(w: number, d: number, h: number, color: string) {
  return group(mesh(box(w, h, d, 0.3), mat(color), 0, h / 2, 0), mesh(box(w - 1, h - 0.6, d - 0.2), mat('#fffaf0'), 0.6, h / 2, 0));
}

export function bookStack() {
  const g = new THREE.Group();
  const colors = ['#1e88e5', '#e53935', '#43a047', '#fdd835'];
  let y = 0;
  colors.forEach((c, i) => {
    const b = book(22 - i * 2, 15 - i, 3, c);
    b.position.y = y;
    b.rotation.y = (i - 1.5) * 0.15;
    g.add(b);
    y += 3;
  });
  return g;
}

export function vase() {
  const g = group(mesh(cyl(3.5, 5, 16, 28), mat('#5c6bc0', { rough: 0.2 }), 0, 8, 0));
  const r = rng(9);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * 2;
    const z = Math.sin(a) * 2;
    const stem = mesh(cyl(0.3, 0.3, 12, 6), mat('#2e7d32'), x, 20, z);
    stem.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
    g.add(stem);
    g.add(mesh(ball(2.2 + r()), mat(['#ff5a8a', '#ffd23f', '#ffffff'][i % 3]), x * 1.8, 26 + r() * 2, z * 1.8));
  }
  return g;
}

export function remote() {
  const g = group(mesh(box(5, 1.6, 18, 0.7), mat('#2b2b2b', { rough: 0.4 }), 0, 0.8, 0));
  const colors = ['#e53935', '#43a047', '#1e88e5', '#fdd835'];
  colors.forEach((c, i) => g.add(mesh(ball(0.6, 10), mat(c), -1.2 + (i % 2) * 2.4, 1.7, -5 + Math.floor(i / 2) * 2.4)));
  return g;
}

export function candle() {
  return group(mesh(cyl(2.5, 2.5, 8), mat('#fff3d6'), 0, 4, 0), mesh(new THREE.ConeGeometry(0.8, 2.5, 10), mat('#ffb300', { emissive: '#ff9800' }), 0, 9.6, 0));
}

export function sofa(color = '#5c7cfa') {
  const m = mat(color, { rough: 0.85 });
  return group(
    mesh(box(220, 40, 90, 10), m, 0, 30, 0),
    mesh(box(220, 70, 25, 10), m, 0, 60, 35),
    mesh(box(25, 55, 90, 10), m, -110, 45, 0),
    mesh(box(25, 55, 90, 10), m, 110, 45, 0),
    mesh(box(95, 12, 70, 6), mat(color, { rough: 0.9 }), -50, 55, -5),
    mesh(box(95, 12, 70, 6), mat(color, { rough: 0.9 }), 50, 55, -5),
  );
}

export function plantPot(h = 90) {
  const g = group(mesh(cyl(18, 13, 30), mat('#d9774a', { rough: 0.7 }), 0, 15, 0));
  const r = rng(h);
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(ball(14, 14), mat(i % 2 ? '#2e7d32' : '#43a047', { rough: 0.7 }), (r() - 0.5) * 20, 30 + r() * h * 0.6, (r() - 0.5) * 20);
    leaf.scale.set(0.5, 1.4, 0.18);
    leaf.rotation.set(r() - 0.5, r() * 6, (r() - 0.5) * 1.2);
    g.add(leaf);
  }
  return g;
}

export function floorLamp() {
  return group(
    mesh(cyl(14, 16, 3), mat('#333333', { metal: 0.6 }), 0, 1.5, 0),
    mesh(cyl(1.5, 1.5, 150, 10), mat('#333333', { metal: 0.6 }), 0, 77, 0),
    mesh(new THREE.CylinderGeometry(14, 24, 30, 28, 1, true), mat('#fff1c1', { emissive: '#ffd27a', side: THREE.DoubleSide }), 0, 160, 0),
  );
}

export function kitchenWall(width: number) {
  const g = new THREE.Group();
  const wall = mesh(new THREE.PlaneGeometry(width, 400), mat('#f6e7c8', { rough: 0.9 }), 0, 200 - 125, 0);
  g.add(wall);
  // Counter with cabinets
  g.add(mesh(box(width * 0.7, 150, 60), mat('#ffffff'), 0, 75 - 125, 30));
  g.add(mesh(box(width * 0.7 + 4, 6, 64), mat('#455a64', { rough: 0.3 }), 0, 153 - 125, 30));
  for (let i = 0; i < 6; i++) {
    const x = -width * 0.35 + 50 + i * ((width * 0.7 - 100) / 5);
    g.add(mesh(box(4, 10, 3), mat('#9e9e9e', { metal: 0.8, rough: 0.2 }), x, 120 - 125, 61));
    g.add(mesh(box(90, 80, 40), mat('#a5d6a7'), x, 280 - 125, 20));
  }
  // Window with sky
  g.add(mesh(box(160, 110, 4), mat('#ffffff'), width * 0.2, 230 - 125, 1));
  g.add(mesh(new THREE.PlaneGeometry(146, 96), mat('#9fd8ff', { emissive: '#7cc6ff' }), width * 0.2, 230 - 125, 3.5));
  // Fridge
  g.add(mesh(box(90, 190, 70, 6), mat('#eceff1', { rough: 0.3 }), -width * 0.42, 95 - 125, 40));
  return g;
}

export function tvWall(width: number) {
  const g = group(mesh(new THREE.PlaneGeometry(width, 400), mat('#dfe7f2', { rough: 0.9 }), 0, 75, 0));
  g.add(mesh(box(220, 50, 45), mat('#8d6e63'), 0, 25 - 125, 25));
  g.add(mesh(box(180, 105, 6), mat('#111111', { rough: 0.2 }), 0, 110 - 125, 20));
  g.add(mesh(new THREE.PlaneGeometry(170, 95), mat('#3d7bff', { emissive: '#2a5bd7' }), 0, 110 - 125, 23.2));
  for (let i = 0; i < 3; i++) g.add(mesh(box(50, 60, 3), mat(['#ffcc80', '#90caf9', '#a5d6a7'][i]), -260 + i * 70, 200 - 125, 2));
  return g;
}

// ---------- Street & school ----------

export function cone() {
  const g = group(
    mesh(box(26, 2, 26, 1), mat('#ff6d00'), 0, 1, 0),
    mesh(new THREE.ConeGeometry(9, 42, 28), mat('#ff6d00', { rough: 0.4 }), 0, 23, 0),
  );
  const band = mesh(cyl(5.2, 6.4, 6, 28), mat('#ffffff', { rough: 0.3 }), 0, 24, 0);
  g.add(band);
  return g;
}

export function manhole() {
  const g = group(mesh(cyl(22, 22, 0.8, 40), mat('#3a3a3a', { metal: 0.6, rough: 0.5 }), 0, 0.4, 0));
  for (let i = -3; i <= 3; i++) g.add(mesh(box(36 - Math.abs(i) * 4, 0.5, 1.6), mat('#2a2a2a', { metal: 0.6 }), 0, 0.9, i * 5));
  return g;
}

export function bottleCap(color = '#e53935') {
  const g = group(mesh(cyl(2.4, 2.4, 1.2, 20), mat(color, { metal: 0.6, rough: 0.3 }), 0, 0.6, 0));
  return g;
}

export function leaf(color = '#c77d2b') {
  const l = mesh(ball(4, 14), mat(color, { rough: 0.8 }), 0, 0.3, 0);
  l.scale.set(0.55, 0.06, 1);
  return group(l);
}

export function pebble(color = '#9e9e9e', s = 2) {
  const p = mesh(new THREE.DodecahedronGeometry(s, 0), mat(color, { rough: 0.9 }), 0, s * 0.5, 0);
  p.scale.y = 0.6;
  return group(p);
}

export function curb(length: number) {
  return group(mesh(box(length, 25, 25), mat('#d6d2c8', { rough: 0.9 }), 0, 12.5, 0));
}

export function lampPost() {
  return group(
    mesh(cyl(5, 7, 600, 12), mat('#37474f', { metal: 0.5 }), 0, 300, 0),
    mesh(box(60, 10, 25, 4), mat('#37474f', { metal: 0.5 }), 25, 600, 0),
    mesh(box(40, 4, 18), mat('#fff8e1', { emissive: '#ffe082' }), 35, 594, 0),
  );
}

export function tree(size = 1, leaves = '#43a047') {
  const g = group(mesh(cyl(10 * size, 14 * size, 220 * size, 12), mat('#795548', { rough: 0.9 }), 0, 110 * size, 0));
  const r = rng(Math.round(size * 100));
  for (let i = 0; i < 6; i++) {
    g.add(mesh(ball(60 * size * (0.7 + r() * 0.5), 16), mat(i % 2 ? leaves : '#388e3c', { rough: 0.9 }), (r() - 0.5) * 90 * size, (230 + r() * 80) * size, (r() - 0.5) * 90 * size));
  }
  return g;
}

export function building(w: number, h: number, color: string) {
  const g = group(mesh(box(w, h, 200), mat(color, { rough: 0.85 }), 0, h / 2, 0));
  const win = mat('#bfe3ff', { emissive: '#4f86b8', rough: 0.2 });
  for (let y = 80; y < h - 60; y += 110) {
    for (let x = -w / 2 + 60; x < w / 2 - 40; x += 90) g.add(mesh(box(50, 60, 4), win, x, y, 101));
  }
  return g;
}

export function car(color = '#e53935') {
  const g = group(
    mesh(box(420, 90, 190, 30), mat(color, { rough: 0.3, metal: 0.3 }), 0, 85, 0),
    mesh(box(230, 75, 170, 30), mat(color, { rough: 0.3, metal: 0.3 }), -20, 160, 0),
    mesh(box(200, 55, 174, 20), mat('#9fd8ff', { rough: 0.1 }), -20, 165, 0),
  );
  for (const [x, z] of [
    [-130, 95],
    [130, 95],
    [-130, -95],
    [130, -95],
  ]) {
    const w = mesh(cyl(40, 40, 30, 24), mat('#222222', { rough: 0.8 }), x, 40, z);
    w.rotation.x = Math.PI / 2;
    g.add(w);
  }
  return g;
}

export function hydrant() {
  return group(mesh(cyl(9, 11, 50, 20), mat('#e53935', { rough: 0.4 }), 0, 25, 0), mesh(ball(10, 18), mat('#e53935', { rough: 0.4 }), 0, 52, 0), mesh(cyl(4, 4, 30, 12), mat('#c62828'), 0, 35, 0).rotateZ(Math.PI / 2));
}

export function backpack(color = '#7e57c2') {
  return group(
    mesh(box(30, 38, 16, 7), mat(color, { rough: 0.8 }), 0, 19, 0),
    mesh(box(22, 16, 6, 4), mat(color, { rough: 0.6 }), 0, 13, -10),
    mesh(new THREE.TorusGeometry(5, 1.2, 8, 16, Math.PI), mat('#333333'), 0, 38, 0),
  );
}

export function basketball() {
  const g = group(mesh(ball(15, 32), mat('#ef6c00', { rough: 0.7 }), 0, 15, 0));
  for (const rot of [0, Math.PI / 2]) {
    const t = mesh(new THREE.TorusGeometry(15.1, 0.4, 6, 40), mat('#3e2723'), 0, 15, 0);
    t.rotation.y = rot;
    g.add(t);
  }
  const eq = mesh(new THREE.TorusGeometry(15.1, 0.4, 6, 40), mat('#3e2723'), 0, 15, 0);
  eq.rotation.x = Math.PI / 2;
  g.add(eq);
  return g;
}

export function bench() {
  const wood = mat('#a1662f', { rough: 0.8 });
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(mesh(box(200, 5, 14, 1), wood, 0, 70, -16 + i * 16));
  for (let i = 0; i < 2; i++) g.add(mesh(box(200, 14, 5, 1), wood, 0, 100 + i * 20, 26));
  for (const x of [-85, 85]) g.add(mesh(box(8, 70, 50), mat('#424242', { metal: 0.5 }), x, 35, 5));
  return g;
}

export function chalkDrawing(color = '#ffeb3b') {
  // Sun drawn in chalk on the ground
  const g = new THREE.Group();
  const c = mesh(new THREE.RingGeometry(9, 10.5, 32), mat(color, { rough: 1 }), 0, 0.15, 0);
  c.rotation.x = -Math.PI / 2;
  g.add(c);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ray = mesh(new THREE.PlaneGeometry(1.4, 7), mat(color, { rough: 1 }), Math.cos(a) * 15, 0.15, Math.sin(a) * 15);
    ray.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2);
    g.add(ray);
  }
  return g;
}

export function schoolWall(width: number) {
  const g = group(mesh(new THREE.PlaneGeometry(width, 500), mat('#f4c97b', { rough: 0.9 }), 0, 250, 0));
  for (let x = -width / 2 + 120; x < width / 2 - 80; x += 200) {
    g.add(mesh(box(120, 110, 6), mat('#ffffff'), x, 260, 3));
    g.add(mesh(new THREE.PlaneGeometry(108, 98), mat('#9fd8ff', { emissive: '#5aa9e6' }), x, 260, 6.2));
  }
  g.add(mesh(box(160, 230, 8), mat('#1565c0'), 0, 115, 4));
  return g;
}

// ---------- Mall & food court ----------

export function shoppingBag(color: string) {
  return group(
    mesh(box(26, 32, 12, 1), mat(color, { rough: 0.6 }), 0, 16, 0),
    mesh(new THREE.TorusGeometry(6, 0.7, 8, 20, Math.PI), mat('#222222'), 0, 32, 0),
  );
}

export function coffeeCup() {
  return group(
    mesh(cyl(4.6, 3.6, 16, 28), mat('#ffffff', { rough: 0.4 }), 0, 8, 0),
    mesh(cyl(4.3, 4.0, 5, 28), mat('#8d6e63', { rough: 0.9 }), 0, 8, 0),
    mesh(cyl(5, 5, 1.6, 28), mat('#ffffff', { rough: 0.3 }), 0, 16.6, 0),
  );
}

export function phone() {
  return group(
    mesh(box(11, 1.2, 22, 1.2), mat('#1b1b1f', { rough: 0.2, metal: 0.4 }), 0, 0.6, 0),
    mesh(new THREE.PlaneGeometry(10, 20.4), mat('#7c4dff', { emissive: '#5b34d6' }), 0, 1.25, 0).rotateX(-Math.PI / 2),
  );
}

export function storefront(color: string, sign: string) {
  const g = group(mesh(box(320, 260, 20), mat('#fafafa', { rough: 0.5 }), 0, 130, 0));
  g.add(mesh(box(300, 40, 6), mat(color, { emissive: sign }), 0, 230, 12));
  g.add(mesh(new THREE.PlaneGeometry(280, 170), mat('#cfe8ff', { rough: 0.05, metal: 0.2 }), 0, 95, 10.5));
  return g;
}

export function burger() {
  const g = group(
    mesh(cyl(8, 7.5, 3, 28), mat('#e0a458', { rough: 0.7 }), 0, 1.5, 0),
    mesh(cyl(8.4, 8.4, 2.6, 28), mat('#6d3b1f', { rough: 0.9 }), 0, 4.3, 0),
    mesh(box(16, 0.8, 16), mat('#ffca28'), 0, 5.9, 0).rotateY(0.6),
    mesh(new THREE.TorusGeometry(7.6, 1, 8, 28), mat('#7cb342'), 0, 6.5, 0).rotateX(Math.PI / 2),
  );
  const top = mesh(new THREE.SphereGeometry(8.4, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e0a458', { rough: 0.6 }),);
  top.scale.y = 0.75;
  g.add(top);
  const r = rng(3);
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 5.5;
    g.add(mesh(ball(0.5, 6), mat('#fff8e1'), Math.cos(a) * d, 7 + 6 * Math.sqrt(1 - (d / 8.4) ** 2) * 0.75, Math.sin(a) * d));
  }
  return g;
}

export function fries() {
  const g = group(mesh(new THREE.CylinderGeometry(6, 4.5, 12, 4, 1), mat('#e53935', { rough: 0.5 }), 0, 6, 0).rotateY(Math.PI / 4));
  const r = rng(7);
  for (let i = 0; i < 16; i++) {
    const f = mesh(box(1.1, 10, 1.1), mat('#ffd54f', { rough: 0.7 }), (r() - 0.5) * 7, 13 + r() * 3, (r() - 0.5) * 4);
    f.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
    g.add(f);
  }
  return g;
}

export function soda(color = '#e53935') {
  const g = group(
    mesh(cyl(5, 4, 18, 28), mat(color, { rough: 0.4 }), 0, 9, 0),
    mesh(cyl(5.3, 5.3, 1.2, 28), mat('#ffffff', { rough: 0.3 }), 0, 18.6, 0),
  );
  const straw = mesh(cyl(0.5, 0.5, 14, 8), mat('#ffffff'), 1.2, 24, 0);
  straw.rotation.z = -0.25;
  g.add(straw);
  return g;
}

export function ketchup() {
  return group(mesh(cyl(3, 3.2, 14, 20), mat('#d32f2f', { rough: 0.35 }), 0, 7, 0), mesh(new THREE.ConeGeometry(2.2, 4, 16), mat('#ffffff'), 0, 16, 0));
}

export function plasticChair(color = '#ff7043') {
  const m = mat(color, { rough: 0.4 });
  const g = group(mesh(box(70, 6, 70, 3), m, 0, 75, 0), mesh(box(70, 70, 6, 3), m, 0, 115, 32));
  for (const [x, z] of [
    [-30, -30],
    [30, -30],
    [-30, 30],
    [30, 30],
  ])
    g.add(mesh(cyl(2.5, 2.5, 75, 8), mat('#9e9e9e', { metal: 0.6 }), x, 37, z));
  return g;
}

export function foodStall(color: string, glow: string) {
  const g = group(mesh(box(300, 140, 80), mat('#fafafa'), 0, 70, 0), mesh(box(300, 20, 90), mat(color), 0, 150, -5));
  g.add(mesh(box(260, 50, 8), mat(color, { emissive: glow }), 0, 260, 20));
  for (let i = 0; i < 6; i++) g.add(mesh(box(50, 14, 100), mat(i % 2 ? '#ffffff' : color), -125 + i * 50, 190, -10).rotateX(-0.3));
  return g;
}

// ---------- Ice, chess, stadium ----------

export function snowman() {
  return group(
    mesh(ball(40, 24), mat('#ffffff', { rough: 0.9 }), 0, 38, 0),
    mesh(ball(28, 24), mat('#ffffff', { rough: 0.9 }), 0, 98, 0),
    mesh(ball(19, 24), mat('#ffffff', { rough: 0.9 }), 0, 140, 0),
    mesh(new THREE.ConeGeometry(4, 18, 12), mat('#ff7f27'), 0, 140, -24).rotateX(-Math.PI / 2),
    mesh(cyl(18, 18, 4, 24), mat('#222222'), 0, 158, 0),
    mesh(cyl(12, 12, 22, 24), mat('#222222'), 0, 170, 0),
    mesh(new THREE.TorusGeometry(22, 5, 8, 24), mat('#e53935'), 0, 120, 0).rotateX(Math.PI / 2),
  );
}

export function pine(h = 300) {
  const g = group(mesh(cyl(10, 14, h * 0.3, 10), mat('#6d4c41'), 0, h * 0.15, 0));
  for (let i = 0; i < 4; i++) {
    const s = 1 - i * 0.22;
    g.add(mesh(new THREE.ConeGeometry(h * 0.32 * s, h * 0.35, 14), mat('#2e7d32', { rough: 0.9 }), 0, h * (0.32 + i * 0.17), 0));
    g.add(mesh(new THREE.ConeGeometry(h * 0.2 * s, h * 0.12, 14), mat('#ffffff', { rough: 0.9 }), 0, h * (0.43 + i * 0.17), 0));
  }
  return g;
}

export function rinkBoard(length: number) {
  return group(mesh(box(length, 60, 8, 2), mat('#ffffff', { rough: 0.4 }), 0, 30, 0), mesh(box(length, 8, 10, 2), mat('#1e88e5'), 0, 60, 0));
}

export function giantChess(piece: ChessPiece, dark: boolean, size = 30) {
  const f = buildFigure({ style: 'gloss', body: 'chess', piece, color: dark ? '#3b2a20' : '#f5efe3', color2: '#f6c445' });
  f.scale.setScalar(size);
  return f;
}

export function goal() {
  const white = mat('#ffffff', { rough: 0.3 });
  const g = group(
    mesh(cyl(3, 3, 140, 12), white, -180, 70, 0),
    mesh(cyl(3, 3, 140, 12), white, 180, 70, 0),
    mesh(cyl(3, 3, 360, 12), white, 0, 140, 0).rotateZ(Math.PI / 2),
  );
  const net = mesh(new THREE.PlaneGeometry(360, 140, 18, 7), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.6 }), 0, 70, 60);
  g.add(net);
  return g;
}

export function soccerBall(r = 12) {
  const g = group(mesh(ball(r, 32), mat('#ffffff', { rough: 0.5 }), 0, r, 0));
  const dots = new THREE.IcosahedronGeometry(r, 0).attributes.position;
  for (let i = 0; i < dots.count; i += 3) {
    const v = new THREE.Vector3().fromBufferAttribute(dots, i).normalize().multiplyScalar(r * 0.97);
    const d = mesh(new THREE.CircleGeometry(r * 0.3, 5), mat('#222222', { side: THREE.DoubleSide }), v.x, v.y + r, v.z);
    d.lookAt(v.x * 2, v.y * 2 + r, v.z * 2);
    g.add(d);
  }
  return g;
}

export function cornerFlag() {
  return group(mesh(cyl(1.2, 1.2, 90, 8), mat('#ffffff'), 0, 45, 0), mesh(new THREE.PlaneGeometry(26, 18), mat('#ff1744', { side: THREE.DoubleSide }), 13, 80, 0));
}

export function stands(width: number) {
  const g = new THREE.Group();
  const r = rng(width);
  const colors = ['#e53935', '#fdd835', '#1e88e5', '#ffffff', '#43a047', '#ff9800'];
  const crowd = new THREE.InstancedMesh(new THREE.SphereGeometry(9, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 400);
  let n = 0;
  for (let row = 0; row < 6; row++) {
    g.add(mesh(box(width, 30, 60), mat(row % 2 ? '#90a4ae' : '#b0bec5'), 0, 15 + row * 30, row * 60));
    for (let x = -width / 2 + 15; x < width / 2 && n < 400; x += 22 + r() * 12) {
      crowd.setMatrixAt(n, new THREE.Matrix4().makeTranslation(x, 40 + row * 30, row * 60 - 5));
      crowd.setColorAt(n, new THREE.Color(colors[Math.floor(r() * colors.length)]));
      n++;
    }
  }
  crowd.count = n;
  g.add(crowd);
  return g;
}

export function floodlight() {
  const g = group(mesh(cyl(6, 9, 700, 10), mat('#90a4ae', { metal: 0.6 }), 0, 350, 0));
  g.add(mesh(box(120, 70, 12), mat('#eceff1'), 0, 720, 0));
  g.add(mesh(new THREE.PlaneGeometry(110, 60), mat('#ffffff', { emissive: '#fffde7' }), 0, 720, -6.5).rotateY(Math.PI));
  return g;
}

// ---------- Beach, volcano, throne ----------

export function umbrella(colors = ['#ff5252', '#ffffff']) {
  const g = group(mesh(cyl(2, 2, 160, 10), mat('#eeeeee'), 0, 80, 0));
  const seg = 8;
  for (let i = 0; i < seg; i++) {
    const part = mesh(new THREE.ConeGeometry(110, 40, 3, 1, true, (i / seg) * Math.PI * 2, (Math.PI * 2) / seg), mat(colors[i % colors.length], { side: THREE.DoubleSide, rough: 0.7 }), 0, 165, 0);
    g.add(part);
  }
  return g;
}

export function bucket() {
  return group(
    mesh(new THREE.CylinderGeometry(9, 7, 16, 24, 1, true), mat('#29b6f6', { side: THREE.DoubleSide, rough: 0.4 }), 0, 8, 0),
    mesh(cyl(7, 7, 1, 24), mat('#29b6f6'), 0, 0.5, 0),
    mesh(new THREE.TorusGeometry(9, 0.6, 6, 24, Math.PI), mat('#fdd835'), 0, 16, 0),
  );
}

export function spade() {
  const g = group(mesh(cyl(0.9, 0.9, 22, 8), mat('#fdd835'), 0, 1.5, 0).rotateX(Math.PI / 2), mesh(box(8, 1, 10, 0.5), mat('#e53935'), 0, 1, -14));
  return g;
}

export function sandcastle() {
  const s = mat('#e2c27c', { rough: 1 });
  const g = group(mesh(box(30, 12, 30, 2), s, 0, 6, 0));
  for (const [x, z] of [
    [-12, -12],
    [12, -12],
    [-12, 12],
    [12, 12],
  ]) {
    g.add(mesh(cyl(5, 6, 20, 16), s, x, 10, z), mesh(new THREE.ConeGeometry(6, 8, 16), s, x, 24, z));
  }
  g.add(mesh(cyl(7, 8, 26, 16), s, 0, 13, 0), mesh(new THREE.ConeGeometry(8, 10, 16), s, 0, 31, 0));
  g.add(mesh(new THREE.PlaneGeometry(6, 4), mat('#e53935', { side: THREE.DoubleSide }), 3, 40, 0), mesh(cyl(0.3, 0.3, 8, 6), mat('#795548'), 0, 38, 0));
  return g;
}

export function starfish(color = '#ff7043') {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = mesh(new THREE.ConeGeometry(2.2, 9, 8), mat(color, { rough: 0.8 }), Math.cos(a) * 4, 1, Math.sin(a) * 4);
    arm.rotation.set(0, -a, -Math.PI / 2);
    arm.scale.y = 1;
    arm.scale.z = 0.5;
    g.add(arm);
  }
  return g;
}

export function towel() {
  const g = new THREE.Group();
  const colors = ['#ff7043', '#ffffff', '#29b6f6', '#ffffff'];
  for (let i = 0; i < 8; i++) g.add(mesh(box(90, 0.6, 22), mat(colors[i % 4], { rough: 1 }), 0, 0.3, -77 + i * 22));
  return g;
}

export function palm() {
  const g = new THREE.Group();
  let x = 0;
  for (let i = 0; i < 10; i++) {
    const seg = mesh(cyl(9 - i * 0.4, 10 - i * 0.4, 52, 10), mat(i % 2 ? '#8d6e63' : '#795548', { rough: 0.9 }), x, 26 + i * 50, 0);
    seg.rotation.z = -0.05 * i;
    g.add(seg);
    x += i * 2.5;
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const lf = mesh(ball(70, 12), mat('#2e7d32', { rough: 0.8 }), x + Math.cos(a) * 60, 520, Math.sin(a) * 60);
    lf.scale.set(1, 0.08, 0.28);
    lf.rotation.set(0, -a, -0.35);
    g.add(lf);
  }
  return g;
}

export function sea(width: number, depth: number) {
  const water = mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshPhysicalMaterial({ color: '#1fb3e0', roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.92 }), 0, 0.5, 0);
  water.rotation.x = -Math.PI / 2;
  const foam = mesh(new THREE.PlaneGeometry(width, 18), mat('#ffffff', { rough: 0.9 }), 0, 0.8, depth / 2);
  foam.rotation.x = -Math.PI / 2;
  return group(water, foam);
}

export function puck() {
  return group(mesh(cyl(5, 5, 2.5, 28), mat('#111111', { rough: 0.4 }), 0, 1.25, 0));
}

export function rock(s = 20, color = '#4e4240') {
  const r = mesh(new THREE.DodecahedronGeometry(s, 0), mat(color, { rough: 0.95 }), 0, s * 0.55, 0);
  r.scale.y = 0.7;
  return group(r);
}

export function lavaPool(r = 30) {
  const pool = mesh(new THREE.CircleGeometry(r, 32), mat('#ff4a00', { emissive: '#c42a00' }), 0, 0.3, 0);
  pool.rotation.x = -Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(r, 4, 8, 32), mat('#2b2220', { rough: 1 }), 0, 1, 0);
  rim.rotation.x = Math.PI / 2;
  return group(pool, rim);
}

export function volcano() {
  const g = group(mesh(new THREE.ConeGeometry(900, 900, 40, 1, true), mat('#3e2c28', { rough: 1, side: THREE.DoubleSide }), 0, 450, 0));
  const crater = mesh(cyl(140, 160, 20, 32), mat('#ff6a00', { emissive: '#ff3d00' }), 0, 820, 0);
  g.add(crater);
  for (let i = 0; i < 4; i++) {
    const flow = mesh(box(40, 600, 6), mat('#ff6a00', { emissive: '#ff4500' }), Math.cos(i * 1.6) * 250, 450, Math.sin(i * 1.6) * 250 - 300);
    flow.lookAt(0, 900, 0);
    g.add(flow);
  }
  return g;
}

export function throne() {
  const gold = mat('#f6c445', { metal: 0.8, rough: 0.25 });
  const red = mat('#b3122e', { rough: 0.8 });
  return group(
    mesh(box(160, 70, 130, 8), gold, 0, 35, 0),
    mesh(box(130, 20, 110, 10), red, 0, 80, -5),
    mesh(box(160, 260, 30, 10), gold, 0, 200, 55),
    mesh(box(120, 200, 10, 10), red, 0, 200, 38),
    mesh(box(26, 60, 120, 6), gold, -80, 110, 0),
    mesh(box(26, 60, 120, 6), gold, 80, 110, 0),
    mesh(ball(16), mat('#e11d48', { rough: 0.1 }), 0, 330, 55),
  );
}

export function pillar(h = 600) {
  const stone = mat('#e8e2d6', { rough: 0.7 });
  return group(mesh(box(80, 30, 80), stone, 0, 15, 0), mesh(cyl(30, 30, h - 60, 20), stone, 0, h / 2, 0), mesh(box(80, 30, 80), stone, 0, h - 15, 0));
}

export function banner() {
  return group(
    mesh(new THREE.PlaneGeometry(90, 260), mat('#b3122e', { side: THREE.DoubleSide }), 0, 300, 0),
    mesh(new THREE.PlaneGeometry(40, 40), mat('#f6c445', { side: THREE.DoubleSide, metal: 0.6 }), 0, 330, 0.5),
  );
}

export function torch() {
  return group(mesh(cyl(4, 3, 60, 10), mat('#5d4037'), 0, 30, 0), mesh(cyl(9, 6, 14, 12), mat('#424242', { metal: 0.7 }), 0, 66, 0), mesh(new THREE.ConeGeometry(8, 26, 12), mat('#ff8f00', { emissive: '#d84315' }), 0, 84, 0));
}

export function chest() {
  const gold = mat('#f6c445', { metal: 0.8, rough: 0.25 });
  const g = group(mesh(box(34, 20, 22, 2), mat('#8d5524', { rough: 0.8 }), 0, 10, 0));
  const lid = mesh(new THREE.CylinderGeometry(11, 11, 34, 16, 1, false, 0, Math.PI), mat('#8d5524', { rough: 0.8 }), 0, 20, 0);
  lid.rotation.z = Math.PI / 2;
  g.add(lid);
  g.add(mesh(box(36, 3, 23), gold, 0, 20, 0));
  for (let i = 0; i < 9; i++) g.add(mesh(cyl(2.4, 2.4, 0.8, 16), gold, -12 + (i % 5) * 6, 0.4, 16 + Math.floor(i / 5) * 6));
  return g;
}

export function crown() {
  const gold = mat('#f6c445', { metal: 0.85, rough: 0.2 });
  const g = group(mesh(new THREE.CylinderGeometry(10, 11, 7, 24, 1, true), gold, 0, 3.5, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(mesh(new THREE.ConeGeometry(2, 7, 8), gold, Math.cos(a) * 10, 10, Math.sin(a) * 10));
    g.add(mesh(ball(1.4, 8), mat('#e11d48', { rough: 0.1 }), Math.cos(a) * 10.6, 3.5, Math.sin(a) * 10.6));
  }
  return g;
}
