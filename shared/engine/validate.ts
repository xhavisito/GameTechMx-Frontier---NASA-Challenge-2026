import { components, instruments, launchers, orbits, scenarios } from '../data/index.js';
import type { ComponentCategory, Issue, IssueSeverity, LocalizedText, MissionDesign } from '../types.js';
import { parseDesign } from './design.js';
import { calculateResources, round } from './resources.js';
const t = (es: string, en: string): LocalizedText => ({ es, en });

export function validateDesign(design: MissionDesign): Issue[] {
  const issues: Issue[] = [];
  const add = (code: string, severity: IssueSeverity, resource: Issue['resource'], message: LocalizedText, suggestion: LocalizedText) => issues.push({ code, severity, resource, message, suggestion });
  if (!parseDesign(design)) {
    add('invalid-design', 'error', 'science', t('El diseño contiene valores o identificadores inválidos.', 'The design contains invalid values or identifiers.'), t('Carga un diseño guardado válido o crea una misión nueva.', 'Load a valid saved design or create a new mission.'));
    return issues;
  }
  const r = calculateResources(design);
  const orbit = orbits.find(x => x.id === design.orbitId)!;
  const scenario = scenarios.find(x => x.id === design.scenarioId)!;
  const launcher = launchers.find(x => x.id === design.launcherId)!;
  const selected = components.filter(x => design.componentIds.includes(x.id));
  for (const category of ['structure', 'battery', 'communications', 'computer', 'storage', 'attitude', 'propulsion', 'thermal'] as ComponentCategory[]) {
    if (!selected.some(x => x.category === category)) add(`missing-${category}`, 'error', 'reliability', t(`Falta el subsistema: ${category}.`, `Missing subsystem: ${category}.`), t('Añade una opción de cada subsistema esencial.', 'Add one option for each essential subsystem.'));
  }
  if (!selected.some(x => x.category === 'solar' || x.category === 'rtg')) add('missing-generation', 'error', 'power', t('La nave no tiene una fuente de energía.', 'The spacecraft has no power source.'), t('Añade paneles solares o un RTG.', 'Add solar panels or an RTG.'));
  if (!scenario.validOrbitIds.includes(orbit.id)) add('scenario-orbit', 'error', 'orbit', t('Esta órbita no cumple el objetivo del escenario.', 'This orbit does not meet the scenario objective.'), t('Elige una órbita permitida en el briefing.', 'Choose an orbit allowed in the briefing.'));
  if (!launcher.orbitIds.includes(orbit.id) || r.launchCapacityKg === 0) add('launcher-orbit', 'error', 'mass', t('El lanzador no puede alcanzar este destino.', 'The launcher cannot reach this destination.'), t('Selecciona un lanzador con capacidad para este destino.', 'Select a launcher with capacity to this destination.'));
  if (r.massKg > r.launchCapacityKg) add('launch-mass', 'error', 'mass', t(`La nave pesa ${r.massKg} kg y la capacidad es ${r.launchCapacityKg} kg.`, `The spacecraft weighs ${r.massKg} kg; launch capacity is ${r.launchCapacityKg} kg.`), t('Reduce instrumentos o usa un lanzador de mayor capacidad.', 'Remove instruments or use a launcher with greater capacity.'));
  else if (r.massKg > r.launchCapacityKg * .85) add('mass-margin', 'warning', 'mass', t('Queda menos de 15 % de margen de masa.', 'Less than 15% mass margin remains.'), t('Deja margen para el crecimiento del diseño.', 'Leave margin for design growth.'));
  if (r.massKg > r.structureCapacityKg) add('structure-mass', 'error', 'mass', t(`La estructura admite ${r.structureCapacityKg} kg, pero la nave pesa ${r.massKg} kg.`, `The structure supports ${r.structureCapacityKg} kg, but the spacecraft weighs ${r.massKg} kg.`), t('Mejora la estructura o aligera la carga útil.', 'Upgrade the structure or reduce the payload.'));
  if (r.averageGenerationW < r.consumptionW) add('power-deficit', 'error', 'power', t(`Generas ${r.averageGenerationW} W medios y consumes ${r.consumptionW} W.`, `Average generation is ${r.averageGenerationW} W; consumption is ${r.consumptionW} W.`), t('Mejora la generación o reduce instrumentos; la batería no corrige un déficit continuo.', 'Upgrade generation or remove instruments; batteries cannot fix a continuous deficit.'));
  else if (r.powerRatio < 1.2) add('power-margin', 'warning', 'power', t('El margen energético es menor al 20 %.', 'Power margin is below 20%.'), t('Añade capacidad para tolerar degradación y eventos.', 'Add capacity to tolerate degradation and events.'));
  if (r.batteryWh < r.eclipseNeedWh) add('eclipse-battery', 'error', 'power', t(`El eclipse requiere ${r.eclipseNeedWh} Wh y la batería guarda ${r.batteryWh} Wh.`, `Eclipses require ${r.eclipseNeedWh} Wh; the battery stores ${r.batteryWh} Wh.`), t('Mejora la batería o reduce el consumo.', 'Upgrade the battery or reduce consumption.'));
  if (r.totalCostM > r.budgetM) add('budget-exceeded', 'error', 'budget', t(`El coste previsto es $${r.totalCostM} M frente a $${r.budgetM} M disponibles.`, `Forecast cost is $${r.totalCostM}M against $${r.budgetM}M available.`), t('Equilibra desarrollo, lanzamiento y operaciones; reduce componentes o duración.', 'Balance development, launch and operations; reduce components or duration.'));
  else if (r.budgetMarginM < r.budgetM * .1) add('budget-margin', 'warning', 'budget', t('La reserva presupuestaria es menor al 10 %.', 'Budget reserve is below 10%.'), t('Reserva fondos para contingencias de la misión.', 'Reserve funds for mission contingencies.'));
  if (r.generatedGBPerDay > r.downlinkGBPerDay) {
    const lost = round((1-r.downlinkGBPerDay/r.generatedGBPerDay)*100, 1);
    add('data-bottleneck', 'warning', 'data', t(`Generas ${r.generatedGBPerDay} GB/día y descargas ${r.downlinkGBPerDay} GB/día: ${lost} % se acumula cada día.`, `You generate ${r.generatedGBPerDay} GB/day but downlink ${r.downlinkGBPerDay} GB/day: ${lost}% accumulates each day.`), t('Mejora la banda de comunicaciones o amplía la red de estaciones; el almacenamiento solo aplaza la pérdida.', 'Upgrade communications or expand the ground network; storage only postpones data loss.'));
  }
  if (r.storageMarginGB < 0) add('storage-overflow', 'error', 'storage', t(`La acumulación excederá la memoria en ${round(r.storageGB / Math.max(0.001, r.generatedGBPerDay-r.downlinkGBPerDay), 1)} días.`, `Backlog will fill storage in ${round(r.storageGB / Math.max(0.001, r.generatedGBPerDay-r.downlinkGBPerDay), 1)} days.`), t('Aumenta el enlace de descarga antes de añadir más memoria.', 'Increase downlink capacity before adding more storage.'));
  if (design.durationDays < scenario.minDurationDays) add('short-lifetime', 'error', 'time', t(`El objetivo requiere al menos ${scenario.minDurationDays} días de operaciones.`, `The objective requires at least ${scenario.minDurationDays} operating days.`), t('Aumenta la vida útil prevista.', 'Increase planned lifetime.'));
  if (design.developmentMonths > scenario.maxDevelopmentMonths) add('late-development', 'error', 'time', t('El desarrollo excede el plazo del escenario.', 'Development exceeds the scenario deadline.'), t('Reduce el calendario de desarrollo; comprueba el coste de acelerar.', 'Shorten development; check the cost of rushing.'));
  if (design.developmentMonths < 12) add('rushed-development', 'warning', 'time', t('Acelerar el desarrollo aumenta costes y reduce fiabilidad.', 'Rushed development increases cost and reduces reliability.'), t('Considera al menos 12 meses de integración y pruebas.', 'Consider at least 12 months for integration and testing.'));
  if (design.durationDays > orbit.decayDays && r.deltaV < orbit.deltaV * 2) add('orbit-decay', 'warning', 'orbit', t('La vida útil supera la estimación de decaimiento orbital.', 'Lifetime exceeds the estimated orbit decay time.'), t('Aumenta la reserva de propulsión para mantener la órbita.', 'Increase propulsion reserve for orbit maintenance.'));
  if (r.deltaV < orbit.deltaV) add('propulsion-reserve', 'error', 'orbit', t(`Se necesitan ${orbit.deltaV} m/s de reserva y hay ${r.deltaV} m/s.`, `${orbit.deltaV} m/s of maneuver reserve is required; ${r.deltaV} m/s is available.`), t('Mejora la propulsión para inserción y correcciones.', 'Upgrade propulsion for insertion and corrections.'));
  if (!design.instrumentIds.length) add('no-instruments', 'error', 'science', t('No hay instrumentos seleccionados.', 'No instruments are selected.'), t('Añade una carga útil que responda al objetivo.', 'Add a payload that serves the objective.'));
  if (r.sciencePerDay === 0) add('no-relevant-science', 'error', 'science', t('La carga útil no produce ciencia útil para este objetivo.', 'The payload produces no useful science for this objective.'), t('Elige instrumentos compatibles y revisa apuntamiento y temperatura.', 'Choose compatible instruments and check pointing and temperature.'));
  if (r.coverage < scenario.minCoverage) add('coverage', 'error', 'orbit', t('La cobertura de la órbita es insuficiente.', 'Orbit coverage is insufficient.'), t('Selecciona una órbita con mayor cobertura para este objetivo.', 'Select an orbit with more coverage for this objective.'));
  if (r.resolutionM > scenario.maxResolutionM) add('resolution', 'error', 'science', t(`La resolución es ${r.resolutionM} m; se requieren ${scenario.maxResolutionM} m o menos.`, `Resolution is ${r.resolutionM} m; ${scenario.maxResolutionM} m or better is required.`), t('Selecciona un instrumento de mayor resolución apropiado para el objetivo.', 'Select a higher-resolution instrument suitable for the objective.'));
  for (const inst of instruments.filter(x => design.instrumentIds.includes(x.id))) {
    if (!inst.orbitIds.includes(orbit.id)) add(`instrument-orbit-${inst.id}`, 'error', 'science', t(`${inst.name.es} no opera en esta órbita.`, `${inst.name.en} cannot operate in this orbit.`), t('Cambia de órbita o de instrumento.', 'Change orbit or instrument.'));
    if (inst.pointing > r.pointing) add(`pointing-${inst.id}`, 'error', 'science', t(`${inst.name.es} necesita apuntamiento nivel ${inst.pointing}.`, `${inst.name.en} needs pointing level ${inst.pointing}.`), t('Mejora el control de actitud.', 'Upgrade attitude control.'));
    if (inst.thermal > r.thermal) add(`thermal-${inst.id}`, 'error', 'science', t(`${inst.name.es} necesita control térmico nivel ${inst.thermal}.`, `${inst.name.en} needs thermal control level ${inst.thermal}.`), t('Mejora el subsistema térmico.', 'Upgrade the thermal subsystem.'));
  }
  if (r.reliability < .8) add('low-reliability', 'warning', 'reliability', t('La fiabilidad conjunta estimada es menor al 80 %.', 'Estimated combined reliability is below 80%.'), t('Mejora subsistemas críticos o aumenta el tiempo de pruebas.', 'Upgrade critical subsystems or allow more testing time.'));
  return issues;
}
