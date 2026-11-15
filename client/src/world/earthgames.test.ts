import { describe, expect, it } from 'vitest';
import { RACE, RAMP, newAir, newRace, raceReward, stepAir, stepRace, GOAL_HALF, PITCH, coinsLeft, newBall, newCoins, stepBall, stepCoins, COIN_POS, inPitch } from './earthgames';

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
  it('cone race: start gate, cones in order, finish at the gate pays by time', () => {
    const r = newRace(); expect(stepRace(r, { x: 0, z: 0 }, 0.1)).toBeNull();
    expect(stepRace(r, RACE.start, 0.1)?.type).toBe('start');
    expect(stepRace(r, RACE.cones[3]!, 0.1)).toBeNull();   // out of order does nothing
    RACE.cones.forEach((c, i) => expect(stepRace(r, c, 1)).toEqual({ type: 'cone', n: i + 1 }));
    const e = stepRace(r, RACE.start, 1); expect(e?.type).toBe('finish'); if (e?.type === 'finish') expect(e.reward).toBe(raceReward(e.secs));
    expect([raceReward(30), raceReward(50), raceReward(80)]).toEqual([10, 6, 3]);
    expect(stepRace(r, RACE.start, 0.1)).toBeNull();       // cooldown, so it cannot be farmed by sitting in the gate
  });
  it('cone race times out', () => { const r = newRace(); stepRace(r, RACE.start, 0.1); let e = null; for (let i = 0; i < 100 && !e; i++) e = stepRace(r, { x: 0, z: 0 }, 1); expect(e?.type).toBe('timeout'); });
  it('ramp: only fast rovers jump, once per pass, and they come back down', () => {
    const a = newAir(); expect(stepAir(a, { x: RAMP.x, z: RAMP.z, speed: 2 }, 0.05).jumped).toBe(false);
    expect(stepAir(a, { x: RAMP.x, z: RAMP.z, speed: 8 }, 0.05).jumped).toBe(true);
    let max = 0, again = false; for (let i = 0; i < 16; i++) { const r = stepAir(a, { x: RAMP.x, z: RAMP.z, speed: 8 }, 0.05); max = Math.max(max, r.lift); again ||= r.jumped; }
    expect(max).toBeGreaterThan(RAMP.height * 0.8); expect(again).toBe(false); expect(stepAir(a, { x: 500, z: 500, speed: 0 }, 0.05).lift).toBe(0);
  });
  it('race and ramp are clear of the hangar, rocket, pitch and coins', () => {
    const pts = [RACE.start, ...RACE.cones, RAMP];
    for (const p of pts) { expect(Math.hypot(p.x + 34, p.z - 26)).toBeGreaterThan(14); expect(Math.hypot(p.x - 34, p.z + 22)).toBeGreaterThan(10); expect(inPitch(p.x, p.z, 3)).toBe(false); for (const [x, z] of COIN_POS) expect(Math.hypot(p.x - x, p.z - z)).toBeGreaterThan(6); }
  });
});
