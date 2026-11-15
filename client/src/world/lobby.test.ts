import { describe, expect, it } from 'vitest';
import { COIN_POS, RACE, RAMP } from './earthgames';
import { SOLIDS, keepClear, pathPoints, scatter, solidAt, HANGAR_POS, ROCKET_POS } from './lobby';

describe('lobby', () => {
  it('no solid object sits on a coin, the race, the ramp, the hangar or the rocket', () => {
    for (const s of SOLIDS) {
      for (const [x, z] of COIN_POS) expect(Math.hypot(s.x - x, s.z - z), `coin ${x},${z}`).toBeGreaterThan(s.r + 2);
      for (const q of [RACE.start, ...RACE.cones, RAMP]) expect(Math.hypot(s.x - q.x, s.z - q.z)).toBeGreaterThan(s.r + 3);
      expect(Math.hypot(s.x - HANGAR_POS.x, s.z - HANGAR_POS.z)).toBeGreaterThan(s.r + 12);
    }
    expect(SOLIDS.filter(s => Math.hypot(s.x - ROCKET_POS.x, s.z - ROCKET_POS.z) < 16).length).toBeGreaterThan(0);   // the launch tower and tanks are around the rocket on purpose
  });
  it('the paths are not blocked by solids, and the start and the coins stay reachable', () => {
    for (const p of pathPoints(3)) expect(solidAt(p.x, p.z)).toBe(false);
    for (const [x, z] of COIN_POS) expect(solidAt(x, z)).toBe(false);
    expect(solidAt(0, 8)).toBe(false);
  });
  it('scenery is deterministic, plentiful, and never on top of gameplay', () => {
    const a = scatter(5, 80, 120), b = scatter(5, 80, 120);
    expect(a).toEqual(b); expect(a.bushes.length).toBe(80); expect(a.flowers.length).toBe(120);
    for (const p of [...a.bushes, ...a.flowers]) expect(keepClear(p.x, p.z), `${p.x},${p.z}`).toBe(false);
  });
});
