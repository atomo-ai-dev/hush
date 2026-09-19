import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/lib/db';
import { migrate } from '@/lib/migrate';
import { dbAvailable } from './helpers';

describe.skipIf(!dbAvailable)('migrate (integration)', () => {
  const schema = `migtest_${process.pid}_${Date.now()}`;
  let dir: string;
  let client: pg.PoolClient;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'hush-migrations-'));
    client = await getPool().connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.query('SET search_path TO public');
    client.release();
    await rm(dir, { recursive: true, force: true });
    await closePool();
  });

  it('applies pending migrations once, in order', async () => {
    await writeFile(path.join(dir, '001_widgets.sql'), 'CREATE TABLE widgets (id int);');
    await writeFile(
      path.join(dir, '002_widget_name.sql'),
      'ALTER TABLE widgets ADD COLUMN name text;',
    );

    expect(await migrate(client, dir)).toEqual(['001_widgets.sql', '002_widget_name.sql']);
    expect(await migrate(client, dir)).toEqual([]);

    const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version');
    expect(rows.map((r) => r.version)).toEqual(['001', '002']);
  });

  it('rolls back a failing migration and reports its name', async () => {
    await writeFile(
      path.join(dir, '003_broken.sql'),
      'CREATE TABLE gadgets (id int); SELECT * FROM missing_table;',
    );

    await expect(migrate(client, dir)).rejects.toThrow(/003_broken\.sql failed/);

    const { rows } = await client.query(
      `SELECT to_regclass('${schema}.gadgets') AS t, (SELECT count(*)::int FROM schema_migrations) AS n`,
    );
    expect(rows[0]).toEqual({ t: null, n: 2 });
  });
});
