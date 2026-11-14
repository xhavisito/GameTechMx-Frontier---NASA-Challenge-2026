import { describe, expect, it } from 'vitest';
import { createWorld, heightAt, newRover, stepRover, visibleSamples, sampleInReach, scoreRun, type WorldConfig, HALF, LANDER_R } from './marsWorld';

const cfg: WorldConfig = { seed: 42, camera: true, spectrometer: true, radar: false, battery: 120, solar: 60, health: 100 };

describe('marsWorld', () => {
  it('is deterministic per seed', () => {
    const a = createWorld(cfg), b = createWorld(cfg), c = createWorld({ ...cfg, seed: 43 });
    expect(a.samples).toEqual(b.samples);
    expect(a.samples).not.toEqual(c.samples);
  });
  it('keeps the landing pad flat and samples inside the map', () => {
    const w = createWorld(cfg);
    expect(Math.abs(heightAt(w, 0, 0))).toBeLessThan(0.01);
    for (const s of w.samples) { expect(Math.abs(s.x)).toBeLessThan(HALF); expect(Math.hypot(s.x, s.z)).toBeGreaterThan(LANDER_R); }
  });
  it('hides buried ice without radar', () => {
    const w = createWorld(cfg), ice = w.samples.find(s => s.kind === 'ice')!;
    expect(visibleSamples(w, cfg, new Set(), ice.x, ice.z).some(s => s.id === ice.id)).toBe(false);
    expect(visibleSamples(w, { ...cfg, radar: true }, new Set(), ice.x, ice.z).some(s => s.id === ice.id)).toBe(true);
    expect(sampleInReach(w, cfg, new Set(), ice.x, ice.z)).toBeNull();
    expect(sampleInReach(w, { ...cfg, radar: true }, new Set(), ice.x, ice.z)?.id).toBe(ice.id);
  });
  it('drives forward, drains energy and stays inside the map', () => {
    const w = createWorld(cfg); let r = newRover(cfg);
    for (let i = 0; i < 600; i++) r = stepRover(w, cfg, r, { throttle: 1, steer: 0, boost: false }, 0.05);
    expect(r.energy).toBeLessThan(cfg.battery);
    expect(Math.abs(r.x)).toBeLessThanOrEqual(HALF); expect(Math.abs(r.z)).toBeLessThanOrEqual(HALF);
    expect(Number.isFinite(r.x + r.z + r.energy)).toBe(true);
  });
  it('crawls when the battery is empty', () => {
    const w = createWorld(cfg); let r = { ...newRover(cfg), energy: 0 };
    for (let i = 0; i < 100; i++) r = stepRover(w, { ...cfg, solar: 0 }, r, { throttle: 1, steer: 0, boost: true }, 0.05);
    expect(r.speed).toBeLessThan(2);
  });
  it('scores returning with samples above failing', () => {
    const r = newRover(cfg);
    expect(scoreRun(cfg, ['basalt', 'ice', 'hematite'], true, r, 200).score).toBeGreaterThan(scoreRun(cfg, ['basalt'], false, r, 200).score);
  });
});
