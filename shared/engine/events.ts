import type { EventChoice, EventType, LocalizedText, MissionDesign, MissionEvent } from '../types.js';
const text = (es: string, en: string): LocalizedText => ({ es, en });
/** FNV-1a seed hash plus Mulberry32; RNG is local to each call, never ambient Math.random(). */
export function seededRandom(seed: string | number): () => number {
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const choice = (id: string, label: LocalizedText, description: LocalizedText, costM: number, lostDays: number, healthDelta: number, powerMultiplier = 1, scienceMultiplier = 1): EventChoice => ({ id, label, description, costM, lostDays, healthDelta, powerMultiplier, scienceMultiplier });
export const eventCatalog: { type: EventType; title: LocalizedText; description: LocalizedText; choices: EventChoice[] }[] = [
  { type: 'solar-storm', title: text('Tormenta solar', 'Solar storm'), description: text('Las partículas energéticas amenazan la electrónica. Proteger la nave interrumpe la ciencia.', 'Energetic particles threaten the electronics. Protecting the spacecraft interrupts science.'), choices: [
    choice('protect', text('Entrar en modo seguro', 'Enter safe mode'), text('Pierdes 2 días de datos; daño mínimo a la electrónica.', 'Lose 2 days of data; minimal electronics damage.'), .1, 2, -.01),
    choice('continue', text('Continuar observaciones', 'Continue observations'), text('Sin pausa; la radiación reduce la salud de la nave en 16 puntos.', 'No pause; radiation reduces spacecraft health by 16 points.'), 0, 0, -.16),
  ] },
  { type: 'wheel-failure', title: text('Fallo de rueda de reacción', 'Reaction wheel failure'), description: text('El control de actitud pierde precisión. Puedes recalibrar con redundancia o aceptar menos ciencia.', 'Attitude control loses precision. Recalibrate with redundancy or accept reduced science.'), choices: [
    choice('repair', text('Reconfigurar control', 'Reconfigure control'), text('Cuesta $0.8 M y 3 días; recuperas la precisión.', 'Costs $0.8M and 3 days; restores precision.'), .8, 3, -.02),
    choice('continue', text('Usar modo degradado', 'Use degraded mode'), text('La producción científica futura baja un 35 %.', 'Future science production falls by 35%.'), 0, 0, -.08, 1, .65),
  ] },
  { type: 'budget-cut', title: text('Recorte de presupuesto', 'Budget reduction'), description: text('Un cambio de financiación consume reservas. La misión debe adaptar las operaciones.', 'A funding change consumes reserves. The mission must adapt operations.'), choices: [
    choice('protect', text('Reducir campaña', 'Reduce campaign'), text('Pausa de 4 días; reasignar personal cuesta $0.2 M.', 'Pause for 4 days; staff reassignment costs $0.2M.'), .2, 4, 0),
    choice('continue', text('Usar contingencia', 'Use contingency'), text('Mantienes la campaña usando $3 M de reserva.', 'Keep the campaign by spending $3M of reserve.'), 3, 0, 0),
  ] },
  { type: 'launch-delay', title: text('Retraso de lanzamiento', 'Launch delay'), description: text('Una revisión del vehículo retrasa el calendario y obliga a financiar almacenamiento.', 'A vehicle review delays the schedule and requires storage funding.'), choices: [
    choice('protect', text('Esperar nueva ventana', 'Wait for next window'), text('Cuesta $0.3 M y 5 días de la campaña.', 'Costs $0.3M and 5 days of the campaign.'), .3, 5, 0),
    choice('continue', text('Comprar prioridad', 'Buy priority slot'), text('Cuesta $2 M; preservas la campaña completa.', 'Costs $2M; preserves the full campaign.'), 2, 0, 0),
  ] },
  { type: 'debris', title: text('Alerta de conjunción', 'Conjunction alert'), description: text('Un objeto pasa cerca. Una maniobra preventiva consume reserva y tiempo de observación.', 'An object passes nearby. A preventive maneuver consumes reserve and observing time.'), choices: [
    choice('protect', text('Maniobra evasiva', 'Avoidance maneuver'), text('Cuesta $0.15 M y un día; protege la nave.', 'Costs $0.15M and one day; protects the spacecraft.'), .15, 1, -.005),
    choice('continue', text('Mantener trayectoria', 'Keep trajectory'), text('Un impacto menor reduce la salud en 20 puntos.', 'A minor impact reduces health by 20 points.'), 0, 0, -.2),
  ] },
  { type: 'battery-degradation', title: text('Degradación de baterías', 'Battery degradation'), description: text('La capacidad de almacenamiento energético se degrada antes de lo previsto.', 'Energy storage capacity degrades earlier than expected.'), choices: [
    choice('protect', text('Recalibrar y reducir carga', 'Recalibrate and reduce load'), text('Cuesta $0.4 M y 2 días; conserva capacidad con 5 % menos ciencia.', 'Costs $0.4M and 2 days; preserves capacity with 5% less science.'), .4, 2, -.01, .98, .95),
    choice('continue', text('Continuar a plena carga', 'Continue at full load'), text('La capacidad útil y la generación bajan un 25 %.', 'Usable capacity and generation fall by 25%.'), 0, 0, -.05, .75),
  ] },
];

export function generateEvents(design: MissionDesign, seed: string | number): MissionEvent[] {
  const rng = seededRandom(`${seed}:events`);
  const probability = { beginner: .4, intermediate: .62, expert: .82 }[design.difficulty];
  const events: MissionEvent[] = [];
  for (const [index, template] of eventCatalog.entries()) {
    const roll = rng();
    const fraction = .12 + index * .12 + rng() * .08;
    if (roll > probability && index !== 0) continue;
    const day = template.type === 'launch-delay' ? 0 : Math.min(design.durationDays - 1, Math.max(2, Math.round(fraction * design.durationDays)));
    const id = `${template.type}-${day}`;
    const selectedChoice = template.choices.find(x => x.id === design.responses[id]);
    const picked = selectedChoice ?? template.choices.find(x => x.id === 'continue')!;
    events.push({ ...template, choices: template.choices.map(x => ({ ...x })), id, day, selectedChoiceId: picked.id, responded: !!selectedChoice, consequence: picked.description });
  }
  return events.sort((a,b) => a.day-b.day || a.id.localeCompare(b.id));
}
