import * as Phaser from 'phaser';
import type { Session } from '../sim/session';
import { DEBUG, getSession, goToCurrentSegment, raceDelta, setHint } from './flow';

/** Base for the scenes that play one race segment (run, roxzone, station). */
export abstract class SegmentScene extends Phaser.Scene {
  protected session!: Session;
  private leaving = false;

  /** Call at the start of create(). */
  protected beginSegment(hint: string): void {
    this.session = getSession(this);
    this.leaving = false;
    setHint(this, DEBUG ? `${hint}   ·   ] skip segment` : hint);
    if (DEBUG) {
      this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET).on('down', () => {
        this.session.skipSegment();
        this.leave();
      });
    }
  }

  /**
   * Moves the race on by one frame at the given effort. Returns true once the segment is over,
   * after which the scene is on its way out and should not render the (next segment's) state.
   */
  protected advance(deltaMs: number, effort: number): boolean {
    if (!this.leaving && this.session.advance(raceDelta(deltaMs), effort)) this.leave();
    return this.leaving;
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    goToCurrentSegment(this);
  }
}
