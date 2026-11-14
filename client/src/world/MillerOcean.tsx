import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { X, Heart, BatteryFull, ChevronUp, ChevronDown, Timer } from 'lucide-react';
import { HALF, type MarsResult } from './marsWorld';
import { Joystick } from './MarsWorld';
import { SubGLB } from './models';
import { useWorldInput, type WorldInput } from './worldInput';
import { modsFor, type Mods } from './levels';
import { fbm2, rng } from '../three/noise';
import './world.css';
import './adventure.css';

export type MillerTool = 'camera' | 'spectrometer' | 'radar';
type Life = 'plankton' | 'jelly' | 'coral' | 'fish';
interface Site { id: number; kind: Life; x: number; y: number; z: number }
const COLOR: Record<Life, string> = { plankton: '#5ee6a8', jelly: '#ff8fc7', coral: '#ff9a5c', fish: '#7fdcff' };
const NAME = { es: { plankton: 'Plancton brillante', jelly: 'Medusa', coral: 'Coral', fish: 'Pez' }, en: { plankton: 'Glowing plankton', jelly: 'Jellyfish', coral: 'Coral', fish: 'Fish' } };
const MAXS = 9, DEPTH_MAX = 150;
export const waveH = (x: number, z: number, t: number) => Math.sin(x * 0.12 + t * 0.9) * 0.5 + Math.sin(z * 0.09 + t * 0.7) * 0.5 + Math.sin((x + z) * 0.05 + t * 0.4) * 0.8;
/** y of the sea floor (negative metres) */
export const floorAt = (x: number, z: number) => -(48 + fbm2(21, x * 0.02, z * 0.02, 4) * 70);
export const seeRange = (tool: MillerTool) => (tool === 'radar' ? 70 : tool === 'camera' ? 48 : 30);

/** Creatures live at different depths. Deeper ones need a stronger hull, so the max depth follows the level. */
export function makeSites(seed: number, hullDepth: number): Site[] {
  const r = rng(seed), kinds: Life[] = ['plankton', 'jelly', 'coral', 'fish', 'jelly', 'plankton', 'fish', 'coral'];
  const maxD = Math.min(hullDepth - 10, 80);
  return kinds.map((kind, id) => {
    const a = (id / kinds.length) * Math.PI * 2 + r() * 0.6, d = 28 + r() * 85;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const wanted = kind === 'coral' ? maxD : kind === 'plankton' ? 8 + r() * 14 : 14 + r() * (maxD - 14);
    const y = -Math.min(wanted, -floorAt(x, z) - 3);
    return { id, kind, x, y: kind === 'coral' ? floorAt(x, z) + 1.5 : y, z };
  });
}
export function millerScore(tool: MillerTool, found: number, need: number, health: number, seconds: number): MarsResult {
  const raw = Math.min(70, (found / need) * 62) + health * 0.15 + (tool === 'spectrometer' ? 8 : 0) + Math.max(0, 7 - seconds / 60);
  const score = Math.max(0, Math.min(100, Math.round(found >= need ? raw : raw * 0.6)));
  return { score, science: found * 10, returned: found >= need, grade: score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D', samples: [] };
}

interface Wave { t: number; x: number; z: number; active: boolean; hit: boolean }
interface Game { x: number; y: number; z: number; heading: number; speed: number; vy: number; found: Set<number>; kinds: Life[]; time: number; waves: Wave[]; nextWave: number; msg: string; msgT: number; ended: boolean; health: number; battery: number; shake: number }
interface Hud { health: number; battery: number; depth: number; found: Life[]; reach: Life | null; msg: string; heading: number; x: number; z: number; left: number; visible: { x: number; z: number; kind: Life; dy: number }[] }

function Creature({ kind }: { kind: Life }) {
  const c = COLOR[kind];
  const mat = <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.7} flatShading />;
  if (kind === 'plankton') return <group>{[[0, 0, 0], [0.8, 0.3, 0.4], [-0.7, 0.2, -0.5], [0.2, 0.7, -0.8], [-0.4, 0.5, 0.8]].map((p, i) => <mesh key={i} position={p as [number, number, number]}><icosahedronGeometry args={[0.35, 0]} />{mat}</mesh>)}</group>;
  if (kind === 'jelly') return <group><mesh scale={[1, 0.7, 1]}><sphereGeometry args={[0.9, 7, 5, 0, Math.PI * 2, 0, Math.PI / 1.6]} />{mat}</mesh>{[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * 1.57) * 0.45, -0.7, Math.sin(i * 1.57) * 0.45]}><coneGeometry args={[0.1, 1.2, 4]} />{mat}</mesh>)}</group>;
  if (kind === 'coral') return <group>{[0, 1, 2].map(i => <mesh key={i} position={[(i - 1) * 0.6, 0.4 + i * 0.1, 0]} rotation={[0, 0, (i - 1) * 0.3]}><coneGeometry args={[0.35, 1.5 + i * 0.3, 5]} />{mat}</mesh>)}</group>;
  return <group><mesh scale={[1.6, 0.7, 0.5]}><octahedronGeometry args={[0.8, 0]} />{mat}</mesh><mesh position={[-1.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.5, 0.8, 4]} />{mat}</mesh></group>;
}

const SKY = new THREE.Color('#9fe0ff'), DEEP = new THREE.Color('#06193a'), MID = new THREE.Color('#1a6fb0');

function Scene({ tool, mods, es, sites, g, hud, input, poll, onFinish }: { tool: MillerTool; mods: Mods; es: boolean; sites: Site[]; g: React.MutableRefObject<Game>; hud: React.MutableRefObject<Hud>; input: React.MutableRefObject<WorldInput>; poll: (dt: number) => void; onFinish: () => void }) {
  const { camera, scene } = useThree();
  const sub = useRef<THREE.Group>(null), surf = useRef<THREE.Mesh>(null), light = useRef<THREE.PointLight>(null);
  const siteRefs = useRef<(THREE.Group | null)[]>([]), waveRefs = useRef<(THREE.Group | null)[]>([]);
  const cam = useRef(new THREE.Vector3(0, -8, -14));
  const rand = useMemo(() => rng(99), []);
  const tmp = useMemo(() => new THREE.Vector3(), []), bg = useMemo(() => new THREE.Color(), []);
  const surfGeo = useMemo(() => { const gg = new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60, 40, 40); gg.rotateX(-Math.PI / 2); return gg; }, []);
  const floorGeo = useMemo(() => {
    const gg = new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60, 64, 64); gg.rotateX(-Math.PI / 2);
    const p = gg.attributes.position as THREE.BufferAttribute, col = new Float32Array(p.count * 3), c1 = new THREE.Color('#d9c28a'), c2 = new THREE.Color('#7f6aa8');
    for (let k = 0; k < p.count; k++) { const y = floorAt(p.getX(k), p.getZ(k)); p.setY(k, y); const c = c1.clone().lerp(c2, Math.min(1, (-y - 48) / 70)); col.set([c.r, c.g, c.b], k * 3); }
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.computeVertexNormals(); return gg;
  }, []);
  const decor = useMemo(() => { const r = rng(5); return Array.from({ length: 70 }, () => { const x = (r() * 2 - 1) * HALF, z = (r() * 2 - 1) * HALF; return { x, z, y: floorAt(x, z), s: 0.7 + r() * 2.2, k: r() > 0.5 }; }); }, []);
  useEffect(() => { scene.background = SKY.clone(); scene.fog = new THREE.Fog('#2a8fd0', 10, 120); return () => { scene.fog = null; }; }, [scene]);
  const say = (m: string) => { g.current.msg = m; g.current.msgT = 3; };
  const range = seeRange(tool);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05), s = g.current, i = input.current, t = clock.elapsedTime;
    poll(dt);
    const p = surfGeo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) p.setY(k, waveH(p.getX(k), p.getZ(k), t));
    p.needsUpdate = true;
    if (s.ended) return;
    s.time += dt; s.shake = Math.max(0, s.shake - dt);

    // ── submarine physics: forward/back, turn left/right, up/down ──
    const top = MAXS * (i.boost ? 1.5 : 1);
    s.speed += (i.throttle * top - s.speed) * Math.min(1, dt * 1.8);
    s.heading -= i.steer * dt * (1.3 - Math.min(0.5, Math.abs(s.speed) / 25));
    s.vy += (i.vert * 6 - s.vy) * Math.min(1, dt * 3);
    s.x += Math.sin(s.heading) * s.speed * dt; s.z += Math.cos(s.heading) * s.speed * dt;
    s.x = Math.max(-HALF, Math.min(HALF, s.x)); s.z = Math.max(-HALF, Math.min(HALF, s.z));
    const floor = floorAt(s.x, s.z);
    s.y = Math.max(floor + 2.5, Math.min(-1.2, s.y + s.vy * dt));
    const depth = -s.y;

    // battery: moving costs more; the surface recharges with the sun
    const use = (0.08 + 0.14 * Math.abs(s.speed) / MAXS) * mods.drainMul;
    s.battery = Math.max(0, Math.min(100, s.battery - use * dt * (mods.drainMul >= 1 ? 1 : 0.9) + (depth < 4 ? 1.6 * dt : 0)));
    if (s.battery <= 0) { s.ended = true; say(es ? 'Sin batería' : 'Out of power'); onFinish(); }
    // pressure: below the hull rating the hull is crushed little by little
    if (depth > mods.hullDepth) { s.health = Math.max(0, s.health - (depth - mods.hullDepth) * 0.6 * dt - 2 * dt); if (Math.floor(t * 2) % 4 === 0) say(es ? '¡Presión peligrosa! Sube' : 'Dangerous pressure! Go up'); }

    // ── giant waves hit anything near the surface ──
    s.nextWave -= dt;
    if (s.nextWave <= 0) {
      const slot = s.waves.find(w => !w.active);
      if (slot) { const a = rand() * 6.28, d = rand() * 10; Object.assign(slot, { active: true, hit: false, t: 3.4, x: s.x + Math.sin(s.heading) * s.speed * 2 + Math.cos(a) * d, z: s.z + Math.cos(s.heading) * s.speed * 2 + Math.sin(a) * d }); say(es ? '¡Ola gigante arriba! Sumérgete' : 'Giant wave above! Dive'); }
      s.nextWave = mods.hazardGap[0] + rand() * (mods.hazardGap[1] - mods.hazardGap[0]);
    }
    s.waves.forEach((w, idx) => {
      const n = waveRefs.current[idx]; if (!n) return;
      if (!w.active) { n.visible = false; return; }
      w.t -= dt; n.visible = true; n.position.set(w.x, waveH(w.x, w.z, t), w.z);
      const swell = n.children[0] as THREE.Mesh, ring = n.children[1] as THREE.Mesh;
      swell.scale.set(1, w.t > 0 ? 0.2 + (1 - w.t / 3.4) * 2.8 : Math.max(0.01, 3 + w.t * 3), 1);
      swell.position.y = (swell.scale.y * 3) / 2 - 1;
      (ring.material as THREE.MeshBasicMaterial).opacity = w.t > 0 ? 0.55 : Math.max(0, 0.7 + w.t * 1.4);
      if (w.t <= 0 && !w.hit) {
        w.hit = true;
        if (Math.hypot(s.x - w.x, s.z - w.z) < 7 && depth < 10) { s.health = Math.max(0, s.health - mods.hazardDmg); s.shake = 0.8; s.speed *= 0.3; say(es ? `¡Te golpeó la ola! −${mods.hazardDmg} de casco` : `The wave hit you! −${mods.hazardDmg} hull`); }
        else say(es ? '¡Te sumergiste a tiempo!' : 'You dived in time!');
      }
      if (w.t < -0.8) w.active = false;
    });

    // ── life signals ──
    const dist3 = (x: Site) => Math.hypot(x.x - s.x, x.y - s.y, x.z - s.z);
    const vis = sites.filter(x => !s.found.has(x.id) && dist3(x) <= range);
    const ids = new Set(vis.map(v => v.id));
    sites.forEach((x, idx) => { const n = siteRefs.current[idx]; if (!n) return; n.visible = ids.has(x.id); n.position.set(x.x, x.y + Math.sin(t * 1.6 + idx) * 0.4, x.z); n.rotation.y = t * 0.8; });
    let reach: Site | null = null, bd = 5.5;
    for (const x of sites) { if (s.found.has(x.id)) continue; const d = dist3(x); if (d < bd) { reach = x; bd = d; } }
    if (i.collectPulse) {
      i.collectPulse = false;
      if (reach) { s.found.add(reach.id); s.kinds.push(reach.kind); say(es ? `¡Vida encontrada: ${NAME.es[reach.kind]}!` : `Life found: ${NAME.en[reach.kind]}!`); if (s.kinds.length >= mods.required) { s.ended = true; onFinish(); } }
      else say(es ? 'Acércate a una señal brillante' : 'Get close to a glowing signal');
    }
    if (s.health <= 0 && !s.ended) { s.ended = true; say(es ? 'El submarino quedó dañado' : 'The submarine is wrecked'); onFinish(); }
    const left = mods.timeLimit ? Math.max(0, mods.timeLimit - s.time) : 0;
    if (mods.timeLimit && left <= 0 && !s.ended) { s.ended = true; say(es ? 'Se acabó el tiempo' : 'Time is up'); onFinish(); }
    s.msgT = Math.max(0, s.msgT - dt);

    if (sub.current) {
      sub.current.position.set(s.x, s.y + Math.sin(t * 1.4) * 0.12, s.z);
      sub.current.rotation.set(-s.vy * 0.045, s.heading, -i.steer * 0.12 * Math.min(1, Math.abs(s.speed) / 4), 'YXZ');
    }
    const yaw = s.heading + i.camYaw + Math.PI, dist = 15, pitch = i.camPitch * 0.8;
    tmp.set(s.x + Math.sin(yaw) * Math.cos(pitch) * dist, s.y + 1.5 + Math.sin(pitch) * dist, s.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    tmp.y = Math.min(tmp.y, -0.8);
    cam.current.lerp(tmp, Math.min(1, dt * 5)); camera.position.copy(cam.current);
    if (s.shake > 0) camera.position.x += (Math.random() - 0.5) * s.shake * 0.5;
    camera.lookAt(s.x, s.y + 0.5, s.z);
    // the water gets darker as you go deeper
    const k = Math.min(1, depth / DEEP_VIS);
    bg.copy(SKY).lerp(MID, Math.min(1, depth / 18)).lerp(DEEP, k);
    (scene.background as THREE.Color).copy(bg); (scene.fog as THREE.Fog).color.copy(bg); (scene.fog as THREE.Fog).far = 130 - k * 60;
    if (light.current) { light.current.position.set(s.x, s.y + 3, s.z); light.current.intensity = 0.2 + k * 2.4; }
    hud.current = { health: s.health / 100, battery: s.battery / 100, depth, found: s.kinds.slice(), reach: reach?.kind ?? null, msg: s.msgT > 0 ? s.msg : '', heading: s.heading, x: s.x, z: s.z, left, visible: vis.map(v => ({ x: v.x, z: v.z, kind: v.kind, dy: v.y - s.y })) };
  });

  return <>
    <hemisphereLight args={['#bfe9ff', '#1d3f78', 1.1]} /><directionalLight position={[40, 90, 30]} intensity={1.2} color="#fff6dd" />
    <pointLight ref={light} color="#bfe9ff" distance={70} intensity={0.2} />
    <mesh ref={surf} geometry={surfGeo} position={[0, 0, 0]}><meshStandardMaterial color="#7fd8f0" flatShading transparent opacity={0.55} side={THREE.DoubleSide} roughness={0.4} /></mesh>
    <mesh geometry={floorGeo}><meshStandardMaterial vertexColors flatShading roughness={1} /></mesh>
    {decor.map((d, k) => <mesh key={k} position={[d.x, d.y + d.s * 0.6, d.z]} scale={d.s}>{d.k ? <coneGeometry args={[0.7, 2.2, 5]} /> : <dodecahedronGeometry args={[0.9, 0]} />}<meshStandardMaterial color={d.k ? '#4fae7a' : '#8a7aa8'} flatShading /></mesh>)}
    <group ref={sub} scale={1.5}><Suspense fallback={null}><SubGLB /></Suspense></group>
    {sites.map((x, idx) => <group key={x.id} ref={n => { siteRefs.current[idx] = n; }} visible={false}>
      <Creature kind={x.kind} />
      <mesh><icosahedronGeometry args={[2.6, 0]} /><meshBasicMaterial color={COLOR[x.kind]} wireframe transparent opacity={0.5} fog={false} /></mesh>
    </group>)}
    {g.current.waves.map((_, idx) => <group key={idx} ref={n => { waveRefs.current[idx] = n; }} visible={false}>
      <mesh><cylinderGeometry args={[5, 5.4, 3, 10]} /><meshStandardMaterial color="#e8f8ff" flatShading /></mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[6.2, 7.2, 20]} /><meshBasicMaterial color="#ff4d4d" transparent opacity={0.5} side={THREE.DoubleSide} /></mesh>
    </group>)}
  </>;
}
const DEEP_VIS = 90;

function Minimap({ hud }: { hud: React.MutableRefObject<Hud> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current, ctx = c?.getContext('2d'); if (!c || !ctx) { raf = requestAnimationFrame(draw); return; }
      const W = c.width, R = W / 2, h = hud.current, sc = R / 80;
      ctx.clearRect(0, 0, W, W); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 3, 0, 7); ctx.clip();
      ctx.fillStyle = '#12508a'; ctx.fillRect(0, 0, W, W); ctx.translate(R, R); ctx.rotate(h.heading + Math.PI);
      for (const v of h.visible) { ctx.fillStyle = COLOR[v.kind]; ctx.beginPath(); ctx.arc(-(v.x - h.x) * sc, -(v.z - h.z) * sc, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(R, R - 9); ctx.lineTo(R + 6, R + 7); ctx.lineTo(R - 6, R + 7); ctx.fill();
      ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(R, R, R - 2, 0, 7); ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [hud]);
  return <canvas ref={ref} className="w-minimap" width={170} height={170} aria-label="minimap" />;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function MillerOcean({ tool, es, mods = modsFor('easy'), onDone, onExit }: { tool: MillerTool; es: boolean; mods?: Mods; onDone: (r: MarsResult) => void; onExit: () => void }) {
  const { inp, poll } = useWorldInput({ sub: true });
  const sites = useMemo(() => makeSites(4242, mods.hullDepth), [mods.hullDepth]);
  const g = useRef<Game>({ x: 0, y: -6, z: 0, heading: 0, speed: 0, vy: 0, found: new Set(), kinds: [], time: 0, waves: Array.from({ length: 3 }, () => ({ t: 0, x: 0, z: 0, active: false, hit: false })), nextWave: 8, msg: '', msgT: 0, ended: false, health: mods.startHealth ?? 100, battery: 100 * (mods.startEnergy ?? 1), shake: 0 });
  const hud = useRef<Hud>({ health: 1, battery: 1, depth: 6, found: [], reach: null, msg: '', heading: 0, x: 0, z: 0, left: 0, visible: [] });
  const [snap, setSnap] = useState<Hud>(hud.current);
  const [result, setResult] = useState<MarsResult | null>(null);
  const [help, setHelp] = useState(true);
  useEffect(() => { const t = setInterval(() => setSnap({ ...hud.current }), 100); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setTimeout(() => setHelp(false), 11000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__miller = { g: g.current, sites, mods }; }, [sites, mods]);
  const L = es
    ? { goal: `Encuentra ${mods.required} señales de vida`, scan: 'Investigar', help: 'WASD / flechas: avanzar y girar · Espacio o Q: subir · C o Z: bajar · E investiga', pad: 'Stick: navegar · RT subir · LT bajar · A investiga', touch: 'Joystick: navegar · ▲▼ subir y bajar · E investiga', done: '¡Hay vida en Miller!', fail: 'La misión terminó', again: 'Terminar', quit: 'Salir', health: 'Casco', depth: 'Profundidad', up: 'Subir', down: 'Bajar', limit: 'Límite del casco' }
    : { goal: `Find ${mods.required} signs of life`, scan: 'Investigate', help: 'WASD / arrows: move and turn · Space or Q: up · C or Z: down · E investigates', pad: 'Stick: steer · RT up · LT down · A investigates', touch: 'Joystick: steer · ▲▼ up and down · E investigates', done: 'There is life on Miller!', fail: 'Mission over', again: 'Finish', quit: 'Exit', health: 'Hull', depth: 'Depth', up: 'Up', down: 'Down', limit: 'Hull limit' };
  const finish = () => setResult(millerScore(tool, g.current.kinds.length, mods.required, g.current.health, g.current.time));
  const hold = (k: 'touchUp' | 'touchDown') => ({ onPointerDown: (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); inp.current[k] = true; }, onPointerUp: () => { inp.current[k] = false; }, onPointerCancel: () => { inp.current[k] = false; }, onPointerLeave: () => { inp.current[k] = false; } });
  const over = snap.depth > mods.hullDepth;
  return <div className="w-root adv-root" style={{ background: '#1a6fb0' }}>
    <Canvas dpr={[1, 1.5]} camera={{ fov: 62, near: 0.1, far: 500, position: [0, -8, -14] }}>
      <Scene tool={tool} mods={mods} es={es} sites={sites} g={g} hud={hud} input={inp} poll={poll} onFinish={finish} />
    </Canvas>
    <button className="w-btn w-exit" onClick={onExit} aria-label={L.quit}><X size={20} /></button>
    <div className="adv-quest"><span className="adv-step">{snap.found.length}/{mods.required}</span><b>{L.goal}</b>
      {mods.timeLimit > 0 && <span className="m-time"><Timer size={16} /> {mmss(snap.left)}</span>}
      <BatteryFull size={18} aria-label="battery" style={{ marginLeft: 'auto' }} /><span className="m-hp"><i style={{ width: `${snap.battery * 100}%`, background: snap.battery < 0.25 ? '#ff5d73' : '#ffc857' }} /></span>
      <Heart size={18} aria-label={L.health} /><span className="m-hp"><i style={{ width: `${snap.health * 100}%`, background: snap.health < 0.4 ? '#ff5d73' : '#5ee6a8' }} /></span></div>
    <div className={`m-depth ${over ? 'over' : ''}`} aria-label={L.depth}>
      <small>{L.depth}</small><b>{Math.round(snap.depth)} m</b>
      <div className="m-depth-bar"><i style={{ height: `${Math.min(100, (snap.depth / 150) * 100)}%` }} /><span style={{ top: `${(mods.hullDepth / 150) * 100}%` }} title={L.limit} /></div>
      <small>{L.limit}: {mods.hullDepth} m</small>
    </div>
    <Minimap hud={hud} />
    {snap.msg && <div className="w-toast" role="status">{snap.msg}</div>}
    {snap.reach && <button className="adv-prompt" onClick={() => { inp.current.collectPulse = true; }}><span className="w-key">E</span><span className="w-key pad">A</span>{L.scan}: {NAME[es ? 'es' : 'en'][snap.reach]}</button>}
    {help && <div className="w-help adv-help" onClick={() => setHelp(false)}><span>{L.help}</span><span>{L.pad}</span><span>{L.touch}</span></div>}
    <div className="w-touch"><Joystick input={inp} /><div className="w-btns m-vert">
      <button className="w-btn" aria-label={L.up} {...hold('touchUp')}><ChevronUp size={26} /></button>
      <button className="w-btn" aria-label={L.down} {...hold('touchDown')}><ChevronDown size={26} /></button>
      <button className="w-btn big" onPointerDown={() => { inp.current.collectPulse = true; }}>E</button></div></div>
    {result && <div className="adv-modal"><div className="adv-card center"><h2>{result.returned ? L.done : L.fail}</h2><div className="w-grade">{result.grade}</div><p><b>{result.score}</b>/100</p><button className="button button-primary" autoFocus onClick={() => onDone(result)}>{L.again}</button></div></div>}
  </div>;
}
