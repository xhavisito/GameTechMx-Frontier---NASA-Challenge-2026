/**
 * Pure mapping from a mission design (and its simulated timeline) to what the
 * 3D scene draws. No React, no three.js: everything here is unit-tested so the
 * player can trust that every choice they make is visible in the gameplay.
 */
import { calculateResources, components, instruments, launchers, orbits } from '../../../shared/index';
import type { ComponentCategory, EventType, MissionDesign, MissionPhase, MissionTimeline, OrbitId, ResourceBudget } from '../../../shared/types';

export type PartStatus = 'ok' | 'warn' | 'bad';
export type InstrumentShape = 'camera' | 'wide-camera' | 'imager' | 'radar' | 'cooled-camera' | 'spectrometer' | 'boom' | 'lidar' | 'detector' | 'telescope' | 'small-dish' | 'relay';
export type AntennaKind = 'uhf' | 's' | 'x' | 'ka' | 'optical';
export type AttitudeKind = 'magnetic' | 'wheels' | 'thrusters';

export interface ShipSpec {
  /** Bus box in scene units (1 unit ≈ 1 m, visually exaggerated for small craft). */
  bus: { size: [number, number, number]; advanced: boolean; status: PartStatus };
  solar: null | { wings: 2 | 4; span: number; width: number; advanced: boolean; status: PartStatus };
  rtg: null | { count: 1 | 2; length: number; status: PartStatus };
  battery: null | { cells: number; status: PartStatus };
  antenna: null | { kind: AntennaKind; radius: number; advanced: boolean; status: PartStatus };
  computer: null | { advanced: boolean };
  storage: null | { advanced: boolean; status: PartStatus };
  attitude: null | { kind: AttitudeKind; advanced: boolean };
  propulsion: null | { nozzle: number; tanks: number; status: PartStatus };
  thermal: null | { radiator: number; advanced: boolean };
  instruments: { id: string; shape: InstrumentShape; size: number; status: PartStatus }[];
  launcher: { id: string; height: number; width: number; boosters: number; status: PartStatus };
  /** Overall readiness shown as the hangar light colour. */
  readiness: PartStatus;
  resources: ResourceBudget;
}

const instrumentShapes: Record<string, InstrumentShape> = {
  optical: 'camera', multispectral: 'wide-camera', hyperspectral: 'imager', sar: 'radar',
  'thermal-ir': 'cooled-camera', spectrometer: 'spectrometer', magnetometer: 'boom', lidar: 'lidar',
  particles: 'detector', 'uv-ir': 'telescope', 'radio-science': 'small-dish', 'relay-payload': 'relay',
};

const worst = (...statuses: PartStatus[]): PartStatus => statuses.includes('bad') ? 'bad' : statuses.includes('warn') ? 'warn' : 'ok';
const ratioStatus = (have: number, need: number, warnAt = 1.1): PartStatus => need <= 0 ? 'ok' : have < need ? 'bad' : have < need * warnAt ? 'warn' : 'ok';

export function buildShipSpec(design: MissionDesign): ShipSpec {
  const r = calculateResources(design);
  const selected = components.filter(c => design.componentIds.includes(c.id));
  const pick = (category: ComponentCategory) => selected.find(c => c.category === category);
  const structure = pick('structure');
  const solar = pick('solar');
  const rtg = pick('rtg');
  const battery = pick('battery');
  const comm = pick('communications');
  const computer = pick('computer');
  const storage = pick('storage');
  const attitude = pick('attitude');
  const propulsion = pick('propulsion');
  const thermal = pick('thermal');
  const launcher = launchers.find(l => l.id === design.launcherId) ?? launchers[0]!;
  const orbit = orbits.find(o => o.id === design.orbitId) ?? orbits[0]!;

  const massStatus = worst(ratioStatus(r.launchCapacityKg, r.massKg, 1.08), ratioStatus(r.structureCapacityKg, r.massKg, 1.08));
  const powerStatus = ratioStatus(r.averageGenerationW, r.consumptionW, 1.15);
  const batteryStatus = ratioStatus(r.batteryWh, r.eclipseNeedWh, 1.2);
  const dataStatus = r.generatedGBPerDay === 0 ? 'ok' : ratioStatus(r.downlinkGBPerDay, r.generatedGBPerDay, 1.2);
  const storageStatus: PartStatus = r.storageMarginGB < 0 ? 'bad' : r.storageGB > 0 && r.storageMarginGB < r.storageGB * 0.1 ? 'warn' : 'ok';
  const propulsionStatus: PartStatus = r.deltaV < orbit.deltaV ? 'bad' : r.deltaV < orbit.deltaV * 1.2 ? 'warn' : 'ok';
  const launcherStatus: PartStatus = !launcher.orbitIds.includes(orbit.id) ? 'bad' : ratioStatus(r.launchCapacityKg, r.massKg, 1.08);

  // Bus grows with the payload it carries so heavy designs *look* heavy.
  const advancedBus = structure?.tier === 'advanced';
  const scale = Math.min(1.9, 0.75 + Math.cbrt(Math.max(1, r.massKg)) / 9);
  const bus: ShipSpec['bus'] = { size: [ (advancedBus ? 1.5 : 1) * scale, (advancedBus ? 1.7 : 1.1) * scale, (advancedBus ? 1.4 : 1) * scale ], advanced: advancedBus, status: massStatus };

  const commKind = comm ? (comm.id.split('-')[1] as AntennaKind) : null;
  const dishRadius: Record<AntennaKind, number> = { uhf: 0.18, s: 0.35, x: 0.55, ka: 0.62, optical: 0.22 };

  const payload = instruments.filter(i => design.instrumentIds.includes(i.id)).map(i => ({
    id: i.id,
    shape: instrumentShapes[i.id] ?? 'camera',
    size: Math.min(1.6, 0.35 + Math.cbrt(i.massKg) / 6),
    status: (i.orbitIds.includes(orbit.id) ? 'ok' : 'warn') as PartStatus,
  }));

  const launcherSize: Record<string, [number, number, number]> = { rideshare: [5.5, 0.55, 0], small: [7, 0.7, 0], medium: [10, 1, 2], heavy: [13, 1.25, 4] };
  const [height, width, boosters] = launcherSize[launcher.id] ?? [8, 0.8, 0];

  return {
    bus,
    solar: solar ? { wings: solar.tier === 'advanced' ? 4 : 2, span: solar.tier === 'advanced' ? 3.2 : 1.7, width: solar.tier === 'advanced' ? 1.1 : 0.8, advanced: solar.tier === 'advanced', status: powerStatus } : null,
    rtg: rtg ? { count: rtg.tier === 'advanced' ? 2 : 1, length: 1.1, status: powerStatus } : null,
    battery: battery ? { cells: battery.tier === 'advanced' ? 6 : 2, status: batteryStatus } : null,
    antenna: comm && commKind ? { kind: commKind, radius: dishRadius[commKind] * (comm.tier === 'advanced' ? 1.3 : 1), advanced: comm.tier === 'advanced', status: dataStatus } : null,
    computer: computer ? { advanced: computer.tier === 'advanced' } : null,
    storage: storage ? { advanced: storage.tier === 'advanced', status: storageStatus } : null,
    attitude: attitude ? { kind: attitude.id.split('-')[1] as AttitudeKind, advanced: attitude.tier === 'advanced' } : null,
    propulsion: propulsion ? { nozzle: propulsion.tier === 'advanced' ? 0.5 : 0.22, tanks: propulsion.tier === 'advanced' ? 2 : 1, status: propulsionStatus } : null,
    thermal: thermal ? { radiator: thermal.tier === 'advanced' ? 1.3 : 0.6, advanced: thermal.tier === 'advanced' } : null,
    instruments: payload,
    launcher: { id: launcher.id, height, width, boosters, status: launcherStatus },
    readiness: worst(massStatus, powerStatus, dataStatus, launcherStatus, propulsionStatus, r.totalCostM > r.budgetM && design.mode !== 'sandbox' ? 'bad' : 'ok'),
    resources: r,
  };
}

/** Normalised orbit drawing parameters. Distances are illustrative, never to scale. */
export interface OrbitShape { body: 'earth' | 'moon' | 'mars'; radius: number; eccentricity: number; inclination: number; speed: number; companion: null | 'moon' | 'earth' | 'sun-line' }
export const orbitShapes: Record<OrbitId, OrbitShape> = {
  leo:   { body: 'earth', radius: 1.35, eccentricity: 0,   inclination: 0.9,  speed: 1.0,  companion: null },
  sso:   { body: 'earth', radius: 1.45, eccentricity: 0,   inclination: 1.71, speed: 0.95, companion: null },
  meo:   { body: 'earth', radius: 2.3,  eccentricity: 0,   inclination: 0.96, speed: 0.45, companion: null },
  geo:   { body: 'earth', radius: 3.3,  eccentricity: 0,   inclination: 0,    speed: 0.25, companion: null },
  heo:   { body: 'earth', radius: 2.7,  eccentricity: 0.7, inclination: 1.1,  speed: 0.4,  companion: null },
  l2:    { body: 'earth', radius: 4.6,  eccentricity: 0,   inclination: 0.25, speed: 0.12, companion: 'sun-line' },
  lunar: { body: 'moon',  radius: 1.5,  eccentricity: 0.1, inclination: 1.4,  speed: 0.7,  companion: 'earth' },
  mars:  { body: 'mars',  radius: 1.6,  eccentricity: 0.15,inclination: 0.5,  speed: 0.6,  companion: null },
};

/** What is happening to the spacecraft on a given simulation day. */
export interface FlightState {
  phase: MissionPhase; day: number; lastDay: number; progress: number;
  health: number; battery: number; storage: number; transmitting: boolean; operating: boolean;
  launched: boolean; inserted: boolean;
  /** Active event visual (shown for a few days around the event day). */
  event: null | { type: EventType; choice: string | null; responded: boolean; age: number };
  /** Launch animation progress 0–1 during day 0 → first operations day. */
  ascent: number;
}

export const EVENT_VISIBLE_DAYS = 4;

export function flightStateAt(timeline: MissionTimeline, day: number, subDay = 0): FlightState {
  const rows = timeline.days;
  const lastDay = rows.at(-1)?.day ?? 0;
  const row = rows.filter(d => d.day <= day).at(-1) ?? rows[0];
  const r = timeline.resources;
  const inserted = timeline.phases.find(p => p.phase === 'insertion')?.success ?? false;
  const nearby = timeline.events
    .filter(e => e.day <= day && day - e.day < EVENT_VISIBLE_DAYS)
    .sort((a, b) => b.day - a.day)[0];
  const pending = timeline.events.find(e => e.day <= day && !e.responded);
  const active = pending ?? nearby;
  const phase: MissionPhase = day >= lastDay && lastDay > 0 ? 'end-of-life' : (row?.phase ?? 'launch');
  return {
    phase, day, lastDay,
    progress: lastDay > 0 ? Math.min(1, (day + subDay) / lastDay) : 0,
    health: row?.health ?? 0,
    battery: r.batteryWh > 0 ? Math.max(0, Math.min(1, (row?.batteryWh ?? r.batteryWh) / r.batteryWh)) : 0,
    storage: r.storageGB > 0 ? Math.max(0, Math.min(1, (row?.storedGB ?? 0) / r.storageGB)) : 0,
    transmitting: (row?.downlinkedGB ?? 0) > 0,
    operating: row?.operating ?? false,
    launched: timeline.launched,
    inserted,
    event: active ? { type: active.type, choice: active.responded ? active.selectedChoiceId : null, responded: active.responded, age: Math.max(0, day - active.day + subDay) } : null,
    ascent: Math.min(1, day === 0 ? subDay : 1),
  };
}
