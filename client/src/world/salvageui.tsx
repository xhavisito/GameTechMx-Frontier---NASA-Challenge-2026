import { useState } from 'react';
import { EMERGENCY_FUND } from './design';
import { REP_MAX, type RunState } from './runstate';
import { upgradeValue, type Salvage } from './salvage';

const t = (es: boolean, a: string, b: string) => (es ? a : b);
const repOf = (r: RunState) => Object.values(r.rep).reduce((a, n) => a + n, 0);

/** The rover exploded and everything is gone. Pay to get it all back now, or let it go forever. */
export function SalvageCard({ es, s, onPay, onLetGo }: { es: boolean; s: Salvage; onPay: () => void; onLetGo: () => void }) {
  const [sure, setSure] = useState(false);
  const left = Math.max(EMERGENCY_FUND, s.meta.scrap - s.price);
  return <div className="adv-modal salvage" role="alertdialog" aria-modal="true" aria-label={t(es, 'Lo perdiste todo', 'You lost everything')}><div className="adv-card center">
    <h2>💥 {t(es, 'Lo perdiste todo', 'You lost everything')}</h2>
    <p>{t(es, 'Tu equipo quedó entre los restos. Aún puedes rescatarlo, pero solo ahora y solo una vez.', 'Your gear is in the wreckage. You can still salvage it, but only now and only once.')}</p>
    <ul className="salv-list">
      <li>🪙 {s.meta.scrap} {t(es, 'de chatarra', 'scrap')}</li>
      <li>🔧 {s.levels} {t(es, `mejora${s.levels === 1 ? '' : 's'} (valen ${upgradeValue(s.meta)} 🪙)`, `upgrade level${s.levels === 1 ? '' : 's'} (worth ${upgradeValue(s.meta)} 🪙)`)}</li>
      <li>⭐ {repOf(s.run)}/{REP_MAX * 3} {t(es, 'de reputación y tus efectos de la expedición', 'reputation and your expedition effects')}</li>
    </ul>
    {!sure ? <>
      <button className="button button-primary" onClick={onPay}>{t(es, `Pagar ${s.price} 🪙 y recuperar todo`, `Pay ${s.price} 🪙 and get it all back`)}</button>
      <small className="salv-note">{t(es, `Te quedarías con ${left} 🪙 y todas tus mejoras.`, `You would keep ${left} 🪙 and all your upgrades.`)}</small>
      <button className="button salv-no" onClick={() => setSure(true)}>{t(es, 'Dejarlo ir', 'Let it go')}</button>
    </> : <>
      <p className="salv-warn">⚠️ {t(es, 'Si lo dejas ir, nunca más podrás recuperarlo. Empiezas de cero con el fondo de emergencia.', 'If you let it go you can never get it back. You restart from zero with the emergency fund.')}</p>
      <button className="button button-primary" onClick={onPay}>{t(es, `Mejor pagar ${s.price} 🪙`, `Pay ${s.price} 🪙 after all`)}</button>
      <button className="button salv-no" onClick={onLetGo}>{t(es, 'Sí, dejarlo para siempre', 'Yes, let it go for good')}</button>
    </>}
  </div></div>;
}
/** When you cannot afford any rescue, you just see what happened. */
export function LostCard({ es, onClose }: { es: boolean; onClose: () => void }) {
  return <div className="adv-modal salvage" role="alertdialog" aria-modal="true"><div className="adv-card center">
    <h2>💥 {t(es, 'Lo perdiste todo', 'You lost everything')}</h2>
    <p>{t(es, `No te alcanzaba para rescatar nada. Empiezas de nuevo con ${EMERGENCY_FUND} 🪙 del fondo de emergencia. ¡A reconstruir!`, `You could not afford a rescue. You restart with ${EMERGENCY_FUND} 🪙 from the emergency fund. Time to rebuild!`)}</p>
    <button className="button button-primary" onClick={onClose}>{t(es, 'Entendido', 'Got it')}</button>
  </div></div>;
}
