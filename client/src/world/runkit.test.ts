import { describe, expect, it } from 'vitest';
import { contractResult, scrapReward } from './runkit';
import { modsFor } from './levels';
import { basePerks } from './meta';
import { defaultContract, CONTRACTS } from './contracts';

describe('run rewards', () => {
  it('harder levels, riskier contracts and luck pay more; exploding pays half', () => {
    const r = { score: 70, kills: 3, pois: 2, returned: true, exploded: false }, p = basePerks();
    const easy = scrapReward(r, modsFor('easy'), p, defaultContract('mars')), expert = scrapReward(r, modsFor('expert'), p, defaultContract('mars'));
    expect(expert).toBeGreaterThan(easy);
    expect(scrapReward(r, modsFor('easy'), p, CONTRACTS.find(c => c.id === 'm_rescue')!)).toBeGreaterThan(easy);
    expect(scrapReward({ ...r, exploded: true }, modsFor('easy'), p, defaultContract('mars'))).toBeLessThan(easy);
    expect(scrapReward(r, modsFor('easy'), { ...p, luck: 1.5 }, defaultContract('mars'))).toBeGreaterThan(easy);
  });
  it('contract score needs completion for the big points', () => {
    expect(contractResult(3, 3, 100, 60, 0, false, 0).score).toBeGreaterThan(contractResult(2, 3, 100, 60, 0, false, 0).score);
    expect(contractResult(3, 3, 100, 60, 0, false, 0).returned).toBe(true);
  });
});

describe('"why this grade" breakdown', () => {
  it('the listed points add up to the final score (rounding aside)', () => {
    const r = contractResult(2, 3, 80, 200, 4, false, 1);
    const sum = r.why!.reduce((a, p) => a + p.pts, 0);
    expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(1);
    expect(r.why!.some(p => p.pts < 0)).toBe(true); // the unrecovered theft is listed as a penalty
  });
});
