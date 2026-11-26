export const State = {
  photons: Number(localStorage.getItem('bento-photons') || 0),
  xp: Number(localStorage.getItem('bento-xp') || 0),
  best: Number(localStorage.getItem('bento-best') || 0),
  attempts: Number(localStorage.getItem('bento-attempts') || 0),
  equippedSkin: localStorage.getItem('bento-skin') || 'dot',
  equippedTrail: localStorage.getItem('bento-trail') || 'solid',
  equippedTheme: localStorage.getItem('bento-theme') || 'default',
  ownedSkins: JSON.parse(localStorage.getItem('bento-owned-skins') || '["dot"]'),
  ownedTrails: JSON.parse(localStorage.getItem('bento-owned-trails') || '["solid"]'),
  ownedThemes: JSON.parse(localStorage.getItem('bento-owned-themes') || '["default"]'),
  runs: [],
  missions: JSON.parse(localStorage.getItem('bento-missions') || 'null') || [
    { id: 'm1', title: 'Consigue 15 pts en Órbita', mode: 'classic', target: 15, progress: 0, reward: 40, claimed: false },
    { id: 'm2', title: 'Llega al Nivel 3 en Secuencia', mode: 'sequence', target: 3, progress: 0, reward: 60, claimed: false },
    { id: 'm3', title: 'Supera 8 pisos en Equilibrio', mode: 'stack', target: 8, progress: 0, reward: 50, claimed: false }
  ]
};

try {
  const savedRuns = JSON.parse(localStorage.getItem('bento-runs') || '[]');
  if (Array.isArray(savedRuns)) State.runs = savedRuns;
} catch {
  State.runs = [];
}

export function saveState() {
  localStorage.setItem('bento-photons', State.photons);
  localStorage.setItem('bento-xp', State.xp);
  localStorage.setItem('bento-best', State.best);
  localStorage.setItem('bento-attempts', State.attempts);
  localStorage.setItem('bento-skin', State.equippedSkin);
  localStorage.setItem('bento-trail', State.equippedTrail);
  localStorage.setItem('bento-theme', State.equippedTheme);
  localStorage.setItem('bento-owned-skins', JSON.stringify(State.ownedSkins));
  localStorage.setItem('bento-owned-trails', JSON.stringify(State.ownedTrails));
  localStorage.setItem('bento-owned-themes', JSON.stringify(State.ownedThemes));
  localStorage.setItem('bento-runs', JSON.stringify(State.runs.slice(-50)));
  localStorage.setItem('bento-missions', JSON.stringify(State.missions));
}

export function addXP(amount) {
  State.xp += amount;
  saveState();
}

export function getOperatorLevel() {
  const lv = 1 + Math.floor(State.xp / 250);
  const currentXpInLevel = State.xp % 250;
  const pct = Math.min(100, Math.round((currentXpInLevel / 250) * 100));
  return { lv, pct };
}

export function updateMissionProgress(mode, value) {
  let updated = false;
  for (const m of State.missions) {
    if (!m.claimed && m.mode === mode && value > m.progress) {
      m.progress = Math.min(m.target, value);
      updated = true;
    }
  }
  if (updated) saveState();
}

export function exportBackupCode() {
  const data = {
    p: State.photons,
    x: State.xp,
    b: State.best,
    s: State.ownedSkins,
    t: State.ownedTrails,
    th: State.ownedThemes
  };
  return btoa(JSON.stringify(data));
}

export function importBackupCode(code) {
  try {
    const parsed = JSON.parse(atob(code.trim()));
    if (typeof parsed.p === 'number') State.photons = parsed.p;
    if (typeof parsed.x === 'number') State.xp = parsed.x;
    if (typeof parsed.b === 'number') State.best = parsed.b;
    if (Array.isArray(parsed.s)) State.ownedSkins = parsed.s;
    if (Array.isArray(parsed.t)) State.ownedTrails = parsed.t;
    if (Array.isArray(parsed.th)) State.ownedThemes = parsed.th;
    saveState();
    return true;
  } catch {
    return false;
  }
}
