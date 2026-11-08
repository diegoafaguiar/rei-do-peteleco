// Solo campaign. Each level puts the computer's team farther away and makes it aim better.

export interface Level {
  n: number;
  name: string;
  length: number; // table length (distance between the two teams)
  cpuPack: string;
  cpuAngleError: number; // degrees of aiming error (smaller = better aim)
  guide: number; // how long the aiming guide is (0..1)
}

const NAMES = [
  'Mesa da Cozinha',
  'Mesa da Sala',
  'Pátio da Escola',
  'Quadra',
  'Pista de Gelo',
  'Lago Congelado',
  'Tabuleiro Gigante',
  'Castelo',
  'Estádio',
  'Final da Copa',
  'Vulcão',
  'Trono do Rei',
];

const CPU_PACKS = ['turma', 'turma', 'monstros', 'monstros', 'gelo', 'gelo', 'xadrez', 'xadrez', 'bola', 'bola', 'evo', 'evo'];

export const LEVELS: Level[] = NAMES.map((name, i) => {
  const n = i + 1;
  return {
    n,
    name,
    length: 70 + (n - 1) * 12,
    cpuPack: CPU_PACKS[i],
    cpuAngleError: Math.max(1.6, 7.5 - n * 0.5),
    guide: Math.max(0.25, 1 - (n - 1) * 0.07),
  };
});

export const DUEL_LENGTH = 100;
