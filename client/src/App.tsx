import { Languages, Satellite, Wifi, WifiOff } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { DesignView } from './components/DesignView';
import { ExtrasPanel } from './components/ExtrasPanel';
import { Landing } from './components/Landing';
import { ReportView } from './components/ReportView';
import { SimulationView } from './components/SimulationView';
import { TeamPanel } from './components/TeamPanel';
import { ControlBar, HelpOverlay, Toast } from './components/GameControls';
import { useGameInput } from './input/useGameInput';
import { useGame } from './store';
import { useTeam } from './teamStore';

export function App() {
  const game = useGame();
  const team = useTeam();
  const connected = team.connection === 'connected';
  useGameInput();
  const overlays = <><ControlBar/><HelpOverlay/><Toast/></>;
  if (game.screen === 'home') return <><Landing />{overlays}</>;
  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => {team.leave();game.setScreen('home');}} aria-label="GameTechMx Frontier home"><span className="brand-mark"><Satellite size={20}/></span><span><b>GameTechMx</b> Frontier<small>MISSION DESIGN LAB</small></span></button>
      <div className="top-actions">
        {game.mode !== 'solo' && <span className={`status-pill ${connected?'online':''}`}>{connected?<Wifi size={13}/>:<WifiOff size={13}/>} {team.room?.code ?? (game.language==='es'?'Sin sala':'No room')}</span>}
        <ExtrasPanel />
        <button className="language" onClick={() => game.setLanguage(game.language==='es'?'en':'es')}><Languages size={15}/>{game.language==='es'?'EN':'ES'}</button>
      </div>
    </header>
    <div className="mission-strip"><span>GTX / {game.design.name}</span><span>{game.screen.toUpperCase()}</span><span>SEED {game.seed}</span></div>
    {game.screen === 'design' && <div className="workspace"><DesignView/><aside className="dashboard-rail"><Dashboard/><TeamPanel/></aside></div>}
    {game.screen === 'simulation' && <div className="workspace simulation-workspace"><SimulationView/><aside className="dashboard-rail"><Dashboard/><TeamPanel/></aside></div>}
    {game.screen === 'report' && <div className="workspace report-workspace"><ReportView/><aside className="dashboard-rail"><Dashboard/><TeamPanel/></aside></div>}
    {overlays}
  </div>;
}
