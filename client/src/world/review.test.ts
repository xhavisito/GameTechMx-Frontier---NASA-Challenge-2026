import { describe, expect, it } from 'vitest';
import { GAPS, answer, cardOfDay, dueIds, makeQuestion, markSciDay, pickIds } from './review';
import { LEARN, WRONG } from './learn';
import { SOURCES } from './sources';

describe('spaced review', () => {
  it('a right answer pushes the card further out, a wrong one brings it back tomorrow', () => {
    let r = answer({}, 'mars-ice', true, 100); expect(r['mars-ice']).toMatchObject({ box: 1, due: 100 + GAPS[1]! });
    r = answer(r, 'mars-ice', true, 102); expect(r['mars-ice']!.box).toBe(2);
    r = answer(r, 'mars-ice', false, 106); expect(r['mars-ice']).toMatchObject({ box: 0, due: 107, wrong: 1 });
    expect(dueIds(r, 106)).toEqual([]); expect(dueIds(r, 107)).toEqual(['mars-ice']);
  });
  it('the box never goes past the last one', () => { let r = {}; for (let i = 0; i < 12; i++) r = answer(r, 'miller', true, i); expect((r as Record<string, { box: number }>)['miller']!.box).toBe(GAPS.length - 1); });
  it('every card has two wrong answers, and each question has 4 options with exactly one right, in varying order', () => {
    for (const s of SOURCES) { expect(WRONG[s.id], s.id).toHaveLength(2); const q = makeQuestion(s.id); expect(q.options).toHaveLength(4); expect(q.options.filter(o => o.ok)).toHaveLength(1); expect(new Set(q.options.map(o => o.text.es)).size).toBe(4); }
    const firsts = new Set<boolean>(); for (let i = 0; i < 40; i++) firsts.add(makeQuestion('jup-grs').options[0]!.ok); expect(firsts.size).toBe(2);
  });
  it('asks due cards first, then new discovered ones, never repeats inside one set', () => {
    const r = answer(answer({}, 'rover', false, 10), 'mars-dust', false, 10);
    const ids = pickIds(r, 11, ['miller', 'jup-grs'], 5, [], () => 0.3); expect(ids.slice(0, 2).sort()).toEqual(['mars-dust', 'rover']); expect(new Set(ids).size).toBe(5);
    expect(ids.slice(2).every(id => !['rover', 'mars-dust'].includes(id))).toBe(true);
    expect(pickIds({}, 1, [], 4, ['mars-ice'], () => 0.5)[0]).toBe('mars-ice');
  });
  it('the card of the day is stable within a day and rotates through all of them', () => {
    expect(cardOfDay('2026-11-15')).toBe(cardOfDay('2026-11-15')); expect(LEARN[cardOfDay('2026-11-15')]).toBeTruthy();
    const seen = new Set<string>(); for (let d = 1; d <= 22; d++) seen.add(cardOfDay(`2026-12-${String(d).padStart(2, '0')}`)); expect(seen.size).toBe(22);
  });
  it('the science streak counts consecutive days and does not double count', () => {
    let s = markSciDay({ last: '', streak: 0 }, '2026-11-14', '2026-11-13'); s = markSciDay(s, '2026-11-15', '2026-11-14'); expect(s.streak).toBe(2); expect(markSciDay(s, '2026-11-15', '2026-11-14')).toEqual(s);
    expect(markSciDay(s, '2026-11-18', '2026-11-17').streak).toBe(1);
  });
});
