import { colorsOf, useChoice } from './cosmetics';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { markSquare, markSphere } from './explore';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Polish, VehicleDust } from './polish';
import { X, Zap, Heart, Compass, Gamepad2, Keyboard, Hand } from 'lucide-react';
import { modsFor, type Mods } from './levels';
import { Boom, type BoomState } from './fx';
import { createWorld, heightAt, normalAt, newRover, stepRover, visibleSamples, sampleInReach, scoreRun, HALF, LANDER_R, REQUIRED_SAMPLES, detectRange,
  type MarsResult, type MarsWorldData, type RoverState, type SampleKind, type WorldConfig } from './marsWorld';
import { fbm2, rng } from '../three/noise';
import { useWorldInput, type WorldInput } from './worldInput';
import { Rover, arm } from './models';
import { CombatSim, type V3, BOSS_STYLES } from './combat';
import { PoiSim, makePois } from './pois';
import { Actors } from './actors';
import { hurt, Viewfinder } from './hud';
import { type Contract, defaultContract, contractN } from './contracts';
import { basePerks, type Perks } from './meta';
import { contractResult, weaponCd, weaponDmg } from './runkit';
import './world.css';

const KIND_COLOR: Record<SampleKind, string> = { regolith: '#ffd166', basalt: '#b39ddb', hematite: '#ff7a59', ice: '#7fdcff' };
const KIND_NAME: Record<'es' | 'en', Record<SampleKind, string>> = {
  es: { regolith: 'Regolito', basalt: 'Basalto', hematite: 'Hematita', ice: 'Hielo' },
  en: { regolith: 'Regolith', basalt: 'Basalt', hematite: 'Hematite', ice: 'Ice' },
};

interface Meteor { t: number; x: number; z: number; active: boolean; hit: boolean }
interface Game {
  rover: RoverState; taken: Set<number>; kinds: SampleKind[]; time: number; scanT: number; dust: number;
  meteors: Meteor[]; nextMeteor: number; msg: string; msgT: number; ended: boolean; stuck: number; result: MarsResult | null; shake: number; dying?: number; fireCd: number; lost: number; stolen: { id: number; kind: SampleKind } | { energy: number } | null; exploded: boolean;
}
interface Hud { energy: number; health: number; boost: number; taken: SampleKind[]; reach: SampleKind | null; atLander: boolean; heading: number; x: number; z: number; dist: number; bearing: number; msg: string; scan: number; visible: { x: number; z: number; kind: SampleKind }[]; dust: number; speed: number; left: number; poiDone: number; poiTotal: number; hold: number; carrying: boolean; kills: number; target: { x: number; z: number } | null; near: string | null; photo: 'ready' | 'far' | 'off' | 'none' }

// ── Terrain ────────────────────────────────────────────────────────────────
export interface Palette { low: string; mid: string; high: string; pale: string; pad: string }
const MARS_PALETTE: Palette = { low: '#b9533a', mid: '#e07a4d', high: '#f5b27a', pale: '#ffd9a8', pad: '#c9694a' };
export function Terrain({ world, palette = MARS_PALETTE }: { world: MarsWorldData; palette?: Palette }) {
  const geo = useMemo(() => {
    const seg = 128;
    const g = new THREE.PlaneGeometry(HALF * 2, HALF * 2, seg, seg);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(world, p.getX(i), p.getZ(i)));
    const ng = g.toNonIndexed();
    const pos = ng.attributes.position as THREE.BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    const low = new THREE.Color(palette.low), mid = new THREE.Color(palette.mid), high = new THREE.Color(palette.high), pale = new THREE.Color(palette.pale), c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const t = Math.max(0, Math.min(1, (cy / (world.amp ?? 1) + 7) / 14)), n = fbm2(world.seed + 9, cx * 0.12, cz * 0.12, 2);
      c.copy(t < 0.45 ? low.clone().lerp(mid, t / 0.45) : mid.clone().lerp(t < 0.75 ? high : pale, (t - 0.45) / 0.55));
      c.offsetHSL(0, 0, (n - 0.5) * 0.12);
      if (Math.hypot(cx, cz) < LANDER_R + 1) c.set(palette.pad); // landing pad
      for (let k = 0; k < 3; k++) { cols[(i + k) * 3] = c.r; cols[(i + k) * 3 + 1] = c.g; cols[(i + k) * 3 + 2] = c.b; }
    }
    ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    ng.computeVertexNormals();
    return ng;
  }, [world, palette]);
  const grain = useMemo(() => {   // fine speckle so big flat slopes don't look like plastic
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!, r = rng(world.seed + 77);
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) { const v = 150 + Math.floor(r() * 105); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2)); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(110, 110); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [world.seed]);
  return <mesh geometry={geo}><meshStandardMaterial vertexColors map={grain} flatShading roughness={1} /></mesh>;
}

function Rocks({ world }: { world: MarsWorldData }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const d = new THREE.Object3D(), c = new THREE.Color();
    world.rocks.forEach((r, i) => {
      d.position.set(r.x, heightAt(world, r.x, r.z) + r.s * 0.25, r.z);
      d.rotation.set(r.r, r.r * 2, 0); d.scale.set(r.s, r.s * 0.7, r.s * 0.9); d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, c.set(r.tint > 0.6 ? '#8e5a6e' : r.tint > 0.25 ? '#a8664f' : '#c98a62'));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [world]);
  return <instancedMesh ref={ref} args={[undefined, undefined, world.rocks.length]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial flatShading roughness={1} /></instancedMesh>;
}

function Lander() {
  return <group>
    <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[1.7, 2.3, 1.6, 6]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>
    <mesh position={[0, 2.7, 0]}><coneGeometry args={[1.7, 1.1, 6]} /><meshStandardMaterial color="#ffc857" flatShading /></mesh>
    {[0, 1, 2, 3].map(i => { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; return <mesh key={i} position={[Math.cos(a) * 2.2, 0.8, Math.sin(a) * 2.2]} rotation={[Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]}><boxGeometry args={[0.25, 1.9, 0.25]} /><meshStandardMaterial color="#cdb9e0" flatShading /></mesh>; })}
    <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.05, 0.05, 2, 5]} /><meshStandardMaterial color="#cdb9e0" /></mesh>
    <mesh position={[0.35, 4.7, 0]}><boxGeometry args={[0.7, 0.45, 0.05]} /><meshStandardMaterial color="#ff7a59" /></mesh>
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[LANDER_R - 0.6, LANDER_R, 6]} /><meshBasicMaterial color="#ffc857" /></mesh>
  </group>;
}

const isCollectGlobal = (c: Contract) => c.kind === 'collect';
// ── Scene ──────────────────────────────────────────────────────────────────
function Scene({ cfg, mods, need, perks, contract, sim, pois, tier, world, es, g, hud, input, poll, onFinish }: {
  cfg: WorldConfig; mods: Mods; need: number; perks: Perks; contract: Contract; sim: CombatSim; pois: PoiSim | null; tier: number; world: MarsWorldData; es: boolean; g: React.MutableRefObject<Game>; hud: React.MutableRefObject<Hud>;
  input: React.MutableRefObject<WorldInput>; poll: (dt: number) => void; onFinish: (r: MarsResult) => void;
}) {
  const look = colorsOf(useChoice());
  const { camera, scene } = useThree();
  const roverRef = useRef<THREE.Group>(null);
  const boom = useRef<BoomState>(null);
  const sampleRefs = useRef<(THREE.Group | null)[]>([]);
  const meteorRefs = useRef<(THREE.Group | null)[]>([]);
  const fog = useMemo(() => new THREE.Fog('#f7b98a', 70, 300), []);
  const rand = useMemo(() => rng(world.seed + 5), [world]);
  const camPos = useRef(new THREE.Vector3(0, 6, 20));
  const q = useMemo(() => ({ a: new THREE.Quaternion(), b: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0), n: new THREE.Vector3() }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { scene.fog = fog; scene.background = new THREE.Color('#f7b98a'); return () => { scene.fog = null; }; }, [scene, fog]);

  const say = (m: string) => { g.current.msg = m; g.current.msgT = 3; };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05), s = g.current, i = input.current, isCollect = contract.kind === 'collect';
    poll(dt);
    if (s.ended) return;
    s.time += dt;
    if (s.dying !== undefined) { s.dying -= dt; if (s.dying <= 0) finish(false); return; }
    if (mods.timeLimit && s.time >= mods.timeLimit) { say(es ? 'Se acabó el tiempo' : 'Time is up'); finish(false); return; }
    s.dust = Math.max(0, Math.sin(s.time * 0.03 - 0.7)) ** 2;
    const prev = s.rover;
    const cfgNow = pois?.carrying ? { ...cfg, speedMul: (cfg.speedMul ?? 1) * 0.72 } : cfg;
    let r = stepRover(world, cfgNow, prev, { throttle: i.throttle, steer: i.steer, boost: i.boost }, dt, s.dust);
    // rock collisions
    for (const k of world.rocks) {
      const dx = r.x - k.x, dz = r.z - k.z;
      if (Math.abs(dx) > 3.5 || Math.abs(dz) > 3.5) continue;
      const rad = k.s * 0.85 + 1.1;
      if (dx * dx + dz * dz < rad * rad) {
        if (Math.abs(r.speed) > 5 && s.shake <= 0) { r = { ...r, health: Math.max(0, r.health - 4) }; s.shake = 0.4; say(es ? '¡Golpe contra una roca!' : 'Bumped a rock!'); }
        r = { ...r, x: prev.x, z: prev.z, speed: -r.speed * 0.25 };
        break;
      }
    }
    // lander is solid
    if (Math.hypot(r.x, r.z) < 3.6) r = { ...r, x: prev.x, z: prev.z, speed: 0 };
    s.shake = Math.max(0, s.shake - dt);
    s.scanT = Math.max(0, s.scanT - dt);

    // meteors: warning ring, then impact
    s.nextMeteor -= dt;
    if (s.nextMeteor <= 0) {
      const slot = s.meteors.find(m => !m.active);
      if (slot) {
        const a = rand() * 6.28, d = rand() * 14;
        Object.assign(slot, { active: true, hit: false, t: 3.2, x: r.x + Math.sin(r.heading) * r.speed * 2.2 + Math.cos(a) * d, z: r.z + Math.cos(r.heading) * r.speed * 2.2 + Math.sin(a) * d });
        say(es ? '¡Meteorito entrante! Sal del círculo rojo' : 'Incoming meteor! Leave the red circle');
      }
      s.nextMeteor = mods.hazardGap[0] + rand() * (mods.hazardGap[1] - mods.hazardGap[0]);
    }
    s.meteors.forEach((m, idx) => {
      const node = meteorRefs.current[idx]; if (!node) return;
      if (!m.active) { node.visible = false; return; }
      m.t -= dt;
      const gy = heightAt(world, m.x, m.z);
      node.visible = true; node.position.set(m.x, gy, m.z);
      const rock = node.children[0]!, ring = node.children[1] as THREE.Mesh;
      const fall = Math.max(0, m.t / 3.2);
      rock.position.y = m.t > 0 ? fall * fall * 70 + 0.8 : -10;
      rock.rotation.x += dt * 4;
      const pulse = 1 + 0.08 * Math.sin(s.time * 14);
      ring.scale.setScalar(m.t > 0 ? pulse : 1 + (-m.t) * 6);
      (ring.material as THREE.MeshBasicMaterial).opacity = m.t > 0 ? 0.55 : Math.max(0, 0.7 + m.t * 1.4);
      if (m.t <= 0 && !m.hit) {
        m.hit = true;
        if (Math.hypot(r.x - m.x, r.z - m.z) < 5) { r = { ...r, health: Math.max(0, r.health - mods.hazardDmg), speed: r.speed * 0.3 }; s.shake = 0.8; say(es ? `¡Impacto de meteorito! −${mods.hazardDmg} de salud` : `Meteor strike! −${mods.hazardDmg} health`); }
        else say(es ? '¡Lo esquivaste!' : 'Dodged it!');
      }
      if (m.t < -0.8) m.active = false;
    });

    s.rover = r;

    // samples
    const vis = isCollect ? visibleSamples(world, cfg, s.taken, r.x, r.z, s.scanT > 0 ? 45 : 0) : [];
    const visIds = new Set(vis.map(v => v.id));
    world.samples.forEach((sm, idx) => {
      const node = sampleRefs.current[idx]; if (!node) return;
      node.visible = visIds.has(sm.id);
      node.position.set(sm.x, heightAt(world, sm.x, sm.z), sm.z);
      node.children[0]!.rotation.y = s.time * 1.6; node.children[0]!.position.y = 1.4 + Math.sin(s.time * 2 + idx) * 0.25;
    });
    const reach = isCollect ? sampleInReach(world, cfg, s.taken, r.x, r.z) : null;
    const dl = Math.hypot(r.x, r.z), atLander = dl < LANDER_R + 2;
    if (i.scanPulse) {
      i.scanPulse = false;
      if (r.energy > cfg.battery * 0.04 && s.scanT <= 0) { s.scanT = 5; s.rover = { ...s.rover, energy: s.rover.energy - cfg.battery * 0.03 }; say(es ? 'Escaneo: alcance ampliado' : 'Scan: range extended'); }
    }
    // ── enemies, weapon, thief and side objectives ──
    markSquare('mars', r.x, r.z, HALF);
    const gy = heightAt(world, r.x, r.z), me: V3 = { x: r.x, y: gy, z: r.z };
    s.fireCd = Math.max(0, s.fireCd - dt);
    if (i.firePulse) {
      i.firePulse = false;
      if (perks.weapon <= 0) say(es ? 'Aún no tienes arma: mejora tu rover en el taller' : 'No weapon yet: upgrade your rover in the workshop');
      else if (s.fireCd <= 0) {
        const hd = { x: Math.sin(r.heading), y: 0, z: Math.cos(r.heading) }, aim = sim.aim(me, hd, 58);
        sim.shoot({ x: r.x + hd.x * 1.6, y: gy + 1.9, z: r.z + hd.z * 1.6 }, aim ? { x: aim.x, y: aim.y - 1.2, z: aim.z } : hd, weaponDmg(perks.weapon));
        s.fireCd = weaponCd(perks); arm.shot++;
      }
    }
    for (const e of sim.update(dt, me, r.speed)) {
      if (e.type === 'hit') { hurt(); const dmg = Math.round(e.dmg * (1 - Math.min(0.6, perks.armor))); r = { ...r, health: Math.max(0, r.health - dmg), speed: r.speed * 0.5 }; s.shake = 0.5; say(es ? `¡Un bicho te mordió! −${dmg}` : `A bug bit you! −${dmg}`); }
      else if (e.type === 'wave') say(es ? '¡Oleada de bichos!' : 'Bug wave incoming!');
      else if (e.type === 'boss') say(es ? '👑 ¡Llegó el jefe de la zona!' : '👑 The area boss is here!');
      else if (e.type === 'slamWarn') say(es ? '⚠️ ' + BOSS_STYLES.quake.sayEs : '⚠️ ' + BOSS_STYLES.quake.sayEn);
      else if (e.type === 'thief') say(es ? '¿Qué fue eso…? Un mapache espacial anda por aquí' : 'What was that…? A space raccoon is around');
      else if (e.type === 'kill' && e.enemy.kind !== 'thief') say(es ? 'Bicho derrotado' : 'Bug defeated');
      else if (e.type === 'kill') { restoreLoot(e.enemy); }
      else if (e.type === 'escape') { if (e.enemy.carry) { s.lost++; say(es ? '¡El mapache se escapó con tu botín!' : 'The raccoon got away with your loot!'); } }
      else if (e.type === 'steal') {
        const th = e.enemy;
        if (pois?.carrying) { const c = pois.drop({ x: th.x, y: gy, z: th.z }); th.carry = 'crate'; say(es ? '¡El mapache soltó tu carga al huir! Recógela' : 'The raccoon made you drop your cargo! Pick it up'); void c; }
        else if (s.kinds.length > 0) { const k = s.kinds.pop()!; const id = [...s.taken].pop()!; s.taken.delete(id); s.stolen = { id, kind: k }; th.carry = 'sample'; say(es ? '¡Un mapache espacial te robó una muestra! Atrápalo (E)' : 'A space raccoon stole a sample! Catch it (E)'); }
        else { const amt = cfg.battery * 0.25; r = { ...r, energy: Math.max(0, r.energy - amt) }; s.stolen = { energy: amt }; th.carry = 'energy'; say(es ? '¡Un mapache espacial te robó energía! Atrápalo (E)' : 'A space raccoon stole power! Catch it (E)'); }
      }
    }
    function restoreLoot(th: { carry: string | null }) {
      const st = s.stolen; th.carry = null;
      if (st && 'kind' in st) { s.kinds.push(st.kind); s.taken.add(st.id); say(es ? '¡Recuperaste tu muestra!' : 'You got your sample back!'); }
      else if (st) { r = { ...r, energy: Math.min(cfg.battery, r.energy + st.energy) }; say(es ? '¡Recuperaste tu energía!' : 'You got your power back!'); }
      else say(es ? '¡Atrapaste al mapache!' : 'You caught the raccoon!');
      s.stolen = null;
    }
    let held = i.interactHeld, pulse = false;
    if (i.collectPulse) {
      i.collectPulse = false; arm.pulse++; pulse = true; // the arm always tries, whether or not there is a sample
      const th = sim.grab(me, 4.8);
      if (th) { th.flash = 0.4; restoreLoot(th); pulse = false; }
    }
    if (pois) {
      for (const e of pois.update(dt, me, held && !pulse, pulse, { x: Math.sin(r.heading), y: 0, z: Math.cos(r.heading) })) {
        if (e.type === 'done' && e.poi.kind === 'beacon') say(es ? '¡Antena reparada!' : 'Antenna repaired!');
        else if (e.type === 'done' && e.poi.kind === 'photo') { say(es ? '¡Foto tomada!' : 'Photo taken!'); }
        else if (e.type === 'pickup') say(es ? 'Sonda a bordo. Llévala al módulo (E allá)' : 'Probe on board. Take it to the lander (E there)');
        else if (e.type === 'far') say(es ? 'Muy lejos para la foto: acércate a la formación' : 'Too far for a photo: get closer to the formation');
        else if (e.type === 'aim') say(es ? 'La formación no está en el visor: gira el rover para centrarla' : 'The formation is not in the viewfinder: turn the rover to center it');
        else if (e.type === 'nophoto') say(es ? 'Necesitas una cámara para fotografiar' : 'You need a camera to take photos');
      }
      if (pois.complete) { finish(true); return; }
    }
    if (isCollect && pulse) {
      if (reach) {
        s.taken.add(reach.id); s.kinds.push(reach.kind);
        say(es ? `Muestra recolectada: ${KIND_NAME.es[reach.kind]}${cfg.spectrometer ? ' (analizada)' : ''}` : `Sample collected: ${KIND_NAME.en[reach.kind]}${cfg.spectrometer ? ' (analyzed)' : ''}`);
      } else if (atLander && s.kinds.length > 0) {
        finish(true);
      } else say(atLander ? (es ? 'Aún no tienes muestras' : 'No samples yet') : (es ? 'No hay muestras al alcance' : 'No sample in reach'));
    }
    s.rover = r;
    if (i.exitPulse) { i.exitPulse = false; finish(false, true); }
    if (s.rover.health <= 0) { say(es ? 'El rover explotó' : 'The rover exploded'); s.dying = 2.2; s.exploded = true; boom.current = { t: 0, x: s.rover.x, y: heightAt(world, s.rover.x, s.rover.z) + 1, z: s.rover.z }; if (roverRef.current) roverRef.current.visible = false; return; }
    if (s.rover.energy <= 0 && Math.abs(s.rover.speed) < 0.4) { s.stuck += dt; if (s.stuck > 6) { say(es ? 'Sin energía: fin de la misión' : 'Out of power: mission over'); finish(false); } } else s.stuck = 0;
    s.msgT = Math.max(0, s.msgT - dt);

    // rover mesh
    const rv = roverRef.current;
    if (rv) {
      const y = heightAt(world, r.x, r.z), n = normalAt(world, r.x, r.z);
      rv.position.set(r.x, y + 0.05 + Math.sin(s.time * 40) * 0.01 * Math.min(1, Math.abs(r.speed)), r.z);
      q.n.set(n[0], n[1], n[2]); q.a.setFromUnitVectors(q.up, q.n); q.b.setFromAxisAngle(q.up, r.heading);
      rv.quaternion.slerp(q.a.multiply(q.b), Math.min(1, dt * 8));
    }
    // chase camera
    const yaw = r.heading + i.camYaw + Math.PI, dist = 10 + Math.min(3, Math.abs(r.speed) * 0.3), pitch = i.camPitch;
    tmp.set(r.x + Math.sin(yaw) * Math.cos(pitch) * dist, heightAt(world, r.x, r.z) + 1.5 + Math.sin(pitch) * dist, r.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    const gh = heightAt(world, tmp.x, tmp.z) + 1.2; if (tmp.y < gh) tmp.y = gh;
    camPos.current.lerp(tmp, Math.min(1, dt * 5));
    camera.position.copy(camPos.current);
    if (s.shake > 0) camera.position.x += (Math.random() - 0.5) * s.shake * 0.5;
    camera.lookAt(r.x, heightAt(world, r.x, r.z) + 1.3, r.z);
    fog.far = 300 - s.dust * 210; fog.near = 70 - s.dust * 55;

    // HUD snapshot
    const h = hud.current;
    h.energy = r.energy / cfg.battery; h.health = Math.min(1, r.health / Math.max(1, cfg.health)); h.boost = r.boost; h.taken = s.kinds.slice(); h.reach = reach?.kind ?? null; h.atLander = atLander;
    const tgt = !pois ? null : pois.carrying ? { x: 0, z: 0 } : pois.nearest(me);
    h.target = tgt ? { x: tgt.x, z: tgt.z } : null; h.poiDone = pois?.doneCount ?? 0; h.poiTotal = pois?.pois.length ?? 0; h.carrying = !!pois?.carrying; h.kills = sim.kills;
    h.hold = pois ? Math.max(0, ...pois.pois.map(q => (q.hold > 0 && !q.done ? q.hold / pois.o.holdTime : 0))) : 0;
    const pt = pois ? pois.photoTarget(me, { x: Math.sin(r.heading), y: 0, z: Math.cos(r.heading) }) : null; h.photo = pt ? pt.state : 'none';
    h.near = pois ? (pois.carrying ? (dl < LANDER_R + 4 ? 'deliver' : null) : pt ? (pt.state === 'ready' ? 'photo' : null) : (pois.nearest(me) && Math.hypot(pois.nearest(me)!.x - r.x, pois.nearest(me)!.z - r.z) < pois.o.range ? pois.nearest(me)!.kind : null)) : null;
    h.heading = r.heading; h.x = r.x; h.z = r.z; h.dist = tgt ? Math.hypot(tgt.x - r.x, tgt.z - r.z) : dl; h.bearing = tgt ? Math.atan2(tgt.x - r.x, tgt.z - r.z) : Math.atan2(-r.x, -r.z); h.msg = s.msgT > 0 ? s.msg : ''; h.scan = s.scanT; h.dust = s.dust; h.speed = Math.abs(r.speed); h.left = mods.timeLimit ? Math.max(0, mods.timeLimit - s.time) : 0;
    h.visible = vis.map(v => ({ x: v.x, z: v.z, kind: v.kind }));
  });

  function finish(returned: boolean, quit = false) {
    const s = g.current; if (s.ended) return;
    s.ended = true;
    const base = isCollectGlobal(contract) ? scoreRun(cfg, s.kinds, returned && !quit, s.rover, s.time, need) : contractResult(pois?.doneCount ?? 0, pois?.pois.length ?? 1, s.rover.health, s.time, sim.kills, s.exploded, s.lost);
    s.result = { ...base, kills: sim.kills, pois: pois?.doneCount ?? s.kinds.length, exploded: s.exploded, lost: s.lost };
    onFinish(s.result);
  }

  return <>
    <hemisphereLight args={['#ffe7cc', '#a05a4a', 1.1]} />
    <directionalLight position={[60, 90, 30]} intensity={1.9} color="#fff1d6" /><Polish />
    <Terrain world={world} /><Rocks world={world} /><Lander />
    <mesh position={[-120, 70, -160]}><icosahedronGeometry args={[14, 1]} /><meshBasicMaterial color="#fff3c4" fog={false} /></mesh>
    <Boom boom={boom} />
    <VehicleDust target={roverRef} color={look.trail} />
    <group ref={roverRef} position={[0, 0, LANDER_R + 3]}><Rover radar={cfg.radar} spectrometer={cfg.spectrometer} tier={tier} laser={perks.weapon > 0} /></group>
    <Actors sim={sim} pois={pois} bulletColor="#fff4b0" />
    {contract.kind === 'rescue' && <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[LANDER_R + 2, LANDER_R + 3, 24]} /><meshBasicMaterial color="#5ee6a8" transparent opacity={0.6} /></mesh>}
    {world.samples.map((sm, idx) => <group key={sm.id} ref={n => { sampleRefs.current[idx] = n; }} visible={false}>
      <mesh><octahedronGeometry args={[0.55, 0]} /><meshStandardMaterial color={KIND_COLOR[sm.kind]} emissive={KIND_COLOR[sm.kind]} emissiveIntensity={0.5} flatShading /></mesh>
      <mesh position={[0, 6, 0]}><cylinderGeometry args={[0.12, 0.12, 12, 5]} /><meshBasicMaterial color={KIND_COLOR[sm.kind]} transparent opacity={0.35} fog={false} /></mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.9, 2.4, 8]} /><meshBasicMaterial color={KIND_COLOR[sm.kind]} /></mesh>
    </group>)}
    {g.current.meteors.map((_, idx) => <group key={idx} ref={n => { meteorRefs.current[idx] = n; }} visible={false}>
      <mesh><dodecahedronGeometry args={[1.6, 0]} /><meshStandardMaterial color="#5a3a52" emissive="#ff5d3a" emissiveIntensity={0.8} flatShading /></mesh>
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[4.2, 5, 20]} /><meshBasicMaterial color="#ff4d4d" transparent opacity={0.5} side={THREE.DoubleSide} /></mesh>
    </group>)}
  </>;
}

// ── HUD pieces ─────────────────────────────────────────────────────────────
function Minimap({ hud, world, cfg }: { hud: React.MutableRefObject<Hud>; world: MarsWorldData; cfg: WorldConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) { raf = requestAnimationFrame(draw); return; }
      const W = c.width, R = W / 2, h = hud.current, span = 80;
      ctx.clearRect(0, 0, W, W);
      ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 3, 0, 7); ctx.clip();
      ctx.fillStyle = '#6b3a3a'; ctx.fillRect(0, 0, W, W);
      ctx.translate(R, R); ctx.rotate(h.heading + Math.PI); // heading up
      const sc = R / span;
      const P = (x: number, z: number): [number, number] => [(-(x - h.x)) * sc, (-(z - h.z)) * sc];
      ctx.fillStyle = '#8e4a45';
      for (const k of world.craters) { const [px, py] = P(k.x, k.z); ctx.beginPath(); ctx.arc(px, py, k.r * sc, 0, 7); ctx.fill(); }
      const [lx, ly] = P(0, 0); ctx.fillStyle = '#fff4e6'; ctx.beginPath(); ctx.arc(lx, ly, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#ffc857'; ctx.fillRect(lx - 2, ly - 2, 4, 4);
      for (const v of h.visible) { const [px, py] = P(v.x, v.z); ctx.fillStyle = KIND_COLOR[v.kind]; ctx.beginPath(); ctx.moveTo(px, py - 6); ctx.lineTo(px + 5, py); ctx.lineTo(px, py + 6); ctx.lineTo(px - 5, py); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(R, R - 9); ctx.lineTo(R + 6, R + 7); ctx.lineTo(R - 6, R + 7); ctx.fill();
      ctx.strokeStyle = '#1b1230'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(R, R, R - 2, 0, 7); ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hud, world, cfg]);
  return <canvas ref={ref} className="w-minimap" width={170} height={170} aria-label="minimap" />;
}

export function Joystick({ input }: { input: React.MutableRefObject<WorldInput> }) {
  const base = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null);
  const set = (e: React.PointerEvent) => {
    const b = base.current!.getBoundingClientRect(), r = b.width / 2;
    let dx = (e.clientX - (b.left + r)) / r, dy = (e.clientY - (b.top + r)) / r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    input.current.joyX = dx; input.current.joyY = dy; if (knob.current) knob.current.style.transform = `translate(${dx * r * 0.6}px,${dy * r * 0.6}px)`;
  };
  const end = () => { input.current.joyX = 0; input.current.joyY = 0; if (knob.current) knob.current.style.transform = ''; };
  return <div ref={base} className="w-joy" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }} onPointerMove={e => { if (e.buttons || e.pointerType === 'touch') set(e); }} onPointerUp={end} onPointerCancel={end} aria-label="joystick"><div ref={knob} className="w-joy-knob" /></div>;
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function MarsWorld({ cfg, es, mods = modsFor('easy'), perks = basePerks(), contract = defaultContract('mars'), tier = 0, onDone, onExit }: { cfg: WorldConfig; es: boolean; mods?: Mods; perks?: Perks; contract?: Contract; tier?: number; onDone: (r: MarsResult) => void; onExit: () => void }) {
  const world = useMemo(() => createWorld(cfg), [cfg]);
  const need = Math.min(mods.required, cfg.radar ? 6 : 5);
  const sim = useMemo(() => new CombatSim({
    kind: 'crawler', max: mods.enemyMax, spawnEvery: mods.spawnEvery, waveEvery: mods.waveEvery, hp: mods.enemyHp, speed: mods.enemySpeed * 7, damage: mods.enemyDmg, aggro: 42,
    variants: mods.variants, boss: mods.boss, bossStyle: 'quake', thiefChance: mods.thiefChance, slow: perks.enemySlow, more: perks.enemyMore * contract.danger, seed: cfg.seed + 11,
    place: (p, r1, r2) => { const a = r1 * Math.PI * 2, d = 36 + r2 * 24, x = Math.max(-HALF + 4, Math.min(HALF - 4, p.x + Math.cos(a) * d)), z = Math.max(-HALF + 4, Math.min(HALF - 4, p.z + Math.sin(a) * d)); return { x, y: heightAt(world, x, z), z }; },
    constrain: e => { e.x = Math.max(-HALF + 2, Math.min(HALF - 2, e.x)); e.z = Math.max(-HALF + 2, Math.min(HALF - 2, e.z)); e.y = heightAt(world, e.x, e.z); },
  }), [world, mods, perks, contract, cfg.seed]);
  const pois = useMemo(() => {
    if (contract.kind === 'collect') return null;
    const r = rng(cfg.seed + 5), n = contractN(contract, mods.required);
    const place = (i: number): V3 => { const a = (i / n) * Math.PI * 2 + r() * 1.2, d = 45 + r() * 55, x = Math.cos(a) * d, z = Math.sin(a) * d; return { x, y: heightAt(world, x, z), z }; };
    return new PoiSim(makePois(contract.kind === 'beacons' ? 'beacon' : contract.kind === 'rescue' ? 'crate' : 'photo', n, place), { x: 0, y: 0, z: 0 }, { holdTime: 2.2 + mods.enemyHp * 0.12, range: 5, homeRange: LANDER_R + 4, canPhoto: cfg.camera });
  }, [contract, cfg.seed, cfg.camera, mods, world]);
  const { inp, poll } = useWorldInput();
  const g = useRef<Game>({ rover: newRover(cfg), taken: new Set(), kinds: [], time: 0, scanT: 0, dust: 0, meteors: Array.from({ length: 3 }, () => ({ t: 0, x: 0, z: 0, active: false, hit: false })), nextMeteor: 7, msg: '', msgT: 0, ended: false, stuck: 0, result: null, shake: 0, fireCd: 0, lost: 0, stolen: null, exploded: false });
  const hud = useRef<Hud>({ energy: 1, health: 1, boost: 1, taken: [], reach: null, atLander: false, heading: 0, x: 0, z: 0, dist: 0, bearing: 0, msg: '', scan: 0, visible: [], dust: 0, speed: 0, left: 0, poiDone: 0, poiTotal: 0, hold: 0, carrying: false, kills: 0, target: null, near: null, photo: 'none' });
  const [snap, setSnap] = useState<Hud>(hud.current);
  useEffect(() => { if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__frontierMars = { g: g.current, world, sim, pois }; }, [world, sim, pois]);
  const [result, setResult] = useState<MarsResult | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => { const t = setInterval(() => setSnap({ ...hud.current }), 100); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setTimeout(() => setShowHelp(false), 9000); return () => clearTimeout(t); }, []);

  const drag = useRef<{ x: number; y: number } | null>(null);
  const nP = pois?.pois.length ?? 0;
  const goalText = (es: boolean) => contract.kind === 'beacons' ? (es ? `Repara ${nP} antenas (mantén E)` : `Repair ${nP} antennas (hold E)`) : contract.kind === 'rescue' ? (snap.carrying ? (es ? 'Lleva la sonda al módulo y pulsa E' : 'Bring the probe to the lander, press E') : (es ? 'Recoge la sonda varada (E)' : 'Pick up the stranded probe (E)')) : contract.kind === 'photo' ? (es ? `Fotografía ${nP} formaciones: apunta, encuadra y pulsa E` : `Photograph ${nP} formations: aim, frame and press E`) : null;
  const L = es
    ? { energy: 'Energía', health: 'Casco', boost: 'Turbo', samples: 'Muestras', goal: `Recolecta ${need} y regresa al módulo`, collect: 'Recolectar', deposit: 'Entregar muestras y terminar', scan: 'Escanear', quit: 'Salir', done: 'Misión terminada', dust: 'Tormenta de polvo', home: 'Módulo', radarNo: 'Sin radar: el hielo enterrado no se detecta', again: 'Cerrar' }
    : { energy: 'Power', health: 'Hull', boost: 'Boost', samples: 'Samples', goal: `Collect ${need} and return to the lander`, collect: 'Collect', deposit: 'Deliver samples and finish', scan: 'Scan', quit: 'Exit', done: 'Mission complete', dust: 'Dust storm', home: 'Lander', radarNo: 'No radar: buried ice cannot be detected', again: 'Close' };

  return <div className="w-root" data-input={inp.current.usingPad ? 'gamepad' : undefined}
    onPointerDown={e => { if ((e.target as HTMLElement).tagName === 'CANVAS') drag.current = { x: e.clientX, y: e.clientY }; }}
    onPointerMove={e => { const d = drag.current; if (!d) return; inp.current.camYaw -= (e.clientX - d.x) * 0.006; inp.current.camPitch = Math.max(0.1, Math.min(1.1, inp.current.camPitch + (e.clientY - d.y) * 0.004)); drag.current = { x: e.clientX, y: e.clientY }; }}
    onPointerUp={() => { drag.current = null; }}>
    <Canvas dpr={[1, 1.6]} camera={{ fov: 62, near: 0.1, far: 500, position: [0, 6, 25] }} gl={{ antialias: true }}>
      <Suspense fallback={null}><Scene cfg={cfg} mods={mods} need={need} perks={perks} contract={contract} sim={sim} pois={pois} tier={tier} world={world} es={es} g={g} hud={hud} input={inp} poll={poll} onFinish={r => setResult(r)} /></Suspense>
    </Canvas>

    <button className="w-btn w-exit" onClick={() => { inp.current.exitPulse = true; }} aria-label={L.quit}><X size={20} /></button>

    <div className="w-top">
      <div className="w-bars">
        <div className="w-bar"><Zap size={16} /><span style={{ width: `${snap.energy * 100}%`, background: snap.energy < 0.25 ? '#ff5d73' : '#ffc857' }} /><b>{L.energy}</b></div>
        <div className="w-bar"><Heart size={16} /><span style={{ width: `${snap.health * 100}%`, background: snap.health < 0.4 ? '#ff5d73' : '#5ee6a8' }} /><b>{L.health}</b></div>
        <div className="w-bar small"><span style={{ width: `${snap.boost * 100}%`, background: '#6ec6ff' }} /><b>{L.boost}</b></div>
      </div>
      <div className="w-goal">
        <b>{goalText(es) ?? L.goal}</b>
        {contract.kind !== 'collect' && contract.kind !== 'rescue' && <div className="w-chips">{Array.from({ length: nP }, (_, i) => <span key={i} className="w-chip" style={{ background: i < snap.poiDone ? '#5ee6a8' : 'transparent' }}>{i < snap.poiDone ? '✓' : '?'}</span>)}</div>}
        {contract.kind === 'collect' && <div className="w-chips">{Array.from({ length: Math.max(need, snap.taken.length) }, (_, i) => <span key={i} className="w-chip" style={{ background: snap.taken[i] ? KIND_COLOR[snap.taken[i]!] : 'transparent' }}>{snap.taken[i] ? KIND_NAME[es ? 'es' : 'en'][snap.taken[i]!] : '?'}</span>)}</div>}
        {!cfg.radar && contract.kind === 'collect' && <small>{L.radarNo}</small>}
        {mods.timeLimit > 0 && <small className="w-warn">⏱ {Math.floor(snap.left / 60)}:{String(Math.floor(snap.left % 60)).padStart(2, '0')}</small>}
        {snap.dust > 0.35 && <small className="w-warn">{L.dust}</small>}
      </div>
    </div>

    <div className="w-compass" style={{ transform: `rotate(${snap.bearing + snap.heading}rad)` }} aria-hidden="true"><Compass size={0} /><i /></div>
    <div className="w-home">{L.home}: {Math.round(snap.dist)} m</div>
    <Minimap hud={hud} world={world} cfg={cfg} />

    {contract.kind === 'photo' && cfg.camera && <Viewfinder state={snap.photo} es={es} shots={snap.poiDone} />}
    {snap.msg && <div className="w-toast" role="status">{snap.msg}</div>}
    {(snap.reach || (contract.kind === 'collect' && snap.atLander && snap.taken.length > 0) || snap.near) && <div className="w-prompt">
      <span className="w-key">E</span><span className="w-key pad">A</span>{snap.reach ? `${L.collect}: ${KIND_NAME[es ? 'es' : 'en'][snap.reach]}` : snap.near === 'beacon' ? (es ? 'Mantén para reparar' : 'Hold to repair') : snap.near === 'crate' ? (es ? 'Recoger la sonda' : 'Pick up the probe') : snap.near === 'photo' ? (es ? 'Tomar foto' : 'Take photo') : snap.near === 'deliver' ? (es ? 'Entregar la sonda' : 'Deliver the probe') : L.deposit}
      {snap.hold > 0 && <span className="w-hold"><i style={{ width: `${snap.hold * 100}%` }} /></span>}
    </div>}
    <div className="w-kills" aria-label="kills">{perks.weapon > 0 ? `☠ ${snap.kills}` : (es ? 'Esquiva a los bichos' : 'Dodge the bugs')}</div>
    {showHelp && <div className="w-help" onClick={() => setShowHelp(false)}>
      <span><Keyboard size={16} /> WASD · Shift {L.boost} · E {L.collect} · F {L.scan} · R {es ? 'disparar' : 'fire'} · J/L</span>
      <span><Gamepad2 size={16} /> {es ? 'Stick · A recolectar · X escanear · RT/B turbo' : 'Stick · A collect · X scan · RT/B boost'}</span>
      <span><Hand size={16} /> {es ? 'Joystick + botones · arrastra para la cámara' : 'Joystick + buttons · drag for camera'}</span>
    </div>}

    <div className="w-touch">
      <Joystick input={inp} />
      <div className="w-btns">
        {perks.weapon > 0 && <button className="w-btn fire" onPointerDown={() => { inp.current.firePulse = true; }}>R</button>}
        <button className="w-btn big" onPointerDown={() => { inp.current.collectPulse = true; inp.current.touchInteract = true; }} onPointerUp={() => { inp.current.touchInteract = false; }} onPointerCancel={() => { inp.current.touchInteract = false; }} onPointerLeave={() => { inp.current.touchInteract = false; }}>E</button>
        <button className="w-btn" onPointerDown={() => { inp.current.scanPulse = true; }}>{L.scan}</button>
        <button className="w-btn" onPointerDown={() => { inp.current.touchBoost = true; }} onPointerUp={() => { inp.current.touchBoost = false; }} onPointerCancel={() => { inp.current.touchBoost = false; }}>{L.boost}</button>
      </div>
    </div>

    {result && <div className="w-result" role="dialog" aria-label={L.done}>
      <div className="w-card">
        <h2>{L.done}</h2>
        <div className="w-grade">{result.grade}</div>
        <p><b>{result.score}</b>/100 · {result.returned ? (es ? 'Muestras entregadas al módulo' : 'Samples delivered to the lander') : (es ? 'Sin regreso al módulo' : 'No return to the lander')}</p>
        <p>{result.samples.map(k => KIND_NAME[es ? "es" : "en"][k as SampleKind]).join(' · ') || '—'}</p>
        <button className="button button-primary" onClick={() => onDone(result)}>{L.again}</button>
      </div>
    </div>}
    <span className="w-sr" aria-live="polite">{snap.msg}</span>
  </div>;
}
export { detectRange };
