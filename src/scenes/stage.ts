// Puts a scene together for a renderer: play area, scenery, sky, fog and lights.
// Used by both the 3D view and the top-down picture behind the 2D view.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { matCanvas } from '../render/mat';
import { sceneGroup, skyTexture, type SceneDef } from './scenes';

export interface Stage {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
}

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function environmentFor(renderer: THREE.WebGLRenderer): THREE.Texture {
  let t = envCache.get(renderer);
  if (!t) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    t = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    envCache.set(renderer, t);
  }
  return t;
}

/** Fills `scene3` with the scene's play area, scenery and lighting. Returns what was added. */
export function buildStage(scene3: THREE.Scene, def: SceneDef, W: number, L: number): Stage {
  const group = new THREE.Group();

  const tex = new THREE.CanvasTexture(matCanvas(L, def.surface));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const play = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ map: tex, roughness: def.grip < 0.8 ? 0.15 : 0.8 }));
  play.rotation.x = -Math.PI / 2;
  play.position.y = 0.03;
  play.receiveShadow = true;
  group.add(play);
  group.add(sceneGroup(def, W, L));

  const hemi = new THREE.HemisphereLight(def.hemi[0], def.hemi[1], 1.0);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(def.sun, def.sunIntensity);
  sun.position.set(60, 180, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  const sc = sun.shadow.camera;
  sc.left = -(W / 2 + 90);
  sc.right = W / 2 + 90;
  sc.top = L / 2 + 120;
  sc.bottom = -(L / 2 + 120);
  sc.near = 1;
  sc.far = 600;
  group.add(sun, sun.target);

  scene3.add(group);
  scene3.background = skyTexture(def);
  scene3.fog = new THREE.Fog(def.fog, 500, 3200);
  return { group, sun, hemi };
}

export function disposeStage(scene3: THREE.Scene, stage: Stage | null) {
  if (!stage) return;
  scene3.remove(stage.group);
  stage.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
}
