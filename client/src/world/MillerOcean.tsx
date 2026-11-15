import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { X, Heart, BatteryFull, ChevronUp, ChevronDown, Timer } from 'lucide-react';
import { HALF, tally, type MarsResult } from './marsWorld';
import { Joystick } from './MarsWorld';
import { SubGLB } from './models';
import { CombatSim, type V3 } from './combat';
import { PoiSim, makePois } from './pois';
import { Actors } from './actors';
import { hurt } from './hud';
import { type Contract, defaultContract, contractN } from './contracts';
import { basePerks, type Perks } from './meta';
import { contractResult, weaponCd, weaponDmg } from './runkit';
import { useWorldInput, type WorldInput } from './worldInput';
import { modsFor, type Mods } from './levels';
import { Boom, type BoomState } from './fx';
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
  const t = tally([
    { es: `Señales de vida: ${found} de ${need}`, en: `Signs of life: ${found} of ${need}`, pts: Math.min(70, (found / need) * 62), max: 70 },
    { es: `Casco al final: ${Math.round(health)} %`, en: `Hull at the end: ${Math.round(health)}%`, pts: health * 0.15, max: 15 },
    { es: `Rapidez (${Math.round(seconds)} s)`, en: `Speed (${Math.round(seconds)} s)`, pts: Math.max(0, 7 - seconds / 60), max: 7 },
    ...(tool === 'spectrometer' ? [{ es: 'Bono del analizador', en: 'Analyzer bonus', pts: 8, max: 8 }] : []),
  ], found >= need ? undefined : { k: 0.6, es: `Faltaron hallazgos (${found} de ${need}): puntos ×0.6`, en: `Missing finds (${found} of ${need}): points ×0.6` });
  return { score: t.score, science: found * 10, returned: found >= need, grade: t.grade, samples: [], why: t.why };
}

interface Wave { t: number; x: number; z: number; active: boolean; hit: boolean }
interface Game { x: number; y: number; z: number; heading: number; speed: number; vy: number; found: Set<number>; kinds: Life[]; time: number; waves: Wave[]; nextWave: number; msg: string; msgT: number; ended: boolean; health: number; battery: number; shake: number; dying?: number; fireCd: number; lost: number; exploded: boolean; stolen: number | null }
interface Hud { poiDone: number; poiTotal: number; hold: number; carrying: boolean; kills: number; pnear: string | null; tgt: { x: number; z: number } | null; health: number; battery: number; depth: number; found: Life[]; reach: Life | null; msg: string; heading: number; x: number; z: number; left: number; visible: { x: number; z: number; kind: Life; dy: number }[] }

function Creature({ kind }: { kind: Life }) {
  const c = COLOR[kind];
  const mat = <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.7} flatShading />;
  if (kind === 'plankton') return <group>{[[0, 0, 0], [0.8, 0.3, 0.4], [-0.7, 0.2, -0.5], [0.2, 0.7, -0.8], [-0.4, 0.5, 0.8]].map((p, i) => <mesh key={i} position={p as [number, number, number]}><icosahedronGeometry args={[0.35, 0]} />{mat}</mesh>)}</group>;
  if (kind === 'jelly') return <group><mesh scale={[1, 0.7, 1]}><sphereGeometry args={[0.9, 7, 5, 0, Math.PI * 2, 0, Math.PI / 1.6]} />{mat}</mesh>{[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * 1.57) * 0.45, -0.7, Math.sin(i * 1.57) * 0.45]}><coneGeometry args={[0.1, 1.2, 4]} />{mat}</mesh>)}</group>;
  if (kind === 'coral') return <group>{[0, 1, 2].map(i => <mesh key={i} position={[(i - 1) * 0.6, 0.4 + i * 0.1, 0]} rotation={[0, 0, (i - 1) * 0.3]}><coneGeometry args={[0.35, 1.5 + i * 0.3, 5]} />{mat}</mesh>)}</group>;
  return <group><mesh scale={[1.6, 0.7, 0.5]}><octahedronGeometry args={[0.8, 0]} />{mat}</mesh><mesh position={[-1.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.5, 0.8, 4]} />{mat}</mesh></group>;
}

const SKY = new THREE.Color('#9fe0ff'), DEEP = new THREE.Color('#06193a'), MID = new THREE.Color('#1a6fb0');

function Scene({ tool, mods, perks, contract, sim, pois, tier, es, sites, g, hud, input, poll, onFinish }: { tool: MillerTool; mods: Mods; perks: Perks; contract: Contract; sim: CombatSim; pois: PoiSim | null; tier: number; es: boolean; sites: Site[]; g: React.MutableRefObject<Game>; hud: React.MutableRefObject<Hud>; input: React.MutableRefObject<WorldInput>; poll: (dt: number) => void; onFinish: () => void }) {
  const { camera, scene } = useThree();
  const boom = useRef<BoomState>(null);
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
  const range = seeRange(tool) + perks.scan, hullD = mods.hullDepth + perks.depth;
  const hp0 = Math.max(1, (mods.startHealth ?? 100) * (perks.health / 100));

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05), s = g.current, i = input.current, t = clock.elapsedTime, isCollect = contract.kind === 'collect';
    poll(dt);
    const p = surfGeo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) p.setY(k, waveH(p.getX(k), p.getZ(k), t));
    p.needsUpdate = true;
    if (s.ended) return;
    if (s.dying !== undefined) { s.dying -= dt; if (s.dying <= 0) { s.ended = true; onFinish(); } return; }
    s.time += dt; s.shake = Math.max(0, s.shake - dt);

    // ── submarine physics: forward/back, turn left/right, up/down ──
    const top = MAXS * perks.speedMul * (i.boost ? 1.5 : 1) * (pois?.carrying ? 0.75 : 1);
    s.speed += (i.throttle * top - s.speed) * Math.min(1, dt * 1.8);
    s.heading -= i.steer * dt * (1.3 - Math.min(0.5, Math.abs(s.speed) / 25));
    s.vy += (i.vert * 6 - s.vy) * Math.min(1, dt * 3);
    s.x += Math.sin(s.heading) * s.speed * dt; s.z += Math.cos(s.heading) * s.speed * dt;
    s.x = Math.max(-HALF, Math.min(HALF, s.x)); s.z = Math.max(-HALF, Math.min(HALF, s.z));
    const floor = floorAt(s.x, s.z);
    s.y = Math.max(floor + 2.5, Math.min(-1.2, s.y + s.vy * dt));
    const depth = -s.y;

    // battery: moving costs more; the surface recharges with the sun
    const use = (0.08 + 0.14 * Math.abs(s.speed) / MAXS) * mods.drainMul / perks.energyMul;
    s.battery = Math.max(0, Math.min(100, s.battery - use * dt * (mods.drainMul >= 1 ? 1 : 0.9) + (depth < 4 ? 1.6 * dt : 0)));
    if (s.battery <= 0) { s.ended = true; say(es ? 'Sin batería' : 'Out of power'); onFinish(); }
    // pressure: below the hull rating the hull is crushed little by little
    if (depth > hullD) { s.health = Math.max(0, s.health - (depth - hullD) * 0.6 * dt - 2 * dt); if (Math.floor(t * 2) % 4 === 0) say(es ? '¡Presión peligrosa! Sube' : 'Dangerous pressure! Go up'); }

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
    const vis = isCollect ? sites.filter(x => !s.found.has(x.id) && dist3(x) <= range) : [];
    const ids = new Set(vis.map(v => v.id));
    sites.forEach((x, idx) => { const n = siteRefs.current[idx]; if (!n) return; n.visible = ids.has(x.id); n.position.set(x.x, x.y + Math.sin(t * 1.6 + idx) * 0.4, x.z); n.rotation.y = t * 0.8; });
    let reach: Site | null = null, bd = 5.5;
    for (const x of isCollect ? sites : []) { if (s.found.has(x.id)) continue; const d = dist3(x); if (d < bd) { reach = x; bd = d; } }
    // ── enemies, weapon, thief, side objectives ──
    const me: V3 = { x: s.x, y: s.y, z: s.z };
    s.fireCd = Math.max(0, s.fireCd - dt);
    const fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    if (i.firePulse) {
      i.firePulse = false;
      if (perks.weapon <= 0) say(es ? 'Aún no tienes arma: mejora tu submarino en el taller' : 'No weapon yet: upgrade your submarine in the workshop');
      else if (s.fireCd <= 0) { const aim = sim.aim(me, null, 60); sim.shoot({ x: s.x + fx * 2, y: s.y, z: s.z + fz * 2 }, aim ?? { x: fx, y: 0, z: fz }, weaponDmg(perks.weapon), 30, 1.8); s.fireCd = weaponCd(perks); }
    }
    const loot = (th: { carry: string | null }) => {
      if (s.stolen !== null) { const sid = s.stolen, st = sites.find(q => q.id === sid); if (st) { s.found.add(sid); s.kinds.push(st.kind); } s.stolen = null; say(es ? '¡Recuperaste tu muestra!' : 'You got your sample back!'); }
      else say(es ? '¡Atrapaste al ladrón!' : 'You caught the thief!');
      th.carry = null;
    };
    for (const e of sim.update(dt, me, 0)) {
      if (e.type === 'hit') { hurt(); const dmg = Math.round(e.dmg * (1 - Math.min(0.6, perks.armor))); s.health = Math.max(0, s.health - dmg); s.shake = 0.5; s.speed *= 0.5; say(es ? `¡Un pez abisal te mordió! −${dmg}` : `An anglerfish bit you! −${dmg}`); }
      else if (e.type === 'wave') say(es ? '¡Banco de peces abisales!' : 'Anglerfish school incoming!');
      else if (e.type === 'thief') say(es ? '¿Qué fue eso…? Un pulpo ladrón nada por aquí' : 'What was that…? A thieving octopus swims nearby');
      else if (e.type === 'kill' && e.enemy.kind === 'thief') loot(e.enemy);
      else if (e.type === 'kill') say(es ? 'Pez abisal derrotado' : 'Anglerfish defeated');
      else if (e.type === 'escape') { if (e.enemy.carry) { s.lost++; say(es ? '¡El pulpo se escapó con tu botín!' : 'The octopus got away with your loot!'); } }
      else if (e.type === 'steal') {
        const th = e.enemy;
        if (pois?.carrying) { pois.drop({ x: th.x, y: th.y, z: th.z }); th.carry = 'crate'; say(es ? '¡El pulpo soltó tu carga! Recógela' : 'The octopus made you drop your cargo! Pick it up'); }
        else if (isCollect && s.kinds.length > 0) { const id = [...s.found].pop()!; s.found.delete(id); s.kinds.pop(); s.stolen = id; th.carry = 'sample'; say(es ? '¡Un pulpo ladrón te robó una muestra! Atrápalo (E)' : 'A thieving octopus stole a sample! Catch it (E)'); }
        else { s.battery = Math.max(0, s.battery - 25); th.carry = 'battery'; say(es ? '¡Un pulpo ladrón te robó batería!' : 'A thieving octopus stole battery!'); }
      }
    }
    let pulse = false;
    if (i.collectPulse) { i.collectPulse = false; pulse = true; const th = sim.grab(me, 6); if (th) { th.flash = 0.4; loot(th); pulse = false; } }
    if (pois) {
      for (const e of pois.update(dt, me, i.interactHeld && !pulse, pulse)) {
        if (e.type === 'done' && e.poi.kind === 'beacon') say(es ? '¡Nodo reparado!' : 'Node repaired!');
        else if (e.type === 'pickup') say(es ? 'Cápsula a bordo. Llévala a la boya de superficie (E allá)' : 'Capsule on board. Bring it to the surface buoy (E there)');
      }
      if (pois.complete) { s.ended = true; onFinish(); return; }
    }
    if (isCollect && pulse) {
      if (reach) { s.found.add(reach.id); s.kinds.push(reach.kind); say(es ? `¡Vida encontrada: ${NAME.es[reach.kind]}!` : `Life found: ${NAME.en[reach.kind]}!`); if (s.kinds.length >= mods.required) { s.ended = true; onFinish(); } }
      else say(es ? 'Acércate a una señal brillante' : 'Get close to a glowing signal');
    }
    if (s.health <= 0 && s.dying === undefined) { say(es ? 'El submarino explotó' : 'The submarine exploded'); s.exploded = true; }
    if (s.health <= 0) { s.exploded = true; say(es ? 'El submarino explotó' : 'The submarine exploded'); s.dying = 2.2; boom.current = { t: 0, x: s.x, y: s.y, z: s.z, big: 1.6 }; if (sub.current) sub.current.visible = false; return; }
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
    const pn = pois && !pois.carrying ? pois.nearest(me) : null, pd = pn ? Math.hypot(pn.x - s.x, pn.y - s.y, pn.z - s.z) : 1e9, tg = pois ? (pois.carrying ? pois.home : pn) : null;
    hud.current = { poiDone: pois?.doneCount ?? 0, poiTotal: pois?.pois.length ?? 0, hold: pois ? Math.max(0, ...pois.pois.map(q => (q.hold > 0 && !q.done ? q.hold / pois.o.holdTime : 0))) : 0, carrying: !!pois?.carrying, kills: sim.kills, pnear: pois ? (pois.carrying ? (Math.hypot(pois.home.x - s.x, pois.home.y - s.y, pois.home.z - s.z) < pois.o.homeRange ? 'deliver' : null) : (pn && pd < pois.o.range ? pn.kind : null)) : null, tgt: tg ? { x: tg.x, z: tg.z } : null, health: Math.min(1, s.health / hp0), battery: s.battery / 100, depth, found: s.kinds.slice(), reach: reach?.kind ?? null, msg: s.msgT > 0 ? s.msg : '', heading: s.heading, x: s.x, z: s.z, left, visible: vis.map(v => ({ x: v.x, z: v.z, kind: v.kind, dy: v.y - s.y })) };
  });

  return <>
    <hemisphereLight args={['#bfe9ff', '#1d3f78', 1.1]} /><directionalLight position={[40, 90, 30]} intensity={1.2} color="#fff6dd" />
    <pointLight ref={light} color="#bfe9ff" distance={70} intensity={0.2} />
    <mesh ref={surf} geometry={surfGeo} position={[0, 0, 0]}><meshStandardMaterial color="#7fd8f0" flatShading transparent opacity={0.55} side={THREE.DoubleSide} roughness={0.4} /></mesh>
    <mesh geometry={floorGeo}><meshStandardMaterial vertexColors flatShading roughness={1} /></mesh>
    {decor.map((d, k) => d.k
      ? <group key={k} position={[d.x, d.y, d.z]} scale={d.s}>{[0, 1, 2].map(j => <mesh key={j} position={[(j - 1) * 0.5, 1.4 + j * 0.3, 0]} rotation={[0, j, (j - 1) * 0.18]}><boxGeometry args={[0.12, 2.8 + j * 0.6, 0.5]} /><meshStandardMaterial color={j === 1 ? '#3fb59a' : '#2a8f7a'} flatShading /></mesh>)}</group>
      : <mesh key={k} position={[d.x, d.y + d.s * 0.5, d.z]} scale={d.s}><dodecahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#8a7aa8" flatShading /></mesh>)}
    <Boom boom={boom} gravity={-2} />
    <Actors sim={sim} pois={pois} bulletColor="#ffe08a" />
    {!isCollectC(contract) && <mesh position={[pois?.home.x ?? 0, 0.6, pois?.home.z ?? 0]}><sphereGeometry args={[1.1, 8, 6]} /><meshStandardMaterial color="#ffc857" emissive="#ffc857" emissiveIntensity={0.6} flatShading /></mesh>}
    <group ref={sub} scale={1.5}><Suspense fallback={null}><SubGLB tier={tier} weapon={perks.weapon > 0} /></Suspense></group>
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
const isCollectC = (c: Contract) => c.kind === 'collect';

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
      if (h.tgt) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 2; const tx = Math.max(-R + 10, Math.min(R - 10, -(h.tgt.x - h.x) * sc)), tz = Math.max(-R + 10, Math.min(R - 10, -(h.tgt.z - h.z) * sc)); ctx.beginPath(); ctx.rect(tx - 5, tz - 5, 10, 10); ctx.fill(); ctx.stroke(); }
      ctx.restore(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(R, R - 9); ctx.lineTo(R + 6, R + 7); ctx.lineTo(R - 6, R + 7); ctx.fill();
      ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(R, R, R - 2, 0, 7); ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [hud]);
  return <canvas ref={ref} className="w-minimap" width={170} height={170} aria-label="minimap" />;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function MillerOcean({ tool, es, mods = modsFor('easy'), perks = basePerks(), contract = defaultContract('miller'), tier = 0, onDone, onExit }: { tool: MillerTool; es: boolean; mods?: Mods; perks?: Perks; contract?: Contract; tier?: number; onDone: (r: MarsResult) => void; onExit: () => void }) {
  const { inp, poll } = useWorldInput({ sub: true });
  const sites = useMemo(() => makeSites(4242, mods.hullDepth), [mods.hullDepth]);
  const g = useRef<Game>({ x: 0, y: -6, z: 0, heading: 0, speed: 0, vy: 0, found: new Set(), kinds: [], time: 0, waves: Array.from({ length: 3 }, () => ({ t: 0, x: 0, z: 0, active: false, hit: false })), nextWave: 8, msg: '', msgT: 0, ended: false, health: (mods.startHealth ?? 100) * (perks.health / 100), battery: Math.min(100, 100 * (mods.startEnergy ?? 1)), shake: 0, fireCd: 0, lost: 0, exploded: false, stolen: null });
  const sim = useMemo(() => new CombatSim({
    kind: 'angler', max: mods.enemyMax, spawnEvery: mods.spawnEvery, waveEvery: mods.waveEvery, hp: mods.enemyHp, speed: mods.enemySpeed * 4.2, damage: mods.enemyDmg, aggro: 30,
    variants: mods.variants, thiefChance: mods.thiefChance, slow: perks.enemySlow, more: perks.enemyMore * contract.danger, seed: 57,
    place: (p, r1, r2) => { const a = r1 * 6.28, d = 24 + r2 * 12, x = Math.max(-HALF, Math.min(HALF, p.x + Math.cos(a) * d)), z = Math.max(-HALF, Math.min(HALF, p.z + Math.sin(a) * d)); return { x, y: Math.max(floorAt(x, z) + 3, Math.min(-4, p.y + (r2 - 0.5) * 14)), z }; },
    constrain: e => { e.x = Math.max(-HALF, Math.min(HALF, e.x)); e.z = Math.max(-HALF, Math.min(HALF, e.z)); e.y = Math.max(floorAt(e.x, e.z) + 2, Math.min(-2, e.y)); },
  }), [mods, perks, contract]);
  const pois = useMemo(() => {
    if (contract.kind === 'collect') return null;
    const r = rng(88), n = contractN(contract, mods.required);
    const place = (i: number): V3 => { const a = (i / n) * 6.28 + r() * 1.2, d = 30 + r() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d; return { x, y: floorAt(x, z) + 1.5, z }; };
    return new PoiSim(makePois(contract.kind === 'beacons' ? 'beacon' : 'crate', n, place), { x: 0, y: -2, z: 0 }, { holdTime: 2.2 + mods.enemyHp * 0.12, range: 7, homeRange: 12, canPhoto: false });
  }, [contract, mods]);
  const hud = useRef<Hud>({ poiDone: 0, poiTotal: 0, hold: 0, carrying: false, kills: 0, pnear: null, tgt: null, health: 1, battery: 1, depth: 6, found: [], reach: null, msg: '', heading: 0, x: 0, z: 0, left: 0, visible: [] });
  const [snap, setSnap] = useState<Hud>(hud.current);
  const [result, setResult] = useState<MarsResult | null>(null);
  const [help, setHelp] = useState(true);
  useEffect(() => { const t = setInterval(() => setSnap({ ...hud.current }), 100); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setTimeout(() => setHelp(false), 11000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__miller = { g: g.current, sites, mods, sim, pois }; }, [sites, mods, sim, pois]);
  const L = es
    ? { goal: `Encuentra ${mods.required} señales de vida`, scan: 'Investigar', help: 'WASD / flechas: avanzar y girar · Espacio o Q: subir · C o Z: bajar · E investiga', pad: 'Stick: navegar · RT subir · LT bajar · A investiga', touch: 'Joystick: navegar · ▲▼ subir y bajar · E investiga', done: '¡Hay vida en Miller!', fail: 'La misión terminó', again: 'Terminar', quit: 'Salir', health: 'Casco', depth: 'Profundidad', up: 'Subir', down: 'Bajar', limit: 'Límite del casco' }
    : { goal: `Find ${mods.required} signs of life`, scan: 'Investigate', help: 'WASD / arrows: move and turn · Space or Q: up · C or Z: down · E investigates', pad: 'Stick: steer · RT up · LT down · A investigates', touch: 'Joystick: steer · ▲▼ up and down · E investigates', done: 'There is life on Miller!', fail: 'Mission over', again: 'Finish', quit: 'Exit', health: 'Hull', depth: 'Depth', up: 'Up', down: 'Down', limit: 'Hull limit' };
  const finish = () => { const gg = g.current, base = contract.kind === 'collect' ? millerScore(tool, gg.kinds.length, mods.required, gg.health, gg.time) : contractResult(pois?.doneCount ?? 0, pois?.pois.length ?? 1, gg.health, gg.time, sim.kills, gg.exploded, gg.lost); setResult({ ...base, kills: sim.kills, pois: pois?.doneCount ?? gg.kinds.length, exploded: gg.exploded, lost: gg.lost }); };
  const hold = (k: 'touchUp' | 'touchDown') => ({ onPointerDown: (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); inp.current[k] = true; }, onPointerUp: () => { inp.current[k] = false; }, onPointerCancel: () => { inp.current[k] = false; }, onPointerLeave: () => { inp.current[k] = false; } });
  const hullD = mods.hullDepth + perks.depth, over = snap.depth > hullD;
  const goalText = contract.kind === 'beacons' ? (es ? `Repara ${pois?.pois.length} nodos (mantén E)` : `Repair ${pois?.pois.length} nodes (hold E)`) : contract.kind === 'rescue' ? (snap.carrying ? (es ? 'Lleva la cápsula a la boya (E)' : 'Take the capsule to the buoy (E)') : (es ? 'Recoge la cápsula del fondo (E)' : 'Pick up the capsule on the seabed (E)')) : L.goal;
  return <div className="w-root adv-root" style={{ background: '#1a6fb0' }}>
    <Canvas dpr={[1, 1.5]} camera={{ fov: 62, near: 0.1, far: 500, position: [0, -8, -14] }}>
      <Scene tool={tool} mods={mods} perks={perks} contract={contract} sim={sim} pois={pois} tier={tier} es={es} sites={sites} g={g} hud={hud} input={inp} poll={poll} onFinish={finish} />
    </Canvas>
    <button className="w-btn w-exit" onClick={onExit} aria-label={L.quit}><X size={20} /></button>
    <div className="adv-quest"><span className="adv-step">{contract.kind === 'collect' ? snap.found.length : snap.poiDone}/{contract.kind === 'collect' ? mods.required : snap.poiTotal}</span><b>{goalText}</b>
      {mods.timeLimit > 0 && <span className="m-time"><Timer size={16} /> {mmss(snap.left)}</span>}
      <BatteryFull size={18} aria-label="battery" style={{ marginLeft: 'auto' }} /><span className="m-hp"><i style={{ width: `${snap.battery * 100}%`, background: snap.battery < 0.25 ? '#ff5d73' : '#ffc857' }} /></span>
      <Heart size={18} aria-label={L.health} /><span className="m-hp"><i style={{ width: `${snap.health * 100}%`, background: snap.health < 0.4 ? '#ff5d73' : '#5ee6a8' }} /></span></div>
    <div className={`m-depth ${over ? 'over' : ''}`} aria-label={L.depth}>
      <small>{L.depth}</small><b>{Math.round(snap.depth)} m</b>
      <div className="m-depth-bar"><i style={{ height: `${Math.min(100, (snap.depth / 150) * 100)}%` }} /><span style={{ top: `${(hullD / 150) * 100}%` }} title={L.limit} /></div>
      <small>{L.limit}: {hullD} m</small>
    </div>
    <Minimap hud={hud} />
    {snap.msg && <div className="w-toast" role="status">{snap.msg}</div>}
    {snap.pnear && <button className="adv-prompt" onClick={() => { inp.current.collectPulse = true; }}><span className="w-key">E</span><span className="w-key pad">A</span>{snap.pnear === 'beacon' ? (es ? 'Mantén para reparar' : 'Hold to repair') : snap.pnear === 'crate' ? (es ? 'Recoger' : 'Pick up') : (es ? 'Entregar' : 'Deliver')}{snap.hold > 0 && <span className="w-hold"><i style={{ width: `${snap.hold * 100}%` }} /></span>}</button>}
    <div className="w-kills">{perks.weapon > 0 ? `☠ ${snap.kills}` : (es ? 'Esquiva a los peces abisales' : 'Dodge the anglerfish')}</div>
    {snap.reach && <button className="adv-prompt" onClick={() => { inp.current.collectPulse = true; }}><span className="w-key">E</span><span className="w-key pad">A</span>{L.scan}: {NAME[es ? 'es' : 'en'][snap.reach]}</button>}
    {help && <div className="w-help adv-help" onClick={() => setHelp(false)}><span>{L.help}</span><span>{L.pad}</span><span>{L.touch}</span></div>}
    <div className="w-touch"><Joystick input={inp} /><div className="w-btns m-vert">
      <button className="w-btn" aria-label={L.up} {...hold('touchUp')}><ChevronUp size={26} /></button>
      <button className="w-btn" aria-label={L.down} {...hold('touchDown')}><ChevronDown size={26} /></button>
      {perks.weapon > 0 && <button className="w-btn fire" onPointerDown={() => { inp.current.firePulse = true; }}>R</button>}
      <button className="w-btn big" onPointerDown={() => { inp.current.collectPulse = true; inp.current.touchInteract = true; }} onPointerUp={() => { inp.current.touchInteract = false; }} onPointerCancel={() => { inp.current.touchInteract = false; }} onPointerLeave={() => { inp.current.touchInteract = false; }}>E</button></div></div>
    {result && <div className="adv-modal"><div className="adv-card center"><h2>{result.returned ? L.done : L.fail}</h2><div className="w-grade">{result.grade}</div><p><b>{result.score}</b>/100</p><button className="button button-primary" autoFocus onClick={() => onDone(result)}>{L.again}</button></div></div>}
  </div>;
}
