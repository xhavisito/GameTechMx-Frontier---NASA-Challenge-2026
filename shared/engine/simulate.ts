import { groundStations, launchers, orbits, scenarios } from '../data/index.js';
import type { MissionDesign, MissionTimeline, TimelineDay } from '../types.js';
import { parseDesign } from './design.js';
import { generateEvents, seededRandom } from './events.js';
import { calculateResources, clamp, round } from './resources.js';
import { validateDesign } from './validate.js';

/** A deterministic educational lifecycle. Response effects occur at their event day only. */
export function simulateMission(input: MissionDesign, seed: string | number): MissionTimeline {
  const design = parseDesign(input);
  if (!design) throw new Error('Invalid mission design');
  const resources = calculateResources(design);
  const issues = validateDesign(design);
  const scenario = scenarios.find(x => x.id === design.scenarioId)!;
  const launcher = launchers.find(x => x.id === design.launcherId)!;
  const orbit = orbits.find(x => x.id === design.orbitId)!;
  const ground = groundStations.find(x => x.id === design.groundStationId)!;
  const events = generateEvents(design, seed);
  const launchRng = seededRandom(`${seed}:launch`);
  const dayRng = seededRandom(`${seed}:operations`);
  const sandbox = design.mode === 'sandbox';
  const physicalBlocker = issues.some(x => ['launch-mass', 'launcher-orbit', 'structure-mass'].includes(x.code) || x.code.startsWith('missing-'));
  const initialCost = resources.developmentCostM + resources.launchCostM + ground.setupCostM;
  const launchReliability = 1 - (1 - launcher.reliability) * ({ beginner: .25, intermediate: 1, expert: 1.5 }[design.difficulty]);
  const launched = !physicalBlocker && (sandbox || initialCost <= resources.budgetM) && launchRng() <= launchReliability;
  const inserted = launched && resources.deltaV >= orbit.deltaV;
  let health = inserted ? 1 : 0;
  let stored = 0, totalData = 0, totalScience = 0, lostData = 0, spent = initialCost;
  let completedDays = 0, scienceFactor = 1, powerFactor = 1, pausedUntil = 0;
  const applyEvents = (day: number) => {
    for (const event of events.filter(x => x.day === day)) {
      const selected = event.choices.find(x => x.id === event.selectedChoiceId)!;
      spent += selected.costM;
      health = clamp(health + selected.healthDelta);
      powerFactor *= selected.powerMultiplier;
      scienceFactor *= selected.scienceMultiplier;
      pausedUntil = Math.max(pausedUntil, day + selected.lostDays - 1);
    }
  };
  if (launched) applyEvents(0);
  const days: TimelineDay[] = [{ day: 0, phase: 'launch', health: round(health, 4), energyMarginW: round(resources.averageGenerationW-resources.consumptionW), batteryWh: resources.batteryWh, storedGB: 0, generatedGB: 0, downlinkedGB: 0, lostGB: 0, science: 0, cumulativeScience: 0, cumulativeDataGB: 0, spentM: round(spent), operating: false }];
  for (let day = 1; day <= design.durationDays && inserted && health > .05; day++) {
    applyEvents(day);
    spent += ground.operationsCostMPerDay;
    const decay = 1 - day / 365 * .025; // Annual array/battery loss: 2.5%, linear, educational.
    const generation = resources.averageGenerationW * powerFactor * decay;
    const battery = resources.batteryWh * powerFactor * decay;
    const powerRatio = resources.consumptionW ? clamp(generation/resources.consumptionW) : 0;
    const eclipseRatio = resources.eclipseNeedWh ? clamp(battery/resources.eclipseNeedWh) : 1;
    const budgetAvailable = sandbox || spent <= resources.budgetM;
    const safeMode = day <= pausedUntil;
    const powerAvailable = safeMode ? generation >= resources.safeModeW : powerRatio > .05;
    const orbitAlive = day <= orbit.decayDays || resources.deltaV >= orbit.deltaV * 2;
    if (!budgetAvailable || !orbitAlive) health = 0;
    if (!safeMode) health -= (1-powerRatio)*.012 + (1-eclipseRatio)*.008;
    const wear = (1-resources.reliability) * orbit.radiation * ({beginner:.00004, intermediate:.00008, expert:.00014}[design.difficulty]);
    health = clamp(health - wear);
    const operating = health > .05 && !safeMode && powerAvailable;
    const fraction = operating ? powerRatio * eclipseRatio * health : 0;
    const generated = resources.generatedGBPerDay * fraction;
    // 90–100% daily contact variation is seeded; missed contacts are visible in stored data.
    const downlinkCapacity = resources.downlinkGBPerDay * (.9 + dayRng()*.1) * (safeMode ? 0 : clamp(health * 1.1));
    const downlinked = Math.min(stored + generated, downlinkCapacity);
    const backlog = stored + generated - downlinked;
    const lost = Math.max(0, backlog - resources.storageGB);
    stored = Math.max(0, Math.min(resources.storageGB, backlog));
    totalData += downlinked;
    lostData += lost;
    // Science is credited only once telemetry reaches Earth, including previous backlog.
    const scientificDensity = resources.generatedGBPerDay ? resources.sciencePerDay/resources.generatedGBPerDay : 0;
    const science = downlinked * scientificDensity * scienceFactor;
    totalScience += science;
    if (health > .05) completedDays = day;
    days.push({ day, phase: day === 1 ? 'insertion' : 'operations', health: round(health,4), energyMarginW: round(generation-resources.consumptionW), batteryWh: round(battery), storedGB: round(stored), generatedGB: round(generated), downlinkedGB: round(downlinked), lostGB: round(lost), science: round(science), cumulativeScience: round(totalScience), cumulativeDataGB: round(totalData), spentM: round(spent), operating });
  }
  const requirementResults: MissionTimeline['requirementResults'] = [
    { id: 'orbit', label: { es: 'Órbita apropiada', en: 'Appropriate orbit' }, passed: inserted && scenario.validOrbitIds.includes(orbit.id), actual: inserted && scenario.validOrbitIds.includes(orbit.id) ? 1 : 0, required: 1 },
    { id: 'coverage', label: { es: 'Cobertura', en: 'Coverage' }, passed: inserted && resources.coverage >= scenario.minCoverage, actual: inserted ? resources.coverage : 0, required: scenario.minCoverage },
    { id: 'resolution', label: { es: 'Resolución científica', en: 'Science resolution' }, passed: resources.resolutionM <= scenario.maxResolutionM && totalScience > 0, actual: resources.resolutionM, required: scenario.maxResolutionM },
    { id: 'lifetime', label: { es: 'Vida útil', en: 'Mission lifetime' }, passed: completedDays >= scenario.minDurationDays, actual: completedDays, required: scenario.minDurationDays },
    { id: 'data', label: { es: 'Datos recibidos', en: 'Data received' }, passed: totalData >= scenario.minDataGB, actual: round(totalData), required: scenario.minDataGB },
    { id: 'science', label: { es: 'Ciencia útil', en: 'Useful science' }, passed: totalScience >= scenario.minDurationDays * 2, actual: round(totalScience), required: scenario.minDurationDays * 2 },
    { id: 'schedule', label: { es: 'Plazo de desarrollo', en: 'Development deadline' }, passed: design.developmentMonths <= scenario.maxDevelopmentMonths, actual: design.developmentMonths, required: scenario.maxDevelopmentMonths },
  ];
  const success = requirementResults.every(x => x.passed) && (sandbox || spent <= resources.budgetM);
  const finalRow = days[days.length-1]!;
  days.push({ ...finalRow, day: finalRow.day+1, phase: 'end-of-life', generatedGB: 0, downlinkedGB: 0, lostGB: 0, science: 0, operating: false });
  return {
    version: 1, design, seed: String(seed), resources, issues, events: events.filter(x => x.day === 0 ? launched : inserted && x.day <= completedDays), days,
    phases: [
      { phase: 'launch', day: 0, success: launched, description: launched ? {es:'El lanzador llevó la nave al espacio.',en:'The launcher delivered the spacecraft to space.'} : {es:'El lanzamiento falló por capacidad, presupuesto, subsistemas faltantes o riesgo del vehículo. Revisa los avisos.',en:'Launch failed due to capacity, budget, missing subsystems or vehicle risk. Review the issues.'} },
      { phase: 'insertion', day: 1, success: inserted, description: inserted ? {es:'La reserva de propulsión permitió la inserción.',en:'Propulsion reserve enabled orbit insertion.'} : {es:'No se alcanzó la órbita de operación.',en:'The operating orbit was not reached.'} },
      { phase: 'operations', day: 2, success: completedDays >= scenario.minDurationDays, description: {es:`La nave sobrevivió ${completedDays} días y entregó ${round(totalData)} GB.`,en:`The spacecraft survived ${completedDays} days and delivered ${round(totalData)} GB.`} },
      { phase: 'end-of-life', day: finalRow.day+1, success, description: {es:'Fin de vida simulado: pasivación y disposición planificada; el modelo no propaga una órbita real.',en:'Simulated end of life: passivation and planned disposal; this model does not propagate a real orbit.'} },
    ],
    launched, success, completedDays, totalDataGB: round(totalData), totalScience: round(totalScience), lostDataGB: round(lostData), finalHealth: round(health,4), finalCostM: round(spent), requirementResults,
  };
}
