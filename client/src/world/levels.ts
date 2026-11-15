export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert'];

/** How hard the missions are. Everything the three worlds need to scale with the chosen level. */
export interface Mods {
  level: Level;
  /** samples / signs of life / zones needed to complete the mission */
  required: number;
  /** seconds between hazards (meteors, giant waves) */
  hazardGap: [number, number];
  hazardDmg: number;
  /** multiplies energy use */
  drainMul: number;
  /** 0 = no time limit */
  timeLimit: number;
  /** submarine: depth in metres before the hull is crushed (standard hull) */
  hullDepth: number;
  /** Jupiter: radiation damage scale near the equator */
  radiation: number;
  /** Jupiter: boosting uses limited fuel */
  fuel: boolean;
  /** enemies: how many at once, seconds between spawns, seconds between waves (0 = none), hit points, speed (fraction of the player's top speed), damage per touch */
  enemyMax: number; spawnEvery: number; waveEvery: number; enemyHp: number; enemySpeed: number; enemyDmg: number;
  thiefChance: number; scrapMul: number;
  /** set by the trip: hull % and energy fraction the mission starts with */
  startHealth?: number;
  startEnergy?: number;
}

const TABLE: Record<Level, Omit<Mods, 'level'>> = {
  easy: { required: 3, hazardGap: [10, 18], hazardDmg: 14, drainMul: 0.5, timeLimit: 0, hullDepth: 150, radiation: 0, fuel: false, enemyMax: 2, spawnEvery: 40, waveEvery: 0, enemyHp: 3, enemySpeed: 0.5, enemyDmg: 8, thiefChance: 0.2, scrapMul: 0.8 },
  medium: { required: 4, hazardGap: [7, 13], hazardDmg: 18, drainMul: 1, timeLimit: 0, hullDepth: 110, radiation: 0.4, fuel: false, enemyMax: 4, spawnEvery: 26, waveEvery: 0, enemyHp: 4, enemySpeed: 0.68, enemyDmg: 12, thiefChance: 0.3, scrapMul: 1 },
  hard: { required: 5, hazardGap: [5, 9], hazardDmg: 22, drainMul: 1.4, timeLimit: 420, hullDepth: 90, radiation: 0.8, fuel: true, enemyMax: 6, spawnEvery: 18, waveEvery: 100, enemyHp: 6, enemySpeed: 0.82, enemyDmg: 16, thiefChance: 0.4, scrapMul: 1.3 },
  expert: { required: 6, hazardGap: [4, 7], hazardDmg: 28, drainMul: 1.8, timeLimit: 300, hullDepth: 70, radiation: 1.2, fuel: true, enemyMax: 8, spawnEvery: 12, waveEvery: 70, enemyHp: 9, enemySpeed: 0.95, enemyDmg: 22, thiefChance: 0.5, scrapMul: 1.7 },
};
export const modsFor = (level: Level): Mods => ({ level, ...TABLE[level] });

export const LEVEL_INFO: Record<Level, { es: string; en: string; descEs: string; descEn: string; color: string; stars: number }> = {
  easy: { es: 'Fácil', en: 'Easy', descEs: 'Elige 2 cosas y a jugar. Sin números.', descEn: 'Pick 2 things and play. No numbers.', color: '#5ee6a8', stars: 1 },
  medium: { es: 'Medio', en: 'Medium', descEs: 'Más decisiones: cohete, energía y 1 prueba antes de despegar.', descEn: 'More choices: rocket, power and a pre-flight test.', color: '#ffc857', stars: 2 },
  hard: { es: 'Difícil', en: 'Hard', descEs: 'Presupuesto, varios instrumentos, 4 pruebas y eventos en el viaje.', descEn: 'Budget, several instruments, 4 tests and events on the trip.', color: '#ff9a5c', stars: 3 },
  expert: { es: 'Experto', en: 'Expert', descEs: 'Nivel ingeniero: números reales, márgenes, Δv, 7 pruebas y decisiones técnicas.', descEn: 'Engineer level: real numbers, margins, Δv, 7 tests and technical decisions.', color: '#ff5d73', stars: 4 },
};

const KEY = 'frontier-level';
export function readLevel(): Level { try { const v = localStorage.getItem(KEY); if (v && (LEVELS as string[]).includes(v)) return v as Level; } catch { /* private mode */ } return 'easy'; }
export function saveLevel(l: Level) { try { localStorage.setItem(KEY, l); } catch { /* private mode */ } }
export const TUTORIAL_KEY = 'frontier-tutorial-done';
export function tutorialDone(): boolean { try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { return false; } }
export function markTutorialDone() { try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* private mode */ } }
