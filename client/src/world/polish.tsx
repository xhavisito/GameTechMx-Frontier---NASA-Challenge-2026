import { useEffect, useMemo, useRef } from 'react';
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

/** Soft dust puffs kicked up behind a moving vehicle (reads its speed from how far it moved). */
export function VehicleDust({ target, color = '#d9a074', y = 0.15 }: { target: { current: THREE.Object3D | null }; color?: string; y?: number }) {
  const N = 28, ref = useRef<THREE.InstancedMesh>(null);
  const st = useRef({ i: 0, last: new THREE.Vector3(), has: false, life: new Float32Array(N), vel: new Float32Array(N * 3), pos: new Float32Array(N * 3), acc: 0 });
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = ref.current, t = target.current; if (!m || !t || dt <= 0) return;
    const s = st.current, p = t.position, mx = p.x - s.last.x, mz = p.z - s.last.z, step = s.has ? Math.hypot(mx, mz) : 0, sp = step / Math.min(dt, 0.1);
    s.acc += dt;
    if (sp > 2 && s.acc > 0.06) {
      s.acc = 0; const k = s.i++ % N, back = 1.4;
      const hx = mx / (step || 1), hz = mz / (step || 1);
      s.pos[k * 3] = p.x - hx * back + (Math.random() - 0.5) * 0.8; s.pos[k * 3 + 1] = p.y + y; s.pos[k * 3 + 2] = p.z - hz * back + (Math.random() - 0.5) * 0.8;
      s.vel[k * 3] = (Math.random() - 0.5) * 0.6; s.vel[k * 3 + 1] = 0.5 + Math.random() * 0.5; s.vel[k * 3 + 2] = (Math.random() - 0.5) * 0.6; s.life[k] = 1;
    }
    s.last.copy(p); s.has = true;
    for (let k = 0; k < N; k++) {
      s.life[k] = Math.max(0, s.life[k] - dt * 1.4);
      for (let a = 0; a < 3; a++) s.pos[k * 3 + a] += s.vel[k * 3 + a] * dt;
      const l = s.life[k], sc = l > 0 ? 0.25 + (1 - l) * 0.7 : 0;
      d.position.set(s.pos[k * 3], s.pos[k * 3 + 1], s.pos[k * 3 + 2]); d.scale.setScalar(sc * Math.min(1, l * 3)); d.updateMatrix(); m.setMatrixAt(k, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color={color} transparent opacity={0.45} depthWrite={false} /></instancedMesh>;
}
