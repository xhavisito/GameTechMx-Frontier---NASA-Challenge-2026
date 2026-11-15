import { LEARN, WRONG } from './learn';
import { SOURCES, type L } from './sources';
import { dayNumber } from './daily';

/**
 * Spaced review (Leitner boxes): a card you get right comes back later and later, a card you miss comes back tomorrow.
 * Pure maths plus a small localStorage store.
 */
export interface Rec { box: number; due: number; seen: number; wrong: number }
export type Review = Record<string, Rec>
export const GAPS = [1, 2, 4, 8, 16];   // days until the card is asked again, per box
export const MAX_BOX = GAPS.length - 1;

export function answer(r: Review, id: string, ok: boolean, today: number): Review {
  const c = r[id] ?? { box: 0, due: today, seen: 0, wrong: 0 }, box = ok ? Math.min(MAX_BOX, c.box + 1) : 0;
  return { ...r, [id]: { box, due: today + (ok ? GAPS[box]! : 1), seen: c.seen + 1, wrong: c.wrong + (ok ? 0 : 1) } };
}
export const dueIds = (r: Review, today: number) => Object.keys(r).filter(id => r[id]!.due <= today && LEARN[id]).sort((a, b) => r[a]!.box - r[b]!.box || r[b]!.wrong - r[a]!.wrong);

export interface Question { id: string; q: L; options: { text: L; ok: boolean }[]; remember: L; icon: string }
function shuffle<T>(a: T[], rnd: () => number): T[] { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j]!, o[i]!]; } return o; }

/** Four options: the right one, two made-up-but-plausible ones and one real answer from another card. Order is random. */
export function makeQuestion(id: string, rnd: () => number = Math.random): Question {
  const l = LEARN[id]!, wr = WRONG[id] ?? [];
  const others = Object.keys(LEARN).filter(k => k !== id && LEARN[k]!.a.es !== l.a.es);
  const extra = others.length ? [LEARN[others[Math.floor(rnd() * others.length)]!]!.a] : [];
  const bad = [...wr, ...extra].slice(0, 3);
  return { id, q: l.q, remember: l.remember, icon: l.icon, options: shuffle([{ text: l.a, ok: true }, ...bad.map(text => ({ text, ok: false }))], rnd) };
}

/** What to ask: cards that are due first (the ones you missed), then cards you discovered and never answered, then anything else. */
export function pickIds(r: Review, today: number, found: string[], n: number, prefer: string[] = [], rnd: () => number = Math.random): string[] {
  const all = SOURCES.map(s => s.id).filter(id => LEARN[id]);
  const out: string[] = [];
  const add = (ids: string[]) => { for (const id of ids) if (out.length < n && !out.includes(id)) out.push(id); };
  add(dueIds(r, today));
  add(shuffle(prefer.filter(id => !(id in r)), rnd));
  add(shuffle(found.filter(id => !(id in r) && all.includes(id)), rnd));
  add(shuffle(all.filter(id => !(id in r)), rnd));
  add(shuffle(all, rnd));
  return out;
}

/** Today's science card: the same for everyone on a given day, rotating through every card. */
export const cardOfDay = (key: string): string => { const ids = SOURCES.map(s => s.id).filter(id => LEARN[id]); return ids[((dayNumber(key) % ids.length) + ids.length) % ids.length]!; };

export interface SciDay { last: string; streak: number }
export const SCI_QUIZ_REWARD = 4, SCI_DAY_REWARD = 6;
export function markSciDay(s: SciDay, key: string, yest: string): SciDay { return s.last === key ? s : { last: key, streak: s.last === yest ? s.streak + 1 : 1 }; }

const KEY = 'frontier-review-v1', DKEY = 'frontier-sciday-v1';
export function loadReview(): Review { try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return v && typeof v === 'object' ? v as Review : {}; } catch { return {}; } }
export function saveReview(r: Review) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ } }
export function loadSciDay(): SciDay { try { const v = JSON.parse(localStorage.getItem(DKEY) ?? 'null'); if (v && typeof v.streak === 'number') return v as SciDay; } catch { /* corrupted */ } return { last: '', streak: 0 }; }
export function saveSciDay(s: SciDay) { try { localStorage.setItem(DKEY, JSON.stringify(s)); } catch { /* private mode */ } }
export const REVIEW_KEYS = [KEY, DKEY];
