// Character packs. All characters are original creations for this game,
// styled like little collectible toys (painted vinyl, clear jelly, glossy and metal).

import type { FigSpec } from '../figures/build';

export interface CharDef {
  id: string;
  name: string;
  fig: FigSpec;
  color: string; // main color, for menus and effects
  radius: number; // size on the table
  mass: number; // heavier pieces push harder and are harder to move
  stability: number; // impact speed needed to knock it down
  bounce: number; // 0..1 how much it hops and bounces off others
  wobble: number; // 0..1 how much it swerves while tumbling (less = more control)
  grip: number; // friction multiplier: low slides far, high stops quickly
}

export interface Pack {
  id: string;
  name: string;
  desc: string;
  unlockLevel: number; // beat this level to unlock (0 = available from start)
  chars: CharDef[]; // first 5 form the team
}

type Feel = Pick<CharDef, 'bounce' | 'wobble' | 'grip'>;

// How each body shape tumbles. Round ones roll true; boxy and long ones hop and swerve.
const BODY_FEEL: Record<FigSpec['body'], Feel> = {
  blob: { bounce: 0.5, wobble: 0.3, grip: 0.9 },
  squat: { bounce: 0.35, wobble: 0.25, grip: 1.0 },
  bean: { bounce: 0.55, wobble: 0.55, grip: 0.95 },
  pear: { bounce: 0.5, wobble: 0.5, grip: 1.0 },
  ghost: { bounce: 0.3, wobble: 0.3, grip: 1.1 },
  block: { bounce: 0.7, wobble: 0.8, grip: 1.2 },
  chess: { bounce: 0.4, wobble: 0.65, grip: 0.85 },
  critter4: { bounce: 0.6, wobble: 0.7, grip: 1.1 },
  critter2: { bounce: 0.55, wobble: 0.6, grip: 1.0 },
};

function feelOf(fig: FigSpec): Feel {
  const f = { ...BODY_FEEL[fig.body] };
  if (fig.style === 'jelly') {
    f.grip *= 0.82; // slippery plastic
    f.bounce = Math.min(1, f.bounce + 0.12);
  } else if (fig.style === 'metal' || fig.style === 'gloss') {
    f.grip *= 0.9;
  }
  if ((fig.extras ?? []).includes('feet')) f.wobble *= 0.85; // flat feet land steadier
  return f;
}

const c = (
  id: string,
  name: string,
  fig: FigSpec,
  radius: number,
  mass: number,
  stability: number,
  feel: Partial<Feel> = {},
): CharDef => ({
  id,
  name,
  fig,
  color: fig.color,
  radius,
  mass,
  stability,
  ...feelOf(fig),
  ...feel,
});

export const PACKS: Pack[] = [
  {
    id: 'turma',
    name: 'Turma do Peteleco',
    desc: 'Os primeiros amigos. Fofinhos e equilibrados.',
    unlockLevel: 0,
    chars: [
      c('bolota', 'Bolota', { style: 'vinyl', body: 'blob', color: '#ff5a5f', color2: '#ffd6d6', eyes: 'big', mouth: 'smile', extras: ['cheeks', 'feet', 'arms', 'belly'] }, 2.6, 1, 9),
      c('pipoca', 'Pipoca', { style: 'vinyl', body: 'bean', color: '#ffd23f', color2: '#fff7d6', eyes: 'happy', mouth: 'o', top: ['catEars'], extras: ['belly', 'cheeks', 'arms'] }, 2.6, 1, 9),
      c('azulao', 'Azulão', { style: 'vinyl', body: 'squat', color: '#3d8bff', color2: '#ffffff', eyes: 'big', mouth: 'fangs', top: ['horns'], extras: ['arms', 'feet'] }, 2.6, 1, 9),
      c('folhinha', 'Folhinha', { style: 'vinyl', body: 'pear', color: '#4cd07d', color2: '#1f9d55', eyes: 'big', mouth: 'smile', top: ['leaf'], extras: ['cheeks', 'arms'] }, 2.6, 1, 9),
      c('uva', 'Uva', { style: 'vinyl', body: 'ghost', color: '#8b5cf6', skin: '#d9c8ff', eyes: 'sleepy', mouth: 'smile', extras: ['arms'] }, 2.6, 1, 9),
      c('laranjinha', 'Laranjinha', { style: 'vinyl', body: 'blob', color: '#ff9f1c', color2: '#5b3a1a', eyes: 'cyclops', mouth: 'grin', top: ['antenna'], extras: ['feet'] }, 2.6, 1, 9),
    ],
  },
  {
    id: 'gelatinas',
    name: 'Gelatinas',
    desc: 'Bonequinhos de plástico transparente, coloridos como bala de goma.',
    unlockLevel: 1,
    chars: [
      c('gel-morango', 'Morango', { style: 'jelly', body: 'blob', color: '#ff2d55', eyes: 'big', mouth: 'smile', top: ['horns'], extras: ['feet'] }, 2.5, 0.95, 8.5),
      c('gel-limao', 'Limão', { style: 'jelly', body: 'bean', color: '#a3e635', eyes: 'happy', mouth: 'o', top: ['catEars'], extras: ['arms'] }, 2.5, 0.95, 8.5),
      c('gel-amora', 'Amora', { style: 'jelly', body: 'pear', color: '#a21caf', eyes: 'big', mouth: 'fangs', top: ['fin'] }, 2.5, 0.95, 8.5),
      c('gel-anil', 'Anil', { style: 'jelly', body: 'squat', color: '#0ea5e9', eyes: 'cyclops', mouth: 'grin', top: ['antenna'], extras: ['arms'] }, 2.5, 0.95, 8.5),
      c('gel-cereja', 'Cereja', { style: 'jelly', body: 'ghost', color: '#f472b6', eyes: 'sleepy', mouth: 'smile', extras: ['arms'] }, 2.5, 0.95, 8.5),
      c('gel-menta', 'Menta', { style: 'jelly', body: 'block', color: '#2dd4bf', eyes: 'angry', mouth: 'grin', top: ['ears'] }, 2.5, 0.95, 8.5),
    ],
  },
  {
    id: 'monstros',
    name: 'Monstrinhos Elementais',
    desc: 'Fogo, água, planta, raio e pedra. O Pedrão é pesadão!',
    unlockLevel: 2,
    chars: [
      c('brasa', 'Brasa', { style: 'vinyl', body: 'pear', color: '#ff4d2e', color2: '#ffc53d', eyes: 'angry', mouth: 'fangs', top: ['flame'], extras: ['arms', 'belly'] }, 2.7, 1.05, 9.5),
      c('gota', 'Gota', { style: 'vinyl', body: 'bean', color: '#3bb6ff', color2: '#d6f1ff', eyes: 'big', mouth: 'o', top: ['fin'], extras: ['belly', 'arms', 'tail'] }, 2.7, 1, 9.5),
      c('brotinho', 'Brotinho', { style: 'vinyl', body: 'blob', color: '#5ccf5c', color2: '#2e8b3a', eyes: 'happy', mouth: 'smile', top: ['leaf'], extras: ['cheeks', 'feet'] }, 2.7, 1, 9.5),
      c('faisca', 'Faísca', { style: 'vinyl', body: 'squat', color: '#ffd400', color2: '#3a2a1a', eyes: 'angry', mouth: 'grin', top: ['antenna'], extras: ['bolt', 'arms'] }, 2.6, 0.95, 9),
      c('pedrao', 'Pedrão', { style: 'vinyl', body: 'block', color: '#ff7ac8', color2: '#c2410c', eyes: 'mask', mouth: 'frown', top: ['horns'], extras: ['arms', 'belly'] }, 2.9, 1.4, 12),
    ],
  },
  {
    id: 'selvagens',
    name: 'Criaturas Selvagens',
    desc: 'Bichinhos de PVC pintado, com patas, rabos e orelhas. Capotam de jeitos bem diferentes!',
    unlockLevel: 3,
    chars: [
      c('cascudo', 'Cascudo', { style: 'vinyl', body: 'critter4', color: '#3fb6c8', color2: '#d9993f', eyes: 'big', mouth: 'smile', extras: ['shell', 'tail'] }, 2.8, 1.35, 11.5, { bounce: 0.3, wobble: 0.45, grip: 1.25 }),
      c('faiscudo', 'Faiscudo', { style: 'vinyl', body: 'critter4', color: '#ffd23f', color2: '#6b3e1e', eyes: 'big', mouth: 'smile', top: ['longEars'], extras: ['stripes', 'tail', 'cheeks'] }, 2.5, 0.8, 8, { bounce: 0.7, wobble: 0.75, grip: 0.85 }),
      c('folhareu', 'Folharéu', { style: 'vinyl', body: 'blob', color: '#3b4cc0', color2: '#2fbf4a', eyes: 'happy', mouth: 'o', top: ['leafCrown'], extras: ['feet'] }, 2.4, 0.85, 8.5, { bounce: 0.6 }),
      c('bicudo', 'Bicudo', { style: 'vinyl', body: 'critter2', color: '#ffcf3f', color2: '#ff8a1c', eyes: 'big', mouth: 'none', extras: ['snout'] }, 2.6, 1, 9.5),
      c('pedrudo', 'Pedrudo', { style: 'vinyl', body: 'critter2', color: '#9aa0a6', color2: '#5f6368', eyes: 'angry', mouth: 'grin', top: ['spikes'], extras: ['stripes'] }, 2.9, 1.6, 14, { bounce: 0.25, wobble: 0.4, grip: 1.3 }),
      c('orelhuda', 'Orelhuda', { style: 'vinyl', body: 'critter4', color: '#ff9ecd', color2: '#ffffff', eyes: 'happy', mouth: 'smile', top: ['longEars'], extras: ['tail', 'cheeks'] }, 2.5, 0.9, 8.5, { bounce: 0.8 }),
      c('lagartixo', 'Lagartixo', { style: 'vinyl', body: 'critter4', color: '#56c271', color2: '#2e7d32', eyes: 'big', mouth: 'fangs', top: ['spikes'], extras: ['leafTail', 'stripes'] }, 2.7, 1.1, 10),
      c('bolhudo', 'Bolhudo', { style: 'vinyl', body: 'critter2', color: '#4f7cff', color2: '#f4f4f4', eyes: 'sleepy', mouth: 'o', extras: ['spiral'] }, 2.8, 1.2, 11, { wobble: 0.45 }),
    ],
  },
  {
    id: 'gelo',
    name: 'Turma do Gelo',
    desc: 'Transparentes como gelo. Leves: caem fácil, mas voam longe.',
    unlockLevel: 4,
    chars: [
      c('floco', 'Floco', { style: 'jelly', body: 'blob', color: '#bfe9ff', color2: '#7dd3fc', eyes: 'big', mouth: 'smile', top: ['crystal'], extras: ['feet'] }, 2.5, 0.85, 8),
      c('iglu', 'Iglu', { style: 'jelly', body: 'block', color: '#7cc8ff', eyes: 'sleepy', mouth: 'o', top: ['ears'] }, 2.7, 1, 9),
      c('cristal', 'Cristal', { style: 'jelly', body: 'pear', color: '#67e8f9', color2: '#e0f2fe', eyes: 'big', mouth: 'smile', top: ['crystal'], extras: ['arms'] }, 2.5, 0.9, 8),
      c('nevasco', 'Nevasco', { style: 'jelly', body: 'bean', color: '#e6f4ff', color2: '#38bdf8', eyes: 'angry', mouth: 'grin', top: ['spikes'], extras: ['scarf'] }, 2.8, 1.1, 9.5),
      c('geadinha', 'Geadinha', { style: 'jelly', body: 'ghost', color: '#c4b5fd', eyes: 'happy', mouth: 'o', extras: ['arms'] }, 2.4, 0.8, 7.5),
    ],
  },
  {
    id: 'xadrez',
    name: 'Peças de Xadrez',
    desc: 'O Rei e a Torre são firmes. O Peão é pequenino.',
    unlockLevel: 6,
    chars: [
      c('rei', 'Rei', { style: 'gloss', body: 'chess', piece: 'rei', color: '#f5efe3', color2: '#f6c445' }, 3.0, 1.5, 14),
      c('rainha', 'Rainha', { style: 'gloss', body: 'chess', piece: 'rainha', color: '#f5efe3', color2: '#f6c445' }, 2.8, 1.3, 12),
      c('torre', 'Torre', { style: 'gloss', body: 'chess', piece: 'torre', color: '#f5efe3', color2: '#f6c445' }, 2.8, 1.4, 13),
      c('cavalo', 'Cavalo', { style: 'gloss', body: 'chess', piece: 'cavalo', color: '#f5efe3', color2: '#c0843a' }, 2.6, 1.1, 10),
      c('peao', 'Peão', { style: 'gloss', body: 'chess', piece: 'peao', color: '#f5efe3', color2: '#f6c445' }, 2.2, 0.8, 7),
      c('bispo', 'Bispo', { style: 'gloss', body: 'chess', piece: 'bispo', color: '#f5efe3', color2: '#f6c445' }, 2.5, 1, 9),
    ],
  },
  {
    id: 'bola',
    name: 'Cabeçudos da Bola',
    desc: 'Craques de cabeça grande, prontos pra Copa.',
    unlockLevel: 8,
    chars: [
      c('craque', 'Craque', { style: 'vinyl', body: 'pear', color: '#f1c27d', color2: '#ffd400', color3: '#2b1a10', eyes: 'big', mouth: 'smile', top: ['hair'], extras: ['shirt', 'arms'], number: 10 }, 2.9, 1.1, 9.5),
      c('artilheiro', 'Artilheiro', { style: 'vinyl', body: 'pear', color: '#e0ac69', color2: '#6ec1ff', color3: '#151515', eyes: 'angry', mouth: 'grin', top: ['hair'], extras: ['shirt', 'arms'], number: 9 }, 2.9, 1.1, 9.5),
      c('ponta', 'Ponta', { style: 'vinyl', body: 'pear', color: '#8d5524', color2: '#ff8a1c', color3: '#151515', eyes: 'happy', mouth: 'smile', top: ['hair'], extras: ['shirt', 'arms'], number: 7 }, 2.8, 1, 9),
      c('zagueiro', 'Zagueiro', { style: 'vinyl', body: 'pear', color: '#c68642', color2: '#e11d48', color3: '#4a2c17', eyes: 'angry', mouth: 'frown', top: ['hair'], extras: ['shirt', 'arms'], number: 4 }, 3.0, 1.3, 11),
      c('goleiro', 'Goleiro', { style: 'vinyl', body: 'pear', color: '#f1c27d', color2: '#16a34a', color3: '#f5d061', eyes: 'big', mouth: 'o', top: ['hair'], extras: ['shirt', 'arms'], number: 1 }, 3.0, 1.2, 11),
    ],
  },
  {
    id: 'evo',
    name: 'Monstrinhos Evoluídos',
    desc: 'Os elementais cresceram! Grandes, pesados e difíceis de derrubar.',
    unlockLevel: 10,
    chars: [
      c('brasao', 'Brasão', { style: 'vinyl', body: 'squat', color: '#e23a1e', color2: '#ffb020', eyes: 'angry', mouth: 'fangs', top: ['horns', 'flame'], extras: ['arms', 'wings'] }, 3.2, 1.6, 15),
      c('tsunami', 'Tsunami', { style: 'vinyl', body: 'pear', color: '#1479c9', color2: '#9be3ff', eyes: 'angry', mouth: 'grin', top: ['fin', 'spikes'], extras: ['arms', 'belly', 'tail'] }, 3.2, 1.6, 15),
      c('florestao', 'Florestão', { style: 'vinyl', body: 'block', color: '#2f9e44', color2: '#a3e635', eyes: 'angry', mouth: 'fangs', top: ['leaf', 'horns'], extras: ['arms', 'shield'] }, 3.2, 1.6, 15),
      c('trovao', 'Trovão', { style: 'vinyl', body: 'ghost', color: '#6d28d9', color2: '#ffd400', skin: '#c4b5fd', eyes: 'angry', mouth: 'grin', extras: ['arms', 'bolt'] }, 3.1, 1.5, 14),
      c('montanha', 'Montanha', { style: 'vinyl', body: 'block', color: '#7c5a45', color2: '#c9a27e', color3: '#6b7280', eyes: 'mask', mouth: 'frown', top: ['helmet'], extras: ['arms', 'shield', 'belly'] }, 3.4, 1.9, 17),
    ],
  },
  {
    id: 'reis',
    name: 'Reis do Peteleco',
    desc: 'Só para quem venceu todas as fases. Coroas de verdade!',
    unlockLevel: 12,
    chars: [
      c('rei-ouro', 'Rei de Ouro', { style: 'metal', body: 'blob', color: '#f6c445', eyes: 'big', mouth: 'smile', top: ['crown'], extras: ['arms', 'feet'] }, 3.0, 1.5, 14),
      c('rei-prata', 'Rei de Prata', { style: 'metal', body: 'bean', color: '#d7dde5', eyes: 'happy', mouth: 'smile', top: ['crown'], extras: ['arms'] }, 3.0, 1.5, 14),
      c('rei-rubi', 'Rei Rubi', { style: 'jelly', body: 'pear', color: '#e11d48', eyes: 'angry', mouth: 'grin', top: ['crown'], extras: ['arms'] }, 3.0, 1.5, 14),
      c('rei-esmeralda', 'Rei Esmeralda', { style: 'jelly', body: 'squat', color: '#10b981', eyes: 'big', mouth: 'fangs', top: ['crown'], extras: ['arms', 'feet'] }, 3.0, 1.5, 14),
      c('rei-safira', 'Rei Safira', { style: 'jelly', body: 'ghost', color: '#2563eb', eyes: 'sleepy', mouth: 'smile', top: ['crown'], extras: ['arms'] }, 3.0, 1.5, 14),
    ],
  },
];

export function getPack(id: string): Pack {
  return PACKS.find((p) => p.id === id) ?? PACKS[0];
}

export function isUnlocked(pack: Pack, beaten: number): boolean {
  return beaten >= pack.unlockLevel;
}

export function teamOf(pack: Pack, size = 5): CharDef[] {
  return Array.from({ length: size }, (_, i) => pack.chars[i % pack.chars.length]);
}
