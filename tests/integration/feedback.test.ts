import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db';
import { POST as sendFeedback } from '../../app/api/feedback/route';
import { dbAvailable, noParams, resetDb, TestClient } from './helpers';

describe.skipIf(!dbAvailable)('feedback (integration)', () => {
  beforeEach(resetDb);
  afterAll(closePool);

  describe('POST /api/feedback', () => {
    it('stores the report with session, page and user agent', async () => {
      const alice = new TestClient();
      const req = new Request('http://localhost/api/feedback', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(alice.request('/').headers),
          'content-type': 'application/json',
          'user-agent': 'vitest-browser',
        },
        body: JSON.stringify({
          message: '글쓰기 버튼이 안 돼요',
          pageUrl: 'http://localhost/posts/new',
        }),
      });
      const res = await sendFeedback(req, noParams);
      expect(res.status).toBe(201);
      const { rows } = await query(
        'SELECT message, page_url, user_agent, session_id IS NOT NULL AS has_session FROM feedback',
      );
      expect(rows).toEqual([
        {
          message: '글쓰기 버튼이 안 돼요',
          page_url: 'http://localhost/posts/new',
          user_agent: 'vitest-browser',
          has_session: true,
        },
      ]);
    });

    it('validates input and limits frequency', async () => {
      const alice = new TestClient();
      const empty = await sendFeedback(alice.request('/x', { body: { message: ' ' } }), noParams);
      expect(empty.status).toBe(400);
      for (let i = 0; i < 3; i++) {
        const ok = await sendFeedback(alice.request('/x', { body: { message: `${i}` } }), noParams);
        expect(ok.status).toBe(201);
      }
      const limited = await sendFeedback(alice.request('/x', { body: { message: 'x' } }), noParams);
      expect(limited.status).toBe(429);
    });
  });
});
