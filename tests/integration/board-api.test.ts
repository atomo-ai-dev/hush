import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPost as createPostRecord } from '@/lib/board';
import { closePool, query } from '@/lib/db';
import { getOrCreateSession } from '@/lib/session';
import { POST as postComment } from '../../app/api/posts/[id]/comments/route';
import { POST as postLike } from '../../app/api/posts/[id]/like/route';
import { GET as getPost } from '../../app/api/posts/[id]/route';
import { POST as createPost, GET as listPosts } from '../../app/api/posts/route';
import { ctx, dbAvailable, noParams, resetDb, TestClient } from './helpers';

async function create(client: TestClient, title = '제목', body = '본문') {
  const res = await createPost(client.request('/api/posts', { body: { title, body } }), noParams);
  expect(res.status).toBe(201);
  return (await res.json()).post as { id: number; title: string; nickname: string };
}

describe.skipIf(!dbAvailable)('board API (integration)', () => {
  beforeEach(resetDb);
  afterAll(closePool);

  describe('POST /api/posts', () => {
    it('creates a post authored by the session nickname', async () => {
      const alice = new TestClient();
      const post = await create(alice, '  첫 글  ', '안녕하세요');
      expect(post.title).toBe('첫 글');
      const me = await query('SELECT nickname FROM sessions');
      expect(post.nickname).toBe(me.rows[0].nickname);
    });

    it('rejects invalid input with 400 and a Korean message', async () => {
      const alice = new TestClient();
      const res = await createPost(
        alice.request('/api/posts', { body: { title: 'x'.repeat(101), body: 'b' } }),
        noParams,
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error.message).toContain('100자');

      const bad = await createPost(alice.request('/api/posts', { raw: '{oops' }), noParams);
      expect(bad.status).toBe(400);
    });

    it('requires a session cookie', async () => {
      const res = await createPost(
        new Request('http://localhost/api/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 't', body: 'b' }),
        }),
        noParams,
      );
      expect(res.status).toBe(401);
    });

    it('stores user HTML as plain text', async () => {
      const post = await create(new TestClient(), '<script>alert(1)</script>', '<b>hi</b>');
      expect(post.title).toBe('<script>alert(1)</script>');
    });
  });

  describe('GET /api/posts', () => {
    it('lists newest first with 20 posts per page', async () => {
      const alice = new TestClient();
      const session = await getOrCreateSession(alice.token);
      for (let i = 1; i <= 23; i++)
        await createPostRecord(session, { title: `글 ${i}`, body: 'b' });

      const page1 = await (await listPosts(alice.request('/api/posts'), noParams)).json();
      expect(page1).toMatchObject({ page: 1, pageSize: 20, total: 23, totalPages: 2 });
      expect(page1.posts).toHaveLength(20);
      expect(page1.posts[0].title).toBe('글 23');
      expect(page1.posts[19].title).toBe('글 4');

      const page2 = await (await listPosts(alice.request('/api/posts?page=2'), noParams)).json();
      expect(page2.posts.map((p: { title: string }) => p.title)).toEqual(['글 3', '글 2', '글 1']);

      const page9 = await (await listPosts(alice.request('/api/posts?page=9'), noParams)).json();
      expect(page9.posts).toEqual([]);
    });

    it('works on an empty board', async () => {
      const res = await (await listPosts(new TestClient().request('/api/posts'), noParams)).json();
      expect(res).toMatchObject({ posts: [], total: 0, totalPages: 1 });
    });
  });

  describe('comments', () => {
    it('adds comments in order and reflects the count', async () => {
      const alice = new TestClient();
      const bob = new TestClient();
      const post = await create(alice);
      const params = ctx({ id: String(post.id) });

      const c1 = await postComment(bob.request('/x', { body: { body: '첫 댓글' } }), params);
      expect(c1.status).toBe(201);
      await postComment(alice.request('/x', { body: { body: '두 번째' } }), params);

      const detail = await (await getPost(alice.request('/x'), params)).json();
      expect(detail.comments.map((c: { body: string }) => c.body)).toEqual(['첫 댓글', '두 번째']);
      expect(detail.post.commentCount).toBe(2);

      const list = await (await listPosts(alice.request('/api/posts'), noParams)).json();
      expect(list.posts[0].commentCount).toBe(2);
    });

    it('rejects blank or too long comments', async () => {
      const alice = new TestClient();
      const params = ctx({ id: String((await create(alice)).id) });
      const blank = await postComment(alice.request('/x', { body: { body: '   ' } }), params);
      expect(blank.status).toBe(400);
      const long = await postComment(
        alice.request('/x', { body: { body: 'a'.repeat(1001) } }),
        params,
      );
      expect(long.status).toBe(400);
    });

    it('returns 404 for a missing post and 400 for a bad id', async () => {
      const alice = new TestClient();
      const missing = await postComment(
        alice.request('/x', { body: { body: 'hi' } }),
        ctx({ id: '999' }),
      );
      expect(missing.status).toBe(404);
      const bad = await postComment(
        alice.request('/x', { body: { body: 'hi' } }),
        ctx({ id: 'abc' }),
      );
      expect(bad.status).toBe(400);
    });
  });

  describe('likes', () => {
    it('toggles one like per session and counts distinct sessions', async () => {
      const alice = new TestClient();
      const bob = new TestClient();
      const post = await create(alice);
      const params = ctx({ id: String(post.id) });

      expect(
        await (await postLike(alice.request('/x', { method: 'POST' }), params)).json(),
      ).toEqual({
        liked: true,
        likeCount: 1,
      });
      expect(await (await postLike(bob.request('/x', { method: 'POST' }), params)).json()).toEqual({
        liked: true,
        likeCount: 2,
      });
      expect(
        await (await postLike(alice.request('/x', { method: 'POST' }), params)).json(),
      ).toEqual({
        liked: false,
        likeCount: 1,
      });

      const asBob = await (await getPost(bob.request('/x'), params)).json();
      expect(asBob.post).toMatchObject({ likeCount: 1, likedByMe: true });
      const asAlice = await (await getPost(alice.request('/x'), params)).json();
      expect(asAlice.post.likedByMe).toBe(false);
    });

    it('returns 404 when liking a missing post', async () => {
      const res = await postLike(
        new TestClient().request('/x', { method: 'POST' }),
        ctx({ id: '42' }),
      );
      expect(res.status).toBe(404);
    });
  });

  it('GET /api/posts/:id returns 404 for unknown posts', async () => {
    const res = await getPost(new TestClient().request('/x'), ctx({ id: '12345' }));
    expect(res.status).toBe(404);
  });
});
