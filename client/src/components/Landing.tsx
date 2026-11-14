import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Globe2, Orbit, Radio, Rocket, Sparkles, UserRound, UsersRound } from 'lucide-react';
import type { Difficulty, GameMode } from '../../../shared/types';
import { useGame } from '../store';
import { useDesignCopy } from '../designCopy';
import { OrbitView } from './OrbitView';
import { Viewport3D } from './Viewport3D';
import { useTeam } from '../teamStore';

export function Landing() {
  const c = useDesignCopy();
  const start = useGame(s => s.start);
  const setTutorial = useGame(s => s.setTutorial);
  const leaveTeam = useTeam(s => s.leave);
  const [mode,setMode] = useState<GameMode>('solo');
  const [difficulty,setDifficulty] = useState<Difficulty>('beginner');
  const modes = [{id:'solo' as const,icon:UserRound},{id:'local' as const,icon:UsersRound},{id:'online' as const,icon:Radio},{id:'sandbox' as const,icon:Sparkles}];
  const enter = (tutorial = false, scenario = 'cubesat') => { leaveTeam(); start(mode,difficulty,scenario); setTutorial(tutorial); };
  return <main className="landing">
    <section className="hero-content">
      <div className="hero-copy"><span className="hero-kicker"><span className="status-dot"/>{c.campaign}<span className="year-badge">2026</span></span>
        <h1>{c.headline1}<br/><span>{c.headline2}</span></h1>
        <p className="hero-description">{c.intro}</p>
        <div className="hero-tags"><span><Orbit size={14}/> 8 {c.steps[1].toLowerCase()}s</span><span><Rocket size={14}/> {c.built}</span></div>
      </div>
      <div className="hero-art"><Viewport3D mode="showcase" className="hero-viewport" fallback={<OrbitView hero/>}/></div>
    </section>
    <section className="mission-start panel" aria-label={c.configure}>
      <div className="mode-section"><h2 className="eyebrow">{c.chooseMode}</h2><div className="mode-grid">{modes.map(({id,icon:Icon}) => <button key={id} className={`mode-card ${mode === id ? 'is-selected' : ''}`} aria-pressed={mode === id} onClick={() => setMode(id)}><div className="mode-icon"><Icon size={20}/>{mode === id && <span className="selection-dot"/>}</div><strong>{c[id]}</strong><span>{c[`${id}Desc`]}</span></button>)}</div></div>
      <div className="start-bottom"><div className="difficulty-section"><h2 className="eyebrow">{c.chooseDifficulty}</h2><div className="segmented" role="group" aria-label={c.chooseDifficulty}>{(['beginner','intermediate','expert'] as const).map(level => <button key={level} aria-pressed={difficulty === level} className={difficulty === level ? 'active' : ''} onClick={() => setDifficulty(level)}>{c[level]}</button>)}</div><p>{c[`${difficulty}Desc`]}</p></div><div className="start-actions"><button className="button button-primary button-large" onClick={() => enter()}>{c.start}<ArrowRight size={18}/></button><button className="button button-secondary button-large mars-quick" onClick={() => enter(false,'mars')}><span className="mars-dot" aria-hidden="true"/>{c.start === 'Entrar a control de misión' ? 'Misión Marte' : 'Mars mission'}</button><button className="text-button" onClick={() => enter(true)}><BookOpen size={14}/>{c.learn}<ArrowUpRight size={13}/></button></div></div>
    </section>
    <div className="landing-footer"><div><Globe2 size={15}/><span>{c.footerNote}</span></div><span className="eyebrow">GameTechMx Frontier</span></div>
  </main>;
}
