// Progress saved in the browser (this device only).

import type { MissRule } from './game/sim';

export interface Save {
  beaten: number; // highest level won
  missRule: MissRule;
  view: '2d' | '3d';
  sound: boolean;
  soloPack: string;
  duelPacks: [string, string];
  names: [string, string];
  xp: Record<string, number>; // experience per character id
  teams: Record<string, string[]>; // chosen character ids per pack
  stars: Record<string, number>; // best stars (1-3) per level
  music: boolean;
  duelScene: string;
}

const KEY = 'rei-do-peteleco:v1';

const DEFAULTS: Save = {
  beaten: 0,
  missRule: 'volta',
  view: '2d',
  sound: true,
  soloPack: 'turma',
  duelPacks: ['turma', 'turma'],
  names: ['Jogador 1', 'Jogador 2'],
  xp: {},
  teams: {},
  stars: {},
  music: true,
  duelScene: 'cozinha',
};

export function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, xp: {}, teams: {}, stars: {}, ...JSON.parse(raw) };
  } catch {
    /* storage blocked: play without saving */
  }
  return { ...DEFAULTS, xp: {}, teams: {}, stars: {} };
}

export function save(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
