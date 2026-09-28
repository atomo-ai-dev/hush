import { describe, expect, it } from 'vitest';
import { formatClock, formatRelativeTime } from '@/lib/format';

const now = new Date('2026-09-19T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('formatRelativeTime', () => {
  it.each([
    [10_000, '방금 전'],
    [5 * 60_000, '5분 전'],
    [3 * 3_600_000, '3시간 전'],
    [2 * 86_400_000, '2일 전'],
  ])('%i ms ago → %s', (ms, expected) => {
    expect(formatRelativeTime(ago(ms), now)).toBe(expected);
  });

  it('falls back to a KST calendar date after a week', () => {
    // 2026-09-01T20:00Z is already 2026-09-02 in Korea.
    expect(formatRelativeTime('2026-09-01T20:00:00Z', now)).toBe('2026.09.02');
  });

  // #15: an Invalid Date used to render 'NaN.NaN.NaN'.
  it.each(['not-a-date', ''])('returns an empty string for the invalid timestamp %j', (iso) => {
    expect(formatRelativeTime(iso, now)).toBe('');
  });
});

describe('formatClock', () => {
  it('shows zero-padded KST hours and minutes', () => {
    expect(formatClock('2026-09-19T00:05:00Z')).toBe('09:05');
    expect(formatClock('2026-09-19T15:30:59Z')).toBe('00:30');
  });

  // #15: an Invalid Date used to render 'NaN:NaN'.
  it.each(['not-a-date', ''])('returns an empty string for the invalid timestamp %j', (iso) => {
    expect(formatClock(iso)).toBe('');
  });
});
