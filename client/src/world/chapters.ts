import type { Job, Obj, Rules } from './board';
import type { Dest } from './design';
import type { L } from './sources';

/** The main story: six chapters in order. Each is a special job on the mission board of its planet; finishing it tells the next part of the story. */
export interface Chapter { n: number; id: string; world: Dest; title: L; intro: L; obj: Obj; now?: Rules; reward: number; unlocks?: string }
const p = (es: string, en: string): L => ({ es, en });
export const CHAPTERS: Chapter[] = [
  { n: 1, id: 'ch1', world: 'mars', title: p('La señal de la base', 'The base signal'), intro: p('Una señal débil llegó al módulo desde Marte. Ve, junta lo que pide la misión y vuelve.', 'A faint signal reached the lander from Mars. Go, gather what the mission asks and come back.'), obj: { k: 'goals', n: 0 }, reward: 30 },
  { n: 2, id: 'ch2', world: 'mars', title: p('Agua bajo la arena', 'Water under the sand'), intro: p('La señal venía de una zona con hielo. Consigue un objetivo más de los que pide la misión.', 'The signal came from an icy area. Get one more goal than the mission asks.'), obj: { k: 'goals', n: 1 }, reward: 40, unlocks: 'nube' },
  { n: 3, id: 'ch3', world: 'jupiter', title: p('Ecos en la tormenta', 'Echoes in the storm'), intro: p('La misma señal rebota en Júpiter. Cruza la tormenta y termina con 60 % de casco o más.', 'The same signal bounces off Jupiter. Cross the storm and finish with 60% hull or more.'), obj: { k: 'hull', n: 60 }, now: { hazard: 0.15 }, reward: 50 },
  { n: 4, id: 'ch4', world: 'miller', title: p('Lo que late en el fondo', 'What beats in the deep'), intro: p('Algo late bajo las olas de Miller. Encuentra una señal más de las que pide la misión.', 'Something beats under Miller’s waves. Find one more sign than the mission asks.'), obj: { k: 'goals', n: 1 }, now: { drain: 0.1 }, reward: 60, unlocks: 'lupa' },
  { n: 5, id: 'ch5', world: 'mars', title: p('El guardián del cráter', 'The crater guardian'), intro: p('La fuente está en un cráter con guardianes. Derrota a 4 enemigos.', 'The source is in a crater with guardians. Defeat 4 enemies.'), obj: { k: 'kills', n: 4 }, now: { enemy: 0.4 }, reward: 70 },
  { n: 6, id: 'ch6', world: 'jupiter', title: p('La gran señal', 'The great signal'), intro: p('Todo lleva aquí. Saca calificación 70 o más para escuchar la señal completa.', 'It all leads here. Score 70 or more to hear the whole signal.'), obj: { k: 'score', n: 70 }, now: { hazard: 0.2, enemy: 0.2 }, reward: 120, unlocks: 'brisa' },
];
/** The first chapter not finished yet, or null once the story is over. */
export const nextChapter = (story: string[]): Chapter | null => CHAPTERS.find(c => !story.includes(c.id)) ?? null;
export const chapterJob = (c: Chapter): Job => ({ id: c.id, world: c.world, tier: 1, icon: '📖', es: `Capítulo ${c.n}: ${c.title.es}`, en: `Chapter ${c.n}: ${c.title.en}`, descEs: c.intro.es, descEn: c.intro.en, obj: c.obj, now: c.now, reward: c.reward });
export const isChapterJob = (id: string) => /^ch[1-6]$/.test(id);
export const chapterOf = (id: string) => CHAPTERS.find(c => c.id === id);
