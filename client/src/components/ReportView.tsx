import { useId, useState } from 'react';
import { ArrowRight, CheckCircle2, Download, FileText, RefreshCw, ShieldCheck, Sparkles, Target, TriangleAlert } from 'lucide-react';
import type { MissionTimeline, ScoreBreakdown, TimelineDay } from '../../../shared/types';
import { useGame } from '../store';
import { useI18n } from '../i18n';
import en from '../locales/simulation.en.json';
import es from '../locales/simulation.es.json';
import './simulation.css';
import { MarsSurfaceCard } from './MarsSurface';

type ReportCopy = typeof en;
type ScoreCategory = keyof ScoreBreakdown['max'];
const categories: ScoreCategory[] = ['objective','science','efficiency','robustness','collaboration'];
const categoryLabel = (key: ScoreCategory, copy: ReportCopy) => key==='science'?copy.scoreScience:copy[key];
const colors = ['#59e1e8','#ab9fff','#ffad6b','#91d5af','#e898c5'];
const finite = (value:number) => Number.isFinite(value)?value:0;

function ResourceChart({timeline, copy, lang}: {timeline:MissionTimeline; copy:ReportCopy; lang:string}) {
  const id = useId().replace(/:/g,'');
  const { days, resources } = timeline;
  const series = [
    {name:copy.healthSeries,color:'#59e1e8',dash:undefined,value:(d:TimelineDay)=>finite(d.health*100)},
    {name:copy.storageSeries,color:'#ab9fff',dash:'6 4',value:(d:TimelineDay)=>finite(d.storedGB/Math.max(resources.storageGB,1)*100)},
    {name:copy.budgetSeries,color:'#ffad6b',dash:'2 5',value:(d:TimelineDay)=>finite(d.spentM/Math.max(resources.budgetM,0.01)*100)},
  ];
  const maximum = Math.max(100,...days.flatMap(d=>series.map(s=>s.value(d))));
  const ceiling = Math.ceil(maximum/25)*25;
  const maxDay = Math.max(1, days.at(-1)?.day ?? 1);
  const x = (day:number) => 45+day/maxDay*565;
  const y = (value:number) => 192-Math.max(0,value)/ceiling*160;
  const f = (value:number) => finite(value).toLocaleString(lang,{maximumFractionDigits:1});
  return <section className="panel report-chart"><h2>{copy.telemetry}</h2><p className="sim-muted">{copy.telemetryHelp}</p>
    <svg viewBox="0 0 640 232" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{copy.telemetry}</title><desc id={`${id}-desc`}>{copy.telemetryHelp} {copy.showTable}.</desc>
      {[0,.25,.5,.75,1].map(fraction=><g key={fraction}><line x1="45" x2="610" y1={y(fraction*ceiling)} y2={y(fraction*ceiling)} stroke="#243246" strokeDasharray="3 4"/><text x="36" y={y(fraction*ceiling)+4} textAnchor="end" fill="#93a4bc" fontSize="10">{Math.round(fraction*ceiling)}%</text></g>)}
      <line x1="45" x2="610" y1={y(100)} y2={y(100)} stroke="#93a4bc" strokeOpacity=".4"/>
      {[0,.25,.5,.75,1].map(fraction=><text key={fraction} x={x(fraction*maxDay)} y="215" textAnchor="middle" fill="#93a4bc" fontSize="10">D+{Math.round(fraction*maxDay)}</text>)}
      {series.map(s=><polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash} points={days.map(d=>`${x(d.day)},${y(s.value(d))}`).join(' ')}/>)}
    </svg>
    <div className="report-chart-legend">{series.map(s=><span key={s.name}><i style={{background:s.color,borderRadius:s.dash==='6 4'?'0':'50%'}}/>{s.name}</span>)}</div>
    <details className="report-table-details"><summary>{copy.showTable}</summary><div className="report-table-scroll"><table><thead><tr><th>{copy.day}</th><th>{copy.health}</th><th>{copy.storage}</th><th>{copy.spent}</th><th>{copy.downlinked}</th><th>{copy.powerMargin}</th></tr></thead><tbody>{days.map(row=><tr key={row.day}><th scope="row">{row.day}</th><td>{f(row.health*100)}%</td><td>{f(row.storedGB)} GB</td><td>{f(row.spentM)} M$</td><td>{f(row.cumulativeDataGB)} GB</td><td>{f(row.energyMarginW)} W</td></tr>)}</tbody></table></div></details>
  </section>;
}

async function downloadSummary(timeline:MissionTimeline, score:ScoreBreakdown, copy:ReportCopy, lang:string) {
  const canvas = document.createElement('canvas');
  canvas.width=1400; canvas.height=1080;
  const ctx=canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const f=(value:number,digits=1)=>finite(value).toLocaleString(lang,{maximumFractionDigits:digits});
  ctx.fillStyle='#080e18';ctx.fillRect(0,0,1400,1080);
  ctx.strokeStyle='#243246';ctx.lineWidth=1;
  for(let y=0;y<1080;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1400,y);ctx.stroke();}
  ctx.fillStyle='#59e1e8';ctx.font='bold 20px monospace';ctx.fillText('GAMETECHMX FRONTIER / MISSION REPORT',64,72);
  ctx.fillStyle='#e7edf7';ctx.font='bold 44px sans-serif';ctx.fillText(timeline.design.name.slice(0,42),64,143);
  ctx.fillStyle=timeline.success?'#91d5af':'#ffad6b';ctx.font='bold 18px monospace';ctx.fillText(timeline.success?copy.success:copy.failure,64,188);
  ctx.fillStyle='#93a4bc';ctx.font='18px monospace';ctx.fillText(`${copy.seed}: ${timeline.seed.slice(0,70)}`,64,224);
  ctx.fillStyle='#101c2a';ctx.fillRect(64,263,1272,230);
  ctx.fillStyle='#e7edf7';ctx.font='bold 100px monospace';ctx.fillText(String(score.total),96,386);
  ctx.fillStyle='#93a4bc';ctx.font='20px monospace';ctx.fillText(`/ 100 · ${copy.grade} ${score.grade}`,96,435);
  categories.forEach((key,index)=>{
    const top=295+index*37;
    ctx.font='16px sans-serif';ctx.fillStyle='#c9d7e6';ctx.fillText(categoryLabel(key,copy),395,top);
    ctx.fillStyle='#243246';ctx.fillRect(620,top-13,570,12);
    ctx.fillStyle=colors[index];ctx.fillRect(620,top-13,570*(score[key]/Math.max(1,score.max[key])),12);
    ctx.fillStyle='#e7edf7';ctx.font='16px monospace';ctx.fillText(`${score[key]}/${score.max[key]}`,1210,top);
  });
  const metrics=[
    [copy.downlinked,`${f(timeline.totalDataGB)} GB`],
    [copy.completedDays,String(timeline.completedDays)],
    [copy.cost,`${f(timeline.finalCostM,2)} M$`],
    [copy.finalHealth,`${f(timeline.finalHealth*100)}%`],
  ];
  metrics.forEach(([label,value],index)=>{const left=64+index*322;ctx.fillStyle='#93a4bc';ctx.font='17px sans-serif';ctx.fillText(label,left,547);ctx.fillStyle='#e7edf7';ctx.font='bold 30px monospace';ctx.fillText(value,left,592);});
  ctx.fillStyle='#e7edf7';ctx.font='bold 24px sans-serif';ctx.fillText(copy.requirements,64,654);
  timeline.requirementResults.slice(0,7).forEach((r,index)=>{const top=695+index*35;ctx.fillStyle=r.passed?'#91d5af':'#ffad6b';ctx.font='bold 17px monospace';ctx.fillText(r.passed?'✓':'×',64,top);ctx.fillStyle='#c9d7e6';ctx.font='18px sans-serif';ctx.fillText(r.label[lang==='es'?'es':'en'].slice(0,65),96,top);ctx.fillStyle='#93a4bc';ctx.font='17px monospace';ctx.fillText(`${f(r.actual)} / ${f(r.required)}`,1040,top);});
  ctx.fillStyle='#93a4bc';ctx.font='16px sans-serif';ctx.fillText(copy.simulationDisclaimer,64,1023,1272);
  const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG export failed')),'image/png'));
  const url=URL.createObjectURL(blob); const link=document.createElement('a');link.href=url;link.download=`frontier-report-${timeline.seed.replace(/[^a-z0-9_-]/gi,'-').slice(0,40)}.png`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function ReportView() {
  const {lang,l}=useI18n();
  const copy=lang==='es'?es:en;
  const timeline=useGame(s=>s.timeline);
  const score=useGame(s=>s.score);
  const report=useGame(s=>s.report);
  const previous=useGame(s=>s.previous);
  const redesign=useGame(s=>s.redesign);
  const setScreen=useGame(s=>s.setScreen);
  const [exportStatus,setExportStatus]=useState('');
  if(!timeline||!score||!report) return <section className="panel sim-empty"><FileText/><h2>{copy.noReport}</h2><button className="button button-primary" onClick={()=>setScreen('design')}>{copy.returnDesign}</button></section>;
  const f=(value:number,digits=1)=>finite(value).toLocaleString(lang,{maximumFractionDigits:digits});
  const metrics=[{label:copy.downlinked,value:`${f(timeline.totalDataGB)} GB`},{label:copy.completedDays,value:`${timeline.completedDays} / ${timeline.design.durationDays}`},{label:copy.cost,value:`${f(timeline.finalCostM,2)} M$`},{label:copy.dataLoss,value:`${f(timeline.lostDataGB)} GB`}];
  return <article className="report-view">
    <header className="sim-heading"><div><p className="eyebrow">{copy.reportEyebrow}</p><h1>{copy.reportTitle}</h1></div><span className="sim-seed">{copy.seed} <strong>{timeline.seed}</strong></span></header>
    {timeline.design.orbitId==='mars'&&<MarsSurfaceCard timeline={timeline}/>}
    <section className={`panel report-hero ${report.success?'is-success':'is-incomplete'}`}><div className="report-outcome">{report.success?<CheckCircle2 size={20}/>:<TriangleAlert size={20}/>}<span>{report.success?copy.success:copy.failure}</span></div><h2>{l(report.title)}</h2><p>{l(report.summary)}</p>
      <div className="report-score-content"><div className="report-total-score"><span>{copy.score}</span><strong>{score.total}<small>/100</small></strong><b>{copy.grade} {score.grade}</b></div><div className="report-score-bars">{categories.map((key,index)=><div className="report-score-row" key={key}><div><span>{categoryLabel(key,copy)}</span><b>{score[key]}<small> / {score.max[key]}</small></b></div><div className="report-score-track"><span style={{width:`${score[key]/Math.max(1,score.max[key])*100}%`,background:colors[index]}}/></div></div>)}</div></div>
    </section>
    <div className="report-metrics">{metrics.map(metric=><div className="panel" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
    <section className="panel report-requirements"><h2><Target size={18}/>{copy.requirements}</h2><div className="report-table-scroll"><table><thead><tr><th>{copy.requirement}</th><th>{copy.achieved}</th><th>{copy.target}</th><th>{copy.result}</th></tr></thead><tbody>{timeline.requirementResults.map(requirement=><tr key={requirement.id}><th scope="row">{l(requirement.label)}</th><td>{f(requirement.actual)}</td><td>{f(requirement.required)}</td><td><span className={`report-requirement-status ${requirement.passed?'passed':'missed'}`}>{requirement.passed?<CheckCircle2 size={14}/>:<TriangleAlert size={14}/>} {requirement.passed?copy.passed:copy.missed}</span></td></tr>)}</tbody></table></div></section>
    <div className="report-explanations"><section className="panel"><h2><ShieldCheck size={18}/>{copy.worked}</h2>{report.strengths.length?<ul>{report.strengths.map((text,index)=><li key={index}>{l(text)}</li>)}</ul>:<p>{copy.noStrengths}</p>}</section><section className="panel"><h2><TriangleAlert size={18}/>{copy.failed}</h2>{report.failures.length?<ul>{report.failures.map((text,index)=><li key={index}>{l(text)}</li>)}</ul>:<p>{copy.noFailures}</p>}</section></div>
    <section className="panel report-suggestions"><h2><Sparkles size={18}/>{copy.next}</h2><ol>{report.suggestions.map((text,index)=><li key={index}><span>{String(index+1).padStart(2,'0')}</span><p>{l(text)}</p></li>)}</ol><button className="button button-primary" onClick={redesign}><RefreshCw size={16}/>{copy.redesign}<ArrowRight size={16}/></button></section>
    <ResourceChart timeline={timeline} copy={copy} lang={lang}/>
    {previous&&<section className="panel report-comparison"><h2>{copy.compare}</h2><p className="sim-muted">{timeline.seed===previous.timeline.seed?copy.sameSeed:copy.differentSeed}</p><div className="report-table-scroll"><table><thead><tr><th>{copy.result}</th><th>{copy.previous}</th><th>{copy.current}</th><th>{copy.change}</th></tr></thead><tbody>{[
      {label:copy.score,a:previous.score.total,b:score.total,unit:''},
      {label:copy.downlinked,a:previous.timeline.totalDataGB,b:timeline.totalDataGB,unit:' GB'},
      {label:copy.cost,a:previous.timeline.finalCostM,b:timeline.finalCostM,unit:' M$'},
      {label:copy.finalHealth,a:previous.timeline.finalHealth*100,b:timeline.finalHealth*100,unit:'%'},
      {label:copy.completedDays,a:previous.timeline.completedDays,b:timeline.completedDays,unit:''},
    ].map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{f(row.a)}{row.unit}</td><td>{f(row.b)}{row.unit}</td><td>{row.b-row.a>0?'+':''}{f(row.b-row.a)}{row.unit}</td></tr>)}</tbody></table></div></section>}
    <section className="panel report-detail"><details><summary>{copy.scoreDetails}</summary><ul>{score.explanations.map(item=><li key={item.category}>{l(item.text)}</li>)}</ul></details><details><summary>{copy.allEvents}</summary><ol>{timeline.events.map(event=><li key={event.id}><strong>D+{event.day} · {l(event.title)}</strong><p>{l(event.consequence)}</p></li>)}</ol></details></section>
    <footer className="report-footer"><div className="report-export-actions"><button className="button button-secondary" onClick={()=>window.print()}><FileText size={16}/>{copy.print}</button><button className="button button-secondary" onClick={()=>{setExportStatus('');void downloadSummary(timeline,score,copy,lang).then(()=>setExportStatus(copy.download)).catch(()=>setExportStatus(copy.exportError));}}><Download size={16}/>{copy.exportPng}</button></div><p className="sim-muted">{copy.printHint}</p><p role="status">{exportStatus}</p><p className="sim-disclaimer">{copy.simulationDisclaimer}</p></footer>
  </article>;
}
export default ReportView;
