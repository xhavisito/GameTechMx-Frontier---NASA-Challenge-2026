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
  /** set by the trip: hull % and energy fraction the mission starts with */
  startHealth?: number;
  startEnergy?: number;
}

const TABLE: Record<Level, Omit<Mods, 'level'>> = {
  easy: { required: 3, hazardGap: [10, 18], hazardDmg: 14, drainMul: 0.5, timeLimit: 0, hullDepth: 150, radiation: 0, fuel: false },
  medium: { required: 4, hazardGap: [7, 13], hazardDmg: 18, drainMul: 1, timeLimit: 0, hullDepth: 110, radiation: 0.4, fuel: false },
  hard: { required: 5, hazardGap: [5, 9], hazardDmg: 22, drainMul: 1.4, timeLimit: 420, hullDepth: 90, radiation: 0.8, fuel: true },
  expert: { required: 6, hazardGap: [4, 7], hazardDmg: 28, drainMul: 1.8, timeLimit: 300, hullDepth: 70, radiation: 1.2, fuel: true },
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
