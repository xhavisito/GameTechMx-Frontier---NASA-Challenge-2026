import { create } from 'zustand';
import { createDefaultDesign, parseDesign, simulateMission, scoreMission, generateReport, scenarios } from '../../shared/index';
import type { Difficulty, GameMode, MissionDesign, MissionTimeline, ScoreBreakdown, MissionReport } from '../../shared/types';
export type Screen = 'home' | 'design' | 'simulation' | 'report';
export type TeamAction = {kind:'design';design:MissionDesign}|{kind:'launch'}|{kind:'response';eventId:string;choice:string}|{kind:'redesign'}|{kind:'advance';day:number}|{kind:'finish'}|{kind:'seed';seed:string};
let teamInterceptor: ((action:TeamAction)=>boolean)|null = null;
export const setTeamInterceptor = (handler:typeof teamInterceptor) => {teamInterceptor=handler;};
const intercept = (action:TeamAction) => teamInterceptor?.(action) ?? false;
export interface Result {timeline:MissionTimeline;score:ScoreBreakdown;report:MissionReport}
export interface Ranking {scenarioId:string;name:string;total:number;seed:string;date:string;difficulty:Difficulty;mode:GameMode}
export function readRanking():Ranking[] {try {const rows=JSON.parse(localStorage.getItem('frontier-ranking')||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.scenarioId==='string'&&typeof r.name==='string'&&Number.isFinite(r.total)&&typeof r.date==='string').slice(0,50):[];}catch{return [];}}
function recordResult(result:Result) {try {const d=result.timeline.design;const row={scenarioId:d.scenarioId,name:d.name,total:result.score.total,seed:result.timeline.seed,date:new Date().toISOString(),difficulty:d.difficulty,mode:d.mode};localStorage.setItem('frontier-ranking',JSON.stringify([row,...readRanking()].sort((a,b)=>b.total-a.total).slice(0,50)));}catch{/* Private browsing still permits completing a mission. */}}
function resultFor(timeline:MissionTimeline):Result {const score=scoreMission(timeline,scenarios.find(s=>s.id===timeline.design.scenarioId)!);return {timeline,score,report:generateReport(timeline,score)};}
function initial() {const fallback={design:createDefaultDesign(),seed:'FRONTIER-2026',screen:'home' as Screen};try {const hash=location.hash.slice(1);if(!hash.startsWith('mission='))return fallback;const encoded=hash.slice(8);if(encoded.length>20000)return fallback;const value=JSON.parse(decodeURIComponent(escape(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')))));const design=parseDesign(value.design);if(design&&typeof value.seed==='string'&&value.seed.length<=100)return {design:{...design,mode:'solo' as const,responses:{}},seed:value.seed,screen:'design' as Screen};}catch{/* Malformed shared URLs open a clean mission. */}return fallback;}
const boot=initial();
interface GameState {
 design:MissionDesign;mode:GameMode;difficulty:Difficulty;screen:Screen;step:number;language:'es'|'en';seed:string;tutorial:boolean;
 timeline:MissionTimeline|null;score:ScoreBreakdown|null;report:MissionReport|null;previous:Result|null;simulationDay:number;
 setDesign:(design:MissionDesign)=>void;patchDesign:(patch:Partial<MissionDesign>)=>void;setScreen:(screen:Screen)=>void;setStep:(step:number)=>void;setLanguage:(language:'es'|'en')=>void;setSeed:(seed:string)=>void;setTutorial:(tutorial:boolean)=>void;
 start:(mode:GameMode,difficulty:Difficulty,scenarioId?:string)=>void;launch:()=>void;respond:(eventId:string,choice:string)=>void;setSimulationDay:(day:number)=>void;finish:()=>void;redesign:()=>void;
 syncTeam:(room:{design:MissionDesign;seed:string|number;phase:'design'|'simulation'|'report';day:number})=>void;
}
export const useGame=create<GameState>((set,get)=>({
 ...boot,mode:boot.design.mode,difficulty:boot.design.difficulty,step:0,language:'es',tutorial:false,timeline:null,score:null,report:null,previous:null,simulationDay:0,
 setDesign:(design)=>{const valid=parseDesign(design);if(valid)set({design:valid,mode:valid.mode,difficulty:valid.difficulty});},
 patchDesign:(patch)=>{const design=parseDesign({...get().design,...patch,responses:{}});if(design&&!intercept({kind:'design',design}))set({design,mode:design.mode,difficulty:design.difficulty});},
 setScreen:(screen)=>set({screen}),setStep:(step)=>set({step:Math.max(0,Math.min(5,step))}),setLanguage:(language)=>{document.documentElement.lang=language;set({language});},
 setSeed:(seed)=>{const clean=seed.slice(0,100);if(!intercept({kind:'seed',seed:clean}))set({seed:clean});},setTutorial:(tutorial)=>set({tutorial}),
 start:(mode,difficulty,scenarioId)=>{teamInterceptor=null;const design=createDefaultDesign(scenarioId,difficulty,mode);set({design,mode,difficulty,screen:'design',step:0,timeline:null,score:null,report:null,previous:null,simulationDay:0});},
 launch:()=>{if(intercept({kind:'launch'}))return;const design={...get().design,responses:{}};const timeline=simulateMission(design,get().seed);set({design,timeline,screen:'simulation',simulationDay:0,score:null,report:null});},
 respond:(eventId,choice)=>{if(intercept({kind:'response',eventId,choice}))return;const current=get();const design={...current.design,responses:{...current.design.responses,[eventId]:choice}};set({design,timeline:simulateMission(design,current.seed)});},
 setSimulationDay:(day)=>{if(intercept({kind:'advance',day}))return;const timeline=get().timeline;set({simulationDay:Math.max(0,Math.min(timeline?.days.at(-1)?.day??0,Math.floor(day)))});},
 finish:()=>{if(intercept({kind:'finish'}))return;const timeline=get().timeline;if(!timeline)return;const result=resultFor(timeline);recordResult(result);set({...result,screen:'report'});},
 redesign:()=>{if(intercept({kind:'redesign'}))return;const {timeline,score,report,design}=get();set({previous:timeline&&score&&report?{timeline,score,report}:get().previous,design:{...design,responses:{}},screen:'design',step:0,simulationDay:0});},
 syncTeam:({design,seed,phase,day})=>{const current=get();const clean=parseDesign(design);if(!clean)return;const changed=JSON.stringify(current.design)!==JSON.stringify(clean)||current.seed!==String(seed);const previous=phase==='design'&&current.screen==='report'&&current.timeline&&current.score&&current.report?{timeline:current.timeline,score:current.score,report:current.report}:current.previous;
 const timeline=phase!=='design'&&(changed||!current.timeline)?simulateMission(clean,seed):current.timeline;
 const result=phase==='report'&&timeline?resultFor(timeline):null;if(result&&current.screen!=='report')recordResult(result);
 set({design:clean,seed:String(seed),mode:clean.mode,difficulty:clean.difficulty,screen:phase,simulationDay:day,timeline,previous,...(result?{score:result.score,report:result.report}:{})});}
}));
