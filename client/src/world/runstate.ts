import type { Perks } from './meta';
import type { Mods } from './levels';
import type { Dest } from './design';

/**
 * What carries over from mission to mission inside one run: boons and banes earned from trip events and from the mission board,
 * plus the reputation you build at each planet's base. Everything here is plain data so it can be saved and tested.
 */
export interface ModDef {
  id: string; icon: string; es: string; en: string; descEs: string; descEn: string; bad?: boolean; turns: number;
  fx?: Partial<Perks>;
  /** added to the hazard damage multiplier (0.3 = +30 %) */
  hazard?: number;
  /** added to the scrap multiplier */
  scrap?: number;
  /** added to the energy drain multiplier */
  drain?: number;
}
export const RUN_MODS: ModDef[] = [
  { id: 'tailwind', icon: '💨', es: 'Viento a favor', en: 'Tailwind', descEs: '+15 % de velocidad', descEn: '+15% speed', turns: 3, fx: { speedMul: 0.15 } },
  { id: 'spare_parts', icon: '🔩', es: 'Refacciones', en: 'Spare parts', descEs: '+25 de vida', descEn: '+25 health', turns: 3, fx: { health: 25 } },
  { id: 'calibrated', icon: '🎯', es: 'Sensores calibrados', en: 'Calibrated sensors', descEs: '+10 de alcance de detección', descEn: '+10 detection range', turns: 3, fx: { scan: 10 } },
  { id: 'good_rep', icon: '🤝', es: 'Buena fama', en: 'Good name', descEs: '+20 % de chatarra', descEn: '+20% scrap', turns: 3, scrap: 0.2 },
  { id: 'cold_cells', icon: '🔋', es: 'Celdas frescas', en: 'Fresh cells', descEs: '+20 % de energía', descEn: '+20% energy', turns: 2, fx: { energyMul: 0.2 } },
  { id: 'sharp_eye', icon: '🧲', es: 'Brazo largo', en: 'Long arm', descEs: '+3 m para recoger', descEn: '+3 m pickup reach', turns: 3, fx: { reach: 3 } },
  { id: 'quick_hands', icon: '⚡', es: 'Manos rápidas', en: 'Quick hands', descEs: 'El arma recarga 25 % más rápido', descEn: 'Weapon reloads 25% faster', turns: 3, fx: { reload: 0.25 } },
  { id: 'lucky_charm', icon: '🍀', es: 'Amuleto de suerte', en: 'Lucky charm', descEs: '+30 % de chatarra', descEn: '+30% scrap', turns: 2, fx: { luck: 0.3 } },
  { id: 'calm_crew', icon: '🕊️', es: 'Bichos tranquilos', en: 'Calm critters', descEs: 'Los enemigos son 15 % más lentos', descEn: 'Enemies are 15% slower', turns: 3, fx: { enemySlow: -0.15 } },
  { id: 'rattle', icon: '🔔', es: 'Chasis flojo', en: 'Loose chassis', descEs: '−12 % de velocidad', descEn: '−12% speed', turns: 2, bad: true, fx: { speedMul: -0.12 } },
  { id: 'sore_hull', icon: '🩹', es: 'Casco golpeado', en: 'Dented hull', descEs: '−20 de vida', descEn: '−20 health', turns: 2, bad: true, fx: { health: -20 } },
  { id: 'loud_engine', icon: '📢', es: 'Motor ruidoso', en: 'Loud engine', descEs: '30 % más enemigos', descEn: '30% more enemies', turns: 2, bad: true, fx: { enemyMore: 0.3 } },
  { id: 'debt', icon: '💸', es: 'Deuda con la base', en: 'Debt to the base', descEs: '−25 % de chatarra', descEn: '−25% scrap', turns: 2, bad: true, scrap: -0.25 },
  { id: 'dusty_lens', icon: '🌫️', es: 'Lente empañado', en: 'Foggy lens', descEs: '−8 de alcance de detección', descEn: '−8 detection range', turns: 2, bad: true, fx: { scan: -8 } },
  { id: 'weak_cells', icon: '🪫', es: 'Celdas gastadas', en: 'Worn cells', descEs: '−15 % de energía', descEn: '−15% energy', turns: 2, bad: true, fx: { energyMul: -0.15 } },
  { id: 'storm_belt', icon: '🌪️', es: 'Cinturón de tormentas', en: 'Storm belt', descEs: 'Los peligros pegan 30 % más fuerte', descEn: 'Hazards hit 30% harder', turns: 2, bad: true, hazard: 0.3 },
  { id: 'jam', icon: '🧱', es: 'Arma atascada', en: 'Jammed weapon', descEs: 'El arma recarga 20 % más lento', descEn: 'Weapon reloads 20% slower', turns: 2, bad: true, fx: { reload: -0.2 } },
  { id: 'thirsty', icon: '🔥', es: 'Sistemas sedientos', en: 'Thirsty systems', descEs: 'Gastas 20 % más energía', descEn: 'You burn 20% more energy', turns: 2, bad: true, drain: 0.2 },
];
export const modById = (id: string) => RUN_MODS.find(m => m.id === id);

export interface RunState { mods: { id: string; left: number }[]; rep: Record<Dest, number>; seen: string[]; jobs: number }
export const emptyRun = (): RunState => ({ mods: [], rep: { mars: 0, jupiter: 0, miller: 0 }, seen: [], jobs: 0 });
export const REP_MAX = 6;
/** reputation opens harder (and better paid) jobs */
export const tierFor = (rep: number): 1 | 2 | 3 => (rep >= 4 ? 3 : rep >= 2 ? 2 : 1);
/** how many jobs you may carry at once */
export const slotsFor = (rep: number) => (rep >= 4 ? 3 : 2);

/** Gives (or refreshes) an effect. Refreshing never shortens it. */
export function grant(s: RunState, id: string, turns?: number): RunState {
  const d = modById(id); if (!d) return s;
  const n = turns ?? d.turns, has = s.mods.find(m => m.id === id);
  return { ...s, mods: has ? s.mods.map(m => (m.id === id ? { ...m, left: Math.max(m.left, n) } : m)) : [...s.mods, { id, left: n }] };
}
/** One mission has passed: effects count down and expire. */
export const tick = (s: RunState): RunState => ({ ...s, mods: s.mods.map(m => ({ ...m, left: m.left - 1 })).filter(m => m.left > 0) });
export const remember = (s: RunState, ids: string[]): RunState => ({ ...s, seen: [...ids, ...s.seen.filter(x => !ids.includes(x))].slice(0, 14) });
export const bumpRep = (s: RunState, w: Dest, by: number): RunState => ({ ...s, rep: { ...s.rep, [w]: Math.max(0, Math.min(REP_MAX, s.rep[w] + by)) } });
const defs = (s: RunState) => s.mods.map(m => modById(m.id)).filter((d): d is ModDef => !!d);

/** The ship's perks with everything the run has given or taken. */
export function applyRunPerks(p: Perks, s: RunState): Perks {
  const o = { ...p };
  for (const d of defs(s)) for (const k of Object.keys(d.fx ?? {}) as (keyof Perks)[]) o[k] = (o[k] as number) + (d.fx![k] as number);
  o.health = Math.max(40, o.health); o.speedMul = Math.max(0.5, o.speedMul); o.energyMul = Math.max(0.4, o.energyMul); o.reload = Math.max(0.4, o.reload); o.enemySlow = Math.max(0.4, o.enemySlow);
  return o;
}
/** The mission's difficulty with the run's hazards, drain and scrap. */
export function applyRunMods(m: Mods, s: RunState): Mods {
  let hz = 0, sc = 0, dr = 0;
  for (const d of defs(s)) { hz += d.hazard ?? 0; sc += d.scrap ?? 0; dr += d.drain ?? 0; }
  return { ...m, hazardDmg: Math.round(m.hazardDmg * (1 + hz)), scrapMul: Math.max(0.3, m.scrapMul + sc), drainMul: m.drainMul * (1 + dr) };
}

const KEY = 'frontier-run-v1';
export function loadRun(): RunState {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return emptyRun();
    const o = JSON.parse(raw) as Partial<RunState>, b = emptyRun();
    return { mods: (o.mods ?? []).filter(m => modById(m.id) && m.left > 0), rep: { ...b.rep, ...(o.rep ?? {}) }, seen: o.seen ?? [], jobs: o.jobs ?? 0 };
  } catch { return emptyRun(); }
}
export function saveRun(s: RunState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
export const RUN_KEY = KEY;
