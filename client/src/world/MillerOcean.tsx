import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { X, Heart } from 'lucide-react';
import { newRover, stepRover, HALF, type MarsResult, type MarsWorldData, type RoverState, type WorldConfig } from './marsWorld';
import { Joystick } from './MarsWorld';
import { useWorldInput, type WorldInput } from './worldInput';
import { rng } from '../three/noise';
import './world.css';
import './adventure.css';

export type MillerTool = 'camera' | 'spectrometer' | 'radar';
type Life = 'plankton' | 'jelly' | 'coral' | 'fish';
interface Site { id: number; kind: Life; x: number; z: number }
const COLOR: Record<Life, string> = { plankton: '#5ee6a8', jelly: '#ff8fc7', coral: '#ff9a5c', fish: '#7fdcff' };
const NAME = { es: { plankton: 'Plancton brillante', jelly: 'Medusa', coral: 'Coral', fish: 'Pez' }, en: { plankton: 'Glowing plankton', jelly: 'Jellyfish', coral: 'Coral', fish: 'Fish' } };
export const NEED = 3;
const WORLD: MarsWorldData = { seed: 5, amp: 0, craters: [], rocks: [], samples: [] };
export const waveH = (x: number, z: number, t: number) => Math.sin(x * 0.12 + t * 0.9) * 0.5 + Math.sin(z * 0.09 + t * 0.7) * 0.5 + Math.sin((x + z) * 0.05 + t * 0.4) * 0.8;
export const seeRange = (tool: MillerTool) => (tool === 'radar' ? 70 : tool === 'camera' ? 48 : 30);

export function makeSites(seed: number): Site[] {
  const r = rng(seed), kinds: Life[] = ['plankton', 'jelly', 'coral', 'fish', 'jelly', 'plankton'];
  return kinds.map((kind, id) => { const a = (id / kinds.length) * Math.PI * 2 + r() * 0.7, d = 28 + r() * 80; return { id, kind, x: Math.cos(a) * d, z: Math.sin(a) * d }; });
}
export function millerScore(tool: MillerTool, found: number, health: number, seconds: number): MarsResult {
  const raw = Math.min(70, found * 24) + health * 0.15 + (tool === 'spectrometer' ? 8 : 0) + Math.max(0, 7 - seconds / 60);
  const score = Math.max(0, Math.min(100, Math.round(found >= NEED ? raw : raw * 0.6)));
  return { score, science: found * 10, returned: found >= NEED, grade: score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D', samples: [] };
}

interface Wave { t: number; x: number; z: number; active: boolean; hit: boolean }
interface Game { boat: RoverState; found: Set<number>; kinds: Life[]; time: number; waves: Wave[]; nextWave: number; msg: string; msgT: number; ended: boolean; health: number; shake: number; result: MarsResult | null }
interface Hud { health: number; found: Life[]; reach: Life | null; msg: string; heading: number; x: number; z: number; visible: { x: number; z: number; kind: Life }[] }
const CFG: WorldConfig = { seed: 1, camera: false, spectrometer: false, radar: false, battery: 1e9, solar: 0, health: 100 };

function Creature({ kind }: { kind: Life }) {
  const c = COLOR[kind];
  const mat = <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} flatShading />;
  if (kind === 'plankton') return <group>{[[0, 0, 0], [0.8, 0.3, 0.4], [-0.7, 0.2, -0.5], [0.2, 0.7, -0.8], [-0.4, 0.5, 0.8]].map((p, i) => <mesh key={i} position={p as [number, number, number]}><icosahedronGeometry args={[0.35, 0]} />{mat}</mesh>)}</group>;
  if (kind === 'jelly') return <group><mesh scale={[1, 0.7, 1]}><sphereGeometry args={[0.9, 7, 5, 0, Math.PI * 2, 0, Math.PI / 1.6]} />{mat}</mesh>{[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * 1.57) * 0.45, -0.7, Math.sin(i * 1.57) * 0.45]}><coneGeometry args={[0.1, 1.2, 4]} />{mat}</mesh>)}</group>;
  if (kind === 'coral') return <group>{[0, 1, 2].map(i => <mesh key={i} position={[(i - 1) * 0.6, 0.4 + i * 0.1, 0]} rotation={[0, 0, (i - 1) * 0.3]}><coneGeometry args={[0.35, 1.5 + i * 0.3, 5]} />{mat}</mesh>)}</group>;
  return <group><mesh scale={[1.6, 0.7, 0.5]}><octahedronGeometry args={[0.8, 0]} />{mat}</mesh><mesh position={[-1.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.5, 0.8, 4]} />{mat}</mesh></group>;
}

function Scene({ cfg, es, sites, g, hud, input, poll, onFinish }: { cfg: { tool: MillerTool }; es: boolean; sites: Site[]; g: React.MutableRefObject<Game>; hud: React.MutableRefObject<Hud>; input: React.MutableRefObject<WorldInput>; poll: (dt: number) => void; onFinish: () => void }) {
  const { camera, scene } = useThree();
  const water = useRef<THREE.Mesh>(null), boat = useRef<THREE.Group>(null);
  const siteRefs = useRef<(THREE.Group | null)[]>([]), waveRefs = useRef<(THREE.Group | null)[]>([]);
  const cam = useRef(new THREE.Vector3(0, 8, 14));
  const rand = useMemo(() => rng(99), []);
  const geo = useMemo(() => { const gg = new THREE.PlaneGeometry(HALF * 2 + 40, HALF * 2 + 40, 84, 84); gg.rotateX(-Math.PI / 2); gg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 3), 3)); return gg; }, []);
  const tmp = useMemo(() => new THREE.Vector3(), []), deep = useMemo(() => new THREE.Color('#1f7fc4'), []), light = useMemo(() => new THREE.Color('#7fd8f0'), []), cc = useMemo(() => new THREE.Color(), []);
  useEffect(() => { scene.background = new THREE.Color('#a8dcff'); scene.fog = new THREE.Fog('#cfeeff', 60, 280); return () => { scene.fog = null; }; }, [scene]);
  const say = (m: string) => { g.current.msg = m; g.current.msgT = 3; };
  const range = seeRange(cfg.tool);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05), s = g.current, i = input.current, t = clock.elapsedTime;
    poll(dt);
    const p = geo.attributes.position as THREE.BufferAttribute, col = geo.attributes.color as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const h = waveH(p.getX(k), p.getZ(k), t); p.setY(k, h); cc.copy(deep).lerp(light, (h + 1.4) / 2.8); col.setXYZ(k, cc.r, cc.g, cc.b); }
    p.needsUpdate = true; col.needsUpdate = true;
    if (s.ended) return;
    s.time += dt;
    let b = stepRover(WORLD, CFG, s.boat, { throttle: i.throttle, steer: i.steer, boost: i.boost }, dt);
    b = { ...b, energy: 1e9 };
    s.shake = Math.max(0, s.shake - dt);

    s.nextWave -= dt;
    if (s.nextWave <= 0) {
      const slot = s.waves.find(w => !w.active);
      if (slot) { const a = rand() * 6.28, d = rand() * 12; Object.assign(slot, { active: true, hit: false, t: 3.4, x: b.x + Math.sin(b.heading) * b.speed * 2 + Math.cos(a) * d, z: b.z + Math.cos(b.heading) * b.speed * 2 + Math.sin(a) * d }); say(es ? '¡Ola gigante! Sal del círculo rojo' : 'Giant wave! Leave the red circle'); }
      s.nextWave = 10 + rand() * 8;
    }
    s.waves.forEach((w, idx) => {
      const n = waveRefs.current[idx]; if (!n) return;
      if (!w.active) { n.visible = false; return; }
      w.t -= dt; n.visible = true; n.position.set(w.x, waveH(w.x, w.z, t), w.z);
      const swell = n.children[0] as THREE.Mesh, ring = n.children[1] as THREE.Mesh;
      swell.scale.set(1, w.t > 0 ? 0.2 + (1 - w.t / 3.4) * 2.8 : Math.max(0.01, 3 + w.t * 3), 1);
      swell.position.y = (swell.scale.y * 3) / 2 - 1;
      (ring.material as THREE.MeshBasicMaterial).opacity = w.t > 0 ? 0.55 : Math.max(0, 0.7 + w.t * 1.4);
      if (w.t <= 0 && !w.hit) { w.hit = true; if (Math.hypot(b.x - w.x, b.z - w.z) < 6) { s.health = Math.max(0, s.health - 20); s.shake = 0.8; b = { ...b, speed: b.speed * 0.3 }; say(es ? '¡Te golpeó la ola! −20 de salud' : 'The wave hit you! −20 health'); } else say(es ? '¡La esquivaste!' : 'Dodged it!'); }
      if (w.t < -0.8) w.active = false;
    });
    s.boat = b;

    const vis = sites.filter(x => !s.found.has(x.id) && Math.hypot(x.x - b.x, x.z - b.z) <= range);
    const ids = new Set(vis.map(v => v.id));
    sites.forEach((x, idx) => { const n = siteRefs.current[idx]; if (!n) return; n.visible = ids.has(x.id); n.position.set(x.x, waveH(x.x, x.z, t), x.z); n.children[0]!.position.y = 1.2 + Math.sin(t * 2 + idx) * 0.3; n.children[0]!.rotation.y = t * 0.8; });
    let reach: Site | null = null, bd = 4.5;
    for (const x of sites) { if (s.found.has(x.id)) continue; const d = Math.hypot(x.x - b.x, x.z - b.z); if (d < bd) { reach = x; bd = d; } }
    if (i.collectPulse) {
      i.collectPulse = false;
      if (reach) { s.found.add(reach.id); s.kinds.push(reach.kind); say(es ? `¡Vida encontrada: ${NAME.es[reach.kind]}!` : `Life found: ${NAME.en[reach.kind]}!`); if (s.kinds.length >= NEED) { s.ended = true; onFinish(); } }
      else say(es ? 'Acércate a una señal brillante' : 'Get close to a glowing signal');
    }
    if (s.health <= 0) { s.ended = true; say(es ? 'El vehículo quedó dañado' : 'The vehicle is wrecked'); onFinish(); }
    s.msgT = Math.max(0, s.msgT - dt);

    if (boat.current) {
      const e = 1, hx = waveH(b.x + e, b.z, t) - waveH(b.x - e, b.z, t), hz = waveH(b.x, b.z + e, t) - waveH(b.x, b.z - e, t);
      boat.current.position.set(b.x, waveH(b.x, b.z, t) + 0.15, b.z);
      boat.current.rotation.set(Math.atan2(hz, 2 * e) * 0.8, b.heading, -Math.atan2(hx, 2 * e) * 0.8, 'YXZ');
    }
    const yaw = b.heading + i.camYaw + Math.PI, dist = 12, pitch = i.camPitch;
    tmp.set(b.x + Math.sin(yaw) * Math.cos(pitch) * dist, 2 + Math.sin(pitch) * dist + waveH(b.x, b.z, t), b.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.current.lerp(tmp, Math.min(1, dt * 5)); camera.position.copy(cam.current);
    if (s.shake > 0) camera.position.x += (Math.random() - 0.5) * s.shake * 0.5;
    camera.lookAt(b.x, 1.5, b.z);
    hud.current = { health: s.health / 100, found: s.kinds.slice(), reach: reach?.kind ?? null, msg: s.msgT > 0 ? s.msg : '', heading: b.heading, x: b.x, z: b.z, visible: vis.map(v => ({ x: v.x, z: v.z, kind: v.kind })) };
  });

  return <>
    <hemisphereLight args={['#ffffff', '#6fb6e0', 1.2]} /><directionalLight position={[60, 90, 30]} intensity={1.7} color="#fff6dd" />
    <mesh ref={water} geometry={geo}><meshStandardMaterial vertexColors flatShading roughness={0.55} /></mesh>
    <group ref={boat}>
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[2, 0.8, 4.2]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>
      <mesh position={[0, 0.55, 2.4]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[1, 1.2, 4]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>
      <mesh position={[0, 1.1, -0.2]}><boxGeometry args={[1.6, 0.35, 1.8]} /><meshStandardMaterial color="#ff7a59" flatShading /></mesh>
      <mesh position={[0, 2.2, -0.3]}><boxGeometry args={[0.1, 2, 1.4]} /><meshStandardMaterial color="#ffc857" flatShading /></mesh>
      <mesh position={[0, 1.7, 0.9]}><cylinderGeometry args={[0.05, 0.05, 1.2, 5]} /><meshStandardMaterial color="#cdb9e0" /></mesh>
      {cfg.tool === 'radar' && <mesh position={[0, 3.3, -0.3]} rotation={[0.4, 0, 0]}><cylinderGeometry args={[0.6, 0.1, 0.3, 8]} /><meshStandardMaterial color="#7fdcff" flatShading /></mesh>}
    </group>
    {sites.map((x, idx) => <group key={x.id} ref={n => { siteRefs.current[idx] = n; }} visible={false}>
      <group><Creature kind={x.kind} /></group>
      <mesh position={[0, 6, 0]}><cylinderGeometry args={[0.12, 0.12, 12, 5]} /><meshBasicMaterial color={COLOR[x.kind]} transparent opacity={0.4} fog={false} /></mesh>
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3.6, 4.5, 16]} /><meshBasicMaterial color={COLOR[x.kind]} /></mesh>
    </group>)}
    {g.current.waves.map((_, idx) => <group key={idx} ref={n => { waveRefs.current[idx] = n; }} visible={false}>
      <mesh><cylinderGeometry args={[5, 5.4, 3, 10]} /><meshStandardMaterial color="#e8f8ff" flatShading /></mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[5.6, 6.4, 20]} /><meshBasicMaterial color="#ff4d4d" transparent opacity={0.5} side={THREE.DoubleSide} /></mesh>
    </group>)}
  </>;
}

function Minimap({ hud }: { hud: React.MutableRefObject<Hud> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current, ctx = c?.getContext('2d'); if (!c || !ctx) { raf = requestAnimationFrame(draw); return; }
      const W = c.width, R = W / 2, h = hud.current, sc = R / 80;
      ctx.clearRect(0, 0, W, W); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 3, 0, 7); ctx.clip();
      ctx.fillStyle = '#2f8fd0'; ctx.fillRect(0, 0, W, W); ctx.translate(R, R); ctx.rotate(h.heading + Math.PI);
      for (const v of h.visible) { ctx.fillStyle = COLOR[v.kind]; ctx.beginPath(); ctx.arc(-(v.x - h.x) * sc, -(v.z - h.z) * sc, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(R, R - 9); ctx.lineTo(R + 6, R + 7); ctx.lineTo(R - 6, R + 7); ctx.fill();
      ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(R, R, R - 2, 0, 7); ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [hud]);
  return <canvas ref={ref} className="w-minimap" width={170} height={170} aria-label="minimap" />;
}

export default function MillerOcean({ tool, es, onDone, onExit }: { tool: MillerTool; es: boolean; onDone: (r: MarsResult) => void; onExit: () => void }) {
  const { inp, poll } = useWorldInput();
  const sites = useMemo(() => makeSites(4242), []);
  const g = useRef<Game>({ boat: { ...newRover(CFG), x: 0, z: 0, heading: 0 }, found: new Set(), kinds: [], time: 0, waves: Array.from({ length: 3 }, () => ({ t: 0, x: 0, z: 0, active: false, hit: false })), nextWave: 8, msg: '', msgT: 0, ended: false, health: 100, shake: 0, result: null });
  const hud = useRef<Hud>({ health: 1, found: [], reach: null, msg: '', heading: 0, x: 0, z: 0, visible: [] });
  const [snap, setSnap] = useState<Hud>(hud.current);
  const [result, setResult] = useState<MarsResult | null>(null);
  const [help, setHelp] = useState(true);
  useEffect(() => { const t = setInterval(() => setSnap({ ...hud.current }), 100); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setTimeout(() => setHelp(false), 9000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__miller = { g: g.current, sites }; }, [sites]);
  const L = es
    ? { goal: `Encuentra ${NEED} señales de vida`, scan: 'Investigar', help: 'Navega con WASD o flechas · Shift acelera · E investiga', pad: 'Stick para navegar · A investiga', touch: 'Joystick para navegar · botón E investiga', done: '¡Hay vida en Miller!', fail: 'La misión terminó', again: 'Terminar', quit: 'Salir', health: 'Casco' }
    : { goal: `Find ${NEED} signs of life`, scan: 'Investigate', help: 'Sail with WASD or arrows · Shift to speed up · E investigates', pad: 'Stick to sail · A investigates', touch: 'Joystick to sail · E button investigates', done: 'There is life on Miller!', fail: 'Mission over', again: 'Finish', quit: 'Exit', health: 'Hull' };
  const finish = () => setResult(millerScore(tool, g.current.kinds.length, g.current.health, g.current.time));
  return <div className="w-root adv-root" style={{ background: '#a8dcff' }}>
    <Canvas dpr={[1, 1.5]} camera={{ fov: 62, near: 0.1, far: 500, position: [0, 8, 14] }}>
      <Scene cfg={{ tool }} es={es} sites={sites} g={g} hud={hud} input={inp} poll={poll} onFinish={finish} />
    </Canvas>
    <button className="w-btn w-exit" onClick={onExit} aria-label={L.quit}><X size={20} /></button>
    <div className="adv-quest"><span className="adv-step">{snap.found.length}/{NEED}</span><b>{L.goal}</b>
      <Heart size={18} aria-label={L.health} style={{ marginLeft: "auto" }} /><span className="m-hp"><i style={{ width: `${snap.health * 100}%`, background: snap.health < 0.4 ? '#ff5d73' : '#5ee6a8' }} /></span></div>
    <Minimap hud={hud} />
    {snap.msg && <div className="w-toast" role="status">{snap.msg}</div>}
    {snap.reach && <button className="adv-prompt" onClick={() => { inp.current.collectPulse = true; }}><span className="w-key">E</span><span className="w-key pad">A</span>{L.scan}: {NAME[es ? 'es' : 'en'][snap.reach]}</button>}
    {help && <div className="w-help adv-help" onClick={() => setHelp(false)}><span>{L.help}</span><span>{L.pad}</span><span>{L.touch}</span></div>}
    <div className="w-touch"><Joystick input={inp} /><div className="w-btns"><button className="w-btn big" onPointerDown={() => { inp.current.collectPulse = true; }}>E</button></div></div>
    {result && <div className="adv-modal"><div className="adv-card center"><h2>{result.returned ? L.done : L.fail}</h2><div className="w-grade">{result.grade}</div><p><b>{result.score}</b>/100</p><button className="button button-primary" autoFocus onClick={() => onDone(result)}>{L.again}</button></div></div>}
  </div>;
}
