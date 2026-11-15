/** Roguelite meta-progression: scrap earned in missions buys upgrades for each ship in the workshop. Saved in localStorage. */
export type Ship = 'rover' | 'orbiter' | 'sub' | 'rocket';
export const SHIPS: Ship[] = ['rover', 'orbiter', 'sub', 'rocket'];

export interface Upgrade { id: string; ship: Ship; max: number; base: number; es: string; en: string; descEs: string; descEn: string; requires?: { id: string; level: number }; weapon?: boolean }
const U = (id: string, ship: Ship, max: number, base: number, es: string, en: string, descEs: string, descEn: string, requires?: Upgrade['requires'], weapon = false): Upgrade => ({ id, ship, max, base, es, en, descEs, descEn, requires, weapon });

export const UPGRADES: Upgrade[] = [
  U('r_hull', 'rover', 4, 18, 'Casco reforzado', 'Reinforced hull', '+15 de vida por nivel', '+15 health per level'),
  U('r_battery', 'rover', 4, 18, 'Batería ampliada', 'Bigger battery', '+15 % de energía por nivel', '+15% energy per level'),
  U('r_wheels', 'rover', 3, 24, 'Ruedas todo terreno', 'Off-road wheels', '+8 % de velocidad por nivel', '+8% speed per level'),
  U('r_arm', 'rover', 3, 26, 'Brazo mejorado', 'Better arm', 'Alcanza muestras más lejos y vale más ciencia', 'Reaches farther and samples are worth more'),
  U('r_scan', 'rover', 3, 28, 'Escáner', 'Scanner', '+8 m de alcance de detección por nivel', '+8 m detection range per level', { id: 'r_arm', level: 1 }),
  U('r_armor', 'rover', 3, 30, 'Blindaje', 'Armor plating', '−15 % de daño por nivel', '−15% damage per level', { id: 'r_hull', level: 2 }),
  U('r_laser', 'rover', 1, 70, 'Láser', 'Laser', 'Desbloquea el arma: ¡ya puedes derrotar enemigos! (R)', 'Unlocks the weapon: you can now defeat enemies! (R)', { id: 'r_arm', level: 2 }, true),
  U('r_laserpow', 'rover', 3, 40, 'Potencia del láser', 'Laser power', 'Más daño y recarga más rápida', 'More damage, faster reload', { id: 'r_laser', level: 1 }, true),

  U('o_hull', 'orbiter', 4, 18, 'Casco reforzado', 'Reinforced hull', '+15 de vida por nivel', '+15 health per level'),
  U('o_engine', 'orbiter', 3, 24, 'Motores', 'Engines', '+8 % de velocidad por nivel', '+8% speed per level'),
  U('o_fuel', 'orbiter', 3, 22, 'Tanque de turbo', 'Boost tank', 'El turbo se recarga más rápido', 'Boost refills faster'),
  U('o_shield', 'orbiter', 3, 28, 'Escudo de radiación', 'Radiation shield', '−25 % de radiación por nivel', '−25% radiation per level', { id: 'o_hull', level: 1 }),
  U('o_scan', 'orbiter', 3, 28, 'Sensores', 'Sensors', 'Escaneas zonas desde más lejos', 'Scan zones from farther away', { id: 'o_engine', level: 1 }),
  U('o_cannon', 'orbiter', 1, 70, 'Cañón de pulsos', 'Pulse cannon', 'Desbloquea el arma (R)', 'Unlocks the weapon (R)', { id: 'o_hull', level: 2 }, true),
  U('o_cannonpow', 'orbiter', 3, 40, 'Potencia del cañón', 'Cannon power', 'Más daño y recarga más rápida', 'More damage, faster reload', { id: 'o_cannon', level: 1 }, true),

  U('s_hull', 'sub', 4, 18, 'Casco reforzado', 'Reinforced hull', '+15 de vida por nivel', '+15 health per level'),
  U('s_pressure', 'sub', 4, 24, 'Casco de presión', 'Pressure hull', '+15 m de profundidad segura por nivel', '+15 m safe depth per level', { id: 's_hull', level: 1 }),
  U('s_battery', 'sub', 3, 20, 'Baterías', 'Batteries', '+20 % de energía por nivel', '+20% energy per level'),
  U('s_thrust', 'sub', 3, 24, 'Propulsores', 'Thrusters', '+8 % de velocidad por nivel', '+8% speed per level'),
  U('s_sonar', 'sub', 3, 28, 'Sonar', 'Sonar', '+8 m de alcance por nivel', '+8 m range per level', { id: 's_thrust', level: 1 }),
  U('s_torpedo', 'sub', 1, 70, 'Torpedos', 'Torpedoes', 'Desbloquea el arma (R)', 'Unlocks the weapon (R)', { id: 's_hull', level: 2 }, true),
  U('s_torpedopow', 'sub', 3, 40, 'Potencia de torpedos', 'Torpedo power', 'Más daño y recarga más rápida', 'More damage, faster reload', { id: 's_torpedo', level: 1 }, true),

  U('k_fuel', 'rocket', 4, 22, 'Propelente', 'Propellant', '+0.15 km/s de Δv por nivel', '+0.15 km/s Δv per level'),
  U('k_frame', 'rocket', 3, 24, 'Estructura ligera', 'Light structure', '+100 kg de carga máxima por nivel', '+100 kg max payload per level'),
  U('k_shield', 'rocket', 3, 26, 'Escudo de reentrada', 'Re-entry shield', '−25 % de daño en los eventos del viaje', '−25% damage from trip events'),
  U('k_fund', 'rocket', 3, 30, 'Financiamiento', 'Funding', '+12 M$ de presupuesto por nivel', '+12 M$ budget per level', { id: 'k_fuel', level: 1 }),
];
export const upgradeById = (id: string) => UPGRADES.find(u => u.id === id)!;
export const upgradesOf = (ship: Ship) => UPGRADES.filter(u => u.ship === ship);

export interface Meta { scrap: number; levels: Record<string, number>; runs: number; best: number; kills: number }
export const newMeta = (): Meta => ({ scrap: 40, levels: {}, runs: 0, best: 0, kills: 0 });
export const lvl = (m: Meta, id: string) => m.levels[id] ?? 0;
export const costOf = (m: Meta, id: string) => { const u = upgradeById(id); return Math.round(u.base * (1 + lvl(m, id) * 0.9) ** 1.25); };
export function lockReason(m: Meta, id: string): string | null {
  const u = upgradeById(id);
  if (lvl(m, id) >= u.max) return 'max';
  if (u.requires && lvl(m, u.requires.id) < u.requires.level) return 'req';
  if (m.scrap < costOf(m, id)) return 'scrap';
  return null;
}
export function buy(m: Meta, id: string): Meta {
  if (lockReason(m, id)) return m;
  return { ...m, scrap: m.scrap - costOf(m, id), levels: { ...m.levels, [id]: lvl(m, id) + 1 } };
}
export const tierOf = (m: Meta, ship: Ship): 0 | 1 | 2 | 3 => {
  const total = upgradesOf(ship).reduce((a, u) => a + lvl(m, u.id), 0), max = upgradesOf(ship).reduce((a, u) => a + u.max, 0);
  const f = total / max; return f >= 0.7 ? 3 : f >= 0.4 ? 2 : f >= 0.12 ? 1 : 0;
};

/** What the ship brings into a mission. Everything is a plain number so the worlds just multiply. */
export interface Perks {
  health: number; energyMul: number; speedMul: number; scan: number; reach: number; science: number; armor: number;
  weapon: number; /** 0 = no weapon, then 1..4 */
  radiation: number; boostRegen: number; depth: number; luck: number; enemySlow: number; enemyMore: number; payload: number; dv: number; budget: number; tripShield: number; reload: number;
}
export const basePerks = (): Perks => ({ health: 100, energyMul: 1, speedMul: 1, scan: 0, reach: 0, science: 1, armor: 0, weapon: 0, radiation: 1, boostRegen: 1, depth: 0, luck: 1, enemySlow: 1, enemyMore: 1, payload: 0, dv: 0, budget: 0, tripShield: 0, reload: 1 });

export function perksFor(ship: Ship, m: Meta): Perks {
  const p = basePerks(), L = (id: string) => lvl(m, id);
  if (ship === 'rover') {
    p.health += 15 * L('r_hull'); p.energyMul += 0.15 * L('r_battery'); p.speedMul += 0.08 * L('r_wheels'); p.reach += 0.8 * L('r_arm'); p.science += 0.1 * L('r_arm');
    p.scan += 8 * L('r_scan'); p.armor += 0.15 * L('r_armor'); p.weapon = L('r_laser') ? 1 + L('r_laserpow') : 0;
  } else if (ship === 'orbiter') {
    p.health += 15 * L('o_hull'); p.speedMul += 0.08 * L('o_engine'); p.boostRegen += 0.35 * L('o_fuel'); p.radiation -= 0.25 * L('o_shield'); p.scan += 0.04 * L('o_scan');
    p.weapon = L('o_cannon') ? 1 + L('o_cannonpow') : 0;
  } else if (ship === 'sub') {
    p.health += 15 * L('s_hull'); p.depth += 15 * L('s_pressure'); p.energyMul += 0.2 * L('s_battery'); p.speedMul += 0.08 * L('s_thrust'); p.scan += 8 * L('s_sonar');
    p.weapon = L('s_torpedo') ? 1 + L('s_torpedopow') : 0;
  } else {
    p.dv += 0.15 * L('k_fuel'); p.payload += 100 * L('k_frame'); p.tripShield += 0.25 * L('k_shield'); p.budget += 12 * L('k_fund');
  }
  p.reload = 1 + 0.18 * Math.max(0, p.weapon - 1);
  return p;
}

// ── draft cards: pick 1 of 3 at the start of every run ───────────────────────
export interface RunCard { id: string; es: string; en: string; descEs: string; descEn: string; fx: Partial<Perks>; risk?: boolean }
export const RUN_CARDS: RunCard[] = [
  { id: 'turbo', es: 'Turbo extra', en: 'Extra turbo', descEs: '+20 % de velocidad', descEn: '+20% speed', fx: { speedMul: 0.2 } },
  { id: 'plating', es: 'Placas extra', en: 'Spare plating', descEs: '+30 de vida', descEn: '+30 health', fx: { health: 30 } },
  { id: 'cell', es: 'Celda de energía', en: 'Power cell', descEs: '+30 % de energía', descEn: '+30% energy', fx: { energyMul: 0.3 } },
  { id: 'magnet', es: 'Imán de recolección', en: 'Collection magnet', descEs: '+2 m de alcance para recoger', descEn: '+2 m pickup reach', fx: { reach: 2 } },
  { id: 'lens', es: 'Lente de largo alcance', en: 'Long lens', descEs: '+14 de alcance de detección', descEn: '+14 detection range', fx: { scan: 14 } },
  { id: 'quick', es: 'Recarga rápida', en: 'Quick reload', descEs: 'El arma recarga 35 % más rápido', descEn: 'Weapon reloads 35% faster', fx: { reload: 0.35 } },
  { id: 'decoy', es: 'Señuelo', en: 'Decoy', descEs: 'Los enemigos son 20 % más lentos', descEn: 'Enemies are 20% slower', fx: { enemySlow: -0.2 } },
  { id: 'glass', es: 'Cañón de cristal', en: 'Glass cannon', descEs: '+40 % de velocidad pero −30 de vida', descEn: '+40% speed but −30 health', fx: { speedMul: 0.4, health: -30 }, risk: true },
  { id: 'greed', es: 'Codicia', en: 'Greed', descEs: '+50 % de chatarra, pero 30 % más enemigos', descEn: '+50% scrap, but 30% more enemies', fx: { luck: 0.5, enemyMore: 0.3 }, risk: true },
  { id: 'overclock', es: 'Sobrecarga', en: 'Overclock', descEs: '+25 % de velocidad y +25 % de energía, pero −20 de vida', descEn: '+25% speed and +25% energy, but −20 health', fx: { speedMul: 0.25, energyMul: 0.25, health: -20 }, risk: true },
];
export function draw(seed: number, n = 3): RunCard[] {
  const pool = RUN_CARDS.slice(); const out: RunCard[] = []; let s = seed >>> 0;
  while (out.length < n && pool.length) { s = (s * 1664525 + 1013904223) >>> 0; out.push(pool.splice(s % pool.length, 1)[0]!); }
  return out;
}
export function withCard(p: Perks, c: RunCard | null): Perks {
  if (!c) return p; const o = { ...p };
  for (const k of Object.keys(c.fx) as (keyof Perks)[]) o[k] = (o[k] as number) + (c.fx[k] as number);
  return o;
}

// ── persistence ──────────────────────────────────────────────────────────────
const KEY = 'frontier-meta-v1';
export function loadMeta(): Meta {
  try { const raw = localStorage.getItem(KEY); if (raw) { const m = JSON.parse(raw) as Meta; return { ...newMeta(), ...m, levels: { ...m.levels } }; } } catch { /* private mode */ }
  return newMeta();
}
export function saveMeta(m: Meta) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private mode */ } }
