import { describe, it, expect } from 'vitest';
import { parseMap, mark, markSquare, markSphere, percent, claim, visited, GRID, MILESTONES, resetMap } from './explore';
import { mergeResults } from './coop';

describe('exploration map', () => {
  it('marks each cell once and clamps to the grid', () => {
    resetMap(); mark('mars', 3, 4); mark('mars', 3.9, 4.2); mark('mars', -5, 999);
    expect(visited('mars')).toHaveLength(2); expect(visited('mars')).toContainEqual([0, GRID.mars.h - 1]);
  });
  it('square and sphere helpers stay inside the grid', () => {
    resetMap(); markSquare('miller', -130, 130, 130); markSquare('miller', 130, -130, 130); markSphere(1.5, 3.14); markSphere(-1.5, -3.14);
    for (const [x, y] of [...visited('miller'), ...visited('jupiter')]) { expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0); }
    expect(visited('miller')).toHaveLength(2);
  });
  it('pays each milestone once', () => {
    resetMap(); for (let i = 0; i < 60; i++) mark('mars', i % 20, Math.floor(i / 20) + 0);
    expect(percent('mars')).toBe(25); const a = claim('mars'); expect(a.scrap).toBe(MILESTONES[0].scrap); expect(claim('mars').scrap).toBe(0);
  });
  it('survives corrupted saves', () => { expect(parseMap('not json').cells.mars).toEqual([]); expect(parseMap('{"cells":{"mars":["1,2","bad",5]}}').cells.mars).toEqual(['1,2']); });
});
describe('co-op', () => {
  const r = (o: object) => ({ score: 60, science: 10, returned: true, grade: 'B', samples: ['a'], ...o });
  it('merges two runs into one team result', () => {
    const m = mergeResults(r({ score: 80, kills: 2, pois: 2, hull: 50, secs: 100 }), r({ score: 40, returned: false, exploded: true, kills: 1, pois: 1, hull: 0, secs: 120 }));
    expect(m.score).toBe(60); expect(m.grade).toBe('B'); expect(m.returned).toBe(true); expect(m.exploded).toBe(false);
    expect(m.kills).toBe(3); expect(m.pois).toBe(3); expect(m.hull).toBe(0); expect(m.secs).toBe(120); expect(m.samples).toHaveLength(2); expect(m.science).toBe(20);
  });
  it('the team is only destroyed if both are', () => { expect(mergeResults(r({ exploded: true, returned: false }), r({ exploded: true, returned: false })).exploded).toBe(true); });
});
