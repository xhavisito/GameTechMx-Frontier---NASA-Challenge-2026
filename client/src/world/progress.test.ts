import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, DISCOVERY, apply, discoveries, emptyProgress, type Ev } from './progress';
import { SOURCES } from './sources';

const run = (evs: Ev[]) => evs.reduce((p, e) => apply(p, e).p, emptyProgress());
describe('progress', () => {
  it('every discoverable card exists in Science and sources, and every card has a way to be discovered', () => {
    const ids = new Set(SOURCES.map(s => s.id));
    for (const k of Object.keys(DISCOVERY)) expect(ids.has(k), k).toBe(true);
    for (const id of ids) expect(DISCOVERY[id], `${id} cannot be discovered`).toBeTruthy();
  });
  it('launching unlocks the rocket cards and the instruments you carried, once', () => {
    const r = apply(emptyProgress(), { t: 'launch', dest: 'mars', tools: ['camera'], shield: 1 });
    expect(r.newFound).toEqual(expect.arrayContaining(['rocket-equation', 'tool-camera'])); expect(r.newFound).not.toContain('tool-radar'); expect(r.newAch).toContain('launch');
    expect(apply(r.p, { t: 'launch', dest: 'mars', tools: ['camera'], shield: 1 }).newFound).toEqual([]);
  });
  it('mission results unlock the world cards and the samples you really collected', () => {
    expect(discoveries({ t: 'mission', dest: 'mars', returned: true, grade: 'B', samples: ['ice', 'basalt'], kills: 0, scrap: 10 })).toEqual(expect.arrayContaining(['mars-ice', 'mars-igneous', 'rover']));
    expect(discoveries({ t: 'mission', dest: 'jupiter', returned: true, grade: 'B', samples: [], kills: 0, scrap: 10 })).toContain('jup-grs');
    expect(discoveries({ t: 'trip', ids: ['storm', 'zzz'] })).toEqual(['trip-solar-storm']);
  });
  it('achievements unlock from stats', () => {
    expect(run([{ t: 'goal' }]).ach).toEqual(['goal']);
    const p = run([{ t: 'mission', dest: 'mars', returned: true, grade: 'S', samples: [], kills: 0, scrap: 1 }, { t: 'mission', dest: 'jupiter', returned: true, grade: 'B', samples: [], kills: 0, scrap: 1 }, { t: 'mission', dest: 'miller', returned: true, grade: 'B', samples: [], kills: 0, scrap: 1 }]);
    expect(p.ach).toEqual(expect.arrayContaining(['mission', 'worlds', 'sgrade']));
    expect(run([{ t: 'kill', kind: 'boss' }, { t: 'kill', kind: 'brute' }]).ach).toEqual(expect.arrayContaining(['boss', 'brute']));
    expect(run([{ t: 'cones', secs: 55 }]).ach).not.toContain('cones'); expect(run([{ t: 'cones', secs: 55 }, { t: 'cones', secs: 38 }]).ach).toContain('cones');
  });
  it('failed missions do not count as visiting a world, and there are no duplicate ids', () => {
    expect(run([{ t: 'mission', dest: 'mars', returned: false, grade: 'D', samples: [], kills: 0, scrap: 0 }]).s.worlds).toEqual([]);
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
