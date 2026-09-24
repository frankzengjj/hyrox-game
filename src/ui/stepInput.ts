import type { Foot } from '../sim/steps';

const KEYS: Record<string, Foot> = { KeyA: 'L', ArrowLeft: 'L', KeyD: 'R', ArrowRight: 'R' };

/**
 * Left/right footstrike taps: A / ← / left click and D / → / right click,
 * judged on the browser's event timestamps.
 */
export class StepInput {
  private readonly listeners: [EventTarget, string, EventListener][] = [];

  constructor(canvas: HTMLCanvasElement, onStep: (foot: Foot, t: number) => void) {
    this.listen(window, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      const foot = KEYS[k.code];
      if (!foot || k.repeat) return;
      k.preventDefault();
      onStep(foot, k.timeStamp);
    });
    this.listen(canvas, 'pointerdown', (e) => {
      const button = (e as PointerEvent).button;
      if (button === 0 || button === 2) onStep(button === 0 ? 'L' : 'R', e.timeStamp);
    });
  }

  destroy(): void {
    for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn);
    this.listeners.length = 0;
  }

  private listen(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.listeners.push([target, type, fn]);
  }
}
