import type { StationDef } from '../config/stations';

/** Effort while standing still at a station catching your breath. */
export const STATION_REST_EFFORT = 0.15;
/** Effort of steady, hard station work. */
export const STATION_WORK_EFFORT = 0.85;

/** Movement speed in m/s: ~1.7 walking, ~3 steady (5:30/km), ~4.5 flat out. */
export function runSpeed(effort: number, capacity: number): number {
  return (1 + 3.45 * effort) * capacity;
}

/** Station progress in station units (m or reps) per race second. */
export function stationRate(def: StationDef, difficulty: number, effort: number, capacity: number): number {
  const intensity = Math.max(0, (effort - STATION_REST_EFFORT) / (STATION_WORK_EFFORT - STATION_REST_EFFORT));
  return (def.target / (def.baseSeconds * difficulty)) * intensity * capacity;
}

export interface TempoLevel {
  name: string;
  bpm: number;
  /** Effort while keeping this tempo. */
  effort: number;
}

/** Station tempos. Faster means more work per minute, and more lactate. */
export const TEMPO_LEVELS: readonly TempoLevel[] = [
  { name: 'Easy', bpm: 72, effort: 0.62 },
  { name: 'Steady', bpm: 84, effort: 0.74 },
  { name: 'Strong', bpm: 96, effort: 0.84 },
  { name: 'Hard', bpm: 108, effort: 0.92 },
  { name: 'Max', bpm: 120, effort: 1 },
];
/** At this tempo, clean strokes finish a station in its base time (what the pacing bot assumes). */
export const REFERENCE_TEMPO = 2;
/** Effort saved while in flow (long clean streak). */
export const FLOW_EFFORT_SAVING = 0.06;

/** Station work (m or reps) for one full-quality stroke. */
export function workPerStroke(def: StationDef, difficulty: number, timeScale: number): number {
  const beatRaceSeconds = (60 / TEMPO_LEVELS[REFERENCE_TEMPO].bpm) * timeScale;
  return (def.target / (def.baseSeconds * difficulty)) * beatRaceSeconds;
}
