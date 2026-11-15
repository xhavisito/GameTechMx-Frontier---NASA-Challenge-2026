import { describe, expect, it } from 'vitest';
import { CombatSim, setCombatListener, type CombatCfg, type CombatEvent } from './combat';

const cfg = (o: Partial<CombatCfg> = {}): CombatCfg => ({ kind: 'crawler', max: 4, spawnEvery: 5, waveEvery: 0, hp: 3, speed: 4, damage: 10, aggro: 60, thiefChance: 0, place: (p, a, b) => ({ x: p.x + 20 + a * 10, y: 0, z: p.z + b * 10 }), constrain: () => {}, slow: 1, more: 1, seed: 1, ...o });
const P = { x: 0, y: 0, z: 0 };
describe('combat sim', () => {
  it('spawns, chases and hurts the player', () => {
    const s = new CombatSim(cfg()); let hits = 0;
    for (let i = 0; i < 1500; i++) for (const e of s.update(0.05, P, 0)) if (e.type === 'hit') hits++;
    expect(s.alive.length).toBeGreaterThan(0); expect(hits).toBeGreaterThan(0);
  });
  it('never exceeds capacity and honours the "more enemies" multiplier', () => {
    const a = new CombatSim(cfg({ max: 3 })), b = new CombatSim(cfg({ max: 3, more: 2 }));
    for (let i = 0; i < 6000; i++) { a.update(0.05, { x: 500, y: 0, z: 500 }, 0); b.update(0.05, { x: 500, y: 0, z: 500 }, 0); }
    expect(a.alive.length).toBeLessThanOrEqual(3); expect(b.capacity).toBe(4);   // never more than 4 at once, whatever the multiplier
  });
  it('bullets kill enemies and count kills', () => {
    const s = new CombatSim(cfg({ hp: 2, spawnEvery: 1 })); for (let i = 0; i < 400; i++) s.update(0.05, P, 0);
    let target = s.alive[0]; expect(target).toBeTruthy();
    for (let i = 0; i < 200 && s.alive.length; i++) { const d = s.aim(P, null); if (d) s.shoot(P, d, 5); s.update(0.05, { x: 0, y: 0, z: 0 }, 0); }
    expect(s.kills).toBeGreaterThan(0);
  });
  it('waves add enemies at the configured time', () => {
    const s = new CombatSim(cfg({ waveEvery: 20, spawnEvery: 1e6, max: 6 })); let waves = 0;
    for (let i = 0; i < 20 * 21; i++) for (const e of s.update(0.05, { x: 300, y: 0, z: 0 }, 0)) if (e.type === 'wave') waves++;
    expect(waves).toBe(1); expect(s.alive.length).toBeGreaterThan(1); expect(s.alive.length).toBeLessThanOrEqual(4);
  });
  it('a thief steals once, runs, and can be caught by hand', () => {
    const s = new CombatSim(cfg({ thiefChance: 1, spawnEvery: 1e6, place: p => ({ x: p.x + 8, y: 0, z: p.z }) }));
    let steals = 0, appeared = false;
    for (let i = 0; i < 4000 && steals === 0; i++) for (const e of s.update(0.05, P, 0)) { if (e.type === 'thief') appeared = true; if (e.type === 'steal') steals++; }
    expect(appeared).toBe(true); expect(steals).toBe(1);
    const t = s.enemies.find(e => e.kind === 'thief')!; t.x = 1; t.z = 0; t.y = 0;
    expect(s.grab(P)).toBe(t); expect(t.alive).toBe(false);
  });
  it('enemies get tougher as time passes', () => {
    const s = new CombatSim(cfg({ spawnEvery: 1 })); s.time = 600; (s as unknown as { next: number }).next = 0; s.update(0.05, P, 0);
    expect(s.alive[0]!.maxHp).toBeGreaterThan(3);
  });
});

import { PoiSim, makePois } from './pois';
import { contractsFor, defaultContract } from './contracts';
describe('pois and contracts', () => {
  const o = { holdTime: 2, range: 5, homeRange: 6, canPhoto: true };
  it('beacons need you to stay and hold', () => {
    const s = new PoiSim(makePois('beacon', 1, () => ({ x: 10, y: 0, z: 0 })), { x: 0, y: 0, z: 0 }, o);
    for (let i = 0; i < 30; i++) s.update(0.05, { x: 10, y: 0, z: 0 }, true, false);
    expect(s.complete).toBe(false);
    for (let i = 0; i < 30; i++) s.update(0.05, { x: 10, y: 0, z: 0 }, true, false);
    expect(s.complete).toBe(true);
  });
  it('crate: pick up, carry and deliver; a thief can drop it', () => {
    const s = new PoiSim(makePois('crate', 1, () => ({ x: 30, y: 0, z: 0 })), { x: 0, y: 0, z: 0 }, o);
    s.update(0.05, { x: 30, y: 0, z: 0 }, false, true); expect(s.carrying).not.toBeNull();
    s.drop({ x: 25, y: 0, z: 0 }); expect(s.carrying).toBeNull();
    s.update(0.05, { x: 25, y: 0, z: 0 }, false, true); expect(s.carrying).not.toBeNull();
    s.update(0.05, { x: 1, y: 0, z: 0 }, false, true); expect(s.complete).toBe(true);
  });
  it('photos need a camera', () => {
    const s = new PoiSim(makePois('photo', 1, () => ({ x: 4, y: 0, z: 0 })), { x: 0, y: 0, z: 0 }, { ...o, canPhoto: false });
    const ev = s.update(0.05, { x: 0, y: 0, z: 0 }, false, true); expect(ev[0]!.type).toBe('nophoto'); expect(s.complete).toBe(false);
  });
  it('higher levels offer more contracts, easy always has the classic one', () => {
    expect(contractsFor('mars', 'easy')[0]).toBe(defaultContract('mars'));
    expect(contractsFor('mars', 'expert').length).toBeGreaterThan(contractsFor('mars', 'easy').length);
  });
  it('contact is fair: a wind-up before the bite, then it backs off and the player gets a grace period', () => {
    const s = new CombatSim(cfg({ max: 3, spawnEvery: 0.5, place: p => ({ x: p.x + 1.8, y: 0, z: p.z }) }));
    const times: number[] = []; let t = 0, firstHitAfter = -1;
    for (let i = 0; i < 1200; i++) { t += 0.05; for (const e of s.update(0.05, P, 0)) if (e.type === 'hit') { if (firstHitAfter < 0) firstHitAfter = t; times.push(t); } }
    expect(times.length).toBeGreaterThan(2);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(0.85); // never two bites back to back
  });
  it('an enemy retreats right after biting', () => {
    const s = new CombatSim(cfg({ spawnEvery: 1e6, max: 1 }));
    const e = (s as unknown as { spawn: (p: typeof P) => { x: number; z: number; recoil: number } }).spawn(P); e.x = 1.8; e.z = 0;
    let bit = false, d0 = 0;
    for (let i = 0; i < 100 && !bit; i++) for (const ev of s.update(0.05, P, 0)) if (ev.type === 'hit') { bit = true; d0 = Math.hypot(e.x, e.z); }
    expect(bit).toBe(true); for (let i = 0; i < 10; i++) s.update(0.05, P, 0);
    expect(Math.hypot(e.x, e.z)).toBeGreaterThan(d0);
  });
  it('variants only appear when unlocked, and each has its own stats', () => {
    const none = new CombatSim(cfg({ spawnEvery: 1, max: 4 })); for (let i = 0; i < 4000; i++) none.update(0.05, { x: 500, y: 0, z: 500 }, 0);
    expect(new Set(none.enemies.map(e => e.kind))).toEqual(new Set(['crawler']));
    const some = new CombatSim(cfg({ spawnEvery: 1, max: 4, variants: ['swarmer', 'dasher', 'brute'], hp: 10 })); const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) { some.update(0.05, { x: 500, y: 0, z: 500 }, 0); some.enemies.forEach(e => seen.add(e.kind)); some.enemies.forEach(e => { e.alive = false; e.flash = 0; }); }
    expect(seen.has('crawler') && seen.has('swarmer') && seen.has('dasher') && seen.has('brute')).toBe(true);
  });
  it('a brute is tougher and slower than a swarmer', () => {
    const s = new CombatSim(cfg({ spawnEvery: 1, max: 4, variants: ['swarmer', 'brute'], hp: 10 })); const kinds: Record<string, { hp: number; sp: number }> = {};
    for (let i = 0; i < 20000 && Object.keys(kinds).length < 2; i++) { s.update(0.05, { x: 500, y: 0, z: 500 }, 0); for (const e of s.enemies) if (e.kind !== 'crawler' && e.age < 0.2) kinds[e.kind] = { hp: e.maxHp, sp: e.speed }; s.enemies.forEach(e => { e.alive = false; e.flash = 0; }); }
    expect(kinds.brute!.hp).toBeGreaterThan(kinds.swarmer!.hp * 3); expect(kinds.swarmer!.sp).toBeGreaterThan(kinds.brute!.sp * 1.8);
  });
  it('a dasher lunges: it covers more ground in a burst than a steady walker', () => {
    const mk = (kind: 'dasher' | 'crawler') => { const s = new CombatSim(cfg({ spawnEvery: 1e6, max: 4, speed: 3, aggro: 200, kind, place: p => ({ x: p.x + 60, y: 0, z: p.z }) })); s.update(0.05, { x: 0, y: 0, z: 0 }, 0); return s; };
    const d = mk('dasher'); (d as unknown as { spawn: (p: unknown, k: string) => void }).spawn({ x: 0, y: 0, z: 0 }, 'dasher');
    const e = d.enemies.find(x => x.kind === 'dasher')!; e.dashIn = 0; let best = 0, px = e.x;
    for (let i = 0; i < 80; i++) { d.update(0.05, { x: 0, y: 0, z: 0 }, 0); best = Math.max(best, px - e.x); px = e.x; }
    expect(best / 0.05).toBeGreaterThan(3 * 2);
    void mk;
  });
  it('a boss mission brings exactly one boss after a while, and it counts as several kills', () => {
    const seen: CombatEvent[] = []; setCombatListener(e => seen.push(e));
    const s = new CombatSim(cfg({ boss: true, spawnEvery: 1e6, hp: 2, max: 4, aggro: 500, place: p => ({ x: p.x + 6, y: 0, z: p.z }) })); let bosses = 0;
    for (let i = 0; i < 20 * 80; i++) for (const e of s.update(0.05, P, 0)) if (e.type === 'boss') bosses++;
    expect(bosses).toBe(1); const b = s.enemies.find(e => e.kind === 'boss')!; expect(b.maxHp).toBeGreaterThan(2 * 8);
    b.x = 2; b.z = 0; b.y = 0; for (let i = 0; i < 60 && b.alive; i++) { s.shoot(P, { x: 1, y: 0, z: 0 }, 50); s.update(0.05, { x: 0, y: 0, z: 0 }, 0); }
    expect(b.alive).toBe(false); expect(s.kills).toBeGreaterThanOrEqual(5); expect(seen.some(e => e.type === 'kill' && e.enemy.kind === 'boss')).toBe(true);
    setCombatListener(null);
  });
  it('no boss when it is not a boss mission', () => {
    const s = new CombatSim(cfg({ spawnEvery: 1e6 })); for (let i = 0; i < 20 * 60; i++) s.update(0.05, { x: 500, y: 0, z: 0 }, 0);
    expect(s.enemies.some(e => e.kind === 'boss')).toBe(false);
  });
});
