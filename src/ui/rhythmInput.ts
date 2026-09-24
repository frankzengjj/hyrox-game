/**
 * The rhythm "button": SPACE or the mouse, with the browser's event timestamps so
 * timing is judged on when you pressed, not when the next frame ran.
 */
export class RhythmInput {
  private keyDown = false;
  private pointerDown = false;
  private readonly listeners: [EventTarget, string, EventListener][] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private readonly onPress: (t: number) => void,
    private readonly onRelease: (t: number) => void,
  ) {
    this.listen(window, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      if (k.code !== 'Space' || k.repeat) return;
      k.preventDefault();
      this.set('key', true, k.timeStamp);
    });
    this.listen(window, 'keyup', (e) => {
      const k = e as KeyboardEvent;
      if (k.code === 'Space') this.set('key', false, k.timeStamp);
    });
    this.listen(canvas, 'pointerdown', (e) => {
      if ((e as PointerEvent).button === 0) this.set('pointer', true, e.timeStamp);
    });
    this.listen(window, 'pointerup', (e) => {
      if ((e as PointerEvent).button === 0) this.set('pointer', false, e.timeStamp);
    });
    this.listen(window, 'blur', () => this.set('key', false, performance.now()));
  }

  destroy(): void {
    for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn);
    this.listeners.length = 0;
  }

  private listen(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.listeners.push([target, type, fn]);
  }

  private set(source: 'key' | 'pointer', down: boolean, t: number): void {
    const wasDown = this.keyDown || this.pointerDown;
    if (source === 'key') this.keyDown = down;
    else this.pointerDown = down;
    const isDown = this.keyDown || this.pointerDown;
    if (!wasDown && isDown) this.onPress(t);
    if (wasDown && !isDown) this.onRelease(t);
  }
}
