import type { Mods } from './levels';
import type { Perks } from './meta';
import type { Contract } from './contracts';
import type { MarsResult } from './marsWorld';

export const weaponDmg = (w: number) => 1.5 + 0.9 * (w - 1);
export const weaponCd = (p: Perks) => 0.65 / p.reload;
export const grade = (score: number) => (score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D');

/** Score for side contracts (beacons, rescue, photo) and the shared extras. */
export function contractResult(done: number, need: number, health: number, seconds: number, kills: number, exploded: boolean, lost: number): MarsResult {
  const complete = done >= need;
  const raw = (complete ? 55 : (done / need) * 35) + health * 0.2 + Math.max(0, 12 - seconds / 40) + Math.min(10, kills * 2) - lost * 4;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, science: done * 10, returned: complete, grade: grade(score), samples: [], kills, pois: done, exploded, lost };
}
/** Scrap earned by a run. Exploding costs half; harder levels and riskier contracts pay more. */
export function scrapReward(r: Pick<MarsResult, 'score' | 'kills' | 'pois' | 'exploded' | 'returned'>, mods: Mods, perks: Perks, c: Contract): number {
  const base = r.score * 0.5 + (r.kills ?? 0) * 3 + (r.pois ?? 0) * 6 + (r.returned ? 10 : 0);
  const v = base * c.reward * mods.scrapMul * perks.luck * (r.exploded ? 0.5 : 1);
  return Math.max(5, Math.round(v));
}
