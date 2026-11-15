import { useSyncExternalStore } from 'react';
import type { L } from './sources';

/** Looks you unlock with achievements. They never change difficulty: paint for the rover, dust colour and a pennant on the mast. */
export type Slot = 'paint' | 'trail' | 'flag';
export interface Item { id: string; slot: Slot; icon: string; name: L; /** [front, back] for paint; one colour otherwise */ colors: string[]; ach?: string }
const p = (es: string, en: string): L => ({ es, en });
export const ITEMS: Item[] = [
  { id: 'paint-classic', slot: 'paint', icon: '🟦', name: p('Clásico', 'Classic'), colors: ['#3d78d8', '#ff8a3d'] },
  { id: 'paint-sunset', slot: 'paint', icon: '🌅', name: p('Atardecer', 'Sunset'), colors: ['#ff5d73', '#ffc857'], ach: 'mission' },
  { id: 'paint-mint', slot: 'paint', icon: '🌿', name: p('Menta', 'Mint'), colors: ['#2fbf8f', '#e8fff4'], ach: 'goals5' },
  { id: 'paint-violet', slot: 'paint', icon: '🔮', name: p('Violeta', 'Violet'), colors: ['#7b4fd8', '#ff8fc7'], ach: 'worlds' },
  { id: 'paint-gold', slot: 'paint', icon: '🏅', name: p('Dorado', 'Gold'), colors: ['#ffc857', '#fff4c9'], ach: 'sgrade' },
  { id: 'paint-night', slot: 'paint', icon: '🌙', name: p('Noche', 'Night'), colors: ['#2a1f3d', '#5ee6a8'], ach: 'boss' },
  { id: 'trail-dust', slot: 'trail', icon: '🟤', name: p('Polvo normal', 'Normal dust'), colors: ['#d9a074'] },
  { id: 'trail-pink', slot: 'trail', icon: '🌸', name: p('Polvo rosa', 'Pink dust'), colors: ['#ff8fc7'], ach: 'cones' },
  { id: 'trail-blue', slot: 'trail', icon: '💙', name: p('Polvo azul', 'Blue dust'), colors: ['#7fdcff'], ach: 'jumps' },
  { id: 'trail-gold', slot: 'trail', icon: '✨', name: p('Polvo dorado', 'Golden dust'), colors: ['#ffd84d'], ach: 'rich' },
  { id: 'flag-none', slot: 'flag', icon: '➖', name: p('Sin banderín', 'No pennant'), colors: [] },
  { id: 'flag-red', slot: 'flag', icon: '🚩', name: p('Banderín rojo', 'Red pennant'), colors: ['#ff4d5e'], ach: 'launch' },
  { id: 'flag-green', slot: 'flag', icon: '🟩', name: p('Banderín verde', 'Green pennant'), colors: ['#3ddc84'], ach: 'daily' },
  { id: 'flag-purple', slot: 'flag', icon: '🧠', name: p('Banderín de estudioso', 'Scholar pennant'), colors: ['#b39ddb'], ach: 'scholar' },
  { id: 'flag-silver', slot: 'flag', icon: '🛡️', name: p('Banderín de guardián', 'Guardian pennant'), colors: ['#d6e4f0'], ach: 'kills25' },
];
export const itemById = (id: string) => ITEMS.find(i => i.id === id);
export const isUnlocked = (it: Item, ach: string[]) => !it.ach || ach.includes(it.ach);
export interface Choice { paint: string; trail: string; flag: string }
export const DEFAULT_CHOICE: Choice = { paint: 'paint-classic', trail: 'trail-dust', flag: 'flag-none' };
/** Keeps only choices that exist and are unlocked, so a reset or a stale save can never show a locked look. */
export function sanitize(c: Partial<Choice>, ach: string[]): Choice {
  const o = { ...DEFAULT_CHOICE };
  for (const s of ['paint', 'trail', 'flag'] as Slot[]) { const it = c[s] ? itemById(c[s]!) : undefined; if (it && it.slot === s && isUnlocked(it, ach)) o[s] = it.id; }
  return o;
}
export const colorsOf = (c: Choice) => ({ paint: itemById(c.paint)!.colors as [string, string], trail: itemById(c.trail)!.colors[0]!, flag: itemById(c.flag)!.colors[0] ?? null });

const KEY = 'frontier-cosmetics-v1';
let cur: Choice = (() => { try { return { ...DEFAULT_CHOICE, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Choice>) }; } catch { return DEFAULT_CHOICE; } })();
const subs = new Set<() => void>();
export const getChoice = () => cur;
export function setChoice(c: Choice) { cur = c; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode */ } subs.forEach(f => f()); }
export const useChoice = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, getChoice);
export const COSMETICS_KEY = KEY;
