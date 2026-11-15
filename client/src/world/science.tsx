import { useEffect, useRef, useState } from 'react';
import { BACKING_LABEL, GROUPS, SOURCES, type Group } from './sources';
import './science.css';

/** "Ciencia y fuentes": one card per resource with NASA link, fact, screen, simplification and game parameters. */
export function Science({ es, onClose }: { es: boolean; onClose: () => void }) {
  const [group, setGroup] = useState<Group | 'all'>('all');
  const body = useRef<HTMLDivElement>(null);
  const t = (l: { es: string; en: string }) => (es ? l.es : l.en);

  useEffect(() => {
    // The game keeps listening to the window; while this is open only Esc (and native scrolling/Tab) should work.
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', e => e.stopPropagation(), true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);

  useEffect(() => {
    // Gamepad: B closes, stick or d-pad scrolls.
    let raf = 0, was = false;
    const tick = () => {
      const pad = (navigator.getGamepads?.() ?? []).find(p => p && p.connected);
      if (pad) {
        const b = !!pad.buttons[1]?.pressed;
        if (b && !was) onClose();
        was = b;
        const dy = (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0) || (Math.abs(pad.axes[1] ?? 0) > 0.3 ? pad.axes[1]! : 0);
        if (dy && body.current) body.current.scrollTop += dy * 14;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onClose]);

  const shown = SOURCES.filter(s => group === 'all' || s.group === group);
  return (
    <div className="sci-back" role="dialog" aria-modal="true" aria-label={es ? 'Ciencia y fuentes' : 'Science and sources'} data-testid="science">
      <div className="sci-card">
        <header className="sci-head">
          <h2>{es ? 'Ciencia y fuentes' : 'Science and sources'}</h2>
          <button className="w-btn sci-close" onClick={onClose} autoFocus aria-label={es ? 'Cerrar' : 'Close'}>✕</button>
        </header>
        <p className="sci-note">
          {es
            ? 'GameTechMx Frontier es un juego independiente, sin relación con NASA ni respaldo suyo. Los enlaces llevan a páginas públicas de NASA que leímos para inspirarnos. Todo número sin respaldo se marca como "parámetro de juego".'
            : 'GameTechMx Frontier is an independent game, not affiliated with or endorsed by NASA. Links go to public NASA pages we read for inspiration. Any number without backing is marked as a "game parameter".'}
        </p>
        <nav className="sci-tabs" aria-label={es ? 'Secciones' : 'Sections'}>
          <button className={`sci-tab${group === 'all' ? ' on' : ''}`} onClick={() => setGroup('all')}>{es ? 'Todo' : 'All'}</button>
          {GROUPS.map(g => <button key={g.id} className={`sci-tab${group === g.id ? ' on' : ''}`} onClick={() => setGroup(g.id)}>{t(g.name)}</button>)}
        </nav>
        <div className="sci-body" ref={body} tabIndex={0}>
          {shown.map(s => (
            <article key={s.id} className={`sci-item b-${s.backing}`} data-testid={`src-${s.id}`}>
              <h3>{t(s.name)} <span className="sci-badge">{t(BACKING_LABEL[s.backing])}</span></h3>
              <dl>
                <dt>{es ? 'Dato o concepto' : 'Fact or concept'}</dt><dd>{t(s.fact)}</dd>
                <dt>{es ? 'Dónde influye' : 'Where it matters'}</dt><dd>{t(s.screen)}</dd>
                <dt>{es ? 'Qué simplificamos' : 'What we simplified'}</dt><dd>{t(s.simplification)}</dd>
              </dl>
              {s.params.length > 0 && (
                <div className="sci-params">
                  <b>{es ? 'Parámetros de juego (sin respaldo NASA)' : 'Game parameters (no NASA backing)'}</b>
                  <ul>{s.params.map((p, i) => <li key={i}>{t(p)}</li>)}</ul>
                </div>
              )}
              {s.links.length > 0
                ? <ul className="sci-links">{s.links.map(l => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.title} ↗</a></li>)}</ul>
                : <p className="sci-nolink">{es ? 'Sin enlace NASA: no hay fuente que lo respalde.' : 'No NASA link: no source backs this.'}</p>}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
