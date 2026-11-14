import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, CirclePause, Play, Radio, Satellite, Timer } from 'lucide-react';
import type { MissionPhase } from '../../../shared/types';
import { useGame } from '../store';
import { useI18n } from '../i18n';
import en from '../locales/simulation.en.json';
import es from '../locales/simulation.es.json';
import './simulation.css';
import { Viewport3D } from './Viewport3D';
import { useGameCopy } from '../gameCopy';
import { speeds, useInput } from '../input/inputStore';
import type { FlightState } from '../three/spacecraftModel';

const COUNTDOWN = 0.3; // share of the launch sequence spent counting down on the pad

const phases: MissionPhase[] = ['launch', 'insertion', 'operations', 'end-of-life'];

function FlightScene({ progress, phase, paused, title }: { progress: number; phase: MissionPhase; paused: boolean; title: string }) {
  const id = useId().replace(/:/g, '');
  const angle = progress * Math.PI * 8 - Math.PI / 2;
  const x = 320 + 221 * Math.cos(angle);
  const y = 158 + 76 * Math.sin(angle);
  return <svg className={`sim-flight-scene ${paused ? 'is-paused' : ''}`} viewBox="0 0 640 310" role="img" aria-label={title}>
    <defs>
      <radialGradient id={`${id}-earth`} cx="33%" cy="25%"><stop stopColor="#357b9a"/><stop offset=".5" stopColor="#153e61"/><stop offset="1" stopColor="#071321"/></radialGradient>
      <radialGradient id={`${id}-atmosphere`}><stop offset=".75" stopColor="#ffc857" stopOpacity="0"/><stop offset=".85" stopColor="#ffc857" stopOpacity=".18"/><stop offset="1" stopColor="#ffc857" stopOpacity="0"/></radialGradient>
      <clipPath id={`${id}-clip`}><circle cx="320" cy="156" r="90"/></clipPath>
    </defs>
    {Array.from({length:32},(_,i)=><circle key={i} cx={(i*127+29)%640} cy={(i*i*43+17)%300} r={i%5===0?1.3:.7} fill="#92b9d2" opacity={.2+(i%4)*.13}/>)}
    <path d="M0 156H640M320 0V310" stroke="#254259" strokeDasharray="3 9" opacity=".55"/>
    <ellipse cx="320" cy="158" rx="221" ry="76" fill="none" stroke="#ffc857" opacity=".2"/>
    <ellipse cx="320" cy="158" rx="254" ry="99" fill="none" stroke="#24455e" strokeDasharray="3 6"/>
    <circle cx="320" cy="156" r="109" fill={`url(#${id}-atmosphere)`}/>
    <circle cx="320" cy="156" r="90" fill={`url(#${id}-earth)`} stroke="#69cfdf" strokeOpacity=".45"/>
    <g clipPath={`url(#${id}-clip)`} fill="none" stroke="#73d5d4" strokeOpacity=".22">
      <ellipse cx="320" cy="156" rx="43" ry="90"/><ellipse cx="320" cy="156" rx="75" ry="90"/>
      <ellipse cx="320" cy="127" rx="87" ry="23"/><ellipse cx="320" cy="175" rx="89" ry="26"/>
      <path d="m259 102 29-20 23 8 4 19 25 11-8 20-16 9-12 29-21-1-17-25-19-12 12-14Zm94 61 29-19 17 15-12 13 9 22-17 21-21-12 6-21Z" fill="#68ad9d" fillOpacity=".25" strokeOpacity=".4"/>
      <path d="M322 66C282 128 293 209 341 246" stroke="#c4f3ed" strokeOpacity=".13" strokeWidth="20"/>
    </g>
    <path d="M99 158a221 76 0 0 0 442 0" fill="none" stroke="#ffc857" strokeOpacity=".45"/>
    {phase==='launch' ? <g transform="translate(320 62)">
      <path className="sim-engine-flame" d="M-5 25 0 43 5 25" fill="#ffad6b"/><path d="M0-20C-12-8-12 6-8 24H8C12 6 12-8 0-20Z" fill="#e5f8ff"/>
      <path d="M-8 8-18 23H-8M8 8 18 23H8" fill="#ffc857"/><circle cy="-3" r="4" fill="#17354b"/>
    </g> : <g transform={`translate(${x} ${y}) rotate(${progress*720})`} className="sim-satellite">
      <circle r="21" fill="#ffc857" fillOpacity=".06"/><rect x="-28" y="-10" width="19" height="20" rx="1" fill="#163b54" stroke="#ffc857"/>
      <rect x="9" y="-10" width="19" height="20" rx="1" fill="#163b54" stroke="#ffc857"/><path d="M-22-10V10M-16-10V10M15-10V10M22-10V10M-28 0H28" stroke="#ffc857" strokeOpacity=".4"/>
      <rect x="-8" y="-10" width="16" height="20" rx="2" fill="#e4f5fa"/><path d="M0-10V-18M-4-19Q0-14 4-19" fill="none" stroke="#ffad6b" strokeWidth="2"/>
    </g>}
    <text x="22" y="286" fill="#7e9aaf" fontSize="9" fontFamily="sans-serif">FRONTIER / FLIGHT DYNAMICS</text>
    <text x="618" y="286" textAnchor="end" fill="#ffc857" fontSize="10" fontFamily="sans-serif">{Math.round(progress*100).toString().padStart(3,'0')}%</text>
  </svg>;
}

function FlightHud({ flight, ascent, pending, launched, g }: { flight: FlightState | null; ascent: number; pending: boolean; launched: boolean; g: ReturnType<typeof useGameCopy> }) {
  if (!flight) return null;
  const ev = flight.event;
  let banner: { text: string; tone: '' | 'warn' | 'alert'; big?: string } | null = null;
  if (!launched && flight.day > 0) banner = { text: g.launchFailed, tone: 'alert' };
  else if (flight.day === 0) {
    if (pending) banner = { text: g.hold, tone: 'warn' };
    else if (ascent < COUNTDOWN) banner = { text: g.countdown, tone: '', big: `T−${Math.max(1, Math.ceil((1 - ascent / COUNTDOWN) * 3))}` };
    else if (!launched && ascent > COUNTDOWN + (1 - COUNTDOWN) * 0.5) banner = { text: g.launchFailed, tone: 'alert' };
    else banner = { text: g.liftoff, tone: '' };
  } else if (!flight.inserted && flight.launched) banner = { text: g.insertionFailed, tone: 'alert' };
  else if (ev) {
    const t = ev.type, ch = ev.choice;
    if (t === 'solar-storm') banner = ch === 'protect' ? { text: g.fxStormSafe, tone: 'warn' } : { text: g.fxStorm, tone: 'alert' };
    else if (t === 'wheel-failure') banner = ch === 'repair' ? { text: g.fxWheelFixed, tone: '' } : { text: g.fxWheel, tone: ev.responded ? 'warn' : 'alert' };
    else if (t === 'debris') banner = !ev.responded ? { text: g.fxDebris, tone: 'alert' } : ch === 'protect' ? { text: g.fxDebrisDodge, tone: 'warn' } : { text: g.fxDebrisHit, tone: 'alert' };
    else if (t === 'battery-degradation') banner = { text: g.fxBattery, tone: 'warn' };
    else if (t === 'budget-cut') banner = { text: g.fxBudget, tone: 'warn' };
    else if (t === 'launch-delay') banner = null;
  } else if (flight.phase === 'insertion') banner = { text: g.separation, tone: '' };
  else if (flight.phase === 'end-of-life') banner = { text: flight.health > 0.05 && flight.inserted ? g.fxReentry : g.fxDisposal, tone: '' };
  else if (flight.health < 0.25 && flight.inserted) banner = { text: g.fxLowHealth, tone: 'alert' };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const tone = (v: number) => (v < 0.25 ? 'bad' : v < 0.55 ? 'warn' : 'ok');
  return <>
    <div className="hud-row">
      <div className="hud-fx">
        {flight.operating && <span className="hud-chip ok">◉ {g.fxScience}</span>}
        {flight.transmitting && <span className="hud-chip ok">⇣ {g.fxDownlink}</span>}
      </div>
      <div className="hud-gauges">
        <div className={`hud-gauge ${tone(flight.health)}`}><span>HP<b>{pct(flight.health)}</b></span><i><em style={{ width: pct(flight.health) }} /></i></div>
        <div className={`hud-gauge ${tone(flight.battery)}`}><span>⚡<b>{pct(flight.battery)}</b></span><i><em style={{ width: pct(flight.battery) }} /></i></div>
        <div className={`hud-gauge ${flight.storage > 0.9 ? 'bad' : flight.storage > 0.7 ? 'warn' : 'ok'}`}><span>💾<b>{pct(flight.storage)}</b></span><i><em style={{ width: pct(flight.storage) }} /></i></div>
      </div>
    </div>
    {banner ? <div className={`hud-banner ${banner.tone}`} role="status">{banner.big && <span className="hud-countdown">{banner.big}</span>}{banner.text}</div> : <span />}
    <span />
  </>;
}

export function SimulationView() {
  const { lang, l } = useI18n();
  const copy = lang === 'es' ? es : en;
  const timeline = useGame(s => s.timeline);
  const day = useGame(s => s.simulationDay);
  const setDay = useGame(s => s.setSimulationDay);
  const respond = useGame(s => s.respond);
  const finish = useGame(s => s.finish);
  const setScreen = useGame(s => s.setScreen);
  const playing = useInput(s => s.playing);
  const setPlaying = useInput(s => s.setPlaying);
  const speed = useInput(s => s.speed);
  const setSpeed = useInput(s => s.setSpeed);
  const device = useInput(s => s.device);
  const g = useGameCopy();
  const [ascent, setAscent] = useState(0);
  const [flight, setFlight] = useState<FlightState | null>(null);
  const holdUntil = useRef(0);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lastDay = timeline?.days.at(-1)?.day ?? 0;
  const pending = timeline?.events.find(event => event.day <= day && !event.responded);
  const ended = !!timeline && day >= lastDay && !pending;
  const current = timeline?.days.find(row => row.day === day) ?? timeline?.days.filter(row => row.day <= day).at(-1);
  const currentPhase = ended ? 'end-of-life' : (current?.phase ?? 'launch');
  const progress = lastDay > 0 ? day / lastDay : ended ? 1 : 0;

  // A response triggers a short cinematic hold so the player sees its consequence in 3D.
  const respondedCount = timeline?.events.filter(e => e.responded).length ?? 0;
  useEffect(() => { if (respondedCount) holdUntil.current = performance.now() + (reduced ? 300 : 1600); }, [respondedCount, reduced]);

  // Day 0 plays a launch cinematic (countdown + ascent) before the daily clock starts.
  useEffect(() => {
    if (!timeline || !playing || pending || day !== 0) return;
    if (ascent >= 1) { setDay(1); return; }
    const duration = (reduced ? 2.5 : 8) / Math.sqrt(speed / 3);
    let raf = 0, last = performance.now();
    const tick = (now: number) => { const dt = (now - last) / 1000; last = now; setAscent(a => Math.min(1, a + dt / duration)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeline, playing, pending, day, ascent >= 1, speed, reduced, setDay]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timeline || !playing || pending || ended || day === 0) return;
    const wait = Math.max(1000 / speed, holdUntil.current - performance.now());
    const timer = window.setTimeout(() => setDay(Math.min(lastDay, day + 1)), wait);
    return () => window.clearTimeout(timer);
  }, [timeline, playing, pending, ended, day, speed, setDay, lastDay]);

  if (!timeline) return <section className="panel sim-empty"><Satellite/><h2>{copy.empty}</h2><button className="button button-primary" onClick={() => setScreen('design')}>{copy.returnDesign}</button></section>;
  const f = (value: number, digits=0) => value.toLocaleString(lang, { maximumFractionDigits:digits });
  const visibleEvents = timeline.events.filter(event => event.day <= day);
  return <section className="simulation-view" aria-label={copy.flightOperations}>
    <header className="sim-heading"><div><p className="eyebrow">{copy.flightOperations}</p><h1>{copy.missionPlayback}</h1></div><span className="sim-seed">{copy.seed} <strong>{timeline.seed}</strong></span></header>
    <div className="sim-phase-track" aria-label={copy.flightOperations}>{phases.map((phase, index) => <div key={phase} className={`${phase===currentPhase?'active':''} ${phases.indexOf(currentPhase)>index?'done':''}`} aria-current={phase===currentPhase?'step':undefined}><span>{phases.indexOf(currentPhase)>index ? <Check size={13}/> : `0${index+1}`}</span><b>{copy[phase]}</b></div>)}</div>
    <section className="panel sim-flight-panel">
      <div className="sim-flight-topline"><span className={`sim-status ${pending?'is-warning':''}`}><span/>{pending ? copy.awaitingDecision : ended ? copy.complete : playing ? copy.live : copy.paused}</span><span className="sim-clock"><Timer size={14}/>{copy.day} <b>{day}</b> / {lastDay}</span></div>
      <div className="flight-stage">
        <Viewport3D mode="flight" timeline={timeline} day={day} ascent={Math.max(0, (ascent - COUNTDOWN) / (1 - COUNTDOWN))} onFlightState={setFlight}
          hud={<FlightHud flight={flight} ascent={ascent} pending={!!pending} launched={timeline.launched} g={g} />}
          fallback={<FlightScene progress={progress} phase={currentPhase} paused={!playing||!!pending||ended} title={copy.trajectory}/>} />
      </div>
      <div className="sim-telemetry" aria-live="off">
        <div><span>{copy.health}</span><strong>{f((current?.health ?? 1)*100)}<small>%</small></strong></div>
        <div><span>{copy.downlinked}</span><strong>{f(current?.cumulativeDataGB ?? 0,1)}<small>GB</small></strong></div>
        <div><span>{copy.science}</span><strong>{f(current?.cumulativeScience ?? 0)}<small>SC</small></strong></div>
        <div><span>{copy.spent}</span><strong>{f(current?.spentM ?? timeline.resources.developmentCostM+timeline.resources.launchCostM,2)}<small>M$</small></strong></div>
      </div>
      <div className="sim-progress" role="progressbar" aria-label={`${copy.day} ${day} ${copy.of} ${lastDay}`} aria-valuemin={0} aria-valuemax={Math.max(lastDay,1)} aria-valuenow={day}><span style={{width:`${progress*100}%`}}/></div>
      <div className="sim-controls"><button className="button button-secondary" disabled={!!pending||ended} onClick={() => setPlaying(!playing)}>{playing?<CirclePause size={16}/>:<Play size={16}/>} {playing?copy.pause:copy.play}</button><label><span className="sr-only">{copy.speed}</span><select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{speeds.map(n=><option key={n} value={n}>{n}× · {n} {copy.day.toLowerCase()}/s</option>)}</select></label>{ended&&<button className="button button-primary" onClick={finish}>{copy.viewReport}<ArrowRight size={16}/></button>}</div>
    </section>
    {pending&&<section className="panel sim-event" aria-labelledby="mission-event-title" role="region" aria-live="polite">
      <div className="sim-event-title"><span className="sim-event-icon"><AlertTriangle size={20}/></span><div><p className="eyebrow">{copy.decisionDay} {pending.day}</p><h2 id="mission-event-title">{l(pending.title)}</h2></div></div>
      <p>{l(pending.description)}</p><p className="sim-event-help">{copy.eventHelp}</p>
      <div className="sim-choices">{pending.choices.map((choice,index)=><button className="sim-choice" key={choice.id} autoFocus={index===0&&device==='gamepad'} onClick={()=>{respond(pending.id,choice.id);setPlaying(true);}}><span className="sim-choice-head"><strong>{l(choice.label)}</strong>{device==='touch'?<ArrowRight size={16}/>:<kbd className={device==='gamepad'?`pad pad-${index?'y':'x'}`:'key'}>{device==='gamepad'?(index?'Y':'X'):index+1}</kbd>}</span><span>{l(choice.description)}</span><span className="sim-choice-effects"><span>{copy.responseCost}: <b>{f(choice.costM,2)} M$</b></span><span>{copy.responseDays}: <b>{choice.lostDays}</b></span><span>{copy.responseHealth}: <b>{choice.healthDelta>0?'+':''}{f(choice.healthDelta)}</b></span><span>{copy.responsePower}: <b>{f(choice.powerMultiplier*100)}%</b></span><span>{copy.responseScience}: <b>{f(choice.scienceMultiplier*100)}%</b></span></span></button>)}</div>
    </section>}
    <div className="sim-secondary-telemetry"><div><span>{copy.battery}</span><b>{f(current?.batteryWh ?? timeline.resources.batteryWh)} Wh</b></div><div><span>{copy.storage}</span><b>{f(current?.storedGB ?? 0,1)} / {f(timeline.resources.storageGB)} GB</b></div><div><span>{copy.powerMargin}</span><b>{f(current?.energyMarginW ?? timeline.resources.averageGenerationW-timeline.resources.consumptionW)} W</b></div></div>
    <section className="panel sim-log"><h2><Radio size={17}/>{copy.flightLog}</h2>{visibleEvents.length===0 ? <p className="sim-muted">{copy.logEmpty}</p> : <ol>{visibleEvents.slice().reverse().map(event=><li key={event.id}><span className="sim-log-day">D+{event.day.toString().padStart(3,'0')}</span><div><strong>{l(event.title)}</strong><p>{event.responded?l(event.consequence):copy.pending}</p></div>{event.responded&&<Check size={16}/>}</li>)}</ol>}</section>
    <p className="sim-disclaimer">{copy.flightSummary}</p>
  </section>;
}
export default SimulationView;
