import { useCoop, setCoop } from './coop';
import { useEffect, useState } from 'react';
import { A11Y_KEY, CAPTIONS, setA11y, useA11y, type A11y } from './a11y';
import { ITEMS, isUnlocked, sanitize, setChoice, useChoice, type Slot } from './cosmetics';
import { ACHIEVEMENTS, getProgress, subscribe } from './progress';
import { setCaptionListener, type Sfx } from './audio';

void A11Y_KEY;
const SLOTS: { id: Slot; es: string; en: string }[] = [{ id: 'paint', es: 'Pintura del rover', en: 'Rover paint' }, { id: 'trail', es: 'Polvo', en: 'Dust' }, { id: 'flag', es: 'Banderín', en: 'Pennant' }];

/** Settings: accessibility and looks (paint, dust, pennant), all remembered on this device. */
export function SettingsPanel({ es, onClose }: { es: boolean; onClose: () => void }) {
  const a = useA11y(), choice = useChoice(), t = (x: string, y: string) => (es ? x : y);
  const [ach, setAch] = useState(getProgress().ach);
  useEffect(() => subscribe(p => setAch(p.ach)), []);
  const coop = useCoop();
  const set = (patch: Partial<A11y>) => setA11y({ ...a, ...patch });
  const Toggle = ({ k, es: e, en, desc }: { k: 'contrast' | 'noTimer' | 'captions' | 'calm'; es: string; en: string; desc: string }) =>
    <button className={`adv-opt set-opt ${a[k] ? 'on' : ''}`} aria-pressed={a[k]} onClick={() => set({ [k]: !a[k] })}><b>{a[k] ? '✔ ' : ''}{t(e, en)}</b><small>{desc}</small></button>;
  return <div className="adv-modal set-modal" role="dialog" aria-modal="true" aria-label={t('Ajustes', 'Settings')}><div className="adv-card wide settings">
    <div className="hang-head"><button className="hang-x" onClick={onClose} autoFocus>✕ {t('Cerrar', 'Close')}</button><h2>⚙️ {t('Ajustes', 'Settings')}</h2></div>
    <h3>♿ {t('Accesibilidad', 'Accessibility')}</h3>
    <div className="set-size" role="group" aria-label={t('Tamaño de letra', 'Text size')}>
      <span>{t('Letra', 'Text')}</span>
      {([0, 1, 2] as const).map(i => <button key={i} className={`adv-opt set-opt ${a.text === i ? 'on' : ''}`} aria-pressed={a.text === i} onClick={() => set({ text: i })} style={{ fontSize: `${1 + i * 0.18}rem` }}><b>A{'+'.repeat(i)}</b></button>)}
    </div>
    <div className="adv-row set-grid">
      <Toggle k="contrast" es="Alto contraste" en="High contrast" desc={t('Colores más fuertes y bordes blancos', 'Stronger colours and white borders')} />
      <Toggle k="noTimer" es="Sin límite de tiempo" en="No time limit" desc={t('Las misiones no tienen cuenta regresiva', 'Missions have no countdown')} />
      <Toggle k="captions" es="Subtítulos de sonido" en="Sound captions" desc={t('Escribe en pantalla los sonidos importantes', 'Shows important sounds as text')} />
      <Toggle k="calm" es="Menos movimiento" en="Less motion" desc={t('Sin animaciones ni sacudidas de adorno', 'No decorative animations or shakes')} />
    </div>
    <h3>🎮 {t('Dos jugadores', 'Two players')}</h3>
    <div className="adv-row set-grid"><button className={`adv-opt set-opt ${coop ? 'on' : ''}`} aria-pressed={coop} onClick={() => setCoop(!coop)}><b>{coop ? '✔ ' : ''}{t('Cooperativo en pantalla dividida', 'Split-screen co-op')}</b><small>{t('Pantalla dividida: cada jugador maneja su propio vehículo (rover, nave o submarino) en el mismo mundo. J1: WASD, E, F, R, Shift. J2: flechas, Enter, . y /, 0 para turbo. Con dos controles, el 1.º es J1 y el 2.º es J2. El resultado es del equipo. No aplica al reto diario.', 'Split screen: each player drives their own vehicle (rover, ship or submarine) in the same world. P1: WASD, E, F, R, Shift. P2: arrows, Enter, . and /, 0 for boost. With two pads, the 1st is P1 and the 2nd is P2. The result is shared by the team. Not used in the daily challenge.')}</small></button></div>
    <h3>🎨 {t('Aspecto', 'Looks')}</h3>
    {SLOTS.map(s => <div key={s.id} className="look-row"><b>{t(s.es, s.en)}</b>
      <div className="adv-row">{ITEMS.filter(i => i.slot === s.id).map(it => {
        const ok = isUnlocked(it, ach), on = choice[s.id] === it.id, need = it.ach ? ACHIEVEMENTS.find(x => x.id === it.ach) : null;
        return <button key={it.id} className={`adv-opt look ${on ? 'on' : ''}`} disabled={!ok} aria-pressed={on} onClick={() => setChoice(sanitize({ ...choice, [s.id]: it.id }, ach))}>
          <b>{ok ? it.icon : '🔒'} {es ? it.name.es : it.name.en}</b>
          {!ok && need && <small>{t('Logro', 'Achievement')}: {es ? need.es : need.en}</small>}
          {ok && it.colors.length > 0 && <span className="swatch" aria-hidden="true">{it.colors.map(c => <i key={c} style={{ background: c }} />)}</span>}
        </button>;
      })}</div></div>)}
  </div></div>;
}

/** Shows the last important sound as text while captions are on. */
export function Captions({ es, on }: { es: boolean; on: boolean }) {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!on) { setCaptionListener(null); setMsg(''); return; }
    let t: ReturnType<typeof setTimeout> | undefined;
    setCaptionListener((n: Sfx) => { const c = CAPTIONS[n]; if (!c) return; setMsg(es ? c.es : c.en); clearTimeout(t); t = setTimeout(() => setMsg(''), 2200); });
    return () => { setCaptionListener(null); clearTimeout(t); };
  }, [on, es]);
  return msg ? <div className="caption" role="status" aria-live="polite">{msg}</div> : null;
}
