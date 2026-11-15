import type { Mods } from './levels';
import type { Perks } from './meta';
import type { Contract } from './contracts';
import { gradeOf, tally, type MarsResult, type Part } from './marsWorld';

export const weaponDmg = (w: number) => 1.5 + 0.9 * (w - 1);
export const weaponCd = (p: Perks) => 0.65 / p.reload;
export const grade = gradeOf;

/** Score for side contracts (beacons, rescue, photo) and the shared extras. */
export function contractResult(done: number, need: number, health: number, seconds: number, kills: number, exploded: boolean, lost: number): MarsResult {
  const complete = done >= need;
  const t = tally([
    { es: complete ? `Objetivos cumplidos: ${done} de ${need}` : `Objetivos: ${done} de ${need} (faltaron)`, en: complete ? `Goals completed: ${done} of ${need}` : `Goals: ${done} of ${need} (not finished)`, pts: complete ? 55 : (done / need) * 35, max: 55 },
    { es: `Casco al final: ${Math.round(health)} %`, en: `Hull at the end: ${Math.round(health)}%`, pts: health * 0.2, max: 20 },
    { es: `Rapidez (${Math.round(seconds)} s; solo cuenta si terminas)`, en: `Speed (${Math.round(seconds)} s; only counts if you finish)`, pts: complete ? Math.max(0, 12 - seconds / 40) : 0, max: 12 },
    { es: `Enemigos derrotados: ${kills}`, en: `Enemies defeated: ${kills}`, pts: Math.min(10, kills * 2), max: 10 },
    ...(lost > 0 ? [{ es: `Robos que no recuperaste: ${lost} (−4 c/u)`, en: `Thefts you did not undo: ${lost} (−4 each)`, pts: -lost * 4 }] : []),
  ]);
  return { score: t.score, science: done * 10, returned: complete, grade: t.grade, samples: [], kills, pois: done, exploded, lost, why: t.why };
}
/** Scrap earned by a run, line by line. Exploding costs half; harder levels and riskier contracts pay more. */
export function scrapParts(r: Pick<MarsResult, 'score' | 'kills' | 'pois' | 'exploded' | 'returned'>, mods: Mods, perks: Perks, c: Contract): { base: Part[]; mult: { es: string; en: string; k: number }[] } {
  const base: Part[] = [
    { es: `Calificación ${r.score}/100 × 0.5`, en: `Grade ${r.score}/100 × 0.5`, pts: r.score * 0.5 },
    { es: `Enemigos derrotados: ${r.kills ?? 0} × 3`, en: `Enemies defeated: ${r.kills ?? 0} × 3`, pts: (r.kills ?? 0) * 3 },
    { es: `Objetivos: ${r.pois ?? 0} × 6`, en: `Goals: ${r.pois ?? 0} × 6`, pts: (r.pois ?? 0) * 6 },
    { es: r.returned ? 'Misión completada' : 'Misión sin completar', en: r.returned ? 'Mission completed' : 'Mission not completed', pts: r.returned ? 10 : 0 },
  ];
  const mult = [
    { es: `Contrato «${c.es}»`, en: `Contract “${c.en}”`, k: c.reward },
    { es: 'Dificultad', en: 'Difficulty', k: mods.scrapMul },
    ...(perks.luck !== 1 ? [{ es: 'Carta / mejoras de suerte', en: 'Luck card / upgrades', k: perks.luck }] : []),
    ...(r.exploded ? [{ es: 'La nave explotó (mitad)', en: 'The ship exploded (half)', k: 0.5 }] : []),
  ];
  return { base, mult };
}
/** Scrap earned by a run. */
export function scrapReward(r: Pick<MarsResult, 'score' | 'kills' | 'pois' | 'exploded' | 'returned'>, mods: Mods, perks: Perks, c: Contract): number {
  const { base, mult } = scrapParts(r, mods, perks, c);
  return Math.max(5, Math.round(base.reduce((a, p) => a + p.pts, 0) * mult.reduce((a, m) => a * m.k, 1)));
}
