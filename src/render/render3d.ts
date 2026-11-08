// 3D table with three.js. Same game state as the 2D view; switch any time.
//
// Mapping: world (x, y) on the table -> three.js (x - W/2, 0, L/2 - y). Up is +Y.

import * as THREE from 'three';
import { buildFigure } from '../figures/build';
import type { CharDef } from '../game/packs';
import { forward, type Match, type Owner } from '../game/sim';
import { getScene } from '../scenes/scenes';
import { buildStage, disposeStage, environmentFor, type Stage } from '../scenes/stage';
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

const TEAM = ['#2f6fe0', '#e0405a'];

export class Renderer3D implements Renderer {
  readonly kind = '3d' as const;
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.5, 8000);
  private stage: Stage | null = null;
  private stageKey = '';
  private pieces = new Map<number, PieceObj>();
  private aimGroup = new THREE.Group();
  private selRing: THREE.Mesh;
  private W = 0;
  private L = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camReady = false;
  private lastMatch: Match | null = null;
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

    this.scene.environment = environmentFor(this.renderer);
    this.scene.environmentIntensity = 0.5;

    this.scene.add(this.aimGroup);
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

  private buildScene(m: Match) {
    disposeStage(this.scene, this.stage);
    this.W = m.W;
    this.L = m.L;
    this.stage = buildStage(this.scene, getScene(m.scene), m.W, m.L);
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
    const key = `${m.scene}:${m.W}:${m.L}`;
    if (key !== this.stageKey) {
      this.stageKey = key;
      this.buildScene(m);
    }
    if (m !== this.lastMatch) {
      this.lastMatch = m;
      this.camReady = false; // fly in for the new match
    }

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
      // Off the play area: shrink away.
      obj.root.scale.setScalar(p.out ? Math.max(0.01, 1 - p.outT) : 1);
      obj.root.position.copy(this.toThree(p.x, p.y, p.h));
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
      // Start high above and behind, then swoop down to the player's seat.
      this.camPos.copy(pos).add(pos.clone().sub(look).multiplyScalar(0.9)).add(new THREE.Vector3(0, 70, 0));
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
