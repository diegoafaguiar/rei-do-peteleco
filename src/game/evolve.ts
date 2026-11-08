// Characters get experience every time they knock someone down, and level up.
// Each level makes them a bit firmer, heavier and easier to control.

import type { CharDef } from './packs';

/** Experience needed to reach level 1, 2, 3, 4, 5. */
export const XP_LEVELS = [0, 3, 8, 15, 25];
export const MAX_LEVEL = XP_LEVELS.length;

export function levelOf(xp: number): number {
  let lv = 1;
  for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i]) lv = i + 1;
  return lv;
}

/** Progress toward the next level, 0..1 (1 at max level). */
export function levelProgress(xp: number): number {
  const lv = levelOf(xp);
  if (lv >= MAX_LEVEL) return 1;
  const from = XP_LEVELS[lv - 1];
  const to = XP_LEVELS[lv];
  return (xp - from) / (to - from);
}

export function boosted(ch: CharDef, level: number): CharDef {
  const k = level - 1;
  if (k <= 0) return ch;
  return {
    ...ch,
    stability: ch.stability * (1 + 0.07 * k),
    mass: ch.mass * (1 + 0.04 * k),
    wobble: Math.max(0.08, ch.wobble * (1 - 0.12 * k)),
  };
}

export interface StatRow {
  label: string;
  value: number; // 1..5
}

const dots = (v: number, lo: number, hi: number) => Math.max(1, Math.min(5, Math.round(1 + ((v - lo) / (hi - lo)) * 4)));

/** The five things that make each character play differently. */
export function statsOf(ch: CharDef): StatRow[] {
  return [
    { label: 'Peso', value: dots(ch.mass, 0.8, 1.9) },
    { label: 'Firmeza', value: dots(ch.stability, 7, 17) },
    { label: 'Pulo', value: dots(ch.bounce, 0.2, 0.85) },
    { label: 'Controle', value: dots(1 - ch.wobble, 0.15, 0.8) },
    { label: 'Deslize', value: dots(1 / ch.grip, 1 / 1.35, 1 / 0.7) },
  ];
}
