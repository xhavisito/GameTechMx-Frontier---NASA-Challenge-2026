import { describe, expect, it } from 'vitest';
import { CombatSim, type CombatCfg } from './combat';

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
    expect(a.alive.length).toBeLessThanOrEqual(3); expect(b.capacity).toBe(6);
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
    expect(waves).toBe(1); expect(s.alive.length).toBeGreaterThan(2);
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
});
