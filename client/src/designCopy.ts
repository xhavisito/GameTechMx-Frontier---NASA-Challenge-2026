import es from './locales/design.es.json';
import en from './locales/design.en.json';
import { useI18n } from './i18n';
export function useDesignCopy() { return useI18n().lang === 'es' ? es : en; }
export function number(value: number, maximumFractionDigits = 1) {
  return Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits }) : '—';
}
