/** Daily challenge: same world, same fixed gear and same seed for everyone on a given day, so scores are comparable.
 *  Kept on this device only (no server). Pure maths plus a tiny localStorage store. */
export type DailyDest = 'mars' | 'jupiter' | 'miller';
const DESTS: DailyDest[] = ['mars', 'jupiter', 'miller'];
export interface DailyRec { best: Record<string, number>; scores: { day: string; score: number; dest: DailyDest }[]; streak: number; lastDay: string; bonusDay: string }
export const emptyDaily = (): DailyRec => ({ best: {}, scores: [], streak: 0, lastDay: '', bonusDay: '' });

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayNumber = (key: string) => { const [y, m, d] = key.split('-').map(Number) as [number, number, number]; return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
export const yesterday = (key: string) => { const n = dayNumber(key) - 1, d = new Date(n * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const destOfDay = (key: string): DailyDest => DESTS[((dayNumber(key) % 3) + 3) % 3]!;
/** A positive integer that is the same for everyone on the same day. */
export const seedOfDay = (key: string) => { let h = 2166136261; for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 100000 + 1; };
export const DAILY_BONUS = 10;

/** Registers a finished daily run. The streak counts consecutive days played. */
export function recordDaily(r: DailyRec, key: string, score: number, dest: DailyDest, returned: boolean): { rec: DailyRec; isBest: boolean; bonus: number } {
  const rec: DailyRec = { ...r, best: { ...r.best }, scores: [...r.scores, { day: key, score, dest }].slice(-60) };
  const isBest = score > (r.best[key] ?? -1); if (isBest) rec.best[key] = score;
  if (r.lastDay !== key) rec.streak = r.lastDay === yesterday(key) ? r.streak + 1 : 1;
  rec.lastDay = key;
  const bonus = returned && r.bonusDay !== key ? DAILY_BONUS : 0; if (bonus) rec.bonusDay = key;
  return { rec, isBest, bonus };
}
export const topScores = (r: DailyRec, n = 5) => [...r.scores].sort((a, b) => b.score - a.score).slice(0, n);

const KEY = 'frontier-daily-v1';
export function loadDaily(): DailyRec {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v && typeof v.streak === 'number' && Array.isArray(v.scores)) return { ...emptyDaily(), ...v }; } catch { /* corrupted or private mode */ }
  return emptyDaily();
}
export function saveDaily(r: DailyRec) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ } }
