import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { InstrumentShape, PartStatus, ShipSpec } from './spacecraftModel';

/** Visual state the flight scene pushes into the ship; all optional for the hangar. */
export interface ShipFx {
  deploy?: number;          // 0 folded (in fairing) → 1 fully deployed
  feather?: boolean;        // solar storm safe mode: panels edge-on, shield up
  shield?: boolean;
  wobble?: number;          // attitude problem amplitude
  engine?: number;          // main engine thrust 0–1
  rcs?: boolean;            // attitude thruster puffs
  lights?: number;          // avionics LED level 0–1 (battery)
  storage?: number;         // recorder fill 0–1
  transmitting?: boolean;
  scanning?: boolean;
  damage?: number;          // 0 healthy → 1 dead
  sparks?: number;          // timestamp (clock seconds) of the last hit, or -1
  planetDistance?: number;  // for beams toward +Z
}

const C = { gold: '#d6a63a', foil: '#b98b2c', white: '#e6ecf2', alu: '#9aa7b4', dark: '#0d1219', cell: '#173f78', cyan: '#ffc857', orange: '#ff9f5b', red: '#ff4d5e', green: '#62dda5' };
const statusColor: Record<PartStatus, string> = { ok: '#000000', warn: C.orange, bad: C.red };

/** Standard material that glows when its part has a problem (pulsing when it blocks launch). */
function StatusMaterial({ status = 'ok', color, metalness = 0.45, roughness = 0.45, side, emissive, emissiveIntensity = 0 }: { status?: PartStatus; color: string; metalness?: number; roughness?: number; side?: THREE.Side; emissive?: string; emissiveIntensity?: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = ref.current; if (!m) return;
    if (status === 'ok') { m.emissive.set(emissive ?? '#000000'); m.emissiveIntensity = emissiveIntensity; return; }
    m.emissive.set(statusColor[status]);
    m.emissiveIntensity = status === 'bad' ? 0.45 + 0.4 * Math.sin(clock.elapsedTime * 6) : 0.3;
  });
  return <meshStandardMaterial ref={ref} color={color} metalness={metalness} roughness={roughness} side={side} />;
}

/** Wraps a sub-assembly: pops and flashes a ring whenever its design changes. */
function Part({ watch, children, position, label }: { watch: string; children: ReactNode; position?: [number, number, number]; label?: { status: PartStatus; text: string } | null }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const changed = useRef(-10);
  const first = useRef(true);
  const { clock } = useThree();
  useEffect(() => {
    if (first.current) { first.current = false; if (clock.elapsedTime < 1) return; }
    changed.current = clock.elapsedTime;
  }, [watch, clock]);
  useFrame(({ clock }) => {
    const age = clock.elapsedTime - changed.current;
    const k = age >= 0 && age < 0.7 ? age / 0.7 : 1;
    group.current?.scale.setScalar(k < 1 ? 1 + 0.3 * Math.sin(k * Math.PI) * (1 - k) : 1);
    if (ring.current) {
      ring.current.visible = k < 1;
      ring.current.scale.setScalar(0.4 + k * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
  });
  return <group position={position}>
    <group ref={group}>{children}</group>
    <mesh ref={ring} visible={false} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.025, 8, 48]} /><meshBasicMaterial color={C.cyan} transparent depthWrite={false} /></mesh>
  </group>;
}

function dish(radius: number) {
  const pts = Array.from({ length: 14 }, (_, i) => { const x = (radius * i) / 13; return new THREE.Vector2(x, (x * x) / (2.2 * radius)); });
  return new THREE.LatheGeometry(pts, 40);
}

function Dish({ radius, status = 'ok', color = C.white }: { radius: number; status?: PartStatus; color?: string }) {
  const geo = useMemo(() => dish(radius), [radius]);
  return <group>
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}><StatusMaterial status={status} color={color} metalness={0.3} roughness={0.35} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0, radius * 0.55]}><cylinderGeometry args={[0.015, 0.015, radius * 1.1]} /><meshStandardMaterial color={C.alu} /></mesh>
    <mesh position={[0, 0, radius * 0.6]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[radius * 0.08, radius * 0.18, 12]} /><meshStandardMaterial color={C.dark} /></mesh>
  </group>;
}

function Lens({ radius, glow }: { radius: number; glow: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  return <mesh rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[radius, 24]} /><meshStandardMaterial ref={glow} color="#05080c" metalness={0.9} roughness={0.08} emissive={C.cyan} emissiveIntensity={0} /></mesh>;
}

function Instrument({ shape, size, status, scanning, index }: { shape: InstrumentShape; size: number; status: PartStatus; scanning: boolean; index: number }) {
  const lens = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (lens.current) lens.current.emissiveIntensity = scanning ? 0.6 + 0.5 * Math.sin(clock.elapsedTime * 4 + index) : 0.05; });
  const s = size;
  switch (shape) {
    case 'camera': return <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, s * 0.3]}><cylinderGeometry args={[s * 0.3, s * 0.34, s * 0.6, 24]} /><StatusMaterial status={status} color={C.dark} metalness={0.7} /></mesh>
      <group position={[0, 0, s * 0.61]}><Lens radius={s * 0.24} glow={lens} /></group></group>;
    case 'wide-camera': return <group>
      <mesh position={[0, 0, s * 0.22]}><boxGeometry args={[s * 0.9, s * 0.5, s * 0.44]} /><StatusMaterial status={status} color={C.white} /></mesh>
      {[-0.28, 0, 0.28].map((x, i) => <group key={i} position={[x * s, 0, s * 0.45]}><Lens radius={s * 0.1} glow={i === 1 ? lens : { current: null }} /></group>)}</group>;
    case 'imager': return <group>
      <mesh position={[0, 0, s * 0.3]}><boxGeometry args={[s * 0.8, s * 0.8, s * 0.6]} /><StatusMaterial status={status} color={C.gold} metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, 0, s * 0.61]}><planeGeometry args={[s * 0.55, s * 0.18]} /><meshStandardMaterial ref={lens} color="#05080c" emissive={C.cyan} /></mesh></group>;
    case 'cooled-camera': return <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, s * 0.3]}><cylinderGeometry args={[s * 0.26, s * 0.26, s * 0.6, 20]} /><StatusMaterial status={status} color={C.white} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[0, 0, s * (0.1 + i * 0.13)]}><boxGeometry args={[s * 0.85, s * 0.04, s * 0.05]} /><meshStandardMaterial color={C.alu} metalness={0.8} /></mesh>)}
      <group position={[0, 0, s * 0.61]}><Lens radius={s * 0.2} glow={lens} /></group></group>;
    case 'spectrometer': return <group>
      <mesh position={[0, 0, s * 0.25]}><boxGeometry args={[s * 0.6, s * 0.6, s * 0.5]} /><StatusMaterial status={status} color="#6c5aa8" metalness={0.5} /></mesh>
      <mesh position={[0, 0, s * 0.51]}><planeGeometry args={[s * 0.06, s * 0.4]} /><meshStandardMaterial ref={lens} color="#05080c" emissive="#b48cff" /></mesh></group>;
    case 'lidar': return <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, s * 0.25]}><cylinderGeometry args={[s * 0.22, s * 0.22, s * 0.5, 20]} /><StatusMaterial status={status} color={C.alu} metalness={0.8} /></mesh>
      <mesh position={[0, 0, s * 0.51]}><circleGeometry args={[s * 0.12, 16]} /><meshStandardMaterial ref={lens} color="#200" emissive="#ff3344" /></mesh></group>;
    case 'detector': return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, s * 0.3]}><coneGeometry args={[s * 0.3, s * 0.6, 20, 1, true]} /><StatusMaterial status={status} color={C.gold} metalness={0.8} side={THREE.DoubleSide} /></mesh>;
    case 'small-dish': return <group position={[0, 0, s * 0.15]}><Dish radius={s * 0.45} status={status} /></group>;
    default: return null;
  }
}

/** Large payloads that mount outside the instrument deck. */
function ExternalPayload({ shape, size, status, bus, scanning }: { shape: InstrumentShape; size: number; status: PartStatus; bus: [number, number, number]; scanning: boolean }) {
  const lens = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (lens.current) lens.current.emissiveIntensity = scanning ? 0.5 + 0.4 * Math.sin(clock.elapsedTime * 3) : 0.05; });
  const [w, h, d] = bus;
  if (shape === 'radar') return <group position={[0, -h / 2 - 0.35, d * 0.1]}>
    {[-0.6, 0.6].map(x => <mesh key={x} position={[x * w * 0.4, 0.2, 0]}><boxGeometry args={[0.05, 0.4, 0.05]} /><meshStandardMaterial color={C.alu} /></mesh>)}
    <mesh rotation={[0.35, 0, 0]}><boxGeometry args={[size * 2.6, 0.06, 0.7]} /><StatusMaterial status={status} color="#2c3440" metalness={0.6} roughness={0.5} /></mesh>
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} rotation={[0.35, 0, 0]} position={[(i - 3.5) * size * 0.32, 0.035, 0]}><boxGeometry args={[size * 0.28, 0.01, 0.6]} /><meshStandardMaterial ref={i === 3 ? lens : undefined} color="#3e4c5c" emissive={C.cyan} emissiveIntensity={0} metalness={0.7} /></mesh>)}
  </group>;
  if (shape === 'telescope') return <group position={[0, h * 0.05, d / 2]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.8 * size]}><cylinderGeometry args={[0.42 * size, 0.42 * size, 1.6 * size, 32, 1, true]} /><StatusMaterial status={status} color={C.white} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0, 0.12]} rotation={[0, 0, Math.PI / 6]}><circleGeometry args={[0.4 * size, 6]} /><meshStandardMaterial ref={lens} color={C.gold} metalness={1} roughness={0.15} emissive={C.cyan} emissiveIntensity={0} /></mesh>
    <mesh position={[0, -0.15, -0.05]} rotation={[0.1, 0, Math.PI / 6]}><cylinderGeometry args={[1.5 * size, 1.5 * size, 0.02, 6]} /><meshStandardMaterial color="#c9b37a" metalness={0.9} roughness={0.25} transparent opacity={0.85} side={THREE.DoubleSide} /></mesh>
  </group>;
  if (shape === 'relay') return <group position={[w / 2 + 0.2, h * 0.15, d * 0.15]} rotation={[0, Math.PI / 2.6, 0]}><Dish radius={0.75 * size} status={status} color="#f0f3f6" /></group>;
  if (shape === 'boom') return <group position={[-w / 2, -h / 2, -d / 2]} rotation={[0, 0, -0.6]}>
    <mesh position={[0, -1.1, 0]}><cylinderGeometry args={[0.02, 0.02, 2.2]} /><StatusMaterial status={status} color={C.alu} metalness={0.8} /></mesh>
    <mesh position={[0, -2.25, 0]}><sphereGeometry args={[0.08, 16, 12]} /><meshStandardMaterial ref={lens} color={C.white} emissive={C.cyan} /></mesh>
  </group>;
  return null;
}

const EXTERNAL: InstrumentShape[] = ['radar', 'telescope', 'relay', 'boom'];

function SolarWing({ span, width, side, offsetZ, status, deploy, feather, dim }: { span: number; width: number; side: 1 | -1; offsetZ: number; status: PartStatus; deploy: number; feather: boolean; dim: number }) {
  const ref = useRef<THREE.Group>(null);
  const tilt = useRef(0);
  const panels = Math.max(2, Math.round(span / 0.55));
  const pw = span / panels;
  useFrame((_, dt) => {
    tilt.current += ((feather ? Math.PI / 2 : 0) - tilt.current) * Math.min(1, dt * 2);
    if (ref.current) { ref.current.rotation.x = tilt.current; ref.current.scale.x = Math.max(0.02, deploy); }
  });
  return <group position={[0, 0, offsetZ]} scale={[side, 1, 1]}>
    <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 0.5]} /><meshStandardMaterial color={C.alu} metalness={0.8} /></mesh>
    <group ref={ref} position={[0.5, 0, 0]}>
      {Array.from({ length: panels }, (_, i) => <mesh key={i} position={[pw * i + pw / 2, 0, 0]}>
        <boxGeometry args={[pw * 0.96, 0.025, width]} />
        <StatusMaterial status={status} color={C.cell} metalness={0.6} roughness={0.25} emissive="#0a2a66" emissiveIntensity={0.25 * dim} />
      </mesh>)}
      <mesh position={[span / 2, 0.016, 0]}><boxGeometry args={[span, 0.004, 0.012]} /><meshStandardMaterial color={C.alu} /></mesh>
    </group>
  </group>;
}

function Leds({ count, level, color, blink = 0 }: { count: number; level: number; color: string; blink?: number }) {
  const refs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const on = i / count < level;
      const flicker = blink ? (Math.sin(clock.elapsedTime * 23 + i * 3) > 0.6 - blink ? 0.2 : 1) : 1;
      m.emissiveIntensity = on ? 1.6 * flicker : 0.05;
    });
  });
  return <>{Array.from({ length: count }, (_, i) => <mesh key={i} position={[0, (i - (count - 1) / 2) * 0.07, 0]}><boxGeometry args={[0.012, 0.045, 0.045]} /><meshStandardMaterial ref={el => { refs.current[i] = el; }} color="#111" emissive={color} /></mesh>)}</>;
}

function Flame({ size, level }: { size: number; level: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.visible = level > 0.02;
    const f = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 40) + 0.1 * Math.sin(clock.elapsedTime * 17);
    ref.current.scale.set(level * f, level * (1.2 + f), level * f);
  });
  return <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -size * 1.3]}>
    <coneGeometry args={[size * 0.7, size * 3, 16, 1, true]} />
    <meshBasicMaterial color="#ffb26b" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}

function Sparks({ at, origin = [0, 0, 0] }: { at: number; origin?: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const dirs = useMemo(() => Array.from({ length: 18 }, (_, i) => new THREE.Vector3(Math.sin(i * 2.4) * Math.cos(i), Math.cos(i * 1.7), Math.sin(i * 0.9)).normalize()), []);
  useFrame(({ clock }) => {
    const g = group.current; if (!g) return;
    const age = clock.elapsedTime - at;
    g.visible = at > 0 && age >= 0 && age < 1.2;
    g.children.forEach((c, i) => { c.position.copy(dirs[i]!).multiplyScalar(age * 2.2); c.scale.setScalar(Math.max(0.01, 1 - age)); });
  });
  return <group ref={group} position={origin}>{dirs.map((_, i) => <mesh key={i}><sphereGeometry args={[0.04, 6, 4]} /><meshBasicMaterial color={i % 3 ? '#ffd27a' : '#ff6a3d'} /></mesh>)}</group>;
}

/** Pulses travelling toward the planet (+Z): data downlink or instrument scanning. */
function Beam({ length, color, active, kind }: { length: number; color: string; active: boolean; kind: 'pulses' | 'cone' }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current; if (!g) return;
    g.visible = active;
    if (kind === 'pulses') g.children.forEach((c, i) => { const p = ((clock.elapsedTime * 0.8 + i / 4) % 1); c.position.z = p * length; c.scale.setScalar(1 - p * 0.6); ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p); });
    else { const m = (g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial; m.opacity = 0.08 + 0.05 * Math.sin(clock.elapsedTime * 3); }
  });
  if (kind === 'cone') return <group ref={ref}><mesh position={[0, 0, length / 2]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[length * 0.22, length, 24, 1, true]} /><meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh></group>;
  return <group ref={ref}>{[0, 1, 2, 3].map(i => <mesh key={i}><torusGeometry args={[0.12, 0.02, 6, 24]} /><meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>)}</group>;
}

export interface Labels { mass: string; power: string; battery: string; data: string; storage: string; propulsion: string; launcher: string; orbit: string }

export function Spacecraft({ spec, fx = {}, labels, showLabels = false }: { spec: ShipSpec; fx?: ShipFx; labels?: Labels; showLabels?: boolean }) {
  const body = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  const [w, h, d] = spec.bus.size;
  const deploy = fx.deploy ?? 1;
  const damage = fx.damage ?? 0;
  const lights = (fx.lights ?? 1) * (1 - damage * 0.8);
  const L = (status: PartStatus, text?: string) => (showLabels && text ? { status, text } : null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const wob = fx.wobble ?? 0;
    if (body.current) { body.current.rotation.x = Math.sin(t * 2.3) * 0.12 * wob; body.current.rotation.z = Math.sin(t * 1.7 + 1) * 0.15 * wob; }
    if (beacon.current) beacon.current.opacity = damage > 0.5 ? (Math.sin(t * 8) > 0 ? 1 : 0.1) : 0;
  });

  const deck = spec.instruments.filter(i => !EXTERNAL.includes(i.shape));
  const cols = Math.max(1, Math.ceil(Math.sqrt(deck.length)));
  const rows = Math.max(1, Math.ceil(deck.length / cols));
  const cell = Math.min(w / cols, h / rows) * 0.92;
  const sig = (o: unknown) => JSON.stringify(o);

  return <group ref={body}>
    {/* Bus */}
    <Part watch={sig(spec.bus.size.map(n => n.toFixed(2)).concat(String(spec.bus.advanced)))} label={L(spec.bus.status, labels?.mass)}>
      <mesh castShadow><boxGeometry args={[w, h, d]} /><StatusMaterial status={spec.bus.status} color={spec.bus.advanced ? C.white : C.gold} metalness={spec.bus.advanced ? 0.35 : 0.85} roughness={spec.bus.advanced ? 0.5 : 0.28} /></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[0, (s * h) / 2, 0]}><boxGeometry args={[w * 1.02, 0.03, d * 1.02]} /><meshStandardMaterial color={C.alu} metalness={0.8} roughness={0.3} /></mesh>)}
    </Part>

    {/* Instrument deck (+Z faces the planet in flight) */}
    {deck.map((ins, i) => {
      const cx = (i % cols) - (cols - 1) / 2, cy = Math.floor(i / cols) - (rows - 1) / 2;
      return <Part key={ins.id} watch={ins.id + ins.status} position={[cx * (w / cols), -cy * (h / rows), d / 2]}>
        <Instrument shape={ins.shape} size={Math.min(cell, ins.size)} status={ins.status} scanning={!!fx.scanning} index={i} />
      </Part>;
    })}
    {spec.instruments.filter(i => EXTERNAL.includes(i.shape)).map(ins => <Part key={ins.id} watch={ins.id + ins.status}>
      <ExternalPayload shape={ins.shape} size={Math.min(1.3, ins.size)} status={ins.status} bus={spec.bus.size} scanning={!!fx.scanning} />
    </Part>)}

    {/* Power */}
    {spec.solar && <Part watch={sig(spec.solar)} label={L(spec.solar.status, labels?.power)} position={[0, h * 0.1, 0]}>
      {([1, -1] as const).flatMap(side => (spec.solar!.wings === 4 ? [-0.62, 0.62] : [0]).map(z => <group key={`${side}${z}`} position={[(side * w) / 2, 0, z * spec.solar!.width]}>
        <SolarWing span={spec.solar!.span} width={spec.solar!.width} side={side} offsetZ={0} status={spec.solar!.status} deploy={deploy} feather={!!fx.feather} dim={lights} />
      </group>))}
    </Part>}
    {spec.rtg && <Part watch={sig(spec.rtg)} label={spec.solar ? null : L(spec.rtg.status, labels?.power)} position={[-w / 2 - 0.1, -h / 2, -d / 2 - 0.1]}>
      {Array.from({ length: spec.rtg.count }, (_, i) => <group key={i} position={[-i * 0.45, 0, -0.35]} rotation={[0.5, 0, 0.9]}>
        <mesh><cylinderGeometry args={[0.13, 0.13, spec.rtg!.length, 16]} /><StatusMaterial status={spec.rtg!.status} color="#3a3f47" metalness={0.7} emissive="#ff6a2a" emissiveIntensity={0.25} /></mesh>
        {Array.from({ length: 6 }, (_, k) => <mesh key={k} rotation={[0, (k * Math.PI) / 3, 0]}><boxGeometry args={[0.42, spec.rtg!.length * 0.9, 0.015]} /><meshStandardMaterial color="#565d66" metalness={0.8} emissive="#ff5a1f" emissiveIntensity={0.12} /></mesh>)}
      </group>)}
    </Part>}

    {/* Avionics strip: battery (green), computer (cyan), recorder (amber) LEDs on the +X face */}
    <group position={[w / 2 + 0.006, -h * 0.25, 0]}>
      {spec.battery && <Part watch={sig(spec.battery)} label={L(spec.battery.status, labels?.battery)} position={[0, 0, -d * 0.25]}><Leds count={spec.battery.cells + 2} level={lights} color={spec.battery.status === 'ok' ? C.green : spec.battery.status === 'warn' ? C.orange : C.red} blink={fx.lights !== undefined && fx.lights < 0.6 ? 0.5 : 0} /></Part>}
      {spec.computer && <Part watch={sig(spec.computer)} position={[0, 0, 0]}><Leds count={spec.computer.advanced ? 5 : 3} level={lights > 0.1 ? 1 : 0} color={C.cyan} blink={0.3} /></Part>}
      {spec.storage && <Part watch={sig(spec.storage)} label={L(spec.storage.status, labels?.storage)} position={[0, 0, d * 0.25]}><Leds count={spec.storage.advanced ? 8 : 4} level={fx.storage ?? 0.3} color="#ffc35b" /></Part>}
    </group>

    {/* Communications on top */}
    {spec.antenna && <Part watch={sig(spec.antenna)} label={L(spec.antenna.status, labels?.data)} position={[w * 0.15, h / 2, 0]}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.03, 0.04, 0.4]} /><meshStandardMaterial color={C.alu} metalness={0.8} /></mesh>
      <group position={[0, 0.42, 0]} scale={Math.max(0.05, deploy)}>
        {spec.antenna.kind === 'uhf' ? [0, 1, 2, 3].map(i => <mesh key={i} rotation={[0.3 * Math.cos(i * Math.PI / 2), 0, 0.3 * Math.sin(i * Math.PI / 2)]} position={[0, 0.35, 0]}><cylinderGeometry args={[0.008, 0.008, 0.7]} /><StatusMaterial status={spec.antenna!.status} color={C.white} /></mesh>)
          : spec.antenna.kind === 'optical' ? <group rotation={[0.6, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.12]}><cylinderGeometry args={[0.13, 0.13, 0.32, 20]} /><StatusMaterial status={spec.antenna.status} color={C.white} /></mesh>
            <mesh position={[0, 0, 0.29]}><circleGeometry args={[0.1, 20]} /><meshStandardMaterial color="#021" emissive="#3dff8a" emissiveIntensity={fx.transmitting ? 2 : 0.2} /></mesh></group>
          : <group rotation={[0.7, 0, 0]}><Dish radius={spec.antenna.radius} status={spec.antenna.status} color={spec.antenna.kind === 'ka' ? '#f4f0e6' : C.white} /></group>}
      </group>
    </Part>}

    {/* Attitude control */}
    {spec.attitude && <Part watch={sig(spec.attitude)}>
      {spec.attitude.kind === 'magnetic' && [0, 1, 2].map(i => <mesh key={i} position={i === 0 ? [0, -h / 2 - 0.05, d * 0.3] : i === 1 ? [-w / 2 - 0.05, 0, d * 0.3] : [0, h * 0.3, -d / 2 - 0.05]} rotation={i === 0 ? [0, 0, Math.PI / 2] : i === 1 ? [0, 0, 0] : [Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, Math.min(w, h) * 0.7, 10]} /><meshStandardMaterial color="#b0552a" metalness={0.8} roughness={0.3} /></mesh>)}
      {spec.attitude.kind === 'wheels' && <group position={[-w / 2 - 0.02, h * 0.25, -d * 0.2]}>
        <SpinningWheels wobble={fx.wobble ?? 0} />
        {spec.attitude.advanced && <mesh position={[0, 0.35, 0.3]} rotation={[0.6, 0, 0.4]}><cylinderGeometry args={[0.07, 0.11, 0.25, 16, 1, true]} /><meshStandardMaterial color={C.dark} side={THREE.DoubleSide} /></mesh>}
      </group>}
      {spec.attitude.kind === 'thrusters' && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => <group key={i} position={[(sx! * w) / 2, (sy! * h) / 2, -d / 2]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.05, 0.12, 10, 1, true]} /><meshStandardMaterial color={C.alu} metalness={0.9} side={THREE.DoubleSide} /></mesh>
        <Puff active={!!fx.rcs} seed={i} />
      </group>)}
    </Part>}

    {/* Propulsion at the back (-Z) */}
    {spec.propulsion && <Part watch={sig(spec.propulsion)} label={L(spec.propulsion.status, labels?.propulsion)} position={[0, -h * 0.1, -d / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -spec.propulsion.nozzle * 0.6]}><cylinderGeometry args={[spec.propulsion.nozzle * 0.25, spec.propulsion.nozzle * 0.6, spec.propulsion.nozzle * 1.2, 24, 1, true]} /><StatusMaterial status={spec.propulsion.status} color="#4b4f57" metalness={0.9} roughness={0.25} side={THREE.DoubleSide} /></mesh>
      {Array.from({ length: spec.propulsion.tanks }, (_, i) => <mesh key={i} position={[(i - (spec.propulsion!.tanks - 1) / 2) * w * 0.45, h * 0.25, -0.05]}><sphereGeometry args={[Math.min(w, h) * 0.2, 20, 14]} /><meshStandardMaterial color="#c6ccd3" metalness={0.75} roughness={0.25} /></mesh>)}
      <Flame size={spec.propulsion.nozzle} level={fx.engine ?? 0} />
    </Part>}

    {/* Thermal radiator */}
    {spec.thermal && <Part watch={sig(spec.thermal)} position={[0, h / 2 + spec.thermal.radiator / 2 * 0.8, -d / 2 + 0.02]}>
      <mesh><boxGeometry args={[w * 0.8, spec.thermal.radiator * 0.8, 0.03]} /><meshStandardMaterial color="#f4f7fa" metalness={0.1} roughness={0.6} /></mesh>
      {spec.thermal.advanced && Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[0, (i - 2.5) * spec.thermal!.radiator * 0.12, 0.02]}><boxGeometry args={[w * 0.78, 0.01, 0.01]} /><meshStandardMaterial color="#8fb4d6" /></mesh>)}
    </Part>}

    {/* Flight effects */}
    <Beam length={(fx.planetDistance ?? 4) - 0.4} color="#ffc857" active={!!fx.transmitting && lights > 0.1} kind="pulses" />
    <Beam length={Math.min(3, (fx.planetDistance ?? 4) * 0.6)} color="#8fffd2" active={!!fx.scanning} kind="cone" />
    {fx.shield && <mesh><sphereGeometry args={[Math.max(w, h, d) * 1.4 + (spec.solar ? spec.solar.span * 0.6 : 0), 32, 24]} /><meshBasicMaterial color="#58b8ff" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>}
    {fx.sparks !== undefined && <Sparks at={fx.sparks} />}
    <mesh position={[0, h / 2 + 0.08, d * 0.35]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial ref={beacon} color="#ff2a3c" transparent opacity={0} /></mesh>
  </group>;
}

function SpinningWheels({ wobble }: { wobble: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => refs.current.forEach((m, i) => { if (m) m.rotation.y += dt * (i === 0 && wobble > 0.3 ? 0.4 : 6 + i); }));
  return <>{[0, 1, 2].map(i => <mesh key={i} ref={el => { refs.current[i] = el; }} position={[0, 0, (i - 1) * 0.22]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.09, 0.05, 20]} /><meshStandardMaterial color={i === 0 && wobble > 0.3 ? C.red : '#59616b'} metalness={0.9} roughness={0.2} /></mesh>)}</>;
}

function Puff({ active, seed }: { active: boolean; seed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = (clock.elapsedTime * 2 + seed * 0.37) % 1;
    ref.current.visible = active && Math.sin(clock.elapsedTime * 5 + seed * 2) > 0.2;
    ref.current.position.z = -0.1 - p * 0.5; ref.current.scale.setScalar(0.4 + p);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - p);
  });
  return <mesh ref={ref}><sphereGeometry args={[0.07, 8, 6]} /><meshBasicMaterial color="#dff6ff" transparent depthWrite={false} /></mesh>;
}
