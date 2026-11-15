import { describe, it, expect } from 'vitest';
import { CHAPTERS, nextChapter, chapterJob } from './chapters';
import { MATES, applyMate, applyMateMods, safeMate, isOpen } from './crew';
import { basePerks } from './meta';
import { BEATS } from './story';
import { ACHIEVEMENTS, emptyProgress } from './progress';
import { jobDone } from './board';

describe('story chapters', () => {
  it('are ordered, each has a story beat and unlocks a real mate', () => {
    CHAPTERS.forEach((c, i) => { expect(c.n).toBe(i + 1); expect(BEATS.some(b => b.id === c.id)).toBe(true); if (c.unlocks) expect(MATES.some(m => m.id === c.unlocks)).toBe(true); });
  });
  it('next chapter follows what is done', () => {
    expect(nextChapter([])!.n).toBe(1); expect(nextChapter(['ch1', 'ch2'])!.n).toBe(3); expect(nextChapter(CHAPTERS.map(c => c.id))).toBeNull();
  });
  it('chapter jobs can be completed', () => {
    const j = chapterJob(CHAPTERS[0]); expect(jobDone(j, { returned: true, score: 50, pois: 3 }, 3)).toBe(true); expect(jobDone(j, { returned: false, exploded: true, pois: 3 }, 3)).toBe(false);
  });
  it('saga achievement needs chapter 6', () => {
    const a = ACHIEVEMENTS.find(x => x.id === 'saga')!, s = emptyProgress().s; expect(a.ok(s)).toBe(false); expect(a.ok({ ...s, chapters: 6 })).toBe(true);
  });
});
describe('crew mates', () => {
  const ctx = { missions: 0, story: [] as string[], ach: [] as string[] };
  it('free mates open at once, others need progress', () => {
    expect(isOpen(MATES[0], ctx)).toBe(true); expect(isOpen(MATES.find(m => m.id === 'nube')!, ctx)).toBe(false); expect(isOpen(MATES.find(m => m.id === 'nube')!, { ...ctx, story: ['ch2'] })).toBe(true);
  });
  it('a locked saved mate falls back to Ada', () => { expect(safeMate('brisa', ctx)).toBe('ada'); expect(safeMate('tuerca', ctx)).toBe('tuerca'); });
  it('perks add up and hazards shrink', () => {
    const p = applyMate(basePerks(), 'tuerca'); expect(p.health).toBe(basePerks().health + 20);
    expect(applyMate(basePerks(), null)).toEqual(basePerks());
    const m = { hazardDmg: 20 } as never; expect(applyMateMods(m, 'brisa').hazardDmg).toBe(17);
  });
});
describe('chapter events', () => {
  it('apply() records the chapter and its beat', async () => {
    const { apply, emptyProgress: ep } = await import('./progress');
    const r = apply(ep(), { t: 'chapter', n: 1 }); expect(r.p.s.chapters).toBe(1); expect(r.newBeats).toContain('ch1');
  });
});
