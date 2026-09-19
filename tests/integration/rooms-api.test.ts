import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createMessage, HISTORY_LIMIT, listRecentMessages } from '@/lib/chat';
import { closePool } from '@/lib/db';
import { getOrCreateSession } from '@/lib/session';
import { GET as getRoom } from '../../app/api/rooms/[id]/route';
import { POST as createRoom, GET as listRooms } from '../../app/api/rooms/route';
import { ctx, dbAvailable, noParams, resetDb, TestClient } from './helpers';

async function create(client: TestClient, name: string) {
  return createRoom(client.request('/api/rooms', { body: { name } }), noParams);
}

describe.skipIf(!dbAvailable)('rooms API (integration)', () => {
  beforeEach(resetDb);
  afterAll(closePool);

  it('creates rooms and lists them by latest activity', async () => {
    const alice = new TestClient();
    const first = await create(alice, '  수다방  ');
    expect(first.status).toBe(201);
    const { room: talk } = await first.json();
    expect(talk).toMatchObject({ name: '수다방', messageCount: 0, lastMessageAt: null });
    const { room: games } = await (await create(alice, '게임방')).json();

    let rooms = (await (await listRooms(alice.request('/api/rooms'), noParams)).json()).rooms;
    expect(rooms.map((r: { name: string }) => r.name)).toEqual(['게임방', '수다방']);

    // A new message bumps the older room to the top.
    await createMessage(await getOrCreateSession(alice.token), talk.id, '안녕');
    rooms = (await (await listRooms(alice.request('/api/rooms'), noParams)).json()).rooms;
    expect(rooms.map((r: { id: number }) => r.id)).toEqual([talk.id, games.id]);
    expect(rooms[0].messageCount).toBe(1);
  });

  it('validates the room name', async () => {
    const alice = new TestClient();
    expect((await create(alice, '   ')).status).toBe(400);
    expect((await create(alice, 'a'.repeat(41))).status).toBe(400);
    expect((await create(alice, 'b'.repeat(40))).status).toBe(201);
    const banned = await create(alice, 'fuck room');
    expect(banned.status).toBe(400);
    expect((await banned.json()).error.code).toBe('BANNED_WORD');
  });

  it('limits room creation per session', async () => {
    const alice = new TestClient();
    for (let i = 0; i < 3; i++) expect((await create(alice, `방 ${i}`)).status).toBe(201);
    expect((await create(alice, '방 4')).status).toBe(429);
  });

  it('GET /api/rooms/:id returns the room with the last 50 messages, oldest first', async () => {
    const alice = new TestClient();
    const { room } = await (await create(alice, '기록방')).json();
    const session = await getOrCreateSession(alice.token);
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++)
      await createMessage(session, room.id, `메시지 ${i}`);

    const res = await getRoom(alice.request('/x'), ctx({ id: String(room.id) }));
    const { messages } = await res.json();
    expect(messages).toHaveLength(HISTORY_LIMIT);
    expect(messages[0].body).toBe('메시지 6');
    expect(messages.at(-1).body).toBe(`메시지 ${HISTORY_LIMIT + 5}`);
    expect(messages[0].nickname).toBe(session.nickname);
  });

  it('GET /api/rooms/:id is 404 for unknown rooms', async () => {
    const res = await getRoom(new TestClient().request('/x'), ctx({ id: '777' }));
    expect(res.status).toBe(404);
  });

  it('createMessage rejects unknown rooms with 404', async () => {
    const session = await getOrCreateSession(new TestClient().token);
    await expect(createMessage(session, 999, 'hi')).rejects.toMatchObject({ status: 404 });
    expect(await listRecentMessages(999)).toEqual([]);
  });
});
