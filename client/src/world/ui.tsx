import { useEffect, useState } from 'react';
import { Camera, FlaskConical, Radar, Rocket, Orbit, Waves, Sun, BatteryFull, Check, X as XIcon, Star, Keyboard, Gamepad2, Hand } from 'lucide-react';
import { BUDGET, DEST, ROCKETS, TOOLS, NO_BONUS, TOOL_PRICE, ROCKET_PRICE, supplyCost, normalize, runTests, passed, stats, type RocketBonus, type Design, type Dest, type RocketId, type Tool, type TestResult, type TravelEvent, type EventOption } from './design';
import { LEVELS, LEVEL_INFO, type Level } from './levels';
import { ContractPicker } from './workshop';
import type { Contract } from './contracts';

type Es = { es: boolean };
const t = (es: boolean, a: string, b: string) => (es ? a : b);
const DEST_NAME = { mars: ['Marte', 'Mars'], jupiter: ['Júpiter', 'Jupiter'], miller: ['Miller', 'Miller'] } as const;
const TOOL_NAME = { camera: ['Cámara', 'Camera'], spectrometer: ['Analizador', 'Analyzer'], radar: ['Radar', 'Radar'] } as const;
const TOOL_DESC = {
  mars: { camera: ['Ves las muestras desde más lejos', 'Spot samples from farther away'], spectrometer: ['Tus muestras valen más puntos', 'Your samples are worth more points'], radar: ['Encuentra hielo escondido bajo la arena', 'Finds ice hidden under the sand'] },
  jupiter: { camera: ['Escaneas zonas desde más lejos', 'Scan zones from farther away'], spectrometer: ['Tu mapa vale más puntos', 'Your map is worth more points'], radar: ['Una flecha te guía a la siguiente zona', 'An arrow guides you to the next zone'] },
  miller: { camera: ['Ves las señales de vida desde lejos', 'See signs of life from afar'], spectrometer: ['Tus hallazgos valen más puntos', 'Your findings are worth more points'], radar: ['Detecta vida a gran distancia', 'Detects life from far away'] },
} as const;
const ROCKET_TXT: Record<RocketId, [string, string, string, string]> = {
  light: ['Cohete ligero', 'Light rocket', 'Barato, pero con poco combustible', 'Cheap, but little fuel'],
  standard: ['Cohete mediano', 'Medium rocket', 'Equilibrado', 'Balanced'],
  heavy: ['Cohete pesado', 'Heavy rocket', 'Mucho empuje, muy caro', 'Lots of thrust, very expensive'],
};
const TEST_NAME: Record<string, [string, string]> = {
  dv: ['Combustible (Δv)', 'Fuel (Δv)'], mass: ['Masa de la carga', 'Payload mass'], cost: ['Presupuesto', 'Budget'], power: ['Balance de energía', 'Power balance'],
  thermal: ['Escudo térmico', 'Heat shield'], tool: ['Instrumento requerido', 'Required instrument'], reserve: ['Reserva de batería', 'Battery reserve'],
};
export const toolIcon = (k: Tool, s = 28) => (k === 'camera' ? <Camera size={s} /> : k === 'spectrometer' ? <FlaskConical size={s} /> : <Radar size={s} />);
const destIcon = (d: Dest) => (d === 'mars' ? <Rocket size={30} /> : d === 'jupiter' ? <Orbit size={30} /> : <Waves size={30} />);

// ── tutorial (first time, and from the ? button) ─────────────────────────────
export function Tutorial({ es, onClose }: Es & { onClose: () => void }) {
  const [i, setI] = useState(0);
  const slides = [
    { h: t(es, '¿De qué trata?', 'What is this about?'), body: <>
      <p>{t(es, 'Eres un explorador espacial. Construyes tu nave, viajas a otro mundo y buscas pistas de si ahí pudo existir vida.', 'You are a space explorer. You build your ship, travel to another world and look for clues that life could have existed there.')}</p>
      <p>{t(es, 'Empiezas en la Tierra: maneja tu rover hasta el hangar, elige qué llevar, despega y juega la misión. ¡Todo pasa en un mundo abierto!', 'You start on Earth: drive your rover to the hangar, choose what to bring, launch and play the mission. It all happens in an open world!')}</p></> },
    { h: t(es, 'Cómo moverte', 'How to move'), body: <div className="tut-grid">
      <div><Keyboard size={26} /><b>{t(es, 'Teclado', 'Keyboard')}</b><small>WASD / {t(es, 'flechas', 'arrows')} · Shift {t(es, 'turbo', 'boost')} · E {t(es, 'interactuar', 'interact')} · J/L {t(es, 'cámara', 'camera')}</small></div>
      <div><Gamepad2 size={26} /><b>{t(es, 'Control', 'Gamepad')}</b><small>{t(es, 'Stick para moverte · A interactuar · RB turbo · stick derecho cámara', 'Stick to move · A interact · RB boost · right stick camera')}</small></div>
      <div><Hand size={26} /><b>Touch</b><small>{t(es, 'Joystick en pantalla y botón E. Arrastra para mover la cámara.', 'On-screen joystick and E button. Drag to move the camera.')}</small></div></div> },
    { h: t(es, 'Tres mundos', 'Three worlds'), body: <ul className="tut-list">
      <li><b>{t(es, 'Marte', 'Mars')}:</b> {t(es, 'maneja el rover, recolecta muestras, esquiva meteoritos y regresa al módulo.', 'drive the rover, collect samples, dodge meteors and return to the lander.')}</li>
      <li><b>{t(es, 'Júpiter', 'Jupiter')}:</b> {t(es, 'vuela sobre su atmósfera y escanea zonas para armar un mapa.', 'fly over its atmosphere and scan zones to build a map.')}</li>
      <li><b>Miller:</b> {t(es, 'es un océano gigante. Pilota un submarino: avanza, gira, sube y baja, y busca señales de vida. ¡Cuidado con la presión!', 'a giant ocean. Pilot a submarine: move, turn, go up and down, and look for signs of life. Watch the pressure!')}</li></ul> },
  ];
  const last = i === slides.length - 1, s = slides[i]!;
  return <div className="adv-modal" role="dialog" aria-label="tutorial"><div className="adv-card">
    <small className="tut-step">{i + 1}/{slides.length}</small><h2>{s.h}</h2>{s.body}
    <div className="adv-row tut-nav">
      <button className="button button-secondary" onClick={onClose}>{t(es, 'Saltar', 'Skip')}</button>
      {i > 0 && <button className="button button-secondary" onClick={() => setI(i - 1)}>{t(es, 'Atrás', 'Back')}</button>}
      <button className="button button-primary" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>{last ? t(es, 'Elegir dificultad', 'Choose difficulty') : t(es, 'Siguiente', 'Next')}</button>
    </div></div></div>;
}

// ── difficulty picker ────────────────────────────────────────────────────────
const LEVEL_POINTS: Record<Level, [string[], string[]]> = {
  easy: [['Eliges destino y 1 herramienta.', 'Sin pruebas, sin números, sin tiempo.', 'El submarino aguanta mucha presión.'], ['Pick a destination and 1 tool.', 'No tests, no numbers, no timer.', 'The sub handles lots of pressure.']],
  medium: [['También eliges cohete y energía.', '1 prueba antes de despegar: el combustible.', 'Más peligros y necesitas 4 hallazgos.'], ['You also pick the rocket and power.', '1 pre-flight test: the fuel.', 'More hazards and you need 4 finds.']],
  hard: [['Presupuesto: hasta 3 instrumentos.', '4 pruebas: Δv, masa, costo y energía.', 'Un evento en el viaje y límite de tiempo.'], ['Budget: up to 3 instruments.', '4 tests: Δv, mass, cost and power.', 'One event on the trip and a time limit.']],
  expert: [['Nivel ingeniero: paneles, batería y escudo térmico con números reales.', '7 pruebas con márgenes. La nave debe cumplirlas todas.', '2 eventos, poco tiempo y el casco aguanta menos presión.'], ['Engineer level: panels, battery and heat shield with real numbers.', '7 tests with margins. Your ship must pass them all.', '2 events, little time and a weaker hull.']],
};
export function LevelPicker({ es, level, onPick, onHelp }: Es & { level: Level; onPick: (l: Level) => void; onHelp: () => void }) {
  const [sel, setSel] = useState<Level>(level);
  return <div className="adv-modal" role="dialog" aria-label="difficulty"><div className="adv-card wide">
    <h2>{t(es, 'Elige tu dificultad', 'Choose your difficulty')}</h2>
    <p>{t(es, 'Mientras más difícil, más decisiones tomas, más pruebas pasas y más técnico se vuelve. En Experto diseñas la nave como un ingeniero.', 'The harder it is, the more decisions you make, the more tests you pass and the more technical it gets. On Expert you design the ship like an engineer.')}</p>
    <div className="lvl-grid">{LEVELS.map(l => <button key={l} className={`lvl ${sel === l ? 'on' : ''}`} style={{ ['--c' as string]: LEVEL_INFO[l].color }} onClick={() => setSel(l)} aria-pressed={sel === l}>
      <span className="lvl-stars">{Array.from({ length: 4 }, (_, k) => <Star key={k} size={14} fill={k < LEVEL_INFO[l].stars ? 'currentColor' : 'none'} />)}</span>
      <b>{es ? LEVEL_INFO[l].es : LEVEL_INFO[l].en}</b>
      <ul>{LEVEL_POINTS[l][es ? 0 : 1].map((p, i) => <li key={i}>{p}</li>)}</ul></button>)}</div>
    <div className="adv-row tut-nav"><button className="button button-secondary" onClick={onHelp}>{t(es, 'Ver tutorial', 'Show tutorial')}</button>
      <button className="button button-primary" autoFocus onClick={() => onPick(sel)}>{t(es, 'Jugar', 'Play')} · {es ? LEVEL_INFO[sel].es : LEVEL_INFO[sel].en}</button></div>
  </div></div>;
}

// ── hangar ───────────────────────────────────────────────────────────────────
function Opt({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon?: React.ReactNode; title: string; sub?: string }) {
  return <button className={`adv-opt ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>{icon && <span className="adv-ico">{icon}</span>}<b>{title}</b>{sub && <small>{sub}</small>}</button>;
}
function Slider({ label, unit, min, max, step = 1, value, onChange }: { label: string; unit: string; min: number; max: number; step?: number; value: number; onChange: (n: number) => void }) {
  return <label className="slider"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /><b>{value} {unit}</b></label>;
}

export function Hangar({ es, level, design, setDesign, onNext, bonus = NO_BONUS, contracts = [], contract = '', setContract, scrap = 0, onWorkshop, onClose, onLevel, boss }: Es & { level: Level; design: Design; setDesign: (d: Design) => void; onNext: () => void; bonus?: RocketBonus; contracts?: Contract[]; contract?: string; setContract?: (id: string) => void; scrap?: number; onWorkshop?: () => void; onClose?: () => void; onLevel?: () => void; boss?: boolean }) {
  useEffect(() => { if (!onClose) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const d = normalize(design, level), S = stats(d), pro = level === 'hard' || level === 'expert', set = (p: Partial<Design>) => setDesign({ ...design, ...p });
  const multi = pro, toggleTool = (k: Tool) => { const has = d.tools.includes(k); set({ tools: multi ? (has ? d.tools.filter(x => x !== k) : [...d.tools, k]) : [k] }); };
  const lvl = LEVEL_INFO[level], bill = supplyCost(d, level), needTool = contracts.find(c => c.id === contract)?.tool, missingTool = !!needTool && !d.tools.includes(needTool), broke = (bill.total > scrap && !!onWorkshop) || missingTool;
  const price = (n: number) => (n > 0 ? ` · 🪙${n}` : ` · ${t(es, 'gratis', 'free')}`);
  return <div className="adv-modal"><div className="adv-card wide">
    <div className="hang-head">{onClose && <button className="hang-x" onClick={onClose} aria-label={t(es, 'Salir del garage', 'Leave the garage')} title="Esc">✕ {t(es, 'Salir', 'Exit')}</button>}<h2>{t(es, 'Prepara tu nave', 'Build your ship')}</h2><span className="lvl-chip" style={{ background: lvl.color }}>{es ? lvl.es : lvl.en}</span>{onWorkshop && <button className="button button-secondary" onClick={onWorkshop}>🔧 {t(es, 'Taller', 'Workshop')} · {scrap}</button>}</div>
    {boss && <div className="boss-warn" role="note">👑 {t(es, 'Esta misión tiene un JEFE esperándote: lleva arma y mejoras. Pagará 5 bajas.', 'This mission has a BOSS waiting: bring a weapon and upgrades. It counts as 5 kills.')}</div>}
    <h3>{t(es, '¿A dónde vas?', 'Where to?')}</h3>
    <div className="adv-row">{(['mars', 'jupiter', 'miller'] as Dest[]).map(k => <Opt key={k} on={d.dest === k} onClick={() => set({ dest: k, shield: DEST[k].shield })} icon={destIcon(k)} title={DEST_NAME[k][es ? 0 : 1]}
      sub={k === 'mars' ? t(es, 'Explora y recolecta muestras', 'Explore and collect samples') : k === 'jupiter' ? t(es, 'Escanea su atmósfera desde órbita', 'Scan its atmosphere from orbit') : t(es, 'Busca vida bajo el océano', 'Look for life under the ocean')} />)}</div>

    {contracts.length > 1 && setContract && <><h3>{t(es, 'Misión', 'Mission')}</h3><ContractPicker es={es} list={contracts} value={contract} onPick={setContract} /></>}

    {level !== 'easy' && <><h3>{t(es, 'Cohete', 'Rocket')}</h3>
      <div className="adv-row">{(['light', 'standard', 'heavy'] as RocketId[]).map(k => <Opt key={k} on={d.rocket === k} onClick={() => set({ rocket: k })} title={ROCKET_TXT[k][es ? 0 : 1]}
        sub={(pro ? `${ROCKETS[k].cost} M$ · ${t(es, 'carga máx.', 'max payload')} ${ROCKETS[k].maxPayload + bonus.payload} kg` : ROCKET_TXT[k][es ? 2 : 3]) + price(ROCKET_PRICE[k])} />)}</div></>}

    {(level === 'medium' || level === 'hard') && <><h3>{t(es, 'Energía', 'Power')}</h3>
      <div className="adv-row"><Opt on={d.solarM2 >= 3} onClick={() => set({ solarM2: 3, batteryKWh: 1 })} icon={<Sun size={28} />} title={t(es, 'Paneles solares', 'Solar panels')} sub={t(es, 'Se recarga con el sol', 'Recharges in the sun')} />
        <Opt on={d.solarM2 < 3} onClick={() => set({ solarM2: 1, batteryKWh: 3 })} icon={<BatteryFull size={28} />} title={t(es, 'Batería grande', 'Big battery')} sub={t(es, 'Dura más, pero no se recarga rápido', 'Lasts longer, recharges slowly')} /></div></>}
    {level === 'expert' && <><h3>{t(es, 'Ingeniería de la nave', 'Ship engineering')}</h3>
      <Slider label={t(es, 'Paneles solares', 'Solar panels')} unit="m²" min={1} max={4} value={d.solarM2} onChange={n => set({ solarM2: n })} />
      <Slider label={t(es, 'Batería', 'Battery')} unit="kWh" min={0} max={4} value={d.batteryKWh} onChange={n => set({ batteryKWh: n })} />
      <Slider label={t(es, 'Escudo térmico', 'Heat shield')} unit={t(es, 'nivel', 'level')} min={1} max={3} value={d.shield} onChange={n => set({ shield: n })} /></>}

    <h3>{multi ? t(es, 'Instrumentos (puedes llevar varios)', 'Instruments (you can bring several)') : t(es, '¿Qué herramienta llevará?', 'Which tool will it carry?')}</h3>
    <div className="adv-row">{(['camera', 'spectrometer', 'radar'] as Tool[]).map(k => <Opt key={k} on={d.tools.includes(k)} onClick={() => toggleTool(k)} icon={toolIcon(k, 28)} title={TOOL_NAME[k][es ? 0 : 1]}
      sub={(pro ? `${TOOLS[k].mass} kg · ${TOOLS[k].cost} M$ · ${TOOLS[k].watts} W` : TOOL_DESC[d.dest][k][es ? 0 : 1]) + price(TOOL_PRICE[k])} />)}</div>
    {level === 'expert' && <small className="hint">{t(es, 'Pista: cada destino exige un instrumento distinto.', 'Hint: each destination requires a different instrument.')}</small>}

    {pro && <div className="stats" aria-label="stats">
      <span>{t(es, 'Carga', 'Payload')}<b>{Math.round(S.payload)} / {ROCKETS[d.rocket].maxPayload + bonus.payload} kg</b></span>
      <span>Δv<b>{(S.dv + bonus.dv).toFixed(2)} / {DEST[d.dest].dv} km/s</b></span>
      <span>{t(es, 'Costo', 'Cost')}<b>{Math.round(S.cost)} / {BUDGET[level] + bonus.budget} M$</b></span>
      <span>{t(es, 'Energía', 'Power')}<b>{Math.round(S.supplyW)} / {Math.round(S.needW)} W</b></span></div>}
    {onWorkshop && <div className={`bill ${broke ? 'bad' : ''}`} aria-label="bill">
      <span>{t(es, 'Equipo de esta misión (se paga en cada misión)', 'This mission’s gear (paid every mission)')}: {bill.lines.filter(l => l.cost > 0).map(l => `${es ? l.es : l.en} 🪙${l.cost}`).join(' + ') || t(es, 'todo gratis', 'all free')}</span>
      <b>{t(es, 'Total', 'Total')} 🪙{bill.total} · {t(es, 'tienes', 'you have')} 🪙{scrap}</b>
      {missingTool ? <small>{t(es, `Esta misión necesita: ${TOOL_NAME[needTool!][0]}. Llévala para poder hacer las fotos.`, `This mission needs: ${TOOL_NAME[needTool!][1]}. Bring it to take the photos.`)}</small> : broke && <small>{t(es, 'No te alcanza: elige equipo más barato (la cámara es gratis).', 'Not enough: pick cheaper gear (the camera is free).')}</small>}</div>}
    {broke && onLevel && <div className="diff-legend" role="note"><span>{t(es, '¿Ya no puedes iniciar una misión? Cambia la dificultad: en Fácil el equipo cuesta menos y siempre puedes volver a intentarlo.', 'Can’t start a mission any more? Switch the difficulty: on Easy the gear costs less and you can always try again.')}</span><button className="button button-secondary" onClick={onLevel}>{t(es, 'Cambiar dificultad', 'Switch difficulty')}</button></div>}
    <button className="button button-primary" autoFocus disabled={broke} onClick={onNext}><Rocket size={18} /> {level === 'easy' ? t(es, '¡Listo para despegar!', 'Ready to launch!') : t(es, 'Probar la nave', 'Test the ship')}</button>
  </div></div>;
}

// ── pre-flight tests ─────────────────────────────────────────────────────────
export function Tests({ es, level, design, onBack, onGo, bonus = NO_BONUS }: Es & { level: Level; design: Design; onBack: () => void; onGo: () => void; bonus?: RocketBonus }) {
  const tr = (v: string) => v.replace(/camera|spectrometer|radar/g, k => TOOL_NAME[k as Tool][es ? 0 : 1]);
  const results: TestResult[] = runTests(design, level, bonus), [shown, setShown] = useState(0);
  useEffect(() => { setShown(0); const id = setInterval(() => setShown(n => { if (n >= results.length) { clearInterval(id); return n; } return n + 1; }), 450); return () => clearInterval(id); }, [results.length]);
  const done = shown >= results.length, ok = passed(results);
  return <div className="adv-modal"><div className="adv-card wide">
    <h2>{t(es, 'Pruebas antes del despegue', 'Pre-flight tests')}</h2>
    <p>{done ? (ok ? t(es, '¡Todas las pruebas pasaron! La nave está lista.', 'All tests passed! The ship is ready.') : t(es, 'Algunas pruebas fallaron. Vuelve al hangar y corrige tu diseño.', 'Some tests failed. Go back to the hangar and fix your design.')) : t(es, 'Probando…', 'Testing…')}</p>
    <ul className="tests">{results.map((r, i) => <li key={r.id} className={i < shown ? (r.ok ? 'ok' : 'bad') : 'wait'}>
      <span className="ti">{i < shown ? (r.ok ? <Check size={18} /> : <XIcon size={18} />) : '…'}</span>
      <div><b>{TEST_NAME[r.id]![es ? 0 : 1]}</b>{i < shown && <small>{tr(r.value)} <em>({t(es, 'se pide', 'needs')} {tr(r.need)})</em></small>}{i < shown && !r.ok && <small className="fix">{es ? r.fixEs : r.fixEn}</small>}</div></li>)}</ul>
    <div className="adv-row tut-nav"><button className="button button-secondary" onClick={onBack}>{t(es, 'Volver al hangar', 'Back to hangar')}</button>
      <button className="button button-primary" disabled={!done || !ok} onClick={onGo}><Rocket size={18} /> {t(es, 'Ir al cohete', 'Go to the rocket')}</button></div>
  </div></div>;
}

// ── travel event ─────────────────────────────────────────────────────────────
export function EventCard({ es, ev, onPick }: Es & { ev: TravelEvent; onPick: (o: EventOption) => void }) {
  return <div className="adv-modal ev"><div className="adv-card">
    <h2>{t(es, '¡Evento en el viaje!', 'Event on the trip!')}</h2><p>{es ? ev.es : ev.en}</p>
    <div className="adv-row">{ev.options.map((o, i) => <Opt key={i} on={false} onClick={() => onPick(o)} title={es ? o.es : o.en} sub={es ? o.noteEs : o.noteEn} />)}</div>
  </div></div>;
}
