/**
 * End-to-end smoke test against a running Hush server.
 *   pnpm smoke                      # http://localhost:4620
 *   pnpm smoke http://host:port
 * Exercises sessions, board, likes, reports, rate limiting and WebSocket chat.
 */
// biome-ignore-all lint/suspicious/noExplicitAny: loosely typed JSON in a throwaway smoke script
import WebSocket from 'ws';

const BASE = (process.argv[2] ?? 'http://localhost:4620').replace(/\/$/, '');
let failures = 0;

function check(label: string, ok: boolean, detail: unknown = '') {
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${label}${detail === '' ? '' : ` — ${JSON.stringify(detail)}`}`);
}

/** A cookie-carrying HTTP client, like one browser. */
class Browser {
  cookie = '';

  async fetch(path: string, init: { method?: string; body?: unknown } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, headers: res.headers, json, text };
  }

  static async visit(): Promise<Browser> {
    const b = new Browser();
    await b.fetch('/');
    return b;
  }
}

function openChat(browser: Browser, roomId: number) {
  const url = `${BASE.replace(/^http/, 'ws')}/ws/chat?roomId=${roomId}`;
  const ws = new WebSocket(url, { headers: { cookie: browser.cookie } });
  const events: any[] = [];
  ws.on('message', (d) => events.push(JSON.parse(d.toString())));
  const waitFor = async (pred: (e: any) => boolean, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const i = events.findIndex(pred);
      if (i >= 0) return events.splice(i, 1)[0];
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('timeout waiting for chat event');
  };
  return new Promise<{ ws: WebSocket; waitFor: typeof waitFor }>((resolve, reject) => {
    ws.once('open', () => resolve({ ws, waitFor }));
    ws.once('error', reject);
  });
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  // 1. Anonymous session + nickname
  const alice = await Browser.visit();
  check('first visit sets httpOnly hush_sid cookie', alice.cookie.startsWith('hush_sid='));
  const me = await alice.fetch('/api/me');
  check('GET /api/me returns a nickname', me.status === 200 && !!me.json?.nickname, me.json);

  // 2. Board
  const created = await alice.fetch('/api/posts', {
    body: { title: `스모크 테스트 ${Date.now()}`, body: '<b>태그는</b> 그대로 텍스트' },
  });
  check('create post → 201', created.status === 201, created.json?.post?.id);
  const postId: number = created.json.post.id;
  const comment = await alice.fetch(`/api/posts/${postId}/comments`, { body: { body: '첫 댓글' } });
  check('comment → 201', comment.status === 201);
  const bob = await Browser.visit();
  const like1 = await bob.fetch(`/api/posts/${postId}/like`, { method: 'POST' });
  const like2 = await alice.fetch(`/api/posts/${postId}/like`, { method: 'POST' });
  check('likes from two sessions', like2.json?.likeCount === 2, [like1.json, like2.json]);
  const unlike = await bob.fetch(`/api/posts/${postId}/like`, { method: 'POST' });
  check(
    'like toggles off',
    unlike.json?.liked === false && unlike.json?.likeCount === 1,
    unlike.json,
  );
  const detail = await bob.fetch(`/api/posts/${postId}`);
  check(
    'post detail has comment and counts',
    detail.json?.comments?.length === 1 && detail.json?.post?.commentCount === 1,
  );
  const page = await bob.fetch(`/posts/${postId}`);
  check(
    'post page renders and escapes HTML',
    page.status === 200 && page.text.includes('&lt;b&gt;'),
  );
  const banned = await alice.fetch('/api/posts', { body: { title: 'FUCK', body: 'x' } });
  check('banned word → 400', banned.status === 400, banned.json?.error?.code);

  // 3. Reports: three distinct sessions hide the post
  for (let i = 0; i < 3; i++) {
    const r = await (await Browser.visit()).fetch('/api/reports', {
      body: { targetType: 'post', targetId: postId },
    });
    if (i === 2) check('3rd distinct report hides the post', r.json?.hidden === true, r.json);
  }
  const list = await alice.fetch('/api/posts');
  check(
    'hidden post is gone from the list',
    !list.json.posts.some((p: { id: number }) => p.id === postId),
  );
  check('hidden post detail → 404', (await alice.fetch(`/api/posts/${postId}`)).status === 404);

  // 4. Rate limiting: 5 writes per minute
  const spammer = await Browser.visit();
  const statuses: number[] = [];
  let limited: Awaited<ReturnType<Browser['fetch']>> | null = null;
  for (let i = 0; i < 6; i++) {
    const r = await spammer.fetch('/api/posts', { body: { title: `도배 ${i}`, body: '.' } });
    statuses.push(r.status);
    if (r.status === 429) limited = r;
  }
  check('6th write in a minute → 429', statuses.join(',') === '201,201,201,201,201,429', statuses);
  check(
    '429 has Retry-After and Korean message',
    !!limited?.headers.get('retry-after') && /1분에 5개/.test(limited?.json?.error?.message ?? ''),
    limited?.json?.error?.message,
  );

  // 5. Chat over WebSocket
  const room = await alice.fetch('/api/rooms', {
    body: { name: `스모크방 ${Date.now() % 10000}` },
  });
  check('create room → 201', room.status === 201, room.json?.room?.id);
  const roomId: number = room.json.room.id;
  const a = await openChat(alice, roomId);
  const b = await openChat(bob, roomId);
  await a.waitFor((e) => e.type === 'history');
  await b.waitFor((e) => e.type === 'history');
  a.ws.send(JSON.stringify({ type: 'message', body: '안녕하세요 밥!' }));
  const got = await b.waitFor((e) => e.type === 'message');
  check(
    'chat message reaches the other client',
    got.message.body === '안녕하세요 밥!',
    got.message,
  );
  b.ws.send(JSON.stringify({ type: 'message', body: '   ' }));
  const err = await b.waitFor((e) => e.type === 'error');
  check('whitespace-only chat message rejected', err.code === 'VALIDATION_FAILED', err.message);
  a.ws.close();
  b.ws.close();
  const history = await bob.fetch(`/api/rooms/${roomId}`);
  check(
    'chat message persisted (room history)',
    history.json?.messages?.some((m: { body: string }) => m.body === '안녕하세요 밥!'),
  );
  const c = await openChat(await Browser.visit(), roomId);
  const replay = await c.waitFor((e) => e.type === 'history');
  check('newcomer receives history on join', replay.messages.length === 1);
  c.ws.close();

  // 6. Feedback
  const fb = await alice.fetch('/api/feedback', { body: { message: '스모크 테스트 버그 신고' } });
  check('feedback → 201', fb.status === 201);

  console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
