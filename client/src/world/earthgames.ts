/** Little side games on Earth for people who want to hang around and earn a few coins: a kick-about pitch and a coin hunt.
 *  Pure state + plain math (the scene only draws it), so it is easy to test. */
export const PITCH = { x: 0, z: -38, hw: 13, hl: 17, y: 0.32 };
export const GOAL_HALF = 4.5, BALL_R = 0.9, ROVER_R = 2.1;
export const REWARD = { goal: 2, coin: 1, round: 3 };

export interface Ball { x: number; z: number; vx: number; vz: number }
export const newBall = (): Ball => ({ x: PITCH.x, z: PITCH.z + 3, vx: 0, vz: 0 });
export const inPitch = (x: number, z: number, m = 0) => Math.abs(x - PITCH.x) <= PITCH.hw + m && Math.abs(z - PITCH.z) <= PITCH.hl + m;
export interface Pusher { x: number; z: number; speed: number; heading: number }

/** Rover pushes the ball, friction slows it, fences bounce it; the far end has a goal mouth. */
export function stepBall(b: Ball, rv: Pusher, dt: number): { ball: Ball; goal: boolean } {
  let { x, z, vx, vz } = b;
  const rvx = Math.sin(rv.heading) * rv.speed, rvz = Math.cos(rv.heading) * rv.speed;
  const dx = x - rv.x, dz = z - rv.z, d = Math.hypot(dx, dz);
  if (d < ROVER_R + BALL_R) {
    const nx = d > 1e-3 ? dx / d : Math.sin(rv.heading), nz = d > 1e-3 ? dz / d : Math.cos(rv.heading);
    const s = Math.max(5, Math.abs(rv.speed) * 1.6);
    vx = nx * s + rvx * 0.3; vz = nz * s + rvz * 0.3;
    x = rv.x + nx * (ROVER_R + BALL_R + 0.05); z = rv.z + nz * (ROVER_R + BALL_R + 0.05);
  }
  x += vx * dt; z += vz * dt;
  const f = Math.exp(-0.9 * dt); vx *= f; vz *= f;
  const xmin = PITCH.x - PITCH.hw + BALL_R, xmax = PITCH.x + PITCH.hw - BALL_R, zmax = PITCH.z + PITCH.hl - BALL_R, zgoal = PITCH.z - PITCH.hl;
  if (x < xmin) { x = xmin; vx = Math.abs(vx) * 0.6; } else if (x > xmax) { x = xmax; vx = -Math.abs(vx) * 0.6; }
  if (z > zmax) { z = zmax; vz = -Math.abs(vz) * 0.6; }
  if (z < zgoal + BALL_R) {
    if (Math.abs(x - PITCH.x) < GOAL_HALF && z < zgoal) return { ball: newBall(), goal: true };
    if (Math.abs(x - PITCH.x) >= GOAL_HALF) { z = zgoal + BALL_R; vz = Math.abs(vz) * 0.6; }
  }
  return { ball: { x, z, vx, vz }, goal: false };
}

export interface Coin { x: number; z: number; got: boolean }
export interface CoinField { coins: Coin[]; respawn: number }
export const COIN_POS: [number, number][] = [[-22, -2], [-48, -30], [-60, 6], [22, 34], [52, 24], [8, 58], [-12, 48], [58, -52], [-52, -62], [30, -66]];
export const newCoins = (): CoinField => ({ coins: COIN_POS.map(([x, z]) => ({ x, z, got: false })), respawn: 0 });

/** Driving over a coin picks it up; the whole set comes back a few seconds after the last one. */
export function stepCoins(f: CoinField, rv: { x: number; z: number }, dt: number): { got: number; round: boolean } {
  let got = 0;
  if (f.respawn > 0) { f.respawn -= dt; if (f.respawn <= 0) for (const c of f.coins) c.got = false; return { got: 0, round: false }; }
  for (const c of f.coins) if (!c.got && Math.hypot(c.x - rv.x, c.z - rv.z) < 2.8) { c.got = true; got++; }
  const round = got > 0 && f.coins.every(c => c.got);
  if (round) f.respawn = 12;
  return { got, round };
}
export const coinsLeft = (f: CoinField) => f.coins.filter(c => !c.got).length;

// ── cone race: drive through the start gate, touch the cones in order, come back ──
export const RACE = { start: { x: 46, z: -8 }, cones: [{ x: 62, z: -16 }, { x: 70, z: 4 }, { x: 56, z: 18 }, { x: 38, z: 12 }, { x: 30, z: -2 }], limit: 90, gate: 4, hit: 3.6 };
export interface Race { run: boolean; t: number; next: number; cd: number }
export const newRace = (): Race => ({ run: false, t: 0, next: 0, cd: 0 });
export const raceReward = (secs: number) => (secs < 40 ? 10 : secs < 60 ? 6 : 3);
export type RaceEvent = { type: 'start' } | { type: 'cone'; n: number } | { type: 'finish'; secs: number; reward: number } | { type: 'timeout' } | null;
export function stepRace(r: Race, rv: { x: number; z: number }, dt: number): RaceEvent {
  r.cd = Math.max(0, r.cd - dt);
  const ds = Math.hypot(rv.x - RACE.start.x, rv.z - RACE.start.z);
  if (!r.run) { if (r.cd <= 0 && ds < RACE.gate) { r.run = true; r.t = 0; r.next = 0; return { type: 'start' }; } return null; }
  r.t += dt;
  if (r.t > RACE.limit) { r.run = false; r.cd = 4; return { type: 'timeout' }; }
  if (r.next < RACE.cones.length) { const c = RACE.cones[r.next]!; if (Math.hypot(rv.x - c.x, rv.z - c.z) < RACE.hit) { r.next++; return { type: 'cone', n: r.next }; } return null; }
  if (ds < RACE.gate) { r.run = false; r.cd = 5; const secs = Math.round(r.t * 10) / 10; return { type: 'finish', secs, reward: raceReward(secs) }; }
  return null;
}

// ── stunt ramp: hit it fast and the rover flies for a moment ──
export const RAMP = { x: -32, z: -46, r: 3.6, minSpeed: 5, air: 0.9, height: 3 };
export interface Air { t: number; cd: number }
export const newAir = (): Air => ({ t: 0, cd: 0 });
/** Returns the rover's height above the ground and whether a jump just started. */
export function stepAir(a: Air, rv: { x: number; z: number; speed: number }, dt: number): { lift: number; jumped: boolean } {
  a.cd = Math.max(0, a.cd - dt);
  let jumped = false;
  if (a.t <= 0 && a.cd <= 0 && rv.speed > RAMP.minSpeed && Math.hypot(rv.x - RAMP.x, rv.z - RAMP.z) < RAMP.r) { a.t = 0.0001; a.cd = 1.5; jumped = true; }
  if (a.t > 0) { a.t += dt / RAMP.air; if (a.t >= 1) a.t = 0; }
  return { lift: a.t > 0 ? Math.sin(Math.PI * a.t) * RAMP.height : 0, jumped };
}
