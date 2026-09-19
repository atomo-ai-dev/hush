import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query } from '@/lib/db';
import { INTERNAL_TOKEN_HEADER, recordApiError, recordError } from '@/lib/error-log';
import { apiHandler, setUnhandledErrorReporter } from '@/lib/http';
import { GET as listErrors, POST as writeError } from '../../app/api/%5Ferrors/route';
import { dbAvailable, noParams, resetDb } from './helpers';

describe.skipIf(!dbAvailable)('error log (integration)', () => {
  beforeEach(resetDb);
  afterAll(closePool);

  describe('error log', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('records unhandled API errors without leaking them to the client', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      setUnhandledErrorReporter(recordApiError);
      const handler = apiHandler(async () => {
        throw new Error('connection reset by peer');
      });
      const res = await handler(
        new Request('http://localhost/api/boom?x=1', { method: 'PUT' }),
        noParams,
      );
      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).not.toContain('connection reset');

      const { rows } = await query('SELECT source, method, path, message, stack FROM error_logs');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        source: 'api',
        method: 'PUT',
        path: '/api/boom',
        message: 'connection reset by peer',
      });
      expect(rows[0].stack).toContain('Error: connection reset by peer');
    });

    it('recordError never throws, even for oversized input', async () => {
      const id = await recordError({
        source: 'test',
        message: 'm'.repeat(10_000),
        context: { a: 1 },
      });
      expect(id).toBeGreaterThan(0);
      const { rows } = await query('SELECT length(message) AS len, context FROM error_logs');
      expect(rows[0]).toEqual({ len: 2000, context: { a: 1 } });
    });

    it('/api/_errors requires the internal token', async () => {
      const body = JSON.stringify({ source: 'ws', message: 'socket exploded' });
      const post = (headers: Record<string, string>) =>
        writeError(
          new Request('http://localhost/api/_errors', { method: 'POST', headers, body }),
          noParams,
        );

      // Disabled entirely when no token is configured.
      vi.stubEnv('HUSH_INTERNAL_TOKEN', '');
      expect((await post({ [INTERNAL_TOKEN_HEADER]: '' })).status).toBe(403);

      vi.stubEnv('HUSH_INTERNAL_TOKEN', 'test-internal-token');
      expect((await post({})).status).toBe(403);
      expect((await post({ [INTERNAL_TOKEN_HEADER]: 'wrong' })).status).toBe(403);

      const ok = await post({ [INTERNAL_TOKEN_HEADER]: 'test-internal-token' });
      expect(ok.status).toBe(201);

      const listed = await listErrors(
        new Request('http://localhost/api/_errors', {
          headers: { [INTERNAL_TOKEN_HEADER]: 'test-internal-token' },
        }),
        noParams,
      );
      const { errors } = await listed.json();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ source: 'ws', message: 'socket exploded' });

      const forbidden = await listErrors(new Request('http://localhost/api/_errors'), noParams);
      expect(forbidden.status).toBe(403);
    });
  });
});
