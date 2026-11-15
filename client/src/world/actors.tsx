import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CombatSim, EnemyKind } from './combat';
import type { PoiSim } from './pois';

const M = ({ c, e = 0 }: { c: string; e?: number }) => <meshStandardMaterial color={c} flatShading emissive={e ? c : '#000'} emissiveIntensity={e} />;

/** Rock beetle (Mars). */
function Crawler() {
  return <group>
    <mesh position={[0, 0.7, 0]} scale={[1.2, 0.8, 1.5]}><dodecahedronGeometry args={[0.9, 0]} /><M c="#8a4a3a" /></mesh>
    <mesh position={[0, 0.5, 1.2]}><icosahedronGeometry args={[0.5, 0]} /><M c="#5a2f2a" /></mesh>
    {[-0.2, 0.2].map(x => <mesh key={x} position={[x, 0.75, 1.55]}><sphereGeometry args={[0.12, 5, 4]} /><M c="#ffc857" e={0.8} /></mesh>)}
    {[-1, 1].flatMap(s => [-0.7, 0, 0.7].map(z => <mesh key={`${s}${z}`} position={[s * 1.1, 0.3, z]} rotation={[0, 0, s * 0.8]}><boxGeometry args={[0.9, 0.12, 0.12]} /><M c="#3b2430" /></mesh>))}
  </group>;
}
/** Storm drone (Jupiter). */
function Drone() {
  return <group>
    <mesh><icosahedronGeometry args={[0.9, 0]} /><M c="#7b5cc4" /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.4, 0.12, 4, 8]} /><M c="#ffc857" e={0.6} /></mesh>
    <mesh position={[0, 0, 0.8]}><sphereGeometry args={[0.28, 6, 5]} /><M c="#ff5d73" e={1} /></mesh>
    {[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * 1.57) * 1.1, Math.sin(i * 1.57) * 1.1, 0]} rotation={[0, 0, i * 1.57]}><coneGeometry args={[0.18, 0.7, 4]} /><M c="#3a2c52" /></mesh>)}
  </group>;
}
/** Anglerfish (Miller). */
function Angler() {
  return <group>
    <mesh scale={[1, 0.9, 1.7]}><octahedronGeometry args={[1.1, 0]} /><M c="#4b3f8f" /></mesh>
    <mesh position={[0, 0.2, -1.9]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.7, 1, 4]} /><M c="#4b3f8f" /></mesh>
    <mesh position={[0, 0.95, 0.9]} rotation={[0.9, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 1.4, 4]} /><M c="#2a1f3d" /></mesh>
    <mesh position={[0, 1.6, 1.6]}><sphereGeometry args={[0.32, 6, 5]} /><M c="#7fdcff" e={1.2} /></mesh>
    {[-0.35, 0.35].map(x => <mesh key={x} position={[x, 0.3, 1.35]}><sphereGeometry args={[0.16, 5, 4]} /><M c="#fff4e6" e={0.9} /></mesh>)}
    {[-0.3, 0, 0.3].map(x => <mesh key={x} position={[x, -0.25, 1.6]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.07, 0.3, 3]} /><M c="#fff4e6" /></mesh>)}
  </group>;
}
/** The space raccoon thief (easter egg). */
function Thief() {
  return <group scale={0.9}>
    <mesh position={[0, 0.7, 0]}><boxGeometry args={[0.9, 0.9, 0.7]} /><M c="#8d8f98" /></mesh>
    <mesh position={[0, 1.55, 0.05]}><icosahedronGeometry args={[0.5, 0]} /><M c="#b9bcc6" /></mesh>
    <mesh position={[0, 1.55, 0.05]} scale={1.18}><sphereGeometry args={[0.5, 8, 6]} /><meshStandardMaterial color="#9fdcff" transparent opacity={0.3} /></mesh>
    <mesh position={[0, 1.58, 0.45]}><boxGeometry args={[0.7, 0.2, 0.1]} /><M c="#2a1f3d" /></mesh>
    {[-0.3, 0.3].map(x => <mesh key={x} position={[x, 2.0, 0]}><coneGeometry args={[0.15, 0.3, 4]} /><M c="#8d8f98" /></mesh>)}
    {[0, 1, 2, 3].map(i => <mesh key={i} position={[0, 0.5 + i * 0.0, -0.55 - i * 0.2]} rotation={[0.9, 0, 0]}><boxGeometry args={[0.28, 0.28, 0.3]} /><M c={i % 2 ? '#2a1f3d' : '#e8dcc8'} /></mesh>)}
    <mesh position={[0, 0.9, -0.55]}><boxGeometry args={[0.7, 0.7, 0.4]} /><M c="#ffc857" /></mesh>
  </group>;
}
const KINDS: EnemyKind[] = ['crawler', 'drone', 'angler', 'thief'];
const MAXE = 14, MAXB = 40;

/** Draws every enemy, bullet and objective marker of a world from the shared sims. */
export function Actors({ sim, pois, bulletColor = '#ffc857', groundY, sphere = false }: { sim: CombatSim; pois: PoiSim | null; bulletColor?: string; groundY?: (x: number, z: number) => number; sphere?: boolean }) {
  const up = useRef(new THREE.Vector3(0, 1, 0)), nn = useRef(new THREE.Vector3()), qq = useRef(new THREE.Quaternion());
  const eg = useRef<(THREE.Group | null)[]>([]), bg = useRef<(THREE.Mesh | null)[]>([]), pg = useRef<(THREE.Group | null)[]>([]);
  const last = useRef<{ x: number; z: number }[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, list = sim.enemies.filter(e => e.alive || e.flash > 0);
    for (let i = 0; i < MAXE; i++) {
      const g = eg.current[i]; if (!g) continue;
      const e = list[i];
      if (!e) { g.visible = false; continue; }
      g.visible = true;
      const bob = e.kind === 'crawler' ? 0 : Math.sin(t * 3 + e.seed) * 0.3;
      g.position.set(e.x, e.y + bob + (e.kind === 'crawler' && groundY ? 0 : 0), e.z);
      const lp = last.current[i] ?? { x: e.x, z: e.z }; const dx = e.x - lp.x, dz = e.z - lp.z;
      if (sphere) { nn.current.set(e.x, e.y, e.z).normalize(); g.quaternion.setFromUnitVectors(up.current, nn.current); }
      else if (dx * dx + dz * dz > 1e-5) g.rotation.y = Math.atan2(dx, dz);
      last.current[i] = { x: e.x, z: e.z };
      g.children.forEach((c, k) => { if (k < KINDS.length) c.visible = KINDS[k] === e.kind; });
      const s = (e.elite ? 1.5 : 1) * (e.alive ? 1 : Math.max(0, e.flash / 0.4)) * (1 + (e.flash > 0 && e.alive ? 0.2 : 0)) * (1 + e.wind * 0.5);   // it swells up right before biting
      g.scale.setScalar(s); if (e.wind > 0.05) g.position.y += e.wind * 0.8;
      const bar = g.children[KINDS.length] as THREE.Mesh; bar.visible = e.alive && e.hp < e.maxHp && e.kind !== 'thief'; bar.scale.x = Math.max(0.02, e.hp / e.maxHp);
      const flag = g.children[KINDS.length + 1] as THREE.Mesh; flag.visible = e.alive && e.kind === 'thief' && e.flee > 0;
    }
    for (let i = 0; i < MAXB; i++) { const m = bg.current[i]; if (!m) continue; const b = sim.bullets[i]; m.visible = !!b; if (b) m.position.set(b.x, b.y, b.z); }
    pois?.pois.forEach((p, i) => {
      const g = pg.current[i]; if (!g) return;
      g.visible = !p.done; g.position.set(p.x, p.y, p.z);
      const ring = g.children[2] as THREE.Mesh; ring.visible = p.kind === 'beacon' && p.hold > 0; if (ring.visible) ring.scale.setScalar(0.5 + Math.min(1, p.hold / pois.o.holdTime) * 1.5);
      g.children[0]!.visible = p.kind === 'beacon'; g.children[1]!.visible = p.kind === 'crate'; g.children[3]!.visible = p.kind === 'photo';
      if (sphere) { nn.current.set(p.x, p.y, p.z).normalize(); g.quaternion.setFromUnitVectors(up.current, nn.current); qq.current.setFromAxisAngle(up.current, t * 0.6); g.quaternion.multiply(qq.current); } else g.rotation.y = t * 0.6;
      if (p.kind === 'crate') g.children[1]!.position.y = 1 + Math.sin(t * 2) * 0.2;
    });
  });
  return <>
    {Array.from({ length: MAXE }, (_, i) => <group key={i} ref={n => { eg.current[i] = n; }} visible={false}>
      <group visible={false}><Crawler /></group><group visible={false}><Drone /></group><group visible={false}><Angler /></group><group visible={false}><Thief /></group>
      <mesh position={[0, 3, 0]} visible={false}><boxGeometry args={[1.6, 0.18, 0.18]} /><meshBasicMaterial color="#ff5d73" /></mesh>
      <mesh position={[0, 3.6, 0]} visible={false}><coneGeometry args={[0.3, 0.5, 4]} /><meshBasicMaterial color="#ffc857" /></mesh>
    </group>)}
    {Array.from({ length: MAXB }, (_, i) => <mesh key={i} ref={n => { bg.current[i] = n; }} visible={false}><icosahedronGeometry args={[0.35, 0]} /><meshBasicMaterial color={bulletColor} fog={false} /></mesh>)}
    {Array.from({ length: 6 }, (_, i) => <group key={i} ref={n => { pg.current[i] = n; }} visible={false}>
      <group><mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.15, 0.3, 2.4, 5]} /><M c="#8d8f98" /></mesh><mesh position={[0, 2.6, 0]}><octahedronGeometry args={[0.5, 0]} /><M c="#ffc857" e={0.9} /></mesh><mesh position={[0, 6, 0]}><cylinderGeometry args={[0.1, 0.1, 8, 5]} /><meshBasicMaterial color="#ffc857" transparent opacity={0.35} fog={false} /></mesh></group>
      <group><mesh position={[0, 1, 0]}><boxGeometry args={[1.4, 1.1, 1.4]} /><M c="#ff8f4d" /></mesh><mesh position={[0, 1, 0]}><boxGeometry args={[1.5, 0.25, 1.5]} /><M c="#fff4e6" /></mesh><mesh position={[0, 6, 0]}><cylinderGeometry args={[0.1, 0.1, 10, 5]} /><meshBasicMaterial color="#ff8f4d" transparent opacity={0.35} fog={false} /></mesh></group>
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.2, 2.7, 16]} /><meshBasicMaterial color="#5ee6a8" /></mesh>
      <group scale={1.3}><mesh position={[-1.6, 1.6, 0]} rotation={[0, 0.3, 0.06]}><boxGeometry args={[1.3, 3.2, 1.2]} /><M c="#a8643d" /></mesh><mesh position={[1.6, 1.3, 0]} rotation={[0, -0.2, -0.08]}><boxGeometry args={[1.2, 2.6, 1.2]} /><M c="#8f5232" /></mesh><mesh position={[0, 3.3, 0]} rotation={[0, 0.1, 0.05]}><boxGeometry args={[4.6, 1, 1.5]} /><M c="#c07a4a" /></mesh><mesh position={[0, 4.1, 0]}><dodecahedronGeometry args={[0.5, 0]} /><M c="#d9b08a" /></mesh></group>
    </group>)}
  </>;
}
