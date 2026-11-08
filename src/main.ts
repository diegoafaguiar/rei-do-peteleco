import './style.css';
import QRCode from 'qrcode';
import { sfx, setMusic, setSound } from './audio';
import { planCpuShot, runCpuShot, type CpuPlan } from './game/ai';
import { boosted, levelOf, levelProgress, statsOf, MAX_LEVEL } from './game/evolve';
import { LEVELS, DUEL_LENGTH } from './game/levels';
import { PACKS, getPack, isUnlocked, teamOf, type CharDef, type Pack } from './game/packs';
import {
  createMatch,
  flick,
  forward,
  getPiece,
  launchY,
  selectPiece,
  setLaunchX,
  step,
  stepOver,
  teamPieces,
  type Match,
  type Owner,
} from './game/sim';
import { getSprite, portrait } from './figures/sprites';
import { Fx } from './render/fx';
import { Renderer2D } from './render/render2d';
import type { AimView, Renderer } from './render/types';
import { load, save } from './storage';

const data = load();
setSound(data.sound);

const stage = document.getElementById('stage')!;
const hud = document.getElementById('hud')!;
const screen = document.getElementById('screen')!;
const toastEl = document.getElementById('toast')!;
const bannerEl = document.getElementById('banner')!;
const fx = new Fx();
document.getElementById('app')!.insertBefore(fx.canvas, hud);

// ---------- Rendering ----------

const r2d = new Renderer2D();
let r3d: Renderer | null = null;
let renderer: Renderer = r2d;
renderer.mount(stage);

async function setView(kind: '2d' | '3d') {
  if (kind === renderer.kind) return;
  if (kind === '3d' && !r3d) {
    try {
      const mod = await import('./render/render3d');
      r3d = new mod.Renderer3D();
    } catch (err) {
      console.error(err);
      toast('O 3D não funciona neste aparelho.');
      return;
    }
  }
  renderer.unmount();
  renderer = kind === '3d' ? r3d! : r2d;
  renderer.mount(stage);
  data.view = kind;
  save(data);
  updateHud();
}

// ---------- Match state ----------

let match: Match | null = null;
let level = 0; // 0 = duel
let viewOwner: Owner = 0;
let cpuWait = 0;
let cpuPlan: CpuPlan | null = null;
let overShown = false;
let overTimer = 0;
let paused = false;
// Numbers for the end-of-match screen.
let stats = { shots: [0, 0], knocked: [0, 0], best: 0 };

interface AimDrag {
  pointerId: number;
  kind: 'aim' | 'slide';
  sx: number;
  sy: number;
}
let drag: AimDrag | null = null;
let aim: AimView | null = null;

// ---------- Teams and evolution ----------

function xpOf(id: string) {
  return data.xp[id] ?? 0;
}

function chosenIds(packId: string): string[] {
  const pack = getPack(packId);
  const saved = (data.teams[packId] ?? []).filter((id) => pack.chars.some((c) => c.id === id));
  return saved.length ? saved : pack.chars.slice(0, 5).map((c) => c.id);
}

/** Your 5 pieces: the characters you picked (repeated if fewer than 5), with their level bonuses. */
function myTeam(packId: string): CharDef[] {
  const pack = getPack(packId);
  const chars = chosenIds(packId).map((id) => pack.chars.find((c) => c.id === id)!);
  return Array.from({ length: 5 }, (_, i) => {
    const ch = chars[i % chars.length];
    return boosted(ch, levelOf(xpOf(ch.id)));
  });
}

function gainXp(charId: string, amount: number) {
  const before = levelOf(xpOf(charId));
  data.xp[charId] = xpOf(charId) + amount;
  save(data);
  const after = levelOf(xpOf(charId));
  if (after > before) {
    const ch = PACKS.flatMap((p) => p.chars).find((c) => c.id === charId);
    if (ch) {
      window.setTimeout(() => {
        toast(`${ch.name} evoluiu! Nível ${after}`, 'good');
        sfx.win();
      }, 1400);
    }
  }
}

function startSolo(n: number) {
  const lv = LEVELS[n - 1];
  level = n;
  match = createMatch({
    mode: 'solo',
    level: n,
    length: lv.length,
    teams: [myTeam(data.soloPack), teamOf(getPack(lv.cpuPack))],
    names: ['Você', 'Computador'],
    cpu: [false, true],
    missRule: data.missRule,
    guide: lv.guide,
  });
  beginMatch();
  banner(`Fase ${n}`, lv.name, 'level');
  later(() => turnBanner(match), 1500);
}

function startDuel() {
  level = 0;
  match = createMatch({
    mode: 'duel',
    length: DUEL_LENGTH,
    teams: [myTeam(data.duelPacks[0]), myTeam(data.duelPacks[1])],
    names: [data.names[0] || 'Jogador 1', data.names[1] || 'Jogador 2'],
    cpu: [false, false],
    missRule: data.missRule,
    guide: 0.6,
  });
  beginMatch();
  banner('Duelo!', `${match.names[0]} contra ${match.names[1]}`, 'level');
  later(() => turnBanner(match), 1500);
}

function beginMatch() {
  viewOwner = 0;
  overShown = false;
  overTimer = 0;
  paused = false;
  cpuWait = 0;
  cpuPlan = null;
  aim = null;
  drag = null;
  fx.clear();
  stats = { shots: [0, 0], knocked: [0, 0], best: 0 };
  clearLater();
  hideScreen();
  hud.hidden = false;
  updateHud();
}

function leaveMatch() {
  match = null;
  clearLater();
  bannerEl.className = '';
  hud.hidden = true;
  showHome();
}

// ---------- Input ----------

function localPoint(e: PointerEvent) {
  const rect = renderer.canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function humanTurn(m: Match) {
  return m.phase === 'aim' && !m.cpu[m.turn] && !paused;
}

stage.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  const m = match;
  if (!m || !humanTurn(m) || drag) return;
  const pt = localPoint(e);
  const sel = getPiece(m, m.selected);

  // 1) Grab the piece on the flick spot to aim.
  if (sel) {
    const sp = renderer.worldToScreen(sel.tx, sel.ty);
    const edge = renderer.worldToScreen(sel.tx + sel.char.radius, sel.ty);
    const rPx = Math.hypot(edge.x - sp.x, edge.y - sp.y);
    if (Math.hypot(pt.x - sp.x, pt.y - sp.y) < Math.max(48, rPx * 2)) {
      drag = { pointerId: e.pointerId, kind: 'aim', sx: pt.x, sy: pt.y };
      stage.setPointerCapture(e.pointerId);
      return;
    }
  }

  // 2) Tap another piece of your team to use it instead.
  let best: { id: number; d: number } | null = null;
  for (const p of teamPieces(m, m.turn)) {
    if (p.id === m.selected) continue;
    const sp = renderer.worldToScreen(p.x, p.y);
    const d = Math.hypot(pt.x - sp.x, pt.y - sp.y);
    if (d < 36 && (!best || d < best.d)) best = { id: p.id, d };
  }
  if (best) {
    selectPiece(m, best.id);
    sfx.click();
    return;
  }

  // 3) Touch near your flick line to slide the piece sideways.
  const w = renderer.screenToWorld(pt.x, pt.y);
  if (w && Math.abs(w.y - launchY(m, m.turn)) < 14) {
    drag = { pointerId: e.pointerId, kind: 'slide', sx: pt.x, sy: pt.y };
    stage.setPointerCapture(e.pointerId);
    setLaunchX(m, w.x);
  }
});

stage.addEventListener('pointermove', (e) => {
  const m = match;
  if (!m || !drag || e.pointerId !== drag.pointerId) return;
  const pt = localPoint(e);
  if (drag.kind === 'slide') {
    const w = renderer.screenToWorld(pt.x, pt.y);
    if (w) setLaunchX(m, w.x);
    return;
  }
  aim = computeAim(m, pt.x, pt.y);
});

function endDrag(e: PointerEvent) {
  const m = match;
  if (!drag || e.pointerId !== drag.pointerId) return;
  const wasAim = drag.kind === 'aim';
  drag = null;
  if (m && wasAim && aim && aim.power > 0.05 && humanTurn(m)) {
    flick(m, aim.dx, aim.dy, aim.power);
  }
  aim = null;
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', (e) => {
  if (drag && e.pointerId === drag.pointerId) {
    drag = null;
    aim = null;
  }
});

function computeAim(m: Match, px: number, py: number): AimView | null {
  const sel = getPiece(m, m.selected);
  if (!sel) return null;
  const sp = renderer.worldToScreen(sel.tx, sel.ty);
  const pullPx = Math.hypot(px - sp.x, py - sp.y);
  if (pullPx < 12) return null;
  const finger = renderer.screenToWorld(px, py);
  if (!finger) return aim;
  let dx = sel.tx - finger.x;
  let dy = sel.ty - finger.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  // Must point toward the other side of the table.
  if (dy * forward(m.turn) < 0.12) return null;
  const c = renderer.canvas;
  const power = Math.min(1, pullPx / (0.32 * Math.min(c.clientWidth, c.clientHeight)));
  return { x: sel.tx, y: sel.ty, dx, dy, power, pullX: finger.x, pullY: finger.y };
}

// ---------- Main loop ----------

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  const m = match;
  if (m && !paused) {
    if (m.phase === 'over') stepOver(m, dt);
    else step(m, dt);
    runCpu(m, dt);
    handleEvents(m);
    if (m.phase === 'aim') viewOwner = m.mode === 'duel' ? m.turn : 0;
    if (m.phase === 'over' && !overShown) {
      overTimer += dt;
      if (overTimer > 1.3) showResult(m);
    }
  }
  const shown = m ?? idle;
  if (m) {
    const showAim = m.phase === 'aim' ? aim : null;
    renderer.render(m, showAim, viewOwner, dt);
  } else {
    renderIdle(dt);
  }
  fx.update(dt);
  if (shown) fx.draw((x, y, h) => renderer.worldToScreen(x, y, h), renderer.pxPerUnit(shown.W / 2, shown.L / 2));
  stage.style.transform = fx.shake > 0 ? `translate(${(Math.random() - 0.5) * fx.shake * 14}px, ${(Math.random() - 0.5) * fx.shake * 14}px)` : '';
  requestAnimationFrame(frame);
}

// A demo table behind the menus.
let idle: Match | null = null;
let idleTimer = 0;
function renderIdle(dt: number) {
  if (!idle || idle.phase === 'over') {
    idle = createMatch({
      mode: 'duel',
      length: 90,
      teams: [teamOf(PACKS[0]), teamOf(PACKS[1])],
      names: ['A', 'B'],
      cpu: [true, true],
      missRule: 'volta',
      guide: 0,
    });
  }
  idleTimer += dt;
  if (idle.phase === 'over') stepOver(idle, dt);
  else step(idle, dt);
  if (idle.phase === 'aim') {
    if (idleTimer > 1.5) {
      const plan = planCpuShot(idle, 5);
      if (plan) runCpuShot(idle, plan);
      idleTimer = 0;
    }
  }
  idle.events.length = 0;
  renderer.render(idle, null, 0, dt);
}

function runCpu(m: Match, dt: number) {
  if (m.phase !== 'aim' || !m.cpu[m.turn]) {
    cpuWait = 0;
    cpuPlan = null;
    return;
  }
  cpuWait += dt;
  if (cpuWait > 0.9 && !cpuPlan) {
    cpuPlan = planCpuShot(m, LEVELS[level - 1]?.cpuAngleError ?? 4);
    if (cpuPlan) setLaunchX(m, cpuPlan.launchX);
  }
  if (cpuPlan) {
    // Show the computer "pulling back" before it flicks.
    const t = Math.min(1, (cpuWait - 0.9) / 0.8);
    const sel = getPiece(m, m.selected);
    if (sel) {
      aim = {
        x: sel.tx,
        y: sel.ty,
        dx: cpuPlan.dx,
        dy: cpuPlan.dy,
        power: cpuPlan.power * t,
        pullX: sel.tx - cpuPlan.dx * 12 * t,
        pullY: sel.ty - cpuPlan.dy * 12 * t,
      };
    }
    if (t >= 1) {
      runCpuShot(m, cpuPlan);
      cpuPlan = null;
      aim = null;
    }
  }
}

let lastWord = 0;
function handleEvents(m: Match) {
  let hudDirty = false;
  const now = performance.now();
  for (const ev of m.events) {
    switch (ev.type) {
      case 'flick':
        stats.shots[m.turn]++;
        sfx.flick(ev.power);
        fx.puff(ev.x, ev.y, 6);
        break;
      case 'hit':
        sfx.hit(ev.strength);
        if (ev.strength > 0.25 && now - lastWord > 350) {
          fx.word(ev.x, ev.y);
          fx.shake = Math.min(1, 0.3 + ev.strength);
          buzz(12);
          lastWord = now;
        }
        break;
      case 'topple':
        sfx.topple();
        buzz(25);
        fx.burst(ev.x, ev.y, ev.color, 12);
        break;
      case 'bump':
        sfx.bump();
        fx.puff(ev.x, ev.y, 2);
        break;
      case 'offTable':
        sfx.off();
        fx.puff(ev.x, ev.y, 4);
        break;
      case 'capture':
        sfx.capture(ev.count);
        toast(m.lastResult, 'good');
        // In solo only your pieces learn; in a duel both players share this device's collection.
        if (ev.charId && (m.mode === 'duel' || ev.by === 0)) gainXp(ev.charId, ev.count);
        stats.knocked[ev.by] += ev.count;
        stats.best = Math.max(stats.best, ev.count);
        hudDirty = true;
        break;
      case 'miss':
        sfx.miss();
        toast(m.lastResult, 'bad');
        hudDirty = true;
        break;
      case 'turn':
        hudDirty = true;
        later(() => turnBanner(m), 900);
        break;
      case 'win':
        hudDirty = true;
        break;
    }
  }
  m.events.length = 0;
  if (hudDirty) updateHud();
}

// ---------- HUD ----------

function updateHud() {
  const m = match;
  if (!m) return;
  const chip = (o: Owner) => {
    const active = m.turn === o && m.phase !== 'over';
    const team = teamPieces(m, o);
    const faces = team
      .slice(0, 10)
      .map((p) => `<img src="${portrait(p.char)}" alt="" />`)
      .join('');
    return `<div class="chip team${o} ${active ? 'active' : ''}">
      <div class="top"><span class="name">${esc(m.names[o])}</span><span class="count">${team.length}</span></div>
      <div class="faces">${faces}</div>
    </div>`;
  };
  const title = m.mode === 'solo' ? `Fase ${level}` : 'Duelo';
  hud.innerHTML = `
    <div class="bar">
      ${chip(0)}
      <div class="mid">${title}</div>
      ${chip(1)}
    </div>
    <div class="tools">
      <button class="tool" id="btnView" aria-label="Trocar visão">${renderer.kind === '2d' ? ICON.cube : ICON.flat}<small>${renderer.kind === '2d' ? '3D' : '2D'}</small></button>
      <button class="tool" id="btnPause" aria-label="Pausa">${ICON.pause}</button>
    </div>
    <div class="hint">${hintText(m)}</div>`;
  hud.querySelector('#btnView')!.addEventListener('click', () => {
    sfx.click();
    void setView(renderer.kind === '2d' ? '3d' : '2d');
  });
  hud.querySelector('#btnPause')!.addEventListener('click', () => {
    sfx.click();
    showPause();
  });
}

function hintText(m: Match) {
  if (m.phase === 'over') return '';
  if (m.cpu[m.turn]) return 'O computador está mirando...';
  return `<b>${esc(m.names[m.turn])}</b>: puxe para trás e solte!`;
}

let toastTimer = 0;
function toast(text: string, kind: 'good' | 'bad' | '' = '') {
  toastEl.textContent = text;
  toastEl.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.className = ''), 1800);
}

/** Big ribbon that slides across the screen. */
function banner(title: string, sub = '', kind = '') {
  bannerEl.innerHTML = `<div class="ribbon"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  bannerEl.className = '';
  void bannerEl.offsetWidth; // restart the animation
  bannerEl.className = `show ${kind}`;
}

function turnBanner(m: Match | null) {
  if (!m || m !== match || m.phase === 'over') return;
  if (m.mode === 'solo') {
    if (m.turn === 0) banner('Sua vez!', 'Puxe o boneco e solte', 'team0');
    else banner('Vez do computador', '', 'team1');
  } else {
    banner(`Vez de ${m.names[m.turn]}`, '', `team${m.turn}`);
  }
}

const timers: number[] = [];
function later(fn: () => void, ms: number) {
  timers.push(window.setTimeout(fn, ms));
}
function clearLater() {
  while (timers.length) clearTimeout(timers.pop());
}

function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

function starsHtml(n: number, max = 3) {
  return Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('');
}

// ---------- Screens ----------

function showScreen(html: string, cls = '') {
  bannerEl.className = ''; // a menu always covers the ribbon
  clearLater();
  screen.innerHTML = `<div class="panel ${cls}">${html}</div>`;
  screen.hidden = false;
}

function hideScreen() {
  screen.hidden = true;
  screen.innerHTML = '';
}

function on(id: string, fn: () => void) {
  const el = screen.querySelector(`#${id}`);
  el?.addEventListener('click', () => {
    sfx.click();
    fn();
  });
}

function showHome() {
  hud.hidden = true;
  showScreen(
    `<div class="heroes">${heroes()}</div>
     <h1 class="logo"><span class="l1">Rei do</span><span class="l2">Peteleco</span></h1>
     <button class="big" id="goSolo">${ICON.play}Fases</button>
     <button class="big alt" id="goDuel">${ICON.duel}Duelo</button>
     <button class="big gold" id="goChars">${ICON.star}Personagens</button>
     <div class="row">
       <button class="small" id="goPhone">${ICON.phone}Celular</button>
       <button class="small" id="goSettings">${ICON.gear}Ajustes</button>
     </div>`,
    'home',
  );
  on('goSolo', showLevels);
  on('goDuel', showDuelSetup);
  on('goChars', showCollection);
  on('goPhone', showPhone);
  on('goSettings', showSettings);
}

const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>',
  duel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 4l10 10M14 18l4-4M16 20l4-4M4 20l6-6M20 4L10 14M6 14l4 4"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
  flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 12h16"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5.5v13a1 1 0 0 0 1.5.9L15 13.9V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.1L6.5 4.6A1 1 0 0 0 5 5.5z"/></svg>',
};

function heroes() {
  const unlocked = PACKS.filter((p) => isUnlocked(p, data.beaten));
  const picks = [unlocked[0].chars[0], PACKS[2].chars[0], unlocked[0].chars[3], PACKS[1].chars[0], unlocked[0].chars[1]];
  return picks.map((c, i) => `<img src="${portrait(c)}" alt="" style="animation-delay:${i * 0.15}s" />`).join('');
}

function packPicker(selected: string, name: string) {
  return `<div class="packs">${PACKS.map((p) => {
    const ok = isUnlocked(p, data.beaten);
    return `<button class="pack ${p.id === selected ? 'sel' : ''}" data-pack="${p.id}" data-group="${name}" ${ok ? '' : 'disabled'}>
      <img src="${portrait(p.chars[0])}" alt="" />
      <span>${ok ? p.name : `Fase ${p.unlockLevel}`}</span>
    </button>`;
  }).join('')}</div>`;
}

function bindPackPicker(name: string, onPick: (id: string) => void) {
  // Keep the chosen pack visible in the sideways list.
  const sel = screen.querySelector<HTMLElement>(`.pack.sel[data-group="${name}"]`);
  if (sel?.parentElement) sel.parentElement.scrollLeft = sel.offsetLeft - sel.parentElement.offsetLeft - 8;
  screen.querySelectorAll<HTMLButtonElement>(`.pack[data-group="${name}"]`).forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      onPick(b.dataset.pack!);
    }),
  );
}

function showLevels() {
  const next = Math.min(LEVELS.length, data.beaten + 1);
  showScreen(
    `<h2>Fases</h2>
     <p class="sub">Escolha o pacote e toque nos bonecos do seu time:</p>
     ${packPicker(data.soloPack, 'solo')}
     ${teamPicker(data.soloPack, 'solo')}
     <div class="levels">${LEVELS.map((lv) => {
       const open = lv.n <= next;
       const done = lv.n <= data.beaten;
       return `<button class="level ${done ? 'done' : ''}" data-level="${lv.n}" ${open ? '' : 'disabled'}>
         <img src="${portrait(getPack(lv.cpuPack).chars[(lv.n - 1) % 5])}" alt="" />
         <b>${lv.n}</b><span>${open ? lv.name : 'Bloqueada'}</span>${done ? `<div class="lstars">${starsHtml(data.stars[lv.n] ?? 1)}</div>` : ''}
       </button>`;
     }).join('')}</div>
     <button class="back" id="back">Voltar</button>`,
  );
  bindPackPicker('solo', (id) => {
    data.soloPack = id;
    save(data);
    showLevels();
  });
  bindTeamPicker('solo', showLevels);
  screen.querySelectorAll<HTMLButtonElement>('.level').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      startSolo(Number(b.dataset.level));
    }),
  );
  on('back', showHome);
}

function showDuelSetup() {
  const side = (o: 0 | 1) => `
    <div class="side team${o}">
      <input id="name${o}" maxlength="14" value="${esc(data.names[o])}" aria-label="Nome do jogador ${o + 1}" />
      ${packPicker(data.duelPacks[o], `duel${o}`)}
      ${teamPicker(data.duelPacks[o], `duel${o}`)}
    </div>`;
  showScreen(
    `<h2>Duelo</h2>
     <p class="sub">Dois jogadores no mesmo aparelho, um de cada lado da mesa.</p>
     ${side(0)}
     <div class="vs">contra</div>
     ${side(1)}
     ${missRulePicker()}
     <button class="big" id="start">${ICON.play}Começar!</button>
     <button class="back" id="back">Voltar</button>`,
    'wide',
  );
  const keepNames = () => {
    for (const o of [0, 1] as const) {
      const v = (screen.querySelector(`#name${o}`) as HTMLInputElement).value.trim();
      data.names[o] = v || `Jogador ${o + 1}`;
    }
    save(data);
  };
  for (const o of [0, 1] as const) {
    bindPackPicker(`duel${o}`, (id) => {
      keepNames();
      data.duelPacks[o] = id;
      save(data);
      showDuelSetup();
    });
    bindTeamPicker(`duel${o}`, () => {
      keepNames();
      showDuelSetup();
    });
  }
  bindMissRule(() => {
    keepNames();
    showDuelSetup();
  });
  on('start', () => {
    keepNames();
    startDuel();
  });
  on('back', () => {
    keepNames();
    showHome();
  });
}

function levelBadge(id: string) {
  const lv = levelOf(xpOf(id));
  return `<span class="lv">Nv ${lv}${lv >= MAX_LEVEL ? ' ★' : ''}</span>`;
}

function teamPicker(packId: string, group: string) {
  const pack = getPack(packId);
  const chosen = chosenIds(packId);
  return `<div class="team">${pack.chars
    .map((c) => {
      const on = chosen.includes(c.id);
      return `<button class="mate ${on ? 'on' : ''}" data-mate="${c.id}" data-pack="${pack.id}" data-group="${group}">
        <img src="${portrait(c)}" alt="" />${levelBadge(c.id)}<span>${c.name}</span>
      </button>`;
    })
    .join('')}</div>`;
}

function bindTeamPicker(group: string, after: () => void) {
  screen.querySelectorAll<HTMLButtonElement>(`.mate[data-group="${group}"]`).forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      const packId = b.dataset.pack!;
      const id = b.dataset.mate!;
      let ids = chosenIds(packId);
      if (ids.includes(id)) {
        if (ids.length === 1) return toast('O time precisa de pelo menos 1!');
        ids = ids.filter((x) => x !== id);
      } else {
        if (ids.length >= 5) return toast('Máximo de 5 no time!');
        ids = [...ids, id];
      }
      data.teams[packId] = ids;
      save(data);
      after();
    }),
  );
}

function missRulePicker() {
  return `<div class="rule">
    <p>Quando o peteleco não derruba ninguém:</p>
    <div class="row">
      <button class="opt ${data.missRule === 'volta' ? 'sel' : ''}" data-rule="volta">Volta pra fila</button>
      <button class="opt ${data.missRule === 'perde' ? 'sel' : ''}" data-rule="perde">Perde o boneco</button>
    </div>
  </div>`;
}

function bindMissRule(after: () => void) {
  screen.querySelectorAll<HTMLButtonElement>('[data-rule]').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      data.missRule = b.dataset.rule as 'perde' | 'volta';
      if (match) match.missRule = data.missRule;
      save(data);
      after();
    }),
  );
}

function showCollection() {
  const card = (p: Pack) => {
    const ok = isUnlocked(p, data.beaten);
    return `<section class="coll ${ok ? '' : 'locked'}">
      <h3>${p.name}</h3>
      <p>${ok ? p.desc : `Vença a fase ${p.unlockLevel} para ganhar este pacote.`}</p>
      <div class="chars">${p.chars.map((c) => charCard(c, ok)).join('')}</div>
    </section>`;
  };
  showScreen(`<h2>Personagens</h2>${PACKS.map(card).join('')}<button class="back" id="back">Voltar</button>`, 'wide');
  on('back', showHome);
}

function charCard(c: CharDef, unlocked: boolean) {
  if (!unlocked) return `<figure><img src="${portrait(c)}" alt="" /><figcaption>???</figcaption></figure>`;
  const xp = xpOf(c.id);
  const lv = levelOf(xp);
  const stats = statsOf(boosted(c, lv))
    .map(
      (st) => `<div class="stat"><span>${st.label}</span><i>${'<b></b>'.repeat(st.value)}${'<em></em>'.repeat(5 - st.value)}</i></div>`,
    )
    .join('');
  return `<figure class="card">
    ${levelBadge(c.id)}
    <img src="${portrait(c)}" alt="" />
    <figcaption>${c.name}</figcaption>
    <div class="xp"><div style="width:${Math.round(levelProgress(xp) * 100)}%"></div></div>
    ${stats}
  </figure>`;
}

async function showPhone() {
  let url = location.href.split('#')[0];
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (local && __LAN_IP__) url = url.replace(location.hostname, __LAN_IP__);
  showScreen(
    `<h2>Jogar no celular</h2>
     <p class="sub">Aponte a câmera do celular para o código.</p>
     <div class="qr"><img id="qr" alt="QR code" /></div>
     <p class="url">${esc(url)}</p>
     <p class="note">O celular precisa estar no mesmo Wi-Fi que este computador.
     No celular, use "Adicionar à tela de início" para abrir como um app.</p>
     <button class="back" id="back">Voltar</button>`,
  );
  on('back', showHome);
  try {
    const img = screen.querySelector('#qr') as HTMLImageElement;
    img.src = await QRCode.toDataURL(url, { width: 280, margin: 1 });
  } catch (err) {
    console.error(err);
  }
}

function showSettings() {
  showScreen(
    `<h2>Ajustes</h2>
     ${missRulePicker()}
     <div class="rule"><p>Visão da mesa:</p><div class="row">
       <button class="opt ${renderer.kind === '2d' ? 'sel' : ''}" id="v2d">2D (de cima)</button>
       <button class="opt ${renderer.kind === '3d' ? 'sel' : ''}" id="v3d">3D</button>
     </div></div>
     <div class="rule"><p>Som:</p><div class="row">
       <button class="opt ${data.sound ? 'sel' : ''}" id="sOn">Ligado</button>
       <button class="opt ${data.sound ? '' : 'sel'}" id="sOff">Desligado</button>
     </div></div>
     <div class="rule"><p>Música:</p><div class="row">
       <button class="opt ${data.music ? 'sel' : ''}" id="mOn">Ligada</button>
       <button class="opt ${data.music ? '' : 'sel'}" id="mOff">Desligada</button>
     </div></div>
     <button class="small danger" id="reset">Apagar progresso</button>
     <button class="back" id="back">Voltar</button>`,
  );
  bindMissRule(showSettings);
  on('v2d', () => void setView('2d').then(showSettings));
  on('v3d', () => void setView('3d').then(showSettings));
  const sound = (v: boolean) => {
    data.sound = v;
    setSound(v);
    setMusic(v && data.music);
    save(data);
    showSettings();
  };
  on('sOn', () => sound(true));
  on('sOff', () => sound(false));
  const music = (v: boolean) => {
    data.music = v;
    setMusic(v);
    save(data);
    showSettings();
  };
  on('mOn', () => music(true));
  on('mOff', () => music(false));
  on('reset', () => {
    if (confirm('Apagar fases vencidas, estrelas, níveis dos bonecos e personagens desbloqueados?')) {
      data.beaten = 0;
      data.stars = {};
      data.xp = {};
      data.teams = {};
      data.soloPack = 'turma';
      data.duelPacks = ['turma', 'turma'];
      save(data);
      toast('Progresso apagado.');
    }
  });
  on('back', showHome);
}

function showPause() {
  if (!match) return;
  paused = true;
  showScreen(
    `<h2>Pausa</h2>
     ${missRulePicker()}
     <button class="big" id="resume">Continuar</button>
     <button class="small" id="restart">Recomeçar</button>
     <button class="back" id="quit">Sair para o menu</button>`,
  );
  bindMissRule(showPause);
  on('resume', () => {
    paused = false;
    hideScreen();
  });
  on('restart', () => (level ? startSolo(level) : startDuel()));
  on('quit', leaveMatch);
}

function showResult(m: Match) {
  overShown = true;
  const w = m.winner!;
  if (m.mode === 'solo') {
    const won = w === 0;
    let unlockedHtml = '';
    // Stars: win with few flicks.
    const shots = stats.shots[0];
    const starCount = shots <= 5 ? 3 : shots <= 9 ? 2 : 1;
    let newBest = false;
    if (won) {
      sfx.win();
      fx.celebrate();
      buzz([40, 60, 40]);
      const before = data.beaten;
      data.beaten = Math.max(data.beaten, level);
      newBest = starCount > (data.stars[level] ?? 0);
      data.stars[level] = Math.max(data.stars[level] ?? 0, starCount);
      save(data);
      const fresh = PACKS.filter((p) => p.unlockLevel > before && p.unlockLevel <= data.beaten);
      if (fresh.length) {
        unlockedHtml = fresh
          .map(
            (p) => `<div class="unlock"><p>Novo pacote desbloqueado!</p><h3>${p.name}</h3>
            <div class="chars">${p.chars.map((c) => `<img src="${portrait(c)}" alt="" />`).join('')}</div></div>`,
          )
          .join('');
      }
    } else {
      sfx.lose();
    }
    const last = level >= LEVELS.length;
    showScreen(
      `<h2>${won ? (last ? 'Você é o Rei do Peteleco!' : `Fase ${level} completa!`) : 'Não foi dessa vez!'}</h2>
       ${won ? `<div class="bigstars">${starsHtml(starCount)}</div>` : ''}
       <p class="sub">${won ? (newBest && starCount < 3 ? 'Recorde! Tente vencer com menos petelecos.' : starCount === 3 ? 'Perfeito!' : 'Vença com menos petelecos para ganhar mais estrelas.') : 'O computador derrubou todos os seus bonecos.'}</p>
       ${matchStats()}
       ${unlockedHtml}
       ${won && !last ? `<button class="big" id="next">${ICON.next}Próxima fase</button>` : ''}
       <button class="${won ? 'small' : 'big'}" id="again">${ICON.replay}${won ? 'Jogar de novo' : 'Tentar de novo'}</button>
       <button class="back" id="menu">Menu</button>`,
      won ? 'win' : '',
    );
    on('next', () => startSolo(level + 1));
    on('again', () => startSolo(level));
  } else {
    sfx.win();
    fx.celebrate();
    showScreen(
      `<h2>${esc(m.names[w])} venceu!</h2>
       <p class="sub">${esc(m.names[w])} é o Rei do Peteleco desta rodada.</p>
       ${matchStats()}
       <button class="big" id="again">${ICON.replay}Revanche</button>
       <button class="back" id="menu">Menu</button>`,
      'win',
    );
    on('again', startDuel);
  }
  on('menu', leaveMatch);
}

function matchStats() {
  const m = match;
  if (!m) return '';
  const cell = (label: string, a: number, b: number) =>
    `<div class="mstat"><b class="t0">${a}</b><span>${label}</span><b class="t1">${b}</b></div>`;
  return `<div class="mstats">
    <div class="mstat head"><b class="t0">${esc(m.names[0])}</b><span></span><b class="t1">${esc(m.names[1])}</b></div>
    ${cell('Petelecos', stats.shots[0], stats.shots[1])}
    ${cell('Derrubados', stats.knocked[0], stats.knocked[1])}
  </div>`;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// ---------- Start ----------

const splash = document.getElementById('splash')!;
const splashBar = document.getElementById('splashBar')!;

/** Draw every character once up front so nothing stutters during play. */
async function boot() {
  const all = PACKS.flatMap((p) => p.chars);
  // A timer (not requestAnimationFrame) so loading also finishes in a background tab.
  const nextFrame = () => new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < all.length; i++) {
    getSprite(all[i], 'front');
    getSprite(all[i], 'back');
    portrait(all[i]);
    splashBar.style.width = `${Math.round(((i + 1) / all.length) * 100)}%`;
    if (i % 2 === 1) await nextFrame();
  }
  try {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* fonts are optional */
  }
  if (data.view === '3d') await setView('3d');
  showHome();
  splash.classList.add('done');
  setTimeout(() => splash.remove(), 600);
}

// Music can only start after the first touch or click.
window.addEventListener(
  'pointerdown',
  () => {
    sfx.unlock();
    if (data.music && data.sound) setMusic(true);
  },
  { once: true },
);

requestAnimationFrame(frame);
void boot();

// Dev-only shortcut for testing end screens: __peteleco.finish(0) in the console.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__peteleco = {
    finish(winner: Owner, shots = 4) {
      if (!match) return;
      match.winner = winner;
      match.phase = 'over';
      stats.shots[0] = shots;
      showResult(match);
    },
  };
}
