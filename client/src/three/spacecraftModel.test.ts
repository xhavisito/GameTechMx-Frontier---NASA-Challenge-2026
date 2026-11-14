import { describe, expect, it } from 'vitest';
import { createDefaultDesign, simulateMission } from '../../../shared/index';
import { buildShipSpec, flightStateAt, orbitShapes } from './spacecraftModel';

describe('3D spacecraft mapping', () => {
  it('draws every selected instrument and subsystem', () => {
    const design = createDefaultDesign('wildfire');
    const spec = buildShipSpec(design);
    expect(spec.instruments.map(i => i.id).sort()).toEqual([...design.instrumentIds].sort());
    expect(spec.antenna).not.toBeNull();
    expect(spec.bus.size.every(n => n > 0)).toBe(true);
  });

  it('changes the model when the player changes the design', () => {
    const base = createDefaultDesign('cubesat');
    const small = buildShipSpec({ ...base, componentIds: base.componentIds.filter(id => !id.startsWith('solar')).concat('solar-basic') });
    const big = buildShipSpec({ ...base, componentIds: base.componentIds.filter(id => !id.startsWith('solar')).concat('solar-advanced') });
    expect(small.solar?.wings).toBe(2);
    expect(big.solar?.wings).toBe(4);
    expect(big.solar!.span).toBeGreaterThan(small.solar!.span);
    const noSolar = buildShipSpec({ ...base, componentIds: base.componentIds.filter(id => !id.startsWith('solar')) });
    expect(noSolar.solar).toBeNull();
  });

  it('flags power and data problems on the parts that cause them', () => {
    const base = createDefaultDesign('cubesat');
    const starving = buildShipSpec({ ...base, instrumentIds: [...base.instrumentIds, 'sar', 'hyperspectral'] });
    expect(starving.solar?.status ?? starving.rtg?.status).toBe('bad');
    expect(starving.readiness).toBe('bad');
  });

  it('marks an incapable launcher', () => {
    const base = createDefaultDesign('mars');
    const spec = buildShipSpec({ ...base, launcherId: 'rideshare' });
    expect(spec.launcher.status).toBe('bad');
  });

  it('has an orbit shape for every orbit', () => {
    for (const shape of Object.values(orbitShapes)) expect(shape.radius).toBeGreaterThan(1);
  });

  it('derives a deterministic flight state with event visuals', () => {
    const design = { ...createDefaultDesign('wildfire'), difficulty: 'expert' as const };
    const timeline = simulateMission(design, 'FRONTIER-2026');
    const event = timeline.events.find(e => e.day > 0);
    const a = flightStateAt(timeline, event ? event.day : 5);
    const b = flightStateAt(timeline, event ? event.day : 5);
    expect(a).toEqual(b);
    if (event) expect(a.event?.type).toBe(event.type);
    expect(flightStateAt(timeline, 0).phase).toBe('launch');
  });
});
