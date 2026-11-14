import { components, groundStations, instruments, launchers, orbits, scenarios } from '../data/index.js';
import type { MissionDesign, ResourceBudget } from '../types.js';

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
export const budgetMultiplier = { beginner: 1.25, intermediate: 1, expert: 0.85 } as const;

/** Resource ledger. See docs/GAME_DESIGN.md for the deliberately simplified equations. */
export function calculateResources(design: MissionDesign): ResourceBudget {
  const scenario = scenarios.find(x => x.id === design.scenarioId) ?? scenarios[0]!;
  const orbit = orbits.find(x => x.id === design.orbitId) ?? orbits[0]!;
  const launcher = launchers.find(x => x.id === design.launcherId) ?? launchers[0]!;
  const ground = groundStations.find(x => x.id === design.groundStationId) ?? groundStations[0]!;
  const selected = components.filter(x => design.componentIds.includes(x.id));
  const payload = instruments.filter(x => design.instrumentIds.includes(x.id));
  const sum = (key: 'massKg' | 'powerW' | 'costM') => [...selected, ...payload].reduce((a, x) => a + x[key], 0);
  const solarW = selected.filter(x => x.category === 'solar').reduce((a, x) => a + (x.generationW ?? 0), 0) * orbit.solarFactor;
  const rtgW = selected.filter(x => x.category === 'rtg').reduce((a, x) => a + (x.generationW ?? 0), 0);
  const generationW = solarW + rtgW;
  const averageGenerationW = solarW * (1 - orbit.eclipseFraction) + rtgW;
  const consumptionW = sum('powerW');
  const safeModeW = selected.reduce((a, x) => a + x.powerW, 0) * 0.6;
  const batteryWh = selected.reduce((a, x) => a + (x.batteryWh ?? 0), 0);
  const eclipseHours = Math.min(4, orbit.periodHours * orbit.eclipseFraction);
  const eclipseNeedWh = Math.max(0, consumptionW - rtgW) * eclipseHours;
  const linkMbps = selected.reduce((a, x) => a + (x.linkMbps ?? 0), 0) * orbit.linkFactor;
  const contactMinutesPerDay = Math.min(1440, orbit.contactMinutesPerDay * ground.contactMultiplier);
  // Decimal GB; Mbps × seconds ÷ 8,000. 65% allows framing, acquisition and weather losses.
  const downlinkGBPerDay = linkMbps * contactMinutesPerDay * 60 / 8000 * 0.65;
  const generatedGBPerDay = payload.reduce((a, x) => a + x.dataGBPerDay, 0);
  const storageGB = selected.reduce((a, x) => a + (x.storageGB ?? 0), 0);
  // Rush development increases integration cost; longer projects modestly improve reliability.
  const rush = Math.max(0, 12 - design.developmentMonths);
  const developmentCostM = sum('costM') * (1.2 + rush * 0.025);
  const operationsCostM = ground.setupCostM + ground.operationsCostMPerDay * design.durationDays;
  const totalCostM = developmentCostM + launcher.costM + operationsCostM;
  const budgetM = scenario.budgetM * budgetMultiplier[design.difficulty];
  const reliability = clamp(selected.reduce((a, x) => a * x.reliability, 1) * (1 - rush * 0.006), 0.1, 0.999);
  const pointing = Math.max(0, ...selected.map(x => x.pointing ?? 0));
  const thermal = Math.max(0, ...selected.map(x => x.thermal ?? 0));
  const relevant = payload.filter(x => (x.science[scenario.objective] ?? 0) > 0);
  const sciencePerDay = relevant.reduce((a, x) => a + (x.science[scenario.objective] ?? 0) *
    (x.orbitIds.includes(orbit.id) ? 1 : 0) * Math.min(1, pointing / x.pointing) * Math.min(1, thermal / x.thermal), 0);
  return {
    massKg: round(sum('massKg')), launchCapacityKg: launcher.capacityKg[orbit.destination] ?? 0,
    structureCapacityKg: selected.find(x => x.category === 'structure')?.capacityKg ?? 0,
    generationW: round(generationW), averageGenerationW: round(averageGenerationW), consumptionW: round(consumptionW), safeModeW: round(safeModeW),
    eclipseHours: round(eclipseHours), eclipseNeedWh: round(eclipseNeedWh), batteryWh,
    developmentCostM: round(developmentCostM), launchCostM: launcher.costM, operationsCostM: round(operationsCostM),
    totalCostM: round(totalCostM), budgetM: round(budgetM), budgetMarginM: round(budgetM - totalCostM),
    generatedGBPerDay, downlinkGBPerDay: round(downlinkGBPerDay), storageGB,
    storageMarginGB: round(storageGB - Math.max(0, generatedGBPerDay - downlinkGBPerDay) * design.durationDays),
    contactMinutesPerDay: round(contactMinutesPerDay), linkMbps: round(linkMbps),
    developmentMonths: design.developmentMonths, durationDays: design.durationDays, reliability: round(reliability, 4),
    coverage: orbit.coverage, resolutionM: relevant.length ? Math.min(...relevant.map(x => x.resolutionM)) : 1e9,
    sciencePerDay: round(sciencePerDay), deltaV: selected.reduce((a, x) => a + (x.deltaV ?? 0), 0), pointing, thermal,
    powerRatio: consumptionW ? round(averageGenerationW / consumptionW, 3) : 0,
    dataRatio: generatedGBPerDay ? round(downlinkGBPerDay / generatedGBPerDay, 3) : 0,
  };
}
