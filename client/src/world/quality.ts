import { useSyncExternalStore } from 'react';
/** Graphics quality: low = no shadows (phones, old laptops), medium = soft shadows, high = sharper shadows. Remembered. */
export type Quality = 'low' | 'medium' | 'high';
const KEY = 'frontier-quality';
const auto = (): Quality => {
  try { const touch = matchMedia('(pointer: coarse)').matches, cores = navigator.hardwareConcurrency ?? 8; return touch || cores <= 4 ? 'low' : 'medium'; } catch { return 'medium'; }
};
let cur: Quality = (() => { try { const v = localStorage.getItem(KEY); if (v === 'low' || v === 'medium' || v === 'high') return v; } catch { /* private mode */ } return auto(); })();
const subs = new Set<() => void>();
export const getQuality = () => cur;
export function setQuality(q: Quality) { cur = q; try { localStorage.setItem(KEY, q); } catch { /* private mode */ } subs.forEach(f => f()); }
export const nextQuality = (q: Quality): Quality => (q === 'low' ? 'medium' : q === 'medium' ? 'high' : 'low');
export const useQuality = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, getQuality);
