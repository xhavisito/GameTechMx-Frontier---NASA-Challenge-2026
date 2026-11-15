/** Enemies, bullets and the "thief" easter egg, shared by the three worlds. Pure state + plain math so it is easy to test. */
export type EnemyKind = 'crawler' | 'drone' | 'angler' | 'thief';
export interface V3 { x: number; y: number; z: number }
export interface Enemy extends V3 { id: number; kind: EnemyKind; hp: number; maxHp: number; speed: number; cd: number; flee: number; alive: boolean; seed: number; elite: boolean; flash: number; carry: string | null; age: number }
export interface Bullet extends V3 { dx: number; dy: number; dz: number; life: number; dmg: number; alive: boolean }

export interface CombatCfg {
  kind: EnemyKind;
  max: number; spawnEvery: number; waveEvery: number; hp: number; speed: number; damage: number; aggro: number;
  thiefChance: number; /** chance that a thief shows up in a run */
  /** where new enemies appear, given the player and two random numbers */
  place: (p: V3, r1: number, r2: number) => V3;
  /** keep an enemy inside the world (ground height, shell, depth range) */
  constrain: (e: V3) => void;
  slow: number; more: number; seed: number;
}
export type CombatEvent =
  | { type: 'hit'; enemy: Enemy; dmg: number }
  | { type: 'steal'; enemy: Enemy }
  | { type: 'kill'; enemy: Enemy }
  | { type: 'wave' }
  | { type: 'escape'; enemy: Enemy }
  | { type: 'thief' };

const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const dist3 = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export class CombatSim {
  enemies: Enemy[] = []; bullets: Bullet[] = []; time = 0; kills = 0; nextId = 1; stolen = 0;
  private next: number; private nextWave: number; private rnd: () => number; private thiefAt: number; private thiefDone = false; private spawned = 0;
  constructor(public cfg: CombatCfg) {
    this.rnd = mulberry(cfg.seed); this.next = Math.max(4, cfg.spawnEvery * 0.4);
    this.nextWave = cfg.waveEvery > 0 ? cfg.waveEvery : Infinity;
    this.thiefAt = this.rnd() < cfg.thiefChance ? 45 + this.rnd() * 90 : Infinity;
  }
  get alive() { return this.enemies.filter(e => e.alive); }
  get capacity() { return Math.round(this.cfg.max * this.cfg.more); }
  private spawn(p: V3, kind: EnemyKind = this.cfg.kind, elite = false) {
    const pos = this.cfg.place(p, this.rnd(), this.rnd());
    const grow = 1 + this.time / 240; // enemies get tougher as the run goes on
    const hp = kind === 'thief' ? 3 : this.cfg.hp * grow * (elite ? 2.5 : 1);
    const e: Enemy = { id: this.nextId++, kind, x: pos.x, y: pos.y, z: pos.z, hp, maxHp: hp, speed: this.cfg.speed * this.cfg.slow * (elite ? 1.1 : 1) * (kind === 'thief' ? 1.25 : 1), cd: 0, flee: 0, alive: true, seed: this.rnd() * 100, elite, flash: 0, carry: null, age: 0 };
    this.enemies.push(e); this.spawned++; return e;
  }
  /** Advance everything. `p` is the player (speed in m/s). Returns what happened so the world can react. */
  update(dt: number, p: V3, speedNow: number): CombatEvent[] {
    const ev: CombatEvent[] = [], c = this.cfg; this.time += dt;
    this.enemies = this.enemies.filter(e => e.alive || e.flash > 0);
    const alive = this.alive.filter(e => e.kind !== 'thief').length;
    this.next -= dt;
    const gap = Math.max(c.spawnEvery * 0.35, c.spawnEvery * (1 - this.time / 700));
    if (this.next <= 0) { this.next = gap * (0.8 + this.rnd() * 0.4); if (alive < this.capacity) this.spawn(p, c.kind, c.hp > 0 && this.spawned > 0 && this.spawned % 5 === 4 && c.waveEvery > 0); }
    if (this.time >= this.nextWave) { this.nextWave += c.waveEvery; ev.push({ type: 'wave' }); const n = Math.min(Math.max(2, Math.round(this.capacity * 0.6)), Math.max(0, this.capacity + 2 - alive)); for (let i = 0; i < n; i++) this.spawn(p); }
    if (!this.thiefDone && this.time >= this.thiefAt) { this.thiefDone = true; this.spawn(p, 'thief'); ev.push({ type: 'thief' }); }
    for (const e of this.enemies) {
      e.age += dt; e.flash = Math.max(0, e.flash - dt);
      if (!e.alive) continue;
      e.cd = Math.max(0, e.cd - dt);
      const d = dist3(e, p);
      if (e.kind === 'thief') {
        const run = e.flee > 0; if (run) e.flee -= dt;
        const dir = run ? -1 : 1, k = e.speed * dt * dir / Math.max(0.001, d);
        e.x += (p.x - e.x) * k; e.y += (p.y - e.y) * k; e.z += (p.z - e.z) * k;
        if (!run && e.carry === null && d < 2.2 && e.cd <= 0) { e.cd = 1; ev.push({ type: 'steal', enemy: e }); e.flee = 9; }
        if (run && e.flee <= 0) { e.alive = false; e.flash = 0; ev.push({ type: 'escape', enemy: e }); }   // got away with it
        if (d > 160) e.alive = false;
      } else {
        const chase = d < c.aggro;
        if (chase && d > 1.7) { const k = (e.speed * dt) / Math.max(0.001, d); e.x += (p.x - e.x) * k; e.y += (p.y - e.y) * k; e.z += (p.z - e.z) * k; }
        else { const a = e.seed + this.time * 0.25; e.x += Math.cos(a) * e.speed * 0.3 * dt; e.z += Math.sin(a * 1.3) * e.speed * 0.3 * dt; e.y += Math.sin(a * 0.7) * e.speed * 0.1 * dt; }
        if (d < 2.6 && e.cd <= 0) { e.cd = 1.1; ev.push({ type: 'hit', enemy: e, dmg: c.damage * (e.elite ? 1.5 : 1) }); }
        if (d > 170) e.alive = false;  // lost track: despawn far-away enemies
      }
      c.constrain(e);
    }
    this.stepBullets(dt, ev);
    void speedNow;
    return ev;
  }
  shoot(from: V3, dir: V3, dmg: number, speed = 42, life = 1.3) {
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
    this.bullets.push({ x: from.x, y: from.y, z: from.z, dx: (dir.x / l) * speed, dy: (dir.y / l) * speed, dz: (dir.z / l) * speed, life, dmg, alive: true });
    if (this.bullets.length > 40) this.bullets.shift();
  }
  /** Direction to the closest living enemy in front of the player (so touch and gamepad players do not need to aim). */
  aim(from: V3, heading: V3 | null, range = 55): V3 | null {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = dist3(e, from); if (d > bd) continue;
      if (heading) { const dx = e.x - from.x, dz = e.z - from.z, l = Math.hypot(dx, dz) || 1; if ((dx * heading.x + dz * heading.z) / l < 0.3) continue; }
      best = e; bd = d;
    }
    return best ? { x: best.x - from.x, y: best.y - from.y, z: best.z - from.z } : null;
  }
  private stepBullets(dt: number, ev: CombatEvent[]) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.x += b.dx * dt; b.y += b.dy * dt; b.z += b.dz * dt; b.life -= dt; if (b.life <= 0) b.alive = false;
      for (const e of this.enemies) {
        if (!e.alive || !b.alive) continue;
        if (dist3(b, e) < (e.elite ? 2.4 : 1.8)) {
          b.alive = false; e.hp -= b.dmg; e.flash = 0.25;
          if (e.hp <= 0) { e.alive = false; this.kills++; ev.push({ type: 'kill', enemy: e }); }
        }
      }
    }
    this.bullets = this.bullets.filter(b => b.alive);
  }
  /** Catching a thief by hand (no weapon needed). */
  grab(p: V3, reach = 4): Enemy | null {
    for (const e of this.enemies) if (e.alive && e.kind === 'thief' && dist3(e, p) < reach && e.flee > 0) { e.alive = false; e.flash = 0.4; return e; }
    return null;
  }
}
