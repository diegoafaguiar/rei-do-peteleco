// The places where matches happen. Each scene dresses the table (or the ground) and its
// surroundings, sets the light and the sky, and says how slippery the play area is.
//
// Coordinates: the play area covers x in [-W/2, W/2] and z in [-L/2, L/2] at y = 0.
// Player 0 sits at z = +L/2 (near side), player 1 at z = -L/2.

import * as THREE from 'three';
import * as P from './props';
import { tileTexture } from './textures';

export interface SceneDef {
  id: string;
  name: string;
  surface: string; // painter for the play area (see PLAY_PAINTERS)
  grip: number; // 1 = normal; lower slides farther (ice), higher stops sooner (sand)
  sky: [string, string, string]; // background gradient top, middle, bottom
  fog: string;
  sun: string;
  sunIntensity: number;
  hemi: [string, string];
  build(root: THREE.Group, W: number, L: number): void;
}

const TABLE_DROP = 125; // table height: the floor is this far below the table top

function texturedPlane(w: number, d: number, tex: THREE.Texture, y: number, rough = 0.8) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: rough }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

/** A table under the play area, with legs and a floor. */
function table(root: THREE.Group, W: number, L: number, opts: { top: string; mx: number; mz: number; floor: string; floorTile?: number; edge?: string; rough?: number }) {
  const tw = W + opts.mx * 2;
  const td = L + opts.mz * 2;
  const topTex = tileTexture(opts.top, 512, Math.max(1, tw / 120), Math.max(1, td / 120));
  const top = new THREE.Mesh(new THREE.BoxGeometry(tw, 4, td), [
    P.mat(opts.edge ?? '#8a5a33'),
    P.mat(opts.edge ?? '#8a5a33'),
    new THREE.MeshStandardMaterial({ map: topTex, roughness: opts.rough ?? 0.55 }),
    P.mat(opts.edge ?? '#8a5a33'),
    P.mat(opts.edge ?? '#8a5a33'),
    P.mat(opts.edge ?? '#8a5a33'),
  ]);
  top.position.y = -2.05;
  top.receiveShadow = true;
  top.castShadow = true;
  root.add(top);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) root.add(P.mesh(new THREE.BoxGeometry(8, TABLE_DROP - 4, 8), P.mat(opts.edge ?? '#8a5a33'), sx * (tw / 2 - 10), -TABLE_DROP / 2 - 2, sz * (td / 2 - 10)));
  const size = 3000;
  const tile = opts.floorTile ?? 80;
  root.add(texturedPlane(size, size, tileTexture(opts.floor, 256, size / tile, size / tile), -TABLE_DROP, 0.7));
}

/** Open ground around the play area. */
function ground(root: THREE.Group, painter: string, tile: number, rough = 0.85) {
  const size = 4000;
  root.add(texturedPlane(size, size, tileTexture(painter, 256, size / tile, size / tile), -0.08, rough));
}

const far = (L: number, extra = 0) => -(L / 2 + extra); // z beyond player 1's side

export const SCENES: SceneDef[] = [
  {
    id: 'cozinha',
    name: 'Mesa da Cozinha',
    surface: 'tablecloth',
    grip: 1,
    sky: ['#fff4dc', '#ffe6c2', '#f6d2a2'],
    fog: '#f6e2c4',
    sun: '#fff1d6',
    sunIntensity: 2.3,
    hemi: ['#ffffff', '#a9805a'],
    build(root, W, L) {
      table(root, W, L, { top: 'woodTable', mx: 42, mz: 34, floor: 'tiles', floorTile: 90 });
      const sx = W / 2 + 22;
      P.put(root, P.fruitBowl(), -sx, -L * 0.18);
      P.put(root, P.mug('#e85d75'), sx - 4, L * 0.22, 30);
      P.put(root, P.mug('#4f8cff'), sx + 6, L * 0.08, -60);
      P.put(root, P.plate(14, 'bread'), sx, -L * 0.2);
      P.put(root, P.shakers(), -sx + 4, L * 0.25);
      P.put(root, P.napkinHolder(), -sx - 4, L * 0.05, 90);
      P.put(root, P.cuttingBoard(), sx + 2, -L * 0.42, 80);
      P.put(root, P.plate(12, 'cake'), -sx, -L * 0.45);
      P.put(root, P.kitchenWall(1400), 0, far(L, 220));
    },
  },
  {
    id: 'sala',
    name: 'Mesa da Sala',
    surface: 'woodDark',
    grip: 0.95,
    sky: ['#e8eefc', '#dfe7f6', '#c9d6ee'],
    fog: '#dfe6f3',
    sun: '#fff6e6',
    sunIntensity: 2.0,
    hemi: ['#ffffff', '#6d5a4a'],
    build(root, W, L) {
      table(root, W, L, { top: 'woodDark', mx: 36, mz: 30, floor: 'woodFloor', floorTile: 160, edge: '#4a2a17', rough: 0.35 });
      root.add(texturedPlane(W + 380, L + 320, tileTexture('rug', 512, 1, 1), -TABLE_DROP + 0.5, 0.95));
      const sx = W / 2 + 20;
      P.put(root, P.bookStack(), -sx, -L * 0.25, 10);
      P.put(root, P.vase(), sx, -L * 0.3);
      P.put(root, P.remote(), sx - 2, L * 0.15, 20);
      P.put(root, P.candle(), -sx + 2, L * 0.2);
      P.put(root, P.mug('#ffb74d'), sx, L * 0.38);
      P.put(root, P.sofa(), 0, far(L, 170), 180, 1, -TABLE_DROP);
      P.put(root, P.plantPot(120), -W / 2 - 150, far(L, 120), 0, 1.6, -TABLE_DROP);
      P.put(root, P.floorLamp(), W / 2 + 160, far(L, 130), 0, 1.4, -TABLE_DROP);
      P.put(root, P.tvWall(1600), 0, far(L, 330), 0, 1, -TABLE_DROP + 125);
    },
  },
  {
    id: 'rua',
    name: 'Chão da Rua',
    surface: 'asphalt',
    grip: 1.12,
    sky: ['#8ec9ff', '#bfe2ff', '#e3f2ff'],
    fog: '#cfe6f7',
    sun: '#fff7e0',
    sunIntensity: 2.6,
    hemi: ['#cfe8ff', '#5a5a5a'],
    build(root, W, L) {
      ground(root, 'asphaltWide', 120);
      // Sidewalks on both sides
      for (const s of [-1, 1]) {
        root.add(P.mesh(new THREE.BoxGeometry(260, 25, 4000), new THREE.MeshStandardMaterial({ map: tileTexture('sidewalk', 256, 2, 30), roughness: 0.9 }), s * (W / 2 + 210), 12.5, 0));
        P.put(root, P.curb(4000), s * (W / 2 + 75), 0, 90);
        for (let i = 0; i < 4; i++) P.put(root, P.lampPost(), s * (W / 2 + 140), -L / 2 - i * 700 + 200, s > 0 ? 180 : 0, 1, 25);
        for (let i = 0; i < 3; i++) P.put(root, P.building(600, 900 + i * 300, ['#ef9a9a', '#90caf9', '#ffe082', '#a5d6a7'][i % 4]), s * (W / 2 + 650), -L / 2 - 400 - i * 650, s > 0 ? -90 : 90, 1, 25);
      }
      // Road paint between the lanes
      for (let z = -2000; z < 2000; z += 160) {
        const dash = P.mesh(new THREE.PlaneGeometry(6, 80), P.mat('#ffd54f', { rough: 0.8 }), -W / 2 - 30, 0.05, z);
        dash.rotation.x = -Math.PI / 2;
        root.add(dash);
      }
      P.put(root, P.cone(), W / 2 + 30, -L * 0.2);
      P.put(root, P.cone(), -W / 2 - 34, L * 0.3, 20);
      P.put(root, P.manhole(), -W / 2 - 30, -L * 0.35);
      P.put(root, P.bottleCap(), W / 2 + 8, L * 0.12);
      P.put(root, P.bottleCap('#1e88e5'), -W / 2 - 10, -L * 0.05);
      P.put(root, P.leaf(), W / 2 + 14, -L * 0.42, 40);
      P.put(root, P.leaf('#a3672b'), -W / 2 - 8, L * 0.42, -30);
      P.put(root, P.pebble(), W / 2 + 6, -L * 0.1);
      P.put(root, P.pebble('#bdbdbd', 1.4), -W / 2 - 5, L * 0.18);
      P.put(root, P.hydrant(), W / 2 + 120, -L * 0.1, 0, 1, 25);
      P.put(root, P.car('#e53935'), -W / 2 - 280, far(L, 500), 90);
      P.put(root, P.car('#1e88e5'), W / 2 + 280, far(L, 1100), -90);
    },
  },
  {
    id: 'escola',
    name: 'Pátio da Escola',
    surface: 'court',
    grip: 1.05,
    sky: ['#7cc4ff', '#b8e0ff', '#e6f5ff'],
    fog: '#d4ecff',
    sun: '#fff5dc',
    sunIntensity: 2.5,
    hemi: ['#d4ecff', '#8a7a62'],
    build(root, W, L) {
      ground(root, 'concreteWide', 140);
      P.put(root, P.backpack('#7e57c2'), W / 2 + 32, -L * 0.15, -20);
      P.put(root, P.backpack('#ef5350'), -W / 2 - 34, L * 0.2, 30);
      P.put(root, P.basketball(), -W / 2 - 28, -L * 0.35);
      P.put(root, P.chalkDrawing(), W / 2 + 30, L * 0.3);
      P.put(root, P.chalkDrawing('#80deea'), -W / 2 - 30, -L * 0.05);
      P.put(root, P.leaf('#8bc34a'), W / 2 + 10, L * 0.05, 70);
      P.put(root, P.bench(), -W / 2 - 220, -L * 0.1, 90);
      P.put(root, P.bench(), W / 2 + 220, L * 0.1, -90);
      for (let i = 0; i < 3; i++) {
        P.put(root, P.tree(1, '#66bb6a'), -W / 2 - 360, -L / 2 - i * 400 + 100);
        P.put(root, P.tree(0.9, '#7cb342'), W / 2 + 380, -L / 2 - i * 420);
      }
      P.put(root, P.schoolWall(2400), 0, far(L, 450));
    },
  },
  {
    id: 'shopping',
    name: 'Mesa do Shopping',
    surface: 'marble',
    grip: 0.9,
    sky: ['#fdf6ff', '#f1e8fb', '#e2d7f2'],
    fog: '#efe6f7',
    sun: '#ffffff',
    sunIntensity: 2.1,
    hemi: ['#ffffff', '#9a8fae'],
    build(root, W, L) {
      table(root, W, L, { top: 'marbleTop', mx: 34, mz: 28, floor: 'mallFloor', floorTile: 200, edge: '#d9d4cc', rough: 0.15 });
      const sx = W / 2 + 18;
      P.put(root, P.shoppingBag('#ec407a'), -sx - 2, -L * 0.25, 15);
      P.put(root, P.shoppingBag('#26a69a'), -sx + 2, -L * 0.02, -10);
      P.put(root, P.coffeeCup(), sx, L * 0.2);
      P.put(root, P.coffeeCup(), sx + 4, L * 0.05);
      P.put(root, P.phone(), sx - 2, -L * 0.3, 15);
      P.put(root, P.shoppingBag('#ffb300'), sx, -L * 0.45, 70);
      const stores: [string, string][] = [
        ['#e91e63', '#ff4081'],
        ['#3f51b5', '#536dfe'],
        ['#ff9800', '#ffab40'],
        ['#009688', '#1de9b6'],
      ];
      stores.forEach(([c, g], i) => P.put(root, P.storefront(c, g), -500 + i * 340, far(L, 520), 0, 1, -TABLE_DROP));
      for (let i = 0; i < 4; i++) P.put(root, P.plantPot(140), (i % 2 ? 1 : -1) * (W / 2 + 200), far(L, 50 + i * 120), 0, 1.4, -TABLE_DROP);
    },
  },
  {
    id: 'lanche',
    name: 'Praça de Alimentação',
    surface: 'tray',
    grip: 0.95,
    sky: ['#fff1e0', '#ffe2c4', '#ffcf9e'],
    fog: '#ffe6cc',
    sun: '#fff2d9',
    sunIntensity: 2.2,
    hemi: ['#ffffff', '#b07a4a'],
    build(root, W, L) {
      table(root, W, L, { top: 'woodTable', mx: 40, mz: 32, floor: 'mallFloor', floorTile: 160, edge: '#c7c7c7', rough: 0.3 });
      const sx = W / 2 + 22;
      P.put(root, P.burger(), sx, -L * 0.15, 0, 1.2);
      P.put(root, P.fries(), -sx, -L * 0.2, 20, 1.2);
      P.put(root, P.soda('#e53935'), sx + 2, L * 0.15);
      P.put(root, P.soda('#43a047'), -sx - 2, L * 0.2);
      P.put(root, P.ketchup(), -sx + 6, L * 0.02);
      P.put(root, P.burger(), -sx, -L * 0.45, 40);
      P.put(root, P.plasticChair('#ff7043'), -W / 2 - 110, 0, -90, 1, -TABLE_DROP);
      P.put(root, P.plasticChair('#ffca28'), W / 2 + 110, 0, 90, 1, -TABLE_DROP);
      const stalls: [string, string][] = [
        ['#e53935', '#ff5252'],
        ['#ffb300', '#ffd740'],
        ['#43a047', '#69f0ae'],
        ['#1e88e5', '#448aff'],
      ];
      stalls.forEach(([c, g], i) => P.put(root, P.foodStall(c, g), -510 + i * 340, far(L, 520), 0, 1, -TABLE_DROP));
      for (let i = 0; i < 3; i++) P.put(root, P.plasticChair(['#26a69a', '#ab47bc', '#ff7043'][i]), -260 + i * 260, far(L, 200), i * 40, 1, -TABLE_DROP);
    },
  },
  {
    id: 'gelo',
    name: 'Pista de Gelo',
    surface: 'ice',
    grip: 0.7,
    sky: ['#9fd3ff', '#d4ecff', '#f2f9ff'],
    fog: '#e6f4ff',
    sun: '#ffffff',
    sunIntensity: 2.4,
    hemi: ['#e6f4ff', '#a8c4dc'],
    build(root, W, L) {
      ground(root, 'snow', 120, 0.95);
      const ice = texturedPlane(W + 120, L + 160, tileTexture('snow', 128, 1, 1), -0.04, 0.1);
      (ice.material as THREE.MeshStandardMaterial).color.set('#cdeefd');
      root.add(ice);
      for (const s of [-1, 1]) P.put(root, P.rinkBoard(L + 160), s * (W / 2 + 60), 0, 90);
      P.put(root, P.rinkBoard(W + 120), 0, -(L / 2 + 80));
      // Inside the rink, next to the game
      P.put(root, P.snowman(), -W / 2 - 30, -L * 0.25, 20, 0.22);
      P.put(root, P.snowman(), W / 2 + 32, L * 0.2, -30, 0.18);
      P.put(root, P.puck(), W / 2 + 22, -L * 0.1);
      P.put(root, P.puck(), -W / 2 - 18, L * 0.35);
      P.put(root, P.snowman(), -W / 2 - 160, -L * 0.2);
      P.put(root, P.snowman(), W / 2 + 200, far(L, 200), 0, 1.3);
      for (let i = 0; i < 8; i++) P.put(root, P.pine(260 + (i % 3) * 80), (i % 2 ? 1 : -1) * (W / 2 + 260 + (i % 3) * 90), -L / 2 - i * 180 + 200);
    },
  },
  {
    id: 'xadrez',
    name: 'Tabuleiro Gigante',
    surface: 'chess',
    grip: 0.95,
    sky: ['#cbb8ff', '#e3d7ff', '#f6efff'],
    fog: '#e8ddff',
    sun: '#fff8ec',
    sunIntensity: 2.3,
    hemi: ['#ffffff', '#7a6a5a'],
    build(root, W, L) {
      ground(root, 'stone', 160);
      const pieces: ['rei' | 'rainha' | 'torre' | 'cavalo' | 'bispo' | 'peao', boolean, number, number][] = [
        ['torre', true, -W / 2 - 60, -L * 0.3],
        ['cavalo', false, W / 2 + 60, -L * 0.1],
        ['peao', true, -W / 2 - 45, L * 0.25],
        ['bispo', false, W / 2 + 55, L * 0.32],
        ['rei', true, -120, far(L, 160)],
        ['rainha', false, 120, far(L, 160)],
      ];
      for (const [p, dark, x, z] of pieces) P.put(root, P.giantChess(p, dark, p === 'rei' || p === 'rainha' ? 60 : 30), x, z, dark ? 0 : 180);
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) P.put(root, P.pillar(500), s * (W / 2 + 280), -L / 2 - i * 360 + 150);
    },
  },
  {
    id: 'estadio',
    name: 'Estádio',
    surface: 'grass',
    grip: 1.08,
    sky: ['#4a8fe7', '#8cc4ff', '#d9eeff'],
    fog: '#bcdcfb',
    sun: '#ffffff',
    sunIntensity: 2.6,
    hemi: ['#d9eeff', '#3f7d3f'],
    build(root, W, L) {
      ground(root, 'grassWide', 160);
      P.put(root, P.soccerBall(9), W / 2 + 30, -L * 0.2);
      P.put(root, P.cornerFlag(), -W / 2 - 20, -L / 2 - 10);
      P.put(root, P.cornerFlag(), W / 2 + 20, -L / 2 - 10);
      P.put(root, P.goal(), 0, far(L, 120), 180);
      P.put(root, P.stands(1600), 0, far(L, 480), 180);
      for (const s of [-1, 1]) {
        P.put(root, P.stands(1400), s * (W / 2 + 520), -L * 0.2, s > 0 ? 90 : -90);
        P.put(root, P.floodlight(), s * (W / 2 + 700), far(L, 600), s > 0 ? -30 : 30);
      }
    },
  },
  {
    id: 'praia',
    name: 'Areia da Praia',
    surface: 'sand',
    grip: 1.35,
    sky: ['#56b4ff', '#9fd6ff', '#e8f6ff'],
    fog: '#cfeaff',
    sun: '#fff3d1',
    sunIntensity: 2.8,
    hemi: ['#e8f6ff', '#c9a86a'],
    build(root, W, L) {
      ground(root, 'sandWide', 120, 1);
      P.put(root, P.sea(6000, 2200), 0, far(L, 1400));
      P.put(root, P.bucket(), W / 2 + 26, -L * 0.15);
      P.put(root, P.spade(), W / 2 + 22, L * 0.1, 30);
      P.put(root, P.sandcastle(), -W / 2 - 40, -L * 0.25, 0, 1.4);
      P.put(root, P.starfish(), -W / 2 - 14, L * 0.3, 20);
      P.put(root, P.starfish('#ffb74d'), W / 2 + 12, -L * 0.42, -40);
      P.put(root, P.umbrella(), -W / 2 - 160, far(L, 40));
      P.put(root, P.towel(), -W / 2 - 160, far(L, 20), 10);
      P.put(root, P.umbrella(['#29b6f6', '#fff176']), W / 2 + 220, far(L, 220));
      P.put(root, P.palm(), W / 2 + 380, -L * 0.1);
      P.put(root, P.palm(), -W / 2 - 420, far(L, 300), 120);
    },
  },
  {
    id: 'vulcao',
    name: 'Vulcão',
    surface: 'lava',
    grip: 1,
    sky: ['#2a0f1f', '#6b1f1f', '#d9541e'],
    fog: '#5a1d16',
    sun: '#ffb27a',
    sunIntensity: 2.2,
    hemi: ['#ff9e6e', '#2a1410'],
    build(root, W, L) {
      ground(root, 'rockWide', 140, 1);
      P.put(root, P.lavaPool(26), -W / 2 - 50, -L * 0.2);
      P.put(root, P.lavaPool(40), W / 2 + 90, L * 0.15);
      P.put(root, P.rock(14), W / 2 + 26, -L * 0.3);
      P.put(root, P.rock(9, '#5d4037'), -W / 2 - 18, L * 0.3, 40);
      P.put(root, P.rock(5), W / 2 + 10, L * 0.42);
      for (let i = 0; i < 6; i++) P.put(root, P.rock(60 + i * 15), (i % 2 ? 1 : -1) * (W / 2 + 200 + i * 40), -L / 2 - i * 160);
      P.put(root, P.volcano(), 0, far(L, 1800));
    },
  },
  {
    id: 'trono',
    name: 'Trono do Rei',
    surface: 'carpet',
    grip: 1,
    sky: ['#3b1d5e', '#6a3d9a', '#c9a4f0'],
    fog: '#4a2a72',
    sun: '#fff0c9',
    sunIntensity: 2.2,
    hemi: ['#f3e5ff', '#4a3020'],
    build(root, W, L) {
      ground(root, 'stone', 160);
      P.put(root, P.chest(), W / 2 + 34, -L * 0.2, -30);
      P.put(root, P.crown(), -W / 2 - 24, L * 0.2);
      P.put(root, P.torch(), -W / 2 - 40, -L * 0.35, 0, 0.6);
      P.put(root, P.torch(), W / 2 + 40, L * 0.35, 0, 0.6);
      P.put(root, P.throne(), 0, far(L, 260), 180, 1.3);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          P.put(root, P.pillar(700), s * (W / 2 + 240), -L / 2 - i * 320 + 250);
          P.put(root, P.banner(), s * (W / 2 + 240), -L / 2 - i * 320 + 250 + 45);
          P.put(root, P.torch(), s * (W / 2 + 180), -L / 2 - i * 320 + 90, 0, 1.6);
        }
      }
    },
  },
];

export function getScene(id: string): SceneDef {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}

/** Everything around the play area, ready to add to a three.js scene (one copy per renderer). */
export function sceneGroup(scene: SceneDef, W: number, L: number): THREE.Group {
  const g = new THREE.Group();
  scene.build(g, W, L);
  return g;
}

export function skyTexture(scene: SceneDef): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 256;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, scene.sky[0]);
  g.addColorStop(0.55, scene.sky[1]);
  g.addColorStop(1, scene.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
