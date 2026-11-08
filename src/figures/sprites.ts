// Renders each 3D figure once into a small picture, used by the 2D table and the menus.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CharDef } from '../game/packs';
import { buildFigure } from './build';

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Pixel where the figure touches the table. */
  anchorX: number;
  anchorY: number;
  /** Pixels per world unit at radius 1. */
  unitPx: number;
}

// Frame around a unit-radius figure, in figure units.
const LEFT = -1.75;
const RIGHT = 1.75;
const BOTTOM = -0.75;
const TOP = 3.55;
const PX = 96; // pixels per unit
const TILT = (24 * Math.PI) / 180;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
const cache = new Map<string, Sprite>();
const urlCache = new Map<string, string>();

function setup() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize((RIGHT - LEFT) * PX, (TOP - BOTTOM) * PX, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight('#fff6e8', 2.2);
  key.position.set(-3, 6, -5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#cfe4ff', 0.9);
  rim.position.set(4, 3, 6);
  scene.add(rim);
  camera = new THREE.OrthographicCamera(LEFT, RIGHT, TOP, BOTTOM, 0.1, 50);
}

export function getSprite(ch: CharDef, view: 'front' | 'back'): Sprite {
  const key = `${ch.id}:${view}`;
  const hit = cache.get(key);
  if (hit) return hit;
  setup();
  const fig = buildFigure(ch.fig);
  scene.add(fig);
  const dir = view === 'front' ? -1 : 1;
  camera.position.set(0, Math.sin(TILT) * 20, dir * Math.cos(TILT) * 20);
  camera.lookAt(0, 0, 0);
  // Mirror so the back view keeps the same left/right as the front view on screen.
  camera.updateMatrixWorld();
  renderer!.render(scene, camera);
  scene.remove(fig);

  const src = renderer!.domElement;
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  canvas.getContext('2d')!.drawImage(src, 0, 0);
  const sprite: Sprite = { canvas, anchorX: -LEFT * PX, anchorY: TOP * PX, unitPx: PX };
  cache.set(key, sprite);
  return sprite;
}

/** Cropped portrait (data URL) for menus. */
export function portrait(ch: CharDef): string {
  const hit = urlCache.get(ch.id);
  if (hit) return hit;
  const s = getSprite(ch, 'front');
  const cv = document.createElement('canvas');
  const size = Math.round((RIGHT - LEFT) * PX);
  cv.width = size;
  cv.height = size;
  const top = Math.max(0, s.anchorY + 0.45 * PX - size);
  cv.getContext('2d')!.drawImage(s.canvas, 0, top, size, size, 0, 0, size, size);
  const url = cv.toDataURL();
  urlCache.set(ch.id, url);
  return url;
}
