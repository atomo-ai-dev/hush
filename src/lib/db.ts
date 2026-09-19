import pg from 'pg';

export const DEFAULT_DATABASE_URL = 'postgres://postgres:hush@localhost:5433/hush';

type Queryable = Pick<pg.Pool, 'query'> | pg.PoolClient;

const globalForDb = globalThis as unknown as { __hushPool?: pg.Pool };

export function databaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

/**
 * Process-wide connection pool. Stored on globalThis so that Next.js route
 * bundles and hot reloads share a single pool instead of leaking connections.
 */
export function getPool(): pg.Pool {
  if (!globalForDb.__hushPool) {
    globalForDb.__hushPool = new pg.Pool({
      connectionString: databaseUrl(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    });
  }
  return globalForDb.__hushPool;
}

export async function closePool(): Promise<void> {
  const pool = globalForDb.__hushPool;
  globalForDb.__hushPool = undefined;
  if (pool) await pool.end();
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = getPool(),
): Promise<pg.QueryResult<T>> {
  return db.query<T>(text, params);
}

/** Runs `fn` inside a transaction, rolling back on any thrown error. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
