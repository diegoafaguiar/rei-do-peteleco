// Character packs. All characters are original creations for this game.

export type Shape = 'buddy' | 'monster' | 'ice' | 'chess' | 'ball' | 'evo' | 'king';

export interface CharDef {
  id: string;
  name: string;
  color: string; // main body color
  accent: string; // detail color
  shape: Shape;
  radius: number; // size on the table
  mass: number; // heavier pieces push harder and are harder to move
  stability: number; // impact speed needed to knock it down
  symbol?: string; // chess glyph
  number?: number; // shirt number
}

export interface Pack {
  id: string;
  name: string;
  desc: string;
  unlockLevel: number; // beat this level to unlock (0 = available from start)
  chars: CharDef[]; // first 5 form the team
}

const c = (
  id: string,
  name: string,
  shape: Shape,
  color: string,
  accent: string,
  radius: number,
  mass: number,
  stability: number,
  extra: Partial<CharDef> = {},
): CharDef => ({ id, name, shape, color, accent, radius, mass, stability, ...extra });

export const PACKS: Pack[] = [
  {
    id: 'turma',
    name: 'Turma do Peteleco',
    desc: 'Os primeiros amigos. Equilibrados e fáceis de usar.',
    unlockLevel: 0,
    chars: [
      c('bolota', 'Bolota', 'buddy', '#ef4444', '#fecaca', 2.6, 1, 9),
      c('pipoca', 'Pipoca', 'buddy', '#facc15', '#fef9c3', 2.6, 1, 9),
      c('azulao', 'Azulão', 'buddy', '#3b82f6', '#dbeafe', 2.6, 1, 9),
      c('folhinha', 'Folhinha', 'buddy', '#22c55e', '#dcfce7', 2.6, 1, 9),
      c('uva', 'Uva', 'buddy', '#a855f7', '#f3e8ff', 2.6, 1, 9),
      c('laranjinha', 'Laranjinha', 'buddy', '#f97316', '#ffedd5', 2.6, 1, 9),
    ],
  },
  {
    id: 'monstros',
    name: 'Monstrinhos Elementais',
    desc: 'Fogo, água, planta, raio e pedra. O Pedrão é pesadão!',
    unlockLevel: 2,
    chars: [
      c('brasa', 'Brasa', 'monster', '#f4511e', '#ffd54f', 2.7, 1.05, 9.5),
      c('gota', 'Gota', 'monster', '#29b6f6', '#e1f5fe', 2.7, 1, 9.5),
      c('brotinho', 'Brotinho', 'monster', '#66bb6a', '#c5e1a5', 2.7, 1, 9.5),
      c('faisca', 'Faísca', 'monster', '#fdd835', '#5d4037', 2.6, 0.95, 9),
      c('pedrao', 'Pedrão', 'monster', '#8d6e63', '#d7ccc8', 2.9, 1.4, 12),
    ],
  },
  {
    id: 'gelo',
    name: 'Turma do Gelo',
    desc: 'Leves e escorregadios. Caem fácil, mas voam longe.',
    unlockLevel: 4,
    chars: [
      c('floco', 'Floco', 'ice', '#e0f7fa', '#4dd0e1', 2.5, 0.85, 8),
      c('iglu', 'Iglu', 'ice', '#b3e5fc', '#0288d1', 2.7, 1, 9),
      c('cristal', 'Cristal', 'ice', '#80deea', '#006064', 2.5, 0.9, 8),
      c('nevasco', 'Nevasco', 'ice', '#ffffff', '#90a4ae', 2.8, 1.1, 9.5),
      c('geadinha', 'Geadinha', 'ice', '#b2ebf2', '#7e57c2', 2.4, 0.8, 7.5),
    ],
  },
  {
    id: 'xadrez',
    name: 'Peças de Xadrez',
    desc: 'O Rei e a Torre são firmes. O Peão é pequenino.',
    unlockLevel: 6,
    chars: [
      c('rei', 'Rei', 'chess', '#f5f5f4', '#1c1917', 3.0, 1.5, 14, { symbol: '♚' }),
      c('rainha', 'Rainha', 'chess', '#f5f5f4', '#1c1917', 2.8, 1.3, 12, { symbol: '♛' }),
      c('torre', 'Torre', 'chess', '#f5f5f4', '#1c1917', 2.8, 1.4, 13, { symbol: '♜' }),
      c('cavalo', 'Cavalo', 'chess', '#f5f5f4', '#1c1917', 2.6, 1.1, 10, { symbol: '♞' }),
      c('peao', 'Peão', 'chess', '#f5f5f4', '#1c1917', 2.2, 0.8, 7, { symbol: '♟' }),
      c('bispo', 'Bispo', 'chess', '#f5f5f4', '#1c1917', 2.5, 1, 9, { symbol: '♝' }),
    ],
  },
  {
    id: 'bola',
    name: 'Cabeçudos da Bola',
    desc: 'Craques de cabeça grande, prontos pra Copa.',
    unlockLevel: 8,
    chars: [
      c('craque', 'Craque', 'ball', '#facc15', '#16a34a', 2.9, 1.1, 9.5, { number: 10 }),
      c('artilheiro', 'Artilheiro', 'ball', '#60a5fa', '#ffffff', 2.9, 1.1, 9.5, { number: 9 }),
      c('ponta', 'Ponta', 'ball', '#f97316', '#1e3a8a', 2.8, 1, 9, { number: 7 }),
      c('zagueiro', 'Zagueiro', 'ball', '#dc2626', '#ffffff', 3.0, 1.3, 11, { number: 4 }),
      c('goleiro', 'Goleiro', 'ball', '#16a34a', '#fde047', 3.0, 1.2, 11, { number: 1 }),
    ],
  },
  {
    id: 'evo',
    name: 'Monstrinhos Evoluídos',
    desc: 'Os elementais cresceram! Grandes, pesados e difíceis de derrubar.',
    unlockLevel: 10,
    chars: [
      c('brasao', 'Brasão', 'evo', '#d84315', '#ffca28', 3.2, 1.6, 15),
      c('tsunami', 'Tsunami', 'evo', '#0277bd', '#80d8ff', 3.2, 1.6, 15),
      c('florestao', 'Florestão', 'evo', '#2e7d32', '#aed581', 3.2, 1.6, 15),
      c('trovao', 'Trovão', 'evo', '#f9a825', '#4e342e', 3.1, 1.5, 14),
      c('montanha', 'Montanha', 'evo', '#5d4037', '#bcaaa4', 3.4, 1.9, 17),
    ],
  },
  {
    id: 'reis',
    name: 'Reis do Peteleco',
    desc: 'Só para quem venceu todas as fases. Coroas de verdade!',
    unlockLevel: 12,
    chars: [
      c('rei-ouro', 'Rei de Ouro', 'king', '#fbbf24', '#b45309', 3.0, 1.5, 14),
      c('rei-prata', 'Rei de Prata', 'king', '#d1d5db', '#4b5563', 3.0, 1.5, 14),
      c('rei-rubi', 'Rei Rubi', 'king', '#e11d48', '#fbbf24', 3.0, 1.5, 14),
      c('rei-esmeralda', 'Rei Esmeralda', 'king', '#059669', '#fbbf24', 3.0, 1.5, 14),
      c('rei-safira', 'Rei Safira', 'king', '#2563eb', '#fbbf24', 3.0, 1.5, 14),
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
