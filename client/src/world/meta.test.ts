import { describe, expect, it } from 'vitest';
import { UPGRADES, basePerks, buy, costOf, draw, lockReason, newMeta, perksFor, tierOf, upgradeById, withCard, RUN_CARDS, SHIPS } from './meta';

describe('meta progression', () => {
  it('prerequisites are enforced and exist', () => {
    for (const u of UPGRADES) if (u.requires) expect(upgradeById(u.requires.id).ship).toBe(u.ship);
    const m = { ...newMeta(), scrap: 999 };
    expect(lockReason(m, 'r_laser')).toBe('req');
    let n = m; for (const id of ['r_arm', 'r_arm']) n = buy(n, id);
    expect(lockReason(n, 'r_laser')).toBeNull();
  });
  it('buying spends scrap, raises cost and stops at max', () => {
    let m = { ...newMeta(), scrap: 9999 };
    const c0 = costOf(m, 'r_hull'); m = buy(m, 'r_hull');
    expect(m.scrap).toBe(9999 - c0); expect(costOf(m, 'r_hull')).toBeGreaterThan(c0);
    for (let i = 0; i < 10; i++) m = buy(m, 'r_hull');
    expect(m.levels.r_hull).toBe(4); expect(lockReason(m, 'r_hull')).toBe('max');
  });
  it('cannot buy without scrap', () => { const m = { ...newMeta(), scrap: 0 }; expect(buy(m, 'r_hull')).toBe(m); });
  it('weapon is locked until bought, then grows', () => {
    let m = { ...newMeta(), scrap: 9999 };
    expect(perksFor('rover', m).weapon).toBe(0);
    for (const id of ['r_arm', 'r_arm', 'r_laser']) m = buy(m, id);
    expect(perksFor('rover', m).weapon).toBe(1);
    m = buy(m, 'r_laserpow'); expect(perksFor('rover', m).weapon).toBe(2);
  });
  it('maxing a ship reaches tier 3, fresh ship is tier 0', () => {
    let m = { ...newMeta(), scrap: 1e9 };
    for (const s of SHIPS) expect(tierOf(m, s)).toBe(0);
    for (let k = 0; k < 6; k++) for (const u of UPGRADES) m = buy(m, u.id);
    for (const s of SHIPS) expect(tierOf(m, s)).toBe(3);
  });
  it('draft is deterministic, unique and cards apply', () => {
    const a = draw(5), b = draw(5); expect(a.map(x => x.id)).toEqual(b.map(x => x.id)); expect(new Set(a.map(x => x.id)).size).toBe(3);
    const glass = RUN_CARDS.find(c => c.id === 'glass')!; const p = withCard(basePerks(), glass);
    expect(p.speedMul).toBeCloseTo(1.4); expect(p.health).toBe(70);
  });
});
