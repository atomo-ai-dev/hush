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
});
