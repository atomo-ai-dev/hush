import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query } from '@/lib/db';
import { POST as postComment } from '../../app/api/posts/[id]/comments/route';
import { POST as createPost } from '../../app/api/posts/route';
import { ctx, dbAvailable, noParams, resetDb, TestClient } from './helpers';

async function create(client: TestClient, title = '제목', body = '본문') {
  return createPost(client.request('/api/posts', { body: { title, body } }), noParams);
}

async function createOk(client: TestClient) {
  const res = await create(client);
  expect(res.status).toBe(201);
  return (await res.json()).post.id as number;
}

async function comment(client: TestClient, postId: number, body: string) {
  return postComment(client.request('/x', { body: { body } }), ctx({ id: String(postId) }));
}

describe.skipIf(!dbAvailable)('moderation (integration)', () => {
  beforeEach(resetDb);
  afterAll(closePool);

  describe('banned words', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('rejects posts whose title or body contains a banned word (case-insensitive)', async () => {
      const alice = new TestClient();
      const inTitle = await create(alice, 'what the FUCK', '본문');
      expect(inTitle.status).toBe(400);
      expect((await inTitle.json()).error).toMatchObject({ code: 'BANNED_WORD' });
      expect((await create(alice, '제목', '이런 시발')).status).toBe(400);

      const { rows } = await query('SELECT count(*)::int AS n FROM posts');
      expect(rows[0].n).toBe(0);
    });

    it('rejects comments containing a banned word', async () => {
      const alice = new TestClient();
      const postId = await createOk(alice);
      const res = await comment(alice, postId, 'Shit happens');
      expect(res.status).toBe(400);
      expect((await comment(alice, postId, '좋은 글이네요')).status).toBe(201);
    });
  });

  describe('rate limiting', () => {
    it('allows 5 posts+comments per minute per session, then answers 429', async () => {
      const alice = new TestClient();
      const postId = await createOk(alice);
      for (let i = 0; i < 2; i++) expect((await create(alice)).status).toBe(201);
      for (let i = 0; i < 2; i++)
        expect((await comment(alice, postId, `댓글 ${i}`)).status).toBe(201);

      const blockedComment = await comment(alice, postId, '여섯 번째');
      expect(blockedComment.status).toBe(429);
      expect(blockedComment.headers.get('retry-after')).toMatch(/^\d+$/);
      const body = await blockedComment.json();
      expect(body.error.code).toBe('RATE_LIMITED');
      expect(body.error.message).toContain('1분에 5개');
      expect((await create(alice)).status).toBe(429);

      // Other sessions are unaffected.
      expect((await create(new TestClient())).status).toBe(201);
    });

    it('does not spend the budget on rejected (invalid or banned) input', async () => {
      const alice = new TestClient();
      for (let i = 0; i < 5; i++) expect((await create(alice, '', 'x')).status).toBe(400);
      for (let i = 0; i < 5; i++) expect((await create(alice, 'fuck', 'x')).status).toBe(400);
      expect((await create(alice)).status).toBe(201);
    });
  });
});
