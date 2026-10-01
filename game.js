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

// Sistema de Audio
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
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    // Si el navegador bloquea audio, continúa sin sonido
  }
}

// Variables de renderizado
let w = 0, h = 0, dpr = 1, cx = 0, cy = 0, outer = 0, inner = 0;
let mode = 'ready'; // 'ready', 'playing', 'over'
let angle = -Math.PI / 2;
let targetLane = 0;
let currentRadius = 0; 
let score = 0, streak = 0, elapsed = 0, spawnClock = 0, lastTime = 0, shake = 0, level = 1;
let objects = [], particles = [];

// Historial y persistencia
let best = Number(localStorage.getItem('orbita-best') || 0);
let attemptCount = Number(localStorage.getItem('orbita-attempts') || 0);
let runs = [];
try {
  runs = JSON.parse(localStorage.getItem('orbita-runs') || '[]');
  if (!Array.isArray(runs)) runs = [];
} catch {
  runs = [];
}

bestEl.textContent = best;
attemptEl.textContent = String(attemptCount + 1).padStart(2, '0');

const stars = Array.from({ length: 65 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.3 + 0.3,
  a: Math.random() * 0.45 + 0.15,
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
  outer = Math.min(w, h) * 0.34;
  inner = outer * 0.64;
  if (currentRadius === 0) currentRadius = outer;
}
window.addEventListener('resize', resize);
resize();

function setStreak() {
  streakEl.innerHTML = Array.from({ length: 5 }, (_, i) => 
    `<span class="${i < streak % 5 ? 'on' : ''}"></span>`
  ).join('');
}
setStreak();

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderBoard() {
  const sorted = [...runs].sort((a, b) => b.score - a.score || b.seconds - a.seconds).slice(0, 10);
  runListEl.innerHTML = sorted.map(run => `
    <li class="run-row">
      <span>INTENTO ${String(run.attempt).padStart(2, '0')}<small>NIVEL ${String(run.level).padStart(2, '0')}</small></span>
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
  targetLane = 0;
  currentRadius = outer;
  score = 0;
  streak = 0;
  elapsed = 0;
  level = 1;
  spawnClock = 0.5;
  objects = [];
  particles = [];
  
  scoreEl.textContent = '0';
  timerEl.textContent = '00:00';
  setStreak();
  levelEl.textContent = 'NIVEL 01';
  statusEl.textContent = 'VIAJE EN CURSO';
  boardEl.hidden = true;
  overlay.classList.add('hidden');
}

function finish() {
  if (mode !== 'playing') return;
  mode = 'over';
  shake = 16;
  playSound('hit');

  flashEl.classList.remove('hit');
  void flashEl.offsetWidth;
  flashEl.classList.add('hit');
  
  statusEl.textContent = 'SEÑAL PERDIDA';
  
  runs.push({ attempt: attemptCount, score, seconds: Math.floor(elapsed), level });
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
  document.querySelector('#headline').textContent = score > 0 ? `${score} luz${score === 1 ? '' : 'es'}` : 'Casi.';
  document.querySelector('#subline').innerHTML = `Intento ${String(attemptCount).padStart(2, '0')} · ${formatTime(elapsed)}<br>Nivel ${String(level).padStart(2, '0')} · Racha: ${streak}`;
  startButton.innerHTML = 'OTRA VUELTA <span>↗</span>';
  document.querySelector('#hint').textContent = 'TOCA PARA VOLVER A LA ÓRBITA';
  overlay.classList.remove('hidden');
}

function switchLane() {
  if (mode === 'playing') {
    targetLane = 1 - targetLane;
    playSound('switch');
  }
}

// Botones de acción directa
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

// Toque en pantalla / Clic general
shell.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, #board, #overlay:not(.hidden)')) {
    return;
  }
  if (mode === 'playing') {
    switchLane();
  } else if (mode === 'over') {
    begin();
  }
});

// Teclado
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
  const ahead = 2.1;
  const kind = Math.random();
  const laneChoice = Math.random() < 0.5 ? 0 : 1;

  const add = (offset, ring, type) => {
    objects.push({
      a: angle + ahead + offset,
      ring,
      type,
      spin: Math.random() * Math.PI * 2,
      hit: false
    });
  };

  if (kind < 0.3) {
    add(0, laneChoice, 'hazard');
    add(0.25, 1 - laneChoice, 'spark');
    add(0.5, laneChoice, 'hazard');
  } else if (kind < 0.6) {
    add(0, laneChoice, 'spark');
    add(0.22, 1 - laneChoice, 'hazard');
    add(0.44, laneChoice, 'spark');
  } else {
    add(0, laneChoice, 'hazard');
    add(0.3, 1 - laneChoice, 'spark');
  }
}

function burst(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 110;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.3 + Math.random() * 0.4,
      max: 0.7,
      color,
      size: 1.2 + Math.random() * 2.5
    });
  }
}

function norm(a) {
  return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function update(dt) {
  const destRadius = targetLane === 0 ? outer : inner;
  currentRadius += (destRadius - currentRadius) * Math.min(1, dt * 18);

  if (mode === 'playing') {
    elapsed += dt;
    const nextLevel = 1 + Math.max(Math.floor(score / 6), Math.floor(elapsed / 22));
    if (nextLevel > level) level = nextLevel;

    const speed = 1.35 + Math.min((level - 1) * 0.14, 1.3);
    angle += speed * dt;

    spawnClock -= dt;
    const interval = Math.max(0.55, 1.25 - (level - 1) * 0.08);
    if (spawnClock <= 0) {
      addPattern();
      spawnClock = interval;
    }

    levelEl.textContent = 'NIVEL ' + String(level).padStart(2, '0');
    timerEl.textContent = formatTime(elapsed);

    const playerX = cx + Math.cos(angle) * currentRadius;
    const playerY = cy + Math.sin(angle) * currentRadius;

    for (const obj of objects) {
      if (obj.hit) continue;

      const objR = obj.ring === 0 ? outer : inner;
      const objX = cx + Math.cos(obj.a) * objR;
      const objY = cy + Math.sin(obj.a) * objR;
      const dist = Math.hypot(playerX - objX, playerY - objY);

      if (dist < 18) {
        if (obj.type === 'hazard') {
          burst(playerX, playerY, '#ff5b87', 20);
          finish();
          break;
        } else if (obj.type === 'spark') {
          obj.hit = true;
          streak++;
          const bonus = Math.floor(streak / 5);
          score += 1 + bonus;
          scoreEl.textContent = score;
          setStreak();
          playSound('collect');
          burst(objX, objY, '#6df7e8', 10);
        }
      }
    }

    objects = objects.filter(obj => norm(obj.a - angle) < Math.PI * 1.8 && !obj.hit);
  }

  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life -= dt;
  }

  shake *= 0.88;
}

function draw(time) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  if (shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  for (const s of stars) {
    const twinkle = 0.75 + Math.sin(time * 0.002 + s.phase) * 0.25;
    ctx.globalAlpha = s.a * twinkle;
    ctx.fillStyle = '#d4dcff';
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer * 0.75);
  glow.addColorStop(0, '#22284e');
  glow.addColorStop(0.6, '#131833');
  glow.addColorStop(1, '#090b18');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, outer * 0.75, 0, Math.PI * 2);
  ctx.fill();

  for (let ring = 0; ring < 2; ring++) {
    const r = ring === 0 ? outer : inner;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = (targetLane === ring && mode === 'playing') ? 'rgba(109, 247, 232, 0.45)' : 'rgba(98, 105, 138, 0.25)';
    ctx.lineWidth = (targetLane === ring && mode === 'playing') ? 2 : 1;
    ctx.stroke();

    if (targetLane === ring && mode === 'playing') {
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle - 0.35, angle + 0.15);
      ctx.strokeStyle = 'rgba(109, 247, 232, 0.7)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  for (const obj of objects) {
    const r = obj.ring === 0 ? outer : inner;
    const x = cx + Math.cos(obj.a) * r;
    const y = cy + Math.sin(obj.a) * r;

    if (obj.type === 'hazard') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(obj.spin + time * 0.001);
      ctx.shadowBlur = 16;
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
    } else {
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#6df7e8';
      ctx.fillStyle = '#b2fff5';
      ctx.beginPath();
      ctx.arc(x, y, 5 + Math.sin(time * 0.008 + obj.a) * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(109, 247, 232, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 9.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  const px = cx + Math.cos(angle) * currentRadius;
  const py = cy + Math.sin(angle) * currentRadius;

  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#6df7e8';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6df7e8';
  ctx.beginPath();
  ctx.arc(px, py, 3.2, 0, Math.PI * 2);
  ctx.fill();
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

requestAnimationFrame(frame);