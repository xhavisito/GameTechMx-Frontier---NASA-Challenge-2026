import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const base = () => `${import.meta.env.BASE_URL}models/`;
export const ROVER_URL = () => `${base()}rover.glb`;
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

/** The rover from the team's CAD assembly. Origin at the wheels' base, forward = +z, ~2.5 m long. */
export function RoverGLB({ radar = false, spectrometer = false }: { radar?: boolean; spectrometer?: boolean }) {
  const root = useStyled(ROVER_URL());
  return <group>
    <primitive object={root} />
    {radar && <mesh position={[0, 1.55, -0.6]} rotation={[0.5, 0, 0]}><cylinderGeometry args={[0.4, 0.06, 0.3, 8]} /><meshStandardMaterial color="#7fdcff" flatShading /></mesh>}
    {spectrometer && <mesh position={[0, 0.45, 1.3]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.5, 6]} /><meshStandardMaterial color="#b39ddb" flatShading /></mesh>}
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.9, 8]} /><meshBasicMaterial color="#1b1230" transparent opacity={0.22} /></mesh>
  </group>;
}

/** The submarine from the team's CAD model. Origin at the hull axis, forward = +z, ~6 m long. */
export function SubGLB() {
  const root = useStyled(SUB_URL());
  return <primitive object={root} />;
}

export const preloadModels = () => { useGLTF.preload(ROVER_URL()); useGLTF.preload(SUB_URL()); };
