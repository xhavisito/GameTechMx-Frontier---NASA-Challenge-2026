import { useSyncExternalStore } from 'react';
import { gradeOf, type MarsResult } from './marsWorld';
import type { Perks } from './meta';

/** Local split-screen co-op: two people, one vehicle each, same world and mission, team result. */
const KEY = 'frontier-coop-v1';
let cur = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
const subs = new Set<() => void>();
export const getCoop = () => cur;
export function setCoop(on: boolean) { cur = on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ } subs.forEach(f => f()); }
export const useCoop = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, getCoop);
export const COOP_KEY = KEY;

/** One team result from two players' runs: scores average, everything countable adds up, the team counts as returned if either of you made it back. */
export function mergeResults(a: MarsResult, b: MarsResult): MarsResult {
  const score = Math.round((a.score + b.score) / 2), best = a.score >= b.score ? a : b;
  const opt = (x?: number, y?: number, f: (p: number, q: number) => number = Math.min) => (x === undefined ? y : y === undefined ? x : f(x, y));
  return {
    score, grade: gradeOf(score), science: a.science + b.science, returned: a.returned || b.returned, samples: [...a.samples, ...b.samples],
    kills: (a.kills ?? 0) + (b.kills ?? 0), pois: (a.pois ?? 0) + (b.pois ?? 0), lost: (a.lost ?? 0) + (b.lost ?? 0),
    hull: opt(a.hull, b.hull), secs: opt(a.secs, b.secs, Math.max), exploded: !!(a.exploded && b.exploded), why: best.why,
  };
}
