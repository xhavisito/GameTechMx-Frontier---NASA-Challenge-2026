import type { V3 } from './combat';

export type PoiKind = 'beacon' | 'crate' | 'photo';
export interface Poi extends V3 { id: number; kind: PoiKind; done: boolean; hold: number; taken: boolean }
export type PoiEvent =
  | { type: 'progress'; poi: Poi; k: number } | { type: 'done'; poi: Poi } | { type: 'pickup'; poi: Poi } | { type: 'deliver'; poi: Poi }
  | { type: 'nophoto' } | { type: 'far' };

export interface PoiOpts { holdTime: number; range: number; homeRange: number; canPhoto: boolean }
const d3 = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Side objectives: hold-to-repair beacons, a crate to carry home, and photo targets. */
export class PoiSim {
  carrying: Poi | null = null;
  constructor(public pois: Poi[], public home: V3, public o: PoiOpts) {}
  get doneCount() { return this.pois.filter(p => p.done).length; }
  get complete() { return this.pois.length > 0 && this.pois.every(p => p.done); }
  /** nearest unfinished poi, for the arrow / hint */
  nearest(p: V3): Poi | null { let b: Poi | null = null, bd = Infinity; for (const q of this.pois) { if (q.done || q.taken) continue; const d = d3(q, p); if (d < bd) { b = q; bd = d; } } return b; }
  update(dt: number, p: V3, held: boolean, pulse: boolean): PoiEvent[] {
    const ev: PoiEvent[] = [];
    for (const q of this.pois) {
      if (q.done) continue;
      if (q.kind === 'beacon') {
        const near = d3(q, p) < this.o.range;
        if (near && held) { q.hold += dt; ev.push({ type: 'progress', poi: q, k: Math.min(1, q.hold / this.o.holdTime) }); if (q.hold >= this.o.holdTime) { q.done = true; ev.push({ type: 'done', poi: q }); } }
        else q.hold = Math.max(0, q.hold - dt * 0.5);
      } else if (q.kind === 'photo' && pulse && d3(q, p) < this.o.range * 2.4) {
        if (!this.o.canPhoto) ev.push({ type: 'nophoto' }); else { q.done = true; ev.push({ type: 'done', poi: q }); }
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
