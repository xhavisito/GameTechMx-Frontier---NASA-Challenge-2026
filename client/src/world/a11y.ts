import { useSyncExternalStore } from 'react';
import type { Sfx } from './audio';
import type { L } from './sources';

/** Accessibility settings: bigger text, high contrast, no time limits, written captions for sounds, less motion. Remembered on this device. */
export interface A11y { text: 0 | 1 | 2; contrast: boolean; noTimer: boolean; captions: boolean; calm: boolean }
export const DEFAULT_A11Y: A11y = { text: 0, contrast: false, noTimer: false, captions: false, calm: false };
export const TEXT_SCALE = [100, 118, 136];
const KEY = 'frontier-a11y-v1';
export function parse(raw: string | null): A11y {
  try {
    const v = JSON.parse(raw ?? '{}') as Partial<A11y>, t = v.text;
    return { text: t === 1 || t === 2 ? t : 0, contrast: !!v.contrast, noTimer: !!v.noTimer, captions: !!v.captions, calm: !!v.calm };
  } catch { return DEFAULT_A11Y; }
}
let cur: A11y = (() => { try { return parse(localStorage.getItem(KEY)); } catch { return DEFAULT_A11Y; } })();
const subs = new Set<() => void>();
export const getA11y = () => cur;
export function apply(a: A11y, root: HTMLElement = document.documentElement) {
  root.style.fontSize = `${TEXT_SCALE[a.text]}%`;
  root.classList.toggle('hc', a.contrast); root.classList.toggle('calm', a.calm);
}
export function setA11y(a: A11y) { cur = a; try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ } apply(a); subs.forEach(f => f()); }
export const useA11y = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, getA11y);
export const A11Y_KEY = KEY;

/** Text for the sounds that matter, for people who cannot hear them. */
export const CAPTIONS: Partial<Record<Sfx, L>> = {
  hurt: { es: '💥 ¡Te golpearon!', en: '💥 You got hit!' }, wave: { es: '🌊 Se acerca una ola o un enemigo', en: '🌊 A wave or an enemy is coming' },
  steal: { es: '🦝 ¡Te robaron algo!', en: '🦝 Something was stolen!' }, boss: { es: '👑 ¡Ruge el jefe!', en: '👑 The boss roars!' },
  win: { es: '🎉 ¡Misión cumplida!', en: '🎉 Mission complete!' }, fail: { es: '😢 Misión fallida', en: '😢 Mission failed' },
  launch: { es: '🚀 ¡Despegue!', en: '🚀 Lift-off!' }, goal: { es: '⚽ ¡Gol!', en: '⚽ Goal!' }, go: { es: '🏁 ¡Ya!', en: '🏁 Go!' },
  kill: { es: '☠️ Enemigo derrotado', en: '☠️ Enemy defeated' }, unlock: { es: '🏆 ¡Logro!', en: '🏆 Achievement!' },
};
