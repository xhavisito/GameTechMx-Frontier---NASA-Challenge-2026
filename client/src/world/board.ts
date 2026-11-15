import type { Dest } from './design';
import type { Mods } from './levels';
import type { Perks } from './meta';
import type { MarsResult } from './marsWorld';
import { bumpRep, grant, tick, tierFor, slotsFor, type RunState } from './runstate';

/** What a job asks for. `goals` is relative to what the mission already needs (+1 = one more than required). */
export type Obj = { k: 'kills'; n: number } | { k: 'hull'; n: number } | { k: 'time'; n: number } | { k: 'goals'; n: number } | { k: 'score'; n: number } | { k: 'pacifist' } | { k: 'clean' } | { k: 'nolost' };
/** The twist the job puts on THIS mission while you carry it. */
export interface Rules { hazard?: number; enemy?: number; drain?: number; scrap?: number; fx?: Partial<Perks> }
export interface Job { id: string; world: Dest | 'any'; tier: 1 | 2 | 3; icon: string; es: string; en: string; descEs: string; descEn: string; obj: Obj; now?: Rules; reward: number; win?: string; lose?: string }

const J = (id: string, world: Job['world'], tier: Job['tier'], icon: string, es: string, en: string, descEs: string, descEn: string, obj: Obj, reward: number, now?: Rules, win?: string, lose?: string): Job => ({ id, world, tier, icon, es, en, descEs, descEn, obj, reward, now, win, lose });

export const JOBS: Job[] = [
  // anywhere
  J('hunt', 'any', 1, '☠️', 'Cacería', 'Pest control', 'Derrota 3 enemigos.', 'Defeat 3 enemies.', { k: 'kills', n: 3 }, 18, { enemy: 0.3 }, 'quick_hands'),
  J('steady', 'any', 1, '🛡️', 'Casco intacto', 'Keep it whole', 'Termina con al menos 70 % de casco.', 'Finish with at least 70% hull.', { k: 'hull', n: 70 }, 16, undefined, 'spare_parts'),
  J('quick', 'any', 1, '⏱️', 'Contrarreloj', 'Against the clock', 'Cumple la misión en menos de 4 minutos. Gastas más energía.', 'Complete the mission in under 4 minutes. You burn more power.', { k: 'time', n: 240 }, 22, { drain: 0.15 }, 'tailwind', 'rattle'),
  J('extra', 'any', 1, '🎯', 'Una de más', 'One extra', 'Consigue un objetivo más de los que pide la misión.', 'Get one more goal than the mission asks.', { k: 'goals', n: 1 }, 20, undefined, 'sharp_eye'),
  J('safe', 'any', 1, '✅', 'Misión limpia', 'Clean run', 'Cumple la misión sin que la nave explote ni te roben nada.', 'Complete the mission with no explosion and no thefts.', { k: 'nolost' }, 14, undefined, 'good_rep'),
  J('peace', 'any', 2, '🕊️', 'Sin violencia', 'Peaceful', 'Cumple la misión sin derrotar a nadie. Los bichos andan más agresivos.', 'Complete the mission without defeating anyone. Critters are more aggressive.', { k: 'pacifist' }, 32, { enemy: 0.4 }, 'calm_crew', 'loud_engine'),
  J('flawless', 'any', 2, '💎', 'Impecable', 'Flawless', 'Termina con 90 % de casco o más. Los peligros pegan más fuerte.', 'Finish with 90% hull or more. Hazards hit harder.', { k: 'hull', n: 90 }, 36, { hazard: 0.25 }, 'cold_cells', 'sore_hull'),
  J('slayer', 'any', 2, '⚔️', 'Gran cacería', 'Big hunt', 'Derrota a 6 enemigos. Hay muchos más de ellos.', 'Defeat 6 enemies. There are many more of them.', { k: 'kills', n: 6 }, 40, { enemy: 0.5 }, 'lucky_charm', 'sore_hull'),
  J('sprint', 'any', 2, '🏃', 'Sprint', 'Sprint', 'Cumple la misión en menos de 3 minutos. Gastas bastante más energía.', 'Complete the mission in under 3 minutes. You burn much more power.', { k: 'time', n: 180 }, 40, { drain: 0.25 }, 'tailwind', 'weak_cells'),
  J('ace', 'any', 3, '🏅', 'Misión de élite', 'Elite job', 'Saca calificación 70 o más. Peligros y enemigos aumentan.', 'Score 70 or more. Hazards and enemies increase.', { k: 'score', n: 70 }, 50, { hazard: 0.3, enemy: 0.3 }, 'good_rep', 'debt'),
  J('iron', 'any', 3, '🦾', 'Hombre de hierro', 'Iron job', 'Derrota 4 enemigos y termina con 80 % de casco.', 'Defeat 4 enemies and finish with 80% hull.', { k: 'hull', n: 80 }, 70, { enemy: 0.6, hazard: 0.2 }, 'lucky_charm', 'storm_belt'),
  J('legend', 'any', 3, '🌟', 'Leyenda', 'Legend', 'Saca calificación 85 o más. Todo es más difícil y gastas más energía.', 'Score 85 or more. Everything is harder and you burn more power.', { k: 'score', n: 85 }, 65, { hazard: 0.25, enemy: 0.25, drain: 0.15 }, 'spare_parts', 'jam'),
  // Mars
  J('m_convoy', 'mars', 1, '🚚', 'Escolta del convoy', 'Convoy escort', 'Derrota 4 bichos que rondan la base y mantén 50 % de casco.', 'Defeat 4 bugs around the base and keep 50% hull.', { k: 'kills', n: 4 }, 26, { enemy: 0.3 }, 'quick_hands'),
  J('m_dust', 'mars', 2, '🌪️', 'Tormenta de polvo', 'Dust storm', 'Aguanta la tormenta: termina con 60 % de casco.', 'Weather the storm: finish with 60% hull.', { k: 'hull', n: 60 }, 38, { hazard: 0.4, drain: 0.15 }, 'calibrated', 'dusty_lens'),
  J('m_map', 'mars', 2, '🗺️', 'Cartógrafo', 'Cartographer', 'Consigue un objetivo más de los que pide la misión.', 'Get one more goal than the mission asks.', { k: 'goals', n: 1 }, 34, { drain: 0.1 }, 'sharp_eye', 'thirsty'),
  // Jupiter
  J('j_hot', 'jupiter', 2, '☢️', 'Zona caliente', 'Hot zone', 'Termina con 60 % de casco: la radiación pega más fuerte.', 'Finish with 60% hull: radiation hits harder.', { k: 'hull', n: 60 }, 38, { fx: { radiation: 0.4 } }, 'cold_cells', 'sore_hull'),
  J('j_map', 'jupiter', 1, '🌀', 'Mapa completo', 'Full map', 'Escanea una zona más de las que pide la misión.', 'Scan one more zone than the mission asks.', { k: 'goals', n: 1 }, 24, { drain: 0.15 }, 'calibrated'),
  J('j_echo', 'jupiter', 2, '📻', 'Cazador de ecos', 'Echo hunter', 'Derrota 3 enemigos y cumple la misión rápido (menos de 4 min).', 'Defeat 3 enemies and complete the mission fast (under 4 min).', { k: 'time', n: 240 }, 36, { enemy: 0.3 }, 'quick_hands', 'jam'),
  // Miller
  J('s_wave', 'miller', 2, '🌊', 'Ola gigante', 'Giant wave', 'Termina con 60 % de casco: las olas pegan mucho más fuerte.', 'Finish with 60% hull: waves hit much harder.', { k: 'hull', n: 60 }, 40, { hazard: 0.5 }, 'tailwind', 'storm_belt'),
  J('s_deep', 'miller', 1, '🐚', 'Fondo marino', 'Seabed survey', 'Encuentra una señal más de las que pide la misión.', 'Find one more sign than the mission asks.', { k: 'goals', n: 1 }, 24, { drain: 0.15 }, 'calibrated'),
  J('s_fish', 'miller', 2, '🦈', 'Pesca peligrosa', 'Dangerous fishing', 'Derrota 4 bichos del fondo.', 'Defeat 4 creatures of the deep.', { k: 'kills', n: 4 }, 36, { enemy: 0.4 }, 'lucky_charm', 'loud_engine'),
];
export const jobById = (id: string) => JOBS.find(j => j.id === id);

/** Short label for the HUD chip. */
export function objShort(o: Obj, es: boolean): string {
  switch (o.k) {
    case 'kills': return `☠ ${o.n}`; case 'hull': return `🛡 ${o.n}%`; case 'time': return `⏱ ${Math.floor(o.n / 60)}:${String(o.n % 60).padStart(2, '0')}`;
    case 'goals': return `🎯 +${o.n}`; case 'score': return `⭐ ${o.n}`; case 'pacifist': return es ? '🕊 0 ☠' : '🕊 0 ☠'; case 'clean': case 'nolost': return '✅';
  }
}

/** The jobs on the board right now: only what your reputation allows, a mix of this planet's and general ones, in random order. */
export function offersFor(world: Dest, rep: number, rnd: () => number = Math.random, n = 4): Job[] {
  const tier = tierFor(rep), pool = JOBS.filter(j => (j.world === world || j.world === 'any') && j.tier <= tier);
  const local = pool.filter(j => j.world === world), any = pool.filter(j => j.world === 'any');
  const shuf = <T,>(a: T[]) => { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [o[i], o[k]] = [o[k]!, o[i]!]; } return o; };
  const top = shuf(any.filter(j => j.tier === tier)), out: Job[] = [...shuf(local).slice(0, 2), ...top.slice(0, 1)];
  for (const j of shuf(any)) if (out.length < n && !out.includes(j)) out.push(j);
  return shuf(out).slice(0, n);
}

/** Applies the accepted jobs' twists to the mission: they change the real difficulty of this run. */
export function applyJobs(m: Mods, p: Perks, jobs: Job[]): { mods: Mods; perks: Perks } {
  let hz = 0, dr = 0, sc = 0; const perks = { ...p };
  for (const j of jobs) {
    const r = j.now; if (!r) continue; hz += r.hazard ?? 0; dr += r.drain ?? 0; sc += r.scrap ?? 0; perks.enemyMore += r.enemy ?? 0;
    for (const k of Object.keys(r.fx ?? {}) as (keyof Perks)[]) perks[k] = (perks[k] as number) + (r.fx![k] as number);
  }
  return { mods: { ...m, hazardDmg: Math.round(m.hazardDmg * (1 + hz)), drainMul: m.drainMul * (1 + dr), scrapMul: m.scrapMul + sc }, perks };
}

/** Did this result fulfil the job? `need` is how many goals the mission asked for. */
export function jobDone(j: Job, r: Pick<MarsResult, 'returned' | 'exploded' | 'kills' | 'pois' | 'hull' | 'secs' | 'score' | 'lost'>, need: number): boolean {
  if (r.exploded) return false;
  const o = j.obj, k = r.kills ?? 0;
  switch (o.k) {
    case 'kills': return k >= o.n && (j.id !== 'iron' || ((r.hull ?? 0) >= 80)) && (j.id !== 'm_convoy' || (r.hull ?? 0) >= 50);
    case 'hull': return r.returned && (r.hull ?? 0) >= o.n && (j.id !== 'iron' || k >= 4);
    case 'time': return r.returned && (r.secs ?? 1e9) <= o.n && (j.id !== 'j_echo' || k >= 3);
    case 'goals': return (r.pois ?? 0) >= need + o.n;
    case 'score': return r.returned && r.score >= o.n;
    case 'pacifist': return r.returned && k === 0;
    case 'clean': case 'nolost': return r.returned && (r.lost ?? 0) === 0;
  }
}

export interface JobRow { job: Job; ok: boolean; scrap: number }
/** Pays the jobs, moves reputation, and hands out the lasting effects. Also counts one mission as passed. */
export function settle(s: RunState, world: Dest, jobs: Job[], r: Parameters<typeof jobDone>[1], need: number): { state: RunState; rows: JobRow[]; scrap: number } {
  let st = tick(s), total = 0; const rows: JobRow[] = [];
  const bonus = 1 + 0.08 * s.rep[world];
  for (const j of jobs) {
    const ok = jobDone(j, r, need), scrap = ok ? Math.round(j.reward * bonus) : 0;
    rows.push({ job: j, ok, scrap }); total += scrap;
    if (ok) { st = bumpRep(st, world, 1); if (j.win) st = grant(st, j.win); } else if (j.lose) st = grant(st, j.lose);
  }
  return { state: { ...st, jobs: st.jobs + jobs.length }, rows, scrap: total };
}
export { slotsFor };
