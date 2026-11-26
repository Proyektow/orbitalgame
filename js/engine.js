import { initAudio, playSound, vibrate } from './audio.js';
import { State, saveState, addXP, getOperatorLevel, updateMissionProgress, exportBackupCode, importBackupCode } from './storage.js';

const CURRENT_VERSION = '4.0.0';

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
let selectedMode = 'classic'; // 'classic' | 'evolution' | 'sequence' | 'vector' | 'matrix' | 'stack'
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
let seqTargetAngle = 0, seqArcWidth = 0.65, seqHitsInLevel = 0, seqLocks = [];

// 04 · Vector (Wave)
let vecY = 0, vecHolding = false, vecObstacles = [];

// 05 · Matriz (Memoria)
let matGridSize = 4, matPattern = [], matSelected = [], matPhase = 'show', matTimer = 0;

// 06 · Equilibrio (Stack)
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
// MODO DUELO LOCAL 1v1 (PASS & PLAY)
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
// INICIO Y FIN DE CARTUCHOS
// ==========================================
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
    spawnClock = 0.5;
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
// LÓGICA ESPECÍFICA DE LOS NUEVOS CARTUCHOS
// ==========================================
// 03 · Secuencia
function spawnSequenceTarget() {
  const offset = (Math.PI * 0.65) + Math.random() * (Math.PI * 0.9);
  seqTargetAngle = angle + offset * direction;
  const shrink = selectedDiff === 'hard' ? 0.72 : (selectedDiff === 'normal' ? 0.85 : 1);
  seqArcWidth = Math.max(0.24, (0.68 - (level - 1) * 0.045) * shrink);
}

// 05 · Matriz
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

// 06 · Equilibrio (Stack)
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
// PAUSA Y CONTROLES TÁCTILES
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
  } else if (selectedMode === 'sequence') {
    let diff = (angle - seqTargetAngle) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;

    if (Math.abs(diff) <= seqArcWidth / 2) {
      streak++; seqHitsInLevel++;
      const pts = Math.round((1 + Math.floor(streak / 4)) * scoreMultiplier);
      score += pts; scoreEl.textContent = score;
      setStreak(); playSound('lock'); vibrate(20);
      seqLocks.push(angle);
      if (seqHitsInLevel >= 5) {
        seqHitsInLevel = 0; level++; direction *= -1; seqLocks = [];
        levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
      }
      spawnSequenceTarget();
    } else {
      finish();
    }
  } else {
    targetLane = (targetLane + 1) % rings.length;
    playSound('switch');
    vibrate(18);
  }
});

shell.addEventListener('pointerup', () => { vecHolding = false; });
shell.addEventListener('pointercancel', () => { vecHolding = false; });

// ==========================================
// ACTUALIZACIÓN DE FÍSICAS (UPDATE)
// ==========================================
function update(dt) {
  if (shake > 0.1) shake *= 0.86; else shake = 0;
  if (mode !== 'playing') return;

  elapsed += dt;
  timerEl.textContent = formatTime(elapsed);

  if (selectedMode === 'vector') {
    const vy = vecHolding ? 230 : -230;
    vecY += vy * dt;
    trail.unshift({ x: w * 0.28, y: vecY });
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

  if (selectedMode === 'sequence') {
    angle += (1.6 + Math.min((level - 1) * 0.22, 2.2)) * dt * direction;
    let diff = ((angle - seqTargetAngle) % (Math.PI * 2));
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff * direction > seqArcWidth / 2 + 0.14) finish();
    return;
  }

  // Órbita y Evolución
  const destRadius = rings[targetLane] || rings[0];
  currentRadius += (destRadius - currentRadius) * Math.min(1, dt * 20);
  angle += (1.45 + Math.min((level - 1) * 0.15, 1.5)) * dt * direction;

  spawnClock -= dt;
  if (spawnClock <= 0) {
    const laneChoice = Math.floor(Math.random() * rings.length);
    objects.push({ a: angle + 2.0 * direction, ring: laneChoice, type: 'hazard', hit: false });
    objects.push({ a: angle + 2.24 * direction, ring: (laneChoice + 1) % rings.length, type: 'spark', hit: false });
    spawnClock = Math.max(0.46, 1.22 - (level - 1) * 0.08);
  }

  const px = cx + Math.cos(angle) * currentRadius;
  const py = cy + Math.sin(angle) * currentRadius;

  for (const obj of objects) {
    if (obj.hit) continue;
    const r = rings[obj.ring];
    const ox = cx + Math.cos(obj.a) * r;
    const oy = cy + Math.sin(obj.a) * r;

    if (Math.hypot(px - ox, py - oy) < 18) {
      if (obj.type === 'hazard') { finish(); break; }
      else {
        obj.hit = true;
        streak++;
        score += Math.round((1 + Math.floor(streak / 5)) * scoreMultiplier);
        scoreEl.textContent = score;
        setStreak();
        playSound('collect');
        vibrate(18);
      }
    }
  }
  objects = objects.filter(o => !o.hit);
}

// ==========================================
// RENDERIZADO CANVAS (DRAW)
// ==========================================
function draw() {
  const pal = getPalette();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (mode !== 'playing') return;

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
    return;
  }

  if (selectedMode === 'sequence') {
    const r = rings[0];
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = pal.borderSoft; ctx.lineWidth = 2; ctx.stroke();

    ctx.beginPath(); ctx.arc(cx, cy, r, seqTargetAngle - seqArcWidth / 2, seqTargetAngle + seqArcWidth / 2);
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 14; ctx.stroke();

    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
    return;
  }

  // Órbita y Evolución
  for (let i = 0; i < rings.length; i++) {
    ctx.beginPath(); ctx.arc(cx, cy, rings[i], 0, Math.PI * 2);
    ctx.strokeStyle = targetLane === i ? pal.ink : pal.borderSoft;
    ctx.lineWidth = targetLane === i ? 2 : 1.5;
    ctx.stroke();
  }

  for (const obj of objects) {
    const r = rings[obj.ring];
    const x = cx + Math.cos(obj.a) * r;
    const y = cy + Math.sin(obj.a) * r;
    ctx.fillStyle = obj.type === 'hazard' ? pal.accent : pal.ink;
    ctx.fillRect(x - 6, y - 6, 12, 12);
  }

  const px = cx + Math.cos(angle) * currentRadius;
  const py = cy + Math.sin(angle) * currentRadius;
  ctx.fillStyle = pal.ink;
  ctx.beginPath(); ctx.arc(px, py, 7.5, 0, Math.PI * 2); ctx.fill();
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
