const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#start');
const scoreEl = document.querySelector('#score');
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

// Elementos HUD de Power-ups
const hudShield = document.querySelector('#hud-shield');
const hudMagnet = document.querySelector('#hud-magnet');
const hudSlow = document.querySelector('#hud-slow');

// Opciones de juego
let selectedMode = 'classic'; // 'classic' | 'evolution'
let selectedDiff = 'easy';    // 'easy' | 'normal' | 'hard'

// Selección de configuración en interfaz
document.querySelectorAll('#mode-group .opt-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#mode-group .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    diffContainer.hidden = (selectedMode !== 'evolution');
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

// Sintetizador de sonido con Web Audio
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

// Variables de lienzo y dimensiones
let w = 0, h = 0, dpr = 1, cx = 0, cy = 0;
let rings = []; // radios de carriles
let mode = 'ready'; 
let angle = -Math.PI / 2;
let targetLane = 0;
let currentRadius = 0; 
let score = 0, streak = 0, elapsed = 0, spawnClock = 0, lastTime = 0, shake = 0, level = 1;
let direction = 1; // 1: horario, -1: antihorario
let reverseTimer = 0;
let trail = [];

// Power-ups activos
let shieldActive = false;
let magnetTimer = 0;
let slowTimer = 0;

let objects = [], particles = [];

// Persistencia de datos
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
    rings = [baseOuter, baseOuter * 0.73, baseOuter * 0.48]; // 3 carriles
  } else {
    rings = [baseOuter, baseOuter * 0.65]; // 2 carriles
  }

  if (currentRadius === 0) currentRadius = rings[0];
}
window.addEventListener('resize', resize);
resize();

// Cálculo de forma según el nivel o dificultad
function getGeometryType() {
  if (selectedMode === 'classic') return 'circle';
  if (selectedDiff === 'hard' || level >= 6) return 'octagon';
  if (selectedDiff === 'normal' || level >= 4) return 'hexagon';
  if (level >= 2) return 'ellipse';
  return 'circle';
}

function getRadiusModifier(theta, shape) {
  if (shape === 'ellipse') {
    return 1 + 0.18 * Math.cos(2 * theta);
  }
  if (shape === 'hexagon') {
    const n = 6;
    return 1 + 0.08 * Math.cos(n * theta);
  }
  if (shape === 'octagon') {
    const n = 8;
    return 1 + 0.1 * Math.cos(n * theta);
  }
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
      <span>${run.mode.toUpperCase()}<small>NIVEL ${String(run.level).padStart(2, '0')} · #${run.attempt}</small></span>
      <span>${run.score}</span>
      <span>${formatTime(run.seconds)}</span>
    </li>
  `).join('');
  emptyBoardEl.hidden = sorted.length > 0;
}

function begin() {
  attemptCount++;
  localStorage.setItem('orbita-attempts', attemptCount);
  attemptEl.textContent = String(attemptCount).padStart(2, '0');
  
  mode = 'playing';
  angle = -Math.PI / 2;
  direction = 1;
  targetLane = 0;
  score = 0;
  streak = 0;
  elapsed = 0;
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

  scoreEl.textContent = '0';
  timerEl.textContent = '00:00';
  setStreak();
  levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
  statusEl.textContent = 'SISTEMA ACTIVO';
  boardEl.hidden = true;
  overlay.classList.add('hidden');
}

function finish() {
  if (mode !== 'playing') return;
  mode = 'over';
  shake = 18;
  playSound('hit');
  vibrate([80, 50, 120]);

  flashEl.classList.remove('hit');
  void flashEl.offsetWidth;
  flashEl.classList.add('hit');
  
  statusEl.textContent = 'IMPACTO CRÍTICO';
  
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
  document.querySelector('#headline').textContent = `${score} luz${score === 1 ? '' : 'es'}`;
  document.querySelector('#subline').innerHTML = `Modo ${selectedMode.toUpperCase()} · Nivel ${String(level).padStart(2, '0')}<br>Tiempo ${formatTime(elapsed)} · Racha máx: ${streak}`;
  startButton.innerHTML = 'REINTENTAR <span>↗</span>';
  document.querySelector('#hint').textContent = 'TOCA PARA REINICIAR';
  overlay.classList.remove('hidden');
}

function switchLane() {
  if (mode === 'playing') {
    targetLane = (targetLane + 1) % rings.length;
    playSound('switch');
    vibrate(25);
  }
}

// Controladores de eventos e interfaz
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

shell.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, #board, #overlay:not(.hidden)')) return;
  if (mode === 'playing') {
    switchLane();
  } else if (mode === 'over') {
    begin();
  }
});

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    if (mode === 'playing') {
      switchLane();
    } else {
      begin();
    }
  }
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

  // Generación de Power-Ups en Modo Evolución
  if (selectedMode === 'evolution' && roll < 0.16) {
    const pTypes = ['shield', 'magnet', 'slow'];
    const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
    add(0, laneChoice, pType);
    return;
  }

  // Obstáculos y Luces
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

function update(dt) {
  const shape = getGeometryType();
  const destRadius = rings[targetLane] || rings[0];
  currentRadius += (destRadius - currentRadius) * Math.min(1, dt * 18);

  // Actualizar timers de Power-ups
  if (magnetTimer > 0) {
    magnetTimer -= dt;
    hudMagnet.hidden = false;
  } else { hudMagnet.hidden = true; }

  if (slowTimer > 0) {
    slowTimer -= dt;
    hudSlow.hidden = false;
  } else { hudSlow.hidden = true; }

  hudShield.hidden = !shieldActive;

  if (mode === 'playing') {
    const timeScale = slowTimer > 0 ? 0.5 : 1;
    const effectiveDt = dt * timeScale;
    elapsed += effectiveDt;

    // Progresión de nivel
    const nextLevel = 1 + Math.max(Math.floor(score / 8), Math.floor(elapsed / 24));
    if (nextLevel > level) {
      level = nextLevel;
      resize();
    }

    // Inversión de giro dinámica en Modo Evolución
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
    timerEl.textContent = formatTime(elapsed);

    // Posición del jugador considerando forma de la órbita
    const playerR = currentRadius * getRadiusModifier(angle, shape);
    const playerX = cx + Math.cos(angle) * playerR;
    const playerY = cy + Math.sin(angle) * playerR;

    // Rastro / Estela (Ghost trail)
    trail.unshift({ x: playerX, y: playerY, alpha: 1 });
    if (trail.length > 12) trail.pop();

    for (const obj of objects) {
      if (obj.hit) continue;

      // Obstáculos móviles entre carriles
      if (obj.moving) {
        obj.ring += obj.moveDir * effectiveDt * 0.7;
        if (obj.ring >= rings.length - 1) { obj.ring = rings.length - 1; obj.moveDir = -1; }
        else if (obj.ring <= 0) { obj.ring = 0; obj.moveDir = 1; }
      }

      const objRBase = rings[Math.round(obj.ring)] || rings[0];
      const objR = objRBase * getRadiusModifier(obj.a, shape);
      let objX = cx + Math.cos(obj.a) * objR;
      let objY = cy + Math.sin(obj.a) * objR;

      // Efecto Imán
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

    // Filtrar objetos lejanos
    objects = objects.filter(obj => {
      const diff = (obj.a - angle) * direction;
      return diff > -Math.PI * 0.6 && diff < Math.PI * 2.2 && !obj.hit;
    });
  }

  // Partículas y estela
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

  // Fondo estrellado
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

  // Dibujar órbitas
  for (let ringIdx = 0; ringIdx < rings.length; ringIdx++) {
    const baseR = rings[ringIdx];
    ctx.beginPath();
    
    // Trazado poligonal/elíptico según la forma
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

  // Objetos y coleccionables
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
      // Power-up icons
      ctx.save();
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = obj.type === 'shield' ? '🛡️' : (obj.type === 'magnet' ? '🧲' : '⏳');
      ctx.fillText(icon, x, y);
      ctx.restore();
    }
  }

  // Estela del jugador
  for (const t of trail) {
    ctx.globalAlpha = t.alpha * 0.35;
    ctx.fillStyle = '#6df7e8';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Jugador
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

  // Partículas
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

requestAnimationFrame(frame);
