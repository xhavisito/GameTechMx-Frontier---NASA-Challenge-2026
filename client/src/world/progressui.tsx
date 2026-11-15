import { useState } from 'react';
import { ACHIEVEMENTS, getProgress, resetAll } from './progress';
import { SOURCES } from './sources';

/** "My progress": stats, achievements, discovered science cards and a (confirmed) reset. */
export function ProgressPanel({ es, runs, best, scrap, onClose }: { es: boolean; runs: number; best: number; scrap: number; onClose: () => void }) {
  const p = getProgress(), [sure, setSure] = useState(false), t = (a: string, b: string) => (es ? a : b);
  const done = ACHIEVEMENTS.filter(a => p.ach.includes(a.id)).length, cards = SOURCES.filter(s => p.found.includes(s.id)).length;
  return <div className="adv-modal" role="dialog" aria-modal="true" aria-label={t('Mi progreso', 'My progress')}><div className="adv-card wide prog">
    <div className="hang-head"><h2>{t('Mi progreso', 'My progress')}</h2><button className="hang-x" onClick={onClose} autoFocus>✕ {t('Cerrar', 'Close')}</button></div>
    <div className="prog-stats">
      <span>🪙 {scrap}</span><span>🚀 {runs} {t('misiones', 'missions')}</span><span>🏅 {t('Mejor', 'Best')} {best}</span><span>⚽ {p.s.goals}</span><span>⭐ {p.s.coins}</span><span>🛡️ {p.s.kills}</span><span>👑 {p.s.boss}</span><span>📖 {cards}/{SOURCES.length}</span>
    </div>
    <h3>{t('Logros', 'Achievements')} {done}/{ACHIEVEMENTS.length}</h3>
    <div className="prog-ach">{ACHIEVEMENTS.map(a => { const ok = p.ach.includes(a.id); return <div key={a.id} className={`ach ${ok ? 'on' : ''}`}><span className="ach-i">{ok ? a.icon : '🔒'}</span><b>{es ? a.es : a.en}</b><small>{es ? a.descEs : a.descEn}</small></div>; })}</div>
    <div className="prog-reset">{sure
      ? <><span>{t('Se borrará todo: dinero, mejoras, logros y tarjetas. ¿Seguro?', 'This erases everything: money, upgrades, achievements and cards. Sure?')}</span>
        <button className="button button-secondary" onClick={() => setSure(false)}>{t('No, volver', 'No, go back')}</button>
        <button className="button button-primary" onClick={() => { resetAll(); location.reload(); }}>{t('Sí, reiniciar', 'Yes, reset')}</button></>
      : <button className="button button-secondary" onClick={() => setSure(true)}>{t('Reiniciar partida', 'Reset game')}</button>}</div>
  </div></div>;
}
