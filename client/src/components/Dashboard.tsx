import { useMemo } from 'react';
import { Activity, BatteryCharging, CircleHelp, Database, Gauge, HardDrive, Wallet, Clock3 } from 'lucide-react';
import { calculateResources, scenarios } from '../../../shared/index';
import { useGame } from '../store';
import { useDesignCopy, number } from '../designCopy';
import type { ReactNode } from 'react';

function Meter({ label, icon, value, limit, unit, detail, tip, children, inverted = false }: {label:string; icon:ReactNode; value:number; limit:number; unit:string; detail:string; tip:string; children?:ReactNode; inverted?:boolean}) {
  const ratio = limit > 0 ? value / limit : value > 0 ? 2 : 0;
  const status = inverted ? ratio < 0 ? 'critical' : ratio < .15 ? 'caution' : 'nominal' : ratio > 1 ? 'critical' : ratio > .85 ? 'caution' : 'nominal';
  const c = useDesignCopy();
  return <section className={`resource-card resource-${status}`}>
    <div className="resource-heading"><span>{icon}{label}</span><details className="resource-help"><summary aria-label={`${c.resourceHelp}: ${label}`}><CircleHelp size={14}/></summary><p>{tip}</p></details></div>
    <div className="resource-value"><strong>{number(value)}</strong><span>{unit}</span><span className={`resource-status ${status}`}>{status === 'critical' ? '!' : status === 'caution' ? '△' : '✓'}</span></div>
    <div className="resource-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(1,limit)} aria-valuenow={Math.max(0,Math.min(value,Math.max(1,limit)))} aria-valuetext={`${number(value)} ${unit}; ${detail}`}><span style={{width:`${Math.max(0,Math.min(100,ratio*100))}%`}}/></div>
    <div className="resource-detail">{detail}</div>{children}
  </section>;
}

export function Dashboard() {
  const design = useGame(s => s.design);
  const r = useMemo(() => calculateResources(design), [design]);
  const c = useDesignCopy();
  const scenario = scenarios.find(s => s.id === design.scenarioId) ?? scenarios[0];
  return <aside className="telemetry-rail" aria-label={c.dashboard}>
    <div className="telemetry-title"><div><span className="eyebrow">{c.liveDesign}</span><h2>{c.dashboard}</h2></div><Activity size={18}/></div>
    <div className="resource-grid">
      <Meter label={c.mass} icon={<Gauge size={15}/>} value={r.massKg} limit={r.launchCapacityKg} unit="kg" detail={`/ ${number(r.launchCapacityKg)} kg ${c.capacity.toLowerCase()}`} tip={c.massTip}/>
      <Meter label={c.power} icon={<BatteryCharging size={15}/>} value={r.consumptionW} limit={r.averageGenerationW} unit="W" detail={`/ ${number(r.averageGenerationW)} W ${c.generated}`} tip={c.powerTip}>
        <div className={`resource-mini ${r.eclipseNeedWh > r.batteryWh ? 'text-warning' : ''}`}>{c.eclipseBattery}: <b>{number(r.eclipseNeedWh)} / {number(r.batteryWh)} Wh</b></div>
        <div className="resource-mini">{c.safeMode}: <b>{number(r.safeModeW)} W</b></div>
      </Meter>
      <Meter label={c.budget} icon={<Wallet size={15}/>} value={r.totalCostM} limit={r.budgetM} unit="M USD" detail={`/ $${number(r.budgetM)} M · ${number(r.budgetMarginM)} M ${c.margin}`} tip={c.budgetTip}>
        <div className="budget-split"><span>{c.developmentShort} <b>{number(r.developmentCostM)}</b></span><span>{c.launchShort} <b>{number(r.launchCostM)}</b></span><span>{c.operationsShort} <b>{number(r.operationsCostM)}</b></span></div>
      </Meter>
      <Meter label={c.data} icon={<Database size={15}/>} value={r.generatedGBPerDay} limit={r.downlinkGBPerDay} unit={`GB${c.perDay}`} detail={`/ ${number(r.downlinkGBPerDay)} GB${c.perDay} ${c.downlink}`} tip={c.dataTip}>
        <div className="resource-mini">{number(r.linkMbps)} Mbps × {number(r.contactMinutesPerDay)} min{c.perDay}</div>
      </Meter>
      <Meter label={c.storage} icon={<HardDrive size={15}/>} value={r.storageMarginGB} limit={r.storageGB} unit={`GB ${c.remaining}`} detail={`/ ${number(r.storageGB)} GB ${c.total}`} tip={c.storageTip} inverted/>
      <Meter label={c.missionTime} icon={<Clock3 size={15}/>} value={r.developmentMonths} limit={scenario.maxDevelopmentMonths} unit={c.months} detail={`${c.development}: ${r.developmentMonths} / ${scenario.maxDevelopmentMonths} ${c.months}`} tip={c.timeTip}>
        <div className={`resource-mini ${r.durationDays < scenario.minDurationDays ? 'text-warning' : ''}`}>{c.lifetime}: <b>{r.durationDays} / {scenario.minDurationDays} {c.days}</b> ({c.goal})</div>
      </Meter>
    </div>
    <div className="telemetry-footer"><span className="status-dot"/>{c.limits}</div>
  </aside>;
}
