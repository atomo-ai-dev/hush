import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BANNED_WORDS } from '@/lib/banned-words';
import {
  createComment,
  createPost,
  getPost,
  listComments,
  listPosts,
  toggleLike,
} from '@/lib/board';
import { createMessage, createRoom, getRoom, listRecentMessages, listRooms } from '@/lib/chat';
import { DEMO_BANNER, DEMO_VISITOR, isDemoMode } from '@/lib/demo';
import { DEMO_MESSAGES, DEMO_POSTS, DEMO_ROOMS } from '@/lib/demo-seed';
import { apiHandler } from '@/lib/http';
import { LIMITS } from '@/lib/limits';
import { requireSession } from '@/lib/session';

// Any query in demo mode is a bug: there is no database behind the demo deploy.
vi.mock('@/lib/db', () => ({
  query: vi.fn(async () => {
    throw new Error('demo mode must not touch the database');
  }),
  withTransaction: vi.fn(async () => {
    throw new Error('demo mode must not touch the database');
  }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

const db = await import('@/lib/db');

const ctx = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });
const post = (url: string, body: unknown = {}) =>
  new Request(`http://demo.local${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.stubEnv('HUSH_DEMO', '1'));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('isDemoMode', () => {
  it('is on only for HUSH_DEMO=1', () => {
    expect(isDemoMode()).toBe(true);
    for (const value of ['', '0', 'true', 'yes']) {
      vi.stubEnv('HUSH_DEMO', value);
      expect(isDemoMode()).toBe(false);
    }
  });
});

describe('demo seed', () => {
  it('is fictional Korean content within the app limits and free of banned words', () => {
    expect(DEMO_POSTS.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_ROOMS.length).toBeGreaterThanOrEqual(1);
    const texts = [
      ...DEMO_POSTS.flatMap((p) => [p.title, p.body, ...p.comments.map((c) => c.body)]),
      ...DEMO_MESSAGES.map((m) => m.body),
    ];
    for (const text of texts) expect(text).toMatch(/[가-힣]/);
    for (const p of DEMO_POSTS) {
      expect([...p.title].length).toBeLessThanOrEqual(LIMITS.postTitle);
      expect([...p.body].length).toBeLessThanOrEqual(LIMITS.postBody);
    }
    for (const m of DEMO_MESSAGES)
      expect([...m.body].length).toBeLessThanOrEqual(LIMITS.chatMessage);
    const all = texts.join('\n').toLowerCase();
    for (const word of DEFAULT_BANNED_WORDS) expect(all).not.toContain(word);
  });

  it('has unique ids and messages that belong to existing rooms', () => {
    const postIds = DEMO_POSTS.map((p) => p.id);
    expect(new Set(postIds).size).toBe(postIds.length);
    const roomIds = new Set(DEMO_ROOMS.map((r) => r.id));
    for (const m of DEMO_MESSAGES) expect(roomIds.has(m.roomId)).toBe(true);
  });
});

describe('reads in demo mode come from the seed, not the database', () => {
  it('lists posts newest first with comment counts', async () => {
    const page = await listPosts(1);
    expect(page.total).toBe(DEMO_POSTS.length);
    expect(page.posts.length).toBe(DEMO_POSTS.length);
    const times = page.posts.map((p) => Date.parse(p.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const seeded = DEMO_POSTS.find((p) => p.comments.length > 0);
    const listed = page.posts.find((p) => p.id === seeded?.id);
    expect(listed?.commentCount).toBe(seeded?.comments.length);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns an empty page past the end', async () => {
    const page = await listPosts(99);
    expect(page.posts).toEqual([]);
    expect(page.totalPages).toBe(1);
  });

  it('reads a post and its comments, and 404s on an unknown id', async () => {
    const seeded = DEMO_POSTS[0];
    const detail = await getPost(seeded.id, null);
    expect(detail).toMatchObject({ id: seeded.id, title: seeded.title, likedByMe: false });
    const comments = await listComments(seeded.id);
    expect(comments.map((c) => c.body)).toEqual(seeded.comments.map((c) => c.body));
    await expect(getPost(9999, null)).rejects.toMatchObject({ status: 404 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('lists rooms and their transcripts in id order', async () => {
    const rooms = await listRooms();
    expect(rooms.map((r) => r.id).sort()).toEqual(DEMO_ROOMS.map((r) => r.id).sort());
    const room = await getRoom(DEMO_ROOMS[0].id);
    const messages = await listRecentMessages(DEMO_ROOMS[0].id);
    expect(room?.messageCount).toBe(messages.length);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.map((m) => m.id)).toEqual([...messages.map((m) => m.id)].sort((a, b) => a - b));
    expect(await getRoom(9999)).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('resolves a fixed visitor session without a cookie', async () => {
    expect(await requireSession(new Request('http://demo.local/api/me'))).toEqual(DEMO_VISITOR);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('writes in demo mode are refused with 403', () => {
  it('rejects every write at the data layer', async () => {
    const s = DEMO_VISITOR;
    for (const write of [
      () => createPost(s, { title: '제목', body: '본문' }),
      () => createComment(s, 1, { body: '댓글' }),
      () => toggleLike(s, 1),
      () => createRoom(s, '방'),
      () => createMessage(s, 1, '안녕'),
    ]) {
      await expect(write()).rejects.toMatchObject({ status: 403, code: 'DEMO_READ_ONLY' });
    }
    expect(db.query).not.toHaveBeenCalled();
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it('apiHandler answers non-GET requests with 403 before running the handler', async () => {
    const inner = vi.fn(async () => Response.json({ ok: true }));
    const handler = apiHandler(inner);
    const res = await handler(post('/api/x'), ctx({}));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('DEMO_READ_ONLY');
    expect(body.error.message).toContain('읽기 전용');
    expect(inner).not.toHaveBeenCalled();

    const get = await handler(new Request('http://demo.local/api/x'), ctx({}));
    expect(get.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('every write route returns 403 without touching the database', async () => {
    const routes: [string, Promise<{ POST: (r: Request, c: never) => Promise<Response> }>][] = [
      ['/api/posts', import('../../app/api/posts/route')],
      ['/api/posts/1/comments', import('../../app/api/posts/[id]/comments/route')],
      ['/api/posts/1/like', import('../../app/api/posts/[id]/like/route')],
      ['/api/rooms', import('../../app/api/rooms/route')],
      ['/api/reports', import('../../app/api/reports/route')],
      ['/api/feedback', import('../../app/api/feedback/route')],
      ['/api/_errors', import('../../app/api/%5Ferrors/route')],
    ];
    for (const [url, mod] of routes) {
      const { POST } = await mod;
      const res = await POST(post(url, { title: 't', body: 'b' }), ctx({ id: '1' }) as never);
      expect(res.status, url).toBe(403);
    }
    expect(db.query).not.toHaveBeenCalled();
  });

  it('health reports demo mode instead of probing the database', async () => {
    const { GET } = await import('../../app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: 'demo' });
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('outside demo mode nothing changes', () => {
  beforeEach(() => vi.stubEnv('HUSH_DEMO', ''));

  it('apiHandler runs write handlers', async () => {
    const inner = vi.fn(async () => Response.json({ ok: true }, { status: 201 }));
    const res = await apiHandler(inner)(post('/api/x'), ctx({}));
    expect(res.status).toBe(201);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('reads go to the database', async () => {
    await expect(listPosts(1)).rejects.toThrow('must not touch the database');
    await expect(listRooms()).rejects.toThrow('must not touch the database');
    expect(db.query).toHaveBeenCalled();
  });

  it('requireSession still demands a cookie', async () => {
    await expect(requireSession(new Request('http://x.local/api/me'))).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('read-only UI', () => {
  it('ChatRoom shows the given transcript with the input disabled and no live status', async () => {
    const { ChatRoom } = await import('@/components/ChatRoom');
    const messages = await listRecentMessages(DEMO_ROOMS[0].id);
    const html = renderToStaticMarkup(
      createElement(ChatRoom, { roomId: DEMO_ROOMS[0].id, myNickname: null, transcript: messages }),
    );
    expect(html).toContain(messages[0].body);
    expect(html).not.toContain('연결 중');
    expect(html).toMatch(/<input[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it('ChatRoom without a transcript renders the live view as before', async () => {
    const { ChatRoom } = await import('@/components/ChatRoom');
    const html = renderToStaticMarkup(createElement(ChatRoom, { roomId: 1, myNickname: null }));
    expect(html).toContain('연결 중');
    expect(html).not.toMatch(/<input[^>]*disabled/);
  });

  it('write forms render disabled when readOnly', async () => {
    const { PostForm } = await import('@/components/PostForm');
    const { CommentForm } = await import('@/components/CommentForm');
    const { RoomForm } = await import('@/components/RoomForm');
    for (const el of [
      createElement(PostForm, { readOnly: true }),
      createElement(CommentForm, { postId: 1, readOnly: true }),
      createElement(RoomForm, { readOnly: true }),
    ]) {
      expect(renderToStaticMarkup(el)).toMatch(/<fieldset[^>]*disabled/);
    }
  });

  it('exposes the banner text', () => {
    expect(DEMO_BANNER).toBe('시연용 읽기 전용 화면입니다. 글쓰기와 실시간 채팅은 꺼져 있습니다.');
  });
});
