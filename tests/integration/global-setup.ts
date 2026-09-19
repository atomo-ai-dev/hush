import path from 'node:path';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { migrate } from '../../src/lib/migrate';
import { TEST_DATABASE_URL } from '../test-env';

declare module 'vitest' {
  export interface ProvidedContext {
    dbAvailable: boolean;
  }
}

async function ensureDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({
    connectionString: admin.toString(),
    connectionTimeoutMillis: 3000,
  });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }
}

export default async function setup(project: TestProject): Promise<void> {
  try {
    await ensureDatabase(TEST_DATABASE_URL);
    const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    try {
      await migrate(client, path.resolve(import.meta.dirname, '../../migrations'));
    } finally {
      await client.end();
    }
    project.provide('dbAvailable', true);
  } catch (err) {
    if (process.env.REQUIRE_DB === '1') throw err;
    console.warn(
      `\n⚠️  Integration tests SKIPPED: test database unavailable at ${TEST_DATABASE_URL}\n` +
        `   (${(err as Error).message})\n` +
        '   Start Postgres: docker run -d --name hush-pg -e POSTGRES_PASSWORD=hush ' +
        '-e POSTGRES_DB=hush -p 5433:5432 postgres:16-alpine\n',
    );
    project.provide('dbAvailable', false);
  }
}
