import { useSyncExternalStore } from 'react';
import type { Perks } from './meta';

/** Local co-op for two people on one screen: player 1 drives, player 2 is the gunner (keys Enter / Numpad 0 / "/" or a second gamepad). Damage and score are shared. */
const KEY = 'frontier-coop-v1';
let cur = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
const subs = new Set<() => void>();
export const getCoop = () => cur;
export function setCoop(on: boolean) { cur = on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ } subs.forEach(f => f()); }
export const useCoop = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, getCoop);
export const COOP_KEY = KEY;
export const P2_FIRE_KEYS = ['enter', '0', '/', ' '];
/** The gunner always brings a blaster (level 1 at least) and reloads a little faster. */
export const withCoop = (p: Perks, on: boolean): Perks => (on ? { ...p, weapon: Math.max(1, p.weapon), reload: p.reload + 0.1 } : p);
