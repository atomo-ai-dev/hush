import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import next from 'next';
import {
  newSessionToken,
  SESSION_COOKIE,
  serializeSessionCookie,
  sessionTokenFromCookieHeader,
} from './src/lib/session-token';

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

server.listen(port, hostname, () => {
  console.log(`> Hush ready on http://localhost:${port} (${dev ? 'development' : 'production'})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
