import { describe, expect, it } from 'vitest';
import { DAILY_BONUS, destOfDay, emptyDaily, recordDaily, seedOfDay, topScores, yesterday } from './daily';

describe('daily challenge', () => {
  it('the same day gives the same world and seed; consecutive days rotate the world', () => {
    expect(seedOfDay('2026-11-14')).toBe(seedOfDay('2026-11-14')); expect(seedOfDay('2026-11-14')).not.toBe(seedOfDay('2026-11-15'));
    const ds = ['2026-11-14', '2026-11-15', '2026-11-16'].map(destOfDay); expect(new Set(ds).size).toBe(3);
    expect(destOfDay('2026-11-17')).toBe(ds[0]);
  });
  it('yesterday handles month and year borders', () => { expect(yesterday('2026-03-01')).toBe('2026-02-28'); expect(yesterday('2027-01-01')).toBe('2026-12-31'); });
  it('keeps the best score of the day and pays the bonus once per day', () => {
    let r = emptyDaily(); const a = recordDaily(r, '2026-11-14', 60, 'mars', true); r = a.rec;
    expect(a.isBest).toBe(true); expect(a.bonus).toBe(DAILY_BONUS); expect(r.best['2026-11-14']).toBe(60);
    const b = recordDaily(r, '2026-11-14', 50, 'mars', true); expect(b.isBest).toBe(false); expect(b.bonus).toBe(0); expect(b.rec.best['2026-11-14']).toBe(60);
    const c = recordDaily(b.rec, '2026-11-14', 80, 'mars', true); expect(c.isBest).toBe(true); expect(c.bonus).toBe(0);
  });
  it('no bonus for a failed run, streak counts consecutive days and resets after a gap', () => {
    let r = recordDaily(emptyDaily(), '2026-11-12', 10, 'mars', false); expect(r.bonus).toBe(0);
    r = recordDaily(r.rec, '2026-11-13', 40, 'jupiter', true); expect(r.rec.streak).toBe(2);
    r = recordDaily(r.rec, '2026-11-13', 45, 'jupiter', true); expect(r.rec.streak).toBe(2);
    r = recordDaily(r.rec, '2026-11-16', 50, 'mars', true); expect(r.rec.streak).toBe(1);
  });
  it('top scores are sorted and limited', () => {
    let r = emptyDaily(); for (let i = 0; i < 8; i++) r = recordDaily(r, `2026-11-${10 + i}`, i * 10, 'mars', true).rec;
    expect(topScores(r).map(s => s.score)).toEqual([70, 60, 50, 40, 30]);
  });
});
