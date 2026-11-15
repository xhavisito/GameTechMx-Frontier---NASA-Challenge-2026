import { describe, expect, it } from 'vitest';
import { DEFAULT_A11Y, parse, CAPTIONS } from './a11y';
import { DEFAULT_CHOICE, ITEMS, colorsOf, isUnlocked, sanitize } from './cosmetics';
import { ACHIEVEMENTS } from './progress';

describe('accessibility settings', () => {
  it('reads saved values safely and falls back on junk', () => {
    expect(parse(null)).toEqual(DEFAULT_A11Y); expect(parse('{{{')).toEqual(DEFAULT_A11Y);
    expect(parse('{"text":2,"contrast":true,"noTimer":true,"captions":true,"calm":true}')).toEqual({ text: 2, contrast: true, noTimer: true, captions: true, calm: true });
    expect(parse('{"text":9}').text).toBe(0);
  });
  it('captions exist in both languages', () => { for (const c of Object.values(CAPTIONS)) { expect(c!.es.length).toBeGreaterThan(3); expect(c!.en.length).toBeGreaterThan(3); } });
});
describe('cosmetics', () => {
  it('every unlock points at a real achievement and every slot has a free default', () => {
    const ids = ACHIEVEMENTS.map(a => a.id); for (const it of ITEMS) if (it.ach) expect(ids, it.id).toContain(it.ach);
    for (const s of ['paint', 'trail', 'flag'] as const) expect(ITEMS.some(i => i.slot === s && !i.ach), s).toBe(true);
    expect(new Set(ITEMS.map(i => i.id)).size).toBe(ITEMS.length);
  });
  it('a locked or unknown look never gets through', () => {
    expect(sanitize({ paint: 'paint-gold' }, []).paint).toBe(DEFAULT_CHOICE.paint);
    expect(sanitize({ paint: 'paint-gold' }, ['sgrade']).paint).toBe('paint-gold');
    expect(sanitize({ paint: 'trail-pink' as string }, ['cones']).paint).toBe(DEFAULT_CHOICE.paint);
    expect(sanitize({ flag: 'nope' }, []).flag).toBe('flag-none');
    expect(isUnlocked(ITEMS.find(i => i.id === 'flag-red')!, ['launch'])).toBe(true);
  });
  it('colours resolve for the default choice', () => { const c = colorsOf(DEFAULT_CHOICE); expect(c.paint).toHaveLength(2); expect(c.flag).toBeNull(); });
});
