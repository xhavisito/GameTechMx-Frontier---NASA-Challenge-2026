import { describe, expect, it } from 'vitest';
import { PoiSim, makePois, photoState } from './pois';

describe('photo missions are literal', () => {
  const sim = () => new PoiSim(makePois('photo', 1, () => ({ x: 0, y: 0, z: 10 })), { x: 0, y: 0, z: 0 }, { holdTime: 2, range: 5, homeRange: 8, canPhoto: true });
  it('needs the formation close and inside the viewfinder', () => {
    const P = { x: 0, y: 0, z: 0 };
    expect(photoState({ x: 0, y: 0, z: 10 }, P, { x: 0, y: 0, z: 1 })).toBe('ready');
    expect(photoState({ x: 0, y: 0, z: 10 }, P, { x: 1, y: 0, z: 0 })).toBe('off');
    expect(photoState({ x: 0, y: 0, z: 40 }, P, { x: 0, y: 0, z: 1 })).toBe('far');
  });
  it('pressing the shutter while looking away does nothing', () => {
    const s = sim(); const ev = s.update(0.05, { x: 0, y: 0, z: 0 }, false, true, { x: 1, y: 0, z: 0 });
    expect(ev.some(e => e.type === 'aim')).toBe(true); expect(s.doneCount).toBe(0);
  });
  it('a framed shot counts', () => {
    const s = sim(); s.update(0.05, { x: 0, y: 0, z: 0 }, false, true, { x: 0, y: 0, z: 1 });
    expect(s.doneCount).toBe(1);
  });
  it('without a camera there is no photo', () => {
    const s = sim(); s.o.canPhoto = false; const ev = s.update(0.05, { x: 0, y: 0, z: 0 }, false, true, { x: 0, y: 0, z: 1 });
    expect(ev.some(e => e.type === 'nophoto')).toBe(true); expect(s.doneCount).toBe(0);
  });
});
