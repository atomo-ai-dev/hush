import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import { bannedWordFilter } from '../lib/banned-words';
import { type ChatMessage, createMessage, getRoom, listRecentMessages } from '../lib/chat';
import { describeError, recordError } from '../lib/error-log';
import { ApiError } from '../lib/http';
import { enforceChatLimit } from '../lib/rate-limit';
import { getOrCreateSession, type Session } from '../lib/session';
import { sessionTokenFromCookieHeader } from '../lib/session-token';
import { chatMessageInput } from '../lib/validation';

export const CHAT_PATH = '/ws/chat';
const MAX_PAYLOAD_BYTES = 8 * 1024;

/** Events sent from the server to chat clients. */
export type ServerEvent =
  | { type: 'history'; room: { id: number; name: string }; messages: ChatMessage[] }
  | { type: 'message'; message: ChatMessage }
  | { type: 'presence'; count: number }
  | { type: 'error'; code: string; message: string };

interface Client {
  ws: WebSocket;
  session: Session;
  roomId: number;
  alive: boolean;
  /** Serializes message handling so a client's messages keep their order. */
  queue: Promise<void>;
}

export interface ChatServerOptions {
  heartbeatMs?: number;
}

export interface ChatServer {
  /** Handles an HTTP upgrade for CHAT_PATH (?roomId=N). */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void>;
  connectionCount(roomId: number): number;
  close(): Promise<void>;
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  if (socket.writable) {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }
  socket.destroy();
}

/** Browsers always send Origin on WebSocket upgrades; block cross-site pages. */
function isSameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function send(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
}

export function createChatServer(options: ChatServerOptions = {}): ChatServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
  const rooms = new Map<number, Set<Client>>();

  function members(roomId: number): Set<Client> {
    let set = rooms.get(roomId);
    if (!set) {
      set = new Set();
      rooms.set(roomId, set);
    }
    return set;
  }

  function broadcast(roomId: number, event: ServerEvent): void {
    for (const client of rooms.get(roomId) ?? []) send(client.ws, event);
  }

  function broadcastPresence(roomId: number): void {
    broadcast(roomId, { type: 'presence', count: rooms.get(roomId)?.size ?? 0 });
  }

  async function handleMessage(client: Client, raw: RawData): Promise<void> {
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      send(client.ws, {
        type: 'error',
        code: 'INVALID_JSON',
        message: '메시지 형식이 올바르지 않습니다.',
      });
      return;
    }
    const parsed = chatMessageInput.safeParse(payload);
    if (!parsed.success) {
      send(client.ws, {
        type: 'error',
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0]?.message ?? '메시지가 올바르지 않습니다.',
      });
      return;
    }
    const { body } = parsed.data;
    const banned = bannedWordFilter().find(body);
    if (banned) {
      send(client.ws, {
        type: 'error',
        code: 'BANNED_WORD',
        message: `사용할 수 없는 단어가 포함되어 있어요: "${banned}"`,
      });
      return;
    }
    try {
      enforceChatLimit(client.session.id);
      const message = await createMessage(client.session, client.roomId, body);
      broadcast(client.roomId, { type: 'message', message });
    } catch (err) {
      if (err instanceof ApiError) {
        send(client.ws, { type: 'error', code: err.code, message: err.message });
        return;
      }
      throw err;
    }
  }

  async function reportError(err: unknown, context: Record<string, unknown>): Promise<void> {
    console.error('[chat] unexpected error', err);
    await recordError({ source: 'ws', path: CHAT_PATH, ...describeError(err), context });
  }

  async function onConnection(ws: WebSocket, session: Session, roomId: number, roomName: string) {
    const client: Client = { ws, session, roomId, alive: true, queue: Promise.resolve() };
    members(roomId).add(client);

    ws.on('pong', () => {
      client.alive = true;
    });
    ws.on('message', (raw) => {
      client.queue = client.queue
        .then(() => handleMessage(client, raw))
        .catch(async (err) => {
          await reportError(err, { roomId, sessionId: session.id });
          send(ws, {
            type: 'error',
            code: 'INTERNAL',
            message: '메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
          });
        });
    });
    ws.on('close', () => {
      const set = rooms.get(roomId);
      set?.delete(client);
      if (set?.size === 0) rooms.delete(roomId);
      else broadcastPresence(roomId);
    });
    ws.on('error', () => ws.terminate());

    const messages = await listRecentMessages(roomId);
    send(ws, { type: 'history', room: { id: roomId, name: roomName }, messages });
    broadcastPresence(roomId);
  }

  const heartbeat = setInterval(() => {
    for (const set of rooms.values()) {
      for (const client of set) {
        if (!client.alive) {
          client.ws.terminate();
          continue;
        }
        client.alive = false;
        client.ws.ping();
      }
    }
  }, options.heartbeatMs ?? 30_000);
  heartbeat.unref();

  return {
    async handleUpgrade(req, socket, head) {
      socket.on('error', () => socket.destroy());
      try {
        if (!isSameOrigin(req)) return rejectUpgrade(socket, 403, 'Forbidden');
        const url = new URL(req.url ?? '/', 'http://localhost');
        const roomId = Number(url.searchParams.get('roomId'));
        if (!Number.isSafeInteger(roomId) || roomId <= 0) {
          return rejectUpgrade(socket, 400, 'Bad Request');
        }
        const token = sessionTokenFromCookieHeader(req.headers.cookie);
        if (!token) return rejectUpgrade(socket, 401, 'Unauthorized');

        const room = await getRoom(roomId);
        if (!room) return rejectUpgrade(socket, 404, 'Not Found');
        const session = await getOrCreateSession(token);

        wss.handleUpgrade(req, socket, head, (ws) => {
          onConnection(ws, session, room.id, room.name).catch(async (err) => {
            await reportError(err, { roomId, phase: 'join' });
            ws.close(1011, 'internal error');
          });
        });
      } catch (err) {
        await reportError(err, { phase: 'upgrade', url: req.url });
        rejectUpgrade(socket, 500, 'Internal Server Error');
      }
    },

    connectionCount(roomId) {
      return rooms.get(roomId)?.size ?? 0;
    },

    async close() {
      clearInterval(heartbeat);
      for (const set of rooms.values()) for (const c of set) c.ws.terminate();
      rooms.clear();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
