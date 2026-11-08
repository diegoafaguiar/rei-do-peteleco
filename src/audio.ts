// Tiny synthesized sound effects (no audio files needed).

let ctx: AudioContext | null = null;
export let soundOn = true;

export function setSound(on: boolean) {
  soundOn = on;
  if (!ctx) return;
  if (on) void ctx.resume();
  else void ctx.suspend();
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
  bump: () => tone(140 + Math.random() * 60, 0.05, 'triangle', 0.07, 90),
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

// ---------- Background music ----------
// A gentle, looping tune made from a few synthesized notes: a bouncy bass and a marimba-like melody.

const BPM = 112;
const STEP = 60 / BPM / 2; // eighth notes
// Two bars per chord, C - Am - F - G, notes as semitones from C4.
const CHORDS = [
  [0, 4, 7],
  [-3, 0, 4],
  [-7, -3, 0],
  [-5, -1, 2],
];
// Melody as chord-tone indexes (0-2 = chord, 3-5 = one octave up), -1 = rest. Always in tune with the chord.
const MELODY = [3, -1, 4, 5, 4, 3, 1, -1, 5, -1, 4, 3, 2, -1, 1, -1];

let musicOn = false;
let musicGain: GainNode | null = null;
let nextTime = 0;
let stepIndex = 0;
let timer = 0;

const freq = (semi: number) => 261.63 * Math.pow(2, semi / 12);

function note(a: AudioContext, dest: AudioNode, f: number, t: number, dur: number, type: OscillatorType, vol: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function schedule() {
  if (!musicOn || !ctx || !musicGain) return;
  while (nextTime < ctx.currentTime + 0.3) {
    const bar = Math.floor(stepIndex / 16) % CHORDS.length;
    const chord = CHORDS[bar];
    const s = stepIndex % 16;
    if (s % 4 === 0) note(ctx, musicGain, freq(chord[0] - 12), nextTime, STEP * 1.6, 'triangle', 0.5);
    if (s % 4 === 2) note(ctx, musicGain, freq(chord[2] - 12), nextTime, STEP * 1.2, 'triangle', 0.3);
    const m = MELODY[s];
    if (m >= 0) {
      const semi = chord[m % 3] + 12 * Math.floor(m / 3);
      note(ctx, musicGain, freq(semi), nextTime, STEP * 1.8, 'sine', 0.35);
      note(ctx, musicGain, freq(semi + 12), nextTime, STEP * 0.6, 'sine', 0.08); // marimba "tick"
    }
    nextTime += STEP;
    stepIndex++;
  }
}

export function setMusic(on: boolean) {
  musicOn = on;
  if (!on) {
    clearInterval(timer);
    timer = 0;
    if (musicGain && ctx) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    return;
  }
  const a = ac();
  if (!a) return;
  if (!musicGain) {
    musicGain = a.createGain();
    musicGain.connect(a.destination);
  }
  musicGain.gain.setTargetAtTime(0.09, a.currentTime, 0.4);
  nextTime = Math.max(nextTime, a.currentTime + 0.05);
  if (!timer) timer = window.setInterval(schedule, 100);
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else if (soundOn) void ctx.resume();
});
