import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rng } from '../three/noise';

/** Set `boom.current = { t: 0, x, y, z }` to blow something up there. */
export type BoomState = { t: number; x: number; y: number; z: number; big?: number } | null;
export const BOOM_TIME = 2.2;
const COLORS = ['#ffc857', '#ff7a59', '#ff5d73', '#fff4e6', '#6b5a85', '#3b3b44'];

/** Low-poly explosion: fireball, shockwave ring and flying chunks that tumble and fall. */
export function Boom({ boom, gravity = 14 }: { boom: React.MutableRefObject<BoomState>; gravity?: number }) {
  const root = useRef<THREE.Group>(null), fire = useRef<THREE.Mesh>(null), core = useRef<THREE.Mesh>(null), ring = useRef<THREE.Mesh>(null);
  const chunks = useRef<(THREE.Mesh | null)[]>([]);
  const dat = useMemo(() => { const r = rng(7); return Array.from({ length: 22 }, (_, i) => ({ v: [(r() - 0.5) * 16, 5 + r() * 10, (r() - 0.5) * 16] as const, s: 0.25 + r() * 0.5, spin: [r() * 8, r() * 8, r() * 8] as const, c: COLORS[i % COLORS.length]! })); }, []);
  useFrame((_, rawDt) => {
    const b = boom.current, g = root.current; if (!g) return;
    if (!b || b.t > BOOM_TIME) { g.visible = false; return; }
    b.t += Math.min(rawDt, 0.05); const t = b.t, k = t / BOOM_TIME, big = b.big ?? 1;
    g.visible = true; g.position.set(b.x, b.y, b.z);
    if (fire.current) { fire.current.scale.setScalar((1 + k * 5) * big); (fire.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - k * 1.1); }
    if (core.current) { core.current.scale.setScalar((0.6 + Math.min(1, t * 3) * 2.6) * big * (1 - k * 0.7)); (core.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k * 1.6); }
    if (ring.current) { ring.current.scale.setScalar((1 + t * 14) * big); (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - k); }
    chunks.current.forEach((m, i) => { if (!m) return; const d = dat[i]!; m.position.set(d.v[0] * t * big, d.v[1] * t * big - 0.5 * gravity * t * t, d.v[2] * t * big); m.rotation.set(d.spin[0] * t, d.spin[1] * t, d.spin[2] * t); m.scale.setScalar(d.s * big * Math.max(0, 1 - k * 0.6)); });
  });
  return <group ref={root} visible={false}>
    <mesh ref={fire}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#ff7a59" transparent opacity={0.9} depthWrite={false} fog={false} /></mesh>
    <mesh ref={core}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#fff4b0" transparent opacity={1} depthWrite={false} fog={false} /></mesh>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.8, 1, 20]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} fog={false} /></mesh>
    {dat.map((d, i) => <mesh key={i} ref={m => { chunks.current[i] = m; }}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color={d.c} flatShading emissive={i % 3 === 0 ? d.c : '#000'} emissiveIntensity={0.5} /></mesh>)}
  </group>;
}
