import { LEARN } from './learn';
import { SOURCES } from './sources';
import { modById, type RunState } from './runstate';
import type { MarsResult } from './marsWorld';
import type { Dest } from './design';

const WORLD_CARDS: Record<Dest, string[]> = {
  mars: ['rover', 'mars-dust', 'mars-meteors', 'mars-hematite', 'mars-igneous', 'mars-ice'],
  jupiter: ['jup-grs', 'jup-belts', 'jup-aurora', 'jup-radiation'],
  miller: ['miller'],
};
/** The science card this planet teaches; rotates with the number of missions so each visit shows something new. */
export const worldCard = (dest: Dest, n: number): string => { const l = WORLD_CARDS[dest]; return l[((n % l.length) + l.length) % l.length]!; };

/** Three lines after every mission: what happened, what you learned, what changes next. */
export function LogBook({ es, result, dest, run, learnId }: { es: boolean; result: MarsResult; dest: Dest; run: RunState; learnId: string }) {
  const t = (a: string, b: string) => (es ? a : b), l = LEARN[learnId], src = SOURCES.find(s => s.id === learnId);
  const happened = [
    result.returned ? t('Cumpliste la misión', 'You completed the mission') : result.exploded ? t('La nave explotó', 'The ship exploded') : t('No terminaste la misión', 'You did not finish the mission'),
    `${result.pois ?? 0} ${t('objetivos', 'goals')}`, `${result.kills ?? 0} ${t('derrotados', 'defeated')}`,
    ...(result.hull !== undefined ? [`${t('casco', 'hull')} ${Math.round(result.hull)}%`] : []),
  ].join(' · ');
  const nextBits = run.mods.map(m => { const d = modById(m.id)!; return `${d.icon} ${es ? d.es : d.en} (${m.left})`; });
  return <div className="logbook" aria-label={t('Bitácora', 'Mission log')}>
    <h4>📓 {t('Bitácora de la misión', 'Mission log')}</h4>
    <p><b>🧭 {t('Qué pasó', 'What happened')}</b><br />{happened}</p>
    {l && src && <p><b>📚 {t('Qué aprendiste', 'What you learned')}</b><br />{l.icon} {es ? src.name.es : src.name.en}: {es ? l.gist.es : l.gist.en}<br /><span className="sci-remember">💡 {es ? l.remember.es : l.remember.en}</span></p>}
    <p><b>➡️ {t('Qué cambia en la siguiente', 'What changes next')}</b><br />{nextBits.length ? nextBits.join(' · ') : t('Nada especial: empiezas limpio.', 'Nothing special: a clean start.')}{run.rep[dest] > 0 ? ` · ${t('Reputación', 'Reputation')} ${'⭐'.repeat(run.rep[dest])}` : ''}</p>
  </div>;
}
