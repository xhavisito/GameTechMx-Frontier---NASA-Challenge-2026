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

/** Key sets. Solo play accepts everything; in split-screen co-op player 1 gets WASD and player 2 the arrows, so nobody steals the other's keys. */
const KEYS = {
  solo: { up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'], boost: ['shift'], collect: ['e', 'enter'], scan: ['f'], fire: ['r'], camL: ['j'], camR: ['l'], rise: ['q'], dive: ['c', 'z'] },
  p1: { up: ['w'], down: ['s'], left: ['a'], right: ['d'], boost: ['shift'], collect: ['e'], scan: ['f'], fire: ['r'], camL: ['j'], camR: ['l'], rise: ['q', ' '], dive: ['c', 'z'] },
  p2: { up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'], boost: ['0'], collect: ['enter'], scan: ['.'], fire: ['/'], camL: [','], camR: ['-'], rise: [';', 'pageup'], dive: ["'", 'pagedown'] },
};
export type Player = 1 | 2;
const has = (k: Set<string>, list: string[]) => list.some(x => k.has(x));

/** Keyboard + gamepad + touch merged into one mutable object read every frame by the scene. `player` is set only in split-screen co-op. */
export function useWorldInput(opts: { sub?: boolean; player?: Player } = {}) {
  const sub = !!opts.sub, player = opts.player;
  const map = KEYS[player === 1 ? 'p1' : player === 2 ? 'p2' : 'solo'];
  const inp = useRef<WorldInput>(blankInput());
  const keys = useRef(new Set<string>());
  const prevPad = useRef({ a: false, x: false, b: false, lb: false });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', '/', "'"].includes(k) && (!player || player === 2 || k === ' ')) e.preventDefault();
      if (!keys.current.has(k)) {
        if (map.collect.includes(k) || (!sub && !player && k === ' ') || (!sub && player === 1 && k === ' ')) inp.current.collectPulse = true;
        if (map.scan.includes(k)) inp.current.scanPulse = true;
        if (map.fire.includes(k)) inp.current.firePulse = true;
        if (k === 'escape' && player !== 2) inp.current.exitPulse = true;
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
    let t = (has(k, map.up) ? 1 : 0) - (has(k, map.down) ? 1 : 0);
    let s = (has(k, map.right) ? 1 : 0) - (has(k, map.left) ? 1 : 0);
    let boost = has(k, map.boost);
    let cy = (has(k, map.camR) ? 1 : 0) - (has(k, map.camL) ? 1 : 0);
    let vert = sub ? (has(k, map.rise) ? 1 : 0) - (has(k, map.dive) ? 1 : 0) : 0;
    let padHeld = false;
    // each player gets their own controller: the 1st connected pad is player 1 (or solo), the 2nd is player 2
    const pads = (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected), pad = player === 2 ? pads[1] : pads[0];
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
      if (b && !prevPad.current.b && player !== 2) i.exitPulse = true;
      prevPad.current = { a, x, b, lb };
    }
    i.interactHeld = has(k, map.collect) || (!sub && player !== 2 && k.has(' ')) || padHeld || i.touchInteract;
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
