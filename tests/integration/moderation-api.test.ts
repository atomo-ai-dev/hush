import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query } from '@/lib/db';
import { HIDE_THRESHOLD } from '@/lib/reports';
import { POST as postComment } from '../../app/api/posts/[id]/comments/route';
import { GET as getPost } from '../../app/api/posts/[id]/route';
import { POST as createPost, GET as listPosts } from '../../app/api/posts/route';
import { POST as report } from '../../app/api/reports/route';
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

function reportAs(client: TestClient, targetType: 'post' | 'comment', targetId: number) {
  return report(client.request('/api/reports', { body: { targetType, targetId } }), noParams);
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

  describe('reports', () => {
    it(`hides a post after ${HIDE_THRESHOLD} reports from distinct sessions`, async () => {
      const author = new TestClient();
      const postId = await createOk(author);
      await createOk(author);
      const [r1, r2, r3] = [new TestClient(), new TestClient(), new TestClient()];

      const first = await reportAs(r1, 'post', postId);
      expect(first.status).toBe(201);
      expect(await first.json()).toEqual({ created: true, reportCount: 1, hidden: false });

      // The same session reporting again does not count twice.
      const dup = await reportAs(r1, 'post', postId);
      expect(dup.status).toBe(200);
      expect(await dup.json()).toEqual({ created: false, reportCount: 1, hidden: false });

      expect(await (await reportAs(r2, 'post', postId)).json()).toMatchObject({ hidden: false });
      expect(await (await reportAs(r3, 'post', postId)).json()).toEqual({
        created: true,
        reportCount: 3,
        hidden: true,
      });

      const list = await (await listPosts(author.request('/api/posts'), noParams)).json();
      expect(list.total).toBe(1);
      expect(list.posts.map((p: { id: number }) => p.id)).not.toContain(postId);

      const detail = await getPost(author.request('/x'), ctx({ id: String(postId) }));
      expect(detail.status).toBe(404);
      expect((await comment(author, postId, '숨김 글에 댓글')).status).toBe(404);
    });

    it('hides a comment after 3 reports and excludes it from counts', async () => {
      const author = new TestClient();
      const postId = await createOk(author);
      const bad = await (await comment(author, postId, '문제의 댓글')).json();
      await comment(author, postId, '멀쩡한 댓글');

      for (const r of [new TestClient(), new TestClient(), new TestClient()]) {
        await reportAs(r, 'comment', bad.comment.id);
      }

      const detail = await (
        await getPost(author.request('/x'), ctx({ id: String(postId) }))
      ).json();
      expect(detail.comments.map((c: { body: string }) => c.body)).toEqual(['멀쩡한 댓글']);
      expect(detail.post.commentCount).toBe(1);
    });

    it('returns 404 for a missing target and 400 for a bad payload', async () => {
      const alice = new TestClient();
      expect((await reportAs(alice, 'post', 999)).status).toBe(404);
      expect((await reportAs(alice, 'comment', 999)).status).toBe(404);
      const bad = await report(
        alice.request('/api/reports', { body: { targetType: 'user', targetId: 1 } }),
        noParams,
      );
      expect(bad.status).toBe(400);
    });

    it('counts concurrent reports correctly', async () => {
      const postId = await createOk(new TestClient());
      const reporters = Array.from({ length: 5 }, () => new TestClient());
      const results = await Promise.all(reporters.map((r) => reportAs(r, 'post', postId)));
      expect(results.every((r) => r.status === 201)).toBe(true);
      const { rows } = await query(
        "SELECT count(*)::int AS n, (SELECT hidden_at IS NOT NULL FROM posts WHERE id = $1) AS hidden FROM reports WHERE target_type = 'post' AND target_id = $1",
        [postId],
      );
      expect(rows[0]).toEqual({ n: 5, hidden: true });
    });
  });
});
