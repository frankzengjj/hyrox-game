import type { Session } from './session';

export interface Strategy {
  runEffort: number;
  roxzoneEffort: number;
  stationEffort: number;
}

/** Plays out the rest of a race at fixed efforts. The seed of the AI opponents. */
export function simulateRace(session: Session, strategy: Strategy, dt = 0.5): Session {
  for (let steps = 0; session.segment && steps < 1_000_000; steps++) {
    const { kind } = session.segment;
    const effort =
      kind === 'run' ? strategy.runEffort : kind === 'roxzone' ? strategy.roxzoneEffort : strategy.stationEffort;
    session.advance(dt, effort);
  }
  return session;
}
