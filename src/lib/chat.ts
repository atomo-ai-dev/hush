import { query } from './db';
import { isDemoMode } from './demo';
import { seedGetRoom, seedListMessages, seedListRooms } from './demo-seed';
import { ApiError, demoReadOnly } from './http';
import type { Session } from './session';

export const HISTORY_LIMIT = 50;

export interface Room {
  id: number;
  name: string;
  createdAt: string;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface ChatMessage {
  id: number;
  roomId: number;
  nickname: string;
  body: string;
  createdAt: string;
}

interface RoomRow {
  id: string;
  name: string;
  created_at: Date;
  message_count: number;
  last_message_at: Date | null;
}

interface MessageRow {
  id: string;
  room_id: string;
  nickname: string;
  body: string;
  created_at: Date;
}

function toRoom(r: RoomRow): Room {
  return {
    id: Number(r.id),
    name: r.name,
    createdAt: r.created_at.toISOString(),
    messageCount: r.message_count,
    lastMessageAt: r.last_message_at?.toISOString() ?? null,
  };
}

function toMessage(r: MessageRow): ChatMessage {
  return {
    id: Number(r.id),
    roomId: Number(r.room_id),
    nickname: r.nickname,
    body: r.body,
    createdAt: r.created_at.toISOString(),
  };
}

const ROOM_SELECT = `
  SELECT r.id, r.name, r.created_at,
         (SELECT count(*) FROM messages m WHERE m.room_id = r.id)::int AS message_count,
         (SELECT max(m.created_at) FROM messages m WHERE m.room_id = r.id) AS last_message_at
    FROM rooms r`;

export const roomNotFound = () => new ApiError(404, 'NOT_FOUND', '채팅방을 찾을 수 없습니다.');

/** Rooms ordered by most recent activity (new rooms count as activity). */
export async function listRooms(): Promise<Room[]> {
  if (isDemoMode()) return seedListRooms();
  const { rows } = await query<RoomRow>(
    `SELECT * FROM (${ROOM_SELECT}) r
      ORDER BY COALESCE(r.last_message_at, r.created_at) DESC, r.id DESC
      LIMIT 100`,
  );
  return rows.map(toRoom);
}

export async function getRoom(id: number): Promise<Room | null> {
  if (isDemoMode()) return seedGetRoom(id);
  const { rows } = await query<RoomRow>(`${ROOM_SELECT} WHERE r.id = $1`, [id]);
  return rows[0] ? toRoom(rows[0]) : null;
}

export async function createRoom(session: Session, name: string): Promise<Room> {
  if (isDemoMode()) throw demoReadOnly();
  const { rows } = await query<{ id: string }>(
    'INSERT INTO rooms (name, session_id) VALUES ($1, $2) RETURNING id',
    [name, session.id],
  );
  const room = await getRoom(Number(rows[0].id));
  if (!room) throw new Error('room vanished after insert');
  return room;
}

/** The latest `limit` messages of a room, oldest first. */
export async function listRecentMessages(
  roomId: number,
  limit = HISTORY_LIMIT,
): Promise<ChatMessage[]> {
  if (isDemoMode()) return seedListMessages(roomId, limit);
  const { rows } = await query<MessageRow>(
    `SELECT * FROM (
       SELECT m.id, m.room_id, s.nickname, m.body, m.created_at
         FROM messages m JOIN sessions s ON s.id = m.session_id
        WHERE m.room_id = $1
        ORDER BY m.id DESC
        LIMIT $2
     ) recent ORDER BY id ASC`,
    [roomId, limit],
  );
  return rows.map(toMessage);
}

export async function createMessage(
  session: Session,
  roomId: number,
  body: string,
): Promise<ChatMessage> {
  if (isDemoMode()) throw demoReadOnly();
  try {
    const { rows } = await query<MessageRow>(
      `INSERT INTO messages (room_id, session_id, body) VALUES ($1, $2, $3)
       RETURNING id, room_id, $4::text AS nickname, body, created_at`,
      [roomId, session.id, body, session.nickname],
    );
    return toMessage(rows[0]);
  } catch (err) {
    // foreign_key_violation: the room was deleted or never existed.
    if ((err as { code?: string }).code === '23503') throw roomNotFound();
    throw err;
  }
}
