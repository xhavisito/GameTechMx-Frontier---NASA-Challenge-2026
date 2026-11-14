import { describe, expect, it } from 'vitest';
import { applyEffects, defaultDesign, eventsFor, normalize, passed, runTests, someDesignPasses, stats, type Dest } from './design';
import { modsFor, LEVELS } from './levels';

const DESTS: Dest[] = ['mars', 'jupiter', 'miller'];
describe('design model', () => {
  it('has a different number of tests per level', () => {
    const n = LEVELS.map(l => runTests(defaultDesign('mars'), l).length);
    expect(n).toEqual([0, 1, 4, 7]);
  });
  it('every destination can be completed on every level', () => {
    for (const l of LEVELS) for (const d of DESTS) expect(someDesignPasses(d, l), `${l}/${d}`).toBe(true);
  });
  it('expert is not solved by the default pick', () => {
    expect(DESTS.some(d => !passed(runTests(defaultDesign(d), 'expert')))).toBe(true);
  });
  it('a heavier payload lowers delta-v', () => {
    const a = stats(defaultDesign('mars')), b = stats({ ...defaultDesign('mars'), tools: ['camera', 'spectrometer', 'radar'] });
    expect(b.dv).toBeLessThan(a.dv);
  });
  it('solar power collapses at Jupiter', () => {
    const j = stats({ ...defaultDesign('jupiter'), batteryKWh: 0 }).supplyW, m = stats({ ...defaultDesign('mars'), batteryKWh: 0 }).supplyW;
    expect(j).toBeLessThan(m / 5);
  });
  it('easy normalises the design so nothing can go wrong', () => {
    expect(passed(runTests({ ...defaultDesign('jupiter'), rocket: 'light', solarM2: 1 }, 'easy'))).toBe(true);
    expect(normalize({ ...defaultDesign('mars'), rocket: 'light' }, 'easy').rocket).toBe('standard');
  });
  it('travel events scale and change the mission start', () => {
    expect(eventsFor('easy', 1).length).toBe(0); expect(eventsFor('hard', 1).length).toBe(1); expect(eventsFor('expert', 1).length).toBe(2);
    const r = applyEffects(modsFor('hard'), [{ health: -22 }, { time: -30 }]);
    expect(r.health).toBe(78); expect(r.mods.timeLimit).toBe(390);
  });
});
describe('levels get harder', () => {
  it('monotonic difficulty knobs', () => {
    const m = LEVELS.map(modsFor);
    for (let i = 1; i < m.length; i++) { expect(m[i]!.required).toBeGreaterThanOrEqual(m[i - 1]!.required); expect(m[i]!.hazardDmg).toBeGreaterThan(m[i - 1]!.hazardDmg); expect(m[i]!.hullDepth).toBeLessThan(m[i - 1]!.hullDepth); expect(m[i]!.drainMul).toBeGreaterThan(m[i - 1]!.drainMul); }
  });
});
