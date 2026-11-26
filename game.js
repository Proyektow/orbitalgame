// BENTO GAME v3.0.0 - Estética Bentokit Minimalista + Modo Secuencia
const CURRENT_VERSION = '3.0.0';

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

const pauseBtn = document.querySelector('#pause-btn');
const pauseModal = document.querySelector('#pause-modal');
const resumeBtn = document.querySelector('#resume-btn');
const quitBtn = document.querySelector('#quit-btn');

const boardEl = document.querySelector('#board');
const runListEl = document.querySelector('#run-list');
const emptyBoardEl = document.querySelector('#empty-board');
const flashEl = document.querySelector('#flash');
const shell = document.querySelector('.game-shell');
const reverseBanner = document.querySelector('#reverse-banner');

// Tienda
const shopModal = document.querySelector('#shop-modal');
const openShopBtn = document.querySelector('#open-shop');
const closeShopBtn = document.querySelector('#close-shop');
const skinGrid = document.querySelector('#skin-grid');
const trailGrid = document.querySelector('#trail-grid');
const themeGrid = document.querySelector('#theme-grid');

// HUD Power-ups
const hudShield = document.querySelector('#hud-shield');
const hudMagnet = document.querySelector('#hud-magnet');
const hudSlow = document.querySelector('#hud-slow');

// ==========================================
// PALETA DINÁMICA PARA CANVAS
// ==========================================
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

// ==========================================
// AUDIO MINIMALISTA PROCEDURAL (CLICK / BEEP)
// ==========================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
  try {
    initAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'switch') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'collect' || type === 'lock') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.04);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'powerup') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch {}
}

function vibrate(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

// ==========================================
// TIENDA Y ECONOMÍA (FICHAS BENTO)
// ==========================================
let photons = Number(localStorage.getItem('bento-photons') || 0);
let equippedSkin = localStorage.getItem('bento-skin') || 'dot';
let equippedTrail = localStorage.getItem('bento-trail') || 'solid';
let equippedTheme = localStorage.getItem('bento-theme') || 'default';

let ownedSkins = JSON.parse(localStorage.getItem('bento-owned-skins') || '["dot"]');
let ownedTrails = JSON.parse(localStorage.getItem('bento-owned-trails') || '["solid"]');
let ownedThemes = JSON.parse(localStorage.getItem('bento-owned-themes') || '["default"]');

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

function updateWalletUI() {
  localStorage.setItem('bento-photons', photons);
  hudPhotonsEl.textContent = `${photons}`;
  menuPhotonsEl.textContent = `${photons} FICHAS`;
  shopPhotonsEl.textContent = photons;
}

function applyTheme(themeId) {
  document.body.className = '';
  const theme = THEMES.find(t => t.id === themeId);
  if (theme && theme.class) document.body.classList.add(theme.class);
}
applyTheme(equippedTheme);

function renderShop() {
  updateWalletUI();

  skinGrid.innerHTML = SKINS.map(s => {
    const owned = ownedSkins.includes(s.id);
    const eq = equippedSkin === s.id;
    return `
      <div class="shop-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" data-buy-skin="${s.id}">
        <span style="font-size:16px">${s.icon}</span>
        <span class="shop-item-name">${s.name}</span>
        <span class="shop-item-price">${eq ? 'EN USO' : (owned ? 'USAR' : s.price)}</span>
      </div>
    `;
  }).join('');

  trailGrid.innerHTML = TRAILS.map(t => {
    const owned = ownedTrails.includes(t.id);
    const eq = equippedTrail === t.id;
    return `
      <div class="shop-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" data-buy-trail="${t.id}">
        <span class="shop-item-name">${t.name}</span>
        <span class="shop-item-price">${eq ? 'EN USO' : (owned ? 'USAR' : t.price)}</span>
      </div>
    `;
  }).join('');

  themeGrid.innerHTML = THEMES.map(t => {
    const owned = ownedThemes.includes(t.id);
    const eq = equippedTheme === t.id;
    return `
      <div class="shop-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" data-buy-theme="${t.id}">
        <span class="shop-item-name">${t.name}</span>
        <span class="shop-item-price">${eq ? 'EN USO' : (owned ? 'USAR' : t.price)}</span>
      </div>
    `;
  }).join('');
}

skinGrid.addEventListener('click', (e) => {
  const item = e.target.closest('[data-buy-skin]');
  if (!item) return;
  const id = item.dataset.buySkin;
  const skin = SKINS.find(s => s.id === id);
  if (ownedSkins.includes(id)) {
    equippedSkin = id;
    localStorage.setItem('bento-skin', id);
  } else if (photons >= skin.price) {
    photons -= skin.price;
    ownedSkins.push(id);
    equippedSkin = id;
    localStorage.setItem('bento-skin', id);
    localStorage.setItem('bento-owned-skins', JSON.stringify(ownedSkins));
  }
  renderShop();
});

trailGrid.addEventListener('click', (e) => {
  const item = e.target.closest('[data-buy-trail]');
  if (!item) return;
  const id = item.dataset.buyTrail;
  const tr = TRAILS.find(t => t.id === id);
  if (ownedTrails.includes(id)) {
    equippedTrail = id;
    localStorage.setItem('bento-trail', id);
  } else if (photons >= tr.price) {
    photons -= tr.price;
    ownedTrails.push(id);
    equippedTrail = id;
    localStorage.setItem('bento-trail', id);
    localStorage.setItem('bento-owned-trails', JSON.stringify(ownedTrails));
  }
  renderShop();
});

themeGrid.addEventListener('click', (e) => {
  const item = e.target.closest('[data-buy-theme]');
  if (!item) return;
  const id = item.dataset.buyTheme;
  const theme = THEMES.find(t => t.id === id);
  if (ownedThemes.includes(id)) {
    equippedTheme = id;
    localStorage.setItem('bento-theme', id);
    applyTheme(id);
  } else if (photons >= theme.price) {
    photons -= theme.price;
    ownedThemes.push(id);
    equippedTheme = id;
    localStorage.setItem('bento-theme', id);
    localStorage.setItem('bento-owned-themes', JSON.stringify(ownedThemes));
    applyTheme(id);
  }
  renderShop();
});

openShopBtn.addEventListener('click', (e) => { e.stopPropagation(); renderShop(); shopModal.hidden = false; });
closeShopBtn.addEventListener('click', (e) => { e.stopPropagation(); shopModal.hidden = true; });

// ==========================================
// VARIABLES DE JUEGO
// ==========================================
let selectedMode = 'classic'; // 'classic' | 'evolution' | 'sequence'
let selectedDiff = 'easy';    // 'easy' | 'normal' | 'hard'
let activeFilter = 'all';

let w = 0, h = 0, dpr = 1, cx = 0, cy = 0;
let rings = [];
let mode = 'ready'; // 'ready' | 'playing' | 'paused' | 'over'
let angle = -Math.PI / 2;
let targetLane = 0;
let currentRadius = 0; 
let score = 0, streak = 0, elapsed = 0, spawnClock = 0, lastTime = 0, shake = 0, level = 1;
let direction = 1;
let reverseTimer = 0;
let trail = [];
let scoreMultiplier = 1;

// Power-ups (Modo Evolución)
let shieldActive = false;
let magnetTimer = 0;
let slowTimer = 0;
let objects = [], particles = [], floatTexts = [];

// Variables específicas de 03 · BENTO SECUENCIA (Precisión por niveles)
let seqTargetAngle = 0;
let seqArcWidth = 0.65;
let seqHitsInLevel = 0;
let seqLocks = []; // Marcas fijadas en el anillo

// Persistencia
let best = Number(localStorage.getItem('bento-best') || 0);
let attemptCount = Number(localStorage.getItem('bento-attempts') || 0);
let runs = [];
try { runs = JSON.parse(localStorage.getItem('bento-runs') || '[]'); } catch { runs = []; }

bestEl.textContent = best;
updateWalletUI();

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = shell.clientWidth || window.innerWidth;
  h = shell.clientHeight || window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  cx = w / 2;
  cy = h * 0.50;

  const baseOuter = Math.min(w, h) * 0.34;
  if (selectedMode === 'evolution' && level >= 3) {
    rings = [baseOuter, baseOuter * 0.72, baseOuter * 0.46];
  } else {
    rings = [baseOuter, baseOuter * 0.65];
  }

  if (currentRadius === 0) currentRadius = rings[0];
}
window.addEventListener('resize', resize);
resize();

function spawnFloatText(text, x, y, isAccent = false) {
  floatTexts.push({ text, x, y, vy: -30, alpha: 1, isAccent });
}

function setStreak() {
  streakEl.innerHTML = Array.from({ length: 5 }, (_, i) => 
    `<span class="${i < streak % 5 ? 'on' : ''}"></span>`
  ).join('');
}
setStreak();

function getGeometryType() {
  if (selectedMode !== 'evolution') return 'circle';
  if (selectedDiff === 'hard' || level >= 6) return 'octagon';
  if (selectedDiff === 'normal' || level >= 4) return 'hexagon';
  if (level >= 2) return 'ellipse';
  return 'circle';
}

function getRadiusModifier(theta, shape) {
  if (shape === 'ellipse') return 1 + 0.15 * Math.cos(2 * theta);
  if (shape === 'hexagon') return 1 + 0.07 * Math.cos(6 * theta);
  if (shape === 'octagon') return 1 + 0.08 * Math.cos(8 * theta);
  return 1;
}

// Selectores UI
document.querySelectorAll('#mode-group .bento-card').forEach(card => {
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#mode-group .bento-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedMode = card.dataset.mode;
  });
});

document.querySelectorAll('#diff-group .opt-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#diff-group .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDiff = btn.dataset.diff;
  });
});

document.querySelectorAll('#board-filters .filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#board-filters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderBoard();
  });
});

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getModeName(m) {
  if (m === 'classic') return '01 · ÓRBITA';
  if (m === 'evolution') return '02 · EVOLUCIÓN';
  if (m === 'sequence') return '03 · SECUENCIA';
  return m.toUpperCase();
}

function renderBoard() {
  let filtered = [...runs];
  if (activeFilter !== 'all') filtered = filtered.filter(r => (r.mode || 'classic') === activeFilter);
  const sorted = filtered.sort((a, b) => b.score - a.score || b.seconds - a.seconds).slice(0, 10);
  runListEl.innerHTML = sorted.map(run => `
    <li class="run-row">
      <span>${getModeName(run.mode || 'classic')}<small>NIVEL ${String(run.level).padStart(2, '0')} · #${run.attempt}</small></span>
      <span>${run.score}</span>
      <span>${formatTime(run.seconds)}</span>
    </li>
  `).join('');
  emptyBoardEl.hidden = sorted.length > 0;
}

function cleanGameState() {
  objects = [];
  particles = [];
  trail = [];
  floatTexts = [];
  seqLocks = [];
  shieldActive = false;
  magnetTimer = 0;
  slowTimer = 0;
  hudShield.hidden = true;
  hudMagnet.hidden = true;
  hudSlow.hidden = true;
  reverseBanner.classList.remove('show');
}

function spawnNextSequenceTarget() {
  const offset = (Math.PI * 0.65) + Math.random() * (Math.PI * 0.9);
  seqTargetAngle = angle + offset * direction;
  const diffShrink = selectedDiff === 'hard' ? 0.72 : (selectedDiff === 'normal' ? 0.85 : 1);
  seqArcWidth = Math.max(0.24, (0.68 - (level - 1) * 0.045) * diffShrink);
}

function begin() {
  attemptCount++;
  localStorage.setItem('bento-attempts', attemptCount);
  initAudio();
  cleanGameState();

  mode = 'playing';
  score = 0;
  streak = 0;
  elapsed = 0;
  shake = 0;
  angle = -Math.PI / 2;
  direction = 1;
  targetLane = 0;

  scoreEl.textContent = '0';
  timerEl.textContent = '00:00';
  gameTopBar.hidden = false;
  boardEl.hidden = true;
  shopModal.hidden = true;
  pauseModal.hidden = true;
  resultBanner.hidden = true;
  overlay.classList.add('hidden');

  // Multiplicadores por dificultad
  if (selectedDiff === 'hard') {
    scoreMultiplier = 2.0;
    multiplierBadge.textContent = 'x2';
    multiplierBadge.hidden = false;
  } else if (selectedDiff === 'normal') {
    scoreMultiplier = 1.5;
    multiplierBadge.textContent = 'x1.5';
    multiplierBadge.hidden = false;
  } else {
    scoreMultiplier = 1.0;
    multiplierBadge.hidden = true;
  }

  level = selectedDiff === 'hard' ? 3 : (selectedDiff === 'normal' ? 2 : 1);
  resize();
  currentRadius = rings[0];

  if (selectedMode === 'sequence') {
    scoreLabelEl.textContent = 'ACIERTOS';
    streakEl.style.display = 'flex';
    setStreak();
    seqHitsInLevel = 0;
    spawnNextSequenceTarget();
    levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
    statusEl.textContent = 'SECUENCIA ACTIVA';
  } else {
    scoreLabelEl.textContent = 'PUNTOS';
    streakEl.style.display = 'flex';
    setStreak();
    spawnClock = 0.5;
    reverseTimer = 18;
    levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
    statusEl.textContent = 'ÓRBITA ACTIVA';
  }
}

// ==========================================
// PAUSA Y SALIR
// ==========================================
function togglePause() {
  if (mode === 'playing') {
    mode = 'paused';
    pauseModal.hidden = false;
    statusEl.textContent = 'EN PAUSA';
  } else if (mode === 'paused') {
    mode = 'playing';
    pauseModal.hidden = true;
    statusEl.textContent = selectedMode === 'sequence' ? 'SECUENCIA ACTIVA' : 'ÓRBITA ACTIVA';
  }
}

function quitToMenu() {
  mode = 'ready';
  cleanGameState();
  pauseModal.hidden = true;
  gameTopBar.hidden = true;
  statusEl.textContent = 'OFFLINE · LISTO';
  levelEl.textContent = 'NIVEL 01';
  overlay.classList.remove('hidden');
}

pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
resumeBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
quitBtn.addEventListener('click', (e) => { e.stopPropagation(); quitToMenu(); });

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
  runs.push({ attempt: attemptCount, score, seconds: Math.floor(elapsed), level, mode: selectedMode });
  runs = runs.slice(-40);
  localStorage.setItem('bento-runs', JSON.stringify(runs));
  renderBoard();

  const record = score > best;
  if (record) {
    best = score;
    localStorage.setItem('bento-best', best);
    bestEl.textContent = best;
  }

  gameTopBar.hidden = true;
  const earned = Math.max(1, Math.floor((score / 3) * scoreMultiplier));
  photons += earned;

  resultBanner.innerHTML = `${record ? '<strong>NUEVO RÉCORD</strong> · ' : ''}PUNTOS: <strong>${score}</strong> · +${earned} FICHAS (${scoreMultiplier}x)`;
  resultBanner.hidden = false;
  startButton.innerHTML = 'REINTENTAR <span>↗</span>';

  cleanGameState();
  updateWalletUI();
  overlay.classList.remove('hidden');
}

// ==========================================
// ACCIÓN DE TOQUE EN PARTIDA
// ==========================================
function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d < -Math.PI) d += Math.PI * 2;
  if (d > Math.PI) d -= Math.PI * 2;
  return d;
}

function handleAction() {
  if (mode !== 'playing') return;

  if (selectedMode === 'sequence') {
    const diff = Math.abs(angleDiff(angle, seqTargetAngle));
    const r = rings[0];
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;

    if (diff <= seqArcWidth / 2) {
      // Acierto dentro del sector
      streak++;
      seqHitsInLevel++;
      const pts = Math.round((1 + Math.floor(streak / 4)) * scoreMultiplier);
      score += pts;
      photons += Math.round(1 * scoreMultiplier);
      scoreEl.textContent = score;
      setStreak();
      updateWalletUI();
      playSound('lock');
      vibrate(20);
      burst(px, py, true, 8);
      spawnFloatText(`+${pts}`, px, py, scoreMultiplier > 1);

      seqLocks.push(angle);
      if (seqLocks.length > 6) seqLocks.shift();

      // Cada 5 aciertos sube de nivel, invierte giro y limpia marcas
      if (seqHitsInLevel >= 5) {
        seqHitsInLevel = 0;
        level++;
        direction *= -1;
        seqLocks = [];
        levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
        reverseBanner.classList.add('show');
        setTimeout(() => reverseBanner.classList.remove('show'), 1100);
      }
      spawnNextSequenceTarget();
    } else {
      // Fallo fuera del sector
      burst(px, py, true, 16);
      finish();
    }
  } else {
    // Cambio de carril en Órbita y Evolución
    targetLane = (targetLane + 1) % rings.length;
    playSound('switch');
    vibrate(18);
  }
}

shell.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, #board, #shop-modal, #update-modal, #pause-modal, #overlay:not(.hidden)')) return;
  if (mode === 'playing') {
    handleAction();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (mode === 'playing' || mode === 'paused') togglePause();
    return;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    if (mode === 'playing') {
      handleAction();
    } else if (mode === 'ready' || mode === 'over') {
      if (boardEl.hidden && shopModal.hidden && document.querySelector('#update-modal').hidden) {
        begin();
      }
    }
  }
});

startButton.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); begin(); });
document.querySelector('#open-board').addEventListener('click', (e) => { e.stopPropagation(); renderBoard(); boardEl.hidden = false; });
document.querySelector('#close-board').addEventListener('click', (e) => { e.stopPropagation(); boardEl.hidden = true; });

// ==========================================
// GENERACIÓN DE PATRONES Y PARTÍCULAS
// ==========================================
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
      size: 2 + Math.random() * 2
    });
  }
}

function addOrbitPattern() {
  const ahead = 2.05;
  const numLanes = rings.length;
  const laneChoice = Math.floor(Math.random() * numLanes);
  const otherLane = (laneChoice + 1) % numLanes;

  const add = (offset, ring, type, moving = false) => {
    objects.push({
      a: angle + (ahead + offset) * direction,
      ring,
      type,
      moving,
      moveDir: 1,
      hit: false
    });
  };

  const roll = Math.random();

  if (selectedMode === 'evolution' && roll < 0.15) {
    const pTypes = ['shield', 'magnet', 'slow'];
    add(0, laneChoice, pTypes[Math.floor(Math.random() * pTypes.length)]);
    return;
  }

  if (roll < 0.45) {
    add(0, laneChoice, 'hazard', selectedMode === 'evolution' && level >= 3 && Math.random() < 0.35);
    add(0.24, otherLane, 'spark');
  } else if (roll < 0.78) {
    add(0, laneChoice, 'spark');
    add(0.22, otherLane, 'hazard');
    add(0.44, laneChoice, 'spark');
  } else {
    add(0, laneChoice, 'hazard');
    add(0.28, otherLane, 'hazard');
  }
}

function norm(a) {
  return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

// ==========================================
// BUCLE PRINCIPAL DE ACTUALIZACIÓN (UPDATE)
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

  if (shake > 0.1) shake *= 0.86;
  else shake = 0;

  if (mode !== 'playing') return;

  elapsed += dt;
  timerEl.textContent = formatTime(elapsed);

  // ----------------------------------------
  // MODO 03 · SECUENCIA
  // ----------------------------------------
  if (selectedMode === 'sequence') {
    const speed = (1.6 + Math.min((level - 1) * 0.22, 2.2)) * (selectedDiff === 'hard' ? 1.25 : 1);
    angle += speed * dt * direction;

    const r = rings[0];
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    trail.unshift({ x: px, y: py, alpha: 1 });
    if (trail.length > 10) trail.pop();
    for (const t of trail) t.alpha -= dt * 3;
    trail = trail.filter(t => t.alpha > 0);

    // Si se pasa completamente del objetivo sin pulsar
    const diff = angleDiff(angle, seqTargetAngle) * direction;
    if (diff > seqArcWidth / 2 + 0.12) {
      burst(px, py, true, 16);
      finish();
    }
    return;
  }

  // ----------------------------------------
  // MODOS 01 · ÓRBITA & 02 · EVOLUCIÓN
  // ----------------------------------------
  const shape = getGeometryType();
  const destRadius = rings[targetLane] || rings[0];
  currentRadius += (destRadius - currentRadius) * Math.min(1, dt * 20);

  if (magnetTimer > 0) {
    magnetTimer -= dt;
    hudMagnet.hidden = false;
  } else { hudMagnet.hidden = true; }

  if (slowTimer > 0) {
    slowTimer -= dt;
    hudSlow.hidden = false;
  } else { hudSlow.hidden = true; }

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
    }
  }

  const baseSpeed = 1.45 + Math.min((level - 1) * 0.15, 1.5);
  angle += baseSpeed * effectiveDt * direction;

  spawnClock -= effectiveDt;
  if (spawnClock <= 0) {
    addOrbitPattern();
    spawnClock = Math.max(0.46, 1.22 - (level - 1) * 0.08);
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

    if (Math.hypot(px - ox, py - oy) < 18) {
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
        photons += Math.round(1 * scoreMultiplier);
        scoreEl.textContent = score;
        setStreak();
        updateWalletUI();
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
    const diff = (o.a - angle) * direction;
    return diff > -Math.PI * 0.6 && diff < Math.PI * 2.2 && !o.hit;
  });

  for (const t of trail) t.alpha -= dt * 2.5;
  trail = trail.filter(t => t.alpha > 0);
}

// ==========================================
// RENDERIZADO MINIMALISTA BENTO (DRAW)
// ==========================================
function drawNodeShape(x, y, rot, pal) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = pal.ink;
  ctx.strokeStyle = pal.bg;
  ctx.lineWidth = 2;

  if (equippedSkin === 'square') {
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeRect(-7, -7, 14, 14);
  } else if (equippedSkin === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(9, 0); ctx.lineTo(0, 9); ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (equippedSkin === 'ring') {
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.bg;
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (equippedSkin === 'cross') {
    ctx.fillRect(-8, -2.5, 16, 5);
    ctx.fillRect(-2.5, -8, 5, 16);
  } else {
    // Punto clásico
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  const pal = getPalette();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  if (shake > 0.1) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // Cuadrícula técnica sutil de fondo
  ctx.strokeStyle = pal.borderSoft;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.45;
  const gridStep = 44;
  for (let gx = cx % gridStep; gx < w; gx += gridStep) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
  }
  for (let gy = cy % gridStep; gy < h; gy += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ----------------------------------------
  // RENDER MODO 03 · SECUENCIA
  // ----------------------------------------
  if (mode === 'playing' && selectedMode === 'sequence') {
    const r = rings[0];

    // Anillo base fino
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = pal.borderSoft;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sector objetivo (Arco grueso en tinta negra)
    ctx.beginPath();
    ctx.arc(cx, cy, r, seqTargetAngle - seqArcWidth / 2, seqTargetAngle + seqArcWidth / 2);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 14;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // Marcas de aciertos anteriores en el nivel
    for (const lockAng of seqLocks) {
      const lx = cx + Math.cos(lockAng) * r;
      const ly = cy + Math.sin(lockAng) * r;
      ctx.fillStyle = pal.accent;
      ctx.fillRect(lx - 4, ly - 4, 8, 8);
    }

    // Centro con contador de aciertos del nivel
    ctx.fillStyle = pal.ink;
    ctx.font = '700 28px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${seqHitsInLevel}/5`, cx, cy);

    // Puntero giratorio
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    drawNodeShape(px, py, angle + Math.PI / 2, pal);

  } else {
    // ----------------------------------------
    // RENDER ÓRBITA / EVOLUCIÓN Y FONDO EN REPOSO
    // ----------------------------------------
    const shape = getGeometryType();

    // Punto central de referencia
    ctx.fillStyle = pal.ink;
    ctx.fillRect(cx - 3, cy - 3, 6, 6);

    // Anillos orbitales
    for (let ringIdx = 0; ringIdx < rings.length; ringIdx++) {
      const baseR = rings[ringIdx];
      ctx.beginPath();
      const steps = shape === 'circle' ? 72 : 80;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const r = baseR * getRadiusModifier(theta, shape);
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const activeRing = (targetLane === ringIdx && mode === 'playing');
      ctx.strokeStyle = activeRing ? pal.ink : pal.borderSoft;
      ctx.lineWidth = activeRing ? 2 : 1.5;
      ctx.stroke();
    }

    // Solo dibujar elementos dinámicos si la partida está activa
    if (mode === 'playing') {
      // Obstáculos y fichas
      for (const obj of objects) {
        const rBase = rings[Math.round(obj.ring)] || rings[0];
        const r = rBase * getRadiusModifier(obj.a, shape);
        const x = cx + Math.cos(obj.a) * r;
        const y = cy + Math.sin(obj.a) * r;

        if (obj.type === 'hazard') {
          // Bloque rojo bermellón afilado
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(obj.a + Math.PI / 4);
          ctx.fillStyle = pal.accent;
          ctx.fillRect(-7.5, -7.5, 15, 15);
          ctx.restore();
        } else if (obj.type === 'spark') {
          // Nodo coleccionable
          ctx.fillStyle = pal.bg;
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          // Power-up minimalista (cuadrado con inicial)
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

      // Estela del nodo
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        ctx.globalAlpha = t.alpha * 0.35;
        ctx.fillStyle = equippedTrail === 'accent' ? pal.accent : pal.ink;
        if (equippedTrail === 'dots') {
          if (i % 2 === 0) ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
        } else {
          ctx.beginPath();
          ctx.arc(t.x, t.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Nodo del jugador
      const playerR = currentRadius * getRadiusModifier(angle, shape);
      const px = cx + Math.cos(angle) * playerR;
      const py = cy + Math.sin(angle) * playerR;

      drawNodeShape(px, py, angle + Math.PI / 2, pal);

      // Aro de escudo si está activo
      if (shieldActive) {
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // Partículas
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.isAccent ? pal.accent : pal.ink;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Textos flotantes
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
const closeUpdateBtn = document.querySelector('#close-update');
const dontShowCheck = document.querySelector('#dont-show-check');
if (localStorage.getItem('bento-dismissed-version') !== CURRENT_VERSION) {
  updateModal.hidden = false;
}
closeUpdateBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (dontShowCheck.checked) localStorage.setItem('bento-dismissed-version', CURRENT_VERSION);
  updateModal.hidden = true;
});

requestAnimationFrame(frame);
