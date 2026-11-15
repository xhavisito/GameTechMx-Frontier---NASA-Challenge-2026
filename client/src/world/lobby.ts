/** The Earth "lobby": where things stand, what is solid, and where the scenery grows. Pure data and maths (no three.js), so it is easy to test. */
import { rng } from '../three/noise';
import { COIN_POS, RACE, RAMP, PITCH } from './earthgames';

export const HANGAR_POS = { x: -34, z: 26 };
export const ROCKET_POS = { x: 34, z: -22 };

export interface Solid { x: number; z: number; r: number }
/** Things the rover cannot drive through (circles), besides the hangar hall and the rocket itself. */
export const SOLIDS: Solid[] = [
  { x: ROCKET_POS.x - 8, z: ROCKET_POS.z + 3, r: 2.6 },            // launch tower
  { x: ROCKET_POS.x + 9, z: ROCKET_POS.z + 6, r: 2.8 },            // fuel tanks
  { x: ROCKET_POS.x + 12.5, z: ROCKET_POS.z + 3, r: 2.4 },
  { x: -75, z: -15, r: 8 },                                        // solar farm
  { x: 75, z: 40, r: 1.8 }, { x: 88, z: 52, r: 1.8 }, { x: 70, z: 62, r: 1.8 },   // wind turbines
  { x: -60, z: 60, r: 6 }, { x: -48, z: 66, r: 6 }, { x: -70, z: 72, r: 6 },      // habitat domes
  { x: 78, z: -28, r: 3.2 },                                       // radio dish
];
export const solidAt = (x: number, z: number) => SOLIDS.some(s => Math.hypot(x - s.x, z - s.z) < s.r);

/** Stepping stones and lamp posts follow two paths: start → hangar door, start → rocket. */
const START = { x: 0, z: 8 };
const hangarDoor = () => { const d = Math.hypot(HANGAR_POS.x, HANGAR_POS.z), ux = -HANGAR_POS.x / d, uz = -HANGAR_POS.z / d; return { x: HANGAR_POS.x + ux * 16, z: HANGAR_POS.z + uz * 16 }; };
export function pathPoints(step: number): { x: number; z: number; nx: number; nz: number }[] {
  const out: { x: number; z: number; nx: number; nz: number }[] = [];
  const legs = [[START, hangarDoor()], [START, { x: ROCKET_POS.x - 9, z: ROCKET_POS.z + 9 }]] as const;
  for (const [a, b] of legs) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), n = Math.floor(len / step);
    for (let i = 1; i < n; i++) out.push({ x: a.x + (dx * i) / n, z: a.z + (dz * i) / n, nx: -dz / len, nz: dx / len });
  }
  return out;
}

/** Every spot that must stay clear: gameplay props, buildings and the path. */
export function keepClear(x: number, z: number, margin = 0): boolean {
  if (Math.hypot(x - HANGAR_POS.x, z - HANGAR_POS.z) < 24 + margin) return true;
  if (Math.hypot(x - ROCKET_POS.x, z - ROCKET_POS.z) < 17 + margin) return true;
  if (Math.abs(x - PITCH.x) < PITCH.hw + 5 + margin && Math.abs(z - PITCH.z) < PITCH.hl + 5 + margin) return true;
  if (Math.hypot(x - START.x, z - START.z) < 8 + margin) return true;
  if ([RACE.start, ...RACE.cones, RAMP].some(q => Math.hypot(x - q.x, z - q.z) < 6 + margin)) return true;
  if (COIN_POS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 4 + margin)) return true;
  if (SOLIDS.some(s => Math.hypot(x - s.x, z - s.z) < s.r + 3 + margin)) return true;
  return pathPoints(4).some(p => Math.hypot(x - p.x, z - p.z) < 3.5 + margin);
}

export interface Plant { x: number; z: number; s: number; c: string }
const BUSH = ['#2f9e5b', '#3fb86a', '#48c978', '#6fcf5a'], FLOWER = ['#ff7a59', '#ffc857', '#ff5d73', '#b39ddb', '#7fdcff', '#fff4e6'];
/** Bushes and flower patches scattered over the meadow (walk-through). */
export function scatter(seed: number, bushes: number, flowers: number): { bushes: Plant[]; flowers: Plant[] } {
  const r = rng(seed), b: Plant[] = [], f: Plant[] = [];
  for (let i = 0; i < bushes * 6 && b.length < bushes; i++) { const x = (r() * 2 - 1) * 115, z = (r() * 2 - 1) * 115; if (!keepClear(x, z)) b.push({ x, z, s: 0.7 + r() * 1.1, c: BUSH[Math.floor(r() * BUSH.length)]! }); }
  for (let i = 0; i < flowers * 6 && f.length < flowers; i++) {
    const cx = (r() * 2 - 1) * 112, cz = (r() * 2 - 1) * 112, col = FLOWER[Math.floor(r() * FLOWER.length)]!;
    if (keepClear(cx, cz, 2)) continue;
    for (let k = 0; k < 6 && f.length < flowers; k++) f.push({ x: cx + (r() - 0.5) * 5, z: cz + (r() - 0.5) * 5, s: 0.6 + r() * 0.6, c: col });   // a small patch of one colour
  }
  return { bushes: b, flowers: f };
}
