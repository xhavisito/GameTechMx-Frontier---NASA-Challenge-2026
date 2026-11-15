import { lazy, Suspense, useEffect, useState } from 'react';
import { isMuted, setMuted, sfx, unlockAudio } from './world/audio';

const Adventure = lazy(() => import('./world/Adventure'));
const Science = lazy(() => import('./world/science').then(m => ({ default: m.Science })));

function initialLang(): 'es' | 'en' {
  try { const v = localStorage.getItem('frontier-lang'); if (v === 'es' || v === 'en') return v; } catch { /* private mode */ }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** The whole game is one open world: it starts on Earth and goes straight to playing. */
export function App() {
  const [lang, setLang] = useState<'es' | 'en'>(initialLang);
  const [run, setRun] = useState(0);
  const [sci, setSci] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  useEffect(() => {   // browsers only allow sound after a first tap or key; every button click gets a small blip
    const first = () => unlockAudio(), click = (e: Event) => { if ((e.target as HTMLElement | null)?.closest('button')) sfx('ui'); };
    window.addEventListener('pointerdown', first, { once: true }); window.addEventListener('keydown', first, { once: true }); document.addEventListener('click', click);
    return () => { window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); document.removeEventListener('click', click); };
  }, []);
  useEffect(() => { document.documentElement.lang = lang; try { localStorage.setItem('frontier-lang', lang); } catch { /* private mode */ } }, [lang]);
  return <>
    <Suspense fallback={<div className="app-loading">{lang === 'es' ? 'Cargando…' : 'Loading…'}</div>}>
      <Adventure key={run} es={lang === 'es'} onExit={() => setRun(r => r + 1)} />
    </Suspense>
    <button className="sci-btn" onClick={() => setSci(true)}>{lang === 'es' ? 'Ciencia y fuentes' : 'Science & sources'}</button>
    {sci && <Suspense fallback={null}><Science es={lang === 'es'} onClose={() => setSci(false)} /></Suspense>}
    <button className="mute-btn" onClick={() => { const m = !muted; setMuted(m); setMutedState(m); if (!m) { unlockAudio(); sfx('ui'); } }} aria-label={lang === 'es' ? (muted ? 'Activar sonido' : 'Silenciar') : (muted ? 'Turn sound on' : 'Mute')} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</button>
    <button className="lang-btn" onClick={() => setLang(l => (l === 'es' ? 'en' : 'es'))} aria-label="Language">{lang === 'es' ? 'EN' : 'ES'}</button>
  </>;
}
