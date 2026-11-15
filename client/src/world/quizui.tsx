import { useEffect, useState } from 'react';
import { SOURCES } from './sources';
import { LEARN } from './learn';
import { cardOfDay, makeQuestion, SCI_DAY_REWARD, SCI_QUIZ_REWARD, type SciDay, type Review } from './review';
import { dayKey } from './daily';

const nameOf = (id: string, es: boolean) => { const s = SOURCES.find(x => x.id === id); return s ? (es ? s.name.es : s.name.en) : id; };

export interface Answer { id: string; ok: boolean }
/** A short multiple-choice check. Answer, see why, move on. Keys 1–4 pick an option, Enter goes on. */
export function Quiz({ es, ids, reward, onDone, onClose, title }: { es: boolean; ids: string[]; reward: number; onDone: (a: Answer[]) => void; onClose: () => void; title: string }) {
  const t = (a: string, b: string) => (es ? a : b);
  const [qs] = useState(() => ids.map(id => makeQuestion(id)));
  const [i, setI] = useState(0), [pick, setPick] = useState<number | null>(null), [res, setRes] = useState<Answer[]>([]), [fin, setFin] = useState(false);
  const q = qs[i], right = res.filter(r => r.ok).length;
  const choose = (k: number) => { if (pick !== null || !q) return; setPick(k); setRes(r => [...r, { id: q.id, ok: q.options[k]!.ok }]); };
  const next = () => { if (pick === null) return; if (i + 1 >= qs.length) setFin(true); else { setI(i + 1); setPick(null); } };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^[1-4]$/.test(e.key)) { choose(Number(e.key) - 1); e.stopPropagation(); }
      else if (e.key === 'Enter' && pick !== null && !fin) { next(); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'Escape') { onClose(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  });
  if (fin) {
    const gain = right * reward;
    return <div className="adv-modal ev" role="dialog" aria-modal="true"><div className="adv-card center quiz">
      <h2>🧠 {t('¡Repaso listo!', 'Review done!')}</h2>
      <div className="w-grade">{right}/{qs.length}</div>
      <p>{gain > 0 ? t(`¡Ganaste ${gain} 🪙 por acordarte!`, `You earned ${gain} 🪙 for remembering!`) : t('Esta vez ninguna, pero volverán a preguntarte mañana.', 'None this time, but they will be asked again tomorrow.')}</p>
      <ul className="quiz-sum">{res.map((r, k) => <li key={k} className={r.ok ? 'ok' : 'no'}>{r.ok ? '✔' : '✖'} {LEARN[r.id]?.icon} {nameOf(r.id, es)}</li>)}</ul>
      <button className="button button-primary" autoFocus onClick={() => onDone(res)}>{t('Listo', 'Done')}</button>
    </div></div>;
  }
  if (!q) return null;
  return <div className="adv-modal ev" role="dialog" aria-modal="true" aria-label={title}><div className="adv-card wide quiz">
    <h2>🧠 {title} <small className="trip-step">{i + 1}/{qs.length}</small></h2>
    <p className="quiz-card">{q.icon} <b>{nameOf(q.id, es)}</b></p>
    <p className="quiz-q">{es ? q.q.es : q.q.en}</p>
    <div className="adv-row quiz-opts">{q.options.map((o, k) => <button key={k} className={`adv-opt quiz-opt ${pick === null ? '' : o.ok ? 'right' : pick === k ? 'wrong' : 'dim'}`} disabled={pick !== null} onClick={() => choose(k)}><b>{k + 1}. {es ? o.text.es : o.text.en}</b></button>)}</div>
    {pick !== null && <div className="quiz-fb"><p>{q.options[pick]!.ok ? t('✅ ¡Correcto!', '✅ Correct!') : t('❌ Casi. La respuesta era la verde.', '❌ Not quite. The answer was the green one.')}</p><p className="sci-remember">💡 {es ? q.remember.es : q.remember.en}</p>
      <button className="button button-primary" autoFocus onClick={next}>{i + 1 >= qs.length ? t('Ver resultado', 'See result') : t('Siguiente', 'Next')}</button></div>}
    <small className="hint">{t(`Cada acierto: +${reward} 🪙 · teclas 1–4 y Enter`, `Each right answer: +${reward} 🪙 · keys 1–4 and Enter`)}</small>
  </div></div>;
}

/** Today's science card plus the review of whatever you missed. */
export function SciDayPanel({ es, sci, review, due, onQuiz, onReview, onClose }: { es: boolean; sci: SciDay; review: Review; due: number; onQuiz: () => void; onReview: () => void; onClose: () => void }) {
  const t = (a: string, b: string) => (es ? a : b), key = dayKey(), id = cardOfDay(key), l = LEARN[id]!, done = sci.last === key, seen = Object.keys(review).length;
  return <div className="adv-modal" role="dialog" aria-modal="true" aria-label={t('Ciencia del día', 'Science of the day')}><div className="adv-card center daily">
    <div className="hang-head"><button className="hang-x" onClick={onClose}>✕ {t('Cerrar', 'Close')}</button><h2>💡 {t('Ciencia del día', 'Science of the day')}</h2></div>
    <p className="quiz-card">{l.icon} <b>{nameOf(id, es)}</b></p>
    <p className="sci-gist">{es ? l.gist.es : l.gist.en}</p>
    <p className="sci-remember">💡 {es ? l.remember.es : l.remember.en}</p>
    <div className="prog-stats"><span>🔥 {t('Racha', 'Streak')} {sci.streak}</span><span>📚 {seen} {t('repasadas', 'reviewed')}</span><span>⏰ {due} {t('pendientes', 'due')}</span></div>
    <button className="button button-primary" autoFocus onClick={onQuiz}>{done ? t('Repetir la pregunta del día', 'Retry today’s question') : t(`🧠 Responder (+${SCI_DAY_REWARD} 🪙)`, `🧠 Answer (+${SCI_DAY_REWARD} 🪙)`)}</button>
    <button className="button button-secondary" onClick={onReview}>{t(`Repasar 4 tarjetas (+${SCI_QUIZ_REWARD} 🪙 c/u)`, `Review 4 cards (+${SCI_QUIZ_REWARD} 🪙 each)`)}</button>
    <small className="hint">{t('Lo que falles vuelve a preguntarse mañana; lo que aciertes, cada vez más tarde.', 'What you miss is asked again tomorrow; what you get right comes back later and later.')}</small>
  </div></div>;
}
