// Tiny synthesized sound effects (no audio files needed).

let ctx: AudioContext | null = null;
export let soundOn = true;

export function setSound(on: boolean) {
  soundOn = on;
}

function ac(): AudioContext | null {
  if (!soundOn) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  unlock: () => ac(),
  flick: (power: number) => tone(500 + power * 500, 0.12, 'triangle', 0.25, 160),
  hit: (strength: number) => tone(180 + strength * 200, 0.08, 'square', 0.12 + strength * 0.15, 90),
  topple: () => tone(320, 0.25, 'sawtooth', 0.12, 80),
  off: () => tone(400, 0.4, 'sine', 0.15, 60),
  capture: (n: number) => {
    for (let i = 0; i < Math.min(5, n) + 1; i++) tone(520 + i * 120, 0.15, 'triangle', 0.18, undefined, i * 0.09);
  },
  miss: () => tone(260, 0.3, 'sine', 0.15, 140),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.22, undefined, i * 0.15)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sine', 0.2, undefined, i * 0.2)),
  click: () => tone(700, 0.05, 'triangle', 0.12),
};
