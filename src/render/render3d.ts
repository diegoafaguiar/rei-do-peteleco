// 3D table with three.js. Same game state as the 2D view; switch any time.
//
// Mapping: world (x, y) on the table -> three.js (x - W/2, 0, L/2 - y). Up is +Y.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildFigure } from '../figures/build';
import type { CharDef } from '../game/packs';
import { forward, type Match, type Owner } from '../game/sim';
import { matCanvas } from './mat';
import type { AimView, Renderer } from './types';

interface PieceObj {
  root: THREE.Group; // at the piece position
  tilt: THREE.Group; // rotates when the piece falls
  spin: THREE.Group; // flips end over end while tumbling (pivot at the middle)
  body: THREE.Group; // turns to face forward
  ring: THREE.Mesh;
  charId: string;
  owner: Owner;
}

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });

const TEAM = ['#2f6fe0', '#e0405a'];

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
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.canvas = this.renderer.domElement;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog('#b98cff', 260, 700);
    const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
    sun.position.set(40, 120, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0005;
    const sc = sun.shadow.camera;
    sc.left = -80;
    sc.right = 80;
    sc.top = 140;
    sc.bottom = -140;
    sc.far = 400;
    this.scene.add(sun);

    // Playroom floor with a round rug
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), std('#f2c48d', { roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -40;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(170, 64), std('#7fd1c7', { roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = -39.9;
    rug.receiveShadow = true;
    this.scene.add(rug);
    const rugRing = new THREE.Mesh(new THREE.RingGeometry(150, 160, 64), std('#ffffff', { roughness: 0.95 }));
    rugRing.rotation.x = -Math.PI / 2;
    rugRing.position.y = -39.85;
    this.scene.add(rugRing);

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

  worldToScreen(x: number, y: number, h = 0) {
    const v = this.toThree(x, y, h).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * this.canvas.clientWidth,
      y: ((1 - v.y) / 2) * this.canvas.clientHeight,
    };
  }

  pxPerUnit(x: number, y: number) {
    const a = this.worldToScreen(x, y);
    const b = this.worldToScreen(x + 1, y);
    return Math.hypot(b.x - a.x, b.y - a.y);
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
    const tex = new THREE.CanvasTexture(matCanvas(m.L));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(m.W, m.L), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    mat.rotation.x = -Math.PI / 2;
    mat.receiveShadow = true;
    this.tableGroup.add(mat);
    const wood = std('#d98a45', { roughness: 0.45 });
    const top = new THREE.Mesh(new RoundedBoxGeometry(m.W + 7, 3, m.L + 7, 4, 1.4), wood);
    top.position.y = -1.52;
    top.receiveShadow = true;
    top.castShadow = true;
    this.tableGroup.add(top);
    for (const [lx, lz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.4, 37, 16), wood);
      leg.position.set((lx * m.W) / 2.3, -21.5, (lz * m.L) / 2.15);
      leg.castShadow = true;
      this.tableGroup.add(leg);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), std(lz > 0 ? TEAM[0] : TEAM[1], { roughness: 0.3 }));
      ball.position.set((lx * m.W) / 2.3, -38.5, (lz * m.L) / 2.15);
      this.tableGroup.add(ball);
    }
  }

  private makePiece(ch: CharDef, owner: Owner): PieceObj {
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    const body = new THREE.Group();
    const fig = buildFigure(ch.fig);
    fig.scale.setScalar(ch.radius);
    const mid = ch.radius * 0.95;
    spin.position.y = mid;
    body.position.y = -mid;
    body.add(fig);
    spin.add(body);
    tilt.add(spin);
    root.add(tilt);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ch.radius * 1.08, ch.radius * 1.32, 40),
      new THREE.MeshBasicMaterial({ color: TEAM[owner], transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    root.add(ring);
    this.scene.add(root);
    return { root, tilt, spin, body, ring, charId: ch.id, owner };
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
        (obj.ring.material as THREE.MeshBasicMaterial).color.set(TEAM[p.owner]);
        obj.owner = p.owner;
      }
      const drop = p.out ? -p.outT * p.outT * 45 : 0;
      obj.root.position.copy(this.toThree(p.x, p.y, drop + p.h));
      // Tumble: flip around the middle, along the direction it's sliding.
      const rdir = new THREE.Vector3(Math.cos(p.rollDir), 0, -Math.sin(p.rollDir));
      const raxis = new THREE.Vector3(0, 1, 0).cross(rdir).normalize();
      obj.spin.quaternion.setFromAxisAngle(raxis, p.roll);
      // Face the opponent
      obj.body.rotation.y = forward(p.owner) > 0 ? 0 : Math.PI;
      // Fall: tip over toward the hit direction
      const dir = new THREE.Vector3(Math.cos(p.fallDir), 0, -Math.sin(p.fallDir));
      const axis = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
      const t = easeOut(p.fallT);
      obj.tilt.quaternion.setFromAxisAngle(axis, (t * Math.PI) / 2);
      obj.tilt.position.y = t * p.char.radius * 0.9;
      obj.ring.visible = p.fallT < 0.3 && !p.out && p.h < 0.3;
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

function skyTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 256;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7b5cff');
  g.addColorStop(0.6, '#b98cff');
  g.addColorStop(1, '#ffb3d9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
