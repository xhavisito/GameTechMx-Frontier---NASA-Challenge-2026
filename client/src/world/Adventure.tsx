import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Polish, VehicleDust } from './polish';
import { X, Rocket, HelpCircle, Star } from 'lucide-react';
import { heightAt, newRover, normalAt, stepRover, type MarsResult, type MarsWorldData, type RoverState, type WorldConfig } from './marsWorld';
import { Terrain, Joystick, type Palette } from './MarsWorld';
import { Rover, Shuttle } from './models';
import { HangarBuilding, HANGAR_POS, hangarBlocked, onApron, APRON_Y } from './hangar3d';
import { sfx, setTheme } from './audio';
import { track, subscribe, getProgress, ACHIEVEMENTS, type Ev } from './progress';
import { SOURCES } from './sources';
import { ProgressPanel } from './progressui';
import { setCombatListener, resetBossHud } from './combat';
import { StoryBubble, DailyPanel } from './storyui';
import { Quiz, SciDayPanel, type Answer } from './quizui';
import { LogBook, worldCard } from './logbook';
import { loadReview, saveReview, loadSciDay, saveSciDay, answer, dueIds, pickIds, cardOfDay, markSciDay, SCI_DAY_REWARD, SCI_QUIZ_REWARD } from './review';
import { dayKey, dayNumber, yesterday, destOfDay, seedOfDay, loadDaily, saveDaily, recordDaily, type DailyDest } from './daily';
import { powerOf, scaleForPower } from './threat';
import { PITCH, GOAL_HALF, BALL_R, REWARD, COIN_POS, RACE, RAMP, inPitch, newBall, newCoins, newRace, newAir, stepBall, stepCoins, stepRace, stepAir, coinsLeft } from './earthgames';
import { LobbyDeco } from './lobbydeco';
import { solidAt, keepClear, ROCKET_POS } from './lobby';
import { SkyLife, RaceProps, RampProp } from './skylife';
import { Tutorial, LevelPicker, Hangar as HangarPanel, Tests } from './ui';
import { Board, TripCard, RunChips } from './boardui';
import { offersFor, applyJobs, settle, jobById, slotsFor, type Job, type JobRow } from './board';
import { loadRun, saveRun, grant, remember, applyRunPerks, applyRunMods } from './runstate';
import { pickTrip, resolveOption, describeOut, type TEvent, type Out } from './tripevents';
import { Workshop, Draft, Reward } from './workshop';
import { Money, HurtFlash, BossBar } from './hud';
import { loadMeta, saveMeta, perksFor, tierOf, withCard, draw, basePerks, type Meta, type RunCard, type Ship } from './meta';
import { contractsFor, contractById, defaultContract, contractN } from './contracts';
import { scrapParts, scrapReward } from './runkit';
import { defaultDesign, supplyCost, EMERGENCY_FUND, normalize, applyEffects, type Design, type EventOption, type Dest } from './design';
import { LEVEL_INFO, modsFor, readLevel, saveLevel, tutorialDone, markTutorialDone, type Level } from './levels';
import { useWorldInput, type WorldInput } from './worldInput';
import { rng } from '../three/noise';
import './world.css';
import './adventure.css';

const MarsWorld = lazy(() => import('./MarsWorld'));
const JupiterOrbit = lazy(() => import('./JupiterOrbit'));
const MillerOcean = lazy(() => import('./MillerOcean'));

const EARTH: Palette = { low: '#4fae5d', mid: '#6cc56a', high: '#9bdc7a', pale: '#d8f0a8', pad: '#cfd3dc' };
const HANGAR = new THREE.Vector3(HANGAR_POS.x, 0, HANGAR_POS.z), ROCKET = new THREE.Vector3(ROCKET_POS.x, 0, ROCKET_POS.z), NEAR = 7;

type Phase = 'intro' | 'earth' | 'hangar' | 'workshop' | 'tests' | 'launch' | 'travel' | 'draft' | 'board' | 'mars' | 'end';

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
    if (inPitch(x, z, 5) || [RACE.start, ...RACE.cones, RAMP].some(q => Math.hypot(x - q.x, z - q.z) < 6) || COIN_POS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 5) || Math.hypot(x, z) < 12 || Math.hypot(x - HANGAR.x, z - HANGAR.z) < 20 || keepClear(x, z, 2) || Math.hypot(x - ROCKET.x, z - ROCKET.z) < 12) continue;
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

/** The little kick-about pitch: grass, white lines and a goal at the far end. */
function Pitch() {
  const { x, z, hw, hl, y } = PITCH, line = (w: number, d: number, px: number, pz: number, k: string) => <mesh key={k} position={[px, y + 0.03, pz]}><boxGeometry args={[w, 0.05, d]} /><meshBasicMaterial color="#ffffff" /></mesh>;
  return <group>
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[hw * 2, hl * 2]} /><meshStandardMaterial color="#58c26f" flatShading /></mesh>
    {line(hw * 2, 0.3, x, z - hl, 'a')}{line(hw * 2, 0.3, x, z + hl, 'b')}{line(0.3, hl * 2, x - hw, z, 'c')}{line(0.3, hl * 2, x + hw, z, 'd')}{line(hw * 2, 0.25, x, z, 'e')}
    <mesh position={[x, y + 0.04, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3.2, 3.45, 24]} /><meshBasicMaterial color="#ffffff" /></mesh>
    {[-1, 1].map(sd => <mesh key={sd} position={[x + sd * GOAL_HALF, y + 1.6, z - hl]}><boxGeometry args={[0.35, 3.2, 0.35]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>)}
    <mesh position={[x, y + 3.2, z - hl]}><boxGeometry args={[GOAL_HALF * 2 + 0.35, 0.35, 0.35]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>
    <mesh position={[x, y + 1.6, z - hl - 1.2]}><boxGeometry args={[GOAL_HALF * 2, 3.2, 0.1]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.28} /></mesh>
  </group>;
}
function RocketModel({ lift, flame, tier = 0 }: { lift: React.MutableRefObject<number>; flame: boolean; tier?: number }) {
  const smoke = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!smoke.current) return;
    smoke.current.visible = flame;
    smoke.current.children.forEach((m, i) => { const age = (clock.elapsedTime * 0.9 + i / 18) % 1, a = i * 2.4; m.position.set(Math.cos(a) * age * 8, 0.6 + age * 4, Math.sin(a) * age * 8); m.scale.setScalar(1 + age * 3.5); ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - age); });
  });
  return <group position={[ROCKET.x, 0, ROCKET.z]}>
    <group ref={smoke} visible={false}>{Array.from({ length: 18 }, (_, i) => <mesh key={i}><icosahedronGeometry args={[0.9, 0]} /><meshBasicMaterial color="#fff4e6" transparent opacity={0.8} depthWrite={false} /></mesh>)}</group>
    <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[7, 7.5, 0.3, 8]} /><meshStandardMaterial color="#b9a8d0" flatShading /></mesh>
    <Shuttle lift={lift} flame={flame} tier={tier} />
  </group>;
}

interface Hud { near: 'hangar' | 'rocket' | null; dist: number; bearing: number; heading: number }

function EarthScene({ world, phase, quest, input, poll, hud, lift, onAct, roverTier, rocketTier, laser, count, onEarn, onPlay, raceHud }: {
  onPlay: (e: { kind: 'start' | 'cone' | 'finish' | 'timeout' | 'jump'; gain: number; secs?: number; n?: number }) => void; raceHud: React.MutableRefObject<{ run: boolean; t: number; next: number }>;
  onEarn: (e: { gain: number; goals: number; coins: number; round: boolean; left: number }) => void; count: number; roverTier: number; rocketTier: number; laser: boolean;
  world: MarsWorldData; phase: Phase; quest: number; input: React.MutableRefObject<WorldInput>; poll: (dt: number) => void;
  hud: React.MutableRefObject<Hud>; lift: React.MutableRefObject<number>; onAct: (w: 'hangar' | 'rocket') => void;
}) {
  const { camera, scene } = useThree();
  const roverRef = useRef<THREE.Group>(null), markers = useRef<THREE.Group>(null);
  const rover = useRef<RoverState>({ ...newRover(CFG0), x: 0, z: 8, heading: -Math.PI / 4, energy: 1e9 });
  const cam = useRef(new THREE.Vector3(0, 8, -10)), tmp = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => ({ a: new THREE.Quaternion(), b: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0), n: new THREE.Vector3() }), []);
  const ball = useRef(newBall()), ballRef = useRef<THREE.Group>(null), field = useRef(newCoins()), coinRefs = useRef<(THREE.Group | null)[]>([]);
  const race = useRef(newRace()), air = useRef(newAir()), airLift = useRef(0), [raceState, setRaceState] = useState({ next: 0, running: false });
  const launchT = useRef(0), launchStart = useRef<number | null>(null);   // wall-clock, so a slow or hidden tab cannot desync it from the countdown timers
  useEffect(() => { if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__adv = { rover, HANGAR, ROCKET }; }, []);
  useEffect(() => { scene.background = new THREE.Color('#8fd3ff'); scene.fog = new THREE.Fog('#bfe8ff', 80, 320); return () => { scene.fog = null; }; }, [scene]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05), i = input.current;
    poll(dt);
    const launching = phase === 'launch';
    if (launching) { launchStart.current ??= performance.now(); launchT.current = (performance.now() - launchStart.current) / 1000; const t = Math.max(0, launchT.current - 3); lift.current = t * t * 9; }
    else { launchStart.current = null; launchT.current = 0; if (phase === 'earth') lift.current = 0; i.collectPulse = phase === 'earth' ? i.collectPulse : false; }
    if (!launching && phase === 'earth') {
      const prev = rover.current;
      let r = stepRover(world, CFG0, prev, { throttle: i.throttle, steer: i.steer, boost: i.boost }, dt);
      if (Math.hypot(r.x - ROCKET.x, r.z - ROCKET.z) < 5.5 || hangarBlocked(r.x, r.z) || solidAt(r.x, r.z)) r = { ...r, x: prev.x, z: prev.z, speed: 0 };
      for (const k of world.rocks) { if (Math.abs(r.x - k.x) < 2.5 && Math.abs(r.z - k.z) < 2.5 && Math.hypot(r.x - k.x, r.z - k.z) < k.s * 0.7 + 1) { r = { ...r, x: prev.x, z: prev.z, speed: -r.speed * 0.2 }; break; } }
      rover.current = { ...r, energy: 1e9 };
      const target = quest === 0 ? HANGAR : ROCKET, d = Math.hypot(r.x - target.x, r.z - target.z);
      const nearH = Math.hypot(r.x - HANGAR.x, r.z - HANGAR.z) < NEAR + 5, nearR = quest >= 1 && Math.hypot(r.x - ROCKET.x, r.z - ROCKET.z) < NEAR + 2;
      hud.current = { near: nearH && quest === 0 ? 'hangar' : nearR ? 'rocket' : null, dist: d, bearing: Math.atan2(target.x - r.x, target.z - r.z), heading: r.heading };
      if (i.collectPulse) { i.collectPulse = false; if (hud.current.near) onAct(hud.current.near); }
      // side games: kick-about pitch and coin hunt
      const sb = stepBall(ball.current, { x: r.x, z: r.z, speed: r.speed, heading: r.heading }, dt); ball.current = sb.ball;
      const sc = stepCoins(field.current, r, dt), goals = sb.goal ? 1 : 0, gain = goals * REWARD.goal + sc.got * REWARD.coin + (sc.round ? REWARD.round : 0);
      if (gain > 0) onEarn({ gain, goals, coins: sc.got, round: sc.round, left: coinsLeft(field.current) });
      const re = stepRace(race.current, r, dt);
      if (re) {
        onPlay(re.type === 'finish' ? { kind: 'finish', gain: re.reward, secs: re.secs } : re.type === 'cone' ? { kind: 'cone', gain: 0, n: re.n } : { kind: re.type, gain: 0 });
        setRaceState({ next: race.current.next, running: race.current.run });
      }
      raceHud.current = { run: race.current.run, t: race.current.t, next: race.current.next };
      const ar = stepAir(air.current, r, dt); airLift.current = ar.lift; if (ar.jumped) onPlay({ kind: 'jump', gain: 1 });
    }
    if (ballRef.current) { const bl = ball.current; ballRef.current.position.set(bl.x, PITCH.y + BALL_R, bl.z); ballRef.current.rotation.x += bl.vz * dt / BALL_R; ballRef.current.rotation.z -= bl.vx * dt / BALL_R; }
    field.current.coins.forEach((c, k) => { const g = coinRefs.current[k]; if (g) { g.visible = !c.got; g.rotation.y += dt * 2.5; g.position.set(c.x, heightAt(world, c.x, c.z) + 1.5 + Math.sin(performance.now() / 350 + k) * 0.25, c.z); } });
    const r = rover.current;
    const rv = roverRef.current;
    if (rv) {
      rv.visible = !launching;
      const flat = inPitch(r.x, r.z) || onApron(r.x, r.z), y = inPitch(r.x, r.z) ? PITCH.y : onApron(r.x, r.z) ? APRON_Y : heightAt(world, r.x, r.z), n = flat ? [0, 1, 0] : normalAt(world, r.x, r.z);
      rv.position.set(r.x, y + 0.05 + airLift.current, r.z); q.n.set(n[0], n[1], n[2]); q.a.setFromUnitVectors(q.up, q.n); q.b.setFromAxisAngle(q.up, r.heading);
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
    <directionalLight position={[80, 120, 40]} intensity={1.8} color="#fff6dd" /><Polish />
    <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1500, 1500]} /><meshStandardMaterial color="#3fa7e8" flatShading /></mesh>
    <Terrain world={world} palette={EARTH} /><Trees world={world} /><HangarBuilding />
    <RocketModel lift={lift} flame={phase === 'launch' && count >= 3} tier={rocketTier} />
    <Pitch /><SkyLife /><LobbyDeco world={world} /><RaceProps world={world} next={raceState.next} running={raceState.running} /><RampProp world={world} />
    <group ref={ballRef}><mesh><icosahedronGeometry args={[BALL_R, 1]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh><mesh scale={1.02}><dodecahedronGeometry args={[BALL_R * 0.98, 0]} /><meshStandardMaterial color="#2a1f3d" flatShading transparent opacity={0.55} /></mesh></group>
    {COIN_POS.map(([x, z], k) => <group key={`${x},${z}`} ref={n => { coinRefs.current[k] = n; }} position={[x, 2, z]}>
      <mesh><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#ffc857" emissive="#ffc857" emissiveIntensity={0.7} flatShading /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.25, 0.08, 4, 14]} /><meshBasicMaterial color="#fff4c2" /></mesh>
    </group>)}
    <VehicleDust target={roverRef} color="#cfc7a0" />
    <group ref={roverRef}><Rover tier={roverTier} laser={laser} /></group>
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
  const [picked, setPicked] = useState<Out[]>([]), [events, setEvents] = useState<TEvent[]>([]), [tripNote, setTripNote] = useState('');
  const [runSt, setRunSt] = useState(loadRun), [accepted, setAccepted] = useState<Job[]>([]), [offers, setOffers] = useState<Job[]>([]), [jobRows, setJobRows] = useState<JobRow[]>([]);
  useEffect(() => { saveRun(runSt); }, [runSt]);
  const [review, setReview] = useState(loadReview), [sciDay, setSciDay] = useState(loadSciDay), [showSci, setShowSci] = useState(false), [quizDone, setQuizDone] = useState(false);
  const [quiz, setQuiz] = useState<{ ids: string[]; kind: 'mission' | 'day' | 'review'; title: string } | null>(null);
  const today = dayNumber(dayKey()), dueN = dueIds(review, today).length;
  const openQuiz = (kind: 'mission' | 'day' | 'review', prefer: string[] = []) => {
    const ids = kind === 'day' ? [cardOfDay(dayKey())] : pickIds(review, today, getProgress().found, kind === 'mission' ? 2 : 4, prefer);
    setShowSci(false); setQuiz({ ids, kind, title: kind === 'day' ? (es ? 'Pregunta del día' : 'Question of the day') : (es ? 'Repaso rápido' : 'Quick review') });
  };
  const finishQuiz = (res: Answer[]) => {
    const k = quiz!.kind, right = res.filter(r => r.ok).length; let nr = review;
    for (const r of res) nr = answer(nr, r.id, r.ok, today);
    setReview(nr); saveReview(nr);
    let gain = right * SCI_QUIZ_REWARD;
    if (k === 'day') { const first = sciDay.last !== dayKey(); gain = first && right ? SCI_DAY_REWARD : 0; const ns = markSciDay(sciDay, dayKey(), yesterday(dayKey())); setSciDay(ns); saveSciDay(ns); }
    if (gain > 0) setMeta({ ...meta, scrap: meta.scrap + gain });
    if (right) track({ t: 'quiz', ok: right });
    if (k === 'mission') setQuizDone(true);
    setQuiz(null);
  };
  const [meta, setMetaState] = useState<Meta>(loadMeta);
  const metaRef = useRef(meta); metaRef.current = meta;
  const setMeta = (m: Meta) => { metaRef.current = m; setMetaState(m); saveMeta(m); track({ t: 'wallet', scrap: m.scrap }); };
  const [showProg, setShowProg] = useState(false), [unlock, setUnlock] = useState(''), [beats, setBeats] = useState<string[]>([]);
  const [daily, setDaily] = useState<{ key: string; dest: DailyDest; seed: number } | null>(null), [dailyRec, setDailyRec] = useState(loadDaily), [showDaily, setShowDaily] = useState(false);
  useEffect(() => {   // celebrate new achievements and science cards, one after another
    let q: string[] = [], busy = false, timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => { const m = q.shift(); if (!m) { busy = false; setUnlock(''); return; } busy = true; setUnlock(m); sfx('unlock'); timer = setTimeout(next, 2600); };
    const off = subscribe((_p, n) => {
      if (n.beats.length) setBeats(b => [...b, ...n.beats.filter(x => !b.includes(x))]);
      for (const id of n.ach) { const a = ACHIEVEMENTS.find(x => x.id === id); if (a) q.push(`🏆 ${es ? 'Logro' : 'Achievement'}: ${a.icon} ${es ? a.es : a.en}`); }
      for (const id of n.found) { const s = SOURCES.find(x => x.id === id); if (s) q.push(`📖 ${es ? 'Nueva tarjeta de ciencia' : 'New science card'}: ${es ? s.name.es : s.name.en}`); }
      if (!busy) next();
    });
    setCombatListener(e => { if (e.type === 'kill') track({ t: 'kill', kind: e.enemy.kind }); });
    return () => { off(); setCombatListener(null); clearTimeout(timer); };
  }, [es]);
  const [play, setPlay] = useState({ goals: 0, coins: 0, left: COIN_POS.length, toast: '' });
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onEarn = (e: { gain: number; goals: number; coins: number; round: boolean; left: number }) => {
    setMeta({ ...metaRef.current, scrap: metaRef.current.scrap + e.gain }); sfx(e.goals ? 'goal' : 'coin');
    if (e.goals) track({ t: 'goal' }); for (let i = 0; i < e.coins; i++) track({ t: 'coin' }); if (e.round) track({ t: 'round' });
    const msg = e.goals ? (es ? '⚽ ¡GOOOL! +' : '⚽ GOAL! +') + e.gain + ' 🪙' : e.round ? (es ? '⭐ ¡Todas las monedas! +' : '⭐ All the coins! +') + e.gain + ' 🪙' : '⭐ +' + e.gain + ' 🪙';
    setPlay(p => ({ goals: p.goals + e.goals, coins: p.coins + e.coins, left: e.round ? COIN_POS.length : e.left, toast: msg }));
    clearTimeout(toastT.current); toastT.current = setTimeout(() => setPlay(p => ({ ...p, toast: '' })), 1800);
  };
  const raceHud = useRef({ run: false, t: 0, next: 0 }), [raceSnap, setRaceSnap] = useState({ run: false, t: 0, next: 0 });
  const onPlay = (e: { kind: 'start' | 'cone' | 'finish' | 'timeout' | 'jump'; gain: number; secs?: number; n?: number }) => {
    if (e.gain > 0) setMeta({ ...metaRef.current, scrap: metaRef.current.scrap + e.gain });
    const msg = e.kind === 'start' ? (es ? '🏁 ¡Ya! Toca los 5 conos en orden y vuelve a la meta' : '🏁 Go! Touch the 5 cones in order and return to the gate')
      : e.kind === 'cone' ? `🔶 ${e.n}/${RACE.cones.length}` : e.kind === 'finish' ? `🏁 ${e.secs}s · +${e.gain} 🪙` : e.kind === 'timeout' ? (es ? '⏱️ Se acabó el tiempo' : '⏱️ Time is up') : (es ? '🛹 ¡Salto! +1 🪙' : '🛹 Jump! +1 🪙');
    sfx(e.kind === 'jump' ? 'ramp' : e.kind === 'finish' ? 'goal' : e.kind === 'timeout' ? 'fail' : e.kind === 'start' ? 'go' : 'coin');
    if (e.kind === 'jump') track({ t: 'jump' }); if (e.kind === 'finish') track({ t: 'cones', secs: e.secs! });
    setPlay(p => ({ ...p, toast: msg })); clearTimeout(toastT.current); toastT.current = setTimeout(() => setPlay(p => ({ ...p, toast: '' })), 2200);
  };
  useEffect(() => { const t = setInterval(() => setRaceSnap({ ...raceHud.current }), 150); return () => clearInterval(t); }, []);
  useEffect(() => () => clearTimeout(toastT.current), []);
  const [card, setCard] = useState<RunCard | null>(null);
  const [contractId, setContractId] = useState('');
  const [reward, setReward] = useState(0);
  const [paid, setPaid] = useState(0);
  const wsBack = useRef<Phase>('hangar');
  const [snap, setSnap] = useState<Hud>({ near: null, dist: 0, bearing: 0, heading: 0 });
  const world = useMemo(earthWorld, []);
  const { inp, poll } = useWorldInput();
  const hud = useRef<Hud>(snap), lift = useRef(0);
  useEffect(() => { const t = setInterval(() => setSnap({ ...hud.current }), 100); return () => clearInterval(t); }, []);
  const d = useMemo(() => normalize(design, level), [design, level]);
  const dest: Dest = d.dest;
  const ship: Ship = dest === 'jupiter' ? 'orbiter' : dest === 'miller' ? 'sub' : 'rover';
  const rocketPerks = useMemo(() => perksFor('rocket', meta), [meta]);
  const bonus = useMemo(() => ({ dv: rocketPerks.dv, payload: rocketPerks.payload, budget: rocketPerks.budget }), [rocketPerks]);
  const contracts = useMemo(() => contractsFor(dest, level), [dest, level]);
  const contract = contracts.find(c => c.id === contractId) ?? contractById(contractId) ?? defaultContract(dest);
  const activeContract = contract.world === dest ? contract : defaultContract(dest);
  const perks0 = useMemo(() => applyRunPerks(withCard(perksFor(ship, meta), card), runSt), [ship, meta, card, runSt]);
  const cards = useMemo(() => draw(run * 7919 + 13 + level.length, 3), [run, level]);

  useEffect(() => {
    if (phase !== 'launch') return;
    lift.current = 0; setCount(0);
    const ts = [setTimeout(() => { setCount(1); sfx('beep'); }, 1000), setTimeout(() => { setCount(2); sfx('beep'); }, 2000), setTimeout(() => { setCount(3); sfx('launch'); }, 3000), setTimeout(() => setCount(4), 4600), setTimeout(() => { setEvIdx(0); setPicked([]); setTripNote(''); setPhase('travel'); }, 8200)];
    return () => ts.forEach(clearTimeout);
  }, [phase]);
  const pending = phase === 'travel' && evIdx < events.length;
  useEffect(() => { if (phase !== 'travel' || pending) return; const t = setTimeout(() => { track({ t: 'trip', ids: events.map(x => x.id) }); setPhase('draft'); }, 4500); return () => clearTimeout(t); }, [phase, pending]);

  const mission = useMemo(() => applyEffects(modsFor(level), picked.map(p => p.fx ?? {}), rocketPerks.tripShield), [level, picked, rocketPerks]);
  const shipOf = d.dest === 'mars' ? 'rover' : d.dest === 'jupiter' ? 'orbiter' : 'sub';
  const power = useMemo(() => powerOf(meta, shipOf), [meta, shipOf]);
  const bossNext = (meta.runs + 1) % 4 === 0;   // every 4th mission has a boss
  const mods0 = useMemo(() => applyRunMods({ ...scaleForPower(mission.mods, power), boss: bossNext }, runSt), [mission.mods, power, bossNext, runSt]);   // stronger ship → tougher, more varied enemies (max 4); the run's effects stack on top
  const jobbed = useMemo(() => applyJobs(mods0, perks0, accepted), [mods0, perks0, accepted]);   // accepted board jobs change this mission for real
  const mods = jobbed.mods, perks = jobbed.perks;
  const cfg: WorldConfig = useMemo(() => ({
    seed: 1000 + run * 7, health: mission.health * (perks.health / 100),
    battery: ((d.batteryKWh * 100 + 20) * mission.energy * perks.energyMul) / mods.drainMul, solar: d.solarM2 * 45,
    camera: d.tools.includes('camera'), spectrometer: d.tools.includes('spectrometer'), radar: d.tools.includes('radar'),
  }), [d, run, mission, mods.drainMul]);
  // Jupiter and Miller take one main tool: the one that sees farthest
  const tool = d.tools.includes('radar') ? 'radar' : d.tools.includes('camera') ? 'camera' : 'spectrometer';

  const bill = useMemo(() => supplyCost(design, level), [design, level]);
  // gear is bought again for every mission: it is paid when you press launch
  const onAct = (w: 'hangar' | 'rocket') => {
    if (phase !== 'earth') return;   // no double launches, no stale presses from another screen
    if (w === 'hangar') { setPhase('hangar'); return; }
    if (bill.total > meta.scrap) { setPhase('hangar'); return; }
    track({ t: 'launch', dest: d.dest, tools: d.tools, shield: d.shield });
    const trip = pickTrip(level, d.dest, Math.random, runSt.seen); setEvents(trip); setRunSt(s => remember(s, trip.map(e => e.id))); setAccepted([]); setJobRows([]);
    setPaid(bill.total); if (bill.total > 0) setMeta({ ...meta, scrap: meta.scrap - bill.total });
    setPhase('launch');
  };
  const reset = () => { setDaily(null); setPhase('earth'); setQuest(0); setResult(null); setRun(r => r + 1); setPicked([]); setCard(null); setAccepted([]); setQuizDone(false); lift.current = 0; };
  const openWorkshop = (back: Phase) => { wsBack.current = back; setPhase('workshop'); };
  const pickLevel = (l: Level) => { setLevel(l); saveLevel(l); setPhase('earth'); };
  useEffect(() => {
    setTheme(phase === 'mars' ? (d.dest as 'mars' | 'jupiter' | 'miller') : phase === 'earth' || phase === 'hangar' || phase === 'workshop' || phase === 'tests' ? 'earth' : phase === 'intro' ? null : 'calm');
  }, [phase, d.dest]);
  useEffect(() => () => { setTheme(null); resetBossHud(); }, []);
  useEffect(() => { if (!tut && phase === 'earth') track({ t: 'visit' }); }, [tut, phase]);   // the base crew says hello the first time
  /** The daily challenge: fixed world, seed, gear and no upgrades, so everyone's score is comparable. */
  const dailyRun = useMemo(() => {
    if (!daily) return null;
    const dd = normalize(defaultDesign(daily.dest), 'medium'), mi = applyEffects(modsFor('medium'), [], 0), pk = basePerks(), m = { ...mi.mods, boss: false };
    return { dest: daily.dest, mods: m, perks: pk, contract: defaultContract(daily.dest), tool: dd.tools.includes('radar') ? 'radar' as const : dd.tools.includes('camera') ? 'camera' as const : 'spectrometer' as const,
      cfg: { seed: daily.seed, health: mi.health, battery: ((dd.batteryKWh * 100 + 20) * mi.energy * pk.energyMul) / m.drainMul, solar: dd.solarM2 * 45, camera: dd.tools.includes('camera'), spectrometer: dd.tools.includes('spectrometer'), radar: dd.tools.includes('radar') } as WorldConfig };
  }, [daily]);
  const startDaily = () => { const key = dayKey(); setDaily({ key, dest: destOfDay(key), seed: seedOfDay(key) }); setShowDaily(false); setCard(null); setPhase('mars'); };
  const done = (r: MarsResult) => {
    resetBossHud();
    if (daily) {   // the daily run never touches upgrades or the run counter
      sfx(r.returned ? 'win' : 'fail');
      const rr = recordDaily(dailyRec, daily.key, r.score, daily.dest, r.returned); setDailyRec(rr.rec); saveDaily(rr.rec);
      setReward(rr.bonus); setPaid(0); if (rr.bonus > 0) setMeta({ ...meta, scrap: meta.scrap + rr.bonus });
      track({ t: 'daily', returned: r.returned, score: r.score });
      setResult({ ...r, scrapWhy: [] }); setPhase('end'); return;
    }
    sfx(r.returned ? 'win' : 'fail');
    const gain = scrapReward(r, mods, perks, activeContract), sp = scrapParts(r, mods, perks, activeContract), sub = sp.base.reduce((a, p) => a + p.pts, 0);
    const scrapWhy = [...sp.base, { es: 'Subtotal', en: 'Subtotal', pts: Math.round(sub * 10) / 10, max: -1 }, ...sp.mult.map(m => ({ es: m.es, en: m.en, pts: 0, k: Math.round(m.k * 100) / 100 }))];
    const sj = settle(runSt, d.dest, accepted, r, contractN(activeContract, mods.required)); setRunSt(sj.state); setJobRows(sj.rows); setAccepted([]);
    setReward(gain + sj.scrap); setMeta({ ...meta, scrap: Math.max(EMERGENCY_FUND, meta.scrap + gain + sj.scrap), runs: meta.runs + 1, best: Math.max(meta.best, r.score), kills: meta.kills + (r.kills ?? 0) });
    track({ t: 'mission', dest: d.dest, returned: r.returned, grade: r.grade, samples: r.samples, kills: r.kills ?? 0, scrap: gain } as Ev);
    setResult({ ...r, scrapWhy }); setPhase('end');
  };

  if (phase === 'mars') return <><Suspense fallback={<div className="w-root adv-center">…</div>}>
    {(dailyRun?.dest ?? dest) === 'jupiter'
      ? <JupiterOrbit tool={dailyRun?.tool ?? tool} es={es} mods={dailyRun?.mods ?? mods} perks={dailyRun?.perks ?? perks} contract={dailyRun?.contract ?? activeContract} tier={dailyRun ? 0 : tierOf(meta, 'orbiter')} onDone={done} onExit={onExit} />
      : (dailyRun?.dest ?? dest) === 'miller'
      ? <MillerOcean tool={dailyRun?.tool ?? tool} es={es} mods={dailyRun?.mods ?? mods} perks={dailyRun?.perks ?? perks} contract={dailyRun?.contract ?? activeContract} tier={dailyRun ? 0 : tierOf(meta, 'sub')} onDone={done} onExit={onExit} />
      : <MarsWorld cfg={dailyRun?.cfg ?? cfg} es={es} mods={dailyRun?.mods ?? mods} perks={dailyRun?.perks ?? perks} contract={dailyRun?.contract ?? activeContract} tier={dailyRun ? 0 : tierOf(meta, 'rover')} onDone={done} onExit={onExit} />}
  </Suspense><BossBar es={es} />{!daily && <RunChips es={es} run={runSt} jobs={accepted} />}<Money n={meta.scrap} es={es} />{unlock && <div className="adv-unlock" role="status">{unlock}</div>}<HurtFlash /></>;

  const lvl = LEVEL_INFO[level];
  return <div className="w-root adv-root"
    onPointerDown={e => { if ((e.target as HTMLElement).tagName === 'CANVAS') (e.currentTarget as HTMLElement).dataset.drag = `${e.clientX},${e.clientY}`; }}
    onPointerMove={e => { const el = e.currentTarget as HTMLElement, dr = el.dataset.drag; if (!dr) return; const [x, y] = dr.split(',').map(Number); inp.current.camYaw -= (e.clientX - x!) * 0.006; inp.current.camPitch = Math.max(0.1, Math.min(1.1, inp.current.camPitch + (e.clientY - y!) * 0.004)); el.dataset.drag = `${e.clientX},${e.clientY}`; }}
    onPointerUp={e => { delete (e.currentTarget as HTMLElement).dataset.drag; }}>
    <Canvas dpr={[1, 1.6]} camera={{ fov: 62, near: 0.1, far: 600, position: [0, 8, -10] }}>
      <Suspense fallback={null}><EarthScene world={world} phase={phase} quest={quest} input={inp} poll={poll} hud={hud} lift={lift} onAct={onAct} roverTier={tierOf(meta, 'rover')} rocketTier={tierOf(meta, 'rocket')} laser={perksFor('rover', meta).weapon > 0} count={count} onEarn={onEarn} onPlay={onPlay} raceHud={raceHud} /></Suspense>
    </Canvas>
    <button className="w-btn w-exit" onClick={onExit} aria-label={L.quit}><X size={20} /></button>
    <Money n={meta.scrap} es={es} />
    {unlock && <div className="adv-unlock" role="status">{unlock}</div>}
    {phase === 'earth' && !tut && <RunChips es={es} run={runSt} jobs={[]} />}
    {showSci && <SciDayPanel es={es} sci={sciDay} review={review} due={dueN} onQuiz={() => openQuiz('day')} onReview={() => openQuiz('review')} onClose={() => setShowSci(false)} />}
    {quiz && <Quiz es={es} ids={quiz.ids} reward={quiz.kind === 'day' ? SCI_DAY_REWARD : SCI_QUIZ_REWARD} title={quiz.title} onDone={finishQuiz} onClose={() => setQuiz(null)} />}
    {showDaily && <DailyPanel es={es} rec={dailyRec} onPlay={startDaily} onClose={() => setShowDaily(false)} />}
    {beats[0] && !tut && (phase === 'earth' || phase === 'end') && !showProg && !showDaily && <StoryBubble key={beats[0]} es={es} id={beats[0]} onClose={() => setBeats(b => b.slice(1))} onCard={() => { setBeats(b => b.slice(1)); window.dispatchEvent(new Event('frontier-open-science')); }} />}
    {showProg && <ProgressPanel es={es} runs={meta.runs} best={meta.best} scrap={meta.scrap} onClose={() => setShowProg(false)} />}

    {phase === 'earth' && !showProg && <>
      <div className="adv-quest"><span className="adv-step">{quest + 1}/2</span><b>{quest === 0 ? L.q0 : L.q1}</b>
        <button className="lvl-btn" style={{ background: lvl.color }} onClick={() => setPhase('intro')} title={es ? 'Cambiar dificultad' : 'Change difficulty'}><Star size={14} fill="currentColor" /> {es ? lvl.es : lvl.en}</button>
        <button className="lvl-btn help" onClick={() => setShowSci(true)} aria-label={es ? 'Ciencia del día' : 'Science of the day'} title={es ? 'Ciencia del día' : 'Science of the day'}>💡{dueN > 0 ? <sup>{dueN}</sup> : null}</button>
        <button className="lvl-btn help" onClick={() => setShowDaily(true)} aria-label={es ? 'Reto del día' : 'Daily challenge'} title={es ? 'Reto del día' : 'Daily challenge'}>📅</button>
        <button className="lvl-btn help" onClick={() => setShowProg(true)} aria-label={es ? 'Mi progreso y logros' : 'My progress and achievements'} title={es ? 'Progreso y logros' : 'Progress and achievements'}>🏆</button>
        <button className="lvl-btn help" onClick={() => setTut(true)} aria-label={es ? 'Ayuda' : 'Help'}><HelpCircle size={18} /></button></div>
      <div className="adv-arrow" aria-hidden="true"><i style={{ transform: `rotate(${snap.heading - snap.bearing + Math.PI}rad)` }} /><span>{Math.round(snap.dist)} m</span></div>
      {snap.near && <button className="adv-prompt" onClick={() => onAct(snap.near!)}><span className="w-key">E</span><span className="w-key pad">A</span>{snap.near === 'hangar' ? L.enterHangar : L.launchNow}</button>}
      <div className="adv-play" aria-label={es ? 'Juegos de la Tierra' : 'Earth games'}><span>⚽ {es ? 'Goles' : 'Goals'}: {play.goals}</span><span>⭐ {es ? 'Monedas' : 'Coins'}: {play.left}/{COIN_POS.length}</span><span>🏁 {raceSnap.run ? `${raceSnap.t.toFixed(1)}s · ${raceSnap.next}/${RACE.cones.length}` : (es ? 'Conos: cruza la meta' : 'Cones: enter the gate')}</span><span>🛹 {es ? 'Rampa: ve rápido' : 'Ramp: go fast'}</span></div>
      {play.toast && <div className="adv-toast" role="status">{play.toast}</div>}
      <div className="w-help adv-help"><span>{L.help}</span><span>{L.helpPad}</span><span>{L.helpTouch}</span></div>
      <div className="w-touch"><Joystick input={inp} /><div className="w-btns"><button className="w-btn big" onPointerDown={() => { inp.current.collectPulse = true; }}>E</button></div></div>
    </>}

    {phase === 'intro' && !tut && <LevelPicker es={es} level={level} onPick={pickLevel} onHelp={() => setTut(true)} />}
    {tut && <Tutorial es={es} onClose={() => { markTutorialDone(); setTut(false); }} />}
    {phase === 'hangar' && <HangarPanel es={es} level={level} design={design} setDesign={setDesign} bonus={bonus} contracts={contracts} contract={activeContract.id} setContract={setContractId} scrap={meta.scrap} onWorkshop={() => openWorkshop('hangar')} boss={bossNext} onClose={() => setPhase('earth')} onLevel={() => setPhase('intro')} onNext={() => { if (level === 'easy') { setQuest(1); setPhase('earth'); } else setPhase('tests'); }} />}
    {phase === 'tests' && <Tests es={es} level={level} design={design} bonus={bonus} onBack={() => setPhase('hangar')} onGo={() => { setQuest(1); setPhase('earth'); }} />}

    {phase === 'workshop' && <Workshop es={es} meta={meta} setMeta={setMeta} initial={wsBack.current === 'hangar' ? ship : 'rover'} onClose={() => setPhase(wsBack.current)} />}
    {phase === 'draft' && <Draft es={es} cards={cards} onPick={c => { setCard(c); setOffers(offersFor(dest, runSt.rep[dest])); setAccepted([]); setPhase('board'); }} />}
    {phase === 'board' && <Board es={es} dest={dest} offers={offers} rep={runSt.rep[dest]} accepted={accepted.map(j => j.id)} onToggle={id => setAccepted(a => a.some(j => j.id === id) ? a.filter(j => j.id !== id) : a.length < slotsFor(runSt.rep[dest]) ? [...a, jobById(id)!] : a)} onGo={() => setPhase('mars')} />}
    {phase === 'launch' && count < 4 && <div className="adv-count" aria-live="assertive">{L.count[count]}</div>}
    {phase === 'travel' && <div className="adv-travel"><div className="adv-stars" /><div className={`adv-dest ${dest}`} aria-hidden="true" /><Rocket className="adv-ship" size={64} aria-hidden="true" /><h2>{L.travel}: {L[dest]}</h2><p>{L.travelD}</p><div className="adv-progress"><span /></div>
      {!pending && <button className="button button-secondary" onClick={() => setPhase('draft')}>{L.skip}</button>}
      {tripNote && !pending && <div className="trip-note" role="status">{tripNote}</div>}
      {pending && <TripCard es={es} ev={events[evIdx]!} step={evIdx + 1} total={events.length} onPick={o => { const { out, won } = resolveOption(o); setPicked(p => [...p, out]); if (out.scrap) setMeta({ ...meta, scrap: Math.max(0, meta.scrap + out.scrap) }); if (out.mod) setRunSt(s => grant(s, out.mod!)); setTripNote(`${won === null ? '' : won ? (es ? '🎲 ¡Salió bien! ' : '🎲 It worked! ') : (es ? '🎲 Salió mal… ' : '🎲 It backfired… ')}${describeOut(out, es)}`); setEvIdx(i => i + 1); }} />}</div>}
    {phase === 'end' && result && <Reward es={es} result={result} scrap={reward} spent={paid} total={meta.scrap} level={es ? lvl.es : lvl.en} onWorkshop={() => { reset(); openWorkshop('earth'); }} onAgain={reset} jobs={daily ? [] : jobRows} extra={<>
      <LogBook es={es} result={result} dest={daily ? daily.dest : dest} run={runSt} learnId={worldCard(daily ? daily.dest : dest, meta.runs)} />
      {!quizDone && <button className="button button-secondary" onClick={() => openQuiz('mission', [worldCard(daily ? daily.dest : dest, meta.runs)])}>🧠 {es ? `Repaso rápido: 2 preguntas (+${SCI_QUIZ_REWARD} 🪙 c/u)` : `Quick review: 2 questions (+${SCI_QUIZ_REWARD} 🪙 each)`}</button>}
    </>} />}
  </div>;
}
