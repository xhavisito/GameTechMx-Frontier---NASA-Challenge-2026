import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Coins, Lock, Check, Crosshair, X as XIcon, Skull, Sparkles } from 'lucide-react';
import { Rover, SubGLB, Orbiter, Shuttle } from './models';
import { SHIPS, UPGRADES, buy, costOf, lockReason, lvl, perksFor, tierOf, upgradeById, upgradesOf, type Meta, type RunCard, type Ship } from './meta';
import type { MarsResult } from './marsWorld';
import type { Contract } from './contracts';

const t = (es: boolean, a: string, b: string) => (es ? a : b);
const SHIP_NAME: Record<Ship, [string, string]> = { rover: ['Rover (Marte)', 'Rover (Mars)'], orbiter: ['Orbitador (Júpiter)', 'Orbiter (Jupiter)'], sub: ['Submarino (Miller)', 'Submarine (Miller)'], rocket: ['Cohete', 'Rocket'] };
const TIER_NAME = [['Prototipo', 'Prototype'], ['Veterana', 'Veteran'], ['Élite', 'Elite'], ['Legendaria', 'Legendary']] as const;

function Spin({ ship, tier, weapon }: { ship: Ship; tier: number; weapon: boolean }) {
  const g = useRef<THREE.Group>(null), lift = useRef(0);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.6; });
  const k = ship === 'rocket' ? 0.32 : ship === 'sub' ? 0.85 : ship === 'rover' ? 1.5 : 1.3;
  return <group ref={g} scale={k} position={[0, ship === 'rocket' ? -2 : ship === 'orbiter' ? 0 : -0.8, 0]}>
    <Suspense fallback={null}>
      {ship === 'rover' ? <Rover tier={tier} laser={weapon} radar spectrometer={tier >= 2} /> : ship === 'sub' ? <SubGLB tier={tier} weapon={weapon} /> : ship === 'orbiter' ? <Orbiter tier={tier} weapon={weapon} /> : <Shuttle lift={lift} flame={false} tier={tier} />}
    </Suspense>
  </group>;
}
/** Small rotating 3D preview. The model changes as soon as you buy something. */
export function ShipViewer({ ship, tier, weapon }: { ship: Ship; tier: number; weapon: boolean }) {
  return <div className="ws-view"><Canvas dpr={[1, 1.5]} camera={{ fov: 40, position: [0, 2.2, 8], near: 0.1, far: 100 }}>
    <hemisphereLight args={['#fff4e6', '#4a3a62', 1.1]} /><directionalLight position={[4, 6, 5]} intensity={1.3} />
    <mesh position={[0, -2.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[3.2, 20]} /><meshStandardMaterial color="#46365f" flatShading /></mesh>
    <Spin ship={ship} tier={tier} weapon={weapon} />
  </Canvas></div>;
}

export function Workshop({ es, meta, setMeta, onClose, initial = 'rover' }: { es: boolean; meta: Meta; setMeta: (m: Meta) => void; onClose: () => void; initial?: Ship }) {
  const [ship, setShip] = useState<Ship>(initial), [flash, setFlash] = useState<string | null>(null);
  const perks = perksFor(ship, meta), tier = tierOf(meta, ship), ups = upgradesOf(ship);
  const total = ups.reduce((a, u) => a + lvl(meta, u.id), 0), max = ups.reduce((a, u) => a + u.max, 0);
  const doBuy = (id: string) => { const n = buy(meta, id); if (n !== meta) { setMeta(n); setFlash(id); setTimeout(() => setFlash(null), 700); } };
  return <div className="adv-modal" role="dialog" aria-label="workshop"><div className="adv-card wide ws">
    <div className="hang-head"><h2>{t(es, 'Taller', 'Workshop')}</h2><span className="ws-scrap"><Coins size={18} /> {meta.scrap}</span></div>
    <p>{t(es, 'Gasta chatarra de tus misiones para mejorar cada nave. Las mejoras se quedan para siempre y la nave cambia de aspecto.', 'Spend scrap from your missions to upgrade each ship. Upgrades stay forever and the ship changes its look.')}</p>
    <div className="ws-tabs" role="tablist">{SHIPS.map(s => <button key={s} role="tab" aria-selected={ship === s} className={ship === s ? 'on' : ''} onClick={() => setShip(s)}>{SHIP_NAME[s][es ? 0 : 1]}</button>)}</div>
    <div className="ws-body">
      <div className="ws-side">
        <ShipViewer ship={ship} tier={tier} weapon={perks.weapon > 0} />
        <div className="ws-tier"><b>{TIER_NAME[tier][es ? 0 : 1]}</b><span>{total}/{max}</span></div>
        <div className="ws-bar"><i style={{ width: `${(total / max) * 100}%` }} /></div>
        <small>{ship === 'rocket' ? t(es, 'El cohete mejora tus pruebas de diseño y los eventos del viaje.', 'The rocket improves your design tests and trip events.') : perks.weapon > 0 ? t(es, `Arma nivel ${perks.weapon}. Dispara con R / LB.`, `Weapon level ${perks.weapon}. Fire with R / LB.`) : t(es, 'Sin arma: de momento solo puedes esquivar enemigos.', 'No weapon yet: for now you can only dodge enemies.')}</small>
      </div>
      <ul className="ws-tree">{ups.map(u => {
        const l = lvl(meta, u.id), why = lockReason(meta, u.id), req = u.requires ? upgradeById(u.requires.id) : null, cost = costOf(meta, u.id);
        return <li key={u.id} className={`${u.requires ? 'child' : ''} ${l >= u.max ? 'maxed' : ''} ${flash === u.id ? 'flash' : ''} ${u.weapon ? 'weapon' : ''}`}>
          <div className="ws-info"><b>{u.weapon && <Crosshair size={14} />} {es ? u.es : u.en}</b><small>{es ? u.descEs : u.descEn}</small>
            {why === 'req' && req && <small className="ws-req"><Lock size={12} /> {t(es, 'Requiere', 'Requires')} {es ? req.es : req.en} {u.requires!.level}</small>}
            <span className="ws-pips">{Array.from({ length: u.max }, (_, k) => <i key={k} className={k < l ? 'on' : ''} />)}</span></div>
          <button className="button button-primary ws-buy" disabled={!!why} onClick={() => doBuy(u.id)} aria-label={`${es ? u.es : u.en}`}>
            {why === 'max' ? <Check size={16} /> : why === 'req' ? <Lock size={16} /> : <><Coins size={14} /> {cost}</>}</button>
        </li>;
      })}</ul>
    </div>
    <div className="adv-row tut-nav"><button className="button button-primary" autoFocus onClick={onClose}>{t(es, 'Listo', 'Done')}</button></div>
  </div></div>;
}

/** Pick one of three run cards before the mission: small, temporary boosts, some with a price. */
export function Draft({ es, cards, onPick }: { es: boolean; cards: RunCard[]; onPick: (c: RunCard | null) => void }) {
  return <div className="adv-modal ev"><div className="adv-card wide">
    <h2><Sparkles size={22} /> {t(es, 'Elige una carta para esta misión', 'Pick a card for this mission')}</h2>
    <p>{t(es, 'Solo dura esta misión. Las cartas con ⚠ dan mucho, pero tienen un precio.', 'Lasts this mission only. Cards marked ⚠ give a lot but cost something.')}</p>
    <div className="adv-row">{cards.map(c => <button key={c.id} className={`adv-opt card ${c.risk ? 'risk' : ''}`} onClick={() => onPick(c)}><b>{c.risk ? '⚠ ' : ''}{es ? c.es : c.en}</b><small>{es ? c.descEs : c.descEn}</small></button>)}</div>
    <div className="adv-row tut-nav"><button className="button button-secondary" onClick={() => onPick(null)}>{t(es, 'Sin carta', 'No card')}</button></div>
  </div></div>;
}

export function ContractPicker({ es, list, value, onPick }: { es: boolean; list: Contract[]; value: string; onPick: (id: string) => void }) {
  const danger = (d: number) => (d >= 1.3 ? t(es, 'Muy peligroso', 'Very dangerous') : d > 1 ? t(es, 'Peligroso', 'Dangerous') : t(es, 'Tranquilo', 'Calm'));
  return <div className="adv-row">{list.map(c => <button key={c.id} className={`adv-opt ${value === c.id ? 'on' : ''}`} aria-pressed={value === c.id} onClick={() => onPick(c.id)}>
    <b>{es ? c.es : c.en}</b><small>{es ? c.descEs : c.descEn}</small><small>×{c.reward.toFixed(2)} {t(es, 'chatarra', 'scrap')} · {danger(c.danger)}</small></button>)}</div>;
}

export function Reward({ es, result, scrap, total, spent, level, onWorkshop, onAgain }: { es: boolean; result: MarsResult; scrap: number; total: number; spent: number; level: string; onWorkshop: () => void; onAgain: () => void }) {
  const [why, setWhy] = useState(false);
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const pts = result.why ?? [], sw = result.scrapWhy;
  return <div className="adv-modal"><div className="adv-card center">
    <h2>{result.exploded ? t(es, '¡La nave explotó!', 'The ship exploded!') : result.returned ? t(es, '¡Misión cumplida!', 'Mission complete!') : t(es, 'Misión terminada', 'Mission over')}</h2>
    <div className="w-grade">{result.grade}</div>
    <p><b>{result.score}</b>/100 · {level}</p>
    <div className="rw-grid">
      <span><Coins size={16} /> +{scrap}<small>{t(es, 'ganado', 'earned')}</small></span>
      {spent > 0 && <span><Coins size={16} /> −{spent}<small>{t(es, 'equipo', 'gear')}</small></span>}
      <span><Skull size={16} /> {result.kills ?? 0}<small>{t(es, 'derrotados', 'defeated')}</small></span>
      <span><Check size={16} /> {result.pois ?? 0}<small>{t(es, 'objetivos', 'goals')}</small></span>
      {(result.lost ?? 0) > 0 && <span><XIcon size={16} /> {result.lost}<small>{t(es, 'robos', 'thefts')}</small></span>}
    </div>
    {result.exploded && <p className="rw-warn">{t(es, 'Al explotar, ganas la mitad de chatarra.', 'Exploding halves your scrap.')}</p>}
    <button className="button button-secondary" aria-expanded={why} onClick={() => setWhy(v => !v)}>{why ? t(es, 'Ocultar', 'Hide') : t(es, '¿Por qué esta calificación?', 'Why this grade?')}</button>
    {why && <div className="why" aria-label="why">
      <h4>{t(es, `Calificación: ${result.score}/100 → ${result.grade}`, `Grade: ${result.score}/100 → ${result.grade}`)}</h4>
      <ul>{pts.map((p, i) => <li key={i}><span>{es ? p.es : p.en}</span><b className={p.pts < 0 ? 'neg' : 'pos'}>{fmt(Math.round(p.pts * 10) / 10)}{p.max ? <small> / {p.max}</small> : null}</b></li>)}
        <li className="tot"><span>{t(es, 'Total (redondeado)', 'Total (rounded)')}</span><b>{result.score}</b></li></ul>
      <small>{t(es, 'S desde 85 · A desde 70 · B desde 50 · C desde 30 · D menos de 30.', 'S from 85 · A from 70 · B from 50 · C from 30 · D below 30.')}</small>
      {sw && <><h4>{t(es, `Chatarra ganada: ${scrap}`, `Scrap earned: ${scrap}`)}</h4>
        <ul>{sw.map((p, i) => <li key={i} className={p.k === undefined && p.max === -1 ? 'tot' : ''}><span>{es ? p.es : p.en}</span>{p.k !== undefined ? <b>×{p.k}</b> : <b className={p.pts < 0 ? 'neg' : 'pos'}>{fmt(Math.round(p.pts * 10) / 10)}</b>}</li>)}</ul>
        <small>{t(es, 'Los multiplicadores se aplican al total de arriba; el mínimo por misión es 5.', 'Multipliers apply to the subtotal above; the minimum per mission is 5.')}</small></>}
    </div>}
    <p className="adv-next">{t(es, `Tienes ${total} de chatarra. ¿Mejoras tu nave?`, `You have ${total} scrap. Upgrade your ship?`)}</p>
    <div className="adv-row"><button className="button button-primary" autoFocus onClick={onWorkshop}>{t(es, 'Ir al taller', 'Go to workshop')}</button><button className="button button-secondary" onClick={onAgain}>{t(es, 'Otra misión', 'Another mission')}</button></div>
  </div></div>;
}
export { UPGRADES };
