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
