import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Gamepad2, Gauge, Keyboard, MousePointer2, Pause, Play, Rocket, X, HelpCircle, Hand } from 'lucide-react';
import { useGame } from '../store';
import { useGameCopy, type GameCopy } from '../gameCopy';
import { perform, pendingEvent, primaryKind } from '../input/actions';
import { useInput, type InputDevice } from '../input/inputStore';
import './extras.css';
import './controls.css';

type Glyphs = Record<'camera' | 'zoom' | 'step' | 'primary' | 'play' | 'choices' | 'speed' | 'help' | 'navigate' | 'select' | 'back' | 'reset' | 'scroll' | 'toggle3d' | 'change', ReactNode>;

const K = ({ children }: { children: ReactNode }) => <kbd className="key">{children}</kbd>;
const P = ({ b }: { b: 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'Start' | 'Select' | 'L' | 'R' | 'D' | 'R3' }) => <kbd className={`pad pad-${b.toLowerCase()}`}>{b === 'D' ? '✚' : b === 'Start' ? '☰' : b === 'Select' ? '⧉' : b === 'L' ? 'L◎' : b === 'R' ? 'R◎' : b}</kbd>;

const glyphs: Record<'keyboard' | 'gamepad' | 'touch', Glyphs> = {
  keyboard: {
    camera: <><K>W</K><K>A</K><K>S</K><K>D</K></>, zoom: <><K>Q</K><K>E</K></>, step: <><K>Z</K><K>X</K></>, primary: <K>Enter ↵</K>,
    play: <K>Space</K>, choices: <><K>1</K><K>2</K></>, speed: <K>T</K>, help: <K>H</K>, navigate: <><K>Tab</K><K>⇧Tab</K></>, select: <K>Enter ↵</K>,
    back: <K>Esc</K>, reset: <K>C</K>, scroll: <K>↑↓</K>, toggle3d: <K>V</K>, change: <K>←→</K>,
  },
  gamepad: {
    camera: <P b="L" />, zoom: <><P b="LT" /><P b="RT" /></>, step: <><P b="LB" /><P b="RB" /></>, primary: <P b="Start" />, play: <P b="X" />,
    choices: <><P b="X" /><P b="Y" /></>, speed: <P b="RB" />, help: <P b="Y" />, navigate: <P b="D" />, select: <P b="A" />, back: <P b="B" />, reset: <P b="Select" />, scroll: <P b="R" />, toggle3d: <P b="R3" />, change: <><P b="D" />◀▶</>,
  },
  touch: {
    camera: <span className="gesture">☝ ↔</span>, zoom: <span className="gesture">🤏</span>, step: <span className="gesture">◀ ▶</span>, primary: <span className="gesture">●</span>, play: <span className="gesture">⏯</span>,
    choices: <span className="gesture">☝</span>, speed: <span className="gesture">⏩</span>, help: <span className="gesture">?</span>, navigate: <span className="gesture">☝</span>, select: <span className="gesture">☝</span>, back: <span className="gesture">◀</span>, reset: <span className="gesture">⌖</span>, scroll: <span className="gesture">☝ ↕</span>, toggle3d: <span className="gesture">⌃</span>, change: <span className="gesture">☝</span>,
  },
};

const glyphSet = (d: InputDevice) => glyphs[d === 'mouse' ? 'keyboard' : d];

function usePrimaryLabel(g: GameCopy) {
  // Callers subscribe to screen/step/day/timeline/playing, so this recomputes on every relevant change.
  const kind = primaryKind();
  return { kind, label: g[`primary_${kind}` as keyof GameCopy] as string };
}

/** Context-aware action bar: shows how to play with the current device and doubles as touch buttons. */
export function ControlBar() {
  const g = useGameCopy();
  const screen = useGame(s => s.screen);
  const step = useGame(s => s.step);
  const day = useGame(s => s.simulationDay);
  const device = useInput(s => s.device);
  const speed = useInput(s => s.speed);
  const playing = useInput(s => s.playing);
  const { kind, label } = usePrimaryLabel(g);
  useGame(s => s.timeline);
  if (screen === 'home') return null;
  const gl = glyphSet(device);
  const pending = screen === 'simulation' ? pendingEvent() : null;
  const hint = (key: keyof Glyphs, text: string) => <span className="hint" key={key}>{gl[key]}<small>{text}</small></span>;
  const PrimaryIcon = kind === 'launch' ? Rocket : kind === 'pause' ? Pause : kind === 'play' ? Play : ChevronRight;

  return <nav className="control-bar" aria-label={g.controls} data-device={device}>
    <div className="control-hints" aria-hidden={device === 'touch'}>
      {device !== 'touch' && <>
        {hint('camera', g.hintCamera)}
        {hint('zoom', g.hintZoom)}
        {screen === 'design' && hint('step', g.hintStep)}
        {screen === 'simulation' && (pending ? hint('choices', g.hintChoices) : hint('play', g.hintPlay))}
        {screen === 'simulation' && hint('speed', `${g.hintSpeed} ${speed}×`)}
        {device === 'gamepad' && hint('navigate', g.hintNavigate)}
        {device === 'gamepad' && hint('select', g.hintSelect)}
      </>}
    </div>
    <div className="control-actions">
      {screen === 'design' && <button className="bar-btn" disabled={step === 0} onClick={() => perform('prev')} aria-label={g.hintBack}><ChevronLeft size={18} />{device === 'gamepad' && <P b="LB" />}</button>}
      {screen === 'simulation' && !pending && <button className="bar-btn" onClick={() => perform('cycleSpeed')} aria-label={`${g.speedLabel} ${speed}×`}><Gauge size={16} />{speed}×{device === 'gamepad' && <P b="RB" />}</button>}
      {kind !== 'decide' && <button className={`bar-btn primary ${kind === 'launch' ? 'launch' : ''}`} onClick={() => perform('primary')}>
        <PrimaryIcon size={17} />{label}{device === 'gamepad' ? <P b="Start" /> : device !== 'touch' ? <K>↵</K> : null}
      </button>}
      {kind === 'decide' && <span className="bar-decide">{g.hintChoices} {gl.choices}</span>}
      {screen === 'design' && step < 5 && <button className="bar-btn" onClick={() => perform('next')} aria-label={g.primary_next}><ChevronRight size={18} />{device === 'gamepad' && <P b="RB" />}</button>}
      <button className="bar-btn" onClick={() => perform('help')} aria-label={g.controls}><HelpCircle size={17} />{device === 'gamepad' ? <P b="Y" /> : device !== 'touch' ? <K>H</K> : null}</button>
    </div>
    <span className="sr-only" aria-live="polite">{screen === 'simulation' ? `${playing ? '' : g.primary_pause} ${day}` : ''}</span>
  </nav>;
}

export function HelpOverlay() {
  const g = useGameCopy();
  const open = useInput(s => s.helpOpen);
  const setHelp = useInput(s => s.setHelp);
  const pad = useInput(s => s.gamepad);
  const device = useInput(s => s.device);
  if (!open) return null;
  const rows: [keyof Glyphs, string][] = [['camera', g.hintCamera], ['zoom', g.hintZoom], ['reset', g.hintReset], ['step', g.hintStep], ['primary', g.hintPrimary], ['play', g.hintPlay], ['choices', g.hintChoices], ['speed', g.hintSpeed], ['navigate', g.hintNavigate], ['select', g.hintSelect], ['change', g.hintChange], ['back', g.hintBack], ['scroll', g.hintScroll], ['toggle3d', g.hintToggle3d], ['help', g.hintHelp]];
  return <div className="overlay help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => { if (e.target === e.currentTarget) setHelp(false); }}>
    <section className="dialog help-dialog">
      <div className="dialog-top"><span className="eyebrow accent">GAMETECHMX FRONTIER</span><button onClick={() => setHelp(false)} aria-label={g.close} autoFocus><X /></button></div>
      <h2 id="help-title">{g.controlsTitle}</h2>
      {pad && <p className="pad-name"><Gamepad2 size={15} /> {g.gamepadConnected}: <small>{pad}</small></p>}
      <table className="help-table">
        <thead><tr><th></th><th className={device === 'keyboard' || device === 'mouse' ? 'current' : ''}><Keyboard size={15} /> {g.keyboard}</th><th className={device === 'gamepad' ? 'current' : ''}><Gamepad2 size={15} /> {g.gamepad}</th><th className={device === 'touch' ? 'current' : ''}><Hand size={15} /> {g.touch}</th></tr></thead>
        <tbody>{rows.map(([key, text]) => <tr key={key}><th scope="row">{text}</th><td>{glyphs.keyboard[key]}</td><td>{glyphs.gamepad[key]}</td><td>{key === 'camera' ? g.touchCamera.split('·')[0] : key === 'zoom' ? g.touchCamera.split('·')[1] : glyphs.touch[key]}</td></tr>)}</tbody>
      </table>
      <p className="help-note"><MousePointer2 size={14} /> {g.mouseCamera}</p>
    </section>
  </div>;
}

export function Toast() {
  const toast = useInput(s => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => { if (!toast) return; setVisible(true); const t = setTimeout(() => setVisible(false), 2600); return () => clearTimeout(t); }, [toast]);
  if (!toast || !visible) return null;
  return <div className="toast" role="status"><Gamepad2 size={16} />{toast.text}</div>;
}
