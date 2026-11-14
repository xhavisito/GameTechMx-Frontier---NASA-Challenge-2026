import { useGame } from './store';
import es from './locales/es.json';
import en from './locales/en.json';
import type { LocalizedText } from '../../shared/types';
export function useI18n() {
  const lang = useGame(s => s.language);
  const dictionary: Record<string,string> = lang === 'es' ? es : en;
  return { lang, t: (key:string) => dictionary[key] ?? key, l: (value:LocalizedText) => value[lang] };
}
