import { Html, Line, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MissionDesign, MissionTimeline } from '../../../shared/types';
import { cameraAxes, cameraImpulse } from '../input/inputStore';
import { Spacecraft, type Labels, type ShipFx } from './Spacecraft';
import { buildShipSpec, flightStateAt, orbitShapes, type FlightState, type OrbitShape, type ShipSpec } from './spacecraftModel';
import { planetTexture } from './textures';

export type SceneMode = 'hangar' | 'launcher' | 'orbit' | 'flight' | 'showcase';

export interface MissionSceneProps {
  mode: SceneMode;
  design: MissionDesign;
  timeline?: MissionTimeline | null;
  day?: number;
  /** Launch cinematic progress (0–1) while the clock sits on day 0. */
  ascent?: number;
  labels: Labels;
  reducedMotion?: boolean;
  onFlightState?: (state: FlightState) => void;
}

const SHIP_SCALE = 0.07;
const SUN_DIR = new THREE.Vector3(5, 1.6, 3).normalize();
const tmp = new THREE.Vector3();

/** Position on the illustrative orbit: ellipse with focus at the body, tilted by inclination. */
function orbitPoint(shape: OrbitShape, theta: number, out = new THREE.Vector3()) {
  const a = shape.radius, e = shape.eccentricity;
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(theta));
  out.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
  out.applyAxisAngle(new THREE.Vector3(1, 0, 0), shape.inclination * 0.5);
  return out;
}

function orbitLine(shape: OrbitShape) {
  return Array.from({ length: 161 }, (_, i) => orbitPoint(shape, (i / 160) * Math.PI * 2).clone());
}

// ── Bodies ───────────────────────────────────────────────────────────────────
function Planet({ kind, radius = 1, stations = 0, spin = 0.04, aurora = 0 }: { kind: 'earth' | 'moon' | 'mars'; radius?: number; stations?: number; spin?: number; aurora?: number }) {
  const group = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const map = useMemo(() => planetTexture(kind), [kind]);
  const cloudMap = useMemo(() => (kind === 'earth' ? planetTexture('clouds') : null), [kind]);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * spin;
    if (clouds.current) clouds.current.rotation.y += dt * spin * 0.35;
    if (glow.current) { glow.current.color.set(aurora > 0 ? '#7dffb2' : kind === 'mars' ? '#ffb38a' : '#6cc8ff'); glow.current.opacity = (kind === 'moon' ? 0 : 0.22) + aurora * 0.3; }
  });
  const atmosphere = kind !== 'moon';
  return <group>
    <group ref={group}>
      <mesh receiveShadow><sphereGeometry args={[radius, 96, 64]} /><meshStandardMaterial map={map} roughness={kind === 'earth' ? 0.75 : 0.95} metalness={0} /></mesh>
      {Array.from({ length: stations }, (_, i) => {
        const lat = [0.35, -0.5, 0.75][i]!, lon = [0.4, 2.6, 4.4][i]!;
        const p = new THREE.Vector3().setFromSphericalCoords(radius * 1.005, Math.PI / 2 - lat, lon);
        return <group key={i} position={p} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize())}>
          <mesh position={[0, 0.02, 0]}><coneGeometry args={[0.02, 0.05, 8]} /><meshBasicMaterial color="#5be4e8" /></mesh>
          <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.03, 0.045, 24]} /><meshBasicMaterial color="#5be4e8" transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>
        </group>;
      })}
    </group>
    {cloudMap && <mesh ref={clouds}><sphereGeometry args={[radius * 1.012, 64, 48]} /><meshStandardMaterial map={cloudMap} transparent depthWrite={false} opacity={0.8} /></mesh>}
    {atmosphere && <mesh scale={1.08}><sphereGeometry args={[radius, 48, 32]} /><meshBasicMaterial ref={glow} color="#6cc8ff" transparent opacity={0.22} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>}
  </group>;
}

function Sun() {
  const p = SUN_DIR.clone().multiplyScalar(70);
  return <group position={p}>
    <mesh><sphereGeometry args={[2.2, 24, 16]} /><meshBasicMaterial color="#fff3c4" /></mesh>
    <mesh><sphereGeometry args={[4.5, 24, 16]} /><meshBasicMaterial color="#ffbf5e" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
  </group>;
}

// ── Rocket ───────────────────────────────────────────────────────────────────
function Rocket({ spec, thrust = 0, transparentFairing = false, ship }: { spec: ShipSpec; thrust?: number; transparentFairing?: boolean; ship?: React.ReactNode }) {
  const { height: H, width: W, boosters, status } = spec.launcher;
  const flame = useRef<THREE.Group>(null);
  const fairing = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (flame.current) { flame.current.visible = thrust > 0.01; const f = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 45); flame.current.scale.set(thrust * f, thrust * (1 + f), thrust * f); }
    if (fairing.current) fairing.current.emissiveIntensity = status === 'bad' ? 0.4 + 0.35 * Math.sin(clock.elapsedTime * 6) : status === 'warn' ? 0.3 : 0;
  });
  const stageH = H * 0.62, upperH = H * 0.2, fairH = H * 0.18;
  const shipFit = ship ? (W * 0.8) / Math.max(...spec.bus.size, 0.01) : 1;
  return <group>
    <mesh position={[0, stageH / 2, 0]}><cylinderGeometry args={[W / 2, W / 2, stageH, 32]} /><meshStandardMaterial color="#e9eef3" metalness={0.3} roughness={0.5} /></mesh>
    <mesh position={[0, stageH * 0.85, 0]}><cylinderGeometry args={[W / 2 + 0.005, W / 2 + 0.005, stageH * 0.05, 32]} /><meshStandardMaterial color="#1b2633" /></mesh>
    <mesh position={[0, stageH + upperH / 2, 0]}><cylinderGeometry args={[W / 2 * 0.95, W / 2, upperH, 32]} /><meshStandardMaterial color="#d8dee5" metalness={0.3} roughness={0.5} /></mesh>
    <group position={[0, stageH + upperH, 0]}>
      <mesh position={[0, fairH * 0.35, 0]}><cylinderGeometry args={[W / 2 * 1.08, W / 2 * 0.95, fairH * 0.7, 32, 1, transparentFairing]} /><meshStandardMaterial ref={fairing} color="#f6f8fb" emissive="#ff4d5e" transparent={transparentFairing} opacity={transparentFairing ? 0.28 : 1} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, fairH * 0.7 + fairH * 0.3, 0]}><coneGeometry args={[W / 2 * 1.08, fairH * 0.6, 32, 1, transparentFairing]} /><meshStandardMaterial color="#f6f8fb" transparent={transparentFairing} opacity={transparentFairing ? 0.28 : 1} side={THREE.DoubleSide} /></mesh>
      {ship && <group position={[0, fairH * 0.4, 0]} scale={shipFit}>{ship}</group>}
    </group>
    {[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * W * 0.55, H * 0.06, Math.sin(i * Math.PI / 2) * W * 0.55]} rotation={[0, -i * Math.PI / 2, 0]}><boxGeometry args={[W * 0.35, H * 0.1, 0.03]} /><meshStandardMaterial color="#1b2633" /></mesh>)}
    {Array.from({ length: boosters }, (_, i) => { const a = (i / boosters) * Math.PI * 2 + Math.PI / 4; return <group key={i} position={[Math.cos(a) * W * 0.78, 0, Math.sin(a) * W * 0.78]}>
      <mesh position={[0, H * 0.22, 0]}><cylinderGeometry args={[W * 0.2, W * 0.2, H * 0.44, 20]} /><meshStandardMaterial color="#f0f2f5" /></mesh>
      <mesh position={[0, H * 0.47, 0]}><coneGeometry args={[W * 0.2, H * 0.06, 20]} /><meshStandardMaterial color="#f0f2f5" /></mesh>
    </group>; })}
    <group ref={flame} position={[0, -0.02, 0]}>
      <mesh position={[0, -H * 0.18, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[W * 0.45, H * 0.36, 20, 1, true]} /><meshBasicMaterial color="#ffb05e" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -H * 0.1, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[W * 0.25, H * 0.2, 16, 1, true]} /><meshBasicMaterial color="#fff1c9" transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
  </group>;
}

// ── Camera rig: one model for keyboard, gamepad, mouse and touch ─────────────
interface CamDefaults { yaw: number; pitch: number; dist: number; min: number; max: number; auto?: number }

function CameraRig({ defaults, target, resetKey, reducedMotion }: { defaults: CamDefaults; target: React.RefObject<THREE.Vector3>; resetKey: string; reducedMotion?: boolean }) {
  const { camera } = useThree();
  const s = useRef({ yaw: defaults.yaw, pitch: defaults.pitch, dist: defaults.dist, look: new THREE.Vector3(), seen: cameraImpulse.reset, idle: 0, first: true });
  useEffect(() => { Object.assign(s.current, { yaw: defaults.yaw, pitch: defaults.pitch, dist: defaults.dist }); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = s.current;
    if (cameraImpulse.reset !== st.seen) { st.seen = cameraImpulse.reset; Object.assign(st, { yaw: defaults.yaw, pitch: defaults.pitch, dist: defaults.dist }); }
    const moved = cameraAxes.yaw || cameraAxes.pitch || cameraAxes.zoom || cameraImpulse.yaw || cameraImpulse.pitch || cameraImpulse.zoom;
    st.yaw += cameraAxes.yaw * dt * 1.9 + cameraImpulse.yaw;
    st.pitch += cameraAxes.pitch * dt * 1.4 + cameraImpulse.pitch;
    st.dist *= Math.exp(cameraAxes.zoom * dt * 1.6 + cameraImpulse.zoom);
    cameraImpulse.yaw = cameraImpulse.pitch = cameraImpulse.zoom = 0;
    st.idle = moved ? 0 : st.idle + dt;
    if (!reducedMotion && defaults.auto && st.idle > 3) st.yaw += dt * defaults.auto;
    st.pitch = Math.max(-1.4, Math.min(1.4, st.pitch));
    st.dist = Math.max(defaults.min, Math.min(defaults.max, st.dist));
    const goal = target.current ?? tmp.set(0, 0, 0);
    if (st.first) { st.look.copy(goal); st.first = false; } else st.look.lerp(goal, Math.min(1, dt * 4));
    camera.position.set(
      st.look.x + st.dist * Math.cos(st.pitch) * Math.sin(st.yaw),
      st.look.y + st.dist * Math.sin(st.pitch),
      st.look.z + st.dist * Math.cos(st.pitch) * Math.cos(st.yaw),
    );
    camera.lookAt(st.look);
  });
  return null;
}

// ── Hangar: the assembly bay where design changes appear instantly ───────────
function Hangar({ spec, labels, launcherView }: { spec: ShipSpec; labels: Labels; launcherView: boolean }) {
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const color = spec.readiness === 'ok' ? '#5be4e8' : spec.readiness === 'warn' ? '#ff9f5b' : '#ff4d5e';
  useFrame(({ clock }) => { if (ring.current) ring.current.opacity = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 2); });
  const floor = launcherView ? 0 : -spec.bus.size[1] / 2 - 1.4;
  const ship = <Spacecraft spec={spec} labels={labels} showLabels={!launcherView} fx={{ deploy: launcherView ? 0.05 : 1, lights: 1, storage: 0.4 }} />;
  return <group>
    <group position={[0, floor, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[4.2, 64]} /><meshStandardMaterial color="#0b1622" metalness={0.6} roughness={0.5} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[3.9, 4.05, 96]} /><meshBasicMaterial ref={ring} color={color} transparent /></mesh>
      <gridHelper args={[8, 16, '#1d3447', '#132433']} position={[0, 0.005, 0]} />
    </group>
    {launcherView ? <group>
      <Rocket spec={spec} transparentFairing ship={ship} />
      <Html position={[spec.launcher.width * 1.4, spec.launcher.height * 0.95, 0]} distanceFactor={6} style={{ pointerEvents: 'none' }}>
        <span className={`part-alert ${spec.launcher.status}`}>{spec.launcher.status === 'ok' ? '✓' : spec.launcher.status === 'warn' ? '⚠' : '⛔'} {labels.launcher}</span>
      </Html>
    </group> : <Float>{ship}</Float>}
  </group>;
}

function Float({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.08; });
  return <group ref={ref}>{children}</group>;
}

// ── Orbit overview (design step and landing showcase) ───────────────────────
function OrbitOverview({ spec, shape, stations, target }: { spec: ShipSpec; shape: OrbitShape; stations: number; target: React.RefObject<THREE.Vector3> }) {
  const marker = useRef<THREE.Group>(null);
  const points = useMemo(() => orbitLine(shape), [shape]);
  const theta = useRef(0);
  useFrame((_, dt) => {
    theta.current += dt * shape.speed * 0.5;
    const p = orbitPoint(shape, theta.current, tmp);
    marker.current?.position.copy(p);
    marker.current?.lookAt(0, 0, 0);
    target.current.set(0, 0, 0);
  });
  return <group>
    <Planet kind={shape.body} stations={stations} />
    {shape.companion === 'earth' && <group position={[-9, 1.5, -6]} scale={1.6}><Planet kind="earth" spin={0.02} /></group>}
    {shape.companion === 'sun-line' && <Line points={[SUN_DIR.clone().multiplyScalar(-8), SUN_DIR.clone().multiplyScalar(6)]} color="#ffbf5e" dashed dashSize={0.2} gapSize={0.2} lineWidth={1} transparent opacity={0.5} />}
    <Line points={points} color="#5be4e8" lineWidth={1.5} transparent opacity={0.75} />
    <group ref={marker} scale={SHIP_SCALE * 1.3}><Spacecraft spec={spec} fx={{ lights: 1 }} /></group>
  </group>;
}

// ── Flight: launch → insertion → operations → end of life, driven by the timeline ──
function Flight({ spec, timeline, day, ascent, target, onFlightState, reducedMotion }: { spec: ShipSpec; timeline: MissionTimeline; day: number; ascent: number; target: React.RefObject<THREE.Vector3>; onFlightState?: (s: FlightState) => void; reducedMotion?: boolean }) {
  const shape = orbitShapes[timeline.design.orbitId];
  const flight = useMemo(() => flightStateAt(timeline, day, day === 0 ? ascent : 0), [timeline, day, ascent]);
  useEffect(() => onFlightState?.(flight), [flight, onFlightState]);
  // A failed launch never leaves the launch stage: the player sees the vehicle lost on ascent.
  const stage = day === 0 || !timeline.launched ? 'launch' : 'orbit';
  const body = stage === 'launch' ? 'earth' : shape.body;
  const deepArrival = stage === 'orbit' && shape.body !== 'earth';
  const points = useMemo(() => orbitLine(shape), [shape]);
  const stations = timeline.design.groundStationId === 'extended' ? 3 : 1;

  const ship = useRef<THREE.Group>(null);
  const rocket = useRef<THREE.Group>(null);
  const debris = useRef<THREE.Mesh>(null);
  const clockRef = useRef({ theta: 0, stageAt: -1, stage: '', eventKey: '', eventAt: 0, resolvedAt: -1, sparkAt: -1, eolAt: -1, deploy: 0, offset: 0 });
  const [fx, setFx] = useState<ShipFx>({});
  const { clock } = useThree();

  // Persistent consequences of past decisions.
  const past = timeline.events.filter(e => e.day <= day && e.responded);
  const degradedWheels = past.some(e => e.type === 'wheel-failure' && e.selectedChoiceId === 'continue');
  const weakBattery = past.some(e => e.type === 'battery-degradation' && e.selectedChoiceId === 'continue');
  const ev = flight.event;
  const eventKey = ev ? `${ev.type}:${ev.responded}:${ev.choice}` : '';

  useEffect(() => {
    const c = clockRef.current;
    if (eventKey && eventKey !== c.eventKey) {
      const now = clock.elapsedTime;
      if (ev?.responded) c.resolvedAt = now; else c.eventAt = now;
      if (ev?.responded && ev.choice === 'continue' && (ev.type === 'solar-storm' || ev.type === 'debris')) c.sparkAt = now + (ev.type === 'debris' ? 0.9 : 0.2);
    }
    c.eventKey = eventKey;
  }, [eventKey, ev, clock]);

  useFrame(({ clock: k }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const now = k.elapsedTime;
    const c = clockRef.current;
    if (c.stage !== stage) { c.stage = stage; c.stageAt = now; c.deploy = stage === 'launch' ? 0 : c.deploy; }
    const sinceStage = now - c.stageAt;
    const ended = flight.phase === 'end-of-life';
    if (ended && c.eolAt < 0) c.eolAt = now;
    if (!ended) c.eolAt = -1;

    // Launch: rise from the pad and pitch over toward the orbit.
    if (stage === 'launch') {
      const q0 = orbitPoint(orbitShapes.leo, 0, new THREE.Vector3());
      const dirEnd = q0.clone().normalize();
      const dirStart = dirEnd.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.9).normalize();
      const t = flight.launched ? ascent : Math.min(day > 0 ? 1 : ascent, 0.55);
      const e = t * t * (3 - 2 * t);
      const dir = dirStart.clone().lerp(dirEnd, e).normalize();
      const pos = dir.clone().multiplyScalar(1.0 + e * (q0.length() - 1));
      const ahead = dirStart.clone().lerp(dirEnd, Math.min(1, e + 0.05)).normalize().multiplyScalar(1.0 + Math.min(1, e + 0.05) * (q0.length() - 1));
      if (rocket.current) {
        rocket.current.visible = !(!flight.launched && (ascent >= 0.55 || day > 0));
        rocket.current.position.copy(pos);
        const up = t < 0.02 ? dir : ahead.clone().sub(pos).normalize().lerp(dir, Math.max(0, 1 - e * 2)).normalize();
        rocket.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      }
      if (ship.current) ship.current.visible = false;
      target.current.copy(pos);
      return;
    }

    // Orbit stage.
    if (rocket.current) rocket.current.visible = false;
    const s = ship.current; if (!s) return;
    s.visible = true;
    const rate = ended ? 0.2 : (flight.operating ? 1 : 0.6);
    c.theta += dt * shape.speed * 0.35 * rate;
    if (ev?.type === 'debris' && ev.choice === 'protect') c.offset = Math.min(0.12, c.offset + dt * 0.08);
    const p = orbitPoint(shape, c.theta, new THREE.Vector3());
    p.multiplyScalar(1 + c.offset);

    if (deepArrival && sinceStage < 3.5) {
      // Cruise arrival: swoop in from deep space and brake into orbit.
      const k2 = Math.min(1, sinceStage / 3.5), ease = 1 - (1 - k2) ** 3;
      const from = p.clone().normalize().multiplyScalar(9).add(new THREE.Vector3(0, 2.5, 4));
      p.copy(from.lerp(p, ease));
    }
    if (!flight.inserted) {
      // Failed insertion: drift away along the tangent.
      const drift = Math.min(6, sinceStage * 0.5);
      p.add(new THREE.Vector3(-Math.sin(c.theta), 0.15, Math.cos(c.theta)).multiplyScalar(drift));
    }
    if (ended && c.eolAt > 0) {
      const age = now - c.eolAt;
      const reentry = shape.body === 'earth' && shape.radius < 1.6 && flight.health > 0.05;
      if (reentry) p.multiplyScalar(Math.max(1.0, 1 - Math.min(1, age / 5) * (1 - 1 / shape.radius)));
      else p.multiplyScalar(1 + Math.min(0.6, age * 0.08));
    }
    s.position.copy(p);
    s.lookAt(0, 0, 0);
    if (!flight.inserted || flight.health <= 0.05) { s.rotateX(now * 0.7); s.rotateZ(now * 0.4); }
    target.current.copy(p);

    // Deploy appendages after separation.
    c.deploy = flight.inserted ? Math.min(1, c.deploy + dt / (reducedMotion ? 0.3 : 2.4)) : 0.1;

    // Debris approach / pass / impact.
    if (debris.current) {
      const active = ev?.type === 'debris';
      debris.current.visible = active;
      if (active) {
        const age = ev!.responded ? now - c.resolvedAt : now - c.eventAt;
        const approach = ev!.responded ? Math.min(1, 0.6 + age * 0.45) : Math.min(0.6, age * 0.25);
        const side = new THREE.Vector3(-Math.sin(c.theta), 0.3, Math.cos(c.theta)).normalize();
        const dist = (1 - approach) * 1.2 + (ev!.choice === 'protect' ? 0.12 * approach : 0);
        debris.current.position.copy(p).addScaledVector(side, dist + (ev!.responded && ev!.choice === 'protect' ? -approach * 0.3 : 0));
        debris.current.rotation.x += dt * 2; debris.current.rotation.y += dt * 1.3;
      }
    }

    // Push visual state to the ship roughly 15× per second (enough for discrete toggles).
    if (Math.floor(now * 15) !== Math.floor((now - dt) * 15)) {
      const storm = ev?.type === 'solar-storm';
      const sinceResolved = now - c.resolvedAt;
      const insertionBurn = flight.inserted && sinceStage < (deepArrival ? 3.5 : 1.6) && !!spec.propulsion;
      const avoid = ev?.type === 'debris' && ev.choice === 'protect' && sinceResolved < 1.5;
      const next: ShipFx = {
        deploy: c.deploy,
        feather: storm && ev!.choice === 'protect',
        shield: storm && ev!.choice === 'protect',
        wobble: ev?.type === 'wheel-failure' && !ev.responded ? 1 : ev?.type === 'wheel-failure' && ev.choice === 'repair' ? Math.max(0, 0.6 - sinceResolved * 0.3) : degradedWheels ? 0.35 : 0,
        engine: insertionBurn || avoid ? 1 : 0,
        rcs: (ev?.type === 'wheel-failure' && ev.choice === 'repair' && sinceResolved < 2.5) || avoid,
        lights: ended ? 0.15 : ev?.type === 'battery-degradation' && !ev.responded ? 0.45 : weakBattery ? 0.55 : Math.max(0.2, flight.battery),
        storage: flight.storage,
        transmitting: flight.transmitting && !ended,
        scanning: flight.operating && spec.instruments.length > 0 && !ended && !(storm && ev!.choice === 'protect'),
        damage: 1 - flight.health,
        sparks: c.sparkAt,
        planetDistance: (shape.radius - 1) / SHIP_SCALE,
      };
      setFx(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }
  });

  const storm = ev?.type === 'solar-storm';
  return <group>
    <Planet kind={body} stations={body === 'earth' ? stations : 0} aurora={storm ? 1 : 0} />
    {stage === 'orbit' && shape.companion === 'earth' && <group position={[-9, 1.5, -6]} scale={1.6}><Planet kind="earth" spin={0.02} /></group>}
    {stage === 'orbit' && <Line points={points} color="#5be4e8" lineWidth={1} transparent opacity={0.35} />}
    {storm && <StormParticles />}
    <group ref={rocket}><group scale={0.045}><Rocket spec={spec} thrust={stage === 'launch' && ascent > 0.02 && ascent < 1 ? 1 : ascent === 0 ? 0 : 0.6} /></group>
      {stage === 'launch' && !flight.launched && (ascent >= 0.5 || day > 0) && <Sparks3 />}</group>
    <group ref={ship} scale={SHIP_SCALE} visible={false}><Spacecraft spec={spec} fx={fx} /></group>
    <mesh ref={debris} visible={false}><dodecahedronGeometry args={[0.03, 0]} /><meshStandardMaterial color="#7d7f86" roughness={0.9} flatShading /></mesh>
  </group>;
}

/** Expanding debris cloud for a lost launch vehicle. */
function Sparks3() {
  const ref = useRef<THREE.Group>(null);
  const start = useRef(-1);
  const dirs = useMemo(() => Array.from({ length: 40 }, (_, i) => new THREE.Vector3(Math.sin(i * 2.4) * Math.cos(i * 0.7), Math.cos(i * 1.7), Math.sin(i * 0.9 + 1)).normalize()), []);
  useFrame(({ clock }) => {
    const g = ref.current; if (!g) return;
    if (start.current < 0) start.current = clock.elapsedTime;
    const age = clock.elapsedTime - start.current;
    g.children.forEach((c, i) => { c.position.copy(dirs[i]!).multiplyScalar(Math.min(0.5, age * 0.25) * (0.5 + (i % 5) / 5)); const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial; m.opacity = Math.max(0.15, 1 - age * 0.35); });
  });
  return <group ref={ref}>{dirs.map((_, i) => <mesh key={i}><sphereGeometry args={[i % 7 ? 0.006 : 0.03, 6, 4]} /><meshBasicMaterial color={i % 3 ? '#ffb35e' : '#ff5a3d'} transparent blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>)}</group>;
}

function StormParticles() {
  const count = 160;
  const ref = useRef<THREE.Points>(null);
  const [positions, seeds] = useMemo(() => {
    const p = new Float32Array(count * 3), s = new Float32Array(count);
    for (let i = 0; i < count; i++) { s[i] = (i * 0.618) % 1; p[i * 3] = Math.sin(i * 12.9) * 3; p[i * 3 + 1] = Math.cos(i * 7.3) * 3; p[i * 3 + 2] = Math.sin(i * 3.1) * 3; }
    return [p, s];
  }, []);
  useFrame(({ clock }) => {
    const pts = ref.current; if (!pts) return;
    const arr = (pts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < count; i++) {
      const t = (clock.elapsedTime * 0.35 + seeds[i]!) % 1;
      const along = 9 - t * 18;
      const ox = Math.sin(i * 12.9) * 3, oy = Math.cos(i * 7.3) * 2.5;
      arr[i * 3] = SUN_DIR.x * along + ox * 0.6; arr[i * 3 + 1] = SUN_DIR.y * along + oy; arr[i * 3 + 2] = SUN_DIR.z * along + Math.sin(i) * 2;
    }
    pts.geometry.attributes.position!.needsUpdate = true;
  });
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#ffb35e" size={0.05} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} /></points>;
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function MissionScene({ mode, design, timeline, day = 0, ascent = 0, labels, reducedMotion, onFlightState }: MissionSceneProps) {
  const spec = useMemo(() => buildShipSpec(design), [design]);
  const shape = orbitShapes[design.orbitId];
  const target = useRef(new THREE.Vector3());
  const stations = design.groundStationId === 'extended' ? 3 : 1;
  const span = Math.max(...spec.bus.size, spec.solar ? spec.solar.span * 2 + spec.bus.size[0] : 0);
  const defaults: CamDefaults =
    mode === 'hangar' ? { yaw: 0.75, pitch: 0.28, dist: 3.2 + span * 0.9, min: 2, max: 18, auto: 0.18 } :
    mode === 'launcher' ? { yaw: 0.6, pitch: 0.18, dist: spec.launcher.height * 2.1 + 3, min: 3, max: 40, auto: 0.12 } :
    mode === 'orbit' ? { yaw: 0.4, pitch: 0.45, dist: shape.radius * 2.6 + 2.2, min: 1.6, max: 30, auto: 0.08 } :
    mode === 'showcase' ? { yaw: 0.9, pitch: 0.3, dist: 4.6, min: 2, max: 12, auto: 0.15 } :
    { yaw: 0.5, pitch: 0.35, dist: 0.85, min: 0.25, max: 14 };
  if (mode === 'launcher') target.current.set(0, spec.launcher.height * 0.62, 0);
  const resetKey = `${mode}:${mode === 'orbit' ? design.orbitId : ''}`;

  return <Canvas dpr={[1, 1.75]} camera={{ fov: 45, near: 0.01, far: 400, position: [0, 2, 8] }} gl={{ antialias: true, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}>
    <color attach="background" args={['#04080f']} />
    <ambientLight intensity={mode === 'hangar' || mode === 'launcher' ? 0.55 : 0.12} />
    <hemisphereLight args={['#bfe9ff', '#0a1220', mode === 'hangar' || mode === 'launcher' ? 0.6 : 0.15]} />
    <directionalLight position={SUN_DIR.clone().multiplyScalar(10)} intensity={2.6} color="#fff4df" />
    {(mode === 'hangar' || mode === 'launcher') && <pointLight position={[-4, 3, 4]} intensity={18} color="#5be4e8" distance={14} />}
    <Stars radius={120} depth={60} count={reducedMotion ? 1500 : 3500} factor={4} saturation={0} fade speed={reducedMotion ? 0 : 0.6} />
    {mode !== 'hangar' && mode !== 'launcher' && <Sun />}
    {(mode === 'hangar' || mode === 'launcher') && <Hangar spec={spec} labels={labels} launcherView={mode === 'launcher'} />}
    {(mode === 'orbit' || mode === 'showcase') && <OrbitOverview spec={spec} shape={mode === 'showcase' ? orbitShapes.sso : shape} stations={stations} target={target} />}
    {mode === 'flight' && timeline && <Flight spec={spec} timeline={timeline} day={day} ascent={ascent} target={target} onFlightState={onFlightState} reducedMotion={reducedMotion} />}
    <CameraRig defaults={defaults} target={target} resetKey={resetKey} reducedMotion={reducedMotion} />
  </Canvas>;
}
