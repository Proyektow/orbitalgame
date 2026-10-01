// CONTROL DE VERSIÓN: 2.5.0
const CURRENT_VERSION = '2.5.0';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#start');
const gameTopBar = document.querySelector('#game-topbar');
const scoreEl = document.querySelector('#score');
const scoreLabelEl = document.querySelector('#score-label');
const bestEl = document.querySelector('#best');
const streakEl = document.querySelector('#streak');
const levelEl = document.querySelector('#level');
const statusEl = document.querySelector('#status');
const timerEl = document.querySelector('#timer');
const hudPhotonsEl = document.querySelector('#hud-photons');
const menuPhotonsEl = document.querySelector('#menu-photons');
const shopPhotonsEl = document.querySelector('#shop-photons');

const boardEl = document.querySelector('#board');
const runListEl = document.querySelector('#run-list');
const emptyBoardEl = document.querySelector('#empty-board');
const flashEl = document.querySelector('#flash');
const shell = document.querySelector('.game-shell');
const reverseBanner = document.querySelector('#reverse-banner');
const diffContainer = document.querySelector('#diff-container');
const controlContainer = document.querySelector('#control-container');

// Elementos de Control Modo Constelación
const constControls = document.querySelector('#const-controls');
const joystickZone = document.querySelector('#joystick-zone');
const joystickKnob = document.querySelector('#joystick-knob');
const boostBtn = document.querySelector('#boost-btn');

// Tienda y Modal
const shopModal = document.querySelector('#shop-modal');
const openShopBtn = document.querySelector('#open-shop');
const closeShopBtn = document.querySelector('#close-shop');
const skinGrid = document.querySelector('#skin-grid');
const themeGrid = document.querySelector('#theme-grid');

// HUD Power-ups
const hudShield = document.querySelector('#hud-shield');
const hudMagnet = document.querySelector('#hud-magnet');
const hudSlow = document.querySelector('#hud-slow');

// ==========================================
// SISTEMA DE AUDIO PROCEDURAL (SYNTHWAVE)
// ==========================================
let audioCtx = null;
let musicInterval = null;
let bassStep = 0;
const bassNotes = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 98]; // A2 escala pentatónica

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function startMusic() {
  stopMusic();
  bassStep = 0;
  const bpm = 125;
  const stepTime = (60 / bpm) / 2 * 1000; // semicorcheas
  musicInterval = setInterval(() => {
    if (mode === 'playing') playBassTone();
  }, stepTime);
}

function stopMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

function playBassTone() {
  try {
    initAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sawtooth';
    const freq = bassNotes[bassStep % bassNotes.length];
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.16);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
    bassStep++;
  } catch {}
}

function playSound(type) {
  try {
    initAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'switch' || type === 'jump') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'collect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {}
}

function vibrate(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

// ==========================================
// TIENDA Y ECONOMÍA (FOTONES)
// ==========================================
let photons = Number(localStorage.getItem('orbita-photons') || 0);
let equippedSkin = localStorage.getItem('orbita-skin') || 'core';
let equippedTheme = localStorage.getItem('orbita-theme') || 'default';
let ownedSkins = JSON.parse(localStorage.getItem('orbita-owned-skins') || '["core"]');
let ownedThemes = JSON.parse(localStorage.getItem('orbita-owned-themes') || '["default"]');

const SKINS = [
  { id: 'core', name: 'Núcleo', price: 0, icon: '⚪' },
  { id: 'pulse', name: 'Triángulo', price: 80, icon: '▲' },
  { id: 'vortex', name: 'Vórtice', price: 150, icon: '🌀' }
];

const THEMES = [
  { id: 'default', name: 'Neón Puro', price: 0, class: '' },
  { id: 'vaporwave', name: 'Vaporwave', price: 100, class: 'theme-vaporwave' },
  { id: 'cyberpunk', name: 'Cyberpunk', price: 180, class: 'theme-cyberpunk' }
];

function updateWalletUI() {
  localStorage.setItem('orbita-photons', photons);
  hudPhotonsEl.textContent = `${photons} ✦`;
  menuPhotonsEl.textContent = `${photons} ✦ FOTONES`;
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
        <span style="font-size:18px">${s.icon}</span>
        <span class="shop-item-name">${s.name}</span>
        <span class="shop-item-price">${eq ? 'EQUIPADO' : (owned ? 'USAR' : s.price + ' ✦')}</span>
      </div>
    `;
  }).join('');

  themeGrid.innerHTML = THEMES.map(t => {
    const owned = ownedThemes.includes(t.id);
    const eq = equippedTheme === t.id;
    return `
      <div class="shop-item ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''}" data-buy-theme="${t.id}">
        <span class="shop-item-name">${t.name}</span>
        <span class="shop-item-price">${eq ? 'EQUIPADO' : (owned ? 'USAR' : t.price + ' ✦')}</span>
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
    localStorage.setItem('orbita-skin', id);
  } else if (photons >= skin.price) {
    photons -= skin.price;
    ownedSkins.push(id);
    equippedSkin = id;
    localStorage.setItem('orbita-skin', id);
    localStorage.setItem('orbita-owned-skins', JSON.stringify(ownedSkins));
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
    localStorage.setItem('orbita-theme', id);
    applyTheme(id);
  } else if (photons >= theme.price) {
    photons -= theme.price;
    ownedThemes.push(id);
    equippedTheme = id;
    localStorage.setItem('orbita-theme', id);
    localStorage.setItem('orbita-owned-themes', JSON.stringify(ownedThemes));
    applyTheme(id);
  }
  renderShop();
});

openShopBtn.addEventListener('click', (e) => { e.stopPropagation(); renderShop(); shopModal.hidden = false; });
closeShopBtn.addEventListener('click', (e) => { e.stopPropagation(); shopModal.hidden = true; });

// ==========================================
// VARIABLES DE JUEGO GENERALES
// ==========================================
let selectedMode = 'classic'; // 'classic' | 'evolution' | 'constellation' | 'pulse'
let selectedDiff = 'easy';
let selectedControl = localStorage.getItem('orbita-control') || 'follow';
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

let shieldActive = false;
let magnetTimer = 0;
let slowTimer = 0;
let objects = [], particles = [], floatTexts = [];

// Modo Constelación
const MAP_SIZE = 1800;
let playerSnake = null;
let bots = [];
let foodOrbs = [];
let isBoosting = false;
let joystickVec = { x: 0, y: 0 };
let joyActive = false;
let joyCenter = { x: 0, y: 0 };
let joyPointerId = null;

// ==========================================
// MODO PULSO (GEOMETRY DASH HORIZONTAL)
// ==========================================
let pulseY = 0;
let pulseVy = 0;
let pulseGravity = 1200;
let pulseFloor = 0;
let pulseCeil = 0;
let pulseObstacles = [];
let pulseSpeed = 290;

// Persistencia
let best = Number(localStorage.getItem('orbita-best') || 0);
let attemptCount = Number(localStorage.getItem('orbita-attempts') || 0);
let runs = [];
try { runs = JSON.parse(localStorage.getItem('orbita-runs') || '[]'); } catch { runs = []; }

bestEl.textContent = best;
updateWalletUI();

const stars = Array.from({ length: 60 }, () => ({
  x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3, a: Math.random() * 0.4 + 0.1, phase: Math.random() * Math.PI * 2
}));

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = shell.clientWidth || window.innerWidth;
  h = shell.clientHeight || window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  cx = w / 2;
  cy = h * 0.51;

  const baseOuter = Math.min(w, h) * 0.35;
  if (selectedMode === 'evolution' && level >= 3) {
    rings = [baseOuter, baseOuter * 0.73, baseOuter * 0.48];
  } else {
    rings = [baseOuter, baseOuter * 0.65];
  }

  if (currentRadius === 0) currentRadius = rings[0];

  // Configuración de límites modo Pulso
  pulseFloor = h * 0.76;
  pulseCeil = h * 0.24;
}
window.addEventListener('resize', resize);
resize();

function spawnFloatText(text, x, y, color = '#6df7e8') {
  floatTexts.push({ text, x, y, vy: -35, alpha: 1, color });
}

// Selectores UI
document.querySelectorAll('#mode-group .opt-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#mode-group .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    diffContainer.hidden = (selectedMode !== 'evolution');
    controlContainer.hidden = (selectedMode !== 'constellation');
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

document.querySelectorAll('#control-group .opt-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#control-group .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedControl = btn.dataset.control;
    localStorage.setItem('orbita-control', selectedControl);
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

function renderBoard() {
  let filtered = [...runs];
  if (activeFilter !== 'all') filtered = filtered.filter(r => (r.mode || 'classic') === activeFilter);
  const sorted = filtered.sort((a, b) => b.score - a.score || b.seconds - a.seconds).slice(0, 10);
  runListEl.innerHTML = sorted.map(run => `
    <li class="run-row">
      <span>${(run.mode || 'CLÁSICO').toUpperCase()}<small>${run.mode === 'constellation' ? 'LONGITUD' : 'NIVEL ' + String(run.level).padStart(2, '0')} · #${run.attempt}</small></span>
      <span>${run.score}</span>
      <span>${formatTime(run.seconds)}</span>
    </li>
  `).join('');
  emptyBoardEl.hidden = sorted.length > 0;
}

function createSnake(x, y, color, isPlayer = false) {
  const segments = [];
  for (let i = 0; i < 18; i++) segments.push({ x: x - i * 8, y });
  return {
    x, y,
    angle: isPlayer ? 0 : Math.random() * Math.PI * 2,
    speed: 135,
    targetAngle: 0,
    segments,
    length: 18,
    color,
    isPlayer,
    alive: true,
    boostClock: 0
  };
}

function begin() {
  attemptCount++;
  localStorage.setItem('orbita-attempts', attemptCount);
  initAudio();
  startMusic();

  mode = 'playing';
  score = 0;
  streak = 0;
  elapsed = 0;
  shake = 0;
  scoreEl.textContent = '0';
  timerEl.textContent = '00:00';
  gameTopBar.hidden = false;
  boardEl.hidden = true;
  shopModal.hidden = true;
  overlay.classList.add('hidden');

  if (selectedMode === 'constellation') {
    scoreLabelEl.textContent = 'LONGITUD';
    levelEl.textContent = 'ARENA LIBRE';
    statusEl.textContent = 'SUPERVIVENCIA';
    streakEl.style.display = 'none';

    constControls.hidden = false;
    joystickZone.style.display = (selectedControl === 'joystick') ? 'block' : 'none';

    playerSnake = createSnake(MAP_SIZE / 2, MAP_SIZE / 2, '#6df7e8', true);
    bots = [];
    const botColors = ['#ff5b87', '#bd93f9', '#fdd835', '#ff9a3c', '#50fa7b'];
    for (let i = 0; i < 5; i++) {
      bots.push(createSnake(Math.random() * (MAP_SIZE - 200) + 100, Math.random() * (MAP_SIZE - 200) + 100, botColors[i], false));
    }
    foodOrbs = [];
    for (let i = 0; i < 90; i++) {
      foodOrbs.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, r: 2.5 + Math.random() * 2.5, color: Math.random() < 0.6 ? '#6df7e8' : '#ff5b87' });
    }

  } else if (selectedMode === 'pulse') {
    scoreLabelEl.textContent = 'PUNTOS';
    levelEl.textContent = 'PULSO RÍTMICO';
    statusEl.textContent = 'MODO RITMO';
    streakEl.style.display = 'none';
    constControls.hidden = true;

    pulseY = pulseFloor - 12;
    pulseVy = 0;
    pulseObstacles = [];
    spawnClock = 1;

  } else {
    // Clásico y Evolución
    scoreLabelEl.textContent = 'PUNTOS';
    streakEl.style.display = 'flex';
    constControls.hidden = true;
    angle = -Math.PI / 2;
    direction = 1;
    targetLane = 0;
    level = selectedMode === 'evolution' && selectedDiff === 'hard' ? 4 : (selectedMode === 'evolution' && selectedDiff === 'normal' ? 2 : 1);
    spawnClock = 0.5;
    reverseTimer = 18;
    shieldActive = false;
    magnetTimer = 0;
    slowTimer = 0;
    hudShield.hidden = true;
    hudMagnet.hidden = true;
    hudSlow.hidden = true;
    objects = [];
    particles = [];
    trail = [];
    resize();
    currentRadius = rings[0];
    levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
    statusEl.textContent = 'SISTEMA ACTIVO';
  }
}

function finish() {
  if (mode !== 'playing') return;
  mode = 'over';
  shake = 16;
  stopMusic();
  playSound('hit');
  vibrate([80, 50, 120]);

  constControls.hidden = true;
  joyActive = false;
  isBoosting = false;

  flashEl.classList.remove('hit');
  void flashEl.offsetWidth;
  flashEl.classList.add('hit');

  statusEl.textContent = 'SEÑAL PERDIDA';
  runs.push({ attempt: attemptCount, score, seconds: Math.floor(elapsed), level, mode: selectedMode });
  runs = runs.slice(-40);
  localStorage.setItem('orbita-runs', JSON.stringify(runs));
  renderBoard();

  if (score > best) {
    best = score;
    localStorage.setItem('orbita-best', best);
    bestEl.textContent = best;
  }

  gameTopBar.hidden = true;
  document.querySelector('#eyebrow').textContent = 'FIN DEL VIAJE';
  document.querySelector('#headline').textContent = `${score} pts`;
  document.querySelector('#subline').innerHTML = `Modo ${selectedMode.toUpperCase()} · +${Math.floor(score / 5)} Fotones ganados`;
  startButton.innerHTML = 'REINTENTAR <span>↗</span>';
  updateWalletUI();
  overlay.classList.remove('hidden');
}

// ========================================================
// CONTROLES TÁCTILES Y JOYSTICK MATEMÁTICAMENTE CORREGIDOS
// ========================================================

function handleTouchDirection(clientX, clientY) {
  if (!playerSnake || mode !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / (rect.width * dpr);
  const scaleY = canvas.height / (rect.height * dpr);

  // Posición relativa al centro de la pantalla (donde está centrado el jugador)
  const touchCenterX = (clientX - rect.left) * scaleX - (w / 2);
  const touchCenterY = (clientY - rect.top) * scaleY - (h / 2);

  if (Math.hypot(touchCenterX, touchCenterY) > 12) {
    playerSnake.targetAngle = Math.atan2(touchCenterY, touchCenterX);
  }
}

// Joystick corregido
joystickZone.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  joyActive = true;
  joyPointerId = e.pointerId;
  joystickZone.setPointerCapture(e.pointerId);
  const rect = joystickZone.getBoundingClientRect();
  joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  calcJoy(e.clientX, e.clientY);
});

joystickZone.addEventListener('pointermove', (e) => {
  if (joyActive && e.pointerId === joyPointerId) calcJoy(e.clientX, e.clientY);
});

function calcJoy(px, py) {
  const dx = px - joyCenter.x;
  const dy = py - joyCenter.y;
  const dist = Math.hypot(dx, dy);
  const maxR = 40;
  const angle = Math.atan2(dy, dx);
  const clamp = Math.min(dist, maxR);
  joystickKnob.style.transform = `translate(${Math.cos(angle) * clamp}px, ${Math.sin(angle) * clamp}px)`;
  if (dist > 6) {
    joystickVec = { x: Math.cos(angle), y: Math.sin(angle) };
  } else {
    joystickVec = { x: 0, y: 0 };
  }
}

const endJoy = () => {
  joyActive = false;
  joystickKnob.style.transform = 'translate(0px, 0px)';
  joystickVec = { x: 0, y: 0 };
};
joystickZone.addEventListener('pointerup', endJoy);
joystickZone.addEventListener('pointercancel', endJoy);

// Turbo
boostBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); isBoosting = true; boostBtn.classList.add('active'); });
const endBoost = () => { isBoosting = false; boostBtn.classList.remove('active'); };
boostBtn.addEventListener('pointerup', endBoost);
boostBtn.addEventListener('pointercancel', endBoost);

// Pantalla principal para interactuar
shell.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, #board, #shop-modal, #update-modal, #overlay:not(.hidden), .const-controls')) return;

  if (mode === 'playing') {
    if (selectedMode === 'constellation') {
      if (selectedControl === 'follow') handleTouchDirection(e.clientX, e.clientY);
    } else if (selectedMode === 'pulse') {
      // Salto en modo Pulso
      if (Math.abs(pulseY - (pulseFloor - 12)) < 4 || Math.abs(pulseY - (pulseCeil + 12)) < 4) {
        pulseVy = pulseGravity > 0 ? -480 : 480;
        playSound('jump');
        vibrate(20);
      }
    } else {
      // Cambio de carril en clásicos
      targetLane = (targetLane + 1) % rings.length;
      playSound('switch');
      vibrate(25);
    }
  } else if (mode === 'over') {
    begin();
  }
});

shell.addEventListener('pointermove', (e) => {
  if (mode === 'playing' && selectedMode === 'constellation' && selectedControl === 'follow') {
    handleTouchDirection(e.clientX, e.clientY);
  }
});

// Teclado
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    if (mode === 'playing') {
      if (selectedMode === 'constellation') {
        if (e.code === 'Space') isBoosting = true;
      } else if (selectedMode === 'pulse') {
        if (Math.abs(pulseY - (pulseFloor - 12)) < 4 || Math.abs(pulseY - (pulseCeil + 12)) < 4) {
          pulseVy = pulseGravity > 0 ? -480 : 480;
          playSound('jump');
        }
      } else {
        targetLane = (targetLane + 1) % rings.length;
        playSound('switch');
      }
    } else if (mode === 'over') {
      begin();
    }
  }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') isBoosting = false; });

startButton.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); begin(); });
document.querySelector('#open-board').addEventListener('click', (e) => { e.stopPropagation(); renderBoard(); boardEl.hidden = false; });
document.querySelector('#close-board').addEventListener('click', (e) => { e.stopPropagation(); boardEl.hidden = true; });

// ==========================================
// BUCLES DE ACTUALIZACIÓN (UPDATE)
// ==========================================
function update(dt) {
  if (mode !== 'playing') {
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    shake *= 0.85;
    return;
  }

  elapsed += dt;
  timerEl.textContent = formatTime(elapsed);

  // Textos flotantes
  for (const ft of floatTexts) {
    ft.y += ft.vy * dt;
    ft.alpha -= dt * 1.5;
  }
  floatTexts = floatTexts.filter(ft => ft.alpha > 0);

  // ----------------------------------------
  // MODO PULSO (GEOMETRY DASH)
  // ----------------------------------------
  if (selectedMode === 'pulse') {
    pulseVy += pulseGravity * dt;
    pulseY += pulseVy * dt;

    if (pulseY >= pulseFloor - 12) { pulseY = pulseFloor - 12; pulseVy = 0; }
    if (pulseY <= pulseCeil + 12) { pulseY = pulseCeil + 12; pulseVy = 0; }

    score += Math.floor(dt * 30);
    scoreEl.textContent = score;

    spawnClock -= dt;
    if (spawnClock <= 0) {
      const type = Math.random() < 0.65 ? 'spike' : 'portal';
      pulseObstacles.push({ x: w + 40, type, passed: false });
      spawnClock = 1.05 + Math.random() * 0.7;
    }

    const playerX = w * 0.25;
    for (const ob of pulseObstacles) {
      ob.x -= pulseSpeed * dt;

      // Colisión con pincho triangular
      if (ob.type === 'spike') {
        if (Math.abs(ob.x - playerX) < 16 && pulseY > pulseFloor - 26) {
          finish();
          break;
        }
      } else if (ob.type === 'portal') {
        // Portal que invierte la gravedad
        if (Math.abs(ob.x - playerX) < 20 && !ob.passed) {
          ob.passed = true;
          pulseGravity *= -1;
          playSound('collect');
          spawnFloatText('¡GRAVEDAD!', playerX, pulseY, '#bd93f9');
          vibrate(40);
        }
      }

      // Recompensa de fotones por sortear
      if (!ob.passed && ob.x < playerX) {
        ob.passed = true;
        photons += 1;
        updateWalletUI();
      }
    }
    pulseObstacles = pulseObstacles.filter(ob => ob.x > -50);
    return;
  }

  // ----------------------------------------
  // MODO CONSTELACIÓN
  // ----------------------------------------
  if (selectedMode === 'constellation') {
    if (selectedControl === 'joystick' && (joystickVec.x !== 0 || joystickVec.y !== 0)) {
      playerSnake.targetAngle = Math.atan2(joystickVec.y, joystickVec.x);
    }
    updateSnake(playerSnake, dt);
    score = Math.floor(playerSnake.length * 10);
    scoreEl.textContent = score;

    for (const b of bots) updateSnake(b, dt);
    bots = bots.filter(b => b.alive);

    // Comer orbes
    for (let i = foodOrbs.length - 1; i >= 0; i--) {
      const f = foodOrbs[i];
      if (Math.hypot(playerSnake.x - f.x, playerSnake.y - f.y) < 16) {
        playerSnake.length += 0.8;
        foodOrbs.splice(i, 1);
        photons += 1;
        updateWalletUI();
        playSound('collect');
        vibrate(15);
        continue;
      }
      for (const b of bots) {
        if (Math.hypot(b.x - f.x, b.y - f.y) < 16) {
          b.length += 0.6;
          foodOrbs.splice(i, 1);
          break;
        }
      }
    }

    while (foodOrbs.length < 90) {
      foodOrbs.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, r: 2.5 + Math.random() * 2.5, color: Math.random() < 0.6 ? '#6df7e8' : '#ff5b87' });
    }

    // Colisiones
    for (const b of bots) {
      for (let i = 2; i < b.segments.length; i++) {
        if (Math.hypot(playerSnake.x - b.segments[i].x, playerSnake.y - b.segments[i].y) < 10) {
          finish();
          return;
        }
      }
      for (let i = 2; i < playerSnake.segments.length; i++) {
        if (Math.hypot(b.x - playerSnake.segments[i].x, b.y - playerSnake.segments[i].y) < 10) {
          b.alive = false;
          photons += 10;
          spawnFloatText('+10 ✦', b.x, b.y, '#fdd835');
          updateWalletUI();
          playSound('collect');
          vibrate(50);
          break;
        }
      }
    }
    return;
  }

  // ----------------------------------------
  // MODOS CLÁSICO Y EVOLUCIÓN
  // ----------------------------------------
  const destRadius = rings[targetLane] || rings[0];
  currentRadius += (destRadius - currentRadius) * Math.min(1, dt * 18);

  const timeScale = slowTimer > 0 ? 0.5 : 1;
  const effectiveDt = dt * timeScale;
  angle += (1.35 + Math.min((level - 1) * 0.14, 1.4)) * effectiveDt * direction;

  spawnClock -= effectiveDt;
  if (spawnClock <= 0) {
    const laneChoice = Math.floor(Math.random() * rings.length);
    const otherLane = (laneChoice + 1) % rings.length;
    objects.push({ a: angle + 2.0 * direction, ring: laneChoice, type: 'hazard', hit: false, spin: Math.random() * 6 });
    objects.push({ a: angle + 2.25 * direction, ring: otherLane, type: 'spark', hit: false, spin: 0 });
    spawnClock = Math.max(0.48, 1.25 - (level - 1) * 0.08);
  }

  const px = cx + Math.cos(angle) * currentRadius;
  const py = cy + Math.sin(angle) * currentRadius;
  trail.unshift({ x: px, y: py, alpha: 1 });
  if (trail.length > 12) trail.pop();

  for (const obj of objects) {
    if (obj.hit) continue;
    const r = rings[obj.ring];
    const ox = cx + Math.cos(obj.a) * r;
    const oy = cy + Math.sin(obj.a) * r;

    if (Math.hypot(px - ox, py - oy) < 18) {
      if (obj.type === 'hazard') {
        finish();
        break;
      } else {
        obj.hit = true;
        score += 1;
        photons += 1;
        updateWalletUI();
        playSound('collect');
        vibrate(20);
        spawnFloatText('+1', ox, oy);
      }
    }
  }
  objects = objects.filter(o => !o.hit);
}

function updateSnake(snake, dt) {
  if (!snake.alive) return;
  const spd = (snake.isPlayer && isBoosting && snake.length > 8) ? snake.speed * 1.9 : snake.speed;
  let diff = snake.targetAngle - snake.angle;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  snake.angle += diff * Math.min(1, dt * 7.5);
  snake.x += Math.cos(snake.angle) * spd * dt;
  snake.y += Math.sin(snake.angle) * spd * dt;

  if (snake.x < 10 || snake.x > MAP_SIZE - 10 || snake.y < 10 || snake.y > MAP_SIZE - 10) {
    if (snake.isPlayer) finish();
    else snake.alive = false;
  }
  snake.segments.unshift({ x: snake.x, y: snake.y });
  while (snake.segments.length > Math.floor(snake.length)) snake.segments.pop();
}

// ==========================================
// RENDERIZADO VISUAL (DRAW)
// ==========================================
function draw(time) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  if (shake > 0.1) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // ----------------------------------------
  // DIBUJO MODO PULSO (DASH)
  // ----------------------------------------
  if (selectedMode === 'pulse') {
    // Líneas de suelo y techo
    ctx.strokeStyle = 'var(--cyan)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'var(--cyan)';

    ctx.beginPath();
    ctx.moveTo(0, pulseFloor); ctx.lineTo(w, pulseFloor);
    ctx.moveTo(0, pulseCeil); ctx.lineTo(w, pulseCeil);
    ctx.stroke();

    // Obstáculos
    for (const ob of pulseObstacles) {
      if (ob.type === 'spike') {
        ctx.fillStyle = 'var(--pink)';
        ctx.shadowColor = 'var(--pink)';
        ctx.beginPath();
        ctx.moveTo(ob.x - 14, pulseFloor);
        ctx.lineTo(ob.x + 14, pulseFloor);
        ctx.lineTo(ob.x, pulseFloor - 24);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = 'var(--purple)';
        ctx.shadowColor = 'var(--purple)';
        ctx.beginPath();
        ctx.arc(ob.x, (pulseFloor + pulseCeil) / 2, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Jugador (Cubo/Nave con rotación según velocidad)
    const px = w * 0.25;
    ctx.save();
    ctx.translate(px, pulseY);
    ctx.rotate(pulseVy * 0.002);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'var(--cyan)';
    ctx.shadowBlur = 16;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();

  } else if (selectedMode === 'constellation' && playerSnake) {
    // ----------------------------------------
    // DIBUJO MODO CONSTELACIÓN
    // ----------------------------------------
    const camX = w / 2 - playerSnake.x;
    const camY = h / 2 - playerSnake.y;
    ctx.save();
    ctx.translate(camX, camY);

    // Muros
    ctx.strokeStyle = 'rgba(255, 91, 135, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

    for (const f of foodOrbs) {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const allSnakes = [...bots, playerSnake];
    for (const s of allSnakes) {
      if (!s.alive) continue;
      ctx.fillStyle = s.color;
      for (const seg of s.segments) {
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

  } else {
    // ----------------------------------------
    // DIBUJO MODOS CLÁSICO / EVOLUCIÓN
    // ----------------------------------------
    for (const s of stars) {
      ctx.fillStyle = '#d4dcff';
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (let r of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(98, 105, 138, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const obj of objects) {
      const r = rings[obj.ring];
      const ox = cx + Math.cos(obj.a) * r;
      const oy = cy + Math.sin(obj.a) * r;
      ctx.fillStyle = obj.type === 'hazard' ? 'var(--pink)' : 'var(--cyan)';
      ctx.beginPath();
      ctx.arc(ox, oy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    const px = cx + Math.cos(angle) * currentRadius;
    const py = cy + Math.sin(angle) * currentRadius;

    // Render del skin equipado
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'var(--cyan)';

    if (equippedSkin === 'pulse') {
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath();
      ctx.fill();
    } else if (equippedSkin === 'vortex') {
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'var(--cyan)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Textos flotantes
  for (const ft of floatTexts) {
    ctx.save();
    ctx.font = '700 13px "DM Mono", monospace';
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = ft.alpha;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();
}

function frame(now) {
  const dt = Math.min((now - (lastTime || now)) / 1000, 0.04);
  lastTime = now;
  update(dt);
  draw(now);
  requestAnimationFrame(frame);
}

// Modal update
const updateModal = document.querySelector('#update-modal');
const closeUpdateBtn = document.querySelector('#close-update');
const dontShowCheck = document.querySelector('#dont-show-check');
if (localStorage.getItem('orbita-dismissed-version') !== CURRENT_VERSION) {
  updateModal.hidden = false;
}
closeUpdateBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (dontShowCheck.checked) localStorage.setItem('orbita-dismissed-version', CURRENT_VERSION);
  updateModal.hidden = true;
});

requestAnimationFrame(frame);
