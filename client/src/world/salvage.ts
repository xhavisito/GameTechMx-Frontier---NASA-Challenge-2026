import { UPGRADES, costOf, type Meta } from './meta';
import { EMERGENCY_FUND } from './design';
import type { RunState } from './runstate';
import type { Level } from './levels';

/** Dying costs you everything (scrap, upgrades, reputation). You may buy it all back, once, right now, for a price that hurts. Say no and it is gone for good. */
export interface Salvage { meta: Meta; run: RunState; price: number; scrap: number; levels: number; at: number }
const KEY = 'frontier-salvage-v1';
export const SALVAGE_KEY = KEY;
const LEVEL_MUL: Record<Level, number> = { easy: 0.6, medium: 1, hard: 1.15, expert: 1.3 };
export const levelsOwned = (m: Meta) => Object.values(m.levels).reduce((a, n) => a + n, 0);
/** What the upgrades are worth, to show the player how much is at stake. */
export const upgradeValue = (m: Meta) => UPGRADES.reduce((sum, u) => { let v = 0; for (let k = 0; k < (m.levels[u.id] ?? 0); k++) v += costOf({ ...m, levels: { ...m.levels, [u.id]: k } }, u.id); return sum + v; }, 0);
/** Only worth a prompt when there is something real to lose (the first missions are free). */
export const hasStakes = (m: Meta) => levelsOwned(m) > 0 || m.scrap > EMERGENCY_FUND * 2;
/** Price to get everything back: more than half of your scrap plus a fee per upgrade level. Poorer than that, it takes all you have (if it is at least 25). */
export function priceFor(m: Meta, level: Level): number | null {
  const raw = Math.max(40, Math.round((0.55 * m.scrap + 6 * levelsOwned(m)) * LEVEL_MUL[level]));
  if (m.scrap >= raw) return raw;
  return m.scrap >= 25 ? m.scrap : null;
}
export const afterLoss = (m: Meta): Meta => ({ ...m, scrap: EMERGENCY_FUND, levels: {} });
export const afterPaying = (s: Salvage): Meta => ({ ...s.meta, scrap: Math.max(EMERGENCY_FUND, s.meta.scrap - s.price) });

export function parseSalvage(raw: string | null): Salvage | null {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (v && v.meta && typeof v.meta.scrap === 'number' && typeof v.price === 'number' && v.run && typeof v.meta.levels === 'object') return v as Salvage;
  } catch { /* corrupted: nothing to recover */ }
  return null;
}
export const loadSalvage = (): Salvage | null => { try { return parseSalvage(localStorage.getItem(KEY)); } catch { return null; } };
export function saveSalvage(s: Salvage | null) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* private mode */ } }
