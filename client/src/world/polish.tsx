import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useQuality } from './quality';

function findSun(scene: THREE.Scene): THREE.DirectionalLight | null {
  let found: THREE.DirectionalLight | null = null;
  scene.traverse(o => { if (!found && (o as THREE.DirectionalLight).isDirectionalLight) found = o as THREE.DirectionalLight; });
  return found;
}

/** Soft shadows that follow the camera, so the whole world gets shadows without a huge shadow map. Place it inside a Canvas, next to the sun. */
export function Polish() {
  const { gl, scene, camera } = useThree(), q = useQuality();
  const sun = useRef<THREE.DirectionalLight | null>(null), dir = useRef(new THREE.Vector3(0.5, 1, 0.3)), fwd = useRef(new THREE.Vector3()), tgt = useRef(new THREE.Vector3());
  useEffect(() => { gl.shadowMap.enabled = q !== 'low'; gl.shadowMap.type = THREE.PCFSoftShadowMap; }, [q, gl]);
  useEffect(() => {
    const on = q !== 'low';
    const mark = () => scene.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const mat = m.material as THREE.Material & { isMeshBasicMaterial?: boolean };
      if (Array.isArray(mat) || mat.isMeshBasicMaterial || (mat.transparent && mat.opacity < 0.6)) return;   // glows, halos and glass do not cast shadows
      m.castShadow = on; m.receiveShadow = on;
    });
    mark(); const id = setInterval(mark, 1500); return () => clearInterval(id);
  }, [q, scene]);
  useFrame(() => {
    if (q === 'low') return;
    if (!sun.current) {
      sun.current = findSun(scene); const l = sun.current; if (!l) return;
      dir.current.copy(l.position).normalize(); scene.add(l.target);
      l.castShadow = true; l.shadow.camera.left = -48; l.shadow.camera.right = 48; l.shadow.camera.top = 48; l.shadow.camera.bottom = -48; l.shadow.camera.near = 1; l.shadow.camera.far = 320;
      l.shadow.bias = -0.0006; l.shadow.normalBias = 0.05;
    }
    const l = sun.current; if (!l) return; l.shadow.mapSize.setScalar(q === 'high' ? 2048 : 1024);
    camera.getWorldDirection(fwd.current);
    tgt.current.copy(camera.position).addScaledVector(fwd.current, 24); tgt.current.x = Math.round(tgt.current.x / 2) * 2; tgt.current.z = Math.round(tgt.current.z / 2) * 2; tgt.current.y = Math.round(tgt.current.y / 2) * 2;
    l.target.position.copy(tgt.current); l.position.copy(tgt.current).addScaledVector(dir.current, 110);
  });
  return null;
}
