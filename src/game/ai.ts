// The computer opponent: picks a target, aims with some error, and flicks.

import { flick, flickSpeed, forward, frictionOf, getPiece, launchY, setLaunchX, teamPieces, type Match, type Owner } from './sim';

function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface CpuPlan {
  launchX: number;
  dx: number;
  dy: number;
  power: number;
}

export function planCpuShot(m: Match, angleErrorDeg: number): CpuPlan | null {
  const me = m.turn;
  const them: Owner = me === 0 ? 1 : 0;
  const flicker = getPiece(m, m.selected);
  const targets = teamPieces(m, them);
  if (!flicker || targets.length === 0) return null;

  const target = targets[Math.floor(Math.random() * targets.length)];
  const lx = Math.max(6, Math.min(m.W - 6, target.x + (Math.random() - 0.5) * 10));
  const ly = launchY(m, me);
  const angle = Math.atan2(target.y - ly, target.x - lx) + (gaussian() * angleErrorDeg * Math.PI) / 180;
  const dist = Math.hypot(target.x - lx, target.y - ly);

  // Arrive fast enough to knock it down, with a margin.
  const arrive = (target.char.stability / Math.sqrt(flicker.char.mass / target.char.mass)) * 1.7 + 8;
  // A bit extra for the speed lost each time it lands while tumbling.
  const v0 = Math.sqrt(arrive * arrive + 2 * frictionOf(flicker.char) * dist) * 1.08;
  const full = flickSpeed(m, flicker.char, 1);
  const power = Math.min(1, (v0 / full) * (1 + gaussian() * 0.06));

  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  if (dy * forward(me) < 0.2) dy = 0.2 * forward(me);
  return { launchX: lx, dx, dy, power };
}

export function runCpuShot(m: Match, plan: CpuPlan) {
  setLaunchX(m, plan.launchX);
  const p = getPiece(m, m.selected);
  if (p) {
    p.x = p.tx;
    p.y = p.ty;
  }
  flick(m, plan.dx, plan.dy, plan.power);
}
