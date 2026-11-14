/** Directional focus movement so a gamepad D-pad can reach every control on screen. */
export type Direction = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function visible(el: HTMLElement) {
  if (el.closest('[inert], [aria-hidden="true"]')) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

export function focusables(root: ParentNode = document): HTMLElement[] {
  const modal = document.querySelector<HTMLElement>('[aria-modal="true"]');
  return [...(modal ?? root).querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

export function moveFocus(direction: Direction) {
  const items = focusables();
  if (!items.length) return;
  const current = document.activeElement as HTMLElement | null;
  if (!current || current === document.body || !items.includes(current)) {
    // Start from the first control inside the visible viewport.
    const first = items.find(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) ?? items[0]!;
    focus(first);
    return;
  }
  const from = current.getBoundingClientRect();
  const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of items) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const dx = x - cx, dy = y - cy;
    const primary = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    if (primary <= 4) continue;
    const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) focus(best);
}

function focus(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

/** Gamepad "A": activate the focused control. Selects cycle their options. */
export function activateFocused() {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) { moveFocus('down'); return; }
  if (el instanceof HTMLSelectElement) { stepSelect(el, 1); return; }
  if (el instanceof HTMLInputElement && ['text', 'number', 'search'].includes(el.type)) { el.select(); return; }
  el.click();
}

export function stepSelect(el: HTMLSelectElement, delta: number) {
  const next = (el.selectedIndex + delta + el.options.length) % el.options.length;
  setNativeValue(el, el.options[next]!.value);
}

export function stepNumber(el: HTMLInputElement, delta: number) {
  const step = Number(el.step) || (Number(el.max) > 500 ? 30 : 1);
  const min = el.min === '' ? -Infinity : Number(el.min), max = el.max === '' ? Infinity : Number(el.max);
  setNativeValue(el, String(Math.max(min, Math.min(max, (Number(el.value) || 0) + delta * step))));
}

/** React tracks the value setter; use the prototype setter so onChange fires. */
function setNativeValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
