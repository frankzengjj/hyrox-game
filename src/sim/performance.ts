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
