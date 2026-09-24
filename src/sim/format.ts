/** 75.4 → "1:15", 4523 → "1:15:23". */
export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Speed in m/s → "5:12 /km". */
export function formatPace(metresPerSecond: number): string {
  if (metresPerSecond <= 0) return '--:-- /km';
  return `${formatTime(1000 / metresPerSecond)} /km`;
}

/** Race clock style, always with hours: 754 → "0:12:34". */
export function formatClock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  return `${h}:${formatTime(s - h * 3600).padStart(5, '0')}`;
}
