import { useState } from 'react';
import { objShort, type Job, type JobRow } from './board';
import { modById, slotsFor, tierFor, type RunState } from './runstate';
import { optionNote, type TEvent, type TOption } from './tripevents';
import type { Dest } from './design';

const t = (es: boolean, a: string, b: string) => (es ? a : b);
const WORLD: Record<Dest, { es: string; en: string; base: string; baseEn: string }> = {
  mars: { es: 'Marte', en: 'Mars', base: 'Módulo de aterrizaje', baseEn: 'Lander' },
  jupiter: { es: 'Júpiter', en: 'Jupiter', base: 'Estación orbital', baseEn: 'Orbital station' },
  miller: { es: 'Miller', en: 'Miller', base: 'Boya de superficie', baseEn: 'Surface buoy' },
};

/** The question before a mission: random events, random option order, honest odds on the gambles. */
export function TripCard({ es, ev, step, total, onPick }: { es: boolean; ev: TEvent; step: number; total: number; onPick: (o: TOption) => void }) {
  return <div className="adv-modal ev"><div className="adv-card">
    <h2>{ev.icon} {t(es, '¡Evento en el viaje!', 'Event on the trip!')} <small className="trip-step">{step}/{total}</small></h2>
    <p>{es ? ev.es : ev.en}</p>
    <div className="adv-row">{ev.options.map((o, i) => <button key={i} className={`adv-opt ${o.gamble ? 'risk' : ''}`} onClick={() => onPick(o)}><b>{o.gamble ? '🎲 ' : ''}{es ? o.es : o.en}</b><small>{optionNote(o, es)}</small></button>)}</div>
  </div></div>;
}

/** The planet's mission board: pick up to a few jobs. Each one changes THIS mission and leaves something behind for the next ones. */
export function Board({ es, dest, offers, rep, accepted, onToggle, onGo }: { es: boolean; dest: Dest; offers: Job[]; rep: number; accepted: string[]; onToggle: (id: string) => void; onGo: () => void }) {
  const max = slotsFor(rep), w = WORLD[dest];
  return <div className="adv-modal ev"><div className="adv-card wide board">
    <h2>📋 {t(es, `Tablero de misiones · ${w.es}`, `Mission board · ${w.en}`)}</h2>
    <p>{t(es, `${w.base}. Acepta hasta ${max} trabajos. Cambian esta misión y, si los cumples (o fallas), dejan efectos en las siguientes.`, `${w.baseEn}. Take up to ${max} jobs. They change this mission and, win or lose, leave effects on the next ones.`)}</p>
    <div className="rep" aria-label="reputation">{t(es, 'Reputación', 'Reputation')}: {'⭐'.repeat(rep) || '—'} <small>{t(es, `(nivel ${tierFor(rep)}: más rep = trabajos mejores y más pago)`, `(tier ${tierFor(rep)}: more rep = better jobs and pay)`)}</small></div>
    <div className="adv-row">{offers.map(j => {
      const on = accepted.includes(j.id), full = !on && accepted.length >= max, win = j.win ? modById(j.win) : null, lose = j.lose ? modById(j.lose) : null;
      return <button key={j.id} className={`adv-opt card job ${on ? 'on' : ''}`} aria-pressed={on} disabled={full} onClick={() => onToggle(j.id)}>
        <b>{j.icon} {es ? j.es : j.en} <span className="tier">{'●'.repeat(j.tier)}</span></b>
        <small>{es ? j.descEs : j.descEn}</small>
        <small>🪙 +{j.reward}{win ? ` · ✔ ${win.icon} ${es ? win.es : win.en}` : ''}{lose ? ` · ✖ ${lose.icon} ${es ? lose.es : lose.en}` : ''}</small>
      </button>;
    })}</div>
    <div className="adv-row tut-nav"><button className="button button-primary" onClick={onGo}>{accepted.length ? t(es, `¡A la misión! (${accepted.length} trabajo${accepted.length > 1 ? 's' : ''})`, `Go! (${accepted.length} job${accepted.length > 1 ? 's' : ''})`) : t(es, 'Salir sin trabajos', 'Go without jobs')}</button></div>
  </div></div>;
}

/** Small always-visible reminders: the jobs you carry and the effects the run has given or taken. */
export function RunChips({ es, run, jobs }: { es: boolean; run: RunState; jobs: Job[] }) {
  const [open, setOpen] = useState(false);
  if (!jobs.length && !run.mods.length) return null;
  return <div className="job-chips" role="status">
    {jobs.map(j => <span key={j.id} className="chip job" title={es ? j.descEs : j.descEn}>{j.icon} {objShort(j.obj, es)}</span>)}
    {run.mods.length > 0 && <button className="chip link" aria-expanded={open} onClick={() => setOpen(o => !o)}>{run.mods.map(m => modById(m.id)!.icon).join('')} {open ? '▲' : '▼'}</button>}
    {open && run.mods.map(m => { const d = modById(m.id)!; return <span key={m.id} className={`chip ${d.bad ? 'bad' : 'good'}`}>{d.icon} {es ? d.es : d.en} · {es ? d.descEs : d.descEn} · {m.left}</span>; })}
  </div>;
}

/** What happened to your jobs, shown on the results screen. */
export function JobResults({ es, rows }: { es: boolean; rows: JobRow[] }) {
  if (!rows.length) return null;
  return <div className="job-res"><h4>📋 {t(es, 'Trabajos del tablero', 'Board jobs')}</h4><ul>{rows.map(r => {
    const m = r.ok ? (r.job.win ? modById(r.job.win) : null) : (r.job.lose ? modById(r.job.lose) : null);
    return <li key={r.job.id} className={r.ok ? 'ok' : 'no'}><span>{r.ok ? '✔' : '✖'} {r.job.icon} {es ? r.job.es : r.job.en}</span><b>{r.ok ? `+${r.scrap} 🪙` : t(es, 'No cumplido', 'Not done')}</b>{m && <small>{m.icon} {es ? m.es : m.en} · {es ? m.descEs : m.descEn} ({m.turns} {t(es, 'misiones', 'missions')})</small>}</li>;
  })}</ul></div>;
}
