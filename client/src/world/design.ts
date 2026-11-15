import type { Level, Mods } from './levels';

export type Dest = 'mars' | 'jupiter' | 'miller';
export type Tool = 'camera' | 'spectrometer' | 'radar';
export type RocketId = 'light' | 'standard' | 'heavy';

/** Everything the player decides in the hangar. Easy ignores most of it; expert uses all of it. */
export interface Design {
  dest: Dest; rocket: RocketId; tools: Tool[];
  solarM2: number; batteryKWh: number; shield: number;
}

export const ROCKETS: Record<RocketId, { dry: number; prop: number; cost: number; maxPayload: number }> = {
  light: { dry: 1000, prop: 4200, cost: 40, maxPayload: 500 },
  standard: { dry: 1500, prop: 7500, cost: 70, maxPayload: 800 },
  heavy: { dry: 2300, prop: 13500, cost: 120, maxPayload: 1200 },
};
export const TOOLS: Record<Tool, { mass: number; cost: number; watts: number }> = {
  camera: { mass: 10, cost: 5, watts: 25 }, spectrometer: { mass: 18, cost: 12, watts: 60 }, radar: { mass: 32, cost: 20, watts: 110 },
};
const ROVER_MASS = 220, ROVER_COST = 25, ROVER_WATTS = 180;
const ISP = 350, G0 = 9.81;
/** Δv in km/s (stylised numbers for the game), sunlight relative to Earth, and the heat shield level the trip needs. */
export const DEST: Record<Dest, { dv: number; sun: number; shield: number; needs: Tool }> = {
  mars: { dv: 4.1, sun: 0.43, shield: 1, needs: 'radar' },
  miller: { dv: 4.6, sun: 0.9, shield: 2, needs: 'spectrometer' },
  jupiter: { dv: 5.2, sun: 0.037, shield: 3, needs: 'camera' },
};
export const BUDGET: Record<Level, number> = { easy: 1e9, medium: 1e9, hard: 150, expert: 160 };
export const SOLAR_W_PER_M2 = 120;

export const defaultDesign = (dest: Dest = 'mars'): Design => ({ dest, rocket: 'standard', tools: ['camera'], solarM2: 3, batteryKWh: 2, shield: DEST[dest].shield });

/** What the level lets the player decide; anything else is filled in automatically. */
export function normalize(d: Design, level: Level): Design {
  const out = { ...d, tools: d.tools.slice() };
  if (level === 'easy') { out.rocket = 'standard'; out.solarM2 = 3; out.batteryKWh = 2; out.tools = out.tools.slice(0, 1); }
  if (level === 'easy' || level === 'medium' || level === 'hard') out.shield = DEST[d.dest].shield;
  if (level === 'easy' || level === 'medium') out.tools = out.tools.slice(0, 1);
  return out;
}

export interface Stats { payload: number; cost: number; dv: number; watts: number; supplyW: number; needW: number }
export function stats(d: Design): Stats {
  const payload = ROVER_MASS + d.tools.reduce((a, t) => a + TOOLS[t].mass, 0) + d.solarM2 * 7 + d.batteryKWh * 10 + d.shield * 35;
  const cost = ROVER_COST + ROVER_COST * 0 + ROCKETS[d.rocket].cost + d.tools.reduce((a, t) => a + TOOLS[t].cost, 0) + d.solarM2 * 3 + d.batteryKWh * 4 + d.shield * 4;
  const r = ROCKETS[d.rocket];
  const dv = (ISP * G0 / 1000) * Math.log((r.dry + r.prop + payload) / (r.dry + payload));
  const needW = ROVER_WATTS + d.tools.reduce((a, t) => a + TOOLS[t].watts, 0);
  const supplyW = d.solarM2 * SOLAR_W_PER_M2 * DEST[d.dest].sun + (d.batteryKWh * 1000) / 8;
  return { payload, cost, dv, watts: needW, supplyW, needW };
}

export interface TestResult { id: string; ok: boolean; value: string; need: string; fixEs: string; fixEn: string }
const f = (n: number, k = 0) => n.toFixed(k);

/** Pre-flight checks. Medium runs 1, hard 4, expert 7: each one is a real engineering constraint. */
/** Extra capacity the rocket got in the workshop. */
export interface RocketBonus { dv: number; payload: number; budget: number }
export const NO_BONUS: RocketBonus = { dv: 0, payload: 0, budget: 0 };
export function runTests(raw: Design, level: Level, bonus: RocketBonus = NO_BONUS): TestResult[] {
  const d = normalize(raw, level), s = stats(d), r = ROCKETS[d.rocket], dest = DEST[d.dest];
  s.dv += bonus.dv; const maxPay = r.maxPayload + bonus.payload, budget = BUDGET[level] + bonus.budget;
  const margin = s.dv / dest.dv - 1;
  const all: TestResult[] = [
    { id: 'dv', ok: margin >= (level === 'expert' ? 0.03 : 0), value: `${f(s.dv, 2)} km/s`, need: `≥ ${f(dest.dv * (level === 'expert' ? 1.03 : 1), 2)} km/s`, fixEs: 'Falta combustible: usa un cohete más grande o lleva menos carga.', fixEn: 'Not enough fuel: use a bigger rocket or carry less.' },
    { id: 'mass', ok: s.payload <= maxPay, value: `${f(s.payload)} kg`, need: `≤ ${maxPay} kg`, fixEs: 'La carga pesa demasiado para este cohete.', fixEn: 'The payload is too heavy for this rocket.' },
    { id: 'cost', ok: s.cost <= budget, value: `${f(s.cost)} M$`, need: `≤ ${budget} M$`, fixEs: 'Te pasaste del presupuesto: quita instrumentos o usa un cohete más barato.', fixEn: 'Over budget: drop instruments or use a cheaper rocket.' },
    { id: 'power', ok: s.supplyW >= s.needW, value: `${f(s.supplyW)} W`, need: `≥ ${f(s.needW)} W`, fixEs: d.dest === 'jupiter' ? 'En Júpiter casi no hay sol: necesitas más batería.' : 'Poca energía: agrega paneles o batería.', fixEn: d.dest === 'jupiter' ? 'There is almost no sunlight at Jupiter: you need more battery.' : 'Not enough power: add panels or battery.' },
    { id: 'thermal', ok: d.shield >= dest.shield, value: `${d.shield}`, need: `≥ ${dest.shield}`, fixEs: 'El escudo térmico es muy delgado para este destino.', fixEn: 'The heat shield is too thin for this destination.' },
    { id: 'tool', ok: d.tools.includes(dest.needs), value: d.tools.join(', ') || '—', need: dest.needs, fixEs: `Este destino exige llevar: ${dest.needs === 'radar' ? 'radar' : dest.needs === 'camera' ? 'cámara' : 'analizador'}.`, fixEn: `This destination requires: ${dest.needs}.` },
    { id: 'reserve', ok: d.batteryKWh >= 1, value: `${f(d.batteryKWh, 1)} kWh`, need: '≥ 1 kWh', fixEs: 'Sin reserva para la noche o los eclipses: sube la batería.', fixEn: 'No reserve for night or eclipses: raise the battery.' },
  ];
  const pick = (ids: string[]) => ids.map(i => all.find(t => t.id === i)!);
  if (level === 'easy') return [];
  if (level === 'medium') return pick(['dv']);
  if (level === 'hard') return pick(['dv', 'mass', 'cost', 'power']);
  return pick(['dv', 'mass', 'cost', 'power', 'thermal', 'tool', 'reserve']);
}
export const passed = (t: TestResult[]) => t.every(x => x.ok);

/** Is there at least one valid design? (used by tests so no level is impossible) */
export function someDesignPasses(dest: Dest, level: Level): boolean {
  for (const rocket of ['light', 'standard', 'heavy'] as RocketId[]) for (const tool of ['camera', 'spectrometer', 'radar'] as Tool[])
    for (const solarM2 of [1, 2, 3, 4]) for (const batteryKWh of [1, 2, 3, 4]) for (const shield of [1, 2, 3])
      if (passed(runTests({ dest, rocket, tools: [tool], solarM2, batteryKWh, shield }, level))) return true;
  return false;
}

// ── travel events (hard and expert) ──────────────────────────────────────────
export interface Effects { health?: number; energy?: number; time?: number }
export interface EventOption { es: string; en: string; fx: Effects; noteEs?: string; noteEn?: string }
export interface TravelEvent { id: string; es: string; en: string; options: EventOption[] }
export const EVENTS: TravelEvent[] = [
  { id: 'storm', es: 'Tormenta solar: llegan partículas de alta energía.', en: 'Solar storm: high-energy particles are arriving.',
    options: [{ es: 'Modo seguro: apagar sistemas un rato', en: 'Safe mode: shut systems down for a while', fx: { time: -30 }, noteEs: 'Pierdes 30 s de misión', noteEn: 'Lose 30 s of mission time' }, { es: 'Seguir con todo encendido', en: 'Keep everything on', fx: { health: -22 }, noteEs: 'El casco sufre −22', noteEn: 'Hull takes −22' }] },
  { id: 'dust', es: 'Micrometeoroides: una nube de polvo cruza tu ruta.', en: 'Micrometeoroids: a dust cloud crosses your path.',
    options: [{ es: 'Girar la nave y proteger los paneles', en: 'Turn the ship and shield the panels', fx: { energy: -0.2 }, noteEs: 'Empiezas con 20 % menos de energía', noteEn: 'Start with 20% less power' }, { es: 'Aceptar el riesgo', en: 'Accept the risk', fx: { health: -15 }, noteEs: 'El casco sufre −15', noteEn: 'Hull takes −15' }] },
  { id: 'burn', es: 'Corrección de rumbo: te desvías de la trayectoria.', en: 'Course correction: you drift off the planned path.',
    options: [{ es: 'Corregir con el motor (gasta combustible)', en: 'Correct with the engine (uses fuel)', fx: { energy: -0.1 }, noteEs: '10 % menos de energía', noteEn: '10% less power' }, { es: 'Dejarlo así', en: 'Leave it', fx: { time: -45, health: -8 }, noteEs: '−45 s y casco −8', noteEn: '−45 s and hull −8' }] },
];
export const eventsFor = (level: Level, seed: number): TravelEvent[] => {
  const n = level === 'expert' ? 2 : level === 'hard' ? 1 : 0;
  return Array.from({ length: n }, (_, i) => EVENTS[(seed + i * 2) % EVENTS.length]!);
};
/** Fold the chosen options into what the mission starts with. */
export function applyEffects(mods: Mods, fx: Effects[], shield = 0): { mods: Mods; energy: number; health: number } {
  let energy = 1, health = 100, limit = mods.timeLimit;
  for (const e of fx) { energy += e.energy ?? 0; health += (e.health ?? 0) * (1 - Math.min(0.9, shield)); if (limit && e.time) limit = Math.max(60, limit + e.time); }
  return { mods: { ...mods, timeLimit: limit, startHealth: Math.max(30, health), startEnergy: Math.max(0.3, energy) }, energy: Math.max(0.3, energy), health: Math.max(30, health) };
}
