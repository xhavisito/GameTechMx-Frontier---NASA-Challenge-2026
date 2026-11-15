import { describe, expect, it } from 'vitest';
import { LEVELS, modsFor } from './levels';
import { MAX_ENEMIES } from './combat';
import { UPGRADES, type Meta } from './meta';
import { powerOf, scaleForPower, threatTier, variantsFor } from './threat';

const fresh = (): Meta => ({ scrap: 0, levels: {}, runs: 0, best: 0, kills: 0 });
const maxed = (): Meta => ({ ...fresh(), levels: Object.fromEntries(UPGRADES.map(u => [u.id, u.max])) });

describe('threat scaling', () => {
  it('power goes from 0 (fresh ship) to 1 (everything bought)', () => {
    for (const ship of ['rover', 'orbiter', 'sub'] as const) { expect(powerOf(fresh(), ship)).toBe(0); expect(powerOf(maxed(), ship)).toBe(1); }
  });
  it('a stronger ship faces tougher, faster and more varied enemies, but never more than 4 at once', () => {
    for (const l of LEVELS) {
      const a = scaleForPower(modsFor(l), 0), b = scaleForPower(modsFor(l), 1);
      expect(b.enemyHp!).toBeGreaterThan(a.enemyHp); expect(b.enemySpeed).toBeGreaterThan(a.enemySpeed); expect(b.enemyDmg).toBeGreaterThan(a.enemyDmg);
      expect(b.enemyMax).toBeGreaterThanOrEqual(a.enemyMax); expect(b.enemyMax).toBeLessThanOrEqual(MAX_ENEMIES); expect(a.enemyMax).toBeLessThanOrEqual(MAX_ENEMIES);
      expect(b.variants!.length).toBeGreaterThanOrEqual(a.variants!.length);
    }
  });
  it('variants unlock in steps, and Easy holds one back', () => {
    expect(variantsFor(0, 'medium')).toEqual([]); expect(variantsFor(0.2, 'medium')).toEqual(['swarmer']);
    expect(variantsFor(0.5, 'medium')).toEqual(['swarmer', 'dasher']); expect(variantsFor(1, 'medium')).toEqual(['swarmer', 'dasher', 'brute']);
    expect(variantsFor(0.2, 'easy')).toEqual([]); expect(variantsFor(1, 'easy')).toEqual(['swarmer', 'dasher']);
    expect([0, 0.12, 0.4, 0.7].map(threatTier)).toEqual([0, 1, 2, 3]);
  });
  it('the base level table already respects the cap', () => { for (const l of LEVELS) expect(modsFor(l).enemyMax).toBeLessThanOrEqual(MAX_ENEMIES); });
});
