import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { X, Rocket, HelpCircle, Star } from 'lucide-react';
import { heightAt, newRover, normalAt, stepRover, type MarsResult, type MarsWorldData, type RoverState, type WorldConfig } from './marsWorld';
import { Terrain, Joystick, type Palette } from './MarsWorld';
import { Rover, Shuttle } from './models';
import { Tutorial, LevelPicker, Hangar as HangarPanel, Tests, EventCard } from './ui';
import { defaultDesign, normalize, eventsFor, applyEffects, type Design, type EventOption, type Dest } from './design';
import { LEVEL_INFO, modsFor, readLevel, saveLevel, tutorialDone, markTutorialDone, type Level } from './levels';
import { useWorldInput, type WorldInput } from './worldInput';
import { rng } from '../three/noise';
import './world.css';
import './adventure.css';

const MarsWorld = lazy(() => import('./MarsWorld'));
const JupiterOrbit = lazy(() => import('./JupiterOrbit'));
const MillerOcean = lazy(() => import('./MillerOcean'));

const EARTH: Palette = { low: '#4fae5d', mid: '#6cc56a', high: '#9bdc7a', pale: '#d8f0a8', pad: '#cfd3dc' };
const HANGAR = new THREE.Vector3(-34, 0, 26), ROCKET = new THREE.Vector3(34, 0, -22), NEAR = 7;

type Phase = 'intro' | 'earth' | 'hangar' | 'tests' | 'launch' | 'travel' | 'mars' | 'end';

const T = {
  es: {
    q0: 'Ve al hangar y prepara tu nave', q1: 'Ve al cohete y despega', arrive: 'Llegaste', hangar: 'Hangar', rocket: 'Cohete',
    enterHangar: 'Entrar al hangar', launchNow: 'Despegar', hangarTitle: 'Prepara tu nave', hangarSub: 'Elige tu destino y qué llevar. Cambian lo que podrás hacer allá.',
    dest: '¿A dónde vas?', mars: 'Marte', marsD: 'Explora y recolecta muestras', jupiter: 'Júpiter', jupiterD: 'Escanea su atmósfera desde órbita', miller: 'Miller', millerD: 'Busca vida en un océano gigante',
    power: '¿Cómo tendrá energía?', tool: '¿Qué herramienta llevará?',
    solar: 'Paneles solares', solarD: 'Se recarga con el sol', battery: 'Batería grande', batteryD: 'Dura más, pero no se recarga rápido',
    camera: 'Cámara', spectrometer: 'Analizador', radar: 'Radar',
    ready: '¡Listo para despegar!', count: ['3', '2', '1', '¡Despegue!'], travel: 'Viaje', travelD: 'Tu nave cruza el espacio…', skip: 'Saltar',
    endTitle: 'Misión cumplida', again: 'Jugar otra vez', next: '¡Prueba otro destino!', quit: 'Volver al inicio',
    help: 'Muévete con WASD o las flechas · E para interactuar', helpPad: 'Stick para moverte · A para interactuar', helpTouch: 'Joystick para moverte · botón E para interactuar',
  },
  en: {
    q0: 'Go to the hangar and build your ship', q1: 'Go to the rocket and launch', arrive: 'Arrived', hangar: 'Hangar', rocket: 'Rocket',
    enterHangar: 'Enter hangar', launchNow: 'Launch', hangarTitle: 'Build your ship', hangarSub: 'Pick a destination and what to bring. They change what you can do there.',
    dest: 'Where to?', mars: 'Mars', marsD: 'Explore and collect samples', jupiter: 'Jupiter', jupiterD: 'Scan its atmosphere from orbit', miller: 'Miller', millerD: 'Look for life in a giant ocean',
    power: 'How will it get power?', tool: 'Which tool will it carry?',
    solar: 'Solar panels', solarD: 'Recharges in the sun', battery: 'Big battery', batteryD: 'Lasts longer, recharges slowly',
    camera: 'Camera', spectrometer: 'Analyzer', radar: 'Radar',
    ready: 'Ready to launch!', count: ['3', '2', '1', 'Liftoff!'], travel: 'Trip', travelD: 'Your ship is crossing space…', skip: 'Skip',
    endTitle: 'Mission complete', again: 'Play again', next: 'Try another destination!', quit: 'Back to start',
    help: 'Move with WASD or arrows · E to interact', helpPad: 'Stick to move · A to interact', helpTouch: 'Joystick to move · E button to interact',
  },
} as const;

function earthWorld(): MarsWorldData {
  const rand = rng(77), rocks: MarsWorldData['rocks'] = [];
  for (let i = 0; i < 90; i++) {
    const x = (rand() * 2 - 1) * 120, z = (rand() * 2 - 1) * 120;
    if (Math.hypot(x, z) < 12 || Math.hypot(x - HANGAR.x, z - HANGAR.z) < 12 || Math.hypot(x - ROCKET.x, z - ROCKET.z) < 12) continue;
    rocks.push({ x, z, s: 1 + rand() * 1.6, r: rand() * 6, tint: rand() });
  }
  return { seed: 77, amp: 0.3, craters: [], rocks, samples: [] };
}
const CFG0: WorldConfig = { seed: 1, camera: false, spectrometer: false, radar: false, battery: 200, solar: 100, health: 100 };

function Trees({ world }: { world: MarsWorldData }) {
  return <>{world.rocks.map((r, i) => {
    const y = heightAt(world, r.x, r.z);
    return <group key={i} position={[r.x, y, r.z]} scale={r.s}>
      <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.18, 0.25, 1.2, 5]} /><meshStandardMaterial color="#8a5a3c" flatShading /></mesh>
      <mesh position={[0, 2, 0]}><coneGeometry args={[1.1, 2.4, 6]} /><meshStandardMaterial color={r.tint > 0.5 ? '#2f9e5b' : '#3fb86a'} flatShading /></mesh>
      <mesh position={[0, 3.1, 0]}><coneGeometry args={[0.8, 1.7, 6]} /><meshStandardMaterial color="#48c978" flatShading /></mesh>
    </group>;
  })}</>;
}

function Hangar() {
  return <group position={[HANGAR.x, 0, HANGAR.z]}>
    <mesh position={[0, 2.2, 0]}><boxGeometry args={[11, 4.4, 8]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>
    {[-1, 1].map(s => <mesh key={s} position={[s * 2.9, 5.5, 0]} rotation={[0, 0, -s * 0.55]}><boxGeometry args={[6.9, 0.5, 8.6]} /><meshStandardMaterial color="#ff7a59" flatShading /></mesh>)}
    <mesh position={[0, 1.7, 4.05]}><boxGeometry args={[5, 3.4, 0.2]} /><meshStandardMaterial color="#5b6ee1" flatShading /></mesh>
    <mesh position={[0, 8.3, 0]}><cylinderGeometry args={[0.1, 0.1, 3, 5]} /><meshStandardMaterial color="#cdb9e0" /></mesh>
  </group>;
}

function RocketModel({ lift, flame }: { lift: React.MutableRefObject<number>; flame: boolean }) {
  const smoke = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!smoke.current) return;
    smoke.current.visible = flame;
    smoke.current.children.forEach((m, i) => { const age = (clock.elapsedTime * 0.9 + i / 18) % 1, a = i * 2.4; m.position.set(Math.cos(a) * age * 8, 0.6 + age * 4, Math.sin(a) * age * 8); m.scale.setScalar(1 + age * 3.5); ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - age); });
  });
  return <group position={[ROCKET.x, 0, ROCKET.z]}>
    <group ref={smoke} visible={false}>{Array.from({ length: 18 }, (_, i) => <mesh key={i}><icosahedronGeometry args={[0.9, 0]} /><meshBasicMaterial color="#fff4e6" transparent opacity={0.8} depthWrite={false} /></mesh>)}</group>
    <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[7, 7.5, 0.3, 8]} /><meshStandardMaterial color="#b9a8d0" flatShading /></mesh>
    <Shuttle lift={lift} flame={flame} />
  </group>;
}

interface Hud { near: 'hangar' | 'rocket' | null; dist: number; bearing: number; heading: number }

function EarthScene({ world, phase, quest, input, poll, hud, lift, onAct }: {
  world: MarsWorldData; phase: Phase; quest: number; input: React.MutableRefObject<WorldInput>; poll: (dt: number) => void;
  hud: React.MutableRefObject<Hud>; lift: React.MutableRefObject<number>; onAct: (w: 'hangar' | 'rocket') => void;
}) {
  const { camera, scene } = useThree();
  const roverRef = useRef<THREE.Group>(null), markers = useRef<THREE.Group>(null);
  const rover = useRef<RoverState>({ ...newRover(CFG0), x: 0, z: 8, heading: -Math.PI / 4, energy: 1e9 });
  const cam = useRef(new THREE.Vector3(0, 8, -10)), tmp = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => ({ a: new THREE.Quaternion(), b: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0), n: new THREE.Vector3() }), []);
  const launchT = useRef(0);
  useEffect(() => { if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__adv = { rover, HANGAR, ROCKET }; }, []);
  useEffect(() => { scene.background = new THREE.Color('#8fd3ff'); scene.fog = new THREE.Fog('#bfe8ff', 80, 320); return () => { scene.fog = null; }; }, [scene]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05), i = input.current;
    poll(dt);
    const launching = phase === 'launch';
    if (launching) { launchT.current += Math.min(rawDt, 0.25); const t = Math.max(0, launchT.current - 3); lift.current = t * t * 9; }
    if (!launching && phase === 'earth') {
      const prev = rover.current;
      let r = stepRover(world, CFG0, prev, { throttle: i.throttle, steer: i.steer, boost: i.boost }, dt);
      for (const o of [HANGAR, ROCKET]) if (Math.hypot(r.x - o.x, r.z - o.z) < 5.5) r = { ...r, x: prev.x, z: prev.z, speed: 0 };
      for (const k of world.rocks) { if (Math.abs(r.x - k.x) < 2.5 && Math.abs(r.z - k.z) < 2.5 && Math.hypot(r.x - k.x, r.z - k.z) < k.s * 0.7 + 1) { r = { ...r, x: prev.x, z: prev.z, speed: -r.speed * 0.2 }; break; } }
      rover.current = { ...r, energy: 1e9 };
      const target = quest === 0 ? HANGAR : ROCKET, d = Math.hypot(r.x - target.x, r.z - target.z);
      const nearH = Math.hypot(r.x - HANGAR.x, r.z - HANGAR.z) < NEAR + 2, nearR = quest >= 1 && Math.hypot(r.x - ROCKET.x, r.z - ROCKET.z) < NEAR + 2;
      hud.current = { near: nearH && quest === 0 ? 'hangar' : nearR ? 'rocket' : null, dist: d, bearing: Math.atan2(target.x - r.x, target.z - r.z), heading: r.heading };
      if (i.collectPulse) { i.collectPulse = false; if (hud.current.near) onAct(hud.current.near); }
    }
    const r = rover.current;
    const rv = roverRef.current;
    if (rv) {
      rv.visible = !launching;
      const y = heightAt(world, r.x, r.z), n = normalAt(world, r.x, r.z);
      rv.position.set(r.x, y + 0.05, r.z); q.n.set(n[0], n[1], n[2]); q.a.setFromUnitVectors(q.up, q.n); q.b.setFromAxisAngle(q.up, r.heading);
      rv.quaternion.slerp(q.a.multiply(q.b), Math.min(1, dt * 8));
    }
    if (markers.current) { const t = quest === 0 ? HANGAR : ROCKET; markers.current.position.set(t.x, 0, t.z); markers.current.rotation.y += dt; markers.current.children[0]!.position.y = 16 + Math.sin(performance.now() / 300) * 0.8; }
    if (launching) {
      tmp.set(ROCKET.x - 16, 4 + lift.current * 0.85, ROCKET.z + 26); cam.current.lerp(tmp, Math.min(1, dt * 3)); camera.position.copy(cam.current);
      const rumble = launchT.current > 3 && lift.current < 25 ? 0.25 : 0; camera.position.x += (Math.random() - 0.5) * rumble; camera.position.y += (Math.random() - 0.5) * rumble;
      camera.lookAt(ROCKET.x, 7 + lift.current, ROCKET.z);
    } else {
      const yaw = r.heading + i.camYaw + Math.PI, dist = 11, pitch = i.camPitch;
      tmp.set(r.x + Math.sin(yaw) * Math.cos(pitch) * dist, heightAt(world, r.x, r.z) + 1.5 + Math.sin(pitch) * dist, r.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.current.lerp(tmp, Math.min(1, dt * 5)); camera.position.copy(cam.current); camera.lookAt(r.x, heightAt(world, r.x, r.z) + 1.3, r.z);
    }
  });

  return <>
    <hemisphereLight args={['#ffffff', '#7fb86a', 1.3]} />
    <directionalLight position={[80, 120, 40]} intensity={1.8} color="#fff6dd" />
    <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1500, 1500]} /><meshStandardMaterial color="#3fa7e8" flatShading /></mesh>
    <Terrain world={world} palette={EARTH} /><Trees world={world} /><Hangar />
    <RocketModel lift={lift} flame={phase === 'launch' && launchT.current > 3} />
    <group ref={roverRef}><Rover /></group>
    {phase === 'earth' && <group ref={markers}>
      <mesh position={[0, 16, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[1.6, 3, 4]} /><meshStandardMaterial color="#ffc857" emissive="#ffc857" emissiveIntensity={0.7} flatShading /></mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[NEAR - 0.8, NEAR, 24]} /><meshBasicMaterial color="#ffc857" transparent opacity={0.85} /></mesh>
    </group>}
  </>;
}

export default function Adventure({ es, onExit }: { es: boolean; onExit: () => void }) {
  const L = T[es ? 'es' : 'en'];
  const [phase, setPhase] = useState<Phase>('intro');
  const [tut, setTut] = useState(() => !tutorialDone());
  const [level, setLevel] = useState<Level>(readLevel);
  const [quest, setQuest] = useState(0);
  const [design, setDesign] = useState<Design>(() => defaultDesign('mars'));
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<MarsResult | null>(null);
  const [run, setRun] = useState(0);
  const [evIdx, setEvIdx] = useState(0);
  const [picked, setPicked] = useState<EventOption[]>([]);
  const [snap, setSnap] = useState<Hud>({ near: null, dist: 0, bearing: 0, heading: 0 });
  const world = useMemo(earthWorld, []);
  const { inp, poll } = useWorldInput();
  const hud = useRef<Hud>(snap), lift = useRef(0);
  useEffect(() => { const t = setInterval(() => setSnap({ ...hud.current }), 100); return () => clearInterval(t); }, []);
  const d = useMemo(() => normalize(design, level), [design, level]);
  const dest: Dest = d.dest;
  const events = useMemo(() => eventsFor(level, run + 1), [level, run]);

  useEffect(() => {
    if (phase !== 'launch') return;
    lift.current = 0; setCount(0);
    const ts = [setTimeout(() => setCount(1), 1000), setTimeout(() => setCount(2), 2000), setTimeout(() => setCount(3), 3000), setTimeout(() => setCount(4), 4600), setTimeout(() => { setEvIdx(0); setPicked([]); setPhase('travel'); }, 8200)];
    return () => ts.forEach(clearTimeout);
  }, [phase]);
  const pending = phase === 'travel' && evIdx < events.length;
  useEffect(() => { if (phase !== 'travel' || pending) return; const t = setTimeout(() => setPhase('mars'), 4500); return () => clearTimeout(t); }, [phase, pending]);

  const mission = useMemo(() => applyEffects(modsFor(level), picked.map(p => p.fx)), [level, picked]);
  const mods = mission.mods;
  const cfg: WorldConfig = useMemo(() => ({
    seed: 1000 + run * 7, health: mission.health,
    battery: ((d.batteryKWh * 100 + 20) * mission.energy) / mods.drainMul, solar: d.solarM2 * 45,
    camera: d.tools.includes('camera'), spectrometer: d.tools.includes('spectrometer'), radar: d.tools.includes('radar'),
  }), [d, run, mission, mods.drainMul]);
  // Jupiter and Miller take one main tool: the one that sees farthest
  const tool = d.tools.includes('radar') ? 'radar' : d.tools.includes('camera') ? 'camera' : 'spectrometer';

  const onAct = (w: 'hangar' | 'rocket') => { if (w === 'hangar') setPhase('hangar'); else setPhase('launch'); };
  const reset = () => { setPhase('earth'); setQuest(0); setResult(null); setRun(r => r + 1); setPicked([]); lift.current = 0; };
  const pickLevel = (l: Level) => { setLevel(l); saveLevel(l); setPhase('earth'); };
  const done = (r: MarsResult) => { setResult(r); setPhase('end'); };

  if (phase === 'mars') return <Suspense fallback={<div className="w-root adv-center">…</div>}>
    {dest === 'jupiter'
      ? <JupiterOrbit tool={tool} es={es} mods={mods} onDone={done} onExit={onExit} />
      : dest === 'miller'
      ? <MillerOcean tool={tool} es={es} mods={mods} onDone={done} onExit={onExit} />
      : <MarsWorld cfg={cfg} es={es} mods={mods} onDone={done} onExit={onExit} />}
  </Suspense>;

  const lvl = LEVEL_INFO[level];
  return <div className="w-root adv-root"
    onPointerDown={e => { if ((e.target as HTMLElement).tagName === 'CANVAS') (e.currentTarget as HTMLElement).dataset.drag = `${e.clientX},${e.clientY}`; }}
    onPointerMove={e => { const el = e.currentTarget as HTMLElement, dr = el.dataset.drag; if (!dr) return; const [x, y] = dr.split(',').map(Number); inp.current.camYaw -= (e.clientX - x!) * 0.006; inp.current.camPitch = Math.max(0.1, Math.min(1.1, inp.current.camPitch + (e.clientY - y!) * 0.004)); el.dataset.drag = `${e.clientX},${e.clientY}`; }}
    onPointerUp={e => { delete (e.currentTarget as HTMLElement).dataset.drag; }}>
    <Canvas dpr={[1, 1.6]} camera={{ fov: 62, near: 0.1, far: 600, position: [0, 8, -10] }}>
      <Suspense fallback={null}><EarthScene world={world} phase={phase} quest={quest} input={inp} poll={poll} hud={hud} lift={lift} onAct={onAct} /></Suspense>
    </Canvas>
    <button className="w-btn w-exit" onClick={onExit} aria-label={L.quit}><X size={20} /></button>

    {phase === 'earth' && <>
      <div className="adv-quest"><span className="adv-step">{quest + 1}/2</span><b>{quest === 0 ? L.q0 : L.q1}</b>
        <button className="lvl-btn" style={{ background: lvl.color }} onClick={() => setPhase('intro')} title={es ? 'Cambiar dificultad' : 'Change difficulty'}><Star size={14} fill="currentColor" /> {es ? lvl.es : lvl.en}</button>
        <button className="lvl-btn help" onClick={() => setTut(true)} aria-label={es ? 'Ayuda' : 'Help'}><HelpCircle size={18} /></button></div>
      <div className="adv-arrow" aria-hidden="true"><i style={{ transform: `rotate(${snap.heading - snap.bearing + Math.PI}rad)` }} /><span>{Math.round(snap.dist)} m</span></div>
      {snap.near && <button className="adv-prompt" onClick={() => onAct(snap.near!)}><span className="w-key">E</span><span className="w-key pad">A</span>{snap.near === 'hangar' ? L.enterHangar : L.launchNow}</button>}
      <div className="w-help adv-help"><span>{L.help}</span><span>{L.helpPad}</span><span>{L.helpTouch}</span></div>
      <div className="w-touch"><Joystick input={inp} /><div className="w-btns"><button className="w-btn big" onPointerDown={() => { inp.current.collectPulse = true; }}>E</button></div></div>
    </>}

    {phase === 'intro' && !tut && <LevelPicker es={es} level={level} onPick={pickLevel} onHelp={() => setTut(true)} />}
    {tut && <Tutorial es={es} onClose={() => { markTutorialDone(); setTut(false); }} />}
    {phase === 'hangar' && <HangarPanel es={es} level={level} design={design} setDesign={setDesign} onNext={() => { if (level === 'easy') { setQuest(1); setPhase('earth'); } else setPhase('tests'); }} />}
    {phase === 'tests' && <Tests es={es} level={level} design={design} onBack={() => setPhase('hangar')} onGo={() => { setQuest(1); setPhase('earth'); }} />}

    {phase === 'launch' && count < 4 && <div className="adv-count" aria-live="assertive">{L.count[count]}</div>}
    {phase === 'travel' && <div className="adv-travel"><div className="adv-stars" /><div className={`adv-dest ${dest}`} aria-hidden="true" /><Rocket className="adv-ship" size={64} aria-hidden="true" /><h2>{L.travel}: {L[dest]}</h2><p>{L.travelD}</p><div className="adv-progress"><span /></div>
      {!pending && <button className="button button-secondary" onClick={() => setPhase('mars')}>{L.skip}</button>}
      {pending && <EventCard es={es} ev={events[evIdx]!} onPick={o => { setPicked(p => [...p, o]); setEvIdx(i => i + 1); }} />}</div>}
    {phase === 'end' && result && <div className="adv-modal"><div className="adv-card center">
      <h2>{L.endTitle}</h2><div className="w-grade">{result.grade}</div><p><b>{result.score}</b>/100 · {es ? lvl.es : lvl.en}</p><p className="adv-next">{L.next}</p>
      <div className="adv-row"><button className="button button-primary" autoFocus onClick={reset}>{L.again}</button></div>
    </div></div>}
  </div>;
}
