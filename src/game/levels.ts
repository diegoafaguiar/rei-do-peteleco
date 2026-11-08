// Solo campaign. Each level puts the computer's team farther away and makes it aim better.

import { getScene } from '../scenes/scenes';

export interface Level {
  n: number;
  name: string;
  scene: string; // where it happens (see scenes)
  length: number; // table length (distance between the two teams)
  cpuPack: string;
  cpuAngleError: number; // degrees of aiming error (smaller = better aim)
  guide: number; // how long the aiming guide is (0..1)
}

// Each level happens in a different place, farther and harder each time.
const PLAN: [string, string][] = [
  ['cozinha', 'turma'],
  ['sala', 'gelatinas'],
  ['rua', 'monstros'],
  ['escola', 'selvagens'],
  ['shopping', 'gelatinas'],
  ['lanche', 'monstros'],
  ['gelo', 'gelo'],
  ['xadrez', 'xadrez'],
  ['estadio', 'bola'],
  ['praia', 'selvagens'],
  ['vulcao', 'evo'],
  ['trono', 'evo'],
];

export const LEVELS: Level[] = PLAN.map(([scene, cpuPack], i) => {
  const n = i + 1;
  return {
    n,
    name: getScene(scene).name,
    scene,
    length: 70 + (n - 1) * 12,
    cpuPack,
    cpuAngleError: Math.max(1.6, 7.5 - n * 0.5),
    guide: Math.max(0.25, 1 - (n - 1) * 0.07),
  };
});

export const DUEL_LENGTH = 100;
