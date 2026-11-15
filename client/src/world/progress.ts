/** Progress: stats, achievements and which "Science and sources" cards the player has discovered by playing.
 *  The rules are pure functions (easy to test); a tiny store keeps them in localStorage. */
export type Ev =
  | { t: 'goal' } | { t: 'coin' } | { t: 'round' } | { t: 'jump' } | { t: 'cones'; secs: number }
  | { t: 'launch'; dest: string; tools: string[]; shield: number }
  | { t: 'trip'; ids: string[] }
  | { t: 'mission'; dest: string; returned: boolean; grade: string; samples: string[]; kills: number; scrap: number }
  | { t: 'kill'; kind: string }
  | { t: 'wallet'; scrap: number } | { t: 'visit' } | { t: 'daily'; returned: boolean; score: number };

export interface Stats { goals: number; coins: number; rounds: number; jumps: number; launches: number; missions: number; kills: number; boss: number; brutes: number; bestCones: number; worlds: string[]; sGrades: number; maxScrap: number; dailies: number }
export interface Progress { found: string[]; ach: string[]; story: string[]; s: Stats }
export const emptyProgress = (): Progress => ({ found: [], ach: [], story: [], s: { goals: 0, coins: 0, rounds: 0, jumps: 0, launches: 0, missions: 0, kills: 0, boss: 0, brutes: 0, bestCones: 0, worlds: [], sGrades: 0, maxScrap: 0, dailies: 0 } });

export interface Ach { id: string; icon: string; es: string; en: string; descEs: string; descEn: string; ok: (s: Stats) => boolean }
export const ACHIEVEMENTS: Ach[] = [
  { id: 'goal', icon: '⚽', es: 'Primer gol', en: 'First goal', descEs: 'Mete un gol en la canchita.', descEn: 'Score a goal on the pitch.', ok: s => s.goals >= 1 },
  { id: 'goals5', icon: '🥅', es: 'Goleador', en: 'Striker', descEs: 'Mete 5 goles.', descEn: 'Score 5 goals.', ok: s => s.goals >= 5 },
  { id: 'round', icon: '⭐', es: 'Todas las monedas', en: 'All the coins', descEs: 'Junta las 10 monedas de una vuelta.', descEn: 'Collect all 10 coins in one round.', ok: s => s.rounds >= 1 },
  { id: 'cones', icon: '🏁', es: 'Piloto de conos', en: 'Cone racer', descEs: 'Termina la carrera de conos en menos de 40 s.', descEn: 'Finish the cone race in under 40 s.', ok: s => s.bestCones > 0 && s.bestCones < 40 },
  { id: 'jumps', icon: '🛹', es: 'Acróbata', en: 'Stunt driver', descEs: 'Salta 5 veces en la rampa.', descEn: 'Jump the ramp 5 times.', ok: s => s.jumps >= 5 },
  { id: 'launch', icon: '🚀', es: 'Despegue', en: 'Lift-off', descEs: 'Lanza tu primer cohete.', descEn: 'Launch your first rocket.', ok: s => s.launches >= 1 },
  { id: 'mission', icon: '✅', es: 'Misión cumplida', en: 'Mission complete', descEs: 'Completa una misión.', descEn: 'Complete a mission.', ok: s => s.missions >= 1 },
  { id: 'worlds', icon: '🪐', es: 'Tres mundos', en: 'Three worlds', descEs: 'Completa una misión en Marte, Júpiter y Miller.', descEn: 'Complete a mission on Mars, Jupiter and Miller.', ok: s => ['mars', 'jupiter', 'miller'].every(w => s.worlds.includes(w)) },
  { id: 'sgrade', icon: '🏅', es: 'Calificación S', en: 'S grade', descEs: 'Saca una S en una misión.', descEn: 'Get an S grade on a mission.', ok: s => s.sGrades >= 1 },
  { id: 'kills25', icon: '🛡️', es: 'Guardián', en: 'Guardian', descEs: 'Derrota 25 criaturas.', descEn: 'Defeat 25 creatures.', ok: s => s.kills >= 25 },
  { id: 'brute', icon: '💪', es: 'Rompe-corazas', en: 'Armor breaker', descEs: 'Derrota a un brute.', descEn: 'Defeat a brute.', ok: s => s.brutes >= 1 },
  { id: 'boss', icon: '👑', es: 'Cazajefes', en: 'Boss hunter', descEs: 'Derrota a un jefe.', descEn: 'Defeat a boss.', ok: s => s.boss >= 1 },
  { id: 'daily', icon: '📅', es: 'Reto del día', en: 'Daily challenge', descEs: 'Juega el reto del día.', descEn: 'Play the daily challenge.', ok: s => s.dailies >= 1 },
  { id: 'rich', icon: '💰', es: 'Ahorrador', en: 'Saver', descEs: 'Ten 200 🪙 a la vez.', descEn: 'Hold 200 🪙 at once.', ok: s => s.maxScrap >= 200 },
];

/** Cards of "Science and sources" and what the player has to do to discover each. */
export const DISCOVERY: Record<string, { es: string; en: string }> = {
  'rocket-equation': { es: 'Lanza un cohete', en: 'Launch a rocket' }, 'rocket-stages': { es: 'Lanza un cohete', en: 'Launch a rocket' },
  'solar-power': { es: 'Lanza un cohete', en: 'Launch a rocket' }, 'heat-shield': { es: 'Lanza un cohete', en: 'Launch a rocket' },
  'tool-camera': { es: 'Lanza con una cámara', en: 'Launch with a camera' }, 'tool-spectrometer': { es: 'Lanza con un analizador', en: 'Launch with an analyzer' }, 'tool-radar': { es: 'Lanza con un radar', en: 'Launch with a radar' },
  rover: { es: 'Juega en Marte', en: 'Play on Mars' }, 'mars-dust': { es: 'Juega en Marte', en: 'Play on Mars' }, 'mars-meteors': { es: 'Juega en Marte', en: 'Play on Mars' },
  'mars-hematite': { es: 'Recolecta hematita en Marte', en: 'Collect hematite on Mars' }, 'mars-igneous': { es: 'Recolecta basalto o regolito', en: 'Collect basalt or regolith' }, 'mars-ice': { es: 'Recolecta hielo en Marte', en: 'Collect ice on Mars' },
  'jup-grs': { es: 'Juega en Júpiter', en: 'Play on Jupiter' }, 'jup-belts': { es: 'Juega en Júpiter', en: 'Play on Jupiter' }, 'jup-aurora': { es: 'Juega en Júpiter', en: 'Play on Jupiter' }, 'jup-radiation': { es: 'Juega en Júpiter', en: 'Play on Jupiter' },
  miller: { es: 'Juega en Miller', en: 'Play on Miller' },
  'trip-solar-storm': { es: 'Vive una tormenta solar en el viaje', en: 'Live through a solar storm on the trip' }, 'trip-micrometeoroids': { es: 'Cruza micrometeoroides en el viaje', en: 'Cross micrometeoroids on the trip' }, 'trip-course-correction': { es: 'Haz una corrección de rumbo', en: 'Make a course correction' },
  'game-economy': { es: 'Termina una misión', en: 'Finish a mission' },
};
const TRIP: Record<string, string> = { storm: 'trip-solar-storm', dust: 'trip-micrometeoroids', burn: 'trip-course-correction' };
const MARS_KIND: Record<string, string> = { hematite: 'mars-hematite', ice: 'mars-ice', basalt: 'mars-igneous', regolith: 'mars-igneous' };

/** Which cards an event unlocks. */
export function discoveries(e: Ev): string[] {
  switch (e.t) {
    case 'launch': return ['rocket-equation', 'rocket-stages', 'solar-power', 'heat-shield', ...e.tools.map(t => `tool-${t}`)];
    case 'trip': return e.ids.map(i => TRIP[i]).filter((x): x is string => !!x);
    case 'mission': {
      const w = e.dest === 'mars' ? ['rover', 'mars-dust', 'mars-meteors', ...e.samples.map(k => MARS_KIND[k]).filter((x): x is string => !!x)]
        : e.dest === 'jupiter' ? ['jup-grs', 'jup-belts', 'jup-aurora', 'jup-radiation'] : ['miller'];
      return [...w, 'game-economy'];
    }
    default: return [];
  }
}

/** Applies one event. Returns a new Progress plus what was just unlocked (so the game can celebrate). */
/** Which story beats an event triggers (each beat only once). */
export function beatsFor(p: Progress, s: Stats, e: Ev, newAch: string[]): string[] {
  const out: string[] = [];
  if (e.t === 'visit') out.push('welcome');
  if (e.t === 'launch' && s.launches === 1) out.push('first_launch');
  if (e.t === 'mission') out.push(e.dest === 'mars' ? 'm_mars' : e.dest === 'jupiter' ? 'm_jupiter' : 'm_miller');
  if (e.t === 'kill' && e.kind === 'boss') out.push('first_boss');
  if (newAch.includes('worlds')) out.push('three_worlds');
  if (e.t === 'daily') out.push('daily_first');
  return out.filter((id, i) => out.indexOf(id) === i && !p.story.includes(id));
}

export function apply(p: Progress, e: Ev): { p: Progress; newFound: string[]; newAch: string[]; newBeats: string[] } {
  const s: Stats = { ...p.s, worlds: [...p.s.worlds] };
  switch (e.t) {
    case 'goal': s.goals++; break;
    case 'coin': s.coins++; break;
    case 'round': s.rounds++; break;
    case 'jump': s.jumps++; break;
    case 'cones': s.bestCones = s.bestCones === 0 ? e.secs : Math.min(s.bestCones, e.secs); break;
    case 'launch': s.launches++; break;
    case 'mission': s.missions++; s.kills += 0; if (e.returned && !s.worlds.includes(e.dest)) s.worlds.push(e.dest); if (e.grade === 'S') s.sGrades++; break;
    case 'kill': s.kills++; if (e.kind === 'boss') s.boss++; if (e.kind === 'brute') s.brutes++; break;
    case 'wallet': s.maxScrap = Math.max(s.maxScrap, e.scrap); break;
    case 'daily': s.dailies++; break;
  }
  const found = [...p.found], newFound = discoveries(e).filter((id, i, a) => !found.includes(id) && a.indexOf(id) === i);
  found.push(...newFound);
  const newAch = ACHIEVEMENTS.filter(a => !p.ach.includes(a.id) && a.ok(s)).map(a => a.id);
  const newBeats = beatsFor(p, s, e, newAch);
  return { p: { found, ach: [...p.ach, ...newAch], story: [...p.story, ...newBeats], s }, newFound, newAch, newBeats };
}

// ── store ──
const KEY = 'frontier-progress-v1';
export function loadProgress(): Progress {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v && Array.isArray(v.found) && Array.isArray(v.ach) && v.s) return { ...emptyProgress(), ...v, s: { ...emptyProgress().s, ...v.s } }; } catch { /* corrupted or private mode */ }
  return emptyProgress();
}
let cur: Progress | null = null; const subs = new Set<(p: Progress, n: { found: string[]; ach: string[]; beats: string[] }) => void>();
export const getProgress = () => (cur ??= loadProgress());
export function track(e: Ev) {
  const r = apply(getProgress(), e); cur = r.p;
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* private mode */ }
  subs.forEach(f => f(cur!, { found: r.newFound, ach: r.newAch, beats: r.newBeats }));
  return r;
}
export function resetAll() {
  cur = emptyProgress();
  for (const k of ['frontier-progress-v1', 'frontier-meta-v1', 'frontier-level', 'frontier-tutorial-done', 'frontier-daily-v1', 'frontier-run-v1']) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
  subs.forEach(f => f(cur!, { found: [], ach: [], beats: [] }));
}
export function subscribe(f: (p: Progress, n: { found: string[]; ach: string[]; beats: string[] }) => void) { subs.add(f); return () => { subs.delete(f); }; }
