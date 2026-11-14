import { useId } from 'react';
import { Crosshair, Radio } from 'lucide-react';
import { orbits } from '../../../shared/index';
import { useGame } from '../store';
import { useI18n } from '../i18n';
import { useDesignCopy, number } from '../designCopy';

export function OrbitView({ hero = false }: { hero?: boolean }) {
  const design = useGame(s => s.design);
  const { l } = useI18n();
  const c = useDesignCopy();
  const rawId = useId().replaceAll(':', '');
  const id = `world${rawId}`;
  const orbit = orbits.find(o => o.id === design.orbitId) ?? orbits[0];
  const deepSpace = ['l2', 'lunar', 'mars'].includes(orbit.id);
  return <div className={`orbit-visual ${hero ? 'orbit-hero' : ''}`}>
    <div className="orbit-label"><span className="eyebrow">{c.flightPath}</span><span className="orbit-status"><span className="status-dot" /> {orbit.id.toUpperCase()}</span></div>
    <svg viewBox="0 0 600 400" role="img" aria-label={c.orbitVisual} className="orbit-svg">
      <defs>
        <radialGradient id={`${id}-halo`}><stop offset="0" stopColor="#37a9c8" stopOpacity=".28" /><stop offset=".65" stopColor="#238cb4" stopOpacity=".10" /><stop offset="1" stopColor="#193051" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-globe`} cx="28%" cy="24%" r="84%"><stop offset="0" stopColor="#287d94"/><stop offset=".40" stopColor="#134d69"/><stop offset=".8" stopColor="#102d48"/><stop offset="1" stopColor="#071626"/></radialGradient>
        <linearGradient id={`${id}-land`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#63b7ba"/><stop offset="1" stopColor="#235d76"/></linearGradient>
        <linearGradient id={`${id}-shadow`}><stop offset="0" stopColor="#010b16" stopOpacity="0"/><stop offset=".6" stopColor="#010b16" stopOpacity="0"/><stop offset="1" stopColor="#010b16" stopOpacity=".8"/></linearGradient>
        <clipPath id={`${id}-clip`}><circle cx="300" cy="200" r="111"/></clipPath>
        <filter id={`${id}-glow`}><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <g className="star-field" fill="#a5c6de">
        {Array.from({length:38}, (_, i) => <circle key={i} cx={22 + (i*83)%558} cy={26 + (i*53)%346} r={i%5 === 0 ? 1.1 : .6} opacity={.15+(i%4)*.15} />)}
      </g>
      <circle cx="300" cy="200" r="194" fill={`url(#${id}-halo)`}/>
      <g fill="none" stroke="#254151" strokeWidth=".8" opacity=".65"><circle cx="300" cy="200" r="155"/><circle cx="300" cy="200" r="182" strokeDasharray="2 6"/><path d="M65 200h470M300 20v360" strokeDasharray="3 8"/><path d="M95 52v13h13m384-13v13h-13M95 348v-13h13m384 13v-13h-13" stroke="#507989"/></g>
      <ellipse cx="300" cy="200" rx={deepSpace ? 246 : 205} ry={deepSpace ? 83 : 64} transform="rotate(-28 300 200)" fill="none" stroke="#58d5dc" strokeWidth="1" strokeDasharray="4 5" opacity=".48"/>
      <ellipse cx="300" cy="200" rx="151" ry="75" transform="rotate(55 300 200)" fill="none" stroke="#91b4c8" strokeWidth=".7" opacity=".23"/>
      <circle cx="300" cy="200" r="115" fill="none" stroke="#61c9e0" strokeWidth="2" opacity=".18" filter={`url(#${id}-glow)`}/>
      <circle cx="300" cy="200" r="112" fill={`url(#${id}-globe)`} stroke="#4b97b2" strokeWidth=".8"/>
      <g clipPath={`url(#${id}-clip)`}>
        <g fill={`url(#${id}-land)`} opacity=".75">
          <path d="M188 124l29-13 15 10 22-5 15 12 21 3 9 15-11 11-3 17-17 3-8 21-11 6-12-14-16-4-5-18-21-8-9-19Z"/>
          <path d="m253 198 14-3 20 11 9 20-7 19 2 19-15 25-14 13-5-24-10-12 5-19-8-20Z"/>
          <path d="m292 97 20 2 9 12-7 20-14 11-9-13-9-12Z"/>
          <path d="m324 140 16-10 14 3 9-12 22-4 26 19 13 28-18 5-12-13-20 3-10 15-12-1-6 11-15-6-15 2-6-13 12-11Z"/>
          <path d="m327 179 24 2 18 18 0 16-11 12-10 28-16 12-8-21-11-15 0-16-11-14 9-17Z"/>
          <path d="m374 225 19-6 13 12 16 11-2 20-15 9-17-10-18-2Z"/>
          <path d="m293 309 22-4 30 4 5 13-68 4-17-13Z"/>
        </g>
        <g fill="none" stroke="#80c6ce" opacity=".13" strokeWidth=".8"><ellipse cx="300" cy="200" rx="58" ry="111"/><ellipse cx="300" cy="200" rx="94" ry="111"/><path d="M188 200h224M200 150q100 22 200 0M200 250q100-22 200 0M233 111q67 19 134 0M233 289q67-19 134 0"/></g>
        <circle cx="300" cy="200" r="112" fill={`url(#${id}-shadow)`}/>
        <path d="M211 144q59-50 117-32M209 162q26-35 59-32M347 264q23-12 34-36" fill="none" stroke="#a6dbe1" strokeWidth="5" opacity=".09"/>
      </g>
      <path d="M125 281C191 311 369 247 463 141" fill="none" stroke="#58d5dc" strokeWidth="1.2" opacity=".8"/>
      <path d="m436 156 10-17 16 2" fill="none" stroke="#74f2ec" strokeWidth="1.2"/>
      <g transform="translate(445 140) rotate(-24)" className="orbit-spacecraft"><path d="M-38-10h24v20h-24zM14-10h24v20H14z" fill="#184970" stroke="#77b7db" strokeWidth=".8"/><path d="M-30-10v20m8-20v20m44-20v20m8-20v20M-38 0h24m28 0h24" stroke="#78adc9" strokeWidth=".5"/><path d="M-14-2h28v4h-28z" fill="#9eb9c8"/><path d="M-10-12h20v24h-20z" fill="#d4d8ca" stroke="#faf3c9" strokeWidth=".8"/><path d="M-5-12h10v24H-5z" fill="#bc9d6b"/><circle cy="-17" r="5" fill="#e6ecdf"/><path d="M0-22v-6" stroke="#e6ecdf"/></g>
      <g fill="none" stroke="#ffa965" opacity=".85"><circle cx="243" cy="176" r="3"/><circle cx="243" cy="176" r="7" opacity=".45"/><path d="M239 171 179 104h-57" strokeWidth=".7"/><path d="M450 121 480 87h45" strokeWidth=".7"/></g>
      <g fill="#8facbf" fontFamily="sans-serif" fontSize="9"><text x="121" y="96">19.43° N / 99.13° W</text><text x="483" y="80">FRONTIER–01</text><text x="290" y="334" letterSpacing="3">{c.earth}</text></g>
      {deepSpace && <circle cx="524" cy="238" r="15" fill={orbit.id === 'mars' ? '#b66f52' : '#7c899b'} opacity=".8"/>}
    </svg>
    <div className="orbit-stats"><span><Crosshair size={13}/>{number(orbit.altitudeKm,0)} <small>KM</small></span><span><Radio size={13}/>{number(orbit.contactMinutesPerDay)} <small>MIN{c.perDay.toUpperCase()}</small></span><span className="orbit-note">{l(orbit.name)}</span></div>
  </div>;
}
