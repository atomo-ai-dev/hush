import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createRoom } from '@/lib/chat';
import { closePool, query } from '@/lib/db';
import { CHAT_LIMIT } from '@/lib/rate-limit';
import { getOrCreateSession } from '@/lib/session';
import { SESSION_COOKIE } from '@/lib/session-token';
import {
  CHAT_PATH,
  type ChatServer,
  createChatServer,
  type ServerEvent,
} from '@/server/chat-server';
import { dbAvailable, resetDb, TestClient } from './helpers';

/** A WebSocket test client that buffers events so none are missed between awaits. */
class ChatClient {
  readonly events: ServerEvent[] = [];
  private waiters: Array<() => void> = [];

  constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => {
      this.events.push(JSON.parse(data.toString()));
      for (const w of this.waiters.splice(0)) w();
    });
  }

  /** Waits for (and consumes) the next event of the given type. */
  async next<T extends ServerEvent['type']>(
    type: T,
    timeoutMs = 3000,
  ): Promise<Extract<ServerEvent, { type: T }>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const i = this.events.findIndex((e) => e.type === type);
      if (i >= 0) return this.events.splice(i, 1)[0] as Extract<ServerEvent, { type: T }>;
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`timed out waiting for "${type}"`);
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, left);
        this.waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
  }

  send(payload: unknown) {
    this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
  }

  close() {
    this.ws.close();
  }
}

describe.skipIf(!dbAvailable)('chat WebSocket server (integration)', () => {
  let server: Server;
  let chat: ChatServer;
  let base: string;
  const open: ChatClient[] = [];

  beforeAll(async () => {
    chat = createChatServer({ heartbeatMs: 60_000 });
    server = createServer((_req, res) => res.writeHead(404).end());
    server.on('upgrade', (req, socket, head) => {
      if (new URL(req.url ?? '/', 'http://x').pathname === CHAT_PATH) {
        void chat.handleUpgrade(req, socket, head);
      } else {
        socket.destroy();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}${CHAT_PATH}`;
  });

  afterAll(async () => {
    await chat.close();
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  });

  beforeEach(resetDb);
  afterEach(() => {
    for (const c of open.splice(0)) c.close();
  });

  async function newRoom(name = '테스트방') {
    return createRoom(await getOrCreateSession(new TestClient().token), name);
  }

  function connect(
    roomId: number | string,
    user: TestClient | null = new TestClient(),
    headers: Record<string, string> = {},
  ): Promise<ChatClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${base}?roomId=${roomId}`, {
        headers: { ...(user ? { cookie: `${SESSION_COOKIE}=${user.token}` } : {}), ...headers },
      });
      const client = new ChatClient(ws);
      ws.once('open', () => {
        open.push(client);
        resolve(client);
      });
      ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
      ws.once('error', reject);
    });
  }

  it('delivers history on join and round-trips messages between two clients', async () => {
    const room = await newRoom();
    const alice = new TestClient();
    const bob = new TestClient();

    const a = await connect(room.id, alice);
    const history = await a.next('history');
    expect(history.room).toEqual({ id: room.id, name: '테스트방' });
    expect(history.messages).toEqual([]);

    const b = await connect(room.id, bob);
    await b.next('history');
    expect((await a.next('presence')).count).toBeGreaterThanOrEqual(1);

    a.send({ type: 'message', body: '  안녕 밥!  ' });
    const received = await b.next('message');
    const echoed = await a.next('message');
    expect(received.message).toMatchObject({ roomId: room.id, body: '안녕 밥!' });
    expect(received.message.nickname).toBe((await getOrCreateSession(alice.token)).nickname);
    expect(echoed.message.id).toBe(received.message.id);

    // Persisted, and replayed to a newcomer.
    const { rows } = await query('SELECT body FROM messages WHERE room_id = $1', [room.id]);
    expect(rows).toEqual([{ body: '안녕 밥!' }]);
    const c = await connect(room.id);
    expect((await c.next('history')).messages.map((m) => m.body)).toEqual(['안녕 밥!']);
  });

  it('only broadcasts within the same room', async () => {
    const [r1, r2] = [await newRoom('방1'), await newRoom('방2')];
    const a = await connect(r1.id);
    const b = await connect(r2.id);
    await a.next('history');
    await b.next('history');

    a.send({ type: 'message', body: '방1 전용' });
    await a.next('message');
    b.send({ type: 'message', body: '방2 전용' });
    const got = await b.next('message');
    expect(got.message.body).toBe('방2 전용');
    expect(b.events.filter((e) => e.type === 'message')).toEqual([]);
  });

  it('loads only the latest 50 messages as history', async () => {
    const room = await newRoom();
    const session = await getOrCreateSession(new TestClient().token);
    await query(
      `INSERT INTO messages (room_id, session_id, body)
       SELECT $1, $2, 'm' || g FROM generate_series(1, 60) g`,
      [room.id, session.id],
    );
    const a = await connect(room.id);
    const { messages } = await a.next('history');
    expect(messages).toHaveLength(50);
    expect(messages[0].body).toBe('m11');
    expect(messages[49].body).toBe('m60');
  });

  it('rejects empty, whitespace-only, oversized, malformed and banned messages', async () => {
    const room = await newRoom();
    const a = await connect(room.id);
    await a.next('history');

    a.send({ type: 'message', body: '' });
    expect(await a.next('error')).toMatchObject({ code: 'VALIDATION_FAILED' });
    a.send({ type: 'message', body: ' \n\t ' });
    expect((await a.next('error')).message).toBe('메시지을(를) 입력해 주세요.');
    a.send({ type: 'message', body: 'x'.repeat(501) });
    expect((await a.next('error')).code).toBe('VALIDATION_FAILED');
    a.send('not json');
    expect((await a.next('error')).code).toBe('INVALID_JSON');
    a.send({ type: 'shout', body: 'hi' });
    expect((await a.next('error')).code).toBe('VALIDATION_FAILED');
    a.send({ type: 'message', body: 'you BITCH' });
    expect((await a.next('error')).code).toBe('BANNED_WORD');

    const { rows } = await query('SELECT count(*)::int AS n FROM messages');
    expect(rows[0].n).toBe(0);
  });

  it(`rate limits chat to ${CHAT_LIMIT.limit} messages per ${CHAT_LIMIT.windowMs / 1000}s`, async () => {
    const room = await newRoom();
    const a = await connect(room.id);
    await a.next('history');
    for (let i = 0; i <= CHAT_LIMIT.limit; i++) a.send({ type: 'message', body: `m${i}` });
    const error = await a.next('error');
    expect(error.code).toBe('RATE_LIMITED');
    const { rows } = await query('SELECT count(*)::int AS n FROM messages');
    expect(rows[0].n).toBe(CHAT_LIMIT.limit);
  });

  it('refuses upgrades without a session, for unknown rooms, bad ids or foreign origins', async () => {
    const room = await newRoom();
    await expect(connect(room.id, null)).rejects.toThrow('HTTP 401');
    await expect(connect(424242)).rejects.toThrow('HTTP 404');
    await expect(connect('abc')).rejects.toThrow('HTTP 400');
    await expect(
      connect(room.id, new TestClient(), { origin: 'https://evil.example' }),
    ).rejects.toThrow('HTTP 403');
  });

  it('tracks presence as clients leave', async () => {
    const room = await newRoom();
    const a = await connect(room.id);
    await a.next('history');
    const b = await connect(room.id);
    await b.next('history');
    await expect.poll(() => chat.connectionCount(room.id)).toBe(2);
    let presence = await a.next('presence');
    while (presence.count !== 2) presence = await a.next('presence');

    b.close();
    while (presence.count !== 1) presence = await a.next('presence');
    expect(chat.connectionCount(room.id)).toBe(1);
  });
});
