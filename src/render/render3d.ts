// 3D table with three.js. Same game state as the 2D view; switch any time.
//
// Mapping: world (x, y) on the table -> three.js (x - W/2, 0, L/2 - y). Up is +Y.

import * as THREE from 'three';
import type { CharDef } from '../game/packs';
import { forward, launchY, type Match, type Owner } from '../game/sim';
import type { AimView, Renderer } from './types';

interface PieceObj {
  root: THREE.Group; // at the piece position
  tilt: THREE.Group; // rotates when the piece falls
  body: THREE.Group; // turns to face forward
  ring: THREE.Mesh;
  charId: string;
  owner: Owner;
}

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });

export class Renderer3D implements Renderer {
  readonly kind = '3d' as const;
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2000);
  private tableGroup = new THREE.Group();
  private pieces = new Map<number, PieceObj>();
  private aimGroup = new THREE.Group();
  private selRing: THREE.Mesh;
  private W = 0;
  private L = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camReady = false;
  private time = 0;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;

    this.scene.background = new THREE.Color('#1e3a5f');
    this.scene.fog = new THREE.Fog('#1e3a5f', 250, 600);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#3a2a1a', 1.1));
    const sun = new THREE.DirectionalLight('#fff4e0', 1.6);
    sun.position.set(40, 120, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -80;
    sc.right = 80;
    sc.top = 140;
    sc.bottom = -140;
    sc.far = 400;
    this.scene.add(sun);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), std('#2b4a6e'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -40;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.scene.add(this.tableGroup, this.aimGroup);
    this.selRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color: '#fde047' }),
    );
    this.selRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.selRing);
  }

  mount(el: HTMLElement) {
    el.appendChild(this.canvas);
    this.camReady = false;
  }

  unmount() {
    this.canvas.remove();
  }

  private toThree(x: number, y: number, h = 0) {
    return new THREE.Vector3(x - this.W / 2, h, this.L / 2 - y);
  }

  worldToScreen(x: number, y: number) {
    const v = this.toThree(x, y).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * this.canvas.clientWidth,
      y: ((1 - v.y) / 2) * this.canvas.clientHeight,
    };
  }

  screenToWorld(sx: number, sy: number) {
    const ndc = new THREE.Vector2((sx / this.canvas.clientWidth) * 2 - 1, -(sy / this.canvas.clientHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return null;
    return { x: hit.x + this.W / 2, y: this.L / 2 - hit.z };
  }

  private buildTable(m: Match) {
    this.tableGroup.clear();
    this.W = m.W;
    this.L = m.L;
    const top = new THREE.Mesh(new THREE.BoxGeometry(m.W, 2, m.L), std('#d29a5e', { roughness: 0.7 }));
    top.position.y = -1;
    top.receiveShadow = true;
    this.tableGroup.add(top);
    const rim = std('#7a4a22');
    for (const [w, d, x, z] of [
      [m.W + 2, 1, 0, m.L / 2 + 0.5],
      [m.W + 2, 1, 0, -m.L / 2 - 0.5],
      [1, m.L, m.W / 2 + 0.5, 0],
      [1, m.L, -m.W / 2 - 0.5, 0],
    ]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d), rim);
      b.position.set(x, -1.2, z);
      this.tableGroup.add(b);
    }
    for (const [lx, lz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 38, 3), rim);
      leg.position.set((lx * m.W) / 2.3, -21, (lz * m.L) / 2.15);
      leg.castShadow = true;
      this.tableGroup.add(leg);
    }
    for (const owner of [0, 1] as Owner[]) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(m.W - 4, 0.5),
        new THREE.MeshBasicMaterial({ color: owner === 0 ? '#3b82f6' : '#ef4444', transparent: true, opacity: 0.6 }),
      );
      line.rotation.x = -Math.PI / 2;
      line.position.copy(this.toThree(m.W / 2, launchY(m, owner), 0.02));
      this.tableGroup.add(line);
    }
    const mid = new THREE.Mesh(
      new THREE.PlaneGeometry(m.W, 0.3),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3 }),
    );
    mid.rotation.x = -Math.PI / 2;
    mid.position.y = 0.02;
    this.tableGroup.add(mid);
  }

  private makePiece(ch: CharDef, owner: Owner): PieceObj {
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    const body = buildCharacter(ch);
    tilt.add(body);
    root.add(tilt);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ch.radius * 1.02, ch.radius * 1.25, 32),
      new THREE.MeshBasicMaterial({ color: owner === 0 ? '#3b82f6' : '#ef4444' }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    root.add(ring);
    this.scene.add(root);
    return { root, tilt, body, ring, charId: ch.id, owner };
  }

  render(m: Match, aim: AimView | null, viewOwner: Owner, dt: number) {
    this.time += dt;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== cw || size.y !== ch) {
      this.renderer.setSize(cw, ch, false);
      this.camera.aspect = cw / Math.max(1, ch);
      this.camera.updateProjectionMatrix();
    }
    if (m.W !== this.W || m.L !== this.L) this.buildTable(m);

    // Pieces
    const seen = new Set<number>();
    for (const p of m.pieces) {
      seen.add(p.id);
      let obj = this.pieces.get(p.id);
      if (!obj || obj.charId !== p.char.id) {
        if (obj) this.scene.remove(obj.root);
        obj = this.makePiece(p.char, p.owner);
        this.pieces.set(p.id, obj);
      }
      if (obj.owner !== p.owner) {
        (obj.ring.material as THREE.MeshBasicMaterial).color.set(p.owner === 0 ? '#3b82f6' : '#ef4444');
        obj.owner = p.owner;
      }
      const drop = p.out ? -p.outT * p.outT * 45 : 0;
      obj.root.position.copy(this.toThree(p.x, p.y, drop));
      // Face the opponent
      obj.body.rotation.y = forward(p.owner) > 0 ? 0 : Math.PI;
      // Fall: tip over toward the hit direction
      const dir = new THREE.Vector3(Math.cos(p.fallDir), 0, -Math.sin(p.fallDir));
      const axis = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
      const t = easeOut(p.fallT);
      obj.tilt.quaternion.setFromAxisAngle(axis, (t * Math.PI) / 2);
      obj.tilt.position.y = t * p.char.radius * 0.9;
      obj.ring.visible = p.fallT < 0.3 && !p.out;
    }
    for (const [id, obj] of this.pieces) {
      if (!seen.has(id)) {
        this.scene.remove(obj.root);
        this.pieces.delete(id);
      }
    }

    // Selected piece ring
    const sel = m.pieces.find((p) => p.id === m.selected);
    this.selRing.visible = !!sel;
    if (sel) {
      this.selRing.position.copy(this.toThree(sel.x, sel.y, 0.2));
      const s = sel.char.radius * 1.45 + Math.sin(this.time * 6) * 0.15;
      this.selRing.scale.set(s, s, s);
    }

    this.drawAim(m, aim);
    this.updateCamera(m, viewOwner, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private aimDots: THREE.Mesh[] = [];
  private aimBar?: THREE.Mesh;
  private aimBand?: THREE.Line;

  private drawAim(m: Match, aim: AimView | null) {
    this.aimGroup.visible = !!aim;
    if (!aim) return;
    if (!this.aimBar) {
      const dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
      const dotGeo = new THREE.SphereGeometry(0.45, 10, 8);
      for (let i = 0; i < 18; i++) {
        const d = new THREE.Mesh(dotGeo, dotMat);
        this.aimDots.push(d);
        this.aimGroup.add(d);
      }
      this.aimBar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 12), new THREE.MeshBasicMaterial());
      this.aimBand = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: '#ffffff' }),
      );
      this.aimGroup.add(this.aimBar, this.aimBand);
    }
    const len = m.L * 0.85 * m.guide * Math.max(0.15, aim.power);
    this.aimDots.forEach((dot, i) => {
      const t = ((i + 1) / this.aimDots.length) * len;
      dot.position.copy(this.toThree(aim.x + aim.dx * t, aim.y + aim.dy * t, 0.5));
    });
    // Power column above the piece
    const h = 1 + aim.power * 10;
    (this.aimBar.material as THREE.MeshBasicMaterial).color.setHSL((120 - aim.power * 120) / 360, 0.85, 0.5);
    this.aimBar.scale.y = h;
    this.aimBar.position.copy(this.toThree(aim.x, aim.y, 9 + h / 2));
    // Rubber band to the finger
    const pos = this.aimBand!.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = this.toThree(aim.x, aim.y, 1.5);
    const b = this.toThree(aim.pullX, aim.pullY, 1.5);
    pos.setXYZ(0, a.x, a.y, a.z);
    pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
  }

  private updateCamera(m: Match, viewOwner: Owner, dt: number) {
    const f = forward(viewOwner);
    const edgeY = viewOwner === 0 ? 0 : m.L;
    // Behind the player's edge, high enough to see the whole table.
    const back = 22 + m.L * 0.22;
    const height = 30 + m.L * 0.32;
    const pos = this.toThree(m.W / 2, edgeY - f * back, height);
    const look = this.toThree(m.W / 2, edgeY + f * m.L * 0.5, 0);

    // Follow the flicked piece a little while it slides.
    const flicker = m.pieces.find((p) => p.id === m.flicker);
    if (flicker && m.phase === 'rolling') {
      const fp = this.toThree(flicker.x, flicker.y, 0);
      look.lerp(fp, 0.35);
    }

    if (!this.camReady) {
      this.camPos.copy(pos);
      this.camLook.copy(look);
      this.camReady = true;
    }
    const k = 1 - Math.exp(-dt * 3);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }
}

function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

/** Builds a character from simple shapes. Faces -Z (toward the far side for player 0). */
function buildCharacter(ch: CharDef): THREE.Group {
  const g = new THREE.Group();
  const r = ch.radius;
  const main = std(ch.color);
  const accent = std(ch.accent);
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };

  const eyes = (headY: number, headR: number, forwardZ = -1) => {
    const white = std('#ffffff');
    const black = std('#111111');
    for (const side of [-1, 1]) {
      const e = add(new THREE.Mesh(new THREE.SphereGeometry(headR * 0.22, 12, 10), white));
      e.position.set(side * headR * 0.35, headY + headR * 0.15, forwardZ * headR * 0.85);
      const p = add(new THREE.Mesh(new THREE.SphereGeometry(headR * 0.11, 10, 8), black));
      p.position.set(side * headR * 0.35, headY + headR * 0.15, forwardZ * headR * 1.03);
    }
  };

  if (ch.shape === 'chess') {
    const profile = chessProfile(ch.id, r);
    const lathe = add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), std(ch.color, { roughness: 0.3 })));
    lathe.receiveShadow = true;
    const topY = profile[profile.length - 1].y;
    if (ch.id === 'rei') {
      const v = add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), accent));
      v.position.y = topY + 0.8;
      const h = add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.4), accent));
      h.position.y = topY + 1;
    } else if (ch.id === 'rainha') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const s = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), accent));
        s.position.set(Math.cos(a) * r * 0.45, topY + 0.2, Math.sin(a) * r * 0.45);
      }
    } else if (ch.id === 'torre') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), main));
        b.position.set(Math.cos(a) * r * 0.55, topY + 0.4, Math.sin(a) * r * 0.55);
      }
    } else if (ch.id === 'cavalo') {
      const head = add(new THREE.Mesh(new THREE.BoxGeometry(r * 0.7, r * 1.2, r * 1.3), main));
      head.position.set(0, topY + r * 0.4, -r * 0.25);
      head.rotation.x = -0.4;
      eyes(topY + r * 0.6, r * 0.45);
    } else if (ch.id === 'bispo') {
      const cap = add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 16, 12), main));
      cap.scale.y = 1.4;
      cap.position.y = topY + r * 0.4;
    } else {
      const ball = add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 16, 12), main));
      ball.position.y = topY + r * 0.4;
    }
    return g;
  }

  // Base disc
  add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 32), accent)).position.y = 0.3;

  const isBall = ch.shape === 'ball';
  const bodyH = isBall ? r * 1.0 : r * 1.3;
  const bodyR = isBall ? r * 0.55 : r * 0.78;
  const body = add(new THREE.Mesh(new THREE.CylinderGeometry(bodyR * 0.9, bodyR, bodyH, 24), main));
  body.position.y = 0.6 + bodyH / 2;

  const headR = isBall ? r * 1.0 : r * 0.82;
  const headY = 0.6 + bodyH + headR * 0.8;
  const head = add(new THREE.Mesh(new THREE.SphereGeometry(headR, 24, 18), isBall ? std('#f2c49b') : main));
  head.position.y = headY;

  if (isBall) {
    const hair = add(new THREE.Mesh(new THREE.SphereGeometry(headR * 1.02, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), std('#3b2314')));
    hair.position.y = headY;
    // Shirt number on the back
    const tex = numberTexture(String(ch.number ?? ''), ch.accent, ch.color);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(bodyR * 1.3, bodyH * 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    plate.position.set(0, 0.6 + bodyH / 2, bodyR * 0.98);
    g.add(plate);
  }

  eyes(headY, headR);

  if (ch.shape === 'monster') {
    for (const side of [-1, 1]) {
      const horn = add(new THREE.Mesh(new THREE.ConeGeometry(headR * 0.25, headR * 0.9, 12), accent));
      horn.position.set(side * headR * 0.6, headY + headR * 0.85, 0);
      horn.rotation.z = -side * 0.4;
    }
  } else if (ch.shape === 'evo') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI + Math.PI;
      const sp = add(new THREE.Mesh(new THREE.ConeGeometry(headR * 0.22, headR * 0.9, 10), accent));
      sp.position.set(Math.cos(a) * headR * 0.2, headY + headR * 0.75, Math.sin(a) * headR * 0.2 + headR * 0.3);
      sp.rotation.x = 0.5;
      sp.rotation.z = Math.cos(a) * 0.6;
    }
    for (const side of [-1, 1]) {
      const arm = add(new THREE.Mesh(new THREE.SphereGeometry(bodyR * 0.45, 12, 10), main));
      arm.position.set(side * bodyR * 1.1, 0.6 + bodyH * 0.6, 0);
    }
  } else if (ch.shape === 'ice') {
    const crystal = add(
      new THREE.Mesh(
        new THREE.OctahedronGeometry(headR * 0.55),
        std(ch.accent, { transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3 }),
      ),
    );
    crystal.position.y = headY + headR * 1.1;
    crystal.scale.y = 1.6;
  } else if (ch.shape === 'king') {
    const gold = std('#fbbf24', { metalness: 0.6, roughness: 0.25 });
    const band = add(new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.7, headR * 0.7, headR * 0.35, 24, 1, true), gold));
    band.position.y = headY + headR * 0.8;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const tip = add(new THREE.Mesh(new THREE.ConeGeometry(headR * 0.16, headR * 0.45, 8), gold));
      tip.position.set(Math.cos(a) * headR * 0.62, headY + headR * 1.15, Math.sin(a) * headR * 0.62);
    }
  } else if (ch.shape === 'buddy') {
    const cheek = std(ch.accent);
    for (const side of [-1, 1]) {
      const c = add(new THREE.Mesh(new THREE.SphereGeometry(headR * 0.15, 10, 8), cheek));
      c.position.set(side * headR * 0.62, headY - headR * 0.15, -headR * 0.72);
    }
  }
  return g;
}

function chessProfile(id: string, r: number): THREE.Vector2[] {
  const h = { rei: 9, rainha: 8.5, torre: 6, cavalo: 5.5, bispo: 7, peao: 4.5 }[id] ?? 5;
  const pts: [number, number][] = [
    [0, 0],
    [r, 0],
    [r, 0.6],
    [r * 0.8, 1.0],
    [r * 0.62, 1.4],
    [r * 0.42, h * 0.45],
    [r * 0.38, h * 0.8],
    [r * 0.62, h * 0.86],
    [r * 0.62, h * 0.95],
    [r * (id === 'torre' ? 0.72 : 0.4), h],
    [0, h],
  ];
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}

function numberTexture(text: string, color: string, bg: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = color;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 36);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
