// The 2D view's background: the same 3D scene, photographed straight from above with an
// orthographic camera, lined up exactly with the 2D table. Rendered again only when the
// scene, screen size or side of the table changes.

import * as THREE from 'three';
import type { Owner } from '../game/sim';
import { getScene } from './scenes';
import { buildStage, disposeStage, environmentFor, type Stage } from './stage';

let renderer: THREE.WebGLRenderer | null = null;
let scene3: THREE.Scene;
let camera: THREE.OrthographicCamera;
let stage: Stage | null = null;
let stageKey = '';
let shotKey = '';
const shot = document.createElement('canvas');

export interface Frame {
  sceneId: string;
  W: number;
  L: number;
  view: Owner;
  cw: number; // canvas size in CSS pixels
  ch: number;
  dpr: number;
  scale: number; // CSS pixels per world unit
  ox: number; // screen position of the table's corner (world x = 0, far edge)
  oy: number;
}

function setup() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  scene3 = new THREE.Scene();
  scene3.environment = environmentFor(renderer);
  scene3.environmentIntensity = 0.5;
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
}

export function backdrop(f: Frame): HTMLCanvasElement {
  const key = JSON.stringify(f);
  if (key === shotKey) return shot;
  setup();
  const r = renderer!;

  const sk = `${f.sceneId}:${f.W}:${f.L}`;
  if (sk !== stageKey) {
    disposeStage(scene3, stage);
    stage = buildStage(scene3, getScene(f.sceneId), f.W, f.L);
    stageKey = sk;
    scene3.fog = null; // looking straight down, fog would only wash things out
  }

  const pw = Math.round(f.cw * f.dpr);
  const ph = Math.round(f.ch * f.dpr);
  r.setSize(pw, ph, false);

  // Screen position of the table's middle, then the camera box around it (in world units).
  const cx = f.ox + (f.W * f.scale) / 2;
  const cy = f.oy + (f.L * f.scale) / 2;
  camera.left = -cx / f.scale;
  camera.right = (f.cw - cx) / f.scale;
  camera.top = cy / f.scale;
  camera.bottom = -(f.ch - cy) / f.scale;
  camera.position.set(0, 2000, 0);
  camera.up.set(0, 0, f.view === 0 ? -1 : 1);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  r.render(scene3, camera);

  shot.width = pw;
  shot.height = ph;
  shot.getContext('2d')!.drawImage(r.domElement, 0, 0);
  shotKey = key;
  return shot;
}
