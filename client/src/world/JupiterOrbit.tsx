import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { X } from 'lucide-react';
import { jupiterGeometry, SPOT } from '../three/lowpoly';
import { useWorldInput, type WorldInput } from './worldInput';
import { Joystick } from './MarsWorld';
import type { MarsResult } from './marsWorld';
import { modsFor, type Mods } from './levels';
import { Boom, type BoomState } from './fx';
import './world.css';
import './adventure.css';

export type JupiterTool = 'camera' | 'spectrometer' | 'radar';
interface Zone { id: string; lat: number; lon: number; es: string; en: string; hint: string }
export const ZONES: Zone[] = [
  { id: 'spot', lat: SPOT.lat, lon: SPOT.lon, es: 'Gran Mancha Roja', en: 'Great Red Spot', hint: '#c8402e' },
  { id: 'north', lat: 0.95, lon: -1.6, es: 'Tormentas del norte', en: 'Northern storms', hint: '#7fdcff' },
  { id: 'belt', lat: 0.25, lon: 3.1, es: 'Banda de nubes', en: 'Cloud belt', hint: '#ffc857' },
  { id: 'south', lat: -0.95, lon: -0.2, es: 'Remolinos del sur', en: 'Southern swirls', hint: '#ff8fc7' },
  { id: 'aurora', lat: 1.2, lon: 1.2, es: 'Aurora polar', en: 'Polar aurora', hint: '#b39ddb' },
  { id: 'storm', lat: -0.3, lon: 2.2, es: 'Tormenta ecuatorial', en: 'Equatorial storm', hint: '#5ee6a8' },
];
export const R = 20, ALT = 6.5;
export const posAt = (lat: number, lon: number, r = R + ALT) => new THREE.Vector3(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
/** Angular distance on the sphere, in radians. */
export function angDist(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  return Math.acos(Math.max(-1, Math.min(1, Math.sin(a.lat) * Math.sin(b.lat) + Math.cos(a.lat) * Math.cos(b.lat) * Math.cos(a.lon - b.lon))));
}
export const scanRange = (tool: JupiterTool) => (tool === 'camera' ? 0.42 : 0.3);
export function jupiterScore(tool: JupiterTool, scanned: number, need: number, health: number, seconds: number): MarsResult {
  const base = (scanned / need) * 80 + (scanned >= need ? 8 : 0) + health * 0.06 + Math.max(0, 10 - seconds / 20) + (tool === 'spectrometer' ? 6 : 0);
  const score = Math.max(0, Math.min(100, Math.round(base)));
  return { score, science: scanned * 10, returned: scanned >= need, grade: score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D', samples: [] };
}

interface Game { lat: number; lon: number; heading: number; scanned: Set<string>; time: number; msg: string; msgT: number; ended: boolean; health: number; fuel: number; dying?: number }
interface Hud { health: number; fuel: number; left: number; near: string | null; scanned: string[]; bearing: number; dist: number; msg: string; lat: number; lon: number; guide: string | null }

function Scene({ tool, mods, es, g, hud, input, poll, onFinish }: { tool: JupiterTool; mods: Mods; es: boolean; g: React.MutableRefObject<Game>; hud: React.MutableRefObject<Hud>; input: React.MutableRefObject<WorldInput>; poll: (dt: number) => void; onFinish: () => void }) {
  const { camera, scene } = useThree();
  const geo = useMemo(() => jupiterGeometry(R), []);
  const boom = useRef<BoomState>(null);
  const ship = useRef<THREE.Group>(null), moon = useRef<THREE.Mesh>(null), rings = useRef<(THREE.Mesh | null)[]>([]);
  const cam = useRef(new THREE.Vector3(0, 10, 40));
  const n = useMemo(() => new THREE.Vector3(), []), north = useMemo(() => new THREE.Vector3(), []), east = useMemo(() => new THREE.Vector3(), []), tmp = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { scene.background = new THREE.Color('#1d1530'); }, [scene]);
  const range = scanRange(tool);
  const say = (m: string) => { g.current.msg = m; g.current.msgT = 3; };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05), s = g.current, i = input.current;
    poll(dt);
    if (s.ended) return;
    if (s.dying !== undefined) { s.dying -= dt; if (s.dying <= 0) { s.ended = true; onFinish(); } return; }
    s.time += dt;
    // fast levels: boosting burns limited fuel; the equator is full of radiation
    const boosting = i.boost && (!mods.fuel || s.fuel > 0);
    if (mods.fuel) s.fuel = Math.max(0, Math.min(100, s.fuel + (boosting ? -22 : 7) * dt));
    const sp = 0.42 * (boosting ? 1.8 : 1);
    if (Math.abs(s.lat) < 0.32 && mods.radiation > 0) {
      s.health = Math.max(0, s.health - mods.radiation * 3.2 * dt);
      if (Math.floor(s.time * 2) % 5 === 0) say(es ? '¡Radiación! Sal de la franja del ecuador' : 'Radiation! Leave the equator band');
    }
    if (s.health <= 0) { say(es ? 'La nave explotó' : 'The ship exploded'); s.dying = 2.2; const q = posAt(s.lat, s.lon); boom.current = { t: 0, x: q.x, y: q.y, z: q.z, big: 1.5 }; if (ship.current) ship.current.visible = false; return; }
    if (mods.timeLimit && s.time >= mods.timeLimit) { s.ended = true; say(es ? 'Se acabó el tiempo' : 'Time is up'); onFinish(); return; }
    s.lat = Math.max(-1.3, Math.min(1.3, s.lat + i.throttle * sp * dt));
    s.lon += (i.steer * sp * dt) / Math.max(0.4, Math.cos(s.lat));
    if (i.throttle || i.steer) s.heading = Math.atan2(i.steer, i.throttle);
    const p = posAt(s.lat, s.lon);
    n.copy(p).normalize();
    north.set(-Math.sin(s.lat) * Math.sin(s.lon), Math.cos(s.lat), -Math.sin(s.lat) * Math.cos(s.lon)).normalize();
    east.set(Math.cos(s.lon), 0, -Math.sin(s.lon));
    if (ship.current) {
      ship.current.position.copy(p);
      const fwd = tmp.copy(north).multiplyScalar(Math.cos(s.heading)).addScaledVector(east, Math.sin(s.heading));
      ship.current.up.copy(n); ship.current.lookAt(p.clone().add(fwd));
    }
    const want = p.clone().addScaledVector(n, 15).addScaledVector(north, -17);
    cam.current.lerp(want, Math.min(1, dt * 4)); camera.position.copy(cam.current); camera.up.copy(n);
    camera.lookAt(p.clone().addScaledVector(north, 5));
    if (moon.current) { const t = clock.elapsedTime * 0.25; moon.current.position.set(Math.cos(t) * 40, 6, Math.sin(t) * 40); }

    let near: Zone | null = null, bd = range, guide: Zone | null = null, gd = 9;
    for (const z of ZONES) {
      if (s.scanned.has(z.id)) continue;
      const d = angDist(s, z);
      if (d < bd) { near = z; bd = d; }
      if (d < gd) { guide = z; gd = d; }
    }
    ZONES.forEach((z, idx) => { const m = rings.current[idx]; if (!m) return; m.visible = !s.scanned.has(z.id); m.scale.setScalar(1 + 0.12 * Math.sin(clock.elapsedTime * 4 + idx)); });
    if (i.collectPulse) {
      i.collectPulse = false;
      if (near) {
        s.scanned.add(near.id); say(es ? `Escaneado: ${near.es}` : `Scanned: ${near.en}`);
        if (s.scanned.size >= mods.required) { s.ended = true; onFinish(); }
      } else say(es ? 'Acércate a un círculo brillante' : 'Get close to a glowing circle');
    }
    s.msgT = Math.max(0, s.msgT - dt);
    const nxt = guide ?? ZONES.find(z => !s.scanned.has(z.id)) ?? null;
    let bearing = 0, dist = 0;
    if (nxt) { const dl = Math.sin(nxt.lon - s.lon) * Math.cos(nxt.lat), dn = Math.sin(nxt.lat) * Math.cos(s.lat) - Math.cos(nxt.lat) * Math.sin(s.lat) * Math.cos(nxt.lon - s.lon); bearing = Math.atan2(dl, dn); dist = angDist(s, nxt); }
    hud.current = { health: s.health / 100, fuel: s.fuel / 100, left: mods.timeLimit ? Math.max(0, mods.timeLimit - s.time) : 0, near: near && !s.scanned.has(near.id) ? near.id : null, scanned: [...s.scanned], bearing, dist, msg: s.msgT > 0 ? s.msg : '', lat: s.lat, lon: s.lon, guide: tool === 'radar' || guide ? nxt?.id ?? null : null };
  });

  return <>
    <ambientLight intensity={0.7} /><directionalLight position={[80, 40, 60]} intensity={2.2} color="#fff1d6" />
    <Stars radius={200} depth={60} count={2500} factor={5} saturation={0.5} fade speed={0} />
    <mesh geometry={geo}><meshStandardMaterial vertexColors flatShading roughness={1} /></mesh>
    <mesh ref={moon}><icosahedronGeometry args={[2.2, 1]} /><meshStandardMaterial color="#e8c46a" flatShading /></mesh>
    {ZONES.map((z, idx) => { const p = posAt(z.lat, z.lon, R + 0.4); return <mesh key={z.id} ref={m => { rings.current[idx] = m; }} position={p} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize())}>
      <ringGeometry args={[2.6, 3.4, 20]} /><meshBasicMaterial color={z.hint} side={THREE.DoubleSide} /></mesh>; })}
    <Boom boom={boom} gravity={0} />
    <group ref={ship}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.8, 2.4, 6]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>
      <mesh position={[0, 0, -0.6]}><boxGeometry args={[3.6, 0.1, 1]} /><meshStandardMaterial color="#5b6ee1" flatShading /></mesh>
      <mesh position={[0, 0.5, -0.3]}><sphereGeometry args={[0.35, 6, 5]} /><meshStandardMaterial color="#ffc857" flatShading /></mesh>
    </group>
  </>;
}

function MapView({ hud }: { hud: React.MutableRefObject<Hud> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current, ctx = c?.getContext('2d'); if (!c || !ctx) { raf = requestAnimationFrame(draw); return; }
      const W = c.width, H = c.height, h = hud.current;
      const X = (lon: number) => ((((lon + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * W, Y = (lat: number) => (0.5 - lat / Math.PI) * H;
      ctx.fillStyle = '#3a2c52'; ctx.fillRect(0, 0, W, H);
      const bands = ['#f2dfc0', '#d9a066', '#f5e6cc', '#b9703f', '#efd2a0', '#c98a55', '#f2dfc0', '#a8693f'];
      for (const z of ZONES) {
        const done = h.scanned.includes(z.id);
        if (done) { const grd = ctx.createRadialGradient(X(z.lon), Y(z.lat), 2, X(z.lon), Y(z.lat), 38); grd.addColorStop(0, z.hint); grd.addColorStop(1, '#3a2c5200'); ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H); }
      }
      bands.forEach((b, i) => { ctx.fillStyle = b + (h.scanned.length ? '55' : '22'); ctx.fillRect(0, (i / bands.length) * H, W, H / bands.length - 1); });
      for (const z of ZONES) { ctx.beginPath(); ctx.arc(X(z.lon), Y(z.lat), 6, 0, 7); ctx.fillStyle = h.scanned.includes(z.id) ? z.hint : '#ffffff55'; ctx.fill(); ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(h.lon), Y(h.lat), 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 3; ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hud]);
  return <canvas ref={ref} className="jup-map" width={260} height={130} aria-label="map" />;
}

export default function JupiterOrbit({ tool, es, mods = modsFor('easy'), onDone, onExit }: { tool: JupiterTool; es: boolean; mods?: Mods; onDone: (r: MarsResult) => void; onExit: () => void }) {
  const { inp, poll } = useWorldInput();
  const g = useRef<Game>({ lat: 0, lon: 0, heading: 0, scanned: new Set(), time: 0, msg: '', msgT: 0, ended: false, health: mods.startHealth ?? 100, fuel: 100 });
  const hud = useRef<Hud>({ health: 1, fuel: 1, left: 0, near: null, scanned: [], bearing: 0, dist: 0, msg: '', lat: 0, lon: 0, guide: null });
  const [snap, setSnap] = useState<Hud>(hud.current);
  const [result, setResult] = useState<MarsResult | null>(null);
  const [help, setHelp] = useState(true);
  useEffect(() => { const t = setInterval(() => setSnap({ ...hud.current }), 100); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setTimeout(() => setHelp(false), 9000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__jup = g.current; }, []);
  const L = es
    ? { goal: `Escanea ${mods.required} zonas de Júpiter`, near: 'Escanear', help: 'Vuela con WASD o flechas · Shift acelera · E escanea', pad: 'Stick para volar · A escanea', touch: 'Joystick para volar · botón E escanea', done: 'Mapa completo', again: 'Terminar', map: 'Mapa de la atmósfera', quit: 'Salir' }
    : { goal: `Scan ${mods.required} zones of Jupiter`, near: 'Scan', help: 'Fly with WASD or arrows · Shift to speed up · E scans', pad: 'Stick to fly · A scans', touch: 'Joystick to fly · E button scans', done: 'Map complete', again: 'Finish', map: 'Atmosphere map', quit: 'Exit' };
  const finish = () => setResult(jupiterScore(tool, g.current.scanned.size, mods.required, g.current.health, g.current.time));
  const zone = ZONES.find(z => z.id === snap.near);
  return <div className="w-root adv-root" style={{ background: '#1d1530' }}>
    <Canvas dpr={[1, 1.6]} camera={{ fov: 60, near: 0.1, far: 600, position: [0, 10, 40] }}>
      <Scene tool={tool} mods={mods} es={es} g={g} hud={hud} input={inp} poll={poll} onFinish={finish} />
    </Canvas>
    <button className="w-btn w-exit" onClick={onExit} aria-label={L.quit}><X size={20} /></button>
    <div className="adv-quest"><span className="adv-step">{snap.scanned.length}/{mods.required}</span><b>{L.goal}</b>
      {mods.timeLimit > 0 && <span className="m-time">{Math.floor(snap.left / 60)}:{String(Math.floor(snap.left % 60)).padStart(2, '0')}</span>}
      {mods.fuel && <span className="m-fuel" title="fuel"><i style={{ width: `${snap.fuel * 100}%` }} /></span>}
      <span className="m-hp" style={{ marginLeft: 'auto' }}><i style={{ width: `${snap.health * 100}%`, background: snap.health < 0.4 ? '#ff5d73' : '#5ee6a8' }} /></span></div>
    {snap.dist > 0.01 && <div className="adv-arrow" aria-hidden="true"><i style={{ transform: `rotate(${snap.bearing}rad)` }} /></div>}
    <div className="jup-mapbox"><b>{L.map}</b><MapView hud={hud} /></div>
    {snap.msg && <div className="w-toast" role="status">{snap.msg}</div>}
    {zone && <button className="adv-prompt" onClick={() => { inp.current.collectPulse = true; }}><span className="w-key">E</span><span className="w-key pad">A</span>{L.near}: {es ? zone.es : zone.en}</button>}
    {help && <div className="w-help adv-help" onClick={() => setHelp(false)}><span>{L.help}</span><span>{L.pad}</span><span>{L.touch}</span></div>}
    <div className="w-touch"><Joystick input={inp} /><div className="w-btns"><button className="w-btn big" onPointerDown={() => { inp.current.collectPulse = true; }}>E</button></div></div>
    {result && <div className="adv-modal"><div className="adv-card center"><h2>{L.done}</h2><div className="w-grade">{result.grade}</div><p><b>{result.score}</b>/100</p><button className="button button-primary" autoFocus onClick={() => onDone(result)}>{L.again}</button></div></div>}
  </div>;
}
