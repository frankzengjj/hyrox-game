import type * as Phaser from 'phaser';
import { TIME_SCALE } from '../config/race';
import type { Session } from '../sim/session';

const params = new URLSearchParams(window.location.search);
/** `?debug` in the URL enables shortcuts such as skipping segments. */
export const DEBUG = params.has('debug');
/** `?debug&speed=10` fast-forwards the race clock for testing. */
const DEBUG_SPEED = DEBUG ? Number(params.get('speed')) || 1 : 1;

const SCENE_FOR_SEGMENT = { run: 'Run', roxzone: 'Roxzone', station: 'Station' } as const;

export function getSession(scene: Phaser.Scene): Session {
  return scene.registry.get('session') as Session;
}

/** Control hint shown along the bottom of the HUD. */
export function setHint(scene: Phaser.Scene, hint: string): void {
  scene.registry.set('hint', hint);
}

/** Starts whichever scene plays the session's current segment, or the results. */
export function goToCurrentSegment(from: Phaser.Scene): void {
  const segment = getSession(from).segment;
  if (!segment) {
    from.scene.stop('Hud');
    from.scene.start('Results');
    return;
  }
  from.scene.start(SCENE_FOR_SEGMENT[segment.kind]);
}

/** Frame delta in ms → race seconds, capped so a stalled tab doesn't jump the race forward. */
export function raceDelta(deltaMs: number): number {
  return (Math.min(deltaMs, 100) / 1000) * TIME_SCALE * DEBUG_SPEED;
}
