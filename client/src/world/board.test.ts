import { describe, expect, it } from 'vitest';
import { JOBS, applyJobs, jobDone, offersFor, settle, jobById } from './board';
import { RUN_MODS, applyRunMods, applyRunPerks, emptyRun, grant, tick, modById, tierFor } from './runstate';
import { TRIP_EVENTS, pickTrip, resolveOption, eventCount, optionNote } from './tripevents';
import { basePerks } from './meta';
import { modsFor } from './levels';
import { LEVELS } from './levels';
import type { Dest } from './design';

const seq = (xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]!; };
const rr = { returned: true, exploded: false, kills: 0, pois: 3, hull: 100, secs: 100, score: 80, lost: 0 };
describe('trip events', () => {
  it('every option refers to real effects, and every planet has enough events to avoid repeats', () => {
    for (const e of TRIP_EVENTS) { expect(e.options.length).toBeGreaterThanOrEqual(2); for (const o of e.options) for (const out of [o.out, o.gamble?.win, o.gamble?.lose]) if (out?.mod) expect(modById(out.mod), `${e.id}:${out.mod}`).toBeTruthy(); }
    for (const d of ['mars', 'jupiter', 'miller'] as Dest[]) expect(TRIP_EVENTS.filter(e => !e.dests || e.dests.includes(d)).length).toBeGreaterThanOrEqual(20);
  });
  it('picks the right number, no duplicates, avoids recently seen ones and shuffles options', () => {
    for (const l of LEVELS) { const t = pickTrip(l, 'mars'); expect(t.length).toBeLessThanOrEqual(4); expect(new Set(t.map(e => e.id)).size).toBe(t.length); }
    const seen = TRIP_EVENTS.slice(0, 20).map(e => e.id), t = pickTrip('expert', 'mars', Math.random, seen);
    expect(t.every(e => !seen.includes(e.id))).toBe(true);
    const orders = new Set<string>(); for (let i = 0; i < 40; i++) { const e0 = pickTrip('hard', 'mars', Math.random)[0]; if (e0) orders.add(e0.options.map(o => o.es).join('|')); }
    expect(orders.size).toBeGreaterThan(1);
    const ids = new Set<string>(); for (let i = 0; i < 40; i++) pickTrip('expert', 'miller').forEach(e => ids.add(e.id)); expect(ids.size).toBeGreaterThan(8);
  });
  it('planet-specific events only show up on their planet; timed events wait for harder levels', () => {
    for (let i = 0; i < 30; i++) { for (const e of pickTrip('expert', 'jupiter')) expect(!e.dests || e.dests.includes('jupiter')).toBe(true); for (const e of pickTrip('easy', 'mars')) expect(e.min ?? 'easy').toBe('easy'); }
  });
  it('a gamble rolls once and the card tells the odds', () => {
    const g = TRIP_EVENTS.flatMap(e => e.options).find(o => o.gamble)!;
    expect(resolveOption(g, seq([0.01])).won).toBe(true); expect(resolveOption(g, seq([0.99])).won).toBe(false); expect(optionNote(g, true)).toContain('%');
  });
});
describe('run effects', () => {
  it('boons and banes change the ship and the mission, then expire after their missions', () => {
    let s = grant(emptyRun(), 'tailwind'), p = applyRunPerks(basePerks(), s);
    expect(p.speedMul).toBeCloseTo(1.15); s = grant(s, 'storm_belt'); expect(applyRunMods(modsFor('medium'), s).hazardDmg).toBeGreaterThan(modsFor('medium').hazardDmg);
    s = grant(s, 'debt'); expect(applyRunMods(modsFor('medium'), s).scrapMul).toBeLessThan(modsFor('medium').scrapMul);
    for (let i = 0; i < 2; i++) s = tick(s); expect(s.mods.length).toBe(1); expect(s.mods[0]!.id).toBe('tailwind'); s = tick(s); expect(s.mods.length).toBe(0);
    expect(applyRunPerks(basePerks(), s).speedMul).toBe(1);
  });
  it('refreshing an effect never shortens it, and every def is valid', () => {
    let s = grant(emptyRun(), 'spare_parts', 3); s = tick(s); s = grant(s, 'spare_parts', 1); expect(s.mods[0]!.left).toBe(2);
    for (const m of RUN_MODS) expect(m.fx || m.hazard || m.scrap || m.drain, m.id).toBeTruthy();
  });
});
describe('mission board', () => {
  it('reputation opens tiers; offers are distinct, fit the planet and rotate', () => {
    expect(tierFor(0)).toBe(1); expect(tierFor(2)).toBe(2); expect(tierFor(4)).toBe(3);
    for (const w of ['mars', 'jupiter', 'miller'] as Dest[]) { for (let i = 0; i < 20; i++) { const o = offersFor(w, 0); expect(o.length).toBe(4); expect(new Set(o.map(j => j.id)).size).toBe(4); expect(o.every(j => j.tier === 1 && (j.world === w || j.world === 'any'))).toBe(true); } expect(offersFor(w, 4).some(j => j.tier === 3)).toBe(true); }
    const all = new Set<string>(); for (let i = 0; i < 60; i++) offersFor('mars', 3).forEach(j => all.add(j.id)); expect(all.size).toBeGreaterThan(6);
    for (const j of JOBS) { if (j.win) expect(modById(j.win), j.id).toBeTruthy(); if (j.lose) expect(modById(j.lose), j.id).toBeTruthy(); }
  });
  it('accepted jobs really change the mission while you carry them', () => {
    const m = modsFor('medium'), p = basePerks(), a = applyJobs(m, p, [jobById('flawless')!, jobById('slayer')!]);
    expect(a.mods.hazardDmg).toBeGreaterThan(m.hazardDmg); expect(a.perks.enemyMore).toBeGreaterThan(p.enemyMore);
    expect(applyJobs(m, p, [jobById('j_hot')!]).perks.radiation).toBeGreaterThan(p.radiation); expect(applyJobs(m, p, [jobById('sprint')!]).mods.drainMul).toBeGreaterThan(m.drainMul);
  });
  it('objectives are judged from the result', () => {
    expect(jobDone(jobById('hunt')!, { ...rr, kills: 3 }, 3)).toBe(true); expect(jobDone(jobById('hunt')!, { ...rr, kills: 2 }, 3)).toBe(false);
    expect(jobDone(jobById('hunt')!, { ...rr, kills: 5, exploded: true }, 3)).toBe(false);
    expect(jobDone(jobById('extra')!, { ...rr, pois: 4 }, 3)).toBe(true); expect(jobDone(jobById('extra')!, { ...rr, pois: 3 }, 3)).toBe(false);
    expect(jobDone(jobById('peace')!, { ...rr, kills: 1 }, 3)).toBe(false); expect(jobDone(jobById('peace')!, rr, 3)).toBe(true);
    expect(jobDone(jobById('sprint')!, { ...rr, secs: 200 }, 3)).toBe(false); expect(jobDone(jobById('flawless')!, { ...rr, hull: 91 }, 3)).toBe(true);
    expect(jobDone(jobById('iron')!, { ...rr, kills: 4, hull: 79 }, 3)).toBe(false); expect(jobDone(jobById('iron')!, { ...rr, kills: 4, hull: 85 }, 3)).toBe(true);
  });
  it('success pays, raises reputation and grants a boon that lasts; failure grants the penalty', () => {
    const s0 = emptyRun(), a = settle(s0, 'mars', [jobById('quick')!, jobById('hunt')!], { ...rr, secs: 100, kills: 0 }, 3);
    expect(a.rows[0]!.ok).toBe(true); expect(a.rows[1]!.ok).toBe(false); expect(a.scrap).toBe(22); expect(a.state.rep.mars).toBe(1);
    expect(a.state.mods.some(m => m.id === 'tailwind')).toBe(true);
    const b = settle(s0, 'mars', [jobById('quick')!], { ...rr, secs: 900 }, 3); expect(b.state.mods.some(m => m.id === 'rattle')).toBe(true); expect(b.scrap).toBe(0);
    const c = settle({ ...s0, rep: { ...s0.rep, mars: 5 } }, 'mars', [jobById('quick')!], rr, 3); expect(c.scrap).toBeGreaterThan(22);
  });
});
describe('event count', () => {
  it('varies, can be zero but rarely, and is deterministic with the dice', () => {
    const seen = new Set<number>(); let zero = 0; const N = 4000;
    for (let i = 0; i < N; i++) { const n = eventCount('medium'); seen.add(n); if (n === 0) zero++; }
    expect(seen.size).toBeGreaterThanOrEqual(3); expect(zero / N).toBeLessThan(0.08); expect(zero).toBeGreaterThan(0);
    expect(eventCount('easy', () => 0)).toBe(0); expect(eventCount('expert', () => 0.999)).toBe(4);
  });
});
