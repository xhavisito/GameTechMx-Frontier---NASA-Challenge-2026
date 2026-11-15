import { describe, it, expect } from 'vitest';
import { parseMap, mark, markSquare, markSphere, percent, claim, visited, GRID, MILESTONES, resetMap } from './explore';
import { withCoop } from './coop';
import { basePerks } from './meta';

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
  it('the gunner always has a weapon', () => { expect(withCoop(basePerks(), true).weapon).toBe(1); expect(withCoop(basePerks(), false).weapon).toBe(0); });
});
