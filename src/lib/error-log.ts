import { timingSafeEqual } from 'node:crypto';
import { query } from './db';

export interface ErrorLogEntry {
  source: string;
  method?: string | null;
  path?: string | null;
  message: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
}

export interface ErrorLogRecord extends Required<ErrorLogEntry> {
  id: number;
  createdAt: string;
}

const clip = (s: string | null | undefined, max: number) => (s == null ? null : s.slice(0, max));

/** Normalizes anything thrown into a loggable message + stack. */
export function describeError(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) return { message: err.message || err.name, stack: err.stack ?? null };
  try {
    const stringified = typeof err === 'string' ? err : JSON.stringify(err);
    // JSON.stringify can return undefined for certain values (undefined, functions, symbols)
    // without throwing an error, so we need to check for that
    if (stringified !== undefined) {
      return { message: stringified, stack: null };
    }
  } catch {
    // Fall through to String(err) below
  }
  return { message: String(err), stack: null };
}

/**
 * Writes an entry to error_logs. Never throws: failing to log must not turn
 * into a second error for the caller. Returns the new row id, or null.
 */
export async function recordError(entry: ErrorLogEntry): Promise<number | null> {
  try {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO error_logs (source, method, path, message, stack, context)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        clip(entry.source, 50),
        clip(entry.method, 10),
        clip(entry.path, 500),
        clip(entry.message, 2000) || '(no message)',
        clip(entry.stack, 8000),
        entry.context ? JSON.stringify(entry.context) : null,
      ],
    );
    return Number(rows[0].id);
  } catch (err) {
    console.error('[error-log] failed to record error', err, entry);
    return null;
  }
}

/** Reporter for apiHandler: records unhandled API errors with request info. */
export async function recordApiError(err: unknown, req: Request): Promise<void> {
  console.error('[api] unhandled error', err);
  const url = new URL(req.url);
  await recordError({
    source: 'api',
    method: req.method,
    path: url.pathname,
    ...describeError(err),
  });
}

export async function listRecentErrors(limit = 50): Promise<ErrorLogRecord[]> {
  const { rows } = await query<{
    id: string;
    source: string;
    method: string | null;
    path: string | null;
    message: string;
    stack: string | null;
    context: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `SELECT id, source, method, path, message, stack, context, created_at
       FROM error_logs ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    source: r.source,
    method: r.method,
    path: r.path,
    message: r.message,
    stack: r.stack,
    context: r.context,
    createdAt: r.created_at.toISOString(),
  }));
}

export const INTERNAL_TOKEN_HEADER = 'x-hush-internal-token';

/** True when the request carries HUSH_INTERNAL_TOKEN. Disabled when the env var is unset. */
export function isInternalRequest(req: Request): boolean {
  const expected = process.env.HUSH_INTERNAL_TOKEN;
  const given = req.headers.get(INTERNAL_TOKEN_HEADER);
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
