/**
 * Chat notification quiet hours.
 *
 * A window is written "HH:MM-HH:MM" on the KST clock, for example "23:00-07:00"
 * for a window that crosses midnight. Times come in as UTC Dates and are
 * compared on the KST clock (UTC+9, no daylight saving).
 */
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const KST_OFFSET = 9 * 60 * MINUTE;
const SPEC = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;

/** Minutes after KST midnight. endMin is exclusive; startMin > endMin crosses midnight. */
export interface Window {
  startMin: number;
  endMin: number;
}

/** Milliseconds since KST midnight for a UTC time. */
function sinceKstMidnight(at: Date): number {
  const kst = at.getTime() + KST_OFFSET;
  return ((kst % DAY) + DAY) % DAY;
}

/**
 * Reads "HH:MM-HH:MM". Returns null for a malformed spec, an hour of 24 or
 * more, a minute of 60 or more, or a window that starts where it ends.
 */
export function parseWindow(spec: string): Window | null {
  const match = SPEC.exec(spec.trim());
  if (!match) return null;
  const [sh, sm, eh, em] = match.slice(1).map(Number);
  if (sh >= 24 || eh >= 24) return null;
  if (sm >= 60 || em >= 60) return null;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin === endMin) return null;
  return { startMin, endMin };
}

/** True when `at`, read on the KST clock, falls inside the window. The end is exclusive. */
export function isQuiet(at: Date, w: Window): boolean {
  const minute = Math.floor(sinceKstMidnight(at) / MINUTE);
  if (w.startMin < w.endMin) {
    return minute >= w.startMin && minute < w.endMin;
  }
  return minute >= w.startMin || minute < w.endMin;
}

/** The nearest time at or after `at` when the window ends, as a UTC Date. */
export function nextQuietEnd(at: Date, w: Window): Date {
  const midnight = at.getTime() - sinceKstMidnight(at);
  let end = midnight + w.endMin * MINUTE;
  if (end < at.getTime()) end += DAY;
  return new Date(end);
}
