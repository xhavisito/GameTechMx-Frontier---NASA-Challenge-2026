import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, LogOut, MessageSquare, Radio, Users, X } from 'lucide-react';
import { setTeamInterceptor, useGame } from '../store';
import { useTeam } from '../teamStore';
import { teamCollaboration } from '../../../shared/team';
import es from '../locales/team.es.json';
import en from '../locales/team.en.json';

export function TeamPanel() {
  const game = useGame();
  const team = useTeam();
  const copy = game.language === 'es' ? es : en;
  const [names,setNames] = useState(['Alex','Sam']);
  const [name,setName] = useState('Explorer');
  const [code,setCode] = useState('');
  const [endpoint,setEndpoint] = useState(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
  const [message,setMessage] = useState('');
  const [tab,setTab] = useState<'crew'|'decisions'|'chat'>('crew');
  const room = team.room;

  useEffect(() => {
    if (!room) { setTeamInterceptor(null); return; }
    setTeamInterceptor(action => { useTeam.getState().dispatch(action); return true; });
    return () => setTeamInterceptor(null);
  }, [room]);
  useEffect(() => {
    if (room) game.syncTeam({design:room.design,seed:room.seed,phase:room.phase,day:room.day});
  }, [room?.revision]);
  const evidence = useMemo(() => room ? teamCollaboration(room.proposals,room.players) : null,[room?.revision]);
  if (game.mode === 'solo' || game.mode === 'sandbox') return null;
  if (!room) return <section className="team-panel panel">
    <span className="eyebrow accent">{copy.eyebrow}</span><h2><Users size={17}/> {game.mode==='local'?copy.local:copy.online}</h2><p>{game.mode==='local'?copy.offlineHint:copy.onlineHint}</p>
    {team.error && <p className="launch-warning">{copy[`error_${team.error}` as keyof typeof copy] || team.error}</p>}
    {game.mode === 'local' ? <div className="team-grid">
      <label>{copy.crewSize}<select className="form-input" value={names.length} onChange={event=>setNames(Array.from({length:Number(event.target.value)},(_,i)=>names[i]||`${copy.player} ${i+1}`))}><option>2</option><option>3</option><option>4</option></select></label>
      {names.map((value,index)=><input key={index} aria-label={`${copy.name} ${index+1}`} value={value} maxLength={24} onChange={event=>setNames(names.map((item,i)=>i===index?event.target.value:item))}/>) }
      <button className="button button-primary" onClick={()=>team.initLocal(names,game.design,game.seed)}>{copy.startLocal}</button>
    </div> : <div className="team-grid">
      <label>{copy.server}<input value={endpoint} onChange={event=>setEndpoint(event.target.value)}/></label><small>{copy.serverHint}</small>
      <label>{copy.yourName}<input value={name} maxLength={24} onChange={event=>setName(event.target.value)}/></label>
      <label>{copy.roomCode}<input value={code} maxLength={6} onChange={event=>setCode(event.target.value.toUpperCase())}/></label>
      <div className="proposal-actions"><button className="button button-primary" onClick={()=>team.connectOnline(endpoint,name,game.design,game.seed)}>{copy.create}</button><button className="button button-secondary" onClick={()=>team.connectOnline(endpoint,name,game.design,game.seed,code)}>{copy.join}</button></div>
    </div>}
  </section>;
  const me = room.players.find(player=>player.id===team.playerId);
  const pending = room.proposals.find(proposal=>proposal.status==='pending');
  return <section className="team-panel panel">
    <div className="section-title"><div><span className="eyebrow accent">{copy.room} {room.code}</span><h2><Radio size={16}/> {copy.crew}</h2></div><button className="button button-secondary" title={copy.copy} onClick={()=>navigator.clipboard?.writeText(room.code)}><Copy size={14}/></button></div>
    <div className="team-tabs"><button onClick={()=>setTab('crew')}>{copy.crew}</button><button onClick={()=>setTab('decisions')}>{copy.pending}</button><button onClick={()=>setTab('chat')}>{copy.chat}</button></div>
    {team.error && <p className="launch-warning" role="alert">{copy[`error_${team.error}` as keyof typeof copy] || team.error}<button onClick={team.clearError}>×</button></p>}
    {tab==='crew' && <><div className="team-members">{room.players.map(player=><div className="team-member" key={player.id}><b>{player.name}</b> {player.id===team.playerId&&<small>({copy.you})</small>}<div>{player.roles.map(role=><span className="role-chip" key={role}>{copy[`role_${role}`]}</span>)}</div></div>)}</div><p className="footer-note">{copy.tradeoff}</p>{evidence&&<div className="option-stats"><span>{copy.resolved}: {evidence.resolvedConflicts}</span><span>{copy.participation}: {evidence.participants}/{room.players.length}</span></div>}{team.transport==='local'&&<button className="button button-secondary" onClick={()=>team.pass()}>{copy.pass}</button>}</>}
    {tab==='decisions' && (pending?<div className="proposal"><b>{copy[`proposal_${pending.kind}`]}</b><p>{copy.proposedBy} {room.players.find(player=>player.id===pending.authorId)?.name}</p><div>{room.players.map(player=><span className="role-chip" key={player.id}>{player.name}: {pending.votes[player.id]===true?copy.yes:pending.votes[player.id]===false?copy.no:copy.waiting}</span>)}</div>{!Object.hasOwn(pending.votes,team.playerId||'')&&<div className="proposal-actions"><button className="button button-primary" onClick={()=>team.vote(pending.id,true)}><Check size={14}/>{copy.approve}</button><button className="button button-secondary" onClick={()=>team.vote(pending.id,false)}><X size={14}/>{copy.reject}</button></div>}</div>:<p>{copy.noPending}</p>)}
    {tab==='chat'&&<><div className="team-chat">{room.chat.map(item=><div className="team-message" key={item.id}><b>{item.name}</b><p>{item.text}</p></div>)}</div><form className="proposal-actions" onSubmit={event=>{event.preventDefault();team.chat(message);setMessage('')}}><input className="form-input" value={message} maxLength={500} placeholder={copy.chatPlaceholder} onChange={event=>setMessage(event.target.value)}/><button className="button button-primary"><MessageSquare size={14}/></button></form></>}
    <button className="button button-secondary" onClick={team.leave}><LogOut size={14}/>{copy.leave}</button>
    {team.handoff&&<div className="handoff"><div><span className="eyebrow">{copy.handoff}</span><h2>{copy.handoffText}<br/>{me?.name}</h2><button className="button button-primary" onClick={team.ready}>{copy.ready}</button></div></div>}
  </section>;
}
