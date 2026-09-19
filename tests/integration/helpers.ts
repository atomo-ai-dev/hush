import { inject } from 'vitest';
import { getPool } from '@/lib/db';
import { newSessionToken, SESSION_COOKIE } from '@/lib/session-token';

export const dbAvailable = inject('dbAvailable');

/** Empties every application table (keeps the migration bookkeeping). */
export async function resetDb(): Promise<void> {
  const { rows } = await getPool().query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
  await getPool().query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

/** A fake browser: remembers its session cookie and builds Requests for route handlers. */
export class TestClient {
  readonly token = newSessionToken();

  request(path: string, init: { method?: string; body?: unknown; raw?: string } = {}): Request {
    const hasBody = init.body !== undefined || init.raw !== undefined;
    return new Request(`http://localhost:4620${path}`, {
      method: init.method ?? (hasBody ? 'POST' : 'GET'),
      headers: {
        cookie: `${SESSION_COOKIE}=${this.token}`,
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
      },
      body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    });
  }
}

export function ctx<P extends Record<string, string>>(params: P) {
  return { params: Promise.resolve(params) };
}

export const noParams = ctx({});
