import type { Dest } from './design';

/** Exploration map: every world is split into cells; driving through a cell marks it for good (saved on this device). Milestones pay scrap once. */
export interface Grid { w: number; h: number; target: number }
export const GRID: Record<Dest, Grid> = { mars: { w: 20, h: 20, target: 240 }, miller: { w: 20, h: 20, target: 240 }, jupiter: { w: 36, h: 18, target: 300 } };
export const MILESTONES = [{ pct: 25, scrap: 25 }, { pct: 50, scrap: 40 }, { pct: 75, scrap: 60 }, { pct: 100, scrap: 100 }];
export interface MapState { cells: Record<Dest, string[]>; claimed: Record<Dest, number[]> }
const KEY = 'frontier-map-v1';
const blank = (): MapState => ({ cells: { mars: [], jupiter: [], miller: [] }, claimed: { mars: [], jupiter: [], miller: [] } });
export function parseMap(raw: string | null): MapState {
  const b = blank();
  try {
    const v = JSON.parse(raw ?? 'null');
    for (const d of ['mars', 'jupiter', 'miller'] as Dest[]) {
      if (Array.isArray(v?.cells?.[d])) b.cells[d] = v.cells[d].filter((k: unknown) => typeof k === 'string' && /^\d+,\d+$/.test(k as string));
      if (Array.isArray(v?.claimed?.[d])) b.claimed[d] = v.claimed[d].filter((n: unknown) => typeof n === 'number');
    }
  } catch { /* corrupted: start blank */ }
  return b;
}
let state: MapState = (() => { try { return parseMap(localStorage.getItem(KEY)); } catch { return blank(); } })();
const seen: Record<Dest, Set<string>> = { mars: new Set(state.cells.mars), jupiter: new Set(state.cells.jupiter), miller: new Set(state.cells.miller) };
let timer: ReturnType<typeof setTimeout> | null = null;
export function flush() {
  timer = null;
  for (const d of Object.keys(seen) as Dest[]) state.cells[d] = [...seen[d]];
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
const clampi = (n: number, hi: number) => Math.max(0, Math.min(hi - 1, Math.floor(n)));
/** Marks the cell under (a, b) given in the world's own units (see cellOf*). */
export function mark(world: Dest, cx: number, cy: number) {
  const g = GRID[world], k = `${clampi(cx, g.w)},${clampi(cy, g.h)}`;
  if (seen[world].has(k)) return;
  seen[world].add(k); if (!timer) timer = setTimeout(flush, 1500);
}
/** Square worlds (Mars, Miller): x,z in −half..half. */
export const markSquare = (world: Dest, x: number, z: number, half: number) => mark(world, ((x + half) / (2 * half)) * GRID[world].w, ((z + half) / (2 * half)) * GRID[world].h);
/** Jupiter: latitude −π/2..π/2 and longitude −π..π in radians. */
export const markSphere = (lat: number, lon: number) => mark('jupiter', ((((lon + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * GRID.jupiter.w, ((lat + Math.PI / 2) / Math.PI) * GRID.jupiter.h);
export const visited = (world: Dest) => [...seen[world]].map(k => k.split(',').map(Number) as [number, number]);
export const percent = (world: Dest) => Math.min(100, Math.round((100 * seen[world].size) / GRID[world].target));
/** Pays each milestone you have reached and not collected yet; returns the scrap and the new milestone percentages. */
export function claim(world: Dest): { scrap: number; got: number[] } {
  const p = percent(world), got = MILESTONES.filter(m => p >= m.pct && !state.claimed[world].includes(m.pct));
  if (!got.length) return { scrap: 0, got: [] };
  state.claimed[world] = [...state.claimed[world], ...got.map(m => m.pct)]; flush();
  return { scrap: got.reduce((a, m) => a + m.scrap, 0), got: got.map(m => m.pct) };
}
export const nextMilestone = (world: Dest) => MILESTONES.find(m => !state.claimed[world].includes(m.pct)) ?? null;
export function resetMap() { state = blank(); for (const d of Object.keys(seen) as Dest[]) seen[d].clear(); }
export const MAP_KEY = KEY;
