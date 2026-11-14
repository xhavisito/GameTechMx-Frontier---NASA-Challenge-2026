import { useEffect } from 'react';
import { useGame } from '../store';
import { perform, type GameAction } from './actions';
import { cameraAxes, touchAxes, useInput } from './inputStore';
import { activateFocused, moveFocus, stepNumber, stepSelect, type Direction } from './spatialNav';

/**
 * Keyboard map (ignored while typing in a text field):
 *   W A S D / arrows on the 3D view → orbit camera · Q E or - + → zoom · C → reset camera
 *   Z / X or PageUp / PageDown → previous / next design step · Enter → primary action
 *   Space → play / pause · 1 2 → event responses · T → simulation speed · V → hide 3D view · H or ? → help
 */
const keyActions: Record<string, GameAction> = {
  z: 'prev', pageup: 'prev', x: 'next', pagedown: 'next', ' ': 'togglePlay', '1': 'choice1', '2': 'choice2',
  t: 'cycleSpeed', h: 'help', '?': 'help', c: 'resetCamera', escape: 'back', v: 'toggleViewport',
};
const cameraKeys = new Set(['w', 'a', 's', 'd', 'q', 'e', '-', '+', '=', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

/** Standard gamepad mapping (Xbox / PlayStation / Switch Pro in browsers). */
const Btn = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Select: 8, Start: 9, L3: 10, R3: 11, Up: 12, Down: 13, Left: 14, Right: 15 } as const;
const DEAD = 0.2;
const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

function typing(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'range'].includes(target.type);
}

export function useGameInput() {
  useEffect(() => {
    const held = new Set<string>();
    const setDevice = useInput.getState().setDevice;
    document.body.dataset.input = useInput.getState().device;

    const onKeyDown = (e: KeyboardEvent) => {
      setDevice('keyboard');
      if (document.body.dataset.minigame) return; // the Java mission owns the keyboard
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (typing(e.target)) { if (key === 'escape') (e.target as HTMLElement).blur(); return; }
      const onSelect = e.target instanceof HTMLSelectElement;
      const inViewport = (e.target as HTMLElement | null)?.closest?.('.viewport-3d');
      // Arrow keys keep their native meaning (scroll, selects) unless the 3D view is focused.
      if (cameraKeys.has(key) && (!key.startsWith('arrow') || inViewport) && !onSelect) { held.add(key); if (inViewport) e.preventDefault(); return; }
      if (key === 'enter' && (inViewport || e.target === document.body)) { if (perform('primary')) e.preventDefault(); return; }
      const action = keyActions[key];
      if (action && !(key === ' ' && e.target instanceof HTMLButtonElement && useGame.getState().screen !== 'simulation')) {
        if (perform(action)) e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    const onBlur = () => held.clear();
    const onPointer = (e: PointerEvent) => setDevice(e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse');

    // ── Gamepad ────────────────────────────────────────────────────────────
    const previous: boolean[] = [];
    const repeatAt: number[] = [];
    let raf = 0;
    const onConnect = (e: GamepadEvent) => {
      const s = useInput.getState(); s.setGamepad(e.gamepad.id); s.setDevice('gamepad');
      s.notify(useGame.getState().language === 'es' ? 'Control conectado' : 'Controller connected');
    };
    const onDisconnect = () => { useInput.getState().setGamepad(null); };

    const pressButton = (b: number) => {
      const active = document.activeElement;
      const dir: Record<number, Direction> = { [Btn.Up]: 'up', [Btn.Down]: 'down', [Btn.Left]: 'left', [Btn.Right]: 'right' };
      if (dir[b]) {
        const d = dir[b]!;
        if (active instanceof HTMLSelectElement && (d === 'left' || d === 'right')) { stepSelect(active, d === 'left' ? -1 : 1); return; }
        if (active instanceof HTMLInputElement && active.type === 'number' && (d === 'left' || d === 'right')) { stepNumber(active, d === 'left' ? -1 : 1); return; }
        moveFocus(d); return;
      }
      switch (b) {
        case Btn.A: activateFocused(); break;
        case Btn.B: if (!perform('back') && active instanceof HTMLElement) active.blur(); break;
        case Btn.X: if (!perform('choice1')) perform('togglePlay'); break;
        case Btn.Y: if (!perform('choice2')) perform('help'); break;
        case Btn.LB: perform('prev'); break;
        case Btn.RB: if (!perform('next')) perform('cycleSpeed'); break;
        case Btn.Start: perform('primary'); break;
        case Btn.Select: perform('resetCamera'); break;
        case Btn.R3: perform('toggleViewport'); break;
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let yaw = 0, pitch = 0, zoom = 0;
      if (held.has('a') || held.has('arrowleft')) yaw -= 1;
      if (held.has('d') || held.has('arrowright')) yaw += 1;
      if (held.has('w') || held.has('arrowup')) pitch += 1;
      if (held.has('s') || held.has('arrowdown')) pitch -= 1;
      if (held.has('q') || held.has('-')) zoom += 1;
      if (held.has('e') || held.has('+') || held.has('=')) zoom -= 1;

      const pads = navigator.getGamepads?.() ?? [];
      const pad = [...pads].find(p => p && p.connected);
      if (pad && !document.body.dataset.minigame) {
        const lx = dz(pad.axes[0] ?? 0), ly = dz(pad.axes[1] ?? 0), ry = dz(pad.axes[3] ?? 0);
        const lt = pad.buttons[Btn.LT]?.value ?? 0, rt = pad.buttons[Btn.RT]?.value ?? 0;
        yaw += lx; pitch -= ly; zoom += lt - rt;
        if (ry) window.scrollBy({ top: ry * 18 });
        let any = !!(lx || ly || ry || lt > 0.1 || rt > 0.1);
        pad.buttons.forEach((button, i) => {
          const down = button.pressed;
          if (down) any = true;
          const repeatable = i >= Btn.Up && i <= Btn.Right;
          if (down && !previous[i]) { pressButton(i); repeatAt[i] = now + 380; }
          else if (down && repeatable && now >= (repeatAt[i] ?? Infinity)) { pressButton(i); repeatAt[i] = now + 110; }
          previous[i] = down;
        });
        if (any) { setDevice('gamepad'); if (!useInput.getState().gamepad) useInput.getState().setGamepad(pad.id); }
      }
      yaw += touchAxes.yaw; pitch += touchAxes.pitch; zoom += touchAxes.zoom;
      cameraAxes.yaw = Math.max(-1, Math.min(1, yaw));
      cameraAxes.pitch = Math.max(-1, Math.min(1, pitch));
      cameraAxes.zoom = Math.max(-1, Math.min(1, zoom));
    };
    raf = requestAnimationFrame(loop);

    addEventListener('keydown', onKeyDown);
    addEventListener('keyup', onKeyUp);
    addEventListener('blur', onBlur);
    addEventListener('pointerdown', onPointer, { passive: true });
    addEventListener('gamepadconnected', onConnect);
    addEventListener('gamepaddisconnected', onDisconnect);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('blur', onBlur);
      removeEventListener('pointerdown', onPointer);
      removeEventListener('gamepadconnected', onConnect);
      removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);
}
