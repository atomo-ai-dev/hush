import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import next from 'next';

if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number.parseInt(process.env.PORT || '4620', 10);
const hostname = process.env.HOST || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev, port, hostname: 'localhost' });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
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
