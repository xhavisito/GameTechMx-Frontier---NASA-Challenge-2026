import { BUDGET, DEST, G0, ISP, ROCKETS, ROVER_COST, ROVER_MASS, ROVER_WATTS, SOLAR_W_PER_M2, TOOLS } from './design';

/**
 * "Ciencia y fuentes": for every resource the game uses, where the idea comes from (NASA link),
 * which fact or concept we used, which screen it affects and how we simplified it.
 *
 * Honesty rule: a number is only "backed" if a NASA page above states it. Every other number is
 * listed under `params` and shown to the player as a GAME PARAMETER (parámetro de juego).
 * Links were opened and read while writing this file; do not add a link you have not read.
 */
export type L = { es: string; en: string };
export type Backing = 'nasa' | 'mixed' | 'game' | 'fiction';
export type Group = 'ship' | 'mars' | 'jupiter' | 'miller' | 'trip' | 'game';
export interface Link { title: string; url: string }
export interface Source {
  id: string; group: Group; name: L;
  /** nasa = concept and figures from NASA; mixed = concept from NASA, game numbers are ours; game = ours; fiction = from the film. */
  backing: Backing;
  links: Link[];
  fact: L; screen: L; simplification: L;
  /** Numbers in the game that NASA does NOT back. Built from the real constants so they cannot drift. */
  params: L[];
}

const p = (es: string, en: string): L => ({ es, en });
const kg = (n: number) => `${n} kg`;

export const GROUPS: { id: Group; name: L }[] = [
  { id: 'ship', name: p('Nave y hangar', 'Ship and hangar') },
  { id: 'mars', name: p('Marte', 'Mars') },
  { id: 'jupiter', name: p('Júpiter', 'Jupiter') },
  { id: 'miller', name: p('Miller (ficción)', 'Miller (fiction)') },
  { id: 'trip', name: p('Eventos del viaje', 'Trip events') },
  { id: 'game', name: p('Economía del juego', 'Game economy') },
];

export const BACKING_LABEL: Record<Backing, L> = {
  nasa: p('Respaldado por NASA', 'Backed by NASA'),
  mixed: p('Concepto NASA + parámetros de juego', 'NASA concept + game parameters'),
  game: p('Parámetro de juego', 'Game parameter'),
  fiction: p('Ficción (no es NASA)', 'Fiction (not NASA)'),
};

const R = ROCKETS;
export const SOURCES: Source[] = [
  // ───────────── Nave y hangar ─────────────
  {
    id: 'rocket-equation', group: 'ship', name: p('Ecuación del cohete, Isp y Δv', 'Rocket equation, Isp and Δv'), backing: 'mixed',
    links: [
      { title: 'NASA Glenn — Ideal Rocket Equation', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/' },
      { title: 'NASA Glenn — Specific Impulse', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/' },
    ],
    fact: p('El cambio de velocidad de un cohete es Δv = Isp · g0 · ln(masa inicial / masa final). NASA Glenn da 350 s como valor razonable de Isp para un motor de hidrógeno/oxígeno líquidos como el del transbordador.',
      'A rocket\'s change in speed is Δv = Isp · g0 · ln(initial mass / final mass). NASA Glenn gives 350 s as a reasonable Isp for a liquid hydrogen/oxygen engine like the Shuttle\'s.'),
    screen: p('Hangar: la prueba "Δv suficiente" antes de lanzar (difícil y experto la usan completa).', 'Hangar: the "enough Δv" pre-flight test (hard and expert use it in full).'),
    simplification: p('Usamos un solo motor con Isp fijo, sin gravedad ni arrastre, y un solo impulso. Los Δv que cada destino exige no vienen de NASA (ver parámetros).',
      'One engine with fixed Isp, no gravity or drag losses, one single burn. The Δv each destination demands does not come from NASA (see parameters).'),
    params: [
      p(`Isp = ${ISP} s y g0 = ${G0} m/s² (valores del ejemplo de NASA, aplicados a todos los cohetes del juego).`, `Isp = ${ISP} s and g0 = ${G0} m/s² (NASA's example values, applied to every rocket in the game).`),
      p(`Δv exigido: Marte ${DEST.mars.dv}, Miller ${DEST.miller.dv}, Júpiter ${DEST.jupiter.dv} km/s — cifras estilizadas del juego.`, `Required Δv: Mars ${DEST.mars.dv}, Miller ${DEST.miller.dv}, Jupiter ${DEST.jupiter.dv} km/s — stylised game numbers.`),
    ],
  },
  {
    id: 'rocket-stages', group: 'ship', name: p('Cohetes: propulsores y tanque que se separan', 'Rockets: boosters and tank that separate'), backing: 'mixed',
    links: [
      { title: 'NASA — The Space Shuttle', url: 'https://www.nasa.gov/reference/the-space-shuttle/' },
      { title: 'NASA KSC — Shuttle mission profile', url: 'https://science.ksc.nasa.gov/shuttle/technology/sts-newsref/mission_profile.html' },
    ],
    fact: p('El transbordador soltaba sus dos propulsores sólidos a los ~2 minutos de vuelo (unos 45 km de altura) y el tanque externo a los ~8.5 minutos, después de usar su propelente.',
      'The Space Shuttle dropped its two solid boosters about 2 minutes in (around 45 km up) and its external tank at about 8.5 minutes, once the propellant was used.'),
    screen: p('Lanzamiento: la animación del cohete que suelta propulsores y tanque; Hangar: elegir cohete.', 'Launch: the animation of the rocket shedding boosters and tank; Hangar: choosing a rocket.'),
    simplification: p('La secuencia es una animación de cuento: los tiempos y alturas no se simulan. Los tres cohetes del juego no son cohetes reales.',
      'The sequence is a storybook animation: times and altitudes are not simulated. The three rockets in the game are not real rockets.'),
    params: [
      p(`Masa seca / propelente / carga máx. / costo — ligero ${R.light.dry}/${R.light.prop}/${R.light.maxPayload} kg/${R.light.cost}; estándar ${R.standard.dry}/${R.standard.prop}/${R.standard.maxPayload} kg/${R.standard.cost}; pesado ${R.heavy.dry}/${R.heavy.prop}/${R.heavy.maxPayload} kg/${R.heavy.cost}.`,
        `Dry mass / propellant / max payload / cost — light ${R.light.dry}/${R.light.prop}/${R.light.maxPayload} kg/${R.light.cost}; standard ${R.standard.dry}/${R.standard.prop}/${R.standard.maxPayload} kg/${R.standard.cost}; heavy ${R.heavy.dry}/${R.heavy.prop}/${R.heavy.maxPayload} kg/${R.heavy.cost}.`),
    ],
  },
  {
    id: 'tool-radar', group: 'ship', name: p('Instrumento: radar (RIMFAX)', 'Instrument: radar (RIMFAX)'), backing: 'mixed',
    links: [
      { title: 'NASA Mars — RIMFAX', url: 'https://mars.nasa.gov/mars2020/spacecraft/instruments/rimfax/' },
      { title: 'NASA Science — Searching for Buried Treasure on Mars With RIMFAX', url: 'https://science.nasa.gov/missions/mars-2020-perseverance/searching-for-buried-treasure-on-mars-with-rimfax' },
    ],
    fact: p('RIMFAX es un radar de penetración terrestre del rover Perseverance: ve capas de roca bajo el suelo hasta ~10 m. En la ficha de NASA pesa menos de 3 kg y consume 5 a 10 W.',
      'RIMFAX is Perseverance\'s ground-penetrating radar: it sees rock layers underground down to ~10 m. NASA\'s fact sheet lists under 3 kg and 5 to 10 W.'),
    screen: p('Hangar (herramienta obligatoria para Marte); Marte: detectar hielo enterrado en la misión de recolección.', 'Hangar (required tool for Mars); Mars: finding buried ice in the collect mission.'),
    simplification: p('El radar del juego "ve" el hielo con un solo botón. El RIMFAX real mide capas de roca; NASA no lo describe como detector de hielo. Masa, costo y consumo del juego son MUY distintos a los reales.',
      'The game radar "sees" ice with one button. The real RIMFAX maps rock layers; NASA does not describe it as an ice detector. Game mass, cost and power are VERY different from the real ones.'),
    params: [p(`Radar del juego: ${kg(TOOLS.radar.mass)}, ${TOOLS.radar.watts} W, costo ${TOOLS.radar.cost}.`, `Game radar: ${kg(TOOLS.radar.mass)}, ${TOOLS.radar.watts} W, cost ${TOOLS.radar.cost}.`)],
  },
  {
    id: 'tool-spectrometer', group: 'ship', name: p('Instrumento: espectrómetro (SuperCam / PIXL)', 'Instrument: spectrometer (SuperCam / PIXL)'), backing: 'mixed',
    links: [
      { title: 'NASA Science — Perseverance Science Instruments', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/' },
      { title: 'NASA JPL — Perseverance makes new discoveries in Jezero Crater', url: 'https://www.jpl.nasa.gov/news/nasas-perseverance-makes-new-discoveries-in-mars-jezero-crater/' },
    ],
    fact: p('SuperCam dispara un láser a rocas hasta ~7 m de distancia y analiza la luz para saber su química; PIXL usa rayos X para mapear elementos. NASA da ~5.6 kg + 4.8 kg y 17.9 W para SuperCam.',
      'SuperCam fires a laser at rocks up to ~7 m away and reads the light to learn their chemistry; PIXL uses X-rays to map elements. NASA lists ~5.6 kg + 4.8 kg and 17.9 W for SuperCam.'),
    screen: p('Hangar (herramienta obligatoria para Miller); Miller: señales de vida y análisis.', 'Hangar (required tool for Miller); Miller: signs of life and analysis.'),
    simplification: p('Fusionamos dos instrumentos reales en uno genérico "espectrómetro". Los números del juego no son los de NASA.',
      'We merge two real instruments into one generic "spectrometer". Game numbers are not NASA\'s.'),
    params: [p(`Espectrómetro del juego: ${kg(TOOLS.spectrometer.mass)}, ${TOOLS.spectrometer.watts} W, costo ${TOOLS.spectrometer.cost}.`, `Game spectrometer: ${kg(TOOLS.spectrometer.mass)}, ${TOOLS.spectrometer.watts} W, cost ${TOOLS.spectrometer.cost}.`)],
  },
  {
    id: 'tool-camera', group: 'ship', name: p('Instrumento: cámara (Mastcam-Z)', 'Instrument: camera (Mastcam-Z)'), backing: 'mixed',
    links: [
      { title: 'NASA Science — Perseverance Science Instruments (Mastcam-Z)', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/' },
      { title: 'NASA JPL — Perseverance will look at Mars through these "eyes"', url: 'https://www.jpl.nasa.gov/news/nasas-perseverance-rover-will-look-at-mars-through-these-eyes/' },
    ],
    fact: p('Mastcam-Z son dos cámaras con zoom 3:1 en el mástil del rover para fotos panorámicas y en 3D. NASA da unos 4 kg y 17.4 W.',
      'Mastcam-Z is a pair of 3:1 zoom cameras on the rover mast for panoramic and 3D pictures. NASA lists about 4 kg and 17.4 W.'),
    screen: p('Marte: misión de fotos con el visor; Júpiter: fotografiar tormentas; Hangar: herramienta gratuita por defecto.', 'Mars: the photo mission with the viewfinder; Jupiter: photographing storms; Hangar: the free default tool.'),
    simplification: p('La foto del juego sale al centrar el objetivo en el visor; no hay zoom, exposición ni 3D. Los números del juego no son los de NASA.',
      'The game photo is taken by centring the target in the viewfinder; there is no zoom, exposure or 3D. Game numbers are not NASA\'s.'),
    params: [p(`Cámara del juego: ${kg(TOOLS.camera.mass)}, ${TOOLS.camera.watts} W, costo ${TOOLS.camera.cost}.`, `Game camera: ${kg(TOOLS.camera.mass)}, ${TOOLS.camera.watts} W, cost ${TOOLS.camera.cost}.`)],
  },
  {
    id: 'rover', group: 'ship', name: p('El rover y su brazo', 'The rover and its arm'), backing: 'game',
    links: [{ title: 'NASA Science — Perseverance Science Instruments (arm instruments)', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/' }],
    fact: p('Perseverance lleva instrumentos en un brazo robótico (PIXL y SHERLOC) y otros en el mástil. De ahí sale la idea del brazo animado.',
      'Perseverance carries instruments on a robotic arm (PIXL and SHERLOC) and others on the mast. That is where the animated arm idea comes from.'),
    screen: p('Todas las misiones en Marte: el rover que conduces; Taller: mejoras del rover.', 'Every Mars mission: the rover you drive; Workshop: rover upgrades.'),
    simplification: p('Nuestro rover es un diseño propio de baja poligonación, no una réplica. Su masa, costo y consumo son del juego.',
      'Our rover is an original low-poly design, not a replica. Its mass, cost and power are game values.'),
    params: [p(`Rover: ${kg(ROVER_MASS)}, ${ROVER_WATTS} W, costo ${ROVER_COST}.`, `Rover: ${kg(ROVER_MASS)}, ${ROVER_WATTS} W, cost ${ROVER_COST}.`)],
  },
  {
    id: 'solar-power', group: 'ship', name: p('Paneles solares y baterías', 'Solar panels and batteries'), backing: 'mixed',
    links: [
      { title: 'NASA JPL — Juno press kit: spacecraft (solar power)', url: 'https://www.jpl.nasa.gov/news/press_kits/juno/spacecraft/' },
      { title: 'NASA Science — 10 Things: Massive Dust Storm on Mars', url: 'https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/' },
    ],
    fact: p('Júpiter recibe unas 25 veces menos luz solar que la Tierra, por eso Juno necesita paneles muy grandes y baterías para cuando no hay sol. En Marte el polvo bloquea la luz y un rover solar no puede recargarse.',
      'Jupiter gets about 25 times less sunlight than Earth, so Juno needs very large panels and batteries for when there is no sun. On Mars dust blocks sunlight and a solar rover cannot recharge.'),
    screen: p('Hangar: prueba de energía (paneles + batería contra consumo); Júpiter y Marte: la energía baja con poca luz o polvo.', 'Hangar: the power test (panels + battery vs. consumption); Jupiter and Mars: energy drops with low light or dust.'),
    simplification: p('Un solo número de vatios por m² y por destino; no hay ángulo del sol, eclipses ni degradación de celdas.', 'One watts-per-m² number per destination; no sun angle, eclipses or cell degradation.'),
    params: [
      p(`${SOLAR_W_PER_M2} W por m² de panel a distancia de la Tierra, masa 7 kg/m², costo 3/m² y batería 10 kg y 4 por kWh — parámetros de juego.`, `${SOLAR_W_PER_M2} W per m² of panel at Earth distance, 7 kg/m² mass, 3/m² cost and battery 10 kg and 4 per kWh — game parameters.`),
      p(`Luz relativa a la Tierra: Marte ${DEST.mars.sun}, Miller ${DEST.miller.sun}, Júpiter ${DEST.jupiter.sun}. Solo Júpiter (≈1/25) tiene respaldo NASA; los demás son de juego.`, `Sunlight relative to Earth: Mars ${DEST.mars.sun}, Miller ${DEST.miller.sun}, Jupiter ${DEST.jupiter.sun}. Only Jupiter (≈1/25) is NASA-backed; the others are game values.`),
    ],
  },
  {
    id: 'heat-shield', group: 'ship', name: p('Escudo térmico', 'Heat shield'), backing: 'mixed',
    links: [
      { title: 'NASA JPL — Perseverance landing press kit: getting to Mars (aeroshell)', url: 'https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/getting_to_mars/' },
      { title: 'NASA JPL — Perseverance decelerates in the Martian atmosphere', url: 'https://www.jpl.nasa.gov/images/pia24314-perseverance-rover-decelerates-in-the-martian-atmosphere-illustration/' },
    ],
    fact: p('Al entrar a la atmósfera de Marte el escudo de Perseverance llegó a unos 1,300 °C (2,370 °F) y el rover dentro se mantuvo a temperatura ambiente. El escudo es de un material ablativo llamado PICA.',
      'Entering the Martian atmosphere, Perseverance\'s shield reached about 1,300 °C (2,370 °F) while the rover inside stayed near room temperature. The shield is made of an ablative material called PICA.'),
    screen: p('Hangar: nivel de escudo exigido por destino; Viaje: reduce el daño de eventos.', 'Hangar: the shield level each destination requires; Trip: reduces event damage.'),
    simplification: p('Los niveles 1 a 3 son una escala de juego, no grados de temperatura. Júpiter no se "aterriza", el escudo es una regla de dificultad.',
      'Levels 1 to 3 are a game scale, not temperatures. Jupiter is not "landed on"; the shield is a difficulty rule.'),
    params: [p(`Escudo exigido: Marte ${DEST.mars.shield}, Miller ${DEST.miller.shield}, Júpiter ${DEST.jupiter.shield}; cada nivel suma 35 kg y costo 4.`, `Shield required: Mars ${DEST.mars.shield}, Miller ${DEST.miller.shield}, Jupiter ${DEST.jupiter.shield}; each level adds 35 kg and cost 4.`)],
  },

  // ───────────── Marte ─────────────
  {
    id: 'mars-hematite', group: 'mars', name: p('Muestra: hematita ("arándanos")', 'Sample: hematite ("blueberries")'), backing: 'nasa',
    links: [
      { title: 'NASA Science — Meridiani Planum', url: 'https://science.nasa.gov/resource/meridiani-planum-2/' },
      { title: 'NASA JPL — Mineral in Mars "berries" adds to water story', url: 'https://www.jpl.nasa.gov/news/mineral-in-mars-berries-adds-to-water-story/' },
    ],
    fact: p('Opportunity encontró esferitas de hematita, apodadas "arándanos", en Meridiani Planum. En la Tierra este mineral suele formarse con agua, así que apunta a un pasado húmedo.',
      'Opportunity found hematite spherules, nicknamed "blueberries", on Meridiani Planum. On Earth this mineral usually forms with water, so it points to a wet past.'),
    screen: p('Marte: misión de recolección (muestras de hematita).', 'Mars: the collect mission (hematite samples).'),
    simplification: p('Las esferitas reales miden milímetros y las encontró otro rover en otro sitio; en el juego son gemas grandes cerca de nuestro rover.',
      'Real spherules are millimetres wide and a different rover found them at a different site; in the game they are big gems near our rover.'),
    params: [],
  },
  {
    id: 'mars-igneous', group: 'mars', name: p('Muestras: regolito y basalto', 'Samples: regolith and basalt'), backing: 'nasa',
    links: [
      { title: 'NASA Mars — RIMFAX for scientists (regolith)', url: 'https://mars.nasa.gov/mars2020/spacecraft/instruments/rimfax/for-scientists/' },
      { title: 'NASA JPL — Perseverance makes new discoveries in Jezero Crater (igneous rocks)', url: 'https://www.jpl.nasa.gov/news/nasas-perseverance-makes-new-discoveries-in-mars-jezero-crater/' },
    ],
    fact: p('El suelo suelto de Marte se llama regolito y NASA mide su profundidad con radar. Las rocas del fondo del cráter Jezero resultaron ser ígneas, de origen volcánico.',
      'Loose Martian ground is called regolith and NASA measures its depth with radar. Rocks on the floor of Jezero Crater turned out to be igneous, of volcanic origin.'),
    screen: p('Marte: misión de recolección.', 'Mars: the collect mission.'),
    simplification: p('Llamamos "basalto" a las rocas ígneas por ser el tipo volcánico más conocido; NASA habla de roca ígnea en general.',
      'We call igneous rocks "basalt" because it is the best-known volcanic type; NASA speaks of igneous rock in general.'),
    params: [],
  },
  {
    id: 'mars-ice', group: 'mars', name: p('Muestra: hielo enterrado', 'Sample: buried ice'), backing: 'nasa',
    links: [
      { title: 'NASA JPL — Mars ice deposit holds as much water as Lake Superior', url: 'https://jpl.nasa.gov/news/news.php?release=2016-299' },
      { title: 'NASA Mars — SHARAD (Mars Reconnaissance Orbiter)', url: 'https://mars.nasa.gov/mro/mission/instruments/sharad/' },
    ],
    fact: p('El radar SHARAD de la sonda MRO detectó grandes depósitos de hielo bajo la superficie, p. ej. en Utopia Planitia, con tanta agua como el lago Superior.',
      'The SHARAD radar on the MRO orbiter detected large underground ice deposits, e.g. in Utopia Planitia, holding as much water as Lake Superior.'),
    screen: p('Marte: misión de recolección; sin radar el juego avisa que no se detecta el hielo.', 'Mars: the collect mission; without radar the game says the ice cannot be detected.'),
    simplification: p('SHARAD es un radar orbital y ve decenas o cientos de metros; en el juego el radar del rover lo "ve" a unos metros y lo marca con un aro. Es una licencia de juego.',
      'SHARAD is an orbital radar seeing tens to hundreds of metres; in the game the rover radar "sees" it a few metres away and marks it with a ring. That is a game licence.'),
    params: [],
  },
  {
    id: 'mars-dust', group: 'mars', name: p('Polvo y energía solar', 'Dust and solar power'), backing: 'nasa',
    links: [
      { title: 'NASA Science — 10 Things: Massive Dust Storm on Mars', url: 'https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/' },
      { title: 'NASA Mars — Mars Rover Mission Comes to an End (JPL Teachable Moment)', url: 'https://www.jpl.nasa.gov/edu/resources/teachable-moment/mars-rover-mission-comes-to-an-end-but-science-legacy-live-on/' },
    ],
    fact: p('La tormenta global de 2018 tapó la luz del Sol y Opportunity, que funcionaba con paneles solares, dejó de comunicarse en junio de 2018. El viento a veces limpia los paneles.',
      'The 2018 global dust storm blocked the Sun and Opportunity, which ran on solar panels, stopped communicating in June 2018. Wind sometimes cleans the panels.'),
    screen: p('Marte: una ola de polvo periódica baja la energía solar del rover; Hangar: razón de llevar baterías.', 'Mars: a periodic dust wave lowers the rover\'s solar energy; Hangar: why you carry batteries.'),
    simplification: p('En el juego el polvo llega y se va en ciclos de unos minutos, no es una tormenta planetaria de meses.', 'In the game dust comes and goes in cycles of a few minutes; it is not a months-long planetary storm.'),
    params: [],
  },
  {
    id: 'mars-meteors', group: 'mars', name: p('Meteoros en Marte', 'Meteors on Mars'), backing: 'nasa',
    links: [
      { title: 'NASA — InSight detects stunning meteoroid impact on Mars', url: 'https://www.nasa.gov/missions/insight/nasas-insight-lander-detects-stunning-meteoroid-impact-on-mars/' },
      { title: 'NASA Science — Hear meteoroid striking Mars, captured by InSight', url: 'https://science.nasa.gov/resource/hear-meteoroid-striking-mars-captured-by-nasas-insight-lander/' },
    ],
    fact: p('La atmósfera de Marte es solo ~1 % tan densa como la de la Tierra, así que muchas rocas espaciales llegan al suelo en vez de quemarse. InSight detectó varios impactos reales.',
      'Mars\' atmosphere is only ~1% as dense as Earth\'s, so many space rocks reach the ground instead of burning up. InSight detected several real impacts.'),
    screen: p('Marte: meteoritos con aviso (círculo rojo) que obligan a salir del área.', 'Mars: meteors with a warning (red circle) that make you leave the area.'),
    simplification: p('Los impactos reales son raros (InSight confirmó pocos en años); en el juego caen seguido para que haya acción. La frecuencia es un parámetro de juego.',
      'Real impacts are rare (InSight confirmed few over years); in the game they fall often to keep it lively. The frequency is a game parameter.'),
    params: [p('Frecuencia y daño de los meteoros por dificultad: valores de juego (levels.ts).', 'Meteor frequency and damage: game values (levels.ts).')],
  },

  // ───────────── Júpiter ─────────────
  {
    id: 'jup-grs', group: 'jupiter', name: p('Gran Mancha Roja', 'Great Red Spot'), backing: 'nasa',
    links: [
      { title: 'NASA Science — Jupiter Facts', url: 'https://science.nasa.gov/jupiter/jupiter-facts/' },
      { title: 'NASA Science — NASA\'s Juno probes the depths of Jupiter\'s Great Red Spot', url: 'https://science.nasa.gov/missions/juno/nasas-juno-probes-the-depths-of-jupiters-great-red-spot/' },
    ],
    fact: p('Es una tormenta anticiclónica más ancha que la Tierra que se observa desde hace más de 300 años; Juno midió que sus raíces bajan unos 300 km bajo las nubes.',
      'It is an anticyclonic storm wider than Earth that has been seen for more than 300 years; Juno measured roots reaching about 300 km below the clouds.'),
    screen: p('Júpiter: zona "Gran Mancha Roja" de la misión de recolección.', 'Jupiter: the "Great Red Spot" zone of the collect mission.'),
    simplification: p('En el juego es un punto de escaneo con un óvalo rojo; no tiene vientos ni tamaño a escala.', 'In the game it is a scan point with a red oval; no winds and not to scale.'),
    params: [],
  },
  {
    id: 'jup-belts', group: 'jupiter', name: p('Bandas de nubes y tormentas', 'Cloud belts and storms'), backing: 'nasa',
    links: [{ title: 'NASA Science — Jupiter Facts', url: 'https://science.nasa.gov/jupiter/jupiter-facts/' }],
    fact: p('Las franjas de Júpiter son nubes de amoníaco y agua en una atmósfera de hidrógeno y helio; las bandas oscuras son "cinturones" y las claras "zonas", con vientos de hasta ~540 km/h en el ecuador.',
      'Jupiter\'s stripes are clouds of ammonia and water in a hydrogen–helium atmosphere; dark bands are "belts" and light ones "zones", with winds up to ~540 km/h at the equator.'),
    screen: p('Júpiter: zonas "Tormentas del norte", "Banda de nubes", "Remolinos del sur" y "Tormenta ecuatorial".', 'Jupiter: the "Northern storms", "Cloud belt", "Southern swirls" and "Equatorial storm" zones.'),
    simplification: p('Júpiter no tiene suelo; el juego pone al jugador a volar entre nubes como una órbita baja imaginaria.', 'Jupiter has no ground; the game has you fly among the clouds like an imaginary low orbit.'),
    params: [],
  },
  {
    id: 'jup-aurora', group: 'jupiter', name: p('Aurora polar', 'Polar aurora'), backing: 'nasa',
    links: [
      { title: 'NASA JPL — Jupiter\'s auroras present a powerful mystery', url: 'https://www.jpl.nasa.gov/news/jupiters-auroras-present-a-powerful-mystery/' },
      { title: 'NASA Science — Jupiter\'s southern aurora (Juno)', url: 'https://science.nasa.gov/resource/jupiters-southern-aurora/?category=planets_jupiter' },
    ],
    fact: p('Juno estudió las auroras en los polos de Júpiter: electrones acelerados hasta 400,000 eV, de 10 a 30 veces más que las mayores auroras de la Tierra.',
      'Juno studied the auroras at Jupiter\'s poles: electrons accelerated up to 400,000 eV, 10 to 30 times more than the strongest auroras on Earth.'),
    screen: p('Júpiter: zona "aurora polar".', 'Jupiter: the "polar aurora" zone.'),
    simplification: p('La aurora del juego es un anillo de luz de colores; no se simulan partículas ni energía.', 'The game aurora is a ring of coloured light; no particles or energy are simulated.'),
    params: [],
  },
  {
    id: 'jup-radiation', group: 'jupiter', name: p('Radiación de Júpiter', 'Jupiter radiation'), backing: 'mixed',
    links: [
      { title: 'NASA JPL — Juno armored up to go to Jupiter', url: 'https://www.jpl.nasa.gov/news/juno-armored-up-to-go-to-jupiter/' },
      { title: 'NASA JPL — Juno press kit: spacecraft', url: 'https://www.jpl.nasa.gov/news/press_kits/juno/spacecraft/' },
    ],
    fact: p('Júpiter tiene cinturones de radiación en forma de dona sobre el ecuador. Juno protege su electrónica en una bóveda de titanio y vuela en una órbita polar para pasar poco tiempo en la zona más peligrosa.',
      'Jupiter has doughnut-shaped radiation belts around its equator. Juno shields its electronics in a titanium vault and flies a polar orbit to spend little time in the most dangerous zone.'),
    screen: p('Júpiter: la franja del ecuador donde la radiación daña la nave (desde dificultad media); Hangar: escudo nivel 3.', 'Jupiter: the equator band where radiation hurts the ship (from medium difficulty); Hangar: level 3 shield.'),
    simplification: p('La radiación es una franja cerca del ecuador que quita vida despacio; no hay dosis ni mediciones.', 'Radiation is a band near the equator that drains health slowly; no doses or measurements.'),
    params: [p('Daño por radiación por dificultad: valor de juego (levels.ts).', 'Radiation damage by difficulty: game value (levels.ts).')],
  },

  // ───────────── Miller ─────────────
  {
    id: 'miller', group: 'miller', name: p('Planeta Miller (océano con olas gigantes)', 'Miller\'s planet (ocean with giant waves)'), backing: 'fiction',
    links: [],
    fact: p('Miller es un planeta de ficción de la película Interstellar. No existe un enlace de NASA que lo respalde: ni sus olas gigantes, ni su gravedad, ni la vida que buscamos son datos reales. NASA sí estudia mundos oceánicos reales, pero esta pantalla no usa sus datos.',
      'Miller is a fictional planet from the film Interstellar. There is no NASA link backing it: its giant waves, gravity and the life we look for are not real data. NASA does study real ocean worlds, but this screen does not use their data.'),
    screen: p('Miller: toda la pantalla (olas, profundidad/presión, señales de vida, kelp).', 'Miller: the whole screen (waves, depth/pressure, signs of life, kelp).'),
    simplification: p('Todo es ficción estilizada. Profundidad, presión y olas son reglas de juego; el kelp es decoración.', 'All of it is stylised fiction. Depth, pressure and waves are game rules; kelp is decoration.'),
    params: [p(`Miller: Δv ${DEST.miller.dv} km/s, luz ${DEST.miller.sun}, escudo ${DEST.miller.shield} — todo de juego.`, `Miller: Δv ${DEST.miller.dv} km/s, light ${DEST.miller.sun}, shield ${DEST.miller.shield} — all game values.`)],
  },

  // ───────────── Eventos del viaje ─────────────
  {
    id: 'trip-solar-storm', group: 'trip', name: p('Evento: tormenta solar', 'Event: solar storm'), backing: 'nasa',
    links: [
      { title: 'NASA — Five questions about space weather, answered', url: 'https://www.nasa.gov/technology/five-questions-about-space-weather-and-its-effects-on-earth-answered/' },
      { title: 'NASA Science — To protect Artemis II astronauts, NASA experts keep eyes on Sun', url: 'https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/' },
    ],
    fact: p('Las llamaradas y eyecciones de masa coronal lanzan partículas que pueden dañar satélites y astronautas. Para protegerse se pueden apagar sistemas sensibles y las tripulaciones se refugian en zonas mejor blindadas.',
      'Flares and coronal mass ejections throw out particles that can harm satellites and astronauts. To protect against them, sensitive systems can be powered off and crews shelter in better-shielded areas.'),
    screen: p('Viaje (difícil y experto): evento "Tormenta solar" con dos opciones: modo seguro (pierdes tiempo) o seguir (daño al casco).', 'Trip (hard and expert): the "Solar storm" event with two options: safe mode (lose time) or keep going (hull damage).'),
    simplification: p('El evento aparece por azar y se resuelve con una elección; no hay pronóstico ni tiempo de llegada.', 'The event appears at random and is resolved with one choice; there is no forecast or arrival time.'),
    params: [p('Probabilidad, vida y energía perdidas: valores de juego (design.ts EVENTS).', 'Probability and health/energy lost: game values (design.ts EVENTS).')],
  },
  {
    id: 'trip-micrometeoroids', group: 'trip', name: p('Evento: micrometeoroides', 'Event: micrometeoroids'), backing: 'nasa',
    links: [
      { title: 'NASA — Micrometeoroids and orbital debris (MMOD)', url: 'https://www.nasa.gov/centers-and-facilities/white-sands/micrometeoroids-and-orbital-debris-mmod/' },
      { title: 'NASA KSC — Meteoroid protection practice (PD-EC-1107)', url: 'https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1107.pdf' },
    ],
    fact: p('Partículas diminutas a gran velocidad pueden dañar naves; la protección típica son mantas y escudos de varias capas separadas por un hueco.',
      'Tiny particles at high speed can damage spacecraft; typical protection is blankets and multi-layer shields separated by a gap.'),
    screen: p('Viaje (difícil y experto): evento "Micrometeoroides": girar la nave (−20 % energía) o aceptar el riesgo (daño al casco).', 'Trip (hard and expert): the "Micrometeoroids" event: turn the ship (−20% power) or accept the risk (hull damage).'),
    simplification: p('Una elección con costo fijo; el escudo del hangar reduce el daño al casco. En la realidad el riesgo se calcula con estadística.', 'One choice with a fixed cost; the hangar shield reduces hull damage. In reality the risk is calculated statistically.'),
    params: [p('Daño y reducción por nivel de escudo: valores de juego (design.ts applyEffects).', 'Damage and per-level shield reduction: game values (design.ts applyEffects).')],
  },
  {
    id: 'trip-course-correction', group: 'trip', name: p('Evento: corrección de rumbo', 'Event: course correction'), backing: 'nasa',
    links: [
      { title: 'NASA JPL — InSight steers toward Mars (trajectory correction maneuver)', url: 'https://www.jpl.nasa.gov/news/insight-steers-toward-mars/' },
      { title: 'NASA Science — Challenges of getting to Mars: the cruise to Mars', url: 'https://science.nasa.gov/resource/challenges-of-getting-to-mars-the-cruise-to-mars/' },
    ],
    fact: p('Durante el viaje a Marte las naves hacen pequeños encendidos de motores llamados maniobras de corrección de trayectoria (hasta seis en misiones reales) para llegar al punto exacto.',
      'On the way to Mars, spacecraft make small engine burns called trajectory correction maneuvers (up to six on real missions) to arrive at the exact spot.'),
    screen: p('Viaje (difícil y experto): evento "Corrección de rumbo": corregir (−10 % energía) o dejarlo (−45 s y daño al casco).', 'Trip (hard and expert): the "Course correction" event: correct (−10% power) or leave it (−45 s and hull damage).'),
    simplification: p('Una elección en pantalla en lugar de cálculos de navegación; el costo en energía/tiempo es de juego.', 'One on-screen choice instead of navigation maths; the energy/time cost is a game value.'),
    params: [p('Costo en tiempo y energía: valores de juego (design.ts EVENTS).', 'Time and energy cost: game values (design.ts EVENTS).')],
  },

  // ───────────── Economía ─────────────
  {
    id: 'game-economy', group: 'game', name: p('Dinero, presupuesto, chatarra y recompensas', 'Money, budget, scrap and rewards'), backing: 'game',
    links: [],
    fact: p('No hay respaldo NASA: los precios, el presupuesto, la chatarra, las mejoras del taller y las recompensas son diseño del juego para enseñar a decidir con recursos limitados.',
      'No NASA backing: prices, budget, scrap, workshop upgrades and rewards are game design to teach decisions under limited resources.'),
    screen: p('Hangar (cuenta de gastos), contador de dinero arriba a la izquierda, Taller, tarjetas de la partida y pantalla de calificación.', 'Hangar (bill), wallet counter top-left, Workshop, run cards and the grade screen.'),
    simplification: p('Los costos no son dólares ni reflejan precios reales de misiones; son puntos de juego.', 'Costs are not dollars and do not reflect real mission prices; they are game points.'),
    params: [p(`Presupuesto: difícil ${BUDGET.hard}, experto ${BUDGET.expert}. Cohetes, instrumentos, paneles y baterías tienen costos propios (ver tarjetas de la nave).`, `Budget: hard ${BUDGET.hard}, expert ${BUDGET.expert}. Rockets, instruments, panels and batteries have their own costs (see ship cards).`)],
  },
];

export const isNasaUrl = (u: string) => { try { const h = new URL(u).hostname; return u.startsWith('https://') && (h === 'nasa.gov' || h.endsWith('.nasa.gov')); } catch { return false; } };
