import type { StationId } from './stations';

export type DivisionId = 'open' | 'pro';
export type Category = 'women' | 'men';

export interface Division {
  id: DivisionId;
  name: string;
  /** Multiplier on station duration and muscle load (heavier weights). */
  difficulty: number;
}

export const DIVISIONS: Record<DivisionId, Division> = {
  open: { id: 'open', name: 'Open', difficulty: 1 },
  pro: { id: 'pro', name: 'Pro', difficulty: 1.15 },
};

/** Approximate station weights per division. Check against the current season rulebook. */
export const WEIGHTS: Record<DivisionId, Record<Category, Partial<Record<StationId, string>>>> = {
  open: {
    women: { sledPush: '102 kg', sledPull: '78 kg', farmersCarry: '2 × 16 kg', sandbagLunges: '10 kg', wallBalls: '4 kg → 2.7 m' },
    men: { sledPush: '152 kg', sledPull: '103 kg', farmersCarry: '2 × 24 kg', sandbagLunges: '20 kg', wallBalls: '6 kg → 3 m' },
  },
  pro: {
    women: { sledPush: '152 kg', sledPull: '103 kg', farmersCarry: '2 × 24 kg', sandbagLunges: '20 kg', wallBalls: '6 kg → 2.7 m' },
    men: { sledPush: '202 kg', sledPull: '153 kg', farmersCarry: '2 × 32 kg', sandbagLunges: '30 kg', wallBalls: '9 kg → 3 m' },
  },
};
