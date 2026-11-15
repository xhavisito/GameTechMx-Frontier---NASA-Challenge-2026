import { useState } from 'react';
import { BEATS, WHO, beatById } from './story';
import { SOURCES } from './sources';
import { dayKey, destOfDay, topScores, type DailyRec, type DailyDest } from './daily';

/** A short message from the base crew: tap "Next" to read on. */
export function StoryBubble({ es, id, onClose, onCard }: { es: boolean; id: string; onClose: () => void; onCard: () => void }) {
  const beat = beatById(id) ?? BEATS[0]!, [i, setI] = useState(0), line = beat.lines[i]!, last = i === beat.lines.length - 1;
  const who = WHO[line.who], card = beat.card ? SOURCES.find(s => s.id === beat.card) : null;
  return <div className="story" role="dialog" aria-label={es ? 'Mensaje de la base' : 'Message from the base'}>
    <div className="story-who"><span className="story-av">{who.icon}</span><b>{es ? who.es : who.en}</b></div>
    <p>{es ? line.es : line.en}</p>
    {last && card && <p className="story-card">📖 {es ? 'Más en la tarjeta' : 'More in the card'}: <button className="link" onClick={onCard}>{es ? card.name.es : card.name.en}</button></p>}
    <div className="story-btns">{!last ? <button className="button button-primary" autoFocus onClick={() => setI(i + 1)}>{es ? 'Siguiente' : 'Next'}</button> : <button className="button button-primary" autoFocus onClick={onClose}>{es ? '¡Entendido!' : 'Got it!'}</button>}
      {!last && <button className="button button-secondary" onClick={onClose}>{es ? 'Saltar' : 'Skip'}</button>}</div>
  </div>;
}

const DEST_NAME: Record<DailyDest, { es: string; en: string }> = { mars: { es: 'Marte', en: 'Mars' }, jupiter: { es: 'Júpiter', en: 'Jupiter' }, miller: { es: 'Miller', en: 'Miller' } };
/** Today's challenge: same world and gear for everyone, local scoreboard and streak. */
export function DailyPanel({ es, rec, onPlay, onClose }: { es: boolean; rec: DailyRec; onPlay: () => void; onClose: () => void }) {
  const key = dayKey(), dest = destOfDay(key), t = (a: string, b: string) => (es ? a : b), best = rec.best[key];
  return <div className="adv-modal" role="dialog" aria-modal="true" aria-label={t('Reto del día', 'Daily challenge')}><div className="adv-card center daily">
    <div className="hang-head"><button className="hang-x" onClick={onClose}>✕ {t('Cerrar', 'Close')}</button><h2>📅 {t('Reto del día', 'Daily challenge')}</h2></div>
    <p>{t('Hoy toca', 'Today:')} <b>{es ? DEST_NAME[dest].es : DEST_NAME[dest].en}</b> · {t('mismo mundo y mismo equipo para todos. Sin mejoras: cuenta tu habilidad.', 'same world and gear for everyone. No upgrades: your skill counts.')}</p>
    <div className="prog-stats"><span>🔥 {t('Racha', 'Streak')} {rec.streak}</span><span>🏅 {t('Mejor de hoy', 'Best today')} {best ?? '—'}</span></div>
    {topScores(rec).length > 0 && <><h3>{t('Tus mejores', 'Your best')}</h3><ol className="daily-top">{topScores(rec).map((s, i) => <li key={i}><b>{s.score}</b> · {s.day} · {es ? DEST_NAME[s.dest].es : DEST_NAME[s.dest].en}</li>)}</ol></>}
    <button className="button button-primary" autoFocus onClick={onPlay}>{t('¡Jugar el reto!', 'Play the challenge!')}</button>
    <small className="hint">{t('Se guarda solo en este dispositivo. +10 🪙 la primera vez que lo completes cada día.', 'Saved on this device only. +10 🪙 the first time you complete it each day.')}</small>
  </div></div>;
}
