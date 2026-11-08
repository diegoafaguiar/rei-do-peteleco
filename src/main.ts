import './style.css';
import QRCode from 'qrcode';
import { sfx, setSound } from './audio';
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
import { portrait } from './figures/sprites';
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
  toast(`Fase ${n}: ${lv.name}`);
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
  toast(`Vez de ${match.names[0]}!`);
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
  hideScreen();
  hud.hidden = false;
  updateHud();
}

function leaveMatch() {
  match = null;
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
        sfx.flick(ev.power);
        fx.puff(ev.x, ev.y, 6);
        break;
      case 'hit':
        sfx.hit(ev.strength);
        if (ev.strength > 0.25 && now - lastWord > 350) {
          fx.word(ev.x, ev.y);
          fx.shake = Math.min(1, 0.3 + ev.strength);
          lastWord = now;
        }
        break;
      case 'topple':
        sfx.topple();
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
        hudDirty = true;
        break;
      case 'miss':
        sfx.miss();
        toast(m.lastResult, 'bad');
        hudDirty = true;
        break;
      case 'turn':
        hudDirty = true;
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
      <button class="tool" id="btnView">${renderer.kind === '2d' ? '3D' : '2D'}</button>
      <button class="tool" id="btnPause">II</button>
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

// ---------- Screens ----------

function showScreen(html: string, cls = '') {
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
       <button class="small" id="goPhone">Jogar no celular</button>
       <button class="small" id="goSettings">Ajustes</button>
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
         <b>${lv.n}</b><span>${open ? lv.name : 'Bloqueada'}</span>${done ? '<i>★</i>' : ''}
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
     <button class="small danger" id="reset">Apagar progresso</button>
     <button class="back" id="back">Voltar</button>`,
  );
  bindMissRule(showSettings);
  on('v2d', () => void setView('2d').then(showSettings));
  on('v3d', () => void setView('3d').then(showSettings));
  const sound = (v: boolean) => {
    data.sound = v;
    setSound(v);
    save(data);
    showSettings();
  };
  on('sOn', () => sound(true));
  on('sOff', () => sound(false));
  on('reset', () => {
    if (confirm('Apagar todas as fases vencidas e personagens desbloqueados?')) {
      data.beaten = 0;
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
    if (won) {
      sfx.win();
      fx.celebrate();
      const before = data.beaten;
      data.beaten = Math.max(data.beaten, level);
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
       <p class="sub">${won ? 'Você derrubou todos os bonecos do computador.' : 'O computador derrubou todos os seus bonecos.'}</p>
       ${unlockedHtml}
       ${won && !last ? '<button class="big" id="next">Próxima fase</button>' : ''}
       <button class="${won ? 'small' : 'big'}" id="again">${won ? 'Jogar de novo' : 'Tentar de novo'}</button>
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
       <button class="big" id="again">Revanche</button>
       <button class="back" id="menu">Menu</button>`,
      'win',
    );
    on('again', startDuel);
  }
  on('menu', leaveMatch);
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// ---------- Start ----------

if (data.view === '3d') void setView('3d');
showHome();
requestAnimationFrame(frame);
