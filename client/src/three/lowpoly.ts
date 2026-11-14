import * as THREE from 'three';
import { fbm2 } from './noise';

export type BodyKind = 'earth' | 'moon' | 'mars';
const PALETTE: Record<BodyKind, { low: string; mid: string; high: string; extra?: string }> = {
  earth: { low: '#2f7fd6', mid: '#58b368', high: '#e8d9a0', extra: '#ffffff' },
  moon: { low: '#8b8798', mid: '#b3afc0', high: '#d8d4e2' },
  mars: { low: '#a94b33', mid: '#d9714a', high: '#f0a56b', extra: '#fff1e0' },
};

/** Flat-shaded icosphere whose faces carry one color each: continents, craters, ice caps. */
export function lowPolyBodyGeometry(kind: BodyKind, radius = 1, detail = 3): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail).toNonIndexed();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const p = PALETTE[kind];
  const c = new THREE.Color(), tri = new THREE.Vector3();
  const lowC = new THREE.Color(p.low), midC = new THREE.Color(p.mid), highC = new THREE.Color(p.high), extraC = new THREE.Color(p.extra ?? p.high);
  for (let i = 0; i < pos.count; i += 3) {
    tri.set(0, 0, 0);
    for (let k = 0; k < 3; k++) tri.add(new THREE.Vector3().fromBufferAttribute(pos, i + k));
    tri.divideScalar(3).normalize();
    const n = fbm2(7, tri.x * 2.2 + 5, tri.y * 2.2 + tri.z * 1.7 + 9, 4);
    const lat = Math.abs(tri.y);
    if (kind === 'earth') c.copy(n > 0.5 ? (n > 0.64 ? highC : midC) : lowC);
    else c.copy(n > 0.56 ? highC : n > 0.42 ? midC : lowC);
    if (lat > (kind === 'earth' ? 0.86 : 0.9)) c.copy(extraC);
    const shade = 0.94 + 0.12 * ((i / 3) % 3) / 2;
    c.multiplyScalar(shade);
    for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = c.r; colors[(i + k) * 3 + 1] = c.g; colors[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
