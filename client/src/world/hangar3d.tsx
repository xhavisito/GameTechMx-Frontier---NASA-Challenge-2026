import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt } from './marsWorld';

/** The aircraft hangar on Earth: arched roof, open front, a parked plane, a control tower and a windsock.
 *  Local frame: +z is the front (the open side, facing the start point), +x is to the right. */
export const HANGAR_POS = { x: -34, z: 26 };
export const HANGAR_YAW = Math.atan2(-HANGAR_POS.x, -HANGAR_POS.z);
const SLAB = { x0: -9, x1: 14, z0: -7.5, z1: 15 };   // the concrete apron, in local coordinates
const PLANE = { x: 4.5, z: 10.5, r: 3.4 };

const toLocal = (x: number, z: number) => {
  const dx = x - HANGAR_POS.x, dz = z - HANGAR_POS.z, c = Math.cos(HANGAR_YAW), s = Math.sin(HANGAR_YAW);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
};
export const onApron = (x: number, z: number) => { const { lx, lz } = toLocal(x, z); return lx >= SLAB.x0 && lx <= SLAB.x1 && lz >= SLAB.z0 && lz <= SLAB.z1; };
/** Solid parts the rover cannot drive through: the hall, the control tower and the parked plane. */
export function hangarBlocked(x: number, z: number): boolean {
  const { lx, lz } = toLocal(x, z);
  if (Math.abs(lx) < 7.4 && lz > -6.8 && lz < 6.4) return true;
  if (Math.abs(lx - 11) < 2.2 && Math.abs(lz + 2) < 2.2) return true;
  return Math.hypot(lx - PLANE.x, lz - PLANE.z) < PLANE.r;
}
/** Top of the slab: just above the highest ground under it, so it never sinks into a hill. */
export const APRON_Y = (() => {
  const w = { seed: 77, amp: 0.3, craters: [] as never[] }; let m = -1e9;
  for (let a = SLAB.x0; a <= SLAB.x1; a += 2) for (let b = SLAB.z0; b <= SLAB.z1; b += 2) {
    const c = Math.cos(-HANGAR_YAW), s = Math.sin(-HANGAR_YAW);
    m = Math.max(m, heightAt(w, HANGAR_POS.x + a * c - b * s, HANGAR_POS.z + a * s + b * c));
  }
  return m + 0.15;
})();

const M = ({ c, e = 0, o = 1 }: { c: string; e?: number; o?: number }) => <meshStandardMaterial color={c} flatShading emissive={e ? c : '#000'} emissiveIntensity={e} transparent={o < 1} opacity={o} />;
const R = 5.6, LEN = 12;   // arch radius and hall length

function Sign() {
  const tex = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d')!;
    g.fillStyle = '#2a1f3d'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#ffc857'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
    g.fillStyle = '#ffc857'; g.font = '900 80px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HANGAR', 256, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return <mesh position={[0, R + 0.9, LEN / 2 + 0.2]}><boxGeometry args={[5.6, 1.4, 0.25]} /><meshStandardMaterial map={tex} /></mesh>;
}

export function PlaneBody({ wheels = true }: { wheels?: boolean }) {
  const prop = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (prop.current) prop.current.rotation.z += dt * 14; });
  return <group>
    {/* wheels and legs */}
    {wheels && [[-1.1, 0.3], [1.1, 0.3], [0, -1.6]].map(([x, z], i) => <group key={i} position={[x!, 0, z!]}><mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.06, 0.06, 0.9, 4]} /><M c="#4a4a5a" /></mesh><mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.2, 8]} /><M c="#1b1230" /></mesh></group>)}
    <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.75, 0.55, 4.6, 8]} /><M c="#fff4e6" /></mesh>
    <mesh position={[0, 1.55, 2.75]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.75, 1.1, 8]} /><M c="#ff7a59" /></mesh>
    <mesh position={[0, 1.95, 0.7]}><sphereGeometry args={[0.62, 7, 5]} /><M c="#7fdcff" o={0.85} /></mesh>
    <mesh position={[0, 1.7, 0.2]}><boxGeometry args={[9.2, 0.14, 1.5]} /><M c="#5b6ee1" /></mesh>
    <mesh position={[0, 1.7, 0.2]}><boxGeometry args={[9.3, 0.15, 0.4]} /><M c="#ff7a59" /></mesh>
    <mesh position={[0, 2.55, -2.1]}><boxGeometry args={[0.14, 1.5, 1.1]} /><M c="#5b6ee1" /></mesh>
    <mesh position={[0, 1.75, -2.2]}><boxGeometry args={[3.2, 0.12, 0.8]} /><M c="#5b6ee1" /></mesh>
    <mesh ref={prop} position={[0, 1.55, 3.35]}><boxGeometry args={[2.3, 0.18, 0.06]} /><M c="#2a1f3d" /></mesh>
    <mesh position={[0, 1.55, 3.3]}><sphereGeometry args={[0.2, 6, 5]} /><M c="#ffc857" /></mesh>
  </group>;
}

function Plane() { return <group position={[PLANE.x, 0, PLANE.z]} rotation={[0, -0.5, 0]}><PlaneBody /></group>; }

export function HangarBuilding() {
  const ribs = [-LEN / 2 + 0.1, -LEN / 4, 0, LEN / 4, LEN / 2 - 0.1];
  return <group position={[HANGAR_POS.x, APRON_Y, HANGAR_POS.z]} rotation={[0, HANGAR_YAW, 0]}>
    {/* foundation + apron with painted edge */}
    <mesh position={[(SLAB.x0 + SLAB.x1) / 2, -2, (SLAB.z0 + SLAB.z1) / 2]}><boxGeometry args={[SLAB.x1 - SLAB.x0, 4.3, SLAB.z1 - SLAB.z0]} /><M c="#aab2c4" /></mesh>
    <mesh position={[(SLAB.x0 + SLAB.x1) / 2, 0.02, SLAB.z1 - 0.5]}><boxGeometry args={[SLAB.x1 - SLAB.x0 - 1, 0.04, 0.35]} /><meshBasicMaterial color="#ffc857" /></mesh>
    {[0, 1, 2, 3].map(i => <mesh key={i} position={[0, 0.03, 7.6 + i * 1.6]}><boxGeometry args={[0.35, 0.04, 0.9]} /><meshBasicMaterial color="#fff4e6" /></mesh>)}
    {/* hall: half-cylinder roof, closed back, lit floor */}
    <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[R, R, LEN, 14, 1, true, Math.PI / 2, Math.PI]} /><meshStandardMaterial color="#e8edf7" flatShading side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0, -LEN / 2]}><circleGeometry args={[R, 14, 0, Math.PI]} /><meshStandardMaterial color="#cfd6e6" flatShading side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[R * 2 - 0.3, LEN]} /><meshStandardMaterial color="#7d869b" flatShading /></mesh>
    <pointLight position={[0, 3.5, 0]} intensity={30} distance={14} color="#ffe9b0" />
    {[-3.2, 0, 3.2].map(x => <mesh key={x} position={[x, R - 0.45, 0]}><boxGeometry args={[0.5, 0.12, LEN - 3]} /><meshBasicMaterial color="#fff6d0" /></mesh>)}
    {/* ribs and the frame around the open front */}
    {ribs.map(z => <mesh key={z} position={[0, 0, z]}><torusGeometry args={[R + 0.05, 0.16, 4, 14, Math.PI]} /><M c="#ff7a59" /></mesh>)}
    <mesh position={[0, 0, LEN / 2 + 0.1]}><torusGeometry args={[R + 0.2, 0.3, 5, 14, Math.PI]} /><M c="#2a1f3d" /></mesh>
    <Sign />
    {/* sliding door panels, half open on both sides */}
    {[-1, 1].map(s => <mesh key={s} position={[s * (R - 1), 1.9, LEN / 2 + 0.35]}><boxGeometry args={[2, 3.8, 0.2]} /><M c="#5b6ee1" /></mesh>)}
    {/* inside: tool chest and a crate so it does not look empty */}
    <mesh position={[-3.6, 0.7, -3.5]}><boxGeometry args={[1.6, 1.4, 1.2]} /><M c="#ff8f4d" /></mesh>
    <mesh position={[3.4, 0.5, -4]}><boxGeometry args={[1.2, 1, 1.2]} /><M c="#ffc857" /></mesh>
    {/* control tower */}
    <group position={[11, 0, -2]}>
      <mesh position={[0, 3, 0]}><boxGeometry args={[2.2, 6, 2.2]} /><M c="#fff4e6" /></mesh>
      <mesh position={[0, 6.7, 0]}><boxGeometry args={[3.6, 1.5, 3.6]} /><M c="#7fdcff" o={0.8} /></mesh>
      <mesh position={[0, 7.7, 0]}><boxGeometry args={[4.2, 0.35, 4.2]} /><M c="#ff7a59" /></mesh>
      <mesh position={[0, 8.9, 0]}><cylinderGeometry args={[0.06, 0.06, 2.2, 4]} /><M c="#cdb9e0" /></mesh>
      <mesh position={[0, 10.1, 0]}><sphereGeometry args={[0.22, 6, 5]} /><M c="#ff5d73" e={1} /></mesh>
    </group>
    {/* windsock */}
    <group position={[-8, 0, 12]}>
      <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.08, 0.1, 5, 5]} /><M c="#cdb9e0" /></mesh>
      <mesh position={[0.9, 4.8, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.55, 1.8, 6, 1, true]} /><meshStandardMaterial color="#ff7a59" flatShading side={THREE.DoubleSide} /></mesh>
    </group>
    {/* fuel drums, cones and apron lamps */}
    {[[-7.8, 6], [-7.8, 7.3], [-6.5, 6.6]].map(([x, z], i) => <mesh key={i} position={[x!, 0.7, z!]}><cylinderGeometry args={[0.55, 0.55, 1.4, 8]} /><M c={i === 1 ? '#ffc857' : '#ff5d73'} /></mesh>)}
    {[[-2.4, 13.6], [9, 13.6], [-2.4, 7.6]].map(([x, z], i) => <mesh key={i} position={[x!, 0.4, z!]}><coneGeometry args={[0.38, 0.8, 6]} /><M c="#ff8f4d" /></mesh>)}
    {[[-8.3, 14.3], [13.3, 14.3]].map(([x, z], i) => <group key={i} position={[x!, 0, z!]}><mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.1, 0.12, 3.2, 5]} /><M c="#8d8f98" /></mesh><mesh position={[0, 3.3, 0]}><sphereGeometry args={[0.35, 6, 5]} /><M c="#fff6d0" e={1.2} /></mesh></group>)}
    <Plane />
  </group>;
}
