import type { Category, DivisionId } from './config/divisions';

// Browser storage can be missing or blocked (private mode), so every access is guarded.
const pbKey = (division: DivisionId, category: Category) => `hyrox-game:pb:${division}:${category}`;

export function loadPb(division: DivisionId, category: Category): number | undefined {
  try {
    const value = localStorage.getItem(pbKey(division, category));
    return value ? Number(value) : undefined;
  } catch {
    return undefined;
  }
}

export function savePb(division: DivisionId, category: Category, seconds: number): void {
  try {
    localStorage.setItem(pbKey(division, category), String(seconds));
  } catch {
    // Not persisting a PB is fine.
  }
}
