import es from './locales/game.es.json';
import en from './locales/game.en.json';
import { useI18n } from './i18n';
export type GameCopy = typeof es;
export function useGameCopy(): GameCopy { return useI18n().lang === 'es' ? es : en; }
