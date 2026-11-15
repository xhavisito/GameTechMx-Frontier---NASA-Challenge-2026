import { useEffect, useState, type ReactNode } from 'react';
import { mergeResults } from './coop';
import type { MarsResult } from './marsWorld';
import type { Player } from './worldInput';

/** Split-screen: two copies of the same world and mission, one vehicle per player. The team result is merged when both have finished. */
export function CoopRun({ es, render, onDone, onExit }: { es: boolean; render: (p: Player, onDone: (r: MarsResult) => void) => ReactNode; onDone: (r: MarsResult) => void; onExit: () => void }) {
  const [res, setRes] = useState<(MarsResult | null)[]>([null, null]);
  const put = (i: number) => (r: MarsResult) => setRes(a => { const n = [...a]; n[i] = r; return n; });
  useEffect(() => { if (res[0] && res[1]) onDone(mergeResults(res[0], res[1])); }, [res]);   // eslint-disable-line react-hooks/exhaustive-deps
  void onExit;
  useEffect(() => { document.body.classList.add('coop-on'); return () => document.body.classList.remove('coop-on'); }, []);
  const tags = [es ? 'J1 · WASD · E recoger · R disparar' : 'P1 · WASD · E collect · R fire', es ? 'J2 · Flechas · Enter recoger · / disparar' : 'P2 · Arrows · Enter collect · / fire'];
  return <div className="coop-split">{([1, 2] as Player[]).map(p => <div key={p} className={`coop-half p${p}`}>
    {res[p - 1] ? <div className="coop-wait"><h3>{es ? `Jugador ${p} listo ✔` : `Player ${p} done ✔`}</h3><p>{es ? 'Esperando al otro jugador…' : 'Waiting for the other player…'}</p></div> : render(p, put(p - 1))}
    <span className="coop-tag">{tags[p - 1]}</span>
  </div>)}</div>;
}
