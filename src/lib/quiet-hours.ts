/**
 * Chat notification quiet hours, written like "23:00-07:00" on the KST clock.
 * Times come in as UTC Dates.
 * Nothing here reads the system clock.
 */
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const KST_OFFSET = 9 * 60 * MINUTE;
const SPEC = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;

/** Minutes after KST midnight. A window may cross midnight. */
export interface Window {
  startMin: number;
  endMin: number;
}

function sinceKstMidnight(at: Date): number {
  const kst = at.getTime() + KST_OFFSET;
  return ((kst % DAY) + DAY) % DAY;
}

/** Reads "HH:MM-HH:MM"; null when it is not a usable window. */
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

/** Whether notifications are muted at `at`. */
export function isQuiet(at: Date, w: Window): boolean {
  const minute = Math.floor(sinceKstMidnight(at) / MINUTE);
  if (w.startMin < w.endMin) {
    return minute >= w.startMin && minute < w.endMin;
  }
  return minute >= w.startMin || minute < w.endMin;
}

/** When the window next ends, counting from `at`. */
export function nextQuietEnd(at: Date, w: Window): Date {
  const midnight = at.getTime() - sinceKstMidnight(at);
  let end = midnight + w.endMin * MINUTE;
  if (end < at.getTime()) end += DAY;
  return new Date(end);
}
