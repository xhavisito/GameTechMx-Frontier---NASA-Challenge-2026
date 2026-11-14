import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react';
import { calculateResources } from '../../../shared/index';
import { useGame } from '../store';
import { useGameCopy } from '../gameCopy';
import { useDesignCopy, number } from '../designCopy';
import { buildShipSpec, type PartStatus } from '../three/spacecraftModel';
import { OrbitView } from './OrbitView';
import { Viewport3D } from './Viewport3D';

function Gauge({ label, value, limit, unit, inverse = false }: { label: string; value: number; limit: number; unit: string; inverse?: boolean }) {
  const ratio = limit > 0 ? value / limit : value > 0 ? 2 : 0;
  const status: PartStatus = inverse ? (ratio > 1 ? 'ok' : ratio > 0.87 ? 'warn' : 'bad') : (ratio > 1 ? 'bad' : ratio > 0.87 ? 'warn' : 'ok');
  const fill = inverse ? Math.min(1, limit > 0 ? value / limit : 0) : Math.min(1, ratio);
  return <div className={`hud-gauge ${status}`}>
    <span>{label}<b>{number(value, 0)}/{number(limit, 0)} {unit}</b></span>
    <i><em style={{ width: `${fill * 100}%` }} /></i>
  </div>;
}

/** Sticky 3D assembly bay shown on every design step: the player's choices appear on the model live. */
export function DesignStage() {
  const design = useGame(s => s.design);
  const step = useGame(s => s.step);
  const g = useGameCopy();
  const c = useDesignCopy();
  const r = useMemo(() => calculateResources(design), [design]);
  const spec = useMemo(() => buildShipSpec(design), [design]);
  const mode = step === 1 ? 'orbit' : step === 4 ? 'launcher' : 'hangar';
  // Problems are shown as HUD chips; the matching parts also glow red/orange on the 3D model.
  const alerts = ([
    [spec.bus.status, g.labelMass], [spec.solar?.status ?? spec.rtg?.status ?? 'bad', g.labelPower], [spec.battery?.status ?? 'ok', g.labelBattery],
    [spec.antenna?.status ?? 'ok', g.labelData], [spec.storage?.status ?? 'ok', g.labelStorage], [spec.propulsion?.status ?? (r.deltaV > 0 ? 'ok' : 'warn'), g.labelPropulsion],
    [spec.launcher.status, g.labelLauncher],
  ] as [PartStatus, string][]).filter(([s]) => s !== 'ok').map(([status, text]) => ({ status, text }));
  const Icon = spec.readiness === 'ok' ? CheckCircle2 : spec.readiness === 'warn' ? AlertTriangle : OctagonAlert;
  const hud = <>
    <div className="hud-row">
      <span className={`hud-chip ${spec.readiness}`}><Icon size={14} />{spec.readiness === 'ok' ? g.readyOk : spec.readiness === 'warn' ? g.readyWarn : g.readyBad}</span>
      <div className="hud-gauges">
        <Gauge label={c.mass.toUpperCase()} value={r.massKg} limit={r.launchCapacityKg} unit="kg" />
        <Gauge label={c.power.toUpperCase()} value={r.averageGenerationW} limit={r.consumptionW} unit="W" inverse />
        <Gauge label={c.data.toUpperCase()} value={r.downlinkGBPerDay} limit={r.generatedGBPerDay} unit="GB" inverse />
        <Gauge label="$" value={r.totalCostM} limit={r.budgetM} unit="M" />
      </div>
    </div>
    <div className="hud-bottom">
      {alerts.length > 0 && <ul className="hud-alerts" aria-label={g.readyBad}>{alerts.map(a => <li key={a.text} className={`part-alert ${a.status}`}>{a.status === 'bad' ? '⛔' : '⚠'} {a.text}</li>)}</ul>}
      {step !== 1 && alerts.length === 0 && <p className="hud-hint">{g.hangarHint}</p>}
    </div>
  </>;
  return <div className="design-stage">
    <Viewport3D mode={mode} collapsible hud={hud} fallback={<OrbitView />} />
  </div>;
}
