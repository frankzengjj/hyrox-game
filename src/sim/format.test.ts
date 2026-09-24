import { describe, expect, it } from 'vitest';
import { formatClock, formatPace, formatTime } from './format';

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(75.9)).toBe('1:15');
    expect(formatTime(4523)).toBe('1:15:23');
  });
});

describe('formatPace', () => {
  it('converts m/s to min/km', () => {
    expect(formatPace(1000 / 300)).toBe('5:00 /km');
    expect(formatPace(0)).toBe('--:-- /km');
  });
});

describe('formatClock', () => {
  it('always shows hours', () => {
    expect(formatClock(0)).toBe('0:00:00');
    expect(formatClock(754)).toBe('0:12:34');
    expect(formatClock(4523)).toBe('1:15:23');
  });
});
