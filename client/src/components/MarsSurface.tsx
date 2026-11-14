import { lazy, Suspense, useEffect, useState } from 'react';
import { Gamepad2, Keyboard, Hand, Play, Award } from 'lucide-react';
import type { MissionTimeline } from '../../../shared/types';
import { calculateResources } from '../../../shared/index';
import { useGame } from '../store';
import { seedFromString } from '../three/noise';
import type { MarsResult, WorldConfig } from '../world/marsWorld';
import './mars.css';

const MarsWorld = lazy(() => import('../world/MarsWorld'));

export type { MarsResult };

/** What the student's spacecraft brings to the surface: battery, panels and instruments shape the open world. */
export function marsConfig(timeline: MissionTimeline): WorldConfig {
  const d = timeline.design;
  const r = calculateResources(d);
  const has = (...ids: string[]) => ids.some(id => d.instrumentIds.includes(id));
  return {
    seed: seedFromString(timeline.seed || 'frontier'),
    battery: Math.max(40, Math.min(400, Math.round(r.batteryWh))),
    solar: Math.max(10, Math.min(300, Math.round(r.averageGenerationW))),
    spectrometer: has('spectrometer', 'hyperspectral'),
    camera: has('optical', 'multispectral', 'hyperspectral'),
    radar: has('sar'),
    health: Math.max(40, Math.min(100, Math.round(timeline.finalHealth * 100))),
  };
}

const KEY = 'frontier-mars-surface';
function readBest(): MarsResult | null { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Number.isFinite(v.score) ? v : null; } catch { return null; } }

export function MarsSurfaceCard({ timeline }: { timeline: MissionTimeline }) {
  const lang = useGame(s => s.language);
  const es = lang === 'es';
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<MarsResult | null>(null);
  const [best, setBest] = useState<MarsResult | null>(readBest);
  const arrived = timeline.launched && (timeline.phases.find(p => p.phase === 'insertion')?.success ?? false);

  useEffect(() => {
    if (!open) return;
    document.body.dataset.minigame = 'on';
    return () => { delete document.body.dataset.minigame; };
  }, [open]);

  const done = (r: MarsResult) => {
    setResult(r); setOpen(false);
    const prev = readBest();
    if (!prev || r.score > prev.score) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ } setBest(r); }
  };

  return <section className={`panel mars-card ${arrived ? '' : 'is-locked'}`} aria-labelledby="mars-card-title">
    <div className="mars-card-art" aria-hidden="true"><span className="mars-planet" /></div>
    <div className="mars-card-body">
      <p className="eyebrow accent">{es ? 'Misión Marte · mundo abierto' : 'Mars mission · open world'}</p>
      <h2 id="mars-card-title">{es ? 'Explora la superficie' : 'Explore the surface'}</h2>
      <p>{arrived
        ? (es ? 'Tu nave llegó a Marte. Maneja el rover libremente: busca muestras, esquiva meteoritos y regresa al módulo. Tu batería, paneles e instrumentos cambian lo que puedes hacer.'
              : 'Your spacecraft reached Mars. Drive the rover freely: find samples, dodge meteors and return to the lander. Your battery, panels and instruments change what you can do.')
        : (es ? 'Tu nave no llegó a la órbita de Marte. Rediseña (más Δv, lanzador pesado) para desbloquear esta fase.'
              : 'Your spacecraft did not reach Mars orbit. Redesign (more Δv, heavy launcher) to unlock this phase.')}</p>
      <ul className="mars-controls">
        <li><Keyboard size={14} /> WASD · Shift · E · F</li>
        <li><Gamepad2 size={14} /> {es ? 'Stick · A · X · RT' : 'Stick · A · X · RT'}</li>
        <li><Hand size={14} /> {es ? 'Joystick táctil y botones' : 'Touch joystick and buttons'}</li>
      </ul>
      {result && <p className="mars-result" role="status"><Award size={16} /> {es ? 'Resultado' : 'Result'}: <b>{result.grade}</b> · {result.score}/100 · {result.returned ? (es ? 'muestras entregadas' : 'samples delivered') : (es ? 'sin regreso' : 'no return')}</p>}
      {!result && best && <p className="mars-best"><Award size={14} /> {es ? 'Mejor resultado' : 'Best result'}: {best.grade} · {best.score}/100</p>}
      <button className="button button-primary mars-start" disabled={!arrived} onClick={() => { setResult(null); setOpen(true); }}><Play size={16} />{es ? 'Ir a la superficie' : 'Go to the surface'}</button>
    </div>
    {open && <Suspense fallback={<div className="mars-overlay"><p className="mars-loading">{es ? 'Cargando Marte…' : 'Loading Mars…'}</p></div>}>
      <MarsWorld cfg={marsConfig(timeline)} es={es} onDone={done} onExit={() => setOpen(false)} />
    </Suspense>}
  </section>;
}
