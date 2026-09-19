import { describe, expect, it } from 'vitest';
import { planMigrations } from '@/lib/migrate';

describe('planMigrations', () => {
  it('orders migrations by numeric version and ignores non-sql files', () => {
    const plan = planMigrations(['002_board.sql', '.gitkeep', '001_sessions.sql', 'README.md']);
    expect(plan).toEqual([
      { version: '001', name: '001_sessions.sql' },
      { version: '002', name: '002_board.sql' },
    ]);
  });

  it('rejects badly named migration files', () => {
    expect(() => planMigrations(['1_init.sql'])).toThrow(/Invalid migration file name/);
    expect(() => planMigrations(['001-init.sql'])).toThrow(/Invalid migration file name/);
  });

  it('rejects duplicate versions', () => {
    expect(() => planMigrations(['001_a.sql', '001_b.sql'])).toThrow(/Duplicate migration/);
  });
});
