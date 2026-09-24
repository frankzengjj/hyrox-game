export type MuscleGroup = 'legs' | 'grip' | 'upper' | 'core';

/** How strongly an activity works each muscle group (0..1). */
export type Loads = Partial<Record<MuscleGroup, number>>;

export type StationId =
  | 'skierg'
  | 'sledPush'
  | 'sledPull'
  | 'burpeeBroadJump'
  | 'row'
  | 'farmersCarry'
  | 'sandbagLunges'
  | 'wallBalls';

export interface StationDef {
  id: StationId;
  name: string;
  target: number;
  unit: 'm' | 'reps';
  /** Race seconds a fresh Open athlete working at full station effort needs. */
  baseSeconds: number;
  loads: Loads;
}

/** The eight stations, in race order. */
export const STATIONS: readonly StationDef[] = [
  { id: 'skierg', name: 'SkiErg', target: 1000, unit: 'm', baseSeconds: 240, loads: { upper: 0.8, core: 0.5, legs: 0.2, grip: 0.2 } },
  { id: 'sledPush', name: 'Sled Push', target: 50, unit: 'm', baseSeconds: 180, loads: { legs: 1, upper: 0.4, core: 0.3 } },
  { id: 'sledPull', name: 'Sled Pull', target: 50, unit: 'm', baseSeconds: 240, loads: { grip: 0.7, upper: 0.7, legs: 0.4, core: 0.3 } },
  { id: 'burpeeBroadJump', name: 'Burpee Broad Jumps', target: 80, unit: 'm', baseSeconds: 240, loads: { legs: 0.7, upper: 0.5, core: 0.5 } },
  { id: 'row', name: 'Rowing', target: 1000, unit: 'm', baseSeconds: 250, loads: { legs: 0.6, upper: 0.5, grip: 0.3, core: 0.3 } },
  { id: 'farmersCarry', name: 'Farmers Carry', target: 200, unit: 'm', baseSeconds: 120, loads: { grip: 1, core: 0.4, legs: 0.2 } },
  { id: 'sandbagLunges', name: 'Sandbag Lunges', target: 100, unit: 'm', baseSeconds: 240, loads: { legs: 1, core: 0.4 } },
  { id: 'wallBalls', name: 'Wall Balls', target: 100, unit: 'reps', baseSeconds: 375, loads: { legs: 0.8, upper: 0.7, core: 0.3 } },
];

export const RUN_LOADS: Loads = { legs: 0.3, core: 0.1 };
