import type { V3 } from './combat';

export type PoiKind = 'beacon' | 'crate' | 'photo';
export interface Poi extends V3 { id: number; kind: PoiKind; done: boolean; hold: number; taken: boolean }
export type PoiEvent =
  | { type: 'progress'; poi: Poi; k: number } | { type: 'done'; poi: Poi } | { type: 'pickup'; poi: Poi } | { type: 'deliver'; poi: Poi }
  | { type: 'nophoto' } | { type: 'far' } | { type: 'aim' };

export interface PoiOpts { holdTime: number; range: number; homeRange: number; canPhoto: boolean }
/** A photo needs the formation to be close and inside the viewfinder (about 20° around where the rover faces). */
export const PHOTO_RANGE = 18, PHOTO_COS = 0.94;
export type PhotoState = 'ready' | 'far' | 'off';
export function photoState(q: V3, p: V3, facing: V3 | null): PhotoState {
  const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1e-6;
  if (d > PHOTO_RANGE) return 'far';
  if (facing) { const f = Math.hypot(facing.x, facing.z) || 1; if ((dx * facing.x + dz * facing.z) / (d * f) < PHOTO_COS) return 'off'; }
  return 'ready';
}
const d3 = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Side objectives: hold-to-repair beacons, a crate to carry home, and photo targets. */
export class PoiSim {
  carrying: Poi | null = null;
  constructor(public pois: Poi[], public home: V3, public o: PoiOpts) {}
  get doneCount() { return this.pois.filter(p => p.done).length; }
  get complete() { return this.pois.length > 0 && this.pois.every(p => p.done); }
  /** nearest unfinished poi, for the arrow / hint */
  nearest(p: V3): Poi | null { let b: Poi | null = null, bd = Infinity; for (const q of this.pois) { if (q.done || q.taken) continue; const d = d3(q, p); if (d < bd) { b = q; bd = d; } } return b; }
  /** The unfinished photo target the viewfinder should care about, and whether it is framed. */
  photoTarget(p: V3, facing: V3 | null): { poi: Poi; state: PhotoState } | null {
    let best: Poi | null = null, bd = Infinity;
    for (const q of this.pois) { if (q.kind !== 'photo' || q.done) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { best = q; bd = d; } }
    return best ? { poi: best, state: photoState(best, p, facing) } : null;
  }
  update(dt: number, p: V3, held: boolean, pulse: boolean, facing: V3 | null = null): PoiEvent[] {
    const ev: PoiEvent[] = [];
    for (const q of this.pois) {
      if (q.done) continue;
      if (q.kind === 'beacon') {
        const near = d3(q, p) < this.o.range;
        if (near && held) { q.hold += dt; ev.push({ type: 'progress', poi: q, k: Math.min(1, q.hold / this.o.holdTime) }); if (q.hold >= this.o.holdTime) { q.done = true; ev.push({ type: 'done', poi: q }); } }
        else q.hold = Math.max(0, q.hold - dt * 0.5);
      } else if (q.kind === 'photo' && pulse && Math.hypot(q.x - p.x, q.z - p.z) < PHOTO_RANGE * 1.6) {
        const st = photoState(q, p, facing);
        if (!this.o.canPhoto) ev.push({ type: 'nophoto' });
        else if (st === 'ready') { q.done = true; ev.push({ type: 'done', poi: q }); }
        else ev.push({ type: st === 'far' ? 'far' : 'aim' });
      } else if (q.kind === 'crate') {
        if (q.taken && this.carrying === q) { q.x = p.x; q.y = p.y + 1.2; q.z = p.z; if (pulse && d3(this.home, p) < this.o.homeRange) { q.done = true; this.carrying = null; ev.push({ type: 'deliver', poi: q }); ev.push({ type: 'done', poi: q }); } }
        else if (!q.taken && pulse && d3(q, p) < this.o.range) { q.taken = true; this.carrying = q; ev.push({ type: 'pickup', poi: q }); }
      }
    }
    return ev;
  }
  /** A thief took the crate: it stays where it was dropped, free to pick up again. */
  drop(at: V3) { const c = this.carrying; if (c) { c.taken = false; c.x = at.x; c.y = at.y; c.z = at.z; this.carrying = null; } return c; }
}

export function makePois(kind: PoiKind, n: number, place: (i: number) => V3): Poi[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, kind, ...place(i), done: false, hold: 0, taken: false }));
}
