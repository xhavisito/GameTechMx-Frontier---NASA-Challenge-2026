import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';

/** Worlds call this when the player is hit: a red edge flash on screen. */
export const hurt = () => { try { window.dispatchEvent(new Event('frontier-hurt')); } catch { /* ssr */ } };
export function HurtFlash() {
  const [k, setK] = useState(0);
  useEffect(() => { const f = () => setK(n => n + 1); window.addEventListener('frontier-hurt', f); return () => window.removeEventListener('frontier-hurt', f); }, []);
  return k > 0 ? <div key={k} className="w-hurt" aria-hidden="true" /> : null;
}
/** Wallet, always in the top-left corner. */
export function Money({ n, es }: { n: number; es: boolean }) {
  return <div className="w-money" role="status" aria-label={es ? `Dinero: ${n}` : `Money: ${n}`} title={es ? 'Tu dinero (chatarra)' : 'Your money (scrap)'}><Coins size={18} /><b>{n}</b></div>;
}
/** Camera viewfinder for photo missions. Turns green when the formation is framed and close enough. */
export function Viewfinder({ state, es, shots }: { state: 'ready' | 'far' | 'off' | 'none'; es: boolean; shots: number }) {
  return <>
    <div className={`w-vf ${state}`} aria-hidden="true"><i /><i /><i /><i /><span /></div>
    <div className={`w-vf-tip ${state}`}>{state === 'ready' ? (es ? '¡Encuadrada! Pulsa E para tomar la foto' : 'Framed! Press E to take the photo') : state === 'far' ? (es ? 'Muy lejos: acércate a la formación' : 'Too far: get closer to the formation') : state === 'off' ? (es ? 'Gira el rover para centrar la formación en el visor' : 'Turn the rover to center the formation in the viewfinder') : (es ? 'Busca una formación rocosa (sigue la flecha)' : 'Look for a rock formation (follow the arrow)')}</div>
    {shots > 0 && <div key={shots} className="w-flash" aria-hidden="true" />}
  </>;
}
