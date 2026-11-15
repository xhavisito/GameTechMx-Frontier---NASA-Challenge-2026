/** Tiny WebAudio synth: sound effects and a soft generative loop per world. No files to download.
 *  Safe to import anywhere: in tests or browsers without audio every call quietly does nothing. */
export type Sfx = 'ui' | 'coin' | 'goal' | 'shoot' | 'hurt' | 'kill' | 'wave' | 'steal' | 'beep' | 'go' | 'launch' | 'win' | 'fail' | 'boss' | 'unlock' | 'ramp';
export type Theme = 'earth' | 'mars' | 'jupiter' | 'miller' | 'calm' | null;

const KEY = 'frontier-mute';
let ctx: AudioContext | null = null, master: GainNode | null = null, musicBus: GainNode | null = null;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
const last: Record<string, number> = {};

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const w = typeof window !== 'undefined' ? (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }) : null;
  const AC = w?.AudioContext ?? w?.webkitAudioContext; if (!AC) return null;
  try {
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.35; musicBus.connect(master);
  } catch { ctx = null; }
  return ctx;
}
/** Browsers only allow sound after a tap or key press, so the app calls this on the first one. */
export function unlockAudio() { const c = ensure(); if (c && c.state === 'suspended') void c.resume(); }
export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m; try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* private mode */ }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.03);
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, to?: number, delay = 0, bus?: GainNode | null) {
  const c = ensure(); if (!c || !master) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus ?? master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, vol: number, hp = 400, delay = 0) {
  const c = ensure(); if (!c || !master) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + delay;
  s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

export function sfx(name: Sfx) {
  if (muted || !ensure()) return;
  const now = performance.now(); if (now - (last[name] ?? -1e9) < (name === 'shoot' ? 70 : 40)) return; last[name] = now;
  switch (name) {
    case 'ui': tone(660, 0.07, 'square', 0.12); break;
    case 'coin': tone(988, 0.07, 'square', 0.14); tone(1319, 0.16, 'square', 0.14, undefined, 0.07); break;
    case 'goal': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, undefined, i * 0.09)); noise(0.5, 0.1, 2000, 0.1); break;
    case 'shoot': tone(900, 0.12, 'sawtooth', 0.1, 220); break;
    case 'hurt': tone(180, 0.25, 'sawtooth', 0.22, 60); noise(0.2, 0.15, 300); break;
    case 'kill': tone(400, 0.18, 'square', 0.15, 90); noise(0.15, 0.12, 800); break;
    case 'wave': [220, 196, 220].forEach((f, i) => tone(f, 0.25, 'square', 0.14, undefined, i * 0.22)); break;
    case 'steal': tone(700, 0.3, 'triangle', 0.18, 200); break;
    case 'beep': tone(520, 0.12, 'square', 0.16); break;
    case 'go': tone(1040, 0.5, 'square', 0.18); break;
    case 'launch': noise(3.2, 0.28, 120); tone(70, 3, 'sawtooth', 0.2, 180); break;
    case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, undefined, i * 0.1)); break;
    case 'fail': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, undefined, i * 0.18)); break;
    case 'boss': tone(90, 0.9, 'sawtooth', 0.28, 50); tone(95, 0.9, 'square', 0.15, 55, 0.05); noise(0.6, 0.12, 100); break;
    case 'unlock': [784, 988, 1175].forEach((f, i) => tone(f, 0.2, 'sine', 0.2, undefined, i * 0.08)); break;
    case 'ramp': tone(300, 0.35, 'triangle', 0.18, 900); break;
  }
}

// ── music: a slow generative loop, different scale and mood for each place ──
interface Mood { root: number; scale: number[]; bpm: number; wave: OscillatorType; vol: number }
const MOODS: Record<Exclude<Theme, null>, Mood> = {
  earth: { root: 261.6, scale: [0, 2, 4, 7, 9], bpm: 104, wave: 'triangle', vol: 0.12 },
  calm: { root: 220, scale: [0, 2, 4, 7, 9], bpm: 80, wave: 'sine', vol: 0.1 },
  mars: { root: 146.8, scale: [0, 3, 5, 7, 10], bpm: 88, wave: 'triangle', vol: 0.12 },
  jupiter: { root: 220, scale: [0, 3, 5, 7, 10], bpm: 96, wave: 'sine', vol: 0.12 },
  miller: { root: 110, scale: [0, 2, 3, 7, 8], bpm: 66, wave: 'sine', vol: 0.13 },
};
let theme: Theme = null, timer: ReturnType<typeof setInterval> | undefined, step = 0, nextT = 0, seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function schedule() {
  const c = ctx; if (!c || !theme || muted) return;
  const m = MOODS[theme], beat = 60 / m.bpm / 2;
  if (nextT < c.currentTime) nextT = c.currentTime + 0.05;
  while (nextT < c.currentTime + 0.4) {
    const d = nextT - c.currentTime;
    if (step % 8 === 0) tone(m.root / 2 * 2 ** (m.scale[(step / 8) % m.scale.length | 0]! / 12), beat * 6, 'sine', m.vol * 0.9, undefined, d, musicBus);   // slow bass note
    if (step % 2 === 0 && rnd() < 0.7) tone(m.root * 2 ** ((m.scale[Math.floor(rnd() * m.scale.length)]! + (rnd() < 0.3 ? 12 : 0)) / 12), beat * 1.6, m.wave, m.vol, undefined, d, musicBus);
    step++; nextT += beat;
  }
}
export function setTheme(t: Theme) {
  if (t === theme) return; theme = t; clearInterval(timer); timer = undefined;
  if (!t) return;
  seed = t.length * 7919; step = 0; nextT = 0;
  if (ensure()) timer = setInterval(schedule, 120);
}
