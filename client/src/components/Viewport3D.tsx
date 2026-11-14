import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Crosshair, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react';
import type { MissionTimeline } from '../../../shared/types';
import { useGame } from '../store';
import { useGameCopy } from '../gameCopy';
import { cameraImpulse, resetCamera, touchAxes, useInput } from '../input/inputStore';
import type { SceneMode } from '../three/MissionScene';
import type { FlightState } from '../three/spacecraftModel';
import './viewport.css';

const MissionScene = lazy(() => import('../three/MissionScene'));

let webgl: boolean | null = null;
function hasWebGL() {
  if (webgl !== null) return webgl;
  try { const c = document.createElement('canvas'); webgl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { webgl = false; }
  return webgl;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const m = matchMedia('(prefers-reduced-motion: reduce)'); const on = () => setReduced(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return reduced;
}

export interface Viewport3DProps {
  mode: SceneMode;
  timeline?: MissionTimeline | null;
  day?: number;
  ascent?: number;
  fallback: ReactNode;
  hud?: ReactNode;
  className?: string;
  collapsible?: boolean;
  onFlightState?: (s: FlightState) => void;
}

/** DOM shell around the WebGL canvas: gestures, touch buttons, HUD, collapse and fallback. */
export function Viewport3D({ mode, timeline, day, ascent, fallback, hud, className = '', collapsible = false, onFlightState }: Viewport3DProps) {
  const design = useGame(s => s.design);
  const g = useGameCopy();
  const device = useInput(s => s.device);
  const collapsed = useInput(s => s.viewportCollapsed) && collapsible;
  const toggle = useInput(s => s.toggleViewport);
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const labels = useMemo(() => ({ mass: g.labelMass, power: g.labelPower, battery: g.labelBattery, data: g.labelData, storage: g.labelStorage, propulsion: g.labelPropulsion, launcher: g.labelLauncher, orbit: g.labelOrbit }), [g]);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || el.contains(document.activeElement))) return; // don't hijack page scrolling
      e.preventDefault();
      cameraImpulse.zoom += Math.max(-0.4, Math.min(0.4, e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [collapsed]);

  if (collapsed) return <div className={`viewport-3d is-collapsed ${className}`}>
    <button className="viewport-expand" onClick={toggle}><ChevronDown size={15} />{g.show3d}</button>
  </div>;

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, [data-hud-interactive]')) return;
    box.current?.focus({ preventScroll: true });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; pinch.current = Math.hypot(a!.x - b!.x, a!.y - b!.y); }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 1) {
      cameraImpulse.yaw -= (next.x - prev.x) * 0.008;
      cameraImpulse.pitch += (next.y - prev.y) * 0.006;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinch.current > 0 && d > 0) cameraImpulse.zoom -= Math.log(d / pinch.current);
      pinch.current = d;
    }
  };
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = 0; };
  const hold = (axis: 'yaw' | 'zoom', value: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); touchAxes[axis] = value; },
    onPointerUp: () => { touchAxes[axis] = 0; }, onPointerLeave: () => { touchAxes[axis] = 0; }, onPointerCancel: () => { touchAxes[axis] = 0; },
    onClick: () => { if (axis === 'zoom') cameraImpulse.zoom += value * 0.25; else cameraImpulse.yaw += value * 0.35; },
  });

  return <div ref={box} className={`viewport-3d ${className}`} tabIndex={0} role="group" aria-roledescription={g.view3d} aria-label={g.view3d}
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
    {hasWebGL() ? <Suspense fallback={<div className="viewport-loading">{fallback}<span>{g.loading3d}</span></div>}>
      <MissionScene mode={mode} design={timeline?.design ?? design} timeline={timeline} day={day} ascent={ascent} labels={labels} reducedMotion={reduced} onFlightState={onFlightState} />
    </Suspense> : <div className="viewport-loading">{fallback}<span>{g.no3d}</span></div>}
    {hud && <div className="viewport-hud">{hud}</div>}
    <div className="viewport-tools" data-hud-interactive>
      {(device === 'touch') && <>
        <button aria-label={g.rotateLeft} {...hold('yaw', -1)}><RotateCcw size={16} /></button>
        <button aria-label={g.rotateRight} {...hold('yaw', 1)}><RotateCw size={16} /></button>
      </>}
      <button aria-label={g.zoomIn} {...hold('zoom', -1)}><Plus size={16} /></button>
      <button aria-label={g.zoomOut} {...hold('zoom', 1)}><Minus size={16} /></button>
      <button aria-label={g.resetView} onClick={resetCamera}><Crosshair size={16} /></button>
      {collapsible && <button aria-label={g.hide3d} onClick={toggle}><ChevronUp size={16} /></button>}
    </div>
    <p className="viewport-gesture">{device === 'touch' ? g.touchCamera : device === 'mouse' ? g.mouseCamera : null}</p>
  </div>;
}
