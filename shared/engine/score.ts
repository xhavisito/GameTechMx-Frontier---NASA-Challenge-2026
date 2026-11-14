import type { MissionReport, MissionTimeline, Scenario, ScoreBreakdown } from '../types.js';
import { clamp, round } from './resources.js';

const text = (es: string, en: string) => ({ es, en });

/** Transparent 100-point rubric. Each category is independently capped. */
export function scoreMission(timeline: MissionTimeline, scenario: Scenario): ScoreBreakdown {
  const passed = timeline.requirementResults.filter(result => result.passed).length;
  const objective = round(40 * passed / Math.max(1, timeline.requirementResults.length));
  const scienceTarget = Math.max(1, scenario.minDurationDays * 2);
  const science = round(20 * clamp(timeline.totalScience / scienceTarget));
  const massMargin = clamp((timeline.resources.launchCapacityKg - timeline.resources.massKg) / Math.max(1, timeline.resources.launchCapacityKg));
  const budgetMargin = clamp(timeline.resources.budgetMarginM / Math.max(1, timeline.resources.budgetM * .2));
  const delivered = timeline.totalDataGB + timeline.lostDataGB;
  const dataEfficiency = delivered ? clamp(timeline.totalDataGB / delivered) : 0;
  const efficiency = round(15 * (massMargin * .25 + budgetMargin * .35 + dataEfficiency * .4));
  const answered = timeline.events.length ? timeline.events.filter(event => event.responded).length / timeline.events.length : 1;
  const robustness = round(15 * (clamp(timeline.finalHealth) * .55 + timeline.resources.reliability * .25 + answered * .2));
  const evidence = timeline.design.collaboration;
  const collaboration = timeline.design.mode === 'solo' || timeline.design.mode === 'sandbox'
    ? 10
    : round(10 * clamp(((evidence?.participants ?? 0) / 2) * .3 + (evidence?.roleBalance ?? 0) * .4 + clamp((evidence?.resolvedConflicts ?? 0) / 2) * .3));
  const total = round(objective + science + efficiency + robustness + collaboration);
  const grade: ScoreBreakdown['grade'] = total >= 90 ? 'S' : total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D';
  return {
    total, objective, science, efficiency, robustness, collaboration,
    max: { objective: 40, science: 20, efficiency: 15, robustness: 15, collaboration: 10 }, grade,
    explanations: [
      { category: 'objective', text: text(`${passed} de ${timeline.requirementResults.length} requisitos cumplidos.`, `${passed} of ${timeline.requirementResults.length} requirements met.`) },
      { category: 'science', text: text(`${timeline.totalScience} puntos científicos útiles enviados.`, `${timeline.totalScience} useful science points delivered.`) },
      { category: 'efficiency', text: text(`${round(dataEfficiency * 100)} % de los datos capturados llegó a Tierra.`, `${round(dataEfficiency * 100)}% of captured data reached Earth.`) },
      { category: 'robustness', text: text(`Salud final ${round(timeline.finalHealth * 100)} %; ${timeline.events.filter(event => event.responded).length} eventos respondidos.`, `Final health ${round(timeline.finalHealth * 100)}%; ${timeline.events.filter(event => event.responded).length} events answered.`) },
      { category: 'collaboration', text: text(evidence ? `${evidence.resolvedConflicts} conflictos resueltos con balance de roles.` : 'Misión individual: crédito completo por coordinación.', evidence ? `${evidence.resolvedConflicts} conflicts resolved with balanced role goals.` : 'Solo mission: full coordination credit.') },
    ],
  };
}

/** Causal, actionable debrief generated entirely from mission evidence. */
export function generateReport(timeline: MissionTimeline, score: ScoreBreakdown): MissionReport {
  const failures = timeline.requirementResults.filter(result => !result.passed).map(result => text(
    `${result.label.es}: se obtuvo ${result.actual}, frente a ${result.required}.`,
    `${result.label.en}: achieved ${result.actual}, against ${result.required}.`,
  ));
  if (!timeline.launched) failures.unshift(text('La nave no llegó al espacio: revisa masa, lanzador, presupuesto y subsistemas obligatorios.', 'The spacecraft did not reach space: review mass, launcher, budget and required subsystems.'));
  if (timeline.lostDataGB > 0) failures.push(text(`Se perdieron ${timeline.lostDataGB} GB porque el enlace y almacenamiento no absorbieron la producción.`, `${timeline.lostDataGB} GB were lost because the link and storage could not absorb production.`));
  const strengths = timeline.requirementResults.filter(result => result.passed).slice(0, 4).map(result => text(
    `${result.label.es} alcanzado con ${result.actual}.`, `${result.label.en} achieved with ${result.actual}.`,
  ));
  const suggestions = [];
  if (timeline.resources.powerRatio < 1.2) suggestions.push(text('Añade generación o reduce carga para reservar al menos 20 % de energía.', 'Add generation or reduce load to reserve at least 20% power margin.'));
  if (timeline.resources.dataRatio < 1) suggestions.push(text('Mejora la banda de comunicaciones o la red terrena para evitar acumulación de datos.', 'Upgrade the communications band or ground network to prevent data backlog.'));
  if (timeline.resources.budgetMarginM < 0) suggestions.push(text('Usa componentes simples, un lanzador menor o acorta operaciones para volver al presupuesto.', 'Use simpler components, a smaller launcher, or shorter operations to return to budget.'));
  if (timeline.resources.massKg > timeline.resources.launchCapacityKg * .85) suggestions.push(text('Conserva margen de masa para crecimiento e integración.', 'Preserve mass margin for design growth and integration.'));
  if (!suggestions.length) suggestions.push(text('Repite con la misma semilla y prueba una opción distinta ante cada evento.', 'Replay with the same seed and try a different response to each event.'));
  return {
    title: text(`Informe de ${timeline.design.name}`, `${timeline.design.name} mission report`),
    summary: timeline.success
      ? text(`La misión cumplió sus objetivos con ${score.total}/100 puntos. Sus márgenes determinaron cuánto resistió los eventos.`, `The mission met its objectives with ${score.total}/100 points. Its margins determined how well it survived events.`)
      : text(`La misión obtuvo ${score.total}/100. El informe relaciona cada resultado con el diseño para orientar el siguiente intento.`, `The mission scored ${score.total}/100. This report connects each outcome to the design to guide the next attempt.`),
    strengths, failures, suggestions, score, seed: timeline.seed, success: timeline.success,
  };
}
