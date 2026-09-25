import { describe, expect, it } from 'vitest';
import { isQuiet, nextQuietEnd, parseWindow } from '@/lib/quiet-hours';

// KST is UTC+9: 13:00Z is 22:00 KST, 15:30Z is 00:30 KST the next day.
const sameDay = { startMin: 13 * 60, endMin: 14 * 60 }; // 13:00-14:00 KST
const overnight = { startMin: 23 * 60, endMin: 7 * 60 }; // 23:00-07:00 KST

describe('parseWindow', () => {
  it('parses a same-day window', () => {
    expect(parseWindow('13:00-14:30')).toEqual({ startMin: 780, endMin: 870 });
  });

  it('rejects a malformed spec', () => {
    expect(parseWindow('1pm-2pm')).toBeNull();
  });

  it('rejects an hour of twenty-four or more', () => {
    expect(parseWindow('22:00-24:00')).toBeNull();
  });

  it('rejects a window whose start equals its end', () => {
    expect(parseWindow('09:15-09:15')).toBeNull();
  });
});

describe('isQuiet', () => {
  it('same-day window contains a time inside it', () => {
    expect(isQuiet(new Date('2026-09-25T04:30:00Z'), sameDay)).toBe(true);
  });

  it('same-day window excludes a time outside it', () => {
    expect(isQuiet(new Date('2026-09-25T05:30:00Z'), sameDay)).toBe(false);
  });

  it('overnight window contains a time before midnight', () => {
    expect(isQuiet(new Date('2026-09-25T14:30:00Z'), overnight)).toBe(true);
  });

  it('overnight window contains a time after midnight', () => {
    expect(isQuiet(new Date('2026-09-25T15:30:00Z'), overnight)).toBe(true);
  });

  it('the end minute is outside the window', () => {
    // 22:00Z is 07:00 KST, the exclusive end.
    expect(isQuiet(new Date('2026-09-25T22:00:00Z'), overnight)).toBe(false);
  });
});

describe('nextQuietEnd', () => {
  it('nextQuietEnd crosses the KST date boundary', () => {
    const at = new Date('2026-09-25T15:30:00Z'); // 2026-09-26 00:30 KST
    expect(nextQuietEnd(at, overnight).toISOString()).toBe('2026-09-25T22:00:00.000Z');
  });

  it('nextQuietEnd rolls over to the next day once the end has passed', () => {
    const at = new Date('2026-09-25T23:00:00Z'); // 2026-09-26 08:00 KST
    expect(nextQuietEnd(at, overnight).toISOString()).toBe('2026-09-26T22:00:00.000Z');
  });
});
