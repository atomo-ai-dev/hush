import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import next from 'next';
import {
  newSessionToken,
  SESSION_COOKIE,
  serializeSessionCookie,
  sessionTokenFromCookieHeader,
} from './src/lib/session-token';
import { CHAT_PATH, createChatServer } from './src/server/chat-server';

if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number.parseInt(process.env.PORT || '4620', 10);
const hostname = process.env.HOST || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev, port, hostname: 'localhost' });
const handle = app.getRequestHandler();

/**
 * Issues the anonymous session cookie on the first visit. The new cookie is
 * also injected into the incoming request so that the very first render
 * already sees the session. Headers must be set before Next starts writing.
 */
function ensureSessionCookie(req: IncomingMessage, res: ServerResponse): void {
  if (sessionTokenFromCookieHeader(req.headers.cookie)) return;
  const token = newSessionToken();
  const secure = req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', serializeSessionCookie(token, { secure }));
  const others = (req.headers.cookie ?? '')
    .split(';')
    .filter((c) => c.trim() && !c.trim().startsWith(`${SESSION_COOKIE}=`));
  req.headers.cookie = [`${SESSION_COOKIE}=${token}`, ...others.map((c) => c.trim())].join('; ');
}

await app.prepare();

const server = createServer((req, res) => {
  if (!req.url?.startsWith('/_next/')) ensureSessionCookie(req, res);
  handle(req, res);
});

// Real-time chat. Next.js attaches its own upgrade listener (dev HMR) to this
// server as well; it leaves paths it does not route, such as CHAT_PATH, alone.
const chat = createChatServer();
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname === CHAT_PATH) void chat.handleUpgrade(req, socket, head);
});

server.listen(port, hostname, () => {
  console.log(`> Hush ready on http://localhost:${port} (${dev ? 'development' : 'production'})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void chat.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
