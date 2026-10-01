// CONTROL DE VERSIÓN: Subida a 2.3.0 con Modo Constelación y Selector de Controles
const CURRENT_VERSION = '2.3.0';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#start');
const scoreEl = document.querySelector('#score');
const scoreLabelEl = document.querySelector('#score-label');
const bestEl = document.querySelector('#best');
const streakEl = document.querySelector('#streak');
const levelEl = document.querySelector('#level');
const statusEl = document.querySelector('#status');
const timerEl = document.querySelector('#timer');
const attemptEl = document.querySelector('#attempt');
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

// HUD Power-ups
const hudShield = document.querySelector('#hud-shield');
const hudMagnet = document.querySelector('#hud-magnet');
const hudSlow = document.querySelector('#hud-slow');

// Opciones de juego
let selectedMode = 'classic'; // 'classic' | 'evolution' | 'constellation'
let selectedDiff = 'easy';
let selectedControl = localStorage.getItem('orbita-control') || 'follow'; // 'follow' | 'joystick'

// Sincronizar UI de selector de control
document.querySelectorAll('#control-group .opt-btn').forEach(btn => {
  if (btn.dataset.control === selectedControl) btn.classList.add('active');
  else btn.classList.remove('active');
});

// Comprobación de actualizaciones
const updateModal = document.querySelector('#update-modal');
const closeUpdateBtn = document.querySelector('#close-update');
const dontShowCheck = document.querySelector('#dont-show-check');
const updateTag = document.querySelector('#update-tag');

function checkUpdates() {
  const dismissedVersion = localStorage.getItem('orbita-dismissed-version');
  if (dismissedVersion !== CURRENT_VERSION) {
    updateTag.textContent = `VERSIÓN ${CURRENT_VERSION}`;
    updateModal.hidden = false;
  }
}

closeUpdateBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (dontShowCheck.checked) {
    localStorage.setItem('orbita-dismissed-version', CURRENT_VERSION);
  }
  updateModal.hidden = true;
});

// Selectores de interfaz
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

// Sintetizador de audio
let audioCtx = null;
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'switch') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'collect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'powerup') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
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

// Variables globales de juego
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
let objects = [], particles = [];

// ==========================================
// VARIABLES ESPECÍFICAS DE MODO CONSTELACIÓN
// ==========================================
const MAP_SIZE = 1800; // Tamaño del mundo abierto
let playerSnake = null;
let bots = [];
let foodOrbs = [];
let isBoosting = false;
let pointerTarget = { x: 0, y: 0 };
let joystickVec = { x: 0, y: 0 };
let activeTouchId = null;

// Persistencia
let best = Number(localStorage.getItem('orbita-best') || 0);
let attemptCount = Number(localStorage.getItem('orbita-attempts') || 0);
let runs = [];
try {
  runs = JSON.parse(localStorage.getItem('orbita-runs') || '[]');
  if (!Array.isArray(runs)) runs = [];
} catch { runs = []; }

bestEl.textContent = best;
attemptEl.textContent = String(attemptCount + 1).padStart(2, '0');

const stars = Array.from({ length: 60 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.3 + 0.3,
  a: Math.random() * 0.4 + 0.1,
  phase: Math.random() * Math.PI * 2
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
}
window.addEventListener('resize', resize);
resize();

function getGeometryType() {
  if (selectedMode === 'classic') return 'circle';
  if (selectedDiff === 'hard' || level >= 6) return 'octagon';
  if (selectedDiff === 'normal' || level >= 4) return 'hexagon';
  if (level >= 2) return 'ellipse';
  return 'circle';
}

function getRadiusModifier(theta, shape) {
  if (shape === 'ellipse') return 1 + 0.18 * Math.cos(2 * theta);
  if (shape === 'hexagon') return 1 + 0.08 * Math.cos(6 * theta);
  if (shape === 'octagon') return 1 + 0.1 * Math.cos(8 * theta);
  return 1;
}

function setStreak() {
  streakEl.innerHTML = Array.from({ length: 5 }, (_, i) => 
    `<span class="${i < streak % 5 ? 'on' : ''}"></span>`
  ).join('');
}
setStreak();

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function renderBoard() {
  const sorted = [...runs].sort((a, b) => b.score - a.score || b.seconds - a.seconds).slice(0, 10);
  runListEl.innerHTML = sorted.map(run => `
    <li class="run-row">
      <span>${(run.mode || 'CLÁSICO').toUpperCase()}<small>NIVEL ${String(run.level).padStart(2, '0')} · #${run.attempt}</small></span>
      <span>${run.score}</span>
      <span>${formatTime(run.seconds)}</span>
    </li>
  `).join('');
  emptyBoardEl.hidden = sorted.length > 0;
}

// Inicialización de serpiente
function createSnake(x, y, color, isPlayer = false) {
  const segments = [];
  for (let i = 0; i < 18; i++) {
    segments.push({ x: x - i * 8, y });
  }
  return {
    x, y,
    angle: isPlayer ? 0 : Math.random() * Math.PI * 2,
    speed: 130,
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
  attemptEl.textContent = String(attemptCount).padStart(2, '0');
  
  mode = 'playing';
  score = 0;
  streak = 0;
  elapsed = 0;
  scoreEl.textContent = '0';
  timerEl.textContent = '00:00';
  boardEl.hidden = true;
  overlay.classList.add('hidden');

  if (selectedMode === 'constellation') {
    scoreLabelEl.textContent = 'LONGITUD';
    levelEl.textContent = 'ARENA LIBRE';
    statusEl.textContent = 'SUPERVIVENCIA ESTELAR';
    streakEl.style.display = 'none';

    // Mostrar controles de Constelación
    constControls.hidden = false;
    joystickZone.style.display = (selectedControl === 'joystick') ? 'block' : 'none';

    // Iniciar jugador y bots
    playerSnake = createSnake(MAP_SIZE / 2, MAP_SIZE / 2, '#6df7e8', true);
    pointerTarget = { x: playerSnake.x + 100, y: playerSnake.y };
    bots = [];
    const botColors = ['#ff5b87', '#bd93f9', '#fdd835', '#ff9a3c', '#50fa7b'];
    for (let i = 0; i < 5; i++) {
      const bx = Math.random() * (MAP_SIZE - 200) + 100;
      const by = Math.random() * (MAP_SIZE - 200) + 100;
      bots.push(createSnake(bx, by, botColors[i % botColors.length], false));
    }

    // Comida inicial
    foodOrbs = [];
    for (let i = 0; i < 90; i++) {
      foodOrbs.push({
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        r: Math.random() * 2.5 + 2.5,
        color: Math.random() < 0.6 ? '#6df7e8' : '#ff5b87'
      });
    }

  } else {
    // Modos Clásico y Evolución
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
    setStreak();
    levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
    statusEl.textContent = 'SISTEMA ACTIVO';
  }
}

function finish() {
  if (mode !== 'playing') return;
  mode = 'over';
  shake = 18;
  playSound('hit');
  vibrate([80, 50, 120]);
  constControls.hidden = true;

  flashEl.classList.remove('hit');
  void flashEl.offsetWidth;
  flashEl.classList.add('hit');
  
  statusEl.textContent = 'SEÑAL PERDIDA';
  
  runs.push({ attempt: attemptCount, score, seconds: Math.floor(elapsed), level, mode: selectedMode });
  runs = runs.slice(-30);
  localStorage.setItem('orbita-runs', JSON.stringify(runs));
  renderBoard();

  const record = score > best;
  if (record) {
    best = score;
    localStorage.setItem('orbita-best', best);
    bestEl.textContent = best;
  }

  document.querySelector('#eyebrow').textContent = record ? '¡NUEVO RÉCORD!' : 'FIN DEL VIAJE';
  document.querySelector('#headline').textContent = `${score} ${selectedMode === 'constellation' ? 'nodos' : 'luces'}`;
  document.querySelector('#subline').innerHTML = `Modo ${selectedMode.toUpperCase()}<br>Tiempo ${formatTime(elapsed)}`;
  startButton.innerHTML = 'REINTENTAR <span>↗</span>';
  document.querySelector('#hint').textContent = 'TOCA PARA REINICIAR';
  overlay.classList.remove('hidden');
}

function switchLane() {
  if (mode === 'playing' && selectedMode !== 'constellation') {
    targetLane = (targetLane + 1) % rings.length;
    playSound('switch');
    vibrate(25);
  }
}

// Botones y enlaces
startButton.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  begin();
});

document.querySelector('#open-board').addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  renderBoard();
  boardEl.hidden = false;
});

document.querySelector('#close-board').addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  boardEl.hidden = true;
});

// Manejadores de Joystick virtual
let joyCenter = { x: 0, y: 0 };
let joyActive = false;

joystickZone.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  joyActive = true;
  const rect = joystickZone.getBoundingClientRect();
  joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  updateJoystick(e.clientX, e.clientY);
});

window.addEventListener('pointermove', (e) => {
  if (joyActive) {
    updateJoystick(e.clientX, e.clientY);
  } else if (mode === 'playing' && selectedMode === 'constellation' && selectedControl === 'follow') {
    // Si sigue el dedo, calcular objetivo en espacio de mundo respecto a la cámara
    if (playerSnake) {
      const screenDx = e.clientX - w / 2;
      const screenDy = e.clientY - h / 2;
      pointerTarget = { x: playerSnake.x + screenDx, y: playerSnake.y + screenDy };
    }
  }
});

window.addEventListener('pointerup', () => {
  if (joyActive) {
    joyActive = false;
    joystickKnob.style.transform = `translate(0px, 0px)`;
    joystickVec = { x: 0, y: 0 };
  }
});

function updateJoystick(px, py) {
  const dx = px - joyCenter.x;
  const dy = py - joyCenter.y;
  const dist = Math.hypot(dx, dy);
  const maxR = 40;
  const angle = Math.atan2(dy, dx);
  const clampedDist = Math.min(dist, maxR);

  joystickKnob.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
  if (dist > 6) {
    joystickVec = { x: Math.cos(angle), y: Math.sin(angle) };
  }
}

// Botón de Turbo
boostBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  isBoosting = true;
  boostBtn.classList.add('active');
});
window.addEventListener('pointerup', () => {
  isBoosting = false;
  boostBtn.classList.remove('active');
});

// Toque en pantalla general
shell.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, #board, #update-modal, #overlay:not(.hidden), .const-controls')) return;
  if (mode === 'playing') {
    if (selectedMode === 'constellation') {
      if (selectedControl === 'follow' && playerSnake) {
        const screenDx = e.clientX - w / 2;
        const screenDy = e.clientY - h / 2;
        pointerTarget = { x: playerSnake.x + screenDx, y: playerSnake.y + screenDy };
      }
    } else {
      switchLane();
    }
  } else if (mode === 'over') {
    begin();
  }
});

// Teclado
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    if (mode === 'playing') {
      if (selectedMode === 'constellation') {
        if (e.code === 'Space') isBoosting = true;
      } else {
        switchLane();
      }
    } else if (mode === 'over') {
      begin();
    }
  }
  if (selectedMode === 'constellation' && mode === 'playing' && playerSnake) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') playerSnake.angle -= 0.15;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') playerSnake.angle += 0.15;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') isBoosting = false;
});

function addPattern() {
  const ahead = 2.0;
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
      spin: Math.random() * Math.PI * 2,
      hit: false
    });
  };

  const roll = Math.random();

  if (selectedMode === 'evolution' && roll < 0.16) {
    const pTypes = ['shield', 'magnet', 'slow'];
    const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
    add(0, laneChoice, pType);
    return;
  }

  if (roll < 0.45) {
    add(0, laneChoice, 'hazard', selectedMode === 'evolution' && Math.random() < 0.35);
    add(0.24, otherLane, 'spark');
  } else if (roll < 0.75) {
    add(0, laneChoice, 'spark');
    add(0.2, otherLane, 'hazard');
    add(0.4, laneChoice, 'spark');
  } else {
    add(0, laneChoice, 'hazard');
    add(0.26, otherLane, 'hazard');
  }
}

function burst(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.35 + Math.random() * 0.4,
      max: 0.75,
      color,
      size: 1.2 + Math.random() * 2.5
    });
  }
}

// Actualización de serpiente
function updateSnake(snake, dt) {
  if (!snake.alive) return;

  const currentSpeed = (snake.isPlayer && isBoosting && snake.length > 8) ? snake.speed * 1.9 : snake.speed;

  // Lógica de dirección del jugador
  if (snake.isPlayer) {
    if (selectedControl === 'joystick' && (joystickVec.x !== 0 || joystickVec.y !== 0)) {
      snake.targetAngle = Math.atan2(joystickVec.y, joystickVec.x);
    } else if (selectedControl === 'follow') {
      const dx = pointerTarget.x - snake.x;
      const dy = pointerTarget.y - snake.y;
      if (Math.hypot(dx, dy) > 15) {
        snake.targetAngle = Math.atan2(dy, dx);
      }
    }
  } else {
    // IA sencilla para bots: buscar comida más cercana
    let closest = null;
    let minDist = 300;
    for (const f of foodOrbs) {
      const d = Math.hypot(f.x - snake.x, f.y - snake.y);
      if (d < minDist) {
        minDist = d;
        closest = f;
      }
    }
    if (closest) {
      snake.targetAngle = Math.atan2(closest.y - snake.y, closest.x - snake.x);
    } else if (Math.random() < 0.03) {
      snake.targetAngle += (Math.random() - 0.5) * 1.5;
    }
  }

  // Rotación suave
  let diff = snake.targetAngle - snake.angle;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  snake.angle += diff * Math.min(1, dt * 7);

  // Mover cabeza
  snake.x += Math.cos(snake.angle) * currentSpeed * dt;
  snake.y += Math.sin(snake.angle) * currentSpeed * dt;

  // Muros de arena
  if (snake.x < 10 || snake.x > MAP_SIZE - 10 || snake.y < 10 || snake.y > MAP_SIZE - 10) {
    if (snake.isPlayer) {
      finish();
      return;
    } else {
      killSnake(snake);
      return;
    }
  }

  // Turbo: soltar orbes y restar longitud
  if (snake.isPlayer && isBoosting && snake.length > 8) {
    snake.boostClock += dt;
    if (snake.boostClock > 0.12) {
      snake.boostClock = 0;
      snake.length -= 0.5;
      const tailSeg = snake.segments[snake.segments.length - 1];
      foodOrbs.push({ x: tailSeg.x, y: tailSeg.y, r: 2.5, color: '#6df7e8' });
    }
  }

  // Seguir segmentos del cuerpo
  const targetDist = 7;
  snake.segments.unshift({ x: snake.x, y: snake.y });
  while (snake.segments.length > Math.floor(snake.length)) {
    snake.segments.pop();
  }
}

function killSnake(snake) {
  snake.alive = false;
  burst(snake.x, snake.y, snake.color, 25);
  // Transformar su cuerpo en comida
  for (let i = 0; i < snake.segments.length; i += 2) {
    foodOrbs.push({
      x: snake.segments[i].x + (Math.random() - 0.5) * 10,
      y: snake.segments[i].y + (Math.random() - 0.5) * 10,
      r: 3.5,
      color: snake.color
    });
  }
  // Reaparecer bot después de 3 segundos
  if (!snake.isPlayer) {
    setTimeout(() => {
      if (mode === 'playing' && selectedMode === 'constellation') {
        const bx = Math.random() * (MAP_SIZE - 200) + 100;
        const by = Math.random() * (MAP_SIZE - 200) + 100;
        bots.push(createSnake(bx, by, snake.color, false));
      }
    }, 3000);
  }
}

function update(dt) {
  if (mode !== 'playing') {
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    return;
  }

  elapsed += dt;
  timerEl.textContent = formatTime(elapsed);

  // ===================================
  // LÓGICA MODO CONSTELACIÓN (SLITHER)
  // ===================================
  if (selectedMode === 'constellation') {
    updateSnake(playerSnake, dt);
    score = Math.floor(playerSnake.length * 10);
    scoreEl.textContent = score;

    for (const b of bots) updateSnake(b, dt);
    bots = bots.filter(b => b.alive);

    // Comer orbes de luz
    for (let i = foodOrbs.length - 1; i >= 0; i--) {
      const f = foodOrbs[i];
      const d = Math.hypot(playerSnake.x - f.x, playerSnake.y - f.y);
      if (d < 16) {
        playerSnake.length += 0.8;
        foodOrbs.splice(i, 1);
        playSound('collect');
        vibrate(15);
        continue;
      }
      // Bots comiendo
      for (const b of bots) {
        if (Math.hypot(b.x - f.x, b.y - f.y) < 16) {
          b.length += 0.6;
          foodOrbs.splice(i, 1);
          break;
        }
      }
    }

    // Reposición de comida continua en la arena
    while (foodOrbs.length < 90) {
      foodOrbs.push({
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        r: Math.random() * 2.5 + 2.5,
        color: Math.random() < 0.6 ? '#6df7e8' : '#ff5b87'
      });
    }

    // Detección de colisiones cuerpo a cuerpo
    // 1. ¿Choca la cabeza del jugador contra el cuerpo de un bot?
    for (const b of bots) {
      for (let i = 2; i < b.segments.length; i++) {
        const seg = b.segments[i];
        if (Math.hypot(playerSnake.x - seg.x, playerSnake.y - seg.y) < 10) {
          finish();
          return;
        }
      }
    }

    // 2. ¿Choca la cabeza de un bot contra el cuerpo del jugador?
    for (const b of bots) {
      for (let i = 2; i < playerSnake.segments.length; i++) {
        const seg = playerSnake.segments[i];
        if (Math.hypot(b.x - seg.x, b.y - seg.y) < 10) {
          killSnake(b);
          playSound('powerup');
          vibrate(50);
          break;
        }
      }
    }

    return;
  }

  // ===================================
  // LÓGICA MODOS CLÁSICO Y EVOLUCIÓN
  // ===================================
  const shape = getGeometryType();
  const destRadius = rings[targetLane] || rings[0];
  currentRadius += (destRadius - currentRadius) * Math.min(1, dt * 18);

  if (magnetTimer > 0) {
    magnetTimer -= dt;
    hudMagnet.hidden = false;
  } else { hudMagnet.hidden = true; }

  if (slowTimer > 0) {
    slowTimer -= dt;
    hudSlow.hidden = false;
  } else { hudSlow.hidden = true; }

  hudShield.hidden = !shieldActive;

  const timeScale = slowTimer > 0 ? 0.5 : 1;
  const effectiveDt = dt * timeScale;

  const nextLevel = 1 + Math.max(Math.floor(score / 8), Math.floor(elapsed / 24));
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
      reverseTimer = 22 + Math.random() * 10;
      reverseBanner.classList.remove('show');
      vibrate([50, 40, 50]);
    }
  }

  const baseSpeed = 1.35 + Math.min((level - 1) * 0.14, 1.4);
  angle += baseSpeed * effectiveDt * direction;

  spawnClock -= effectiveDt;
  const interval = Math.max(0.48, 1.25 - (level - 1) * 0.08);
  if (spawnClock <= 0) {
    addPattern();
    spawnClock = interval;
  }

  levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');

  const playerR = currentRadius * getRadiusModifier(angle, shape);
  const playerX = cx + Math.cos(angle) * playerR;
  const playerY = cy + Math.sin(angle) * playerR;

  trail.unshift({ x: playerX, y: playerY, alpha: 1 });
  if (trail.length > 12) trail.pop();

  for (const obj of objects) {
    if (obj.hit) continue;

    if (obj.moving) {
      obj.ring += obj.moveDir * effectiveDt * 0.7;
      if (obj.ring >= rings.length - 1) { obj.ring = rings.length - 1; obj.moveDir = -1; }
      else if (obj.ring <= 0) { obj.ring = 0; obj.moveDir = 1; }
    }

    const objRBase = rings[Math.round(obj.ring)] || rings[0];
    const objR = objRBase * getRadiusModifier(obj.a, shape);
    let objX = cx + Math.cos(obj.a) * objR;
    let objY = cy + Math.sin(obj.a) * objR;

    if (magnetTimer > 0 && obj.type === 'spark') {
      const dx = playerX - objX;
      const dy = playerY - objY;
      objX += dx * 0.15;
      objY += dy * 0.15;
    }

    const dist = Math.hypot(playerX - objX, playerY - objY);

    if (dist < 20) {
      if (obj.type === 'hazard') {
        if (shieldActive) {
          shieldActive = false;
          obj.hit = true;
          burst(objX, objY, '#6df7e8', 14);
          playSound('powerup');
          vibrate(40);
        } else {
          burst(playerX, playerY, '#ff5b87', 22);
          finish();
          break;
        }
      } else if (obj.type === 'spark') {
        obj.hit = true;
        streak++;
        score += 1 + Math.floor(streak / 5);
        scoreEl.textContent = score;
        setStreak();
        playSound('collect');
        vibrate(20);
        burst(objX, objY, '#6df7e8', 10);
      } else if (['shield', 'magnet', 'slow'].includes(obj.type)) {
        obj.hit = true;
        playSound('powerup');
        vibrate([30, 30]);
        if (obj.type === 'shield') shieldActive = true;
        if (obj.type === 'magnet') magnetTimer = 7;
        if (obj.type === 'slow') slowTimer = 5;
        burst(objX, objY, '#fdd835', 16);
      }
    }
  }

  objects = objects.filter(obj => {
    const diff = (obj.a - angle) * direction;
    return diff > -Math.PI * 0.6 && diff < Math.PI * 2.2 && !obj.hit;
  });

  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life -= dt;
  }
  for (const t of trail) t.alpha -= dt * 2.2;
  trail = trail.filter(t => t.alpha > 0);
  shake *= 0.88;
}

function draw(time) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  if (shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  // ============================================
  // RENDERIZADO MODO CONSTELACIÓN (CAMARA LIBRE)
  // ============================================
  if (selectedMode === 'constellation' && playerSnake) {
    // Desplazamiento de cámara centrado en el jugador
    const camX = w / 2 - playerSnake.x;
    const camY = h / 2 - playerSnake.y;

    ctx.save();
    ctx.translate(camX, camY);

    // Borde de la arena
    ctx.strokeStyle = 'rgba(255, 91, 135, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Cuadrícula estelar suave
    ctx.strokeStyle = 'rgba(40, 48, 86, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < MAP_SIZE; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_SIZE); ctx.stroke();
    }
    for (let y = 0; y < MAP_SIZE; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_SIZE, y); ctx.stroke();
    }

    // Comida estelar
    for (const f of foodOrbs) {
      ctx.fillStyle = f.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dibujar serpientes (Bots + Jugador)
    const allSnakes = [...bots, playerSnake];
    for (const s of allSnakes) {
      if (!s.alive) continue;
      // Cuerpo
      ctx.shadowBlur = 12;
      ctx.shadowColor = s.color;
      ctx.fillStyle = s.color;
      for (let i = s.segments.length - 1; i >= 0; i--) {
        const seg = s.segments[i];
        const segR = Math.max(3.5, 6 - (i / s.segments.length) * 2.5);
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, segR, 0, Math.PI * 2);
        ctx.fill();
      }
      // Cabeza
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
    return;
  }

  // ============================================
  // RENDERIZADO MODOS ORBITALES (CLÁSICO/EVOLUCIÓN)
  // ============================================
  for (const s of stars) {
    const twinkle = 0.75 + Math.sin(time * 0.002 + s.phase) * 0.25;
    ctx.globalAlpha = s.a * twinkle;
    ctx.fillStyle = '#d4dcff';
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const shape = getGeometryType();

  for (let ringIdx = 0; ringIdx < rings.length; ringIdx++) {
    const baseR = rings[ringIdx];
    ctx.beginPath();
    
    const steps = shape === 'circle' ? 64 : 72;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const r = baseR * getRadiusModifier(theta, shape);
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.strokeStyle = (targetLane === ringIdx && mode === 'playing') ? 'rgba(109, 247, 232, 0.45)' : 'rgba(98, 105, 138, 0.22)';
    ctx.lineWidth = (targetLane === ringIdx && mode === 'playing') ? 2 : 1;
    ctx.stroke();
  }

  for (const obj of objects) {
    const baseR = rings[Math.round(obj.ring)] || rings[0];
    const r = baseR * getRadiusModifier(obj.a, shape);
    const x = cx + Math.cos(obj.a) * r;
    const y = cy + Math.sin(obj.a) * r;

    if (obj.type === 'hazard') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(obj.spin + time * 0.001);
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ff4777';
      ctx.fillStyle = '#ff5b87';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rr = i % 2 ? 6.5 : 12;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (obj.type === 'spark') {
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#6df7e8';
      ctx.fillStyle = '#b2fff5';
      ctx.beginPath();
      ctx.arc(x, y, 5 + Math.sin(time * 0.008 + obj.a) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = obj.type === 'shield' ? '🛡️' : (obj.type === 'magnet' ? '🧲' : '⏳');
      ctx.fillText(icon, x, y);
      ctx.restore();
    }
  }

  for (const t of trail) {
    ctx.globalAlpha = t.alpha * 0.35;
    ctx.fillStyle = '#6df7e8';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const playerR = currentRadius * getRadiusModifier(angle, shape);
  const px = cx + Math.cos(angle) * playerR;
  const py = cy + Math.sin(angle) * playerR;

  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = shieldActive ? '#6df7e8' : '#e5fffb';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6df7e8';
  ctx.beginPath();
  ctx.arc(px, py, 3.2, 0, Math.PI * 2);
  ctx.fill();

  if (shieldActive) {
    ctx.strokeStyle = '#6df7e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function frame(now) {
  const dt = Math.min((now - (lastTime || now)) / 1000, 0.04);
  lastTime = now;
  update(dt);
  draw(now);
  requestAnimationFrame(frame);
}

checkUpdates();
requestAnimationFrame(frame);
