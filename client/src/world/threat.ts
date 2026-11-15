/** The game answers how strong you are: the more you upgrade, the more (and the more varied) creatures push back.
 *  Pure functions, so they are easy to test. Never more than MAX_ENEMIES at once. */
import { MAX_ENEMIES, type VariantKind } from './combat';
import type { Mods } from './levels';
import { upgradesOf, perksFor, type Meta, type Ship } from './meta';

/** 0 = fresh ship, 1 = everything bought (plus a bonus for the weapon's level). */
export function powerOf(meta: Meta, ship: Ship): number {
  const ups = upgradesOf(ship), max = ups.reduce((a, u) => a + u.max, 0) || 1;
  const total = ups.reduce((a, u) => a + (meta.levels[u.id] ?? 0), 0);
  return Math.min(1, total / max + 0.05 * perksFor(ship, meta).weapon);
}
/** 0..3, the same steps as the ship tiers. */
export const threatTier = (power: number): 0 | 1 | 2 | 3 => (power >= 0.7 ? 3 : power >= 0.4 ? 2 : power >= 0.12 ? 1 : 0);

/** Which extra creatures are out there. The easiest level holds the next one back so little kids are not swamped. */
export function variantsFor(power: number, level: Mods['level']): VariantKind[] {
  const t = Math.max(0, threatTier(power) - (level === 'easy' ? 1 : 0));
  return (['swarmer', 'dasher', 'brute'] as VariantKind[]).slice(0, t);
}

export interface Threat { power: number; tier: number; variants: VariantKind[] }
/** The mission's enemy numbers, scaled to the player's power: same level, stronger ship → tougher, faster, more varied (still ≤ 4 at once). */
export function scaleForPower(mods: Mods, power: number): Mods {
  const p = Math.max(0, Math.min(1, power));
  return {
    ...mods,
    enemyMax: Math.min(MAX_ENEMIES, Math.max(1, mods.enemyMax + Math.round(p * 2.2))),
    enemyHp: mods.enemyHp * (1 + 0.8 * p),
    enemySpeed: mods.enemySpeed * (1 + 0.25 * p),
    enemyDmg: mods.enemyDmg * (1 + 0.4 * p),
    variants: variantsFor(p, mods.level),
  };
}
