import { sfx } from './audio';
/** Enemies, bullets and the "thief" easter egg, shared by the three worlds. Pure state + plain math so it is easy to test. */
export type EnemyKind = 'crawler' | 'drone' | 'angler' | 'thief' | 'swarmer' | 'dasher' | 'brute' | 'boss';
/** Variants that join the world's own creature as the player gets stronger (see threat.ts). Multipliers on the base stats. */
export const VARIANTS = {
  swarmer: { hp: 0.5, speed: 1.45, dmg: 0.7, size: 0.65, hit: 1.4 },
  dasher: { hp: 0.8, speed: 1, dmg: 1, size: 0.9, hit: 1.7 },
  brute: { hp: 2.4, speed: 0.7, dmg: 1.5, size: 1.45, hit: 2.4 },
} as const;
export type VariantKind = keyof typeof VARIANTS;
/** The boss: one per boss mission. Slow, huge, lunges now and then, and counts for several kills. */
export const BOSS = { hp: 9, speed: 0.6, dmg: 1.8, size: 2.4, hit: 3.6 } as const;
const STATS = { ...VARIANTS, boss: BOSS } as const;
export const statsOf = (k: EnemyKind) => (k in STATS ? STATS[k as keyof typeof STATS] : null);
/** Listen to every combat event of every world (the game uses it for sounds-adjacent bookkeeping like achievements). */
let listener: ((e: CombatEvent) => void) | null = null;
export const setCombatListener = (f: ((e: CombatEvent) => void) | null) => { listener = f; };
/** Never more than this many hostile creatures at once, however strong the player is. */
export const MAX_ENEMIES = 4;
export interface V3 { x: number; y: number; z: number }
export interface Enemy extends V3 { id: number; kind: EnemyKind; hp: number; maxHp: number; speed: number; cd: number; flee: number; alive: boolean; seed: number; elite: boolean; flash: number; carry: string | null; age: number; wind: number; recoil: number; dash: number; dashIn: number }
export interface Bullet extends V3 { dx: number; dy: number; dz: number; life: number; dmg: number; alive: boolean }

export interface CombatCfg {
  kind: EnemyKind;
  max: number; spawnEvery: number; waveEvery: number; hp: number; speed: number; damage: number; aggro: number;
  /** extra creature types unlocked by the player's power (empty = just the world's own) */
  variants?: VariantKind[];
  /** a boss mission: one boss shows up after a while */
  boss?: boolean;
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
  | { type: 'thief' }
  | { type: 'boss' };

const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const dist3 = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export class CombatSim {
  enemies: Enemy[] = []; bullets: Bullet[] = []; time = 0; kills = 0; invuln = 0; nextId = 1; stolen = 0;
  private next: number; private nextWave: number; private rnd: () => number; private thiefAt: number; private thiefDone = false; private bossDone = false; private spawned = 0;
  constructor(public cfg: CombatCfg) {
    this.rnd = mulberry(cfg.seed); this.next = Math.max(4, cfg.spawnEvery * 0.4);
    this.nextWave = cfg.waveEvery > 0 ? cfg.waveEvery : Infinity;
    this.thiefAt = this.rnd() < cfg.thiefChance ? 45 + this.rnd() * 90 : Infinity;
  }
  get alive() { return this.enemies.filter(e => e.alive); }
  get capacity() { return Math.min(MAX_ENEMIES, Math.max(1, Math.round(this.cfg.max * this.cfg.more))); }
  /** Which creature comes next: the world's own, or (once unlocked) one of the variants. Elites are always the world's own. */
  private pick(elite: boolean): EnemyKind {
    const v = this.cfg.variants;
    if (!v || v.length === 0 || elite || this.rnd() < 0.45) return this.cfg.kind;
    return v[Math.floor(this.rnd() * v.length) % v.length]!;
  }
  private spawn(p: V3, kind?: EnemyKind, elite = false) {
    kind ??= this.pick(elite);
    const vs = statsOf(kind);
    const pos = this.cfg.place(p, this.rnd(), this.rnd());
    const grow = 1 + this.time / 240; // enemies get tougher as the run goes on
    const hp = kind === 'thief' ? 3 : this.cfg.hp * grow * (elite ? 2.5 : 1) * (vs?.hp ?? 1);   // (a boss is hp x9)
    const e: Enemy = { id: this.nextId++, kind, x: pos.x, y: pos.y, z: pos.z, hp, maxHp: hp, speed: this.cfg.speed * this.cfg.slow * (elite ? 1.1 : 1) * (kind === 'thief' ? 1.25 : 1) * (vs?.speed ?? 1), cd: 0, flee: 0, alive: true, seed: this.rnd() * 100, elite, flash: 0, carry: null, age: 0, wind: 0, recoil: 0, dash: 0, dashIn: 2 + this.rnd() * 2 };
    this.enemies.push(e); this.spawned++; return e;
  }
  /** Advance everything. `p` is the player (speed in m/s). Returns what happened so the world can react. */
  update(dt: number, p: V3, speedNow: number): CombatEvent[] {
    const ev: CombatEvent[] = [], c = this.cfg; this.time += dt; this.invuln = Math.max(0, this.invuln - dt);
    this.enemies = this.enemies.filter(e => e.alive || e.flash > 0);
    const alive = this.alive.filter(e => e.kind !== 'thief').length;
    this.next -= dt;
    const gap = Math.max(c.spawnEvery * 0.35, c.spawnEvery * (1 - this.time / 700));
    if (this.next <= 0) { this.next = gap * (0.8 + this.rnd() * 0.4); if (alive < this.capacity) this.spawn(p, undefined, c.hp > 0 && this.spawned > 0 && this.spawned % 5 === 4 && c.waveEvery > 0); }
    if (this.time >= this.nextWave) { this.nextWave += c.waveEvery; ev.push({ type: 'wave' }); const n = Math.min(Math.max(2, Math.round(this.capacity * 0.6)), Math.max(0, this.capacity - alive)); for (let i = 0; i < n; i++) this.spawn(p); }
    if (c.boss && !this.bossDone && this.time >= 25 && alive < this.capacity) { this.bossDone = true; this.spawn(p, 'boss'); ev.push({ type: 'boss' }); }
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
        e.recoil = Math.max(0, e.recoil - dt);
        if (e.recoil > 0) { const k = (e.speed * 1.4 * dt) / Math.max(0.001, d); e.x -= (p.x - e.x) * k; e.y -= (p.y - e.y) * k; e.z -= (p.z - e.z) * k; e.wind = 0; }   // bounce back after an attack
        else if (chase && d > 1.7) {
          if (e.kind === 'dasher' || e.kind === 'boss') { const boss = e.kind === 'boss'; e.dashIn -= dt; if (e.dash > 0) e.dash -= dt; else if (e.dashIn <= 0 && d > 5) { e.dash = boss ? 0.9 : 0.6; e.dashIn = (boss ? 5 : 3.5) + this.rnd() * 1.5; } }   // lunges in a short burst every few seconds
          const k = (e.speed * (e.dash > 0 ? 2.8 : 1) * dt) / Math.max(0.001, d); e.x += (p.x - e.x) * k; e.y += (p.y - e.y) * k; e.z += (p.z - e.z) * k; }
        else { const a = e.seed + this.time * 0.25; e.x += Math.cos(a) * e.speed * 0.3 * dt; e.z += Math.sin(a * 1.3) * e.speed * 0.3 * dt; e.y += Math.sin(a * 0.7) * e.speed * 0.1 * dt; }
        // contact: it rears up for a moment (so you can dodge), then bites once and backs off. You get a short grace period after a bite.
        if (e.recoil <= 0 && d < 2.6) {
          e.wind += dt;
          if (e.wind >= 0.5 && e.cd <= 0 && this.invuln <= 0) { e.cd = 1.8; e.wind = 0; e.recoil = 1; this.invuln = 0.9; ev.push({ type: 'hit', enemy: e, dmg: c.damage * (e.elite ? 1.5 : 1) * (statsOf(e.kind)?.dmg ?? 1) }); }
          else if (e.wind >= 0.5) e.wind = 0.4;
        } else if (e.recoil <= 0) e.wind = Math.max(0, e.wind - dt * 2);
        if (d > 170) e.alive = false;  // lost track: despawn far-away enemies
      }
      c.constrain(e);
    }
    this.stepBullets(dt, ev);
    void speedNow;
    const SOUND = { hit: 'hurt', kill: 'kill', wave: 'wave', steal: 'steal' } as const;
    for (const e of ev) { listener?.(e); if (e.type === 'boss') sfx('boss'); }
    for (const e of ev) if (e.type in SOUND) sfx(SOUND[e.type as keyof typeof SOUND]);
    return ev;
  }
  shoot(from: V3, dir: V3, dmg: number, speed = 42, life = 1.3) {
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
    sfx('shoot');
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
        if (dist3(b, e) < (e.elite ? 2.4 : statsOf(e.kind)?.hit ?? 1.8)) {
          b.alive = false; e.hp -= b.dmg; e.flash = 0.25;
          if (e.hp <= 0) { e.alive = false; this.kills += e.kind === 'boss' ? 5 : 1; ev.push({ type: 'kill', enemy: e }); }
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
