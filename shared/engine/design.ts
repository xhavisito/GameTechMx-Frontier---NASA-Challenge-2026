import { components, groundStations, instruments, launchers, orbits, scenarios } from '../data/index.js';
import type { ComponentCategory, Difficulty, GameMode, MissionDesign } from '../types.js';

const validString = (x: unknown, max = 80): x is string => typeof x === 'string' && x.length <= max;
const finiteRange = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Strict, bounded parser at save/link/network boundaries; never blindly casts JSON. */
export function parseDesign(value: unknown): MissionDesign | null {
  try {
    const d: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    if (!isRecord(d) || d.version !== 1 || !validString(d.name) || !d.name.trim()) return null;
    if (!scenarios.some(x => x.id === d.scenarioId) || !orbits.some(x => x.id === d.orbitId) || !launchers.some(x => x.id === d.launcherId) || !groundStations.some(x => x.id === d.groundStationId)) return null;
    if (!['beginner', 'intermediate', 'expert'].includes(String(d.difficulty)) || !['solo', 'local', 'online', 'sandbox'].includes(String(d.mode))) return null;
    if (!finiteRange(d.durationDays, 7, 1095) || !Number.isInteger(d.durationDays) || !finiteRange(d.developmentMonths, 3, 60) || !Number.isInteger(d.developmentMonths)) return null;
    if (!Array.isArray(d.instrumentIds) || d.instrumentIds.length > 12 || !d.instrumentIds.every(id => instruments.some(x => x.id === id)) || new Set(d.instrumentIds).size !== d.instrumentIds.length) return null;
    if (!Array.isArray(d.componentIds) || d.componentIds.length > 10 || !d.componentIds.every(id => components.some(x => x.id === id)) || new Set(d.componentIds).size !== d.componentIds.length) return null;
    const selected = components.filter(x => (d.componentIds as string[]).includes(x.id));
    if (new Set(selected.map(x => x.category)).size !== selected.length) return null;
    if (!isRecord(d.responses) || Object.keys(d.responses).length > 20 || Object.entries(d.responses).some(([k,v]) => !/^[a-z0-9-]{1,60}$/.test(k) || !validString(v, 30))) return null;
    let collaboration: MissionDesign['collaboration'];
    if (d.collaboration !== undefined) {
      const c = d.collaboration;
      if (!isRecord(c) || !finiteRange(c.participants, 1, 4) || !Number.isInteger(c.participants) || !finiteRange(c.proposals, 0, 1000) || !Number.isInteger(c.proposals) || !finiteRange(c.resolvedConflicts, 0, 1000) || !Number.isInteger(c.resolvedConflicts) || !finiteRange(c.approvedChanges, 0, 1000) || !Number.isInteger(c.approvedChanges) || !finiteRange(c.roleBalance, 0, 1)) return null;
      collaboration = { participants: c.participants, proposals: c.proposals, resolvedConflicts: c.resolvedConflicts, approvedChanges: c.approvedChanges, roleBalance: c.roleBalance };
    }
    return { version: 1, name: d.name.trim(), scenarioId: String(d.scenarioId), orbitId: d.orbitId as MissionDesign['orbitId'], launcherId: String(d.launcherId), instrumentIds: [...d.instrumentIds] as string[], componentIds: [...d.componentIds] as string[], groundStationId: String(d.groundStationId), durationDays: d.durationDays, developmentMonths: d.developmentMonths, difficulty: d.difficulty as Difficulty, mode: d.mode as GameMode, responses: { ...d.responses } as Record<string, string>, ...(collaboration ? { collaboration } : {}) };
  } catch { return null; }
}

/** An achievable starting mission; players can explore genuine tradeoffs from here. */
export function createDefaultDesign(scenarioId = 'cubesat', difficulty: Difficulty = 'beginner', mode: GameMode = 'solo'): MissionDesign {
  const scenario = scenarios.find(x => x.id === scenarioId) ?? scenarios.find(x => x.id === 'cubesat') ?? scenarios[0]!;
  const orbitId = (scenario.validOrbitIds.find(id => (orbits.find(orbit => orbit.id === id)?.coverage ?? 0) >= scenario.minCoverage) ?? scenario.validOrbitIds[0])!;
  const orbit = orbits.find(x => x.id === orbitId)!;
  const payload = instruments.filter(item => scenario.recommendedInstrumentIds.includes(item.id));
  const requiredPointing = Math.max(0, ...payload.map(item => item.pointing));
  const requiredThermal = Math.max(0, ...payload.map(item => item.thermal));
  const deep = orbit.linkFactor < .3;
  const desired: Partial<Record<ComponentCategory, string>> = {
    structure: 'structure-advanced', solar: 'solar-advanced', battery: 'battery-advanced',
    communications: deep ? 'comm-ka-advanced' : 'comm-x-basic', computer: 'computer-advanced',
    storage: 'storage-advanced', attitude: 'attitude-wheels-advanced', propulsion: deep ? 'propulsion-advanced' : 'propulsion-basic', thermal: 'thermal-advanced',
  };
  const componentIds = Object.entries(desired).map(([category,id]) => (components.find(x => x.id === id) ?? components.find(x => x.category === category && x.tier === 'advanced') ?? components.find(x => x.category === category))!.id);
  // Educational CubeSat starter uses the smaller bus; larger objectives need advanced support.
  if (scenario.objective === 'education') {
    for (const category of ['structure', 'solar', 'battery', 'computer', 'storage', 'attitude', 'propulsion', 'thermal'] as ComponentCategory[]) {
      const at = componentIds.findIndex(id => components.find(x => x.id === id)?.category === category);
      const simple = components.find(x => x.category === category && x.tier === 'simple' && (category !== 'attitude' || (x.pointing ?? 0) >= 1));
      if (simple && at >= 0) componentIds[at] = simple.id;
    }
  }
  const replaceCategory = (category: ComponentCategory, predicate: (component: typeof components[number]) => boolean) => {
    const replacement = components.filter(component => component.category === category && predicate(component)).sort((a,b) => a.costM-b.costM)[0];
    const index = componentIds.findIndex(id => components.find(component => component.id === id)?.category === category);
    if (replacement && index >= 0) componentIds[index] = replacement.id;
  };
  replaceCategory('attitude', component => (component.pointing ?? 0) >= requiredPointing);
  replaceCategory('thermal', component => (component.thermal ?? 0) >= requiredThermal);
  replaceCategory('propulsion', component => (component.deltaV ?? 0) >= orbit.deltaV);
  const mass = componentIds.reduce((a,id) => a + components.find(x => x.id === id)!.massKg, 0) + scenario.recommendedInstrumentIds.reduce((a,id) => a + (instruments.find(x => x.id === id)?.massKg ?? 0), 0);
  const launcher = [...launchers].filter(x => x.orbitIds.includes(orbitId) && (x.capacityKg[orbit.destination] ?? 0) >= mass).sort((a,b) => a.costM - b.costM)[0] ?? launchers[0]!;
  return { version: 1, name: `Frontier ${scenario.id.toUpperCase()}`, scenarioId: scenario.id, orbitId, launcherId: launcher.id, instrumentIds: [...scenario.recommendedInstrumentIds], componentIds, groundStationId: deep ? (groundStations[1]?.id ?? groundStations[0]!.id) : groundStations[0]!.id, durationDays: scenario.minDurationDays, developmentMonths: Math.min(18, scenario.maxDevelopmentMonths), difficulty, mode, responses: {} };
}
