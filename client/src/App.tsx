import { lazy, Suspense, useEffect, useState } from 'react';

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
  useEffect(() => { document.documentElement.lang = lang; try { localStorage.setItem('frontier-lang', lang); } catch { /* private mode */ } }, [lang]);
  return <>
    <Suspense fallback={<div className="app-loading">{lang === 'es' ? 'Cargando…' : 'Loading…'}</div>}>
      <Adventure key={run} es={lang === 'es'} onExit={() => setRun(r => r + 1)} />
    </Suspense>
    <button className="sci-btn" onClick={() => setSci(true)}>{lang === 'es' ? 'Ciencia y fuentes' : 'Science & sources'}</button>
    {sci && <Suspense fallback={null}><Science es={lang === 'es'} onClose={() => setSci(false)} /></Suspense>}
    <button className="lang-btn" onClick={() => setLang(l => (l === 'es' ? 'en' : 'es'))} aria-label="Language">{lang === 'es' ? 'EN' : 'ES'}</button>
  </>;
}
