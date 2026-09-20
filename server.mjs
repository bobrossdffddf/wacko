import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const body = readFileSync(resolve(root, 'index.html'));
const policy = body.toString('utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
if (!policy) throw new Error('Missing compiled Content Security Policy. Run npm run build.');
const securityHeaders = {
  'Content-Security-Policy': policy[1] + "; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-cache'
};

export function createServer() {
  const server = http.createServer({ maxHeaderSize: 8192, headersTimeout: 10000, requestTimeout: 15000, keepAliveTimeout: 5000, connectionsCheckingInterval: 1000 }, (req, res) => {
    for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
    const fail = (status, message, extra = {}) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(message), 'Cache-Control': 'no-store', ...extra });
      res.end(req.method === 'HEAD' ? undefined : message);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(405, 'Method not allowed\n', { Allow: 'GET, HEAD', Connection: 'close' });
    const raw = req.url ?? '';
    if (raw.length > 2048) return fail(414, 'URI too long\n');
    if (!raw.startsWith('/') || raw.startsWith('//')) return fail(400, 'Bad request\n');
    const pathname = raw.split('?')[0];
    if (/%|\\|\x00|\/\./.test(pathname)) return fail(400, 'Bad request\n');
    if (req.headers['transfer-encoding'] || (req.headers['content-length'] && req.headers['content-length'] !== '0')) return fail(400, 'Bad request\n', { Connection: 'close' });
    if (pathname !== '/') return fail(404, 'Not found\n');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  server.setTimeout(15000, socket => socket.destroy());
  server.maxRequestsPerSocket = 100;
  server.maxConnections = 256;
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.HOST && process.env.HOST !== '127.0.0.1') throw new Error('This server only binds to 127.0.0.1. Run cloudflared in the same guest.');
  const host = '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const server = createServer();
  server.listen(port, host, () => console.log(`Wacko listening on http://${host}:${port}`));
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
