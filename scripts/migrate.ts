import { existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { databaseUrl } from '../src/lib/db';
import { migrate } from '../src/lib/migrate';

if (existsSync('.env')) process.loadEnvFile('.env');

const url = process.argv[2] || databaseUrl();
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  const applied = await migrate(client, path.resolve('migrations'));
  const target = new URL(url);
  console.log(
    applied.length
      ? `Applied ${applied.length} migration(s) to ${target.host}${target.pathname}:\n  ${applied.join('\n  ')}`
      : `Database ${target.host}${target.pathname} is up to date.`,
  );
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
