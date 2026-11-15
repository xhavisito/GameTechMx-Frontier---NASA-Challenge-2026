/** A light story told by the base crew in short messages. Each beat is shown once, when the player first does something.
 *  Science lines stay general and point to the "Science and sources" card, where the NASA links and the simplifications live. */
export type Who = 'ada' | 'tuerca';
export interface Line { who: Who; es: string; en: string }
export interface Beat { id: string; lines: Line[]; /** science card to read next */ card?: string }
export const WHO: Record<Who, { icon: string; es: string; en: string }> = {
  ada: { icon: '👩‍🚀', es: 'Ada · jefa de la base', en: 'Ada · base chief' },
  tuerca: { icon: '🤖', es: 'Tuerca · robot de la base', en: 'Tuerca · base robot' },
};
const A = (es: string, en: string): Line => ({ who: 'ada', es, en }), T = (es: string, en: string): Line => ({ who: 'tuerca', es, en });

export const BEATS: Beat[] = [
  { id: 'welcome', lines: [
    A('¡Bienvenido a la Base Frontier! Desde aquí mandamos exploradores a otros mundos para aprender cómo son.', 'Welcome to Frontier Base! From here we send explorers to other worlds to learn what they are like.'),
    T('Yo soy Tuerca. Pasa por el hangar, arma tu nave y luego ve al cohete. ¡Y si te aburres, hay una canchita y una carrera de conos!', 'I am Tuerca. Visit the hangar, build your ship, then head to the rocket. And if you get bored there is a pitch and a cone race!'),
  ] },
  { id: 'first_launch', card: 'rocket-equation', lines: [
    A('Cada despegue es un balance: más carga pide más combustible. Por eso la nave tiene que ser ligera.', 'Every launch is a balance: more cargo needs more fuel. That is why the ship has to be light.'),
    T('Y gastar dinero en el equipo también cuenta. ¡Elige con cabeza!', 'And spending money on gear counts too. Choose wisely!'),
  ] },
  { id: 'm_mars', card: 'mars-dust', lines: [
    A('Marte es un desierto frío y polvoriento. El polvo puede tapar los paneles solares, así que cuida tu energía.', 'Mars is a cold, dusty desert. Dust can cover solar panels, so watch your energy.'),
    T('Lo que recoges ahí nos ayuda a entender cómo cambió ese mundo.', 'What you collect there helps us understand how that world changed.'),
  ] },
  { id: 'm_jupiter', card: 'jup-grs', lines: [
    A('Júpiter es un planeta gigante de gas, con bandas de nubes y tormentas enormes. No tiene suelo: se estudia desde la órbita.', 'Jupiter is a giant gas planet with cloud bands and huge storms. It has no ground: it is studied from orbit.'),
    T('Y hay radiación fuerte. ¡No te acerques demasiado al planeta!', 'And there is strong radiation. Do not linger too close to the planet!'),
  ] },
  { id: 'm_miller', card: 'miller', lines: [
    A('Miller no existe en la vida real: es un mundo de ciencia ficción con un océano de olas gigantes.', 'Miller is not real: it is a science-fiction world with an ocean of giant waves.'),
    T('Aun así, nos sirve para imaginar qué buscar si algún día hay agua en otros mundos.', 'Still, it helps us imagine what to look for if there is ever water on other worlds.'),
  ] },
  { id: 'first_boss', lines: [
    A('¡Derrotaste a un jefe de zona! Cada uno guarda su zona a su manera: observa su aviso y aléjate a tiempo.', 'You defeated a zone boss! Each guards its area in its own way: watch its warning and step away in time.'),
    T('Cada cuarta misión aparece uno. ¡Lleva arma y mejoras!', 'One shows up every fourth mission. Bring a weapon and upgrades!'),
  ] },
  { id: 'three_worlds', lines: [
    A('¡Marte, Júpiter y Miller! Ya eres de los exploradores más completos de la base.', 'Mars, Jupiter and Miller! You are now one of the most complete explorers on the base.'),
    T('Mira tus tarjetas de ciencia: ahí está de dónde sale todo lo que aprendiste.', 'Check your science cards: that is where everything you learned comes from.'),
  ] },
  { id: 'daily_first', lines: [
    A('El reto del día es igual para todos: mismo mundo, mismo equipo. Aquí cuenta la habilidad, no las mejoras.', 'The daily challenge is the same for everyone: same world, same gear. Skill counts here, not upgrades.'),
    T('Vuelve cada día para hacer racha. 🔥', 'Come back every day to build a streak. 🔥'),
  ] },
];
export const beatById = (id: string) => BEATS.find(b => b.id === id);
