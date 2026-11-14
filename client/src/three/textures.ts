import * as THREE from 'three';

/** Procedural, asset-free planet textures: seeded 3D value noise sampled on the sphere. */
function noise3D(seed: number) {
  const hash = (x: number, y: number, z: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
    return l(l(l(c(0,0,0), c(1,0,0), u), l(c(0,1,0), c(1,1,0), u), v), l(l(c(0,0,1), c(1,0,1), u), l(c(0,1,1), c(1,1,1), u), v), w) * 2 - 1;
  };
}

/** Fractal noise at the sphere point for texture coordinate (u, v): wraps seamlessly. */
function fbm(n: (x: number, y: number, z: number) => number, u: number, v: number, octaves: number, freq: number) {
  const lon = u * Math.PI * 2, lat = (0.5 - v) * Math.PI;
  const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
  let total = 0, amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const f = freq * 2 ** o;
    total += amp * n(x * f + 17.1 * o, y * f, z * f);
    norm += amp; amp *= 0.5;
  }
  return total / norm;
}

type Kind = 'earth' | 'moon' | 'mars' | 'clouds';
const cache = new Map<Kind, THREE.CanvasTexture>();

export function planetTexture(kind: Kind, size = 512): THREE.CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const w = size, h = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const n = noise3D(kind === 'earth' ? 7 : kind === 'moon' ? 21 : kind === 'mars' ? 42 : 99);
  for (let y = 0; y < h; y++) {
    const v = y / h, lat = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const e = fbm(n, u, v, 6, 1.8);
      let r = 0, g = 0, b = 0, a = 255;
      if (kind === 'earth') {
        const land = e + 0.02;
        if (lat > 0.86) { r = g = b = 235; }
        else if (land > 0.06) {
          const dry = Math.max(0, Math.min(1, fbm(n, u + 0.37, v, 3, 4) * 0.9 + 0.5 - Math.abs(lat - 0.3) * 0.8));
          const t = Math.min(1, (land - 0.06) * 4);
          r = 46 + dry * 120 + t * 25; g = 92 + dry * 45 - t * 10; b = 42 + dry * 20 + t * 10;
        } else {
          const depth = Math.min(1, -land * 3);
          r = 14 + 10 * (1 - depth); g = 60 + 50 * (1 - depth); b = 110 + 60 * (1 - depth);
        }
      } else if (kind === 'moon') {
        const c = 120 + e * 90 + fbm(n, u * 3, v * 3, 2, 6) * 30;
        const crater = Math.abs(fbm(n, u + 5, v, 2, 9));
        const k = crater < 0.04 ? 0.75 : 1;
        r = g = b = c * k; b += 4;
      } else if (kind === 'mars') {
        const c = e * 0.5 + 0.5;
        r = 150 + c * 70; g = 70 + c * 40; b = 40 + c * 20;
        if (lat > 0.88) { r = 235; g = 225; b = 220; }
      } else {
        const c = fbm(n, u, v, 5, 3);
        a = Math.max(0, Math.min(255, (c - 0.05) * 600 * (1 - lat * 0.4)));
        r = g = b = 255;
      }
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(kind, tex);
  return tex;
}
