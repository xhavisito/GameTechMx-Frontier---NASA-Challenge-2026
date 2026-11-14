import { useGame } from '../store';
import { resetCamera, useInput } from './inputStore';

export type GameAction = 'prev' | 'next' | 'primary' | 'togglePlay' | 'cycleSpeed' | 'choice1' | 'choice2' | 'help' | 'resetCamera' | 'back' | 'toggleViewport';

export function pendingEvent() {
  const { timeline, simulationDay } = useGame.getState();
  return timeline?.events.find(e => e.day <= simulationDay && !e.responded) ?? null;
}

export function simulationEnded() {
  const { timeline, simulationDay } = useGame.getState();
  if (!timeline) return false;
  const last = timeline.days.at(-1)?.day ?? 0;
  return simulationDay >= last && !pendingEvent();
}

/** Context label for the primary action (Enter / Start / big touch button). */
export function primaryKind(): 'next' | 'launch' | 'play' | 'pause' | 'report' | 'redesign' | 'decide' | 'start' {
  const game = useGame.getState();
  if (game.screen === 'home') return 'start';
  if (game.screen === 'design') return game.step < 5 ? 'next' : 'launch';
  if (game.screen === 'simulation') {
    if (pendingEvent()) return 'decide';
    if (simulationEnded()) return 'report';
    return useInput.getState().playing ? 'pause' : 'play';
  }
  return 'redesign';
}

/** Runs a player action against the game store. Returns false when nothing applies. */
export function perform(action: GameAction): boolean {
  const game = useGame.getState();
  const input = useInput.getState();
  if (input.helpOpen && (action === 'back' || action === 'help')) { input.setHelp(false); return true; }
  switch (action) {
    case 'help': input.setHelp(true); return true;
    case 'resetCamera': resetCamera(); return true;
    case 'toggleViewport': input.toggleViewport(); return true;
    case 'cycleSpeed': if (game.screen !== 'simulation') return false; input.cycleSpeed(); return true;
    case 'prev':
    case 'back':
      if (game.screen === 'design' && game.step > 0) { game.setStep(game.step - 1); scrollTop(); return true; }
      return false;
    case 'next':
      if (game.screen === 'design' && game.step < 5) { game.setStep(game.step + 1); scrollTop(); return true; }
      return false;
    case 'togglePlay':
      if (game.screen !== 'simulation' || pendingEvent() || simulationEnded()) return false;
      input.setPlaying(!input.playing); return true;
    case 'choice1':
    case 'choice2': {
      const event = pendingEvent();
      const choice = event?.choices[action === 'choice1' ? 0 : 1];
      if (!event || !choice) return false;
      game.respond(event.id, choice.id); input.setPlaying(true); return true;
    }
    case 'primary': {
      const kind = primaryKind();
      if (kind === 'next') return perform('next');
      if (kind === 'launch') { game.launch(); input.setPlaying(true); scrollTop(); return true; }
      if (kind === 'play' || kind === 'pause') return perform('togglePlay');
      if (kind === 'report') { game.finish(); scrollTop(); return true; }
      if (kind === 'redesign' && game.screen === 'report') { game.redesign(); scrollTop(); return true; }
      return false;
    }
  }
}

function scrollTop() { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
