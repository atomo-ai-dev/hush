import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';

export const MIGRATION_FILE_PATTERN = /^(\d{3})_[a-z0-9_]+\.sql$/;

export interface Migration {
  version: string;
  name: string;
  sql: string;
}

/** Sorts and validates migration file names (`NNN_description.sql`). */
export function planMigrations(fileNames: string[]): { version: string; name: string }[] {
  const planned = fileNames
    .filter((f) => f.endsWith('.sql'))
    .map((name) => {
      const match = MIGRATION_FILE_PATTERN.exec(name);
      if (!match) throw new Error(`Invalid migration file name: ${name}`);
      return { version: match[1], name };
    })
    .sort((a, b) => a.version.localeCompare(b.version));

  for (let i = 1; i < planned.length; i++) {
    if (planned[i].version === planned[i - 1].version) {
      throw new Error(`Duplicate migration version ${planned[i].version}`);
    }
  }
  return planned;
}

export async function loadMigrations(dir: string): Promise<Migration[]> {
  const planned = planMigrations(await readdir(dir));
  return Promise.all(
    planned.map(async (m) => ({ ...m, sql: await readFile(path.join(dir, m.name), 'utf8') })),
  );
}

/**
 * Applies pending migrations in order, each in its own transaction.
 * Returns the names of the migrations that were applied.
 */
export async function migrate(client: pg.ClientBase, dir: string): Promise<string[]> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Serialize concurrent runners (e.g. parallel test workers).
  await client.query('SELECT pg_advisory_lock(7212001)');
  try {
    const { rows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations',
    );
    const applied = new Set(rows.map((r) => r.version));
    const done: string[] = [];
    for (const m of await loadMigrations(dir)) {
      if (applied.has(m.version)) continue;
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
          m.version,
          m.name,
        ]);
        await client.query('COMMIT');
        done.push(m.name);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${m.name} failed: ${(err as Error).message}`);
      }
    }
    return done;
  } finally {
    await client.query('SELECT pg_advisory_unlock(7212001)');
  }
}
