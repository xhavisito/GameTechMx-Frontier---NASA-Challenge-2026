import { fbm2, rng } from '../three/noise';

export const HALF = 130; // world is a square of side 2*HALF metres
export const LANDER_R = 9;

export interface WorldConfig { seed: number; camera: boolean; spectrometer: boolean; radar: boolean; battery: number; solar: number; health: number; speedMul?: number; reach?: number; scan?: number; science?: number }
export type SampleKind = 'regolith' | 'basalt' | 'hematite' | 'ice';
export interface SampleSite { id: number; kind: SampleKind; x: number; z: number; /** ice is buried: only radar reveals it */ buried: boolean; }
export interface Rock { x: number; z: number; s: number; r: number; tint: number; }
export interface Crater { x: number; z: number; r: number; depth: number; }
export interface MarsWorldData { seed: number; amp?: number; craters: Crater[]; rocks: Rock[]; samples: SampleSite[]; }

export function createWorld(cfg: WorldConfig): MarsWorldData {
  const rand = rng(cfg.seed ^ 0x9e3779b9);
  const craters: Crater[] = [];
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, d = 35 + rand() * 80;
    craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 7 + rand() * 11, depth: 1.5 + rand() * 2.5 });
  }
  const kinds: SampleKind[] = ['regolith', 'basalt', 'hematite', 'ice', 'basalt', 'regolith'];
  const samples: SampleSite[] = kinds.map((kind, i) => {
    const a = (i / kinds.length) * Math.PI * 2 + rand() * 0.8, d = 32 + rand() * 78;
    return { id: i, kind, x: Math.cos(a) * d, z: Math.sin(a) * d, buried: kind === 'ice' };
  });
  const rocks: Rock[] = [];
  for (let i = 0; i < 260; i++) {
    const x = (rand() * 2 - 1) * (HALF - 4), z = (rand() * 2 - 1) * (HALF - 4);
    if (Math.hypot(x, z) < LANDER_R + 4) continue;
    rocks.push({ x, z, s: 0.5 + rand() * rand() * 2.8, r: rand() * 6.28, tint: rand() });
  }
  return { seed: cfg.seed, craters, rocks, samples };
}

/** Terrain height in metres. Flat around the lander, rolling dunes elsewhere, bowl-shaped craters. */
export function heightAt(w: Pick<MarsWorldData, 'seed' | 'craters' | 'amp'>, x: number, z: number): number {
  let h = (fbm2(w.seed, x * 0.018, z * 0.018, 4) - 0.5) * 16 + Math.sin(x * 0.07 + fbm2(w.seed + 3, z * 0.03, 0, 2) * 6) * 0.8;
  for (const c of w.craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1.35) h += d < 1 ? -c.depth * (1 - d * d) : (d - 1) * 2.2 * (1.35 - d) * 2.5; // bowl plus raised rim
  }
  const dl = Math.hypot(x, z);
  const flat = Math.min(1, Math.max(0, (dl - LANDER_R) / 22));
  return h * (w.amp ?? 1) * flat * flat * (3 - 2 * flat);
}

export function normalAt(w: Pick<MarsWorldData, 'seed' | 'craters' | 'amp'>, x: number, z: number): [number, number, number] {
  const e = 0.6, hx = heightAt(w, x + e, z) - heightAt(w, x - e, z), hz = heightAt(w, x, z + e) - heightAt(w, x, z - e);
  const nx = -hx / (2 * e), nz = -hz / (2 * e), l = Math.hypot(nx, 1, nz);
  return [nx / l, 1 / l, nz / l];
}

// ── Rover ───────────────────────────────────────────────────────────────────
export interface RoverState { x: number; z: number; heading: number; speed: number; steer: number; energy: number; health: number; boost: number; }
export interface DriveInput { throttle: number; steer: number; boost: boolean }
export const MAX_SPEED = 7, BOOST_SPEED = 12;

export function newRover(cfg: WorldConfig): RoverState {
  return { x: 0, z: LANDER_R + 3, heading: 0, speed: 0, steer: 0, energy: cfg.battery, health: cfg.health, boost: 1 };
}

/** One physics step. Pure: returns a new state. Energy drains with motion and recharges from solar when still. */
export function stepRover(w: Pick<MarsWorldData, 'seed' | 'craters' | 'amp'>, cfg: WorldConfig, s: RoverState, input: DriveInput, dt: number, dust = 0): RoverState {
  dt = Math.min(dt, 0.05);
  const fx = Math.max(-1, Math.min(1, input.throttle)), fs = Math.max(-1, Math.min(1, input.steer));
  const hasPower = s.energy > 0;
  const boosting = input.boost && hasPower && s.boost > 0.05 && fx > 0;
  const top = (boosting ? BOOST_SPEED : MAX_SPEED) * (hasPower ? 1 : 0.15) * (cfg.speedMul ?? 1);
  const target = fx * top;
  let speed = s.speed + (target - s.speed) * Math.min(1, dt * (Math.abs(target) > Math.abs(s.speed) ? 2.2 : 3.5));
  const nx0 = normalAt(w, s.x, s.z);
  // slopes slow the rover when climbing along the heading
  const slope = nx0[0] * Math.sin(s.heading) + nx0[2] * Math.cos(s.heading);
  speed *= 1 + Math.min(0.25, Math.max(-0.5, slope * 0.6)) * dt * 3;
  const steer = s.steer + (fs - s.steer) * Math.min(1, dt * 6);
  const heading = s.heading - steer * dt * 1.9 * Math.min(1, 0.35 + Math.abs(speed) / 3);
  let x = s.x + Math.sin(heading) * speed * dt, z = s.z + Math.cos(heading) * speed * dt;
  const lim = HALF - 2;
  if (Math.abs(x) > lim) { x = Math.sign(x) * lim; speed *= 0.3; }
  if (Math.abs(z) > lim) { z = Math.sign(z) * lim; speed *= 0.3; }
  const drain = (Math.abs(speed) / MAX_SPEED) * 0.9 + (boosting ? 2.4 : 0) + 0.04; // Wh per second, scaled for gameplay
  const sun = (cfg.solar / 100) * (1 - 0.8 * dust) * (Math.abs(speed) < 0.3 ? 1.6 : 0.5) * 0.35;
  const energy = Math.max(0, Math.min(cfg.battery, s.energy - drain * dt * (cfg.battery / 120) + sun * dt * (cfg.battery / 120) * 0.6));
  const boost = boosting ? Math.max(0, s.boost - dt * 0.35) : Math.min(1, s.boost + dt * 0.2);
  return { x, z, heading, speed, steer, energy, health: s.health, boost };
}

export const COLLECT_RADIUS = 3.2;
export const detectRange = (cfg: WorldConfig) => (cfg.camera ? 46 : 26) + (cfg.scan ?? 0);

/** Which sample sites can the player currently see? Buried ice needs radar. */
export function visibleSamples(w: MarsWorldData, cfg: WorldConfig, taken: ReadonlySet<number>, x: number, z: number, scanBoost = 0): SampleSite[] {
  const range = detectRange(cfg) + scanBoost;
  return w.samples.filter(s => !taken.has(s.id) && (!s.buried || cfg.radar) && Math.hypot(s.x - x, s.z - z) <= range);
}
export function sampleInReach(w: MarsWorldData, cfg: WorldConfig, taken: ReadonlySet<number>, x: number, z: number): SampleSite | null {
  let best: SampleSite | null = null, bd = COLLECT_RADIUS + (cfg.reach ?? 0);
  for (const s of w.samples) {
    if (taken.has(s.id) || (s.buried && !cfg.radar)) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= bd) { best = s; bd = d; }
  }
  return best;
}

/** One line of the "why this grade?" explanation. `pts` can be negative. */
export interface Part { es: string; en: string; pts: number; max?: number; k?: number }
export interface MarsResult { score: number; science: number; returned: boolean; grade: string; samples: string[]; kills?: number; pois?: number; exploded?: boolean; lost?: number; why?: Part[]; scrapWhy?: Part[] }
export const gradeOf = (score: number) => (score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D');
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Adds the parts up (optionally scaled when the mission was not completed) and keeps the explanation so the player can read it. */
export function tally(parts: Part[], scale?: { k: number; es: string; en: string }): { score: number; grade: string; why: Part[] } {
  const why = parts.map(p => ({ ...p, pts: r1(p.pts) })), sum = parts.reduce((a, p) => a + p.pts, 0);
  const scaled = scale && scale.k !== 1 ? sum * scale.k : sum;
  if (scale && scale.k !== 1) why.push({ es: scale.es, en: scale.en, pts: r1(scaled - sum) });
  const score = Math.max(0, Math.min(100, Math.round(scaled)));
  return { score, grade: gradeOf(score), why };
}
export const REQUIRED_SAMPLES = 3;
const SCIENCE: Record<SampleKind, number> = { regolith: 8, basalt: 10, hematite: 14, ice: 18 };
export function scoreRun(cfg: WorldConfig, kinds: SampleKind[], returned: boolean, rover: RoverState, secondsUsed: number, need = REQUIRED_SAMPLES): MarsResult {
  const science = kinds.reduce((a, k) => a + SCIENCE[k] * (cfg.spectrometer ? 1.5 : 1) * (cfg.science ?? 1), 0);
  const t = tally([
    { es: `Ciencia: ${kinds.length} muestra(s)${cfg.spectrometer ? ' (analizador ×1.5)' : ''}`, en: `Science: ${kinds.length} sample(s)${cfg.spectrometer ? ' (analyzer ×1.5)' : ''}`, pts: Math.min(55, science * 1.1), max: 55 },
    { es: returned ? 'Regresaste al módulo' : 'No regresaste al módulo', en: returned ? 'You returned to the lander' : 'You did not return to the lander', pts: returned ? 25 : 0, max: 25 },
    { es: `Casco al final: ${Math.round(rover.health)} %`, en: `Hull at the end: ${Math.round(rover.health)}%`, pts: (rover.health / 100) * 8, max: 8 },
    { es: `Energía que sobró: ${Math.round((rover.energy / cfg.battery) * 100)} %`, en: `Power left: ${Math.round((rover.energy / cfg.battery) * 100)}%`, pts: (rover.energy / cfg.battery) * 6, max: 6 },
    { es: `Rapidez (${Math.round(secondsUsed)} s)`, en: `Speed (${Math.round(secondsUsed)} s)`, pts: Math.max(0, 6 - secondsUsed / 120), max: 6 },
  ], kinds.length >= need ? undefined : { k: 0.7, es: `Faltaron muestras (${kinds.length} de ${need}): puntos ×0.7`, en: `Missing samples (${kinds.length} of ${need}): points ×0.7` });
  return { score: t.score, science: Math.round(science), returned, grade: t.grade, samples: kinds, why: t.why };
}
