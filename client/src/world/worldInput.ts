import { useEffect, useRef } from 'react';

export interface WorldInput {
  throttle: number; steer: number; boost: boolean; camYaw: number; camPitch: number;
  collectPulse: boolean; scanPulse: boolean; exitPulse: boolean;
  /** touch joystick, written by the HUD */
  joyX: number; joyY: number; touchBoost: boolean;
  usingPad: boolean;
  /** vertical movement for the submarine: +1 up, -1 down */
  vert: number; touchUp: boolean; touchDown: boolean;
  /** weapon, and 'E held' for hold-to-repair objectives */
  firePulse: boolean; interactHeld: boolean; touchInteract: boolean;
}
export const blankInput = (): WorldInput => ({ throttle: 0, steer: 0, boost: false, camYaw: 0, camPitch: 0.35, collectPulse: false, scanPulse: false, exitPulse: false, joyX: 0, joyY: 0, touchBoost: false, usingPad: false, vert: 0, touchUp: false, touchDown: false, firePulse: false, interactHeld: false, touchInteract: false });

const dead = (v: number) => (Math.abs(v) < 0.14 ? 0 : v);

/** Keyboard + gamepad + touch merged into one mutable object read every frame by the scene. */
export function useWorldInput(opts: { sub?: boolean } = {}) {
  const sub = !!opts.sub;
  const inp = useRef<WorldInput>(blankInput());
  const keys = useRef(new Set<string>());
  const prevPad = useRef({ a: false, x: false, b: false, lb: false });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!keys.current.has(k)) {
        if (k === 'e' || k === 'enter' || (!sub && k === ' ')) inp.current.collectPulse = true;
        if (k === 'f') inp.current.scanPulse = true;
        if (k === 'r') inp.current.firePulse = true;
        if (k === 'escape') inp.current.exitPulse = true;
      }
      keys.current.add(k);
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); };
    const blur = () => keys.current.clear();
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, []);

  /** Call once per frame before using the input. */
  const poll = (dt: number) => {
    const i = inp.current, k = keys.current;
    let t = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    let s = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let boost = k.has('shift');
    let cy = (k.has('l') ? 1 : 0) - (k.has('j') ? 1 : 0);
    let vert = sub ? (k.has(' ') || k.has('q') ? 1 : 0) - (k.has('c') || k.has('z') ? 1 : 0) : 0;
    let padHeld = false;
    const pad = (navigator.getGamepads?.() ?? []).find(p => p && p.connected);
    if (pad) {
      const ax = (n: number) => dead(pad.axes[n] ?? 0), bt = (n: number) => !!pad.buttons[n]?.pressed;
      const lx = ax(0), ly = ax(1);
      if (lx || ly || bt(0) || bt(2)) i.usingPad = true;
      t += -ly + (sub ? 0 : (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0) * 0.6);
      if (sub) vert += (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0) + (bt(3) ? 1 : 0) - (bt(2) ? 1 : 0);
      s += lx + (bt(15) ? 1 : 0) - (bt(14) ? 1 : 0);
      boost = boost || bt(5) || bt(1);
      cy += ax(2);
      i.camPitch = Math.max(0.1, Math.min(1.1, i.camPitch + ax(3) * dt * 1.2));
      const a = bt(0), x = bt(2), b = bt(9), lb = bt(4);
      if (a && !prevPad.current.a) i.collectPulse = true;
      if (lb && !prevPad.current.lb) i.firePulse = true;
      padHeld = a;
      if (x && !prevPad.current.x) i.scanPulse = true;
      if (b && !prevPad.current.b) i.exitPulse = true;
      prevPad.current = { a, x, b, lb };
    }
    i.interactHeld = k.has('e') || k.has('enter') || (!sub && k.has(' ')) || padHeld || i.touchInteract;
    if (sub) vert += (i.touchUp ? 1 : 0) - (i.touchDown ? 1 : 0);
    i.vert = Math.max(-1, Math.min(1, vert));
    t += -i.joyY; s += i.joyX; boost = boost || i.touchBoost;
    i.throttle = Math.max(-1, Math.min(1, t)); i.steer = Math.max(-1, Math.min(1, s)); i.boost = boost;
    i.camYaw += cy * dt * 1.8;
    // the camera drifts back behind the rover when not being steered
    if (!cy) i.camYaw *= Math.max(0, 1 - dt * 1.5);
  };
  return { inp, poll };
}
