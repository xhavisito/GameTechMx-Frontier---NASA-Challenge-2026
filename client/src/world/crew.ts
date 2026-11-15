import { useSyncExternalStore } from 'react';
import type { Perks } from './meta';
import type { Mods } from './levels';
import type { L } from './sources';

/** Crew mates ride along with you: one at a time, each with a small passive advantage. Unlocked by playing, never bought. */
export interface Mate { id: string; icon: string; name: L; role: L; desc: L; fx: Partial<Perks>; /** hazard damage change (−0.15 = 15 % less) */ hazard?: number; unlock: { es: string; en: string; ok: (c: CrewCtx) => boolean } }
export interface CrewCtx { missions: number; story: string[]; ach: string[] }
const p = (es: string, en: string): L => ({ es, en });
export const MATES: Mate[] = [
  { id: 'ada', icon: '👩‍🚀', name: p('Ada', 'Ada'), role: p('Navegante', 'Navigator'), desc: p('Ves enemigos y muestras más lejos (+8)', 'See enemies and samples farther (+8)'), fx: { scan: 8 }, unlock: { es: 'Desde el inicio', en: 'From the start', ok: () => true } },
  { id: 'tuerca', icon: '🤖', name: p('Tuerca', 'Tuerca'), role: p('Mecánico', 'Mechanic'), desc: p('+20 de vida', '+20 health'), fx: { health: 20 }, unlock: { es: 'Desde el inicio', en: 'From the start', ok: () => true } },
  { id: 'nube', icon: '🐱', name: p('Nube', 'Cloud'), role: p('Gatita copiloto', 'Co-pilot kitten'), desc: p('+10 % de velocidad y enemigos 10 % más lentos', '+10% speed and enemies 10% slower'), fx: { speedMul: 0.1, enemySlow: -0.1 }, unlock: { es: 'Capítulo 2 de la historia', en: 'Story chapter 2', ok: c => c.story.includes('ch2') } },
  { id: 'lupa', icon: '🔬', name: p('Dra. Lupa', 'Dr. Lens'), role: p('Científica', 'Scientist'), desc: p('+25 % de ciencia y +10 % de chatarra', '+25% science and +10% scrap'), fx: { science: 0.25, luck: 0.1 }, unlock: { es: 'Capítulo 4 de la historia', en: 'Story chapter 4', ok: c => c.story.includes('ch4') } },
  { id: 'brisa', icon: '🧑‍✈️', name: p('Capitán Brisa', 'Captain Breeze'), role: p('Piloto veterano', 'Veteran pilot'), desc: p('Recibes 12 % menos daño y los peligros pegan 15 % menos', 'You take 12% less damage and hazards hit 15% less'), fx: { armor: 0.12 }, hazard: -0.15, unlock: { es: 'Final de la historia (capítulo 6)', en: 'Story ending (chapter 6)', ok: c => c.story.includes('ch6') } },
  { id: 'estrella', icon: '⭐', name: p('Estrella', 'Star'), role: p('Cadete', 'Cadet'), desc: p('Recarga del arma 20 % más rápida y +2 m para recoger', 'Weapon reloads 20% faster and +2 m pickup reach'), fx: { reload: 0.2, reach: 2 }, unlock: { es: 'Completa 5 misiones', en: 'Complete 5 missions', ok: c => c.missions >= 5 } },
];
export const mateById = (id: string) => MATES.find(m => m.id === id);
export const isOpen = (m: Mate, c: CrewCtx) => m.unlock.ok(c);
export function applyMate(p: Perks, id: string | null): Perks {
  const m = id ? mateById(id) : null; if (!m) return p; const o = { ...p };
  for (const k of Object.keys(m.fx) as (keyof Perks)[]) o[k] = (o[k] as number) + (m.fx[k] as number);
  return o;
}
export const applyMateMods = (m: Mods, id: string | null): Mods => { const d = id ? mateById(id)?.hazard : 0; return d ? { ...m, hazardDmg: Math.max(1, Math.round(m.hazardDmg * (1 + d))) } : m; };
/** A saved mate that is no longer open (after a reset) falls back to Ada. */
export const safeMate = (id: string | null, c: CrewCtx): string => { const m = id ? mateById(id) : null; return m && isOpen(m, c) ? m.id : 'ada'; };

const KEY = 'frontier-crew-v1';
let cur: string = (() => { try { return localStorage.getItem(KEY) ?? 'ada'; } catch { return 'ada'; } })();
const subs = new Set<() => void>();
export const getMate = () => cur;
export function setMate(id: string) { cur = id; try { localStorage.setItem(KEY, id); } catch { /* private mode */ } subs.forEach(f => f()); }
export const useMate = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, getMate);
export const CREW_KEY = KEY;
