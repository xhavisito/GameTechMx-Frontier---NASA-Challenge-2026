import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt, type MarsWorldData } from './marsWorld';
import { HANGAR_POS, ROCKET_POS, SOLIDS, pathPoints, scatter } from './lobby';

const M = ({ c, e = 0, o = 1, flat = false }: { c: string; e?: number; o?: number; flat?: boolean }) =>
  <meshStandardMaterial color={c} flatShading={flat} emissive={e ? c : '#000'} emissiveIntensity={e} transparent={o < 1} opacity={o} />;

/** Bushes and flower patches, drawn with two instanced meshes so a hundred of them cost almost nothing. */
function Scenery({ world }: { world: MarsWorldData }) {
  const { bushes, flowers } = useMemo(() => scatter(5, 90, 150), []);
  const bush = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), stem = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    bushes.forEach((p, i) => { m.compose(new THREE.Vector3(p.x, heightAt(world, p.x, p.z) + 0.35 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s * 1.2, p.s * 0.8, p.s * 1.2)); bush.current?.setMatrixAt(i, m); bush.current?.setColorAt(i, c.set(p.c)); });
    flowers.forEach((p, i) => {
      const y = heightAt(world, p.x, p.z);
      m.compose(new THREE.Vector3(p.x, y + 0.5 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s)); head.current?.setMatrixAt(i, m); head.current?.setColorAt(i, c.set(p.c));
      m.compose(new THREE.Vector3(p.x, y + 0.25 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s)); stem.current?.setMatrixAt(i, m);
    });
    for (const r of [bush, head, stem]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; }
  }, [bushes, flowers, world]);
  return <>
    <instancedMesh ref={bush} args={[undefined, undefined, bushes.length]}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#ffffff" /></instancedMesh>
    <instancedMesh ref={head} args={[undefined, undefined, flowers.length]}><sphereGeometry args={[0.26, 8, 6]} /><meshStandardMaterial color="#ffffff" /></instancedMesh>
    <instancedMesh ref={stem} args={[undefined, undefined, flowers.length]}><cylinderGeometry args={[0.04, 0.04, 0.5, 5]} /><meshStandardMaterial color="#3fb86a" /></instancedMesh>
  </>;
}

const at = (world: MarsWorldData, x: number, z: number) => [x, heightAt(world, x, z), z] as [number, number, number];

function Turbine({ world, x, z, k }: { world: MarsWorldData; x: number; z: number; k: number }) {
  const rotor = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (rotor.current) rotor.current.rotation.z += dt * (0.8 + k * 0.15); });
  return <group position={at(world, x, z)}>
    <mesh position={[0, 7, 0]}><cylinderGeometry args={[0.25, 0.55, 14, 10]} /><M c="#fff4e6" /></mesh>
    <mesh position={[0, 14.2, 0.4]}><boxGeometry args={[0.8, 0.8, 1.8]} /><M c="#e8edf7" /></mesh>
    <group ref={rotor} position={[0, 14.2, 1.4]}>
      {[0, 1, 2].map(i => <mesh key={i} position={[Math.sin((i * 2 * Math.PI) / 3) * 2.6, Math.cos((i * 2 * Math.PI) / 3) * 2.6, 0]} rotation={[0, 0, -(i * 2 * Math.PI) / 3]}><boxGeometry args={[0.35, 5.2, 0.08]} /><M c="#ffffff" /></mesh>)}
      <mesh><sphereGeometry args={[0.45, 10, 8]} /><M c="#ff7a59" /></mesh>
    </group>
  </group>;
}

function SolarFarm({ world }: { world: MarsWorldData }) {
  const s = SOLIDS[3]!;
  return <group position={at(world, s.x, s.z)}>
    {[-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => <group key={`${i}${j}`} position={[i * 4.6, 0, j * 3.6]}>
      <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.1, 0.1, 1.2, 6]} /><M c="#8d8f98" /></mesh>
      <mesh position={[0, 1.3, 0]} rotation={[-0.6, 0, 0]}><boxGeometry args={[4, 0.12, 2.6]} /><meshStandardMaterial color="#25408f" metalness={0.5} roughness={0.35} emissive="#102a6b" emissiveIntensity={0.25} /></mesh>
    </group>))}
  </group>;
}

function Dome({ world, x, z, c }: { world: MarsWorldData; x: number; z: number; c: string }) {
  return <group position={at(world, x, z)}>
    <mesh position={[0, 0, 0]}><sphereGeometry args={[5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><M c={c} /></mesh>
    <mesh position={[0, 1.8, 0]}><sphereGeometry args={[5.05, 20, 8, 0, Math.PI * 2, Math.PI / 4, Math.PI / 6]} /><M c="#7fdcff" o={0.8} /></mesh>
    <mesh position={[0, 1.2, 4.6]}><boxGeometry args={[1.6, 2.4, 1.2]} /><M c="#5b6ee1" /></mesh>
    <mesh position={[0, 5.4, 0]}><cylinderGeometry args={[0.07, 0.07, 1.6, 5]} /><M c="#cdb9e0" /></mesh>
    <mesh position={[0, 6.3, 0]}><sphereGeometry args={[0.2, 8, 6]} /><M c="#ff5d73" e={1} /></mesh>
  </group>;
}

function Dish({ world }: { world: MarsWorldData }) {
  const g = useRef<THREE.Group>(null), s = SOLIDS[10]!;
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 1.2; });
  return <group position={at(world, s.x, s.z)}>
    <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.5, 0.9, 2.4, 10]} /><M c="#e8edf7" /></mesh>
    <group ref={g} position={[0, 2.8, 0]}>
      <mesh rotation={[-1.0, 0, 0]} position={[0, 0.8, 0.3]}><sphereGeometry args={[2.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 3.2]} /><meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 2.2, 1.4]} rotation={[-1.0, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 2, 5]} /><M c="#8d8f98" /></mesh>
      <mesh position={[0, 3.1, 1.95]}><sphereGeometry args={[0.22, 8, 6]} /><M c="#ffc857" e={0.8} /></mesh>
    </group>
  </group>;
}

/** Launch tower beside the rocket and fuel tanks behind it. */
function LaunchPad({ world }: { world: MarsWorldData }) {
  const t = SOLIDS[0]!, a = SOLIDS[1]!, b = SOLIDS[2]!;
  return <group>
    <group position={at(world, t.x, t.z)}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => <mesh key={i} position={[x! * 1.1, 10, z! * 1.1]}><boxGeometry args={[0.28, 20, 0.28]} /><M c="#ff7a59" /></mesh>)}
      {[2, 6, 10, 14, 18].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[2.4, 0.18, 2.4]} /><M c="#fff4e6" /></mesh>)}
      {[4, 12].map(y => <mesh key={y} position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[3.1, 0.1, 0.1]} /><M c="#ffc857" /></mesh>)}
      <mesh position={[3.2, 15, 0]}><boxGeometry args={[6, 0.35, 0.7]} /><M c="#e8edf7" /></mesh>
      <mesh position={[0, 20.6, 0]}><sphereGeometry args={[0.3, 8, 6]} /><M c="#ff5d73" e={1} /></mesh>
    </group>
    {[a, b].map((s, i) => <group key={i} position={at(world, s.x, s.z)}>
      <mesh position={[0, 2.4, 0]}><sphereGeometry args={[2.2, 16, 12]} /><M c={i ? '#fff4e6' : '#e8edf7'} /></mesh>
      <mesh position={[0, 2.4, 0]}><torusGeometry args={[2.22, 0.12, 6, 20]} /><M c="#ff7a59" /></mesh>
      {[-1, 1].map(k => <mesh key={k} position={[k * 1.3, 0.6, 0]} rotation={[0, 0, k * 0.4]}><cylinderGeometry args={[0.12, 0.12, 2.4, 6]} /><M c="#8d8f98" /></mesh>)}
    </group>)}
  </group>;
}

/** Stepping stones, lamp posts and flags along the two paths from the start. */
function Paths({ world }: { world: MarsWorldData }) {
  const pts = useMemo(() => pathPoints(2.6), []);
  const stones = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(); pts.forEach((p, i) => { m.compose(new THREE.Vector3(p.x, heightAt(world, p.x, p.z) + 0.04, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); stones.current?.setMatrixAt(i, m); });
    if (stones.current) stones.current.instanceMatrix.needsUpdate = true;
  }, [pts, world]);
  const lamps = useMemo(() => pathPoints(11).filter((_, i) => i % 1 === 0), []);
  return <>
    <instancedMesh ref={stones} args={[undefined, undefined, pts.length]}><cylinderGeometry args={[0.85, 0.95, 0.12, 9]} /><meshStandardMaterial color="#d9c9a8" /></instancedMesh>
    {lamps.map((p, i) => <group key={i} position={at(world, p.x + p.nx * 3.2, p.z + p.nz * 3.2)}>
      <mesh position={[0, 1.7, 0]}><cylinderGeometry args={[0.08, 0.13, 3.4, 6]} /><M c="#4a4a5a" /></mesh>
      <mesh position={[0, 3.55, 0]}><sphereGeometry args={[0.34, 10, 8]} /><M c="#fff6d0" e={1.1} /></mesh>
    </group>)}
    {[-1, 1].flatMap(s => [0, 1, 2].map(k => <group key={`${s}${k}`} position={at(world, 6 * s, 1 - k * 3.5)}>
      <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.05, 0.07, 4, 5]} /><M c="#e8edf7" /></mesh>
      <mesh position={[0.6, 3.5, 0]}><boxGeometry args={[1.2, 0.7, 0.05]} /><M c={['#ff7a59', '#ffc857', '#5b6ee1'][k]!} /></mesh>
    </group>))}
  </>;
}

/** Birds circling over the hangar and a hot-air balloon drifting around. */
function Sky() {
  const birds = useRef<(THREE.Group | null)[]>([]), balloon = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    birds.current.forEach((g, i) => {
      if (!g) return; const a = t * 0.5 + i * 1.05, r = 26 + (i % 3) * 7;
      g.position.set(HANGAR_POS.x + Math.cos(a) * r, 22 + (i % 2) * 5 + Math.sin(t + i) * 1.2, HANGAR_POS.z + Math.sin(a) * r); g.rotation.y = Math.PI - a;
      const f = Math.sin(t * 9 + i) * 0.7; g.children[0]!.rotation.z = f; g.children[1]!.rotation.z = -f;
    });
    if (balloon.current) { const a = t * 0.035; balloon.current.position.set(Math.cos(a) * 95 + 20, 58 + Math.sin(t * 0.4) * 2, Math.sin(a) * 95 - 10); balloon.current.rotation.y = t * 0.05; }
  });
  return <>
    {Array.from({ length: 7 }, (_, i) => <group key={i} ref={n => { birds.current[i] = n; }}>
      <mesh position={[0.6, 0, 0]}><boxGeometry args={[1.2, 0.06, 0.4]} /><M c="#fff4e6" /></mesh>
      <mesh position={[-0.6, 0, 0]}><boxGeometry args={[1.2, 0.06, 0.4]} /><M c="#fff4e6" /></mesh>
      <mesh position={[0, 0, 0.1]}><sphereGeometry args={[0.22, 8, 6]} /><M c="#ff7a59" /></mesh>
    </group>)}
    <group ref={balloon} scale={1.6}>
      <mesh position={[0, 5, 0]}><sphereGeometry args={[4, 18, 14]} /><M c="#ff7a59" /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.sin(i * 1.57) * 1.2, 5, Math.cos(i * 1.57) * 1.2]} scale={[0.36, 1.02, 0.36]} rotation={[0, i * 1.57, 0]}><sphereGeometry args={[4, 12, 10]} /><M c={i % 2 ? '#ffc857' : '#fff4e6'} /></mesh>)}
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.2, 0.8, 1.2]} /><M c="#8a5a3c" /></mesh>
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => <mesh key={i} position={[x! * 1.4, 1.9, z! * 1.4]}><cylinderGeometry args={[0.025, 0.025, 3.2, 4]} /><M c="#4a4a5a" /></mesh>)}
    </group>
  </>;
}

/** Everything that fills the Earth lobby besides the hangar, the pitch and the race. */
export function LobbyDeco({ world }: { world: MarsWorldData }) {
  return <>
    <Scenery world={world} /><Paths world={world} /><LaunchPad world={world} /><SolarFarm world={world} /><Dish world={world} />
    {[3, 4, 5].map((i, k) => <Turbine key={i} world={world} x={SOLIDS[i + 1]!.x} z={SOLIDS[i + 1]!.z} k={k} />)}
    {[7, 8, 9].map((i, k) => <Dome key={i} world={world} x={SOLIDS[i]!.x} z={SOLIDS[i]!.z} c={['#fff4e6', '#ffe7cc', '#e0f2ff'][k]!} />)}
    <Sky />
  </>;
}
