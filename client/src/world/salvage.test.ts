import { describe, it, expect } from 'vitest';
import { priceFor, hasStakes, afterLoss, afterPaying, parseSalvage, levelsOwned, upgradeValue } from './salvage';
import { newMeta } from './meta';
import { emptyRun } from './runstate';
import { EMERGENCY_FUND } from './design';

const rich = () => ({ ...newMeta(), scrap: 400, levels: { r_battery: 2, r_wheels: 1 } });
describe('death and salvage', () => {
  it('the first missions have nothing at stake', () => { expect(hasStakes(newMeta())).toBe(false); expect(hasStakes(rich())).toBe(true); });
  it('the price is more than half your scrap plus a fee per upgrade, and scales with the level', () => {
    const m = rich(); expect(priceFor(m, 'medium')).toBe(Math.round(0.55 * 400 + 6 * 3)); expect(priceFor(m, 'easy')!).toBeLessThan(priceFor(m, 'expert')!);
  });
  it('when poor it takes all you have, and below 25 there is no rescue', () => {
    expect(priceFor({ ...newMeta(), scrap: 60, levels: { r_battery: 3 } }, 'expert')).toBe(60); expect(priceFor({ ...newMeta(), scrap: 20, levels: { r_battery: 1 } }, 'medium')).toBeNull();
  });
  it('losing wipes scrap and upgrades but keeps your stats; paying gives it back minus the price', () => {
    const m = { ...rich(), runs: 9, best: 77, kills: 12 }, lost = afterLoss(m);
    expect(lost.scrap).toBe(EMERGENCY_FUND); expect(levelsOwned(lost)).toBe(0); expect(lost.runs).toBe(9); expect(lost.best).toBe(77);
    const sv = { meta: m, run: emptyRun(), price: 230, scrap: 400, levels: 3, at: 0 }, back = afterPaying(sv);
    expect(back.scrap).toBe(170); expect(back.levels).toEqual(m.levels);
  });
  it('upgrades have a value and bad saves are ignored', () => { expect(upgradeValue(rich())).toBeGreaterThan(0); expect(parseSalvage('nope')).toBeNull(); expect(parseSalvage('{"meta":{}}')).toBeNull(); });
});
