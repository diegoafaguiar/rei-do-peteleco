// Game rules and physics. Renderers only read this state; they never change it.
//
// World coordinates: the table is W wide (x) and L long (y).
// Player 0 sits at y = 0 and flicks toward +y. Player 1 sits at y = L and flicks toward -y.

import type { CharDef } from './packs';

export type Owner = 0 | 1;
export type MissRule = 'perde' | 'volta';
export type Phase = 'aim' | 'rolling' | 'arranging' | 'over';

export interface Piece {
  id: number;
  char: CharDef;
  owner: Owner;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fallen: boolean;
  fallDir: number; // angle (radians) of the direction it fell
  fallT: number; // 0 standing .. 1 lying down
  out: boolean; // slid off the table
  outT: number; // falling-off animation
  tx: number; // where it walks to while arranging
  ty: number;
  // Tumbling: the toys aren't round, so they flip end over end and hop as they go.
  roll: number; // how far it has flipped (radians)
  rollDir: number; // direction of travel the flip follows (radians)
  h: number; // height above the table while hopping
  vh: number;
}

export type GameEvent =
  | { type: 'flick'; power: number; x: number; y: number }
  | { type: 'hit'; strength: number; x: number; y: number }
  | { type: 'topple'; x: number; y: number; color: string }
  | { type: 'offTable'; x: number; y: number }
  | { type: 'capture'; count: number; by: Owner; charId: string }
  | { type: 'bump'; x: number; y: number }
  | { type: 'miss'; lost: boolean }
  | { type: 'win'; winner: Owner }
  | { type: 'turn'; turn: Owner };

export interface MatchOptions {
  mode: 'solo' | 'duel';
  level?: number;
  length: number;
  teams: [CharDef[], CharDef[]];
  names: [string, string];
  cpu: [boolean, boolean];
  missRule: MissRule;
  guide: number;
  scene: string; // where the match happens (see scenes)
  grip: number; // how much the surface slows pieces: ice < 1 < sand
}

export interface Match extends MatchOptions {
  W: number;
  L: number;
  pieces: Piece[];
  turn: Owner;
  phase: Phase;
  selected: number | null;
  flicker: number | null;
  winner: Owner | null;
  events: GameEvent[];
  vmax: number;
  timer: number; // seconds in the current phase
  lastResult: string;
}

export const TABLE_W = 60;
export const FRICTION = 50; // slowdown of a standing piece, units/s²
const FALLEN_FRICTION = FRICTION * 2.6;
const GRAVITY = 120;
const SETTLE_SPEED = 8; // below this a piece stops tumbling
const LINE_EDGE = 5; // distance of the first row from the player's edge
const ROW_GAP = 6.5;
export const LAUNCH_EDGE = 17; // distance of the flick spot from the player's edge
const ARRANGE_TIME = 0.8;

let nextId = 1;

export function forward(owner: Owner): number {
  return owner === 0 ? 1 : -1;
}

export function launchY(m: Match, owner: Owner): number {
  return owner === 0 ? LAUNCH_EDGE : m.L - LAUNCH_EDGE;
}

export function createMatch(opts: MatchOptions): Match {
  const m: Match = {
    ...opts,
    W: TABLE_W,
    L: opts.length,
    pieces: [],
    turn: 0,
    phase: 'arranging',
    selected: null,
    flicker: null,
    winner: null,
    events: [],
    // Room for heavy pieces (which fly slower) to still reach the far side.
    vmax: Math.sqrt(2 * FRICTION * opts.grip * opts.length * 1.7),
    timer: 0,
    lastResult: '',
  };
  for (const owner of [0, 1] as Owner[]) {
    for (const ch of opts.teams[owner]) {
      m.pieces.push({
        id: nextId++,
        char: ch,
        owner,
        x: TABLE_W / 2,
        y: owner === 0 ? LINE_EDGE : m.L - LINE_EDGE,
        vx: 0,
        vy: 0,
        fallen: false,
        fallDir: 0,
        fallT: 0,
        out: false,
        outT: 0,
        tx: 0,
        ty: 0,
        roll: 0,
        rollDir: 0,
        h: 0,
        vh: 0,
      });
    }
  }
  arrange(m);
  // Start already in place, no walking at the very beginning.
  for (const p of m.pieces) {
    p.x = p.tx;
    p.y = p.ty;
  }
  return m;
}

export function teamPieces(m: Match, owner: Owner): Piece[] {
  return m.pieces.filter((p) => p.owner === owner);
}

export function getPiece(m: Match, id: number | null): Piece | undefined {
  return id == null ? undefined : m.pieces.find((p) => p.id === id);
}

/** Put every piece in neat rows on its owner's side of the table. */
function arrange(m: Match) {
  for (const owner of [0, 1] as Owner[]) {
    const team = teamPieces(m, owner).sort((a, b) => a.x - b.x);
    const perRow = 7;
    const rows = Math.ceil(team.length / perRow);
    team.forEach((p, i) => {
      const row = Math.floor(i / perRow);
      const inRow = row < rows - 1 ? perRow : team.length - row * perRow;
      const col = i - row * perRow;
      const spacing = Math.min(9, (TABLE_W - 8) / Math.max(1, inRow));
      p.tx = TABLE_W / 2 + (col - (inRow - 1) / 2) * spacing;
      const fromEdge = LINE_EDGE + row * ROW_GAP;
      p.ty = owner === 0 ? fromEdge : m.L - fromEdge;
    });
  }
  m.phase = 'arranging';
  m.timer = 0;
}

/** Move one of the current player's pieces to the flick spot. */
export function selectPiece(m: Match, id: number) {
  if (m.phase !== 'aim') return;
  const p = getPiece(m, id);
  if (!p || p.owner !== m.turn) return;
  const prev = getPiece(m, m.selected);
  if (prev && prev.id !== p.id) {
    // Swap: the previous one goes back to the spot the new one leaves.
    prev.tx = p.tx;
    prev.ty = p.ty;
  }
  m.selected = p.id;
  p.tx = clamp(p.x, 6, TABLE_W - 6);
  p.ty = launchY(m, m.turn);
}

/** Slide the selected piece sideways along the flick line. */
export function setLaunchX(m: Match, x: number) {
  const p = getPiece(m, m.selected);
  if (!p || m.phase !== 'aim') return;
  p.tx = clamp(x, p.char.radius + 1, TABLE_W - p.char.radius - 1);
  p.ty = launchY(m, m.turn);
}

/** Flick the selected piece. dir is a world direction, power 0..1. */
export function flick(m: Match, dx: number, dy: number, power: number) {
  const p = getPiece(m, m.selected);
  if (!p || m.phase !== 'aim') return;
  const len = Math.hypot(dx, dy) || 1;
  const speed = flickSpeed(m, p.char, power);
  p.x = p.tx;
  p.y = p.ty;
  p.vx = (dx / len) * speed;
  p.vy = (dy / len) * speed;
  p.rollDir = Math.atan2(p.vy, p.vx);
  p.vh = 3 + speed * 0.07 * (0.4 + p.char.bounce);
  m.flicker = p.id;
  m.selected = null;
  m.phase = 'rolling';
  m.timer = 0;
  m.events.push({ type: 'flick', power, x: p.x, y: p.y });
}

/** Same finger strength: light pieces shoot off fast, heavy ones go slower. */
export function flickSpeed(m: Match, ch: CharDef, power: number) {
  return m.vmax * clamp(power, 0, 1) * Math.pow(ch.mass, -0.35);
}

/** Slowdown for this character on this surface (some slide, some grip; ice is slippery). */
export function frictionOf(ch: CharDef, m: Match) {
  return FRICTION * ch.grip * m.grip;
}

export function step(m: Match, dt: number) {
  m.timer += dt;
  if (m.phase === 'arranging') {
    stepArrange(m, dt);
  } else if (m.phase === 'rolling') {
    const sub = 5;
    for (let i = 0; i < sub; i++) stepPhysics(m, dt / sub);
    animateFalls(m, dt);
    if ((allStill(m) && m.timer > 0.4) || m.timer > 9) resolve(m);
  } else if (m.phase === 'aim') {
    stepArrange(m, dt);
  }
}

function stepArrange(m: Match, dt: number) {
  const k = 1 - Math.exp(-dt * 9);
  for (const p of m.pieces) {
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    p.fallT = Math.max(0, p.fallT - dt * 3);
    p.roll *= Math.exp(-dt * 8); // stand back up
    p.h = 0;
  }
  if (m.phase === 'arranging' && m.timer > ARRANGE_TIME) startTurn(m);
}

function startTurn(m: Match) {
  m.phase = 'aim';
  m.timer = 0;
  const team = teamPieces(m, m.turn);
  if (team.length === 0) return;
  // Pick the piece closest to the middle so the player can flick right away.
  const mid = team.reduce((a, b) => (Math.abs(a.x - TABLE_W / 2) < Math.abs(b.x - TABLE_W / 2) ? a : b));
  selectPiece(m, mid.id);
}

function stepPhysics(m: Match, dt: number) {
  const attacker = m.turn;
  // Pieces of the attacking team still in line don't take part (they're behind the flick spot).
  const active = m.pieces.filter((p) => !p.out && (p.owner !== attacker || p.id === m.flicker || p.fallen));

  for (const p of active) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 0) {
      const dec = (p.fallen ? FALLEN_FRICTION * m.grip : frictionOf(p.char, m)) * dt;
      const ns = Math.max(0, speed - dec);
      p.vx *= ns / speed;
      p.vy *= ns / speed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    tumble(m, p, dt);
    if (p.x < 0 || p.x > m.W || p.y < 0 || p.y > m.L) {
      p.out = true;
      if (p.owner !== attacker && !p.fallen) {
        p.fallen = true;
        p.fallDir = Math.atan2(p.vy, p.vx);
      }
      m.events.push({ type: 'offTable', x: p.x, y: p.y });
    }
  }

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.out || b.out) continue;
      collide(m, a, b);
    }
  }
}

/**
 * Non-round toys flip over as they slide. Every time one lands it hops again
 * and gets knocked a little off its line: more wobble and more speed = less control.
 */
function tumble(m: Match, p: Piece, dt: number) {
  const ch = p.char;
  const speed = Math.hypot(p.vx, p.vy);
  if (p.h > 0 || p.vh > 0) {
    p.vh -= GRAVITY * dt;
    p.h += p.vh * dt;
    if (p.h <= 0) {
      p.h = 0;
      const impact = -p.vh;
      p.vh = 0;
      if (speed > SETTLE_SPEED && !p.fallen) {
        // Land, lose a little speed, get pushed off course, hop again.
        const keep = 1 - 0.03 * (1 - ch.bounce);
        const chaos = ch.wobble * 0.11 * (0.4 + speed / m.vmax);
        const turn = gaussian() * chaos;
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        const vx = (p.vx * c - p.vy * s) * keep;
        const vy = (p.vx * s + p.vy * c) * keep;
        p.vx = vx;
        p.vy = vy;
        p.vh = (2 + speed * 0.16) * (0.25 + ch.bounce * 0.75) * (0.7 + Math.random() * 0.6);
        if (impact > 6) m.events.push({ type: 'bump', x: p.x, y: p.y });
      }
    }
  }
  if (p.fallen) return;
  if (speed > SETTLE_SPEED || p.h > 0) {
    // Flip end over end along the direction of travel.
    p.rollDir = Math.atan2(p.vy, p.vx);
    p.roll += (speed * dt) / (ch.radius * 1.15);
  } else {
    // Come to rest on whichever side is closest.
    const target = Math.round(p.roll / (Math.PI / 2)) * (Math.PI / 2);
    p.roll += (target - p.roll) * Math.min(1, dt * 10);
  }
}

function gaussian(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

function collide(m: Match, a: Piece, b: Piece) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.char.radius + b.char.radius;
  if (dist >= minDist || dist === 0) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const ma = a.char.mass;
  const mb = b.char.mass;

  // Push apart so they don't overlap.
  const overlap = minDist - dist;
  a.x -= nx * overlap * (mb / (ma + mb));
  a.y -= ny * overlap * (mb / (ma + mb));
  b.x += nx * overlap * (ma / (ma + mb));
  b.y += ny * overlap * (ma / (ma + mb));

  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; // closing speed
  if (rel <= 0) return;
  const restitution = 0.25 + 0.5 * ((a.char.bounce + b.char.bounce) / 2);
  const impulse = ((1 + restitution) * rel) / (1 / ma + 1 / mb);
  a.vx -= (impulse / ma) * nx;
  a.vy -= (impulse / ma) * ny;
  b.vx += (impulse / mb) * nx;
  b.vy += (impulse / mb) * ny;
  // Odd shapes bounce off at odd angles, and the hit sends them hopping.
  for (const p of [a, b]) {
    const turn = gaussian() * p.char.wobble * 0.25;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    [p.vx, p.vy] = [p.vx * c - p.vy * s, p.vx * s + p.vy * c];
    if (!p.fallen && p.h === 0) p.vh = Math.min(25, rel * 0.12 * (0.3 + p.char.bounce));
  }

  m.events.push({ type: 'hit', strength: Math.min(1, rel / 60), x: a.x + nx * a.char.radius, y: a.y + ny * a.char.radius });
  tryTopple(m, b, rel * Math.sqrt(ma / mb), Math.atan2(ny, nx));
  tryTopple(m, a, rel * Math.sqrt(mb / ma), Math.atan2(-ny, -nx));
}

function tryTopple(m: Match, p: Piece, impact: number, dir: number) {
  if (p.fallen || p.owner === m.turn) return; // the attacker's own pieces never fall
  if (impact < p.char.stability) return;
  p.fallen = true;
  p.fallDir = dir;
  m.events.push({ type: 'topple', x: p.x, y: p.y, color: p.char.color });
}

function animateFalls(m: Match, dt: number) {
  for (const p of m.pieces) {
    if (p.fallen) p.fallT = Math.min(1, p.fallT + dt * 5);
    if (p.out) p.outT = Math.min(1, p.outT + dt * 2.5);
  }
}

function allStill(m: Match): boolean {
  return m.pieces.every(
    (p) => (p.out && p.outT >= 1) || (Math.hypot(p.vx, p.vy) < 0.5 && p.h === 0 && (!p.fallen || p.fallT >= 1)),
  );
}

function resolve(m: Match) {
  const att = m.turn;
  const def: Owner = att === 0 ? 1 : 0;
  const flicker = getPiece(m, m.flicker);
  const captured = m.pieces.filter((p) => p.owner === def && (p.fallen || p.out));

  for (const p of captured) p.owner = att;
  let lost = false;
  if (flicker) {
    if (captured.length === 0 && m.missRule === 'perde') {
      lost = true;
      m.pieces = m.pieces.filter((p) => p.id !== flicker.id);
    }
  }
  for (const p of m.pieces) {
    p.vx = p.vy = 0;
    p.vh = 0;
    p.h = 0;
    // Keep the flip angle small so standing back up looks natural.
    p.roll = ((((p.roll + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    p.fallen = false;
    p.out = false;
    p.outT = 0;
    // Pieces that fell off the table come back from the edge they left.
    p.x = clamp(p.x, 0, m.W);
    p.y = clamp(p.y, 0, m.L);
  }

  const name = m.names[att];
  if (captured.length > 0) {
    m.lastResult = `${name} derrubou ${captured.length}!`;
    m.events.push({ type: 'capture', count: captured.length, by: att, charId: flicker?.char.id ?? '' });
  } else {
    m.lastResult = lost ? 'Errou! Perdeu o boneco.' : 'Errou! Volta pra fila.';
    m.events.push({ type: 'miss', lost });
  }
  m.flicker = null;

  const defLeft = teamPieces(m, def).length;
  const attLeft = teamPieces(m, att).length;
  if (defLeft === 0 || attLeft === 0) {
    m.winner = defLeft === 0 ? att : def;
    arrange(m);
    m.phase = 'over';
    m.events.push({ type: 'win', winner: m.winner });
    return;
  }
  m.turn = def;
  arrange(m);
  m.events.push({ type: 'turn', turn: m.turn });
}

/** Called each frame while the match is over so the pieces still walk into place. */
export function stepOver(m: Match, dt: number) {
  const k = 1 - Math.exp(-dt * 9);
  for (const p of m.pieces) {
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
  }
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
