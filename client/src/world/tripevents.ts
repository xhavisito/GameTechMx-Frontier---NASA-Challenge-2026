import type { Dest, Effects } from './design';
import type { Level } from './levels';
import { LEVELS } from './levels';
import { modById } from './runstate';

/** What a choice does: this mission's start (hull, energy, time), instant scrap, and an effect that lasts several missions. */
export interface Out { fx?: Effects; scrap?: number; mod?: string }
export interface TOption { es: string; en: string; out: Out; gamble?: { p: number; win: Out; lose: Out } }
export interface TEvent { id: string; icon: string; es: string; en: string; dests?: Dest[]; min?: Level; options: TOption[] }

const O = (es: string, en: string, out: Out): TOption => ({ es, en, out });
const G = (es: string, en: string, p: number, win: Out, lose: Out): TOption => ({ es, en, out: win, gamble: { p, win, lose } });

export const TRIP_EVENTS: TEvent[] = [
  { id: 'storm', icon: '☀️', es: 'Tormenta solar: llegan partículas de alta energía.', en: 'Solar storm: high-energy particles are arriving.', min: 'hard', options: [
    O('Modo seguro: apagar sistemas un rato', 'Safe mode: shut systems down for a while', { fx: { time: -30 } }),
    O('Seguir con todo encendido', 'Keep everything on', { fx: { health: -22 } }),
    G('Subir los paneles y aprovechar la energía', 'Raise the panels and harvest the energy', 0.5, { fx: { energy: 0.15 }, mod: 'cold_cells' }, { fx: { health: -18 }, mod: 'weak_cells' })] },
  { id: 'dust', icon: '☄️', es: 'Micrometeoroides: una nube de polvo cruza tu ruta.', en: 'Micrometeoroids: a dust cloud crosses your path.', options: [
    O('Girar la nave y proteger los paneles', 'Turn the ship and shield the panels', { fx: { energy: -0.2 } }),
    O('Aceptar el riesgo', 'Accept the risk', { fx: { health: -15 } }),
    O('Cruzar por el centro, rápido', 'Cut straight through, fast', { fx: { health: -10 }, mod: 'rattle' })] },
  { id: 'burn', icon: '🔥', es: 'Corrección de rumbo: te desvías de la trayectoria.', en: 'Course correction: you drift off the planned path.', min: 'hard', options: [
    O('Corregir con el motor (gasta combustible)', 'Correct with the engine (uses fuel)', { fx: { energy: -0.1 } }),
    O('Dejarlo así', 'Leave it', { fx: { time: -45, health: -8 } }),
    O('Pedir ayuda a la base', 'Ask the base for help', { fx: { time: -15 }, mod: 'calibrated' })] },
  { id: 'bitflip', icon: '💾', es: 'Un rayo cósmico cambia un bit en la computadora de a bordo.', en: 'A cosmic ray flips a bit in the onboard computer.', options: [
    O('Reiniciar la computadora', 'Reboot the computer', { fx: { energy: -0.1 } }),
    O('Ignorarlo y seguir', 'Ignore it and carry on', { mod: 'dusty_lens' }),
    G('Parchear el código en vuelo', 'Patch the code in flight', 0.6, { mod: 'calibrated' }, { fx: { energy: -0.15 }, mod: 'dusty_lens' })] },
  { id: 'stowaway', icon: '🐭', es: 'Encuentras un ratoncito polizón de la base escondido en la carga.', en: 'You find a little stowaway mouse from the base hidden in the cargo.', options: [
    O('Adoptarlo como mascota de la tripulación', 'Adopt it as the crew mascot', { mod: 'calm_crew' }),
    O('Soltarlo en la siguiente base', 'Release it at the next base', { scrap: 8 }),
    O('Se comió un cable…', 'It chewed a cable…', { fx: { energy: -0.12 }, scrap: 12 })] },
  { id: 'probe', icon: '📡', es: 'Recibes una señal débil de una sonda vieja.', en: 'You pick up a weak signal from an old probe.', options: [
    O('Desviarte a ayudarla', 'Detour to help it', { fx: { energy: -0.12 }, scrap: 25 }),
    O('Anotar su posición y seguir', 'Note its position and move on', { mod: 'calibrated' }),
    G('Hackear su antena para pedirle datos', 'Tap its antenna for data', 0.5, { scrap: 35, mod: 'good_rep' }, { fx: { energy: -0.1 }, mod: 'dusty_lens' })] },
  { id: 'mechanic', icon: '🔧', es: 'Un mecánico de la base te ofrece un trato por radio.', en: 'A mechanic at the base offers you a deal over the radio.', options: [
    O('Mejorar el motor (cuesta 15 🪙)', 'Tune the engine (costs 15 🪙)', { scrap: -15, mod: 'tailwind' }),
    O('Reforzar el casco (cuesta 15 🪙)', 'Reinforce the hull (costs 15 🪙)', { scrap: -15, mod: 'spare_parts' }),
    O('No, gracias', 'No, thanks', {})] },
  { id: 'comet', icon: '☄️', es: 'Cruzas la cola de un cometa lleno de hielo y polvo.', en: 'You cross the tail of a comet full of ice and dust.', options: [
    O('Recoger hielo para el sistema de energía', 'Scoop ice for the power system', { fx: { energy: 0.12 } }),
    O('Evitarla con cuidado', 'Steer around it carefully', { fx: { energy: -0.05 } }),
    G('Pasar muy cerca para tomar fotos', 'Fly close for photos', 0.5, { scrap: 30, mod: 'sharp_eye' }, { fx: { health: -20 } })] },
  { id: 'leak', icon: '💧', es: 'Hay una fuga pequeña en un tanque.', en: 'There is a small leak in a tank.', options: [
    O('Sellarla con una salida al exterior', 'Seal it with a spacewalk', { fx: { energy: -0.1 } }),
    O('Cerrar la válvula y vivir con menos', 'Close the valve and live with less', { mod: 'weak_cells' }),
    O('Cambiar de plan: usar la reserva', 'Switch plans: use the reserve', { fx: { health: -8 }, mod: 'thirsty' })] },
  { id: 'party', icon: '🎉', es: 'Es el cumpleaños de alguien de la tripulación.', en: "It's a crew member's birthday.", options: [
    O('Hacer una mini fiesta', 'Throw a mini party', { fx: { energy: -0.05 }, mod: 'good_rep' }),
    O('Cantar rápido y seguir', 'Sing quickly and carry on', { scrap: 6 }),
    O('Guardar el pastel para el regreso', 'Save the cake for the return', { mod: 'lucky_charm' })] },
  { id: 'crate', icon: '📦', es: 'Una caja sin marcar flota junto a tu nave.', en: 'An unmarked crate floats next to your ship.', options: [
    G('Abrirla ya', 'Open it now', 0.55, { scrap: 40, mod: 'quick_hands' }, { fx: { health: -15 }, mod: 'jam' }),
    O('Escanearla antes de tocarla', 'Scan it before touching it', { fx: { energy: -0.08 }, scrap: 15 }),
    O('Dejarla ir', 'Let it drift away', {})] },
  { id: 'flare', icon: '🌞', es: 'Se acerca una ventana de calma entre dos llamaradas solares.', en: 'A calm window is opening between two solar flares.', options: [
    O('Acelerar y aprovecharla', 'Speed up and use it', { fx: { energy: -0.1 }, mod: 'tailwind' }),
    O('Aprovechar para recargar baterías', 'Use it to recharge batteries', { fx: { energy: 0.15 } }),
    O('Revisar el escudo con calma', 'Inspect the shield calmly', { fx: { health: 12 } })] },
  { id: 'sponsor', icon: '🏷️', es: 'Una empresa quiere poner su logo en tu nave.', en: 'A company wants to put its logo on your ship.', options: [
    O('Aceptar: te pagan ahora', 'Accept: they pay you now', { scrap: 30, mod: 'debt' }),
    O('Rechazar y mantener la nave limpia', 'Decline and keep the ship clean', { mod: 'good_rep' }),
    G('Negociar un mejor trato', 'Negotiate a better deal', 0.5, { scrap: 55 }, { scrap: -10 })] },
  { id: 'gps', icon: '🧭', es: 'La navegación se confunde: dos rutas parecen buenas.', en: 'Navigation gets confused: two routes look good.', options: [
    O('Ruta larga y segura', 'Long, safe route', { fx: { energy: -0.12 }, mod: 'calibrated' }),
    O('Ruta corta y peligrosa', 'Short, dangerous route', { fx: { health: -14 }, mod: 'tailwind' }),
    G('Tirar una moneda', 'Flip a coin', 0.5, { fx: { energy: 0.1 } }, { fx: { health: -12, energy: -0.1 } })] },
  { id: 'satellite', icon: '🛰️', es: 'Pasas junto a un satélite viejo y apagado.', en: 'You pass an old, switched-off satellite.', options: [
    O('Tomar sus paneles solares', 'Take its solar panels', { fx: { energy: 0.12 } }),
    O('Rescatar su chip de datos', 'Rescue its data chip', { scrap: 22 }),
    O('Reportarlo y seguir', 'Report it and carry on', { mod: 'good_rep' })] },
  { id: 'antenna', icon: '📶', es: 'La antena principal se desalinea.', en: 'The main antenna drifts out of alignment.', min: 'medium', options: [
    O('Corregirla a mano', 'Fix it by hand', { fx: { energy: -0.08 } }),
    O('Usar la antena de repuesto', 'Use the spare antenna', { mod: 'dusty_lens' }),
    O('Pedir que la base la corrija', 'Ask the base to fix it', { fx: { time: -20 }, mod: 'calibrated' })] },
  { id: 'fuel', icon: '⛽', es: 'Un cargamento de combustible viejo se ofrece a mitad de camino.', en: 'An old fuel shipment is on offer halfway.', min: 'medium', options: [
    O('Comprarlo (10 🪙)', 'Buy it (10 🪙)', { scrap: -10, fx: { energy: 0.2 } }),
    O('Cambiarlo por piezas', 'Trade it for parts', { mod: 'spare_parts' }),
    O('No necesito nada', 'I need nothing', {})] },
  { id: 'training', icon: '🎯', es: 'Tienes un rato libre durante el viaje.', en: 'You have some free time during the trip.', options: [
    O('Practicar puntería en el simulador', 'Practice aiming in the simulator', { mod: 'quick_hands' }),
    O('Practicar maniobras', 'Practice manoeuvres', { mod: 'tailwind' }),
    O('Dormir una siesta', 'Take a nap', { fx: { health: 10 } })] },
  { id: 'rad', icon: '☢️', es: 'Cruzas una zona de radiación.', en: 'You cross a radiation zone.', dests: ['jupiter'], options: [
    O('Rodearla (gasta energía)', 'Go around it (uses power)', { fx: { energy: -0.15 } }),
    O('Cruzar con el escudo al máximo', 'Cross with the shield at max', { fx: { health: -12 } }),
    G('Tomar mediciones valiosas', 'Take valuable measurements', 0.5, { scrap: 35, mod: 'calibrated' }, { fx: { health: -22 } })] },
  { id: 'moon', icon: '🌙', es: 'Una luna de Júpiter pasa muy cerca.', en: 'One of Jupiter’s moons drifts very close.', dests: ['jupiter'], options: [
    O('Usar su gravedad para ahorrar energía', 'Use its gravity to save power', { fx: { energy: 0.15 } }),
    O('Fotografiarla', 'Photograph it', { scrap: 20 }),
    O('Mantener la distancia', 'Keep your distance', {})] },
  { id: 'red', icon: '🌀', es: 'La Gran Mancha Roja se ve inquieta.', en: 'The Great Red Spot looks restless.', dests: ['jupiter'], min: 'medium', options: [
    O('Cambiar a un modo de vuelo más pesado', 'Switch to a heavier flight mode', { mod: 'rattle' }),
    O('Aprovechar sus vientos', 'Ride its winds', { mod: 'tailwind', fx: { health: -10 } }),
    O('Mantener curso', 'Hold course', {})] },
  { id: 'devil', icon: '🌪️', es: 'Un remolino de polvo se levanta cerca del lugar de aterrizaje.', en: 'A dust devil rises near the landing site.', dests: ['mars'], options: [
    O('Esperar a que pase', 'Wait for it to pass', { fx: { time: -25 } }),
    O('Aterrizar lejos del remolino', 'Land away from it', { fx: { energy: -0.1 } }),
    O('Aprovechar el polvo para ocultarte', 'Use the dust as cover', { mod: 'calm_crew', fx: { health: -8 } })] },
  { id: 'river', icon: '🏞️', es: 'Los mapas muestran un cauce seco de un río antiguo.', en: 'Maps show the dry bed of an ancient river.', dests: ['mars'], options: [
    O('Programar la ruta por el cauce', 'Plan the route along the bed', { mod: 'sharp_eye' }),
    O('Mandar un dron a explorar', 'Send a drone to scout', { fx: { energy: -0.08 }, mod: 'calibrated' }),
    O('Ir por la ruta de siempre', 'Take the usual route', {})] },
  { id: 'wave', icon: '🌊', es: 'Los sensores avisan de olas gigantes cerca del aterrizaje.', en: 'Sensors warn of giant waves near the landing.', dests: ['miller'], options: [
    O('Sumergirte más temprano', 'Dive earlier than planned', { fx: { energy: -0.1 } }),
    O('Aguantar con el casco reforzado', 'Ride it out with a strengthened hull', { fx: { health: -12 } }),
    G('Surfear la ola para ganar tiempo', 'Surf the wave to save time', 0.5, { fx: { time: 25 }, mod: 'tailwind' }, { fx: { health: -22 }, mod: 'storm_belt' })] },
  { id: 'vent', icon: '♨️', es: 'Detectas una chimenea caliente en el fondo del mar.', en: 'You detect a hot vent on the seabed.', dests: ['miller'], options: [
    O('Acercarte a tomar muestras de calor', 'Get close for heat samples', { scrap: 25, fx: { health: -10 } }),
    O('Usar su calor para cargar baterías', 'Use its heat to charge batteries', { fx: { energy: 0.15 } }),
    O('Marcarla en el mapa para después', 'Mark it on the map for later', { mod: 'calibrated' })] },
  { id: 'whale', icon: '🐋', es: 'Una sombra enorme pasa bajo tu ruta.', en: 'A huge shadow passes beneath your route.', dests: ['miller'], min: 'medium', options: [
    O('Seguirla de lejos', 'Follow it from afar', { mod: 'sharp_eye' }),
    O('Apagar luces y dejarla pasar', 'Switch off the lights and let it pass', { fx: { energy: 0.05 } }),
    O('Mandar una señal de saludo', 'Send a greeting signal', { mod: 'calm_crew' })] },
  { id: 'rival', icon: '🏁', es: 'Un equipo rival llega al mismo planeta que tú.', en: 'A rival team is heading to the same planet.', min: 'medium', options: [
    O('Competir: ir más rápido', 'Race them: go faster', { fx: { energy: -0.12 }, mod: 'tailwind' }),
    O('Cooperar: compartir datos', 'Cooperate: share data', { scrap: 20, mod: 'good_rep' }),
    O('Ignorarlos', 'Ignore them', {})] },
  { id: 'engineer', icon: '🧑‍🔧', es: 'Un ingeniero te pide revisar una pieza rara.', en: 'An engineer asks you to check an odd part.', options: [
    O('Cambiarla por una nueva', 'Swap it for a new one', { fx: { health: 10 }, scrap: -8 }),
    O('Dejarla como está', 'Leave it as it is', { mod: 'rattle' }),
    G('Reparar la pieza tú mismo', 'Repair the part yourself', 0.6, { mod: 'spare_parts' }, { mod: 'jam' })] },
];
export const eventById = (id: string) => TRIP_EVENTS.find(e => e.id === id);

/** How many questions you get before a mission: more as the level goes up. */
/** Chance of each number of events (index = how many). A quiet trip with nothing happening is possible but rare (3–4 %); harder levels tend to have more. */
export const EVENT_ODDS: Record<Level, number[]> = {
  easy: [0.04, 0.5, 0.35, 0.11], medium: [0.04, 0.4, 0.38, 0.18], hard: [0.03, 0.3, 0.4, 0.2, 0.07], expert: [0.03, 0.2, 0.35, 0.3, 0.12],
};
export function eventCount(level: Level, rnd: () => number = Math.random): number {
  const odds = EVENT_ODDS[level]; let r = rnd() * odds.reduce((a, b) => a + b, 0);
  for (let n = 0; n < odds.length; n++) { r -= odds[n]!; if (r < 0) return n; }
  return odds.length - 1;
}

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j]!, o[i]!]; }
  return o;
}
/** A random set of events for this trip: only ones that fit the planet and level, avoiding the ones you saw recently, with the options in random order. */
export function pickTrip(level: Level, dest: Dest, rnd: () => number = Math.random, seen: string[] = []): TEvent[] {
  const li = LEVELS.indexOf(level);
  const pool = TRIP_EVENTS.filter(e => (!e.dests || e.dests.includes(dest)) && LEVELS.indexOf(e.min ?? 'easy') <= li);
  const fresh = shuffle(pool.filter(e => !seen.includes(e.id)), rnd), stale = shuffle(pool.filter(e => seen.includes(e.id)), rnd);
  return [...fresh, ...stale].slice(0, eventCount(level, rnd)).map(e => ({ ...e, options: shuffle(e.options, rnd) }));
}
/** Resolves a choice: a gamble rolls the dice once, everything else is exactly what it says. */
export function resolveOption(o: TOption, rnd: () => number = Math.random): { out: Out; won: boolean | null } {
  if (!o.gamble) return { out: o.out, won: null };
  const won = rnd() < o.gamble.p; return { out: won ? o.gamble.win : o.gamble.lose, won };
}
/** Short readable list of what an outcome does, for the card (no hidden surprises except the dice). */
export function describeOut(o: Out, es: boolean): string {
  const p: string[] = [], f = o.fx ?? {};
  if (f.health) p.push(es ? `casco ${f.health > 0 ? '+' : ''}${f.health}` : `hull ${f.health > 0 ? '+' : ''}${f.health}`);
  if (f.energy) p.push(es ? `energía ${f.energy > 0 ? '+' : ''}${Math.round(f.energy * 100)} %` : `power ${f.energy > 0 ? '+' : ''}${Math.round(f.energy * 100)}%`);
  if (f.time) p.push(es ? `tiempo ${f.time > 0 ? '+' : ''}${f.time} s` : `time ${f.time > 0 ? '+' : ''}${f.time} s`);
  if (o.scrap) p.push(`${o.scrap > 0 ? '+' : ''}${o.scrap} 🪙`);
  const m = o.mod ? modById(o.mod) : null; if (m) p.push(`${m.icon} ${es ? m.es : m.en} (${m.turns})`);
  return p.join(' · ') || (es ? 'sin cambios' : 'no change');
}
export const optionNote = (o: TOption, es: boolean): string => o.gamble
  ? `${Math.round(o.gamble.p * 100)} %: ${describeOut(o.gamble.win, es)} — ${es ? 'si no' : 'otherwise'}: ${describeOut(o.gamble.lose, es)}`
  : describeOut(o.out, es);
