import { useEffect, useMemo, useRef, useState } from 'react';
import { markSquare, markSphere } from './explore';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Polish } from './polish';
import { X } from 'lucide-react';
import { jupiterGeometry, SPOT } from '../three/lowpoly';
import { rng } from '../three/noise';
import { useWorldInput, type WorldInput } from './worldInput';
import { Joystick } from './MarsWorld';
import { tally, type MarsResult } from './marsWorld';
import { modsFor, type Mods } from './levels';
import { Boom, type BoomState } from './fx';
import { Orbiter } from './models';
import { CombatSim, type V3, BOSS_STYLES } from './combat';
import { PoiSim, makePois } from './pois';
import { Actors } from './actors';
import { hurt } from './hud';
import { type Contract, defaultContract, contractN } from './contracts';
import { basePerks, type Perks } from './meta';
import { contractResult, weaponCd, weaponDmg } from './runkit';
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
  const t = tally([
    { es: `Zonas escaneadas: ${scanned} de ${need}`, en: `Zones scanned: ${scanned} of ${need}`, pts: Math.min(1, scanned / need) * 80, max: 80 },
    { es: scanned >= need ? 'Mapa completo' : 'Mapa incompleto', en: scanned >= need ? 'Map complete' : 'Map incomplete', pts: scanned >= need ? 8 : 0, max: 8 },
    { es: `Casco al final: ${Math.round(health)} %`, en: `Hull at the end: ${Math.round(health)}%`, pts: health * 0.06, max: 6 },
    { es: `Rapidez (${Math.round(seconds)} s)`, en: `Speed (${Math.round(seconds)} s)`, pts: Math.max(0, 10 - seconds / 20), max: 10 },
    ...(tool === 'spectrometer' ? [{ es: 'Bono del analizador', en: 'Analyzer bonus', pts: 6, max: 6 }] : []),
  ]);
  return { score: t.score, science: scanned * 10, returned: scanned >= need, grade: t.grade, samples: [], why: t.why, hull: health, secs: seconds };
}

interface Game { lat: number; lon: number; heading: number; scanned: Set<string>; time: number; msg: string; msgT: number; ended: boolean; health: number; fuel: number; dying?: number; fireCd: number; lost: number; exploded: boolean; stolen: string | null }
interface Hud { poiDone: number; poiTotal: number; hold: number; carrying: boolean; kills: number; pnear: string | null; health: number; fuel: number; left: number; near: string | null; scanned: string[]; bearing: number; dist: number; msg: string; lat: number; lon: number; guide: string | null }

function Scene({ tool, mods, perks, contract, sim, pois, tier, es, g, hud, input, poll, onFinish }: { tool: JupiterTool; mods: Mods; perks: Perks; contract: Contract; sim: CombatSim; pois: PoiSim | null; tier: number; es: boolean; g: React.MutableRefObject<Game>; hud: React.MutableRefObject<Hud>; input: React.MutableRefObject<WorldInput>; poll: (dt: number) => void; onFinish: () => void }) {
  const { camera, scene } = useThree();
  const geo = useMemo(() => jupiterGeometry(R), []);
  const boom = useRef<BoomState>(null);
  const ship = useRef<THREE.Group>(null), moon = useRef<THREE.Mesh>(null), rings = useRef<(THREE.Mesh | null)[]>([]);
  const cam = useRef(new THREE.Vector3(0, 10, 40));
  const n = useMemo(() => new THREE.Vector3(), []), north = useMemo(() => new THREE.Vector3(), []), east = useMemo(() => new THREE.Vector3(), []), tmp = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { scene.background = new THREE.Color('#1d1530'); }, [scene]);
  const range = scanRange(tool) + perks.scan;
  const hp0 = Math.max(1, (mods.startHealth ?? 100) * (perks.health / 100));
  const say = (m: string) => { g.current.msg = m; g.current.msgT = 3; };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05), s = g.current, i = input.current, isCollect = contract.kind === 'collect';
    poll(dt);
    if (s.ended) return;
    if (s.dying !== undefined) { s.dying -= dt; if (s.dying <= 0) { s.ended = true; onFinish(); } return; }
    s.time += dt;
    // fast levels: boosting burns limited fuel; the equator is full of radiation
    const boosting = i.boost && (!mods.fuel || s.fuel > 0);
    if (mods.fuel) s.fuel = Math.max(0, Math.min(100, s.fuel + (boosting ? -22 : 7 * perks.boostRegen) * dt));
    const sp = 0.42 * perks.speedMul * (boosting ? 1.8 : 1) * (pois?.carrying ? 0.75 : 1);
    if (Math.abs(s.lat) < 0.32 && mods.radiation > 0) {
      s.health = Math.max(0, s.health - mods.radiation * perks.radiation * 3.2 * dt);
      if (Math.floor(s.time * 2) % 5 === 0) say(es ? '¡Radiación! Sal de la franja del ecuador' : 'Radiation! Leave the equator band');
    }
    if (s.health <= 0) { say(es ? 'La nave explotó' : 'The ship exploded'); s.dying = 2.2; s.exploded = true; const q = posAt(s.lat, s.lon); boom.current = { t: 0, x: q.x, y: q.y, z: q.z, big: 1.5 }; if (ship.current) ship.current.visible = false; return; }
    if (mods.timeLimit && s.time >= mods.timeLimit) { s.ended = true; say(es ? 'Se acabó el tiempo' : 'Time is up'); onFinish(); return; }
    s.lat = Math.max(-1.3, Math.min(1.3, s.lat + i.throttle * sp * dt));
    s.lon += (i.steer * sp * dt) / Math.max(0.4, Math.cos(s.lat));
    if (i.throttle || i.steer) s.heading = Math.atan2(i.steer, i.throttle);
    markSphere(s.lat, s.lon);
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
    for (const z of isCollect ? ZONES : []) {
      if (s.scanned.has(z.id)) continue;
      const d = angDist(s, z);
      if (d < bd) { near = z; bd = d; }
      if (d < gd) { guide = z; gd = d; }
    }
    ZONES.forEach((z, idx) => { const m = rings.current[idx]; if (!m) return; m.visible = isCollect && !s.scanned.has(z.id); m.scale.setScalar(1 + 0.12 * Math.sin(clock.elapsedTime * 4 + idx)); });
    // ── enemies, weapon, thief, side objectives ──
    const me: V3 = { x: p.x, y: p.y, z: p.z };
    s.fireCd = Math.max(0, s.fireCd - dt);
    const fwdV = north.clone().multiplyScalar(Math.cos(s.heading)).addScaledVector(east, Math.sin(s.heading));
    if (i.firePulse) {
      i.firePulse = false;
      if (perks.weapon <= 0) say(es ? 'Aún no tienes arma: mejora tu nave en el taller' : 'No weapon yet: upgrade your ship in the workshop');
      else if (s.fireCd <= 0) { const aim = sim.aim(me, null, 60); sim.shoot({ x: p.x + fwdV.x * 1.5, y: p.y + fwdV.y * 1.5, z: p.z + fwdV.z * 1.5 }, aim ?? { x: fwdV.x, y: fwdV.y, z: fwdV.z }, weaponDmg(perks.weapon), 36, 1.6); s.fireCd = weaponCd(perks); }
    }
    for (const e of sim.update(dt, me, 0)) {
      if (e.type === 'hit') { hurt(); const dmg = Math.round(e.dmg * (1 - Math.min(0.6, perks.armor))); s.health = Math.max(0, s.health - dmg); say(es ? `¡Un dron te golpeó! −${dmg}` : `A drone hit you! −${dmg}`); }
      else if (e.type === 'wave') say(es ? '¡Oleada de drones!' : 'Drone wave incoming!');
      else if (e.type === 'boss') say(es ? '👑 ¡Llegó el jefe de la tormenta!' : '👑 The storm boss is here!');
      else if (e.type === 'slamWarn') say(es ? '⚠️ ' + BOSS_STYLES.storm.sayEs : '⚠️ ' + BOSS_STYLES.storm.sayEn);
      else if (e.type === 'thief') say(es ? '¿Qué fue eso…? Un mapache espacial flota por aquí' : 'What was that…? A space raccoon is floating around');
      else if (e.type === 'kill' && e.enemy.kind === 'thief') loot(e.enemy);
      else if (e.type === 'kill') say(es ? 'Dron derrotado' : 'Drone defeated');
      else if (e.type === 'escape') { if (e.enemy.carry) { s.lost++; say(es ? '¡El mapache se escapó con tu botín!' : 'The raccoon got away with your loot!'); } }
      else if (e.type === 'steal') {
        const th = e.enemy;
        if (pois?.carrying) { pois.drop({ x: th.x, y: th.y, z: th.z }); th.carry = 'crate'; say(es ? '¡El mapache soltó tu carga! Recógela' : 'The raccoon made you drop your cargo! Pick it up'); }
        else if (isCollect && s.scanned.size > 0) { const id = [...s.scanned].pop()!; s.scanned.delete(id); s.stolen = id; th.carry = 'zone'; say(es ? '¡Un mapache espacial te robó datos del mapa! Atrápalo (E)' : 'A space raccoon stole map data! Catch it (E)'); }
        else { s.fuel = Math.max(0, s.fuel - 60); th.carry = 'fuel'; say(es ? '¡Un mapache espacial te robó combustible!' : 'A space raccoon stole fuel!'); }
      }
    }
    function loot(th: { carry: string | null }) {
      if (s.stolen) { s.scanned.add(s.stolen); say(es ? '¡Recuperaste tus datos!' : 'You got your data back!'); s.stolen = null; }
      else say(es ? '¡Atrapaste al mapache!' : 'You caught the raccoon!');
      th.carry = null;
    }
    let pulse = false;
    if (i.collectPulse) { i.collectPulse = false; pulse = true; const th = sim.grab(me, 6); if (th) { th.flash = 0.4; loot(th); pulse = false; } }
    if (pois) {
      for (const e of pois.update(dt, me, i.interactHeld && !pulse, pulse)) {
        if (e.type === 'done' && e.poi.kind === 'beacon') say(es ? '¡Boya instalada!' : 'Buoy deployed!');
        else if (e.type === 'pickup') say(es ? 'Satélite a bordo. Llévalo a la estación (E allá)' : 'Satellite on board. Take it to the station (E there)');
      }
      if (pois.complete) { s.ended = true; onFinish(); return; }
    }
    if (isCollect && pulse) {
      if (near) {
        s.scanned.add(near.id); say(es ? `Escaneado: ${near.es}` : `Scanned: ${near.en}`);
        if (s.scanned.size >= mods.required) { s.ended = true; onFinish(); }
      } else say(es ? 'Acércate a un círculo brillante' : 'Get close to a glowing circle');
    }
    if (s.health <= 0) { say(es ? 'La nave explotó' : 'The ship exploded'); s.dying = 2.2; s.exploded = true; boom.current = { t: 0, x: p.x, y: p.y, z: p.z, big: 1.5 }; if (ship.current) ship.current.visible = false; return; }
    s.msgT = Math.max(0, s.msgT - dt);
    const tg = !pois ? null : pois.carrying ? pois.home : pois.nearest(me);
    const tll = tg ? { lat: Math.asin(Math.max(-1, Math.min(1, tg.y / Math.hypot(tg.x, tg.y, tg.z)))), lon: Math.atan2(tg.x, tg.z) } : null;
    const nxt = pois ? (tll ? { ...tll, id: 'poi' } : null) : (guide ?? ZONES.find(z => !s.scanned.has(z.id)) ?? null);
    let bearing = 0, dist = 0;
    if (nxt) { const dl = Math.sin(nxt.lon - s.lon) * Math.cos(nxt.lat), dn = Math.sin(nxt.lat) * Math.cos(s.lat) - Math.cos(nxt.lat) * Math.sin(s.lat) * Math.cos(nxt.lon - s.lon); bearing = Math.atan2(dl, dn); dist = angDist(s, nxt); }
    const pn = pois && !pois.carrying ? pois.nearest(me) : null, pd = pn ? Math.hypot(pn.x - me.x, pn.y - me.y, pn.z - me.z) : 1e9;
    hud.current = { poiDone: pois?.doneCount ?? 0, poiTotal: pois?.pois.length ?? 0, hold: pois ? Math.max(0, ...pois.pois.map(q => (q.hold > 0 && !q.done ? q.hold / pois.o.holdTime : 0))) : 0, carrying: !!pois?.carrying, kills: sim.kills, pnear: pois ? (pois.carrying ? (Math.hypot(pois.home.x - me.x, pois.home.y - me.y, pois.home.z - me.z) < pois.o.homeRange ? 'deliver' : null) : (pn && pd < pois.o.range ? pn.kind : null)) : null, health: Math.min(1, s.health / hp0), fuel: s.fuel / 100, left: mods.timeLimit ? Math.max(0, mods.timeLimit - s.time) : 0, near: near && !s.scanned.has(near.id) ? near.id : null, scanned: [...s.scanned], bearing, dist, msg: s.msgT > 0 ? s.msg : '', lat: s.lat, lon: s.lon, guide: tool === 'radar' || guide ? nxt?.id ?? null : null };
  });

  return <>
    <ambientLight intensity={0.7} /><directionalLight position={[80, 40, 60]} intensity={2.2} color="#fff1d6" /><Polish />
    <Stars radius={200} depth={60} count={2500} factor={5} saturation={0.5} fade speed={0} />
    <mesh geometry={geo}><meshStandardMaterial vertexColors flatShading roughness={1} /></mesh>
    <mesh ref={moon}><icosahedronGeometry args={[2.2, 1]} /><meshStandardMaterial color="#e8c46a" flatShading /></mesh>
    {ZONES.map((z, idx) => { const p = posAt(z.lat, z.lon, R + 0.4); return <mesh key={z.id} ref={m => { rings.current[idx] = m; }} position={p} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize())}>
      <ringGeometry args={[2.6, 3.4, 20]} /><meshBasicMaterial color={z.hint} side={THREE.DoubleSide} /></mesh>; })}
    <Boom boom={boom} gravity={0} />
    <Actors sim={sim} pois={pois} bulletColor="#7fdcff" sphere />
    {contract.kind === 'rescue' && <mesh position={posAt(0, 0, R + 1)}><octahedronGeometry args={[1.4, 0]} /><meshStandardMaterial color="#5ee6a8" emissive="#5ee6a8" emissiveIntensity={0.8} flatShading /></mesh>}
    <group ref={ship}><Orbiter tier={tier} weapon={perks.weapon > 0} /></group>
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

export default function JupiterOrbit({ tool, es, mods = modsFor('easy'), perks = basePerks(), contract = defaultContract('jupiter'), tier = 0, onDone, onExit }: { tool: JupiterTool; es: boolean; mods?: Mods; perks?: Perks; contract?: Contract; tier?: number; onDone: (r: MarsResult) => void; onExit: () => void }) {
  const { inp, poll } = useWorldInput();
  const g = useRef<Game>({ lat: 0, lon: 0, heading: 0, scanned: new Set(), time: 0, msg: '', msgT: 0, ended: false, health: (mods.startHealth ?? 100) * (perks.health / 100), fuel: 100, fireCd: 0, lost: 0, exploded: false, stolen: null });
  const sim = useMemo(() => new CombatSim({
    kind: 'drone', max: mods.enemyMax, spawnEvery: mods.spawnEvery, waveEvery: mods.waveEvery, hp: mods.enemyHp, speed: mods.enemySpeed * 12, damage: mods.enemyDmg, aggro: 45,
    variants: mods.variants, boss: mods.boss, bossStyle: 'storm', thiefChance: mods.thiefChance, slow: perks.enemySlow, more: perks.enemyMore * contract.danger, seed: 31,
    place: (p, r1, r2) => { const rad = Math.hypot(p.x, p.y, p.z) || 1, lat = Math.asin(p.y / rad), lon = Math.atan2(p.x, p.z), a = r1 * 6.28, d = 0.5 + r2 * 0.4, la = Math.max(-1.3, Math.min(1.3, lat + Math.cos(a) * d)), lo = lon + (Math.sin(a) * d) / Math.max(0.4, Math.cos(la)), q = posAt(la, lo); return { x: q.x, y: q.y, z: q.z }; },
    constrain: e => { const l = Math.hypot(e.x, e.y, e.z) || 1, k = (R + ALT) / l; e.x *= k; e.y *= k; e.z *= k; },
  }), [mods, perks, contract]);
  const pois = useMemo(() => {
    if (contract.kind === 'collect') return null;
    const r = rng(77), n = contractN(contract, mods.required);
    const place = (i: number): V3 => { const lat = (r() * 2 - 1) * 1.0, lon = (i / n) * 6.28 + r() * 1.5, q = posAt(lat, lon, R + 2.5); return { x: q.x, y: q.y, z: q.z }; };
    const h = posAt(0, 0, R + 2.5);
    return new PoiSim(makePois(contract.kind === 'beacons' ? 'beacon' : 'crate', n, place), { x: h.x, y: h.y, z: h.z }, { holdTime: 2.2 + mods.enemyHp * 0.12, range: 9, homeRange: 14, canPhoto: false });
  }, [contract, mods]);
  const hud = useRef<Hud>({ poiDone: 0, poiTotal: 0, hold: 0, carrying: false, kills: 0, pnear: null, health: 1, fuel: 1, left: 0, near: null, scanned: [], bearing: 0, dist: 0, msg: '', lat: 0, lon: 0, guide: null });
  const [snap, setSnap] = useState<Hud>(hud.current);
  const [result, setResult] = useState<MarsResult | null>(null);
  const [help, setHelp] = useState(true);
  useEffect(() => { const t = setInterval(() => setSnap({ ...hud.current }), 100); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setTimeout(() => setHelp(false), 9000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__jup = Object.assign(g.current, { sim, pois }); }, [sim, pois]);
  const L = es
    ? { goal: `Escanea ${mods.required} zonas de Júpiter`, near: 'Escanear', help: 'Vuela con WASD o flechas · Shift acelera · E escanea', pad: 'Stick para volar · A escanea', touch: 'Joystick para volar · botón E escanea', done: 'Mapa completo', again: 'Terminar', map: 'Mapa de la atmósfera', quit: 'Salir' }
    : { goal: `Scan ${mods.required} zones of Jupiter`, near: 'Scan', help: 'Fly with WASD or arrows · Shift to speed up · E scans', pad: 'Stick to fly · A scans', touch: 'Joystick to fly · E button scans', done: 'Map complete', again: 'Finish', map: 'Atmosphere map', quit: 'Exit' };
  const finish = () => { const gg = g.current, base = contract.kind === 'collect' ? jupiterScore(tool, gg.scanned.size, mods.required, gg.health, gg.time) : contractResult(pois?.doneCount ?? 0, pois?.pois.length ?? 1, gg.health, gg.time, sim.kills, gg.exploded, gg.lost); setResult({ ...base, kills: sim.kills, pois: pois?.doneCount ?? gg.scanned.size, exploded: gg.exploded, lost: gg.lost }); };
  const zone = contract.kind === 'collect' ? ZONES.find(z => z.id === snap.near) : undefined;
  const goalText = contract.kind === 'beacons' ? (es ? `Instala ${pois?.pois.length} boyas (mantén E)` : `Deploy ${pois?.pois.length} buoys (hold E)`) : contract.kind === 'rescue' ? (snap.carrying ? (es ? 'Lleva el satélite a la estación (E)' : 'Take the satellite to the station (E)') : (es ? 'Recoge el satélite a la deriva (E)' : 'Pick up the drifting satellite (E)')) : L.goal;
  return <div className="w-root adv-root" style={{ background: '#1d1530' }}>
    <Canvas dpr={[1, 1.6]} camera={{ fov: 60, near: 0.1, far: 600, position: [0, 10, 40] }}>
      <Scene tool={tool} mods={mods} perks={perks} contract={contract} sim={sim} pois={pois} tier={tier} es={es} g={g} hud={hud} input={inp} poll={poll} onFinish={finish} />
    </Canvas>
    <button className="w-btn w-exit" onClick={onExit} aria-label={L.quit}><X size={20} /></button>
    <div className="adv-quest"><span className="adv-step">{contract.kind === 'collect' ? snap.scanned.length : snap.poiDone}/{contract.kind === 'collect' ? mods.required : snap.poiTotal}</span><b>{goalText}</b>
      {mods.timeLimit > 0 && <span className="m-time">{Math.floor(snap.left / 60)}:{String(Math.floor(snap.left % 60)).padStart(2, '0')}</span>}
      {mods.fuel && <span className="m-fuel" title="fuel"><i style={{ width: `${snap.fuel * 100}%` }} /></span>}
      <span className="m-hp" style={{ marginLeft: 'auto' }}><i style={{ width: `${snap.health * 100}%`, background: snap.health < 0.4 ? '#ff5d73' : '#5ee6a8' }} /></span></div>
    {snap.dist > 0.01 && <div className="adv-arrow" aria-hidden="true"><i style={{ transform: `rotate(${snap.bearing}rad)` }} /></div>}
    <div className="jup-mapbox"><b>{L.map}</b><MapView hud={hud} /></div>
    {snap.msg && <div className="w-toast" role="status">{snap.msg}</div>}
    {snap.pnear && <button className="adv-prompt" onClick={() => { inp.current.collectPulse = true; }}><span className="w-key">E</span><span className="w-key pad">A</span>{snap.pnear === 'beacon' ? (es ? 'Mantén para instalar' : 'Hold to deploy') : snap.pnear === 'crate' ? (es ? 'Recoger' : 'Pick up') : (es ? 'Entregar' : 'Deliver')}{snap.hold > 0 && <span className="w-hold"><i style={{ width: `${snap.hold * 100}%` }} /></span>}</button>}
    <div className="w-kills">{perks.weapon > 0 ? `☠ ${snap.kills}` : (es ? 'Esquiva a los drones' : 'Dodge the drones')}</div>
    {zone && <button className="adv-prompt" onClick={() => { inp.current.collectPulse = true; }}><span className="w-key">E</span><span className="w-key pad">A</span>{L.near}: {es ? zone.es : zone.en}</button>}
    {help && <div className="w-help adv-help" onClick={() => setHelp(false)}><span>{L.help}</span><span>{L.pad}</span><span>{L.touch}</span></div>}
    <div className="w-touch"><Joystick input={inp} /><div className="w-btns">{perks.weapon > 0 && <button className="w-btn fire" onPointerDown={() => { inp.current.firePulse = true; }}>R</button>}<button className="w-btn big" onPointerDown={() => { inp.current.collectPulse = true; inp.current.touchInteract = true; }} onPointerUp={() => { inp.current.touchInteract = false; }} onPointerCancel={() => { inp.current.touchInteract = false; }} onPointerLeave={() => { inp.current.touchInteract = false; }}>E</button></div></div>
    {result && <div className="adv-modal"><div className="adv-card center"><h2>{L.done}</h2><div className="w-grade">{result.grade}</div><p><b>{result.score}</b>/100</p><button className="button button-primary" autoFocus onClick={() => onDone(result)}>{L.again}</button></div></div>}
  </div>;
}
