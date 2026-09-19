import { inject } from 'vitest';
import { getPool } from '@/lib/db';

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
