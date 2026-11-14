import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const base = () => `${import.meta.env.BASE_URL}models/`;
export const SUB_URL = () => `${base()}sub.glb`;

/** Clone a CAD-derived mesh and give it the game's flat low-poly look. */
function useStyled(url: string) {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 }); m.castShadow = false; }
    });
    return root;
  }, [gltf]);
}

/** Bumped every time the player tries to grab something (hit or miss): the rover arm reaches out and closes its claw. */
export const arm = { pulse: 0 };
const GRAB = 1.35;
const sm = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

const CLAW = (() => { const g = new THREE.BoxGeometry(0.07, 0.42, 0.1); g.translate(0, 0.22, 0); return g; })();
const GREY = '#8d8f98', DARK = '#4a4a56', BLUE = '#6f9bc4', ORANGE = '#ff8f4d', HUB = '#b9bcc6';
const M = ({ c }: { c: string }) => <meshStandardMaterial color={c} flatShading roughness={0.9} />;
function Wheel({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0.42, z]} rotation={[0, 0, Math.PI / 2]}>
    <mesh><cylinderGeometry args={[0.42, 0.42, 0.34, 9]} /><M c={DARK} /></mesh>
    <mesh position={[0, x > 0 ? 0.18 : -0.18, 0]}><cylinderGeometry args={[0.26, 0.26, 0.04, 8]} /><M c={HUB} /></mesh>
  </group>;
}

/** Low-poly rover with a robotic arm. Origin at the wheels' base, forward = +z, ~2.2 m long. */
export function Rover({ radar = false, spectrometer = false }: { radar?: boolean; spectrometer?: boolean }) {
  const turret = useRef<THREE.Group>(null), sh = useRef<THREE.Group>(null), el = useRef<THREE.Group>(null), wr = useRef<THREE.Group>(null);
  const c1 = useRef<THREE.Mesh>(null), c2 = useRef<THREE.Mesh>(null);
  const seen = useRef(arm.pulse), t = useRef(-1);
  useFrame((_, dt) => {
    if (arm.pulse !== seen.current) { seen.current = arm.pulse; t.current = 0; }
    if (t.current >= 0) { t.current += dt; if (t.current > GRAB) t.current = -1; }
    const k = t.current < 0 ? 0 : t.current / GRAB;
    // reach out (0-.3), open claw, hold, close (.55-.7), pull back (.72-1)
    const reach = sm(k / 0.3) * (1 - sm((k - 0.72) / 0.28));
    const open = sm((k - 0.15) / 0.15) * (1 - sm((k - 0.55) / 0.15));
    const wob = k > 0.3 && k < 0.72 ? Math.sin((k - 0.3) * 30) * 0.05 : 0;
    if (sh.current) sh.current.rotation.x = mix(0.45, 1.15, reach);
    if (el.current) el.current.rotation.x = mix(1.55, 1.15 + wob, reach);
    if (wr.current) wr.current.rotation.x = mix(0.4, 1.0, reach);
    if (turret.current) turret.current.rotation.y = Math.sin(k * Math.PI * 2) * 0.32 * (k > 0 ? 1 : 0);
    const a = 0.12 + open * 0.55;
    if (c1.current) c1.current.rotation.z = a;
    if (c2.current) c2.current.rotation.z = -a;
  });
  return <group>
    {/* body: blue front half, orange back half, grey fan panel on the sides */}
    <mesh position={[0, 1.3, 0.28]}><boxGeometry args={[1.2, 0.85, 0.6]} /><M c={BLUE} /></mesh>
    <mesh position={[0, 1.3, -0.32]}><boxGeometry args={[1.2, 0.85, 0.6]} /><M c={ORANGE} /></mesh>
    {[-1, 1].map(s => <group key={s} position={[s * 0.61, 1.3, 0.45]} rotation={[0, (s * Math.PI) / 2, 0]}>
      <mesh><boxGeometry args={[0.55, 0.55, 0.05]} /><M c={GREY} /></mesh>
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.04, 8]} /><M c={DARK} /></mesh>
    </group>)}
    {/* rocker frame and axles */}
    {[-1, 1].map(s => <group key={s}>
      <mesh position={[s * 0.82, 0.95, 0]}><boxGeometry args={[0.12, 0.12, 1.9]} /><M c={GREY} /></mesh>
      <mesh position={[s * 0.72, 1.1, 0.7]} rotation={[0, 0, s * 0.2]}><boxGeometry args={[0.12, 0.5, 0.12]} /><M c={GREY} /></mesh>
      <mesh position={[s * 0.72, 1.1, -0.7]} rotation={[0, 0, s * 0.2]}><boxGeometry args={[0.12, 0.5, 0.12]} /><M c={GREY} /></mesh>
      {[-0.85, 0, 0.85].map(z => <group key={z}>
        <mesh position={[s * 0.88, 0.68, z]}><boxGeometry args={[0.1, 0.6, 0.1]} /><M c={GREY} /></mesh>
        <Wheel x={s * 1.02} z={z} />
      </group>)}
    </group>)}
    {/* arm */}
    <group ref={turret} position={[0, 1.75, -0.05]}>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.3, 0.34, 0.3, 8]} /><M c={GREY} /></mesh>
      <group ref={sh} position={[0, 0.3, 0]} rotation={[0.45, 0, 0]}>
        <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.2, 1.0, 0.24]} /><M c={GREY} /></mesh>
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.16, 0.16, 0.34, 7]} /><M c={DARK} /></mesh>
        <group ref={el} position={[0, 1.0, 0]} rotation={[1.55, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.14, 0.14, 0.32, 7]} /><M c={DARK} /></mesh>
          <mesh position={[0, 0.45, 0]}><boxGeometry args={[0.17, 0.9, 0.2]} /><M c={GREY} /></mesh>
          <group ref={wr} position={[0, 0.9, 0]} rotation={[0.4, 0, 0]}>
            <mesh><boxGeometry args={[0.24, 0.2, 0.24]} /><M c={DARK} /></mesh>
            <mesh ref={c1} position={[0.0, 0.0, 0]} rotation={[0, 0, 0.12]} geometry={CLAW}><M c={GREY} /></mesh>
            <mesh ref={c2} position={[0.0, 0.0, 0]} rotation={[0, 0, -0.12]} geometry={CLAW}><M c={GREY} /></mesh>
          </group>
        </group>
      </group>
    </group>
    {radar && <mesh position={[0, 1.95, -0.5]} rotation={[0.5, 0, 0]}><cylinderGeometry args={[0.4, 0.06, 0.3, 8]} /><meshStandardMaterial color="#7fdcff" flatShading /></mesh>}
    {spectrometer && <mesh position={[0, 0.95, 0.95]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.5, 6]} /><meshStandardMaterial color="#b39ddb" flatShading /></mesh>}
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.9, 8]} /><meshBasicMaterial color="#1b1230" transparent opacity={0.22} /></mesh>
  </group>;
}

/** The submarine from the team's CAD model. Origin at the hull axis, forward = +z, ~6 m long. */
export function SubGLB() {
  const root = useStyled(SUB_URL());
  return <primitive object={root} />;
}

export const preloadModels = () => { useGLTF.preload(SUB_URL()); };
