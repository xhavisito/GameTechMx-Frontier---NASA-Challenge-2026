import { useCallback, useEffect, useRef, useState } from 'react';
import { Coffee, Gamepad2, Keyboard, Hand, Play, X, Award } from 'lucide-react';
import type { MissionTimeline } from '../../../shared/types';
import { calculateResources } from '../../../shared/index';
import { useGame } from '../store';
import './mars.css';

declare global {
  interface Window {
    FrontierMarsStart?: (canvasId: string, config: string) => void;
    FrontierMarsStop?: () => void;
    FrontierMarsDone?: (payload: string) => void;
    FrontierMarsReady?: () => void;
  }
}

export interface MarsResult { score: number; science: number; returned: boolean; grade: string; samples: string[] }

/** Parses the Java module's "key=value;..." payload defensively. */
export function parseMarsResult(payload: string): MarsResult | null {
  const map = new Map(payload.split(';').map(part => { const i = part.indexOf('='); return [part.slice(0, i), part.slice(i + 1)] as [string, string]; }));
  const score = Number(map.get('score'));
  if (!Number.isFinite(score)) return null;
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    science: Math.max(0, Number(map.get('science')) || 0),
    returned: map.get('returned') === '1',
    grade: /^[SABCD]$/.test(map.get('grade') ?? '') ? map.get('grade')! : 'D',
    samples: (map.get('samples') ?? '').split('|').filter(Boolean).slice(0, 3).map(s => s.slice(0, 60)),
  };
}

/** What the student's spacecraft brings to the surface mission, encoded for the Java module. */
export function marsConfig(timeline: MissionTimeline, lang: string): string {
  const d = timeline.design;
  const r = calculateResources(d);
  const comm = d.componentIds.find(id => id.startsWith('comm-'))?.split('-')[1] ?? 'uhf';
  const has = (...ids: string[]) => ids.some(id => d.instrumentIds.includes(id)) ? 1 : 0;
  return [
    `battery=${r.batteryWh}`, `solar=${Math.round(r.averageGenerationW)}`,
    `spectrometer=${has('spectrometer', 'hyperspectral')}`, `camera=${has('optical', 'multispectral', 'hyperspectral')}`, `radar=${has('sar')}`,
    `deltaV=${r.deltaV}`, `comm=${comm}`, `health=${timeline.finalHealth}`, `seed=${timeline.seed.replace(/[^A-Za-z0-9_\- ]/g, '')}`,
    `lang=${lang}`, `difficulty=${d.difficulty}`,
  ].join(';');
}

let loader: Promise<void> | null = null;
function loadJavaModule(): Promise<void> {
  if (window.FrontierMarsStart) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    window.FrontierMarsReady = () => resolve();
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}java/mars.js`;
    script.async = true;
    script.onload = () => {
      // TeaVM defines a global main(); calling it registers FrontierMarsStart.
      const main = (window as unknown as { main?: (args: string[]) => void }).main;
      if (!window.FrontierMarsStart && typeof main === 'function') main([]);
      if (window.FrontierMarsStart) resolve();
    };
    script.onerror = () => { loader = null; reject(new Error('java module missing')); };
    document.head.appendChild(script);
    setTimeout(() => { if (!window.FrontierMarsStart) { loader = null; reject(new Error('java module did not start')); } }, 15000);
  });
  return loader;
}

const KEY = 'frontier-mars-surface';
function readBest(): MarsResult | null { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Number.isFinite(v.score) ? v : null; } catch { return null; } }

export function MarsSurfaceCard({ timeline }: { timeline: MissionTimeline }) {
  const lang = useGame(s => s.language);
  const es = lang === 'es';
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
  const [result, setResult] = useState<MarsResult | null>(null);
  const [best, setBest] = useState<MarsResult | null>(readBest);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const arrived = timeline.launched && (timeline.phases.find(p => p.phase === 'insertion')?.success ?? false);

  const close = useCallback(() => { window.FrontierMarsStop?.(); setOpen(false); setState('idle'); }, []);

  useEffect(() => {
    if (!open) return;
    document.body.dataset.minigame = 'on';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && state !== 'running') close(); };
    addEventListener('keydown', onKey);
    return () => { delete document.body.dataset.minigame; removeEventListener('keydown', onKey); };
  }, [open, state, close]);

  const start = async () => {
    setOpen(true); setResult(null); setState('loading');
    try {
      await loadJavaModule();
      window.FrontierMarsDone = payload => {
        const parsed = parseMarsResult(payload);
        setResult(parsed); setOpen(false); setState('idle');
        if (parsed) { const prev = readBest(); if (!prev || parsed.score > prev.score) { try { localStorage.setItem(KEY, JSON.stringify(parsed)); } catch { /* private mode */ } setBest(parsed); } }
      };
      setState('running');
      requestAnimationFrame(() => window.FrontierMarsStart?.('mars-canvas', marsConfig(timeline, lang)));
    } catch {
      setState('error');
    }
  };

  return <section className={`panel mars-card ${arrived ? '' : 'is-locked'}`} aria-labelledby="mars-card-title">
    <div className="mars-card-art" aria-hidden="true"><span className="mars-planet" /><span className="mars-rover">▣</span></div>
    <div className="mars-card-body">
      <p className="eyebrow accent">{es ? 'MISIÓN MARTE · NIVEL INICIAL · MÓDULO EN JAVA' : 'MARS MISSION · BEGINNER LEVEL · JAVA MODULE'}</p>
      <h2 id="mars-card-title">{es ? 'Operaciones en la superficie' : 'Surface operations'}</h2>
      <p>{arrived
        ? (es ? 'Tu nave llegó a Marte. Conduce el rover para recolectar muestras y después pilota tu nave a distancia para atrapar el contenedor esquivando asteroides.'
              : 'Your spacecraft reached Mars. Drive the rover to collect samples, then remotely pilot your spacecraft to catch the canister while dodging asteroids.')
        : (es ? 'Tu nave no llegó a la órbita de Marte. Rediseña (más Δv, lanzador pesado) para desbloquear esta fase.'
              : 'Your spacecraft did not reach Mars orbit. Redesign (more Δv, heavy launcher) to unlock this phase.')}</p>
      <ul className="mars-controls">
        <li><Keyboard size={14} /> WASD · {es ? 'Espacio' : 'Space'} · P</li>
        <li><Gamepad2 size={14} /> {es ? 'Stick · A · Start' : 'Stick · A · Start'}</li>
        <li><Hand size={14} /> {es ? 'Joystick táctil · botón ●' : 'Touch joystick · ● button'}</li>
      </ul>
      {result && <p className="mars-result" role="status"><Award size={16} /> {es ? 'Resultado' : 'Result'}: <b>{result.grade}</b> · {result.score}/100 · {result.returned ? (es ? 'muestras en camino a la Tierra' : 'samples on their way to Earth') : (es ? 'sin retorno' : 'no return')}{result.samples.length ? ` · ${result.samples.join(', ')}` : ''}</p>}
      {!result && best && <p className="mars-best"><Award size={14} /> {es ? 'Mejor resultado' : 'Best result'}: {best.grade} · {best.score}/100</p>}
      {state === 'error' && <p className="mars-error" role="alert"><Coffee size={14} /> {es ? 'El módulo Java no está compilado en esta versión. Ejecuta: gradle -p java-mars generateJavaScript y copia mars.js a client/public/java/.' : 'The Java module is not built in this version. Run: gradle -p java-mars generateJavaScript and copy mars.js to client/public/java/.'}</p>}
      <button className="button button-primary mars-start" disabled={!arrived || state === 'loading'} onClick={start}><Play size={16} />{state === 'loading' ? (es ? 'Cargando…' : 'Loading…') : (es ? 'Ir a la superficie' : 'Go to the surface')}</button>
    </div>
    {open && <div className="mars-overlay" role="dialog" aria-modal="true" aria-label={es ? 'Misión en la superficie de Marte' : 'Mars surface mission'}>
      <button ref={closeBtn} className="mars-close" onClick={close} aria-label={es ? 'Salir de la misión' : 'Exit mission'}><X size={18} /></button>
      <canvas id="mars-canvas" className="mars-canvas" tabIndex={0} />
      {state === 'loading' && <p className="mars-loading">{es ? 'Cargando el módulo Java…' : 'Loading the Java module…'}</p>}
      {state === 'error' && <p className="mars-loading">{es ? 'No se pudo cargar el módulo Java.' : 'Could not load the Java module.'}</p>}
    </div>}
  </section>;
}
