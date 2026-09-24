/**
 * Keys currently held, tracked for the whole page by `KeyboardEvent.code`.
 * Phaser keys belong to a scene and start "up" when the scene starts, so a key
 * already held through a scene change (e.g. SPACE into a station) would not count.
 */
const held = new Set<string>();

window.addEventListener('keydown', (event) => held.add(event.code));
window.addEventListener('keyup', (event) => held.delete(event.code));
window.addEventListener('blur', () => held.clear());

export function isHeld(...codes: string[]): boolean {
  return codes.some((code) => held.has(code));
}
