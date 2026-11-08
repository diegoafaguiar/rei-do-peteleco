import type { Match, Owner } from '../game/sim';

export interface AimView {
  x: number; // flick spot (world)
  y: number;
  dx: number; // flick direction (world, normalized)
  dy: number;
  power: number; // 0..1
  pullX: number; // finger position (world), for the rubber band
  pullY: number;
}

export interface Renderer {
  readonly kind: '2d' | '3d';
  mount(el: HTMLElement): void;
  unmount(): void;
  /** viewOwner: whose side is closest to the screen. */
  render(m: Match, aim: AimView | null, viewOwner: Owner, dt: number): void;
  screenToWorld(sx: number, sy: number): { x: number; y: number } | null;
  /** h: height above the table, in world units. */
  worldToScreen(x: number, y: number, h?: number): { x: number; y: number };
  /** Rough size of one world unit on screen near (x, y). */
  pxPerUnit(x: number, y: number): number;
  readonly canvas: HTMLCanvasElement;
}

/** Space at the top of the screen covered by the scoreboard. */
export const HUD_TOP = 74;
