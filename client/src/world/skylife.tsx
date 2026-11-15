import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlaneBody } from './hangar3d';
import { RACE, RAMP } from './earthgames';
import { heightAt, type MarsWorldData } from './marsWorld';

/** Things that make the Earth feel alive: planes circling overhead, drifting clouds, and the cone-race and ramp props. */
export function SkyLife() {
  const planes = useRef<(THREE.Group | null)[]>([]), clouds = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    planes.current.forEach((g, i) => {
      if (!g) return; const a = t * (0.09 + i * 0.03) * (i % 2 ? -1 : 1) + i * 2.4, r = 150 + i * 30;
      g.position.set(Math.cos(a) * r, 46 + i * 14, Math.sin(a) * r); g.rotation.y = -a + (i % 2 ? -Math.PI / 2 : Math.PI / 2) + Math.PI; g.rotation.z = (i % 2 ? 1 : -1) * 0.25;
    });
    clouds.current.forEach((g, i) => { if (!g) return; g.position.x = ((i * 97 + t * (2 + (i % 3))) % 560) - 280; });
  });
  return <>
    {[0, 1].map(i => <group key={i} ref={n => { planes.current[i] = n; }} scale={1.6}><PlaneBody wheels={false} /></group>)}
    {Array.from({ length: 8 }, (_, i) => <group key={i} ref={n => { clouds.current[i] = n; }} position={[0, 75 + (i % 4) * 9, -200 + i * 55]}>
      {[[0, 0, 0, 9], [8, -1, 2, 7], [-8, -1, -1, 6.5], [3, 2, -4, 6]].map(([x, y, z, s], k) => <mesh key={k} position={[x!, y!, z!]} scale={[s!, s! * 0.55, s! * 0.8]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#ffffff" flatShading transparent opacity={0.92} /></mesh>)}
    </group>)}
  </>;
}

const Cone = ({ x, y, z, c = '#ff8f4d' }: { x: number; y: number; z: number; c?: string }) => <group position={[x, y, z]}>
  <mesh position={[0, 0.9, 0]}><coneGeometry args={[0.8, 1.8, 7]} /><meshStandardMaterial color={c} flatShading /></mesh>
  <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.45, 0.55, 0.28, 7]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>
</group>;

/** Cone-race props: a start/finish gate and numbered cones (the next one glows). */
export function RaceProps({ world, next, running }: { world: MarsWorldData; next: number; running: boolean }) {
  const y = (x: number, z: number) => heightAt(world, x, z), s = RACE.start;
  return <group>
    <group position={[s.x, y(s.x, s.z), s.z]}>
      {[-1, 1].map(k => <mesh key={k} position={[k * RACE.gate * 0.8, 2, 0]}><boxGeometry args={[0.5, 4, 0.5]} /><meshStandardMaterial color="#fff4e6" flatShading /></mesh>)}
      <mesh position={[0, 4.1, 0]}><boxGeometry args={[RACE.gate * 1.6 + 0.6, 0.9, 0.4]} /><meshStandardMaterial color={running ? '#5ee6a8' : '#ffc857'} emissive={running ? '#5ee6a8' : '#ffc857'} emissiveIntensity={0.5} flatShading /></mesh>
      {[0, 1, 2, 3, 4, 5].map(k => <mesh key={k} position={[-RACE.gate * 0.7 + k * (RACE.gate * 1.4 / 5), 4.1, 0.22]}><boxGeometry args={[0.5, 0.45, 0.05]} /><meshBasicMaterial color={k % 2 ? '#2a1f3d' : '#ffffff'} /></mesh>)}
    </group>
    {RACE.cones.map((c, i) => <Cone key={i} x={c.x} y={y(c.x, c.z)} z={c.z} c={running && i === next ? '#5ee6a8' : i < next && running ? '#8d8f98' : '#ff8f4d'} />)}
  </group>;
}

/** The stunt ramp: a wedge you hit at speed. */
export function RampProp({ world }: { world: MarsWorldData }) {
  return <group position={[RAMP.x, heightAt(world, RAMP.x, RAMP.z), RAMP.z]}>
    <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0.0]}><boxGeometry args={[6, 0.4, 7]} /><meshStandardMaterial color="#5b6ee1" flatShading /></mesh>
    <mesh position={[0, 0.9, -0.3]} rotation={[-0.32, 0, 0]}><boxGeometry args={[6, 0.35, 6.2]} /><meshStandardMaterial color="#ffc857" flatShading /></mesh>
    {[-1, 1].map(k => <mesh key={k} position={[k * 3, 0.9, -0.3]} rotation={[-0.32, 0, 0]}><boxGeometry args={[0.3, 0.7, 6.3]} /><meshStandardMaterial color="#ff7a59" flatShading /></mesh>)}
  </group>;
}
