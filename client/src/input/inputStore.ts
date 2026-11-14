import { create } from 'zustand';

export type InputDevice = 'keyboard' | 'mouse' | 'touch' | 'gamepad';

/**
 * Continuous camera axes, written every frame by the input loop (keyboard and
 * gamepad) and read by the 3D camera rig. Kept outside React state on purpose:
 * it changes 60 times per second.
 */
export const cameraAxes = { yaw: 0, pitch: 0, zoom: 0 };
/** One-shot deltas from pointer drags / pinches; the rig consumes and zeroes them. */
export const cameraImpulse = { yaw: 0, pitch: 0, zoom: 0, reset: 0 };

export const speeds = [1, 3, 8, 20] as const;

interface InputState {
  device: InputDevice;
  gamepad: string | null;
  helpOpen: boolean;
  playing: boolean;
  speed: number;
  viewportCollapsed: boolean;
  toast: { id: number; text: string } | null;
  setDevice: (device: InputDevice) => void;
  setGamepad: (name: string | null) => void;
  setHelp: (open: boolean) => void;
  setPlaying: (playing: boolean) => void;
  cycleSpeed: () => void;
  setSpeed: (speed: number) => void;
  toggleViewport: () => void;
  notify: (text: string) => void;
}

export const useInput = create<InputState>((set, get) => ({
  device: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard',
  gamepad: null,
  helpOpen: false,
  playing: true,
  speed: 3,
  viewportCollapsed: false,
  toast: null,
  setDevice: (device) => { if (get().device !== device) { set({ device }); document.body.dataset.input = device; } },
  setGamepad: (gamepad) => set({ gamepad }),
  setHelp: (helpOpen) => set({ helpOpen }),
  setPlaying: (playing) => set({ playing }),
  cycleSpeed: () => { const i = speeds.indexOf(get().speed as typeof speeds[number]); set({ speed: speeds[(i + 1) % speeds.length] }); },
  setSpeed: (speed) => set({ speed }),
  toggleViewport: () => set({ viewportCollapsed: !get().viewportCollapsed }),
  notify: (text) => set({ toast: { id: Date.now(), text } }),
}));

export const resetCamera = () => { cameraImpulse.reset += 1; };

/** Held on-screen touch buttons (rotate / zoom), merged into cameraAxes by the input loop. */
export const touchAxes = { yaw: 0, pitch: 0, zoom: 0 };
