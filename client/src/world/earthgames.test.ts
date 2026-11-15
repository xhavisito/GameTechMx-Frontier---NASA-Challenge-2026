import { describe, expect, it } from 'vitest';
import { GOAL_HALF, PITCH, coinsLeft, newBall, newCoins, stepBall, stepCoins, COIN_POS, inPitch } from './earthgames';

describe('earth side games', () => {
  it('the rover pushes the ball and it slows down by itself', () => {
    let b = newBall(); const rv = { x: b.x, z: b.z + 2.5, speed: 8, heading: Math.PI };   // behind the ball, driving toward -z
    for (let i = 0; i < 10; i++) b = stepBall(b, { ...rv, z: b.z + 2.5 }, 0.05).ball;
    expect(b.vz).toBeLessThan(-3);
    const v0 = Math.hypot(b.vx, b.vz); for (let i = 0; i < 40; i++) b = stepBall(b, { x: 500, z: 500, speed: 0, heading: 0 }, 0.05).ball;
    expect(Math.hypot(b.vx, b.vz)).toBeLessThan(v0 * 0.5);
  });
  it('kicking it through the goal mouth scores and resets the ball; off to the side it only bounces', () => {
    const goal = { x: PITCH.x, z: PITCH.z - PITCH.hl + 1, vx: 0, vz: -20 };
    expect(stepBall(goal, { x: 500, z: 500, speed: 0, heading: 0 }, 0.2).goal).toBe(true);
    const wide = { x: PITCH.x + GOAL_HALF + 3, z: PITCH.z - PITCH.hl + 1, vx: 0, vz: -20 };
    const r = stepBall(wide, { x: 500, z: 500, speed: 0, heading: 0 }, 0.2); expect(r.goal).toBe(false); expect(r.ball.vz).toBeGreaterThan(0);
  });
  it('the ball never leaves the pitch', () => {
    let b = { x: 0, z: PITCH.z, vx: 40, vz: 30 };
    for (let i = 0; i < 400; i++) { const r = stepBall(b, { x: 500, z: 500, speed: 0, heading: 0 }, 0.05); b = r.ball; if (r.goal) b = { ...b, vx: 40, vz: 30 }; expect(inPitch(b.x, b.z, 1.5)).toBe(true); }
  });
  it('coins are picked once, a full round pays a bonus, and they come back', () => {
    const f = newCoins(); let total = 0, rounds = 0;
    for (const [x, z] of COIN_POS) { const r = stepCoins(f, { x, z }, 0.05); total += r.got; if (r.round) rounds++; expect(stepCoins(f, { x, z }, 0.05).got).toBe(0); }
    expect(total).toBe(COIN_POS.length); expect(rounds).toBe(1); expect(coinsLeft(f)).toBe(0);
    for (let i = 0; i < 300; i++) stepCoins(f, { x: 999, z: 999 }, 0.05);
    expect(coinsLeft(f)).toBe(COIN_POS.length);
  });
  it('nothing is placed on top of the hangar, the rocket, the start or the pitch', () => {
    for (const [x, z] of COIN_POS) {
      expect(Math.hypot(x + 34, z - 26)).toBeGreaterThan(12); expect(Math.hypot(x - 34, z + 22)).toBeGreaterThan(12); expect(Math.hypot(x, z - 8)).toBeGreaterThan(10); expect(inPitch(x, z, 4)).toBe(false);
    }
  });
});
