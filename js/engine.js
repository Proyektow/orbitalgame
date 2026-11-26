import { initAudio, playSound, vibrate } from './audio.js';
import { State, saveState, addXP, getOperatorLevel, updateMissionProgress, exportBackupCode, importBackupCode } from './storage.js';

const CURRENT_VERSION = '4.0.2';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#start');
const gameTopBar = document.querySelector('#game-topbar');
const scoreEl = document.querySelector('#score');
const scoreLabelEl = document.querySelector('#score-label');
const multiplierBadge = document.querySelector('#multiplier-badge');
const bestEl = document.querySelector('#best');
const streakEl = document.querySelector('#streak');
const levelEl = document.querySelector('#level');
const statusEl = document.querySelector('#status');
const timerEl = document.querySelector('#timer');
const hudPhotonsEl = document.querySelector('#hud-photons');
const menuPhotonsEl = document.querySelector('#menu-photons');
const shopPhotonsEl = document.querySelector('#shop-photons');
const resultBanner = document.querySelector('#result-banner');
const operatorRankEl = document.querySelector('#operator-rank');
const xpBarFill = document.querySelector('#xp-bar-fill');

const pauseBtn = document.querySelector('#pause-btn');
const pauseModal = document.querySelector('#pause-modal');
const resumeBtn = document.querySelector('#resume-btn');
const quitBtn = document.querySelector('#quit-btn');

const flashEl = document.querySelector('#flash');
const shell = document.querySelector('.game-shell');
const reverseBanner = document.querySelector('#reverse-banner');

// Modales Hub
const shopModal = document.querySelector('#shop-modal');
const missionsModal = document.querySelector('#missions-modal');
const profileModal = document.querySelector('#profile-modal');

// Power-ups HUD
const hudShield = document.querySelector('#hud-shield');
const hudMagnet = document.querySelector('#hud-magnet');
const hudSlow = document.querySelector('#hud-slow');

// ==========================================
// CATALOGO TIENDA
// ==========================================
const SKINS = [
  { id: 'dot', name: 'Punto', price: 0, icon: '●' },
  { id: 'square', name: 'Bloque', price: 60, icon: '■' },
  { id: 'diamond', name: 'Rombo', price: 120, icon: '◆' },
  { id: 'ring', name: 'Aro', price: 200, icon: '◎' },
  { id: 'cross', name: 'Cruz', price: 300, icon: '✚' }
];

const TRAILS = [
  { id: 'solid', name: 'Tinta', price: 0 },
  { id: 'accent', name: 'Bermellón', price: 80 },
  { id: 'dots', name: 'Punteado', price: 150 }
];

const THEMES = [
  { id: 'default', name: 'Papel Claro', price: 0, class: '' },
  { id: 'blueprint', name: 'Plano Azul', price: 120, class: 'theme-blueprint' },
  { id: 'terminal', name: 'Tinta Oscura', price: 220, class: 'theme-terminal' }
];

function getPalette() {
  const styles = getComputedStyle(document.body);
  return {
    bg: styles.getPropertyValue('--bg').trim() || '#f4f4f1',
    cardBg: styles.getPropertyValue('--card-bg').trim() || '#ffffff',
    ink: styles.getPropertyValue('--ink').trim() || '#141414',
    muted: styles.getPropertyValue('--muted').trim() || '#666662',
    borderSoft: styles.getPropertyValue('--border-soft').trim() || '#d5d5d0',
    accent: styles.getPropertyValue('--accent').trim() || '#d9381e'
  };
}

function applyTheme(themeId) {
  document.body.className = '';
  const theme = THEMES.find(t => t.id === themeId);
  if (theme && theme.class) document.body.classList.add(theme.class);
}
applyTheme(State.equippedTheme);

function refreshHubUI() {
  hudPhotonsEl.textContent = State.photons;
  menuPhotonsEl.textContent = `${State.photons} FICHAS`;
  shopPhotonsEl.textContent = State.photons;
  bestEl.textContent = State.best;

  const { lv, pct } = getOperatorLevel();
  operatorRankEl.textContent = `OPERADOR NV. ${String(lv).padStart(2, '0')} · ${State.xp} XP`;
  xpBarFill.style.width = `${pct}%`;
}
refreshHubUI();

// ==========================================
// VARIABLES DE MOTOR
// ==========================================
let selectedMode = 'classic';
let selectedDiff = 'easy';
let activeFilter = 'all';

let w = 0, h = 0, dpr = 1, cx = 0, cy = 0;
let rings = [];
let mode = 'ready'; 
let angle = -Math.PI / 2;
let targetLane = 0;
let currentRadius = 0; 
let score = 0, streak = 0, elapsed = 0, spawnClock = 0, lastTime = 0, shake = 0, level = 1;
let direction = 1;
let reverseTimer = 0;
let trail = [];
let scoreMultiplier = 1;

// Power-ups
let shieldActive = false, magnetTimer = 0, slowTimer = 0;
let objects = [], particles = [], floatTexts = [];

// 03 · Secuencia
let seqTargetAngle = 0, seqArcWidth = 0.72, seqHitsInLevel = 0, seqLocks = [];

// 04 · Vector
let vecY = 0, vecHolding = false, vecObstacles = [];

// 05 · Matriz
let matGridSize = 4, matPattern = [], matSelected = [], matPhase = 'show', matTimer = 0;

// 06 · Equilibrio
let stackBlocks = [], stackCurrent = null, stackDir = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = shell.clientWidth || window.innerWidth;
  h = shell.clientHeight || window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  cx = w / 2;
  cy = h * 0.50;

  const baseOuter = Math.min(w, h) * 0.34;
  rings = (selectedMode === 'evolution' && level >= 3)
    ? [baseOuter, baseOuter * 0.72, baseOuter * 0.46]
    : [baseOuter, baseOuter * 0.65];

  if (currentRadius === 0) currentRadius = rings[0];
}
window.addEventListener('resize', resize);
resize();

function getGeometryType() {
  if (selectedMode !== 'evolution') return 'circle';
  if (selectedDiff === 'hard' || level >= 6) return 'octagon';
  if (selectedDiff === 'normal' || level >= 4) return 'hexagon';
  if (level >= 2) return 'ellipse';
  return 'circle';
}

function getRadiusModifier(theta, shape) {
  if (shape === 'ellipse') return 1 + 0.14 * Math.cos(2 * theta);
  if (shape === 'hexagon') return 1 + 0.06 * Math.cos(6 * theta);
  if (shape === 'octagon') return 1 + 0.07 * Math.cos(8 * theta);
  return 1;
}

// ==========================================
// NAVEGACIÓN DEL HUB Y MODALES
// ==========================================
document.querySelectorAll('#cat-tabs .cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#cat-tabs .cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const cat = tab.dataset.cat;
    document.querySelectorAll('#mode-group .bento-card').forEach(card => {
      card.hidden = (cat !== 'all' && card.dataset.cat !== cat);
    });
  });
});

document.querySelectorAll('#mode-group .bento-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('#mode-group .bento-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedMode = card.dataset.mode;
  });
});

document.querySelectorAll('#diff-group .opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#diff-group .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDiff = btn.dataset.diff;
  });
});

// Misiones
document.querySelector('#open-missions').addEventListener('click', () => { renderMissions(); missionsModal.hidden = false; });
document.querySelector('#close-missions').addEventListener('click', () => { missionsModal.hidden = true; });

function renderMissions() {
  const listEl = document.querySelector('#missions-list');
  listEl.innerHTML = State.missions.map(m => {
    const completed = m.progress >= m.target;
    return `
      <div class="mission-card ${completed && !m.claimed ? 'done' : ''}">
        <div class="mission-info">
          <strong>${m.title}</strong>
          <small>Progreso: ${m.progress} / ${m.target} · Recompensa: +${m.reward} Fichas</small>
        </div>
        <button type="button" class="claim-btn" data-claim="${m.id}" ${(!completed || m.claimed) ? 'disabled' : ''}>
          ${m.claimed ? 'LISTO' : (completed ? 'RECLAMAR' : `${Math.round((m.progress / m.target) * 100)}%`)}
        </button>
      </div>
    `;
  }).join('');
}

document.querySelector('#missions-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-claim]');
  if (!btn) return;
  const m = State.missions.find(item => item.id === btn.dataset.claim);
  if (m && m.progress >= m.target && !m.claimed) {
    m.claimed = true;
    State.photons += m.reward;
    addXP(50);
    saveState();
    playSound('powerup');
    refreshHubUI();
    renderMissions();
  }
});

// Tienda
document.querySelector('#open-shop').addEventListener('click', () => { renderShop(); shopModal.hidden = false; });
document.querySelector('#close-shop').addEventListener('click', () => { shopModal.hidden = true; });

function renderShop() {
  refreshHubUI();
  document.querySelector('#skin-grid').innerHTML = SKINS.map(s => {
    const owned = State.ownedSkins.includes(s.id);
    const eq = State.equippedSkin === s.id;
    return `<div class="shop-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" data-buy-skin="${s.id}">
      <span>${s.icon}</span><span class="shop-item-name">${s.name}</span>
      <span class="shop-item-price">${eq ? 'EN USO' : (owned ? 'USAR' : s.price)}</span>
    </div>`;
  }).join('');

  document.querySelector('#trail-grid').innerHTML = TRAILS.map(t => {
    const owned = State.ownedTrails.includes(t.id);
    const eq = State.equippedTrail === t.id;
    return `<div class="shop-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" data-buy-trail="${t.id}">
      <span class="shop-item-name">${t.name}</span>
      <span class="shop-item-price">${eq ? 'EN USO' : (owned ? 'USAR' : t.price)}</span>
    </div>`;
  }).join('');

  document.querySelector('#theme-grid').innerHTML = THEMES.map(t => {
    const owned = State.ownedThemes.includes(t.id);
    const eq = State.equippedTheme === t.id;
    return `<div class="shop-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" data-buy-theme="${t.id}">
      <span class="shop-item-name">${t.name}</span>
      <span class="shop-item-price">${eq ? 'EN USO' : (owned ? 'USAR' : t.price)}</span>
    </div>`;
  }).join('');
}

shopModal.addEventListener('click', (e) => {
  const skinEl = e.target.closest('[data-buy-skin]');
  if (skinEl) {
    const item = SKINS.find(s => s.id === skinEl.dataset.buySkin);
    if (State.ownedSkins.includes(item.id)) State.equippedSkin = item.id;
    else if (State.photons >= item.price) { State.photons -= item.price; State.ownedSkins.push(item.id); State.equippedSkin = item.id; }
    saveState(); renderShop(); return;
  }
  const trailEl = e.target.closest('[data-buy-trail]');
  if (trailEl) {
    const item = TRAILS.find(t => t.id === trailEl.dataset.buyTrail);
    if (State.ownedTrails.includes(item.id)) State.equippedTrail = item.id;
    else if (State.photons >= item.price) { State.photons -= item.price; State.ownedTrails.push(item.id); State.equippedTrail = item.id; }
    saveState(); renderShop(); return;
  }
  const themeEl = e.target.closest('[data-buy-theme]');
  if (themeEl) {
    const item = THEMES.find(t => t.id === themeEl.dataset.buyTheme);
    if (State.ownedThemes.includes(item.id)) { State.equippedTheme = item.id; applyTheme(item.id); }
    else if (State.photons >= item.price) { State.photons -= item.price; State.ownedThemes.push(item.id); State.equippedTheme = item.id; applyTheme(item.id); }
    saveState(); renderShop();
  }
});

// Perfil, Historial y Backup
document.querySelector('#open-profile').addEventListener('click', () => { renderProfile(); profileModal.hidden = false; });
document.querySelector('#close-profile').addEventListener('click', () => { profileModal.hidden = true; });

document.querySelectorAll('#board-filters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#board-filters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderProfile();
  });
});

function renderProfile() {
  const { lv } = getOperatorLevel();
  document.querySelector('#stats-grid').innerHTML = `
    <div class="stat-box"><strong>NV.${lv}</strong><small>RANGO</small></div>
    <div class="stat-box"><strong>${State.attempts}</strong><small>PARTIDAS</small></div>
    <div class="stat-box"><strong>${State.best}</strong><small>RÉCORD</small></div>
  `;

  let filtered = [...State.runs];
  if (activeFilter !== 'all') filtered = filtered.filter(r => r.mode === activeFilter);
  const sorted = filtered.sort((a, b) => b.score - a.score).slice(0, 12);

  document.querySelector('#run-list').innerHTML = sorted.map(run => `
    <li class="run-row">
      <span>${run.mode.toUpperCase()}<small>NIVEL ${String(run.level).padStart(2, '0')} · #${run.attempt}</small></span>
      <span>${run.score}</span>
      <span>${formatTime(run.seconds)}</span>
    </li>
  `).join('');
  document.querySelector('#empty-board').hidden = sorted.length > 0;
}

document.querySelector('#export-btn').addEventListener('click', () => {
  const code = exportBackupCode();
  navigator.clipboard?.writeText(code);
  alert('Código de progreso copiado al portapapeles:\n\n' + code);
});

document.querySelector('#import-btn').addEventListener('click', () => {
  const code = prompt('Pega tu código de copia de seguridad:');
  if (code && importBackupCode(code)) {
    applyTheme(State.equippedTheme);
    refreshHubUI();
    renderProfile();
    alert('Progreso restaurado con éxito.');
  } else if (code) {
    alert('Código inválido.');
  }
});

// ==========================================
// MODO DUELO LOCAL 1v1
// ==========================================
const duelUI = document.querySelector('#duel-ui');
const duelP1 = document.querySelector('#duel-p1');
const duelP2 = document.querySelector('#duel-p2');
const duelMsg1 = document.querySelector('#duel-msg-1');
const duelMsg2 = document.querySelector('#duel-msg-2');
let duelState = 'idle', duelTimeout = null, duelScores = [0, 0], duelRound = 1;

document.querySelector('#open-duel').addEventListener('click', () => {
  initAudio();
  duelScores = [0, 0];
  duelRound = 1;
  document.querySelector('#duel-score-1').textContent = '0';
  document.querySelector('#duel-score-2').textContent = '0';
  duelUI.hidden = false;
  startDuelRound();
});

document.querySelector('#duel-exit').addEventListener('click', () => {
  clearTimeout(duelTimeout);
  duelUI.hidden = true;
});

function startDuelRound() {
  duelState = 'waiting';
  duelP1.classList.remove('ready-go');
  duelP2.classList.remove('ready-go');
  document.querySelector('#duel-status').textContent = `RONDA ${duelRound} / 5`;
  duelMsg1.textContent = 'ESPERA...';
  duelMsg2.textContent = 'ESPERA...';

  const delay = 1500 + Math.random() * 2500;
  duelTimeout = setTimeout(() => {
    duelState = 'go';
    duelP1.classList.add('ready-go');
    duelP2.classList.add('ready-go');
    duelMsg1.textContent = '¡PULSA AHORA!';
    duelMsg2.textContent = '¡PULSA AHORA!';
    playSound('lock');
  }, delay);
}

function handleDuelTap(playerIdx) {
  if (duelState === 'waiting') {
    clearTimeout(duelTimeout);
    duelState = 'result';
    const winner = 1 - playerIdx;
    duelScores[winner]++;
    playSound('hit');
    duelMsg1.textContent = playerIdx === 0 ? '¡TE ADELANTASTE!' : 'PUNTO POR ERROR RIVAL';
    duelMsg2.textContent = playerIdx === 1 ? '¡TE ADELANTASTE!' : 'PUNTO POR ERROR RIVAL';
    nextDuelStep();
  } else if (duelState === 'go') {
    duelState = 'result';
    duelScores[playerIdx]++;
    playSound('collect');
    duelMsg1.textContent = playerIdx === 0 ? '¡MÁS RÁPIDO!' : 'TARDE';
    duelMsg2.textContent = playerIdx === 1 ? '¡MÁS RÁPIDO!' : 'TARDE';
    nextDuelStep();
  }
}

function nextDuelStep() {
  document.querySelector('#duel-score-1').textContent = duelScores[0];
  document.querySelector('#duel-score-2').textContent = duelScores[1];
  setTimeout(() => {
    if (duelRound >= 5) {
      const winText = duelScores[0] > duelScores[1] ? 'GANA JUGADOR 01' : (duelScores[1] > duelScores[0] ? 'GANA JUGADOR 02' : 'EMPATE');
      document.querySelector('#duel-status').textContent = winText;
      duelMsg1.textContent = winText;
      duelMsg2.textContent = winText;
    } else {
      duelRound++;
      startDuelRound();
    }
  }, 1300);
}

duelP1.addEventListener('pointerdown', () => handleDuelTap(0));
duelP2.addEventListener('pointerdown', () => handleDuelTap(1));

// ==========================================
// MATEMÁTICA ANGULAR EXACTA (SIN FALLOS DE VUELTA)
// ==========================================
function shortestAngleDiff(a, b) {
  const twoPi = Math.PI * 2;
  let diff = (a - b) % twoPi;
  if (diff > Math.PI) diff -= twoPi;
  if (diff < -Math.PI) diff += twoPi;
  return diff;
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function cleanGameState() {
  objects = []; particles = []; trail = []; floatTexts = []; seqLocks = []; vecObstacles = [];
  shieldActive = false; magnetTimer = 0; slowTimer = 0;
  hudShield.hidden = true; hudMagnet.hidden = true; hudSlow.hidden = true;
  reverseBanner.classList.remove('show');
}

function setStreak() {
  streakEl.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < streak % 5 ? 'on' : ''}"></span>`).join('');
}

function burst(x, y, isAccent = false, count = 10) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.3 + Math.random() * 0.3,
      max: 0.6,
      isAccent,
      size: 2.5 + Math.random() * 2
    });
  }
}

function spawnFloatText(text, x, y, isAccent = false) {
  floatTexts.push({ text, x, y, vy: -30, alpha: 1, isAccent });
}

function begin() {
  State.attempts++;
  initAudio();
  cleanGameState();

  mode = 'playing';
  score = 0; streak = 0; elapsed = 0; shake = 0;
  angle = -Math.PI / 2; direction = 1; targetLane = 0;

  scoreEl.textContent = '0';
  timerEl.textContent = '00:00';
  gameTopBar.hidden = false;
  pauseModal.hidden = true;
  resultBanner.hidden = true;
  overlay.classList.add('hidden');

  if (selectedDiff === 'hard') { scoreMultiplier = 2.0; multiplierBadge.textContent = 'x2'; multiplierBadge.hidden = false; }
  else if (selectedDiff === 'normal') { scoreMultiplier = 1.5; multiplierBadge.textContent = 'x1.5'; multiplierBadge.hidden = false; }
  else { scoreMultiplier = 1.0; multiplierBadge.hidden = true; }

  level = selectedDiff === 'hard' ? 3 : (selectedDiff === 'normal' ? 2 : 1);
  resize();
  currentRadius = rings[0];
  levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');

  if (selectedMode === 'sequence') {
    scoreLabelEl.textContent = 'ACIERTOS';
    streakEl.style.display = 'flex';
    setStreak();
    seqHitsInLevel = 0;
    spawnSequenceTarget();
    statusEl.textContent = 'SECUENCIA ACTIVA';
  } else if (selectedMode === 'vector') {
    scoreLabelEl.textContent = 'DISTANCIA';
    streakEl.style.display = 'none';
    vecY = cy;
    vecHolding = false;
    spawnClock = 0.5;
    statusEl.textContent = 'VECTOR ACTIVO';
  } else if (selectedMode === 'matrix') {
    scoreLabelEl.textContent = 'RONDA';
    streakEl.style.display = 'none';
    startMatrixRound();
    statusEl.textContent = 'MEMORIZA PATRÓN';
  } else if (selectedMode === 'stack') {
    scoreLabelEl.textContent = 'PISOS';
    streakEl.style.display = 'none';
    initStackGame();
    statusEl.textContent = 'CONSTRUYENDO';
  } else {
    scoreLabelEl.textContent = 'PUNTOS';
    streakEl.style.display = 'flex';
    setStreak();
    spawnClock = 0.35;
    reverseTimer = 18;
    statusEl.textContent = 'ÓRBITA ACTIVA';
  }
}

function finish() {
  if (mode !== 'playing') return;
  mode = 'over';
  shake = 12;
  playSound('hit');
  vibrate([60, 40, 90]);

  flashEl.classList.remove('hit');
  void flashEl.offsetWidth;
  flashEl.classList.add('hit');

  statusEl.textContent = 'FIN DE PARTIDA';
  State.runs.push({ attempt: State.attempts, score, seconds: Math.floor(elapsed), level, mode: selectedMode });
  if (score > State.best) State.best = score;

  const earned = Math.max(1, Math.floor((score / 3) * scoreMultiplier));
  State.photons += earned;
  addXP(score * 3 + 15);
  updateMissionProgress(selectedMode, selectedMode === 'sequence' ? level : score);
  saveState();

  gameTopBar.hidden = true;
  resultBanner.innerHTML = `<strong>${selectedMode.toUpperCase()}</strong> · PUNTOS: <strong>${score}</strong> · +${earned} FICHAS`;
  resultBanner.hidden = false;

  cleanGameState();
  refreshHubUI();
  overlay.classList.remove('hidden');
}

// ==========================================
// GENERACIÓN SEGURA DE OBSTÁCULOS ORBITALES
// ==========================================
function spawnSafeOrbitPattern() {
  const numLanes = rings.length;
  const baseAhead = 2.2;
  const startAngle = angle + baseAhead * direction;

  for (const existing of objects) {
    const angularGap = Math.abs(shortestAngleDiff(existing.a, startAngle));
    if (angularGap < 0.65) {
      return false;
    }
  }

  const laneChoice = Math.floor(Math.random() * numLanes);
  const safeLane = (laneChoice + 1) % numLanes;
  const roll = Math.random();

  const addObj = (offset, ring, type, moving = false) => {
    objects.push({
      a: startAngle + offset * direction,
      ring,
      type,
      moving,
      moveDir: 1,
      hit: false
    });
  };

  if (selectedMode === 'evolution' && roll < 0.14) {
    const pTypes = ['shield', 'magnet', 'slow'];
    addObj(0, safeLane, pTypes[Math.floor(Math.random() * pTypes.length)]);
    return true;
  }

  if (roll < 0.45) {
    addObj(0, laneChoice, 'hazard', selectedMode === 'evolution' && level >= 3 && Math.random() < 0.3);
    addObj(0.28, safeLane, 'spark');
  } else if (roll < 0.78) {
    addObj(0, safeLane, 'spark');
    addObj(0.26, laneChoice, 'hazard');
    addObj(0.52, safeLane, 'spark');
  } else {
    addObj(0, laneChoice, 'hazard');
    addObj(0.48, safeLane, 'hazard');
  }
  return true;
}

// ==========================================
// LÓGICA ESPECÍFICA DE LOS OTROS CARTUCHOS
// ==========================================
function spawnSequenceTarget() {
  const offset = (Math.PI * 0.7) + Math.random() * (Math.PI * 0.85);
  seqTargetAngle = angle + offset * direction;
  const shrink = selectedDiff === 'hard' ? 0.76 : (selectedDiff === 'normal' ? 0.88 : 1);
  seqArcWidth = Math.max(0.32, (0.74 - (level - 1) * 0.04) * shrink);
}

function startMatrixRound() {
  matGridSize = level >= 4 ? 5 : 4;
  const totalCells = matGridSize * matGridSize;
  const count = Math.min(totalCells - 3, 3 + level);
  matPattern = [];
  while (matPattern.length < count) {
    const idx = Math.floor(Math.random() * totalCells);
    if (!matPattern.includes(idx)) matPattern.push(idx);
  }
  matSelected = [];
  matPhase = 'show';
  matTimer = Math.max(0.9, 1.8 - level * 0.1);
}

function initStackGame() {
  const baseW = 140;
  stackBlocks = [{ x: cx - baseW / 2, w: baseW }];
  spawnNextStackBlock();
}

function spawnNextStackBlock() {
  const prev = stackBlocks[stackBlocks.length - 1];
  stackCurrent = { x: 20, w: prev.w };
  stackDir = 1;
}

// ==========================================
// ACCIÓN CENTRAL (TOQUE O TECLA ESPACIO)
// ==========================================
function triggerGameAction() {
  if (mode !== 'playing') return;

  if (selectedMode === 'sequence') {
    const diff = Math.abs(shortestAngleDiff(angle, seqTargetAngle));
    // Tolerancia justa (+0.08 rad de margen por el radio de la bola)
    const hitMargin = (seqArcWidth / 2) + 0.08;

    const r = rings[0];
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;

    if (diff <= hitMargin) {
      streak++;
      seqHitsInLevel++;
      const pts = Math.round((1 + Math.floor(streak / 4)) * scoreMultiplier);
      score += pts;
      scoreEl.textContent = score;
      setStreak();
      playSound('lock');
      vibrate(20);
      burst(px, py, true, 10);
      spawnFloatText(`+${pts}`, px, py, scoreMultiplier > 1);
      seqLocks.push(angle);

      if (seqHitsInLevel >= 5) {
        seqHitsInLevel = 0;
        level++;
        direction *= -1;
        seqLocks = [];
        levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
        reverseBanner.classList.add('show');
        setTimeout(() => reverseBanner.classList.remove('show'), 1100);
      }
      spawnSequenceTarget();
    } else {
      burst(px, py, true, 16);
      finish();
    }
  } else if (selectedMode === 'stack') {
    const prev = stackBlocks[stackBlocks.length - 1];
    const overlapLeft = Math.max(prev.x, stackCurrent.x);
    const overlapRight = Math.min(prev.x + prev.w, stackCurrent.x + stackCurrent.w);
    const overlapW = overlapRight - overlapLeft;

    if (overlapW <= 4) {
      finish();
    } else {
      stackBlocks.push({ x: overlapLeft, w: overlapW });
      if (stackBlocks.length > 10) stackBlocks.shift();
      score += Math.round(1 * scoreMultiplier);
      scoreEl.textContent = score;
      playSound('lock');
      vibrate(20);
      spawnNextStackBlock();
    }
  } else if (selectedMode === 'classic' || selectedMode === 'evolution') {
    targetLane = (targetLane + 1) % rings.length;
    playSound('switch');
    vibrate(18);
  }
}

// ==========================================
// PAUSA Y CONTROLES DE ENTRADA
// ==========================================
function togglePause() {
  if (mode === 'playing') { mode = 'paused'; pauseModal.hidden = false; }
  else if (mode === 'paused') { mode = 'playing'; pauseModal.hidden = true; }
}

pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
resumeBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
quitBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  mode = 'ready';
  cleanGameState();
  pauseModal.hidden = true;
  gameTopBar.hidden = true;
  overlay.classList.remove('hidden');
});

startButton.addEventListener('click', (e) => { e.stopPropagation(); begin(); });

// Toques en pantalla
shell.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, .modal-box, .hub-ui:not(.hidden), .duel-ui:not([hidden])')) return;
  if (mode !== 'playing') return;

  if (selectedMode === 'vector') {
    vecHolding = true;
    playSound('tap');
  } else if (selectedMode === 'matrix') {
    if (matPhase !== 'input') return;
    const gridW = Math.min(w - 60, 280);
    const cellSize = gridW / matGridSize;
    const startX = cx - gridW / 2;
    const startY = cy - gridW / 2;
    const col = Math.floor((e.clientX - startX) / cellSize);
    const row = Math.floor((e.clientY - startY) / cellSize);

    if (col >= 0 && col < matGridSize && row >= 0 && row < matGridSize) {
      const idx = row * matGridSize + col;
      if (matPattern.includes(idx)) {
        if (!matSelected.includes(idx)) {
          matSelected.push(idx);
          playSound('lock');
          vibrate(15);
          if (matSelected.length === matPattern.length) {
            score += Math.round(5 * scoreMultiplier);
            scoreEl.textContent = score;
            level++;
            levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
            startMatrixRound();
          }
        }
      } else {
        finish();
      }
    }
  } else {
    triggerGameAction();
  }
});

shell.addEventListener('pointerup', () => { vecHolding = false; });
shell.addEventListener('pointercancel', () => { vecHolding = false; });

// Soporte de teclado (Espacio, Enter, Flechas)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (mode === 'playing' || mode === 'paused') togglePause();
    return;
  }

  if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    if (e.repeat) return; // Evita disparos múltiples si se deja pulsado en Secuencia/Órbita

    if (mode === 'playing') {
      if (selectedMode === 'vector') {
        vecHolding = true;
        playSound('tap');
      } else {
        triggerGameAction();
      }
    } else if (mode === 'ready' || mode === 'over') {
      const anyModalOpen = !shopModal.hidden || !missionsModal.hidden || !profileModal.hidden || !document.querySelector('#update-modal').hidden || !duelUI.hidden;
      if (!anyModalOpen) begin();
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
    vecHolding = false;
  }
});

// ==========================================
// ACTUALIZACIÓN DE FÍSICAS (UPDATE)
// ==========================================
function update(dt) {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= dt;
  }

  for (const ft of floatTexts) {
    ft.y += ft.vy * dt;
    ft.alpha -= dt * 1.6;
  }
  floatTexts = floatTexts.filter(ft => ft.alpha > 0);

  if (shake > 0.1) shake *= 0.86; else shake = 0;
  if (mode !== 'playing') return;

  elapsed += dt;
  timerEl.textContent = formatTime(elapsed);

  if (selectedMode === 'vector') {
    const vy = vecHolding ? 230 : -230;
    vecY += vy * dt;
    trail.unshift({ x: w * 0.28, y: vecY, alpha: 1 });
    if (trail.length > 26) trail.pop();
    for (const t of trail) t.x -= 210 * dt;

    if (vecY < h * 0.16 || vecY > h * 0.84) { finish(); return; }

    spawnClock -= dt;
    if (spawnClock <= 0) {
      const gapY = h * 0.28 + Math.random() * (h * 0.44);
      vecObstacles.push({ x: w + 30, gapY, gapH: 135, passed: false });
      spawnClock = 1.3;
    }

    for (const ob of vecObstacles) {
      ob.x -= 210 * dt;
      if (Math.abs(ob.x - w * 0.28) < 12) {
        if (vecY < ob.gapY - ob.gapH / 2 || vecY > ob.gapY + ob.gapH / 2) {
          finish(); return;
        }
      }
      if (!ob.passed && ob.x < w * 0.28) {
        ob.passed = true;
        score += Math.round(1 * scoreMultiplier);
        scoreEl.textContent = score;
        playSound('collect');
      }
    }
    vecObstacles = vecObstacles.filter(o => o.x > -40);
    return;
  }

  if (selectedMode === 'matrix') {
    if (matPhase === 'show') {
      matTimer -= dt;
      if (matTimer <= 0) { matPhase = 'input'; statusEl.textContent = 'TU TURNO'; }
    }
    return;
  }

  if (selectedMode === 'stack') {
    if (stackCurrent) {
      const speed = 180 + score * 8;
      stackCurrent.x += stackDir * speed * dt;
      if (stackCurrent.x + stackCurrent.w > w - 20) stackDir = -1;
      if (stackCurrent.x < 20) stackDir = 1;
    }
    return;
  }

  // ----------------------------------------
  // MODO 03 · SECUENCIA (CON DETECCIÓN EXACTA)
  // ----------------------------------------
  if (selectedMode === 'sequence') {
    const speed = (1.55 + Math.min((level - 1) * 0.2, 2.0)) * (selectedDiff === 'hard' ? 1.2 : 1);
    angle += speed * dt * direction;

    const r = rings[0];
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    trail.unshift({ x: px, y: py, alpha: 1 });
    if (trail.length > 10) trail.pop();
    for (const t of trail) t.alpha -= dt * 3;
    trail = trail.filter(t => t.alpha > 0);

    // Calcular distancia angular normalizada en la dirección del movimiento
    const signedDiff = shortestAngleDiff(angle, seqTargetAngle) * direction;
    if (signedDiff > (seqArcWidth / 2) + 0.14) {
      burst(px, py, true, 16);
      finish();
    }
    return;
  }

  // ----------------------------------------
  // MODO 01 · ÓRBITA & 02 · EVOLUCIÓN
  // ----------------------------------------
  const shape = getGeometryType();
  const destRadius = rings[targetLane] || rings[0];
  currentRadius += (destRadius - currentRadius) * Math.min(1, dt * 20);

  if (magnetTimer > 0) { magnetTimer -= dt; hudMagnet.hidden = false; } else { hudMagnet.hidden = true; }
  if (slowTimer > 0) { slowTimer -= dt; hudSlow.hidden = false; } else { hudSlow.hidden = true; }
  hudShield.hidden = !shieldActive;

  const timeScale = slowTimer > 0 ? 0.55 : 1;
  const effectiveDt = dt * timeScale;

  const baseLevel = selectedDiff === 'hard' ? 3 : (selectedDiff === 'normal' ? 2 : 1);
  const nextLevel = baseLevel + Math.max(Math.floor(score / 8), Math.floor(elapsed / 22));
  if (nextLevel > level) {
    level = nextLevel;
    resize();
  }

  if (selectedMode === 'evolution' && level >= 3) {
    reverseTimer -= effectiveDt;
    if (reverseTimer <= 2 && reverseTimer > 0) {
      reverseBanner.classList.add('show');
    } else if (reverseTimer <= 0) {
      direction *= -1;
      reverseTimer = 20 + Math.random() * 10;
      reverseBanner.classList.remove('show');
      vibrate([40, 30, 40]);
      objects = objects.filter(o => Math.abs(shortestAngleDiff(o.a, angle)) > 0.9);
    }
  }

  const baseSpeed = 1.45 + Math.min((level - 1) * 0.14, 1.45);
  angle += baseSpeed * effectiveDt * direction;

  spawnClock -= effectiveDt;
  if (spawnClock <= 0) {
    if (spawnSafeOrbitPattern()) {
      spawnClock = Math.max(0.62, 1.35 - (level - 1) * 0.07);
    }
  }

  levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');

  const playerR = currentRadius * getRadiusModifier(angle, shape);
  const px = cx + Math.cos(angle) * playerR;
  const py = cy + Math.sin(angle) * playerR;

  trail.unshift({ x: px, y: py, alpha: 1 });
  if (trail.length > 12) trail.pop();

  for (const obj of objects) {
    if (obj.hit) continue;

    if (obj.moving) {
      obj.ring += obj.moveDir * effectiveDt * 0.75;
      if (obj.ring >= rings.length - 1) { obj.ring = rings.length - 1; obj.moveDir = -1; }
      else if (obj.ring <= 0) { obj.ring = 0; obj.moveDir = 1; }
    }

    const rBase = rings[Math.round(obj.ring)] || rings[0];
    const r = rBase * getRadiusModifier(obj.a, shape);
    let ox = cx + Math.cos(obj.a) * r;
    let oy = cy + Math.sin(obj.a) * r;

    if (magnetTimer > 0 && obj.type === 'spark') {
      ox += (px - ox) * 0.18;
      oy += (py - oy) * 0.18;
    }

    if (Math.hypot(px - ox, py - oy) < 17) {
      if (obj.type === 'hazard') {
        if (shieldActive) {
          shieldActive = false;
          obj.hit = true;
          burst(ox, oy, false, 12);
          playSound('powerup');
          vibrate(35);
        } else {
          burst(px, py, true, 18);
          finish();
          break;
        }
      } else if (obj.type === 'spark') {
        obj.hit = true;
        streak++;
        const pts = Math.round((1 + Math.floor(streak / 5)) * scoreMultiplier);
        score += pts;
        scoreEl.textContent = score;
        setStreak();
        playSound('collect');
        vibrate(18);
        burst(ox, oy, false, 8);
        spawnFloatText(`+${pts}`, ox, oy, scoreMultiplier > 1);
      } else if (['shield', 'magnet', 'slow'].includes(obj.type)) {
        obj.hit = true;
        playSound('powerup');
        vibrate([25, 25]);
        if (obj.type === 'shield') shieldActive = true;
        if (obj.type === 'magnet') magnetTimer = 7;
        if (obj.type === 'slow') slowTimer = 5;
        burst(ox, oy, true, 12);
        spawnFloatText(obj.type.toUpperCase(), ox, oy, true);
      }
    }
  }

  objects = objects.filter(o => {
    if (o.hit) return false;
    const relAngle = shortestAngleDiff(o.a, angle) * direction;
    return relAngle > -0.45 && relAngle < 3.6;
  });

  for (const t of trail) t.alpha -= dt * 2.5;
  trail = trail.filter(t => t.alpha > 0);
}

// ==========================================
// RENDERIZADO CANVAS (DRAW)
// ==========================================
function drawNodeShape(x, y, rot, pal) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = pal.ink;
  ctx.strokeStyle = pal.bg;
  ctx.lineWidth = 2;

  if (State.equippedSkin === 'square') {
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeRect(-7, -7, 14, 14);
  } else if (State.equippedSkin === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(9, 0); ctx.lineTo(0, 9); ctx.lineTo(-9, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (State.equippedSkin === 'ring') {
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.bg;
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (State.equippedSkin === 'cross') {
    ctx.fillRect(-8, -2.5, 16, 5);
    ctx.fillRect(-2.5, -8, 5, 16);
  } else {
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  const pal = getPalette();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (mode !== 'playing') return;

  ctx.save();
  if (shake > 0.1) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  if (selectedMode === 'vector') {
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.16); ctx.lineTo(w, h * 0.16);
    ctx.moveTo(0, h * 0.84); ctx.lineTo(w, h * 0.84);
    ctx.stroke();

    ctx.fillStyle = pal.accent;
    for (const ob of vecObstacles) {
      ctx.fillRect(ob.x - 10, h * 0.16, 20, (ob.gapY - ob.gapH / 2) - h * 0.16);
      ctx.fillRect(ob.x - 10, ob.gapY + ob.gapH / 2, 20, h * 0.84 - (ob.gapY + ob.gapH / 2));
    }

    ctx.strokeStyle = pal.ink; ctx.lineWidth = 3;
    ctx.beginPath();
    trail.forEach((pt, idx) => idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.fillRect(w * 0.28 - 5, vecY - 5, 10, 10);
    ctx.restore();
    return;
  }

  if (selectedMode === 'matrix') {
    const gridW = Math.min(w - 60, 280);
    const cellSize = gridW / matGridSize;
    const startX = cx - gridW / 2;
    const startY = cy - gridW / 2;

    for (let r = 0; r < matGridSize; r++) {
      for (let c = 0; c < matGridSize; c++) {
        const idx = r * matGridSize + c;
        const x = startX + c * cellSize;
        const y = startY + r * cellSize;
        const isLit = (matPhase === 'show' && matPattern.includes(idx)) || matSelected.includes(idx);
        ctx.fillStyle = isLit ? pal.accent : pal.cardBg;
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 1.5;
        ctx.fillRect(x + 3, y + 3, cellSize - 6, cellSize - 6);
        ctx.strokeRect(x + 3, y + 3, cellSize - 6, cellSize - 6);
      }
    }
    ctx.restore();
    return;
  }

  if (selectedMode === 'stack') {
    const blockH = 24;
    const baseY = h * 0.75;
    stackBlocks.forEach((b, i) => {
      const y = baseY - i * blockH;
      ctx.fillStyle = i === stackBlocks.length - 1 ? pal.ink : pal.muted;
      ctx.fillRect(b.x, y, b.w, blockH - 2);
    });
    if (stackCurrent) {
      const y = baseY - stackBlocks.length * blockH;
      ctx.fillStyle = pal.accent;
      ctx.fillRect(stackCurrent.x, y, stackCurrent.w, blockH - 2);
    }
    ctx.restore();
    return;
  }

  if (selectedMode === 'sequence') {
    const r = rings[0];
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = pal.borderSoft; ctx.lineWidth = 2; ctx.stroke();

    // Arco objetivo
    ctx.beginPath(); ctx.arc(cx, cy, r, seqTargetAngle - seqArcWidth / 2, seqTargetAngle + seqArcWidth / 2);
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 14; ctx.stroke();

    // Marcas de acierto
    for (const lockAng of seqLocks) {
      const lx = cx + Math.cos(lockAng) * r;
      const ly = cy + Math.sin(lockAng) * r;
      ctx.fillStyle = pal.accent;
      ctx.fillRect(lx - 4, ly - 4, 8, 8);
    }

    ctx.fillStyle = pal.ink;
    ctx.font = '700 26px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${seqHitsInLevel}/5`, cx, cy);

    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    drawNodeShape(px, py, angle + Math.PI / 2, pal);
    ctx.restore();
    return;
  }

  // Órbita y Evolución
  const shape = getGeometryType();
  ctx.fillStyle = pal.ink;
  ctx.fillRect(cx - 3, cy - 3, 6, 6);

  for (let ringIdx = 0; ringIdx < rings.length; ringIdx++) {
    const baseR = rings[ringIdx];
    ctx.beginPath();
    const steps = shape === 'circle' ? 72 : 80;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const r = baseR * getRadiusModifier(theta, shape);
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = targetLane === ringIdx ? pal.ink : pal.borderSoft;
    ctx.lineWidth = targetLane === ringIdx ? 2 : 1.5;
    ctx.stroke();
  }

  for (const obj of objects) {
    const rBase = rings[Math.round(obj.ring)] || rings[0];
    const r = rBase * getRadiusModifier(obj.a, shape);
    const x = cx + Math.cos(obj.a) * r;
    const y = cy + Math.sin(obj.a) * r;

    const relAngle = shortestAngleDiff(obj.a, angle) * direction;
    ctx.globalAlpha = relAngle < 0 ? Math.max(0, 1 + relAngle * 2.2) : 1;

    if (obj.type === 'hazard') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(obj.a + Math.PI / 4);
      ctx.fillStyle = pal.accent;
      ctx.fillRect(-7.5, -7.5, 15, 15);
      ctx.restore();
    } else if (obj.type === 'spark') {
      ctx.fillStyle = pal.bg;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = pal.ink;
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillStyle = pal.bg;
      ctx.font = '700 9px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const letter = obj.type === 'shield' ? 'E' : (obj.type === 'magnet' ? 'I' : 'L');
      ctx.fillText(letter, x, y);
    }
  }
  ctx.globalAlpha = 1;

  // Estela
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    ctx.globalAlpha = t.alpha * 0.35;
    ctx.fillStyle = State.equippedTrail === 'accent' ? pal.accent : pal.ink;
    if (State.equippedTrail === 'dots') {
      if (i % 2 === 0) ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    } else {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Jugador
  const playerR = currentRadius * getRadiusModifier(angle, shape);
  const px = cx + Math.cos(angle) * playerR;
  const py = cy + Math.sin(angle) * playerR;
  drawNodeShape(px, py, angle + Math.PI / 2, pal);

  if (shieldActive) {
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.isAccent ? pal.accent : pal.ink;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const ft of floatTexts) {
    ctx.save();
    ctx.font = '700 11px "DM Mono", monospace';
    ctx.fillStyle = ft.isAccent ? pal.accent : pal.ink;
    ctx.globalAlpha = ft.alpha;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();
}

function frame(now) {
  const dt = Math.min((now - (lastTime || now)) / 1000, 0.04);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

// Modal update
const updateModal = document.querySelector('#update-modal');
if (localStorage.getItem('bento-dismissed-version') !== CURRENT_VERSION) updateModal.hidden = false;
document.querySelector('#close-update').addEventListener('click', () => {
  if (document.querySelector('#dont-show-check').checked) localStorage.setItem('bento-dismissed-version', CURRENT_VERSION);
  updateModal.hidden = true;
});

requestAnimationFrame(frame);
