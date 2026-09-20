import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const manifest = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/credits.txt': ['credits.txt', 'text/plain; charset=utf-8'],
  '/assets/comptia.svg': ['assets/comptia.svg', 'image/svg+xml'],
  '/assets/cisco.svg': ['assets/cisco.svg', 'image/svg+xml'],
  '/assets/discord.svg': ['assets/discord.svg', 'image/svg+xml'],
  '/assets/proxmox.svg': ['assets/proxmox.svg', 'image/svg+xml'],
  '/assets/terminal.svg': ['assets/terminal.svg', 'image/svg+xml'],
  '/assets/particles.min.js': ['assets/particles.min.js', 'text/javascript; charset=utf-8'],
  '/background.js': ['background.js', 'text/javascript; charset=utf-8'],
  '/assets/dm-sans.woff2': ['assets/dm-sans.woff2', 'font/woff2']
};
const assets = new Map(Object.entries(manifest).map(([route, [file, type]]) => [route, { body: readFileSync(resolve(root, file)), type }]));
const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
    const asset = assets.get(pathname);
    if (!asset) return fail(404, 'Not found\n');
    res.writeHead(200, { 'Content-Type': asset.type, 'Content-Length': asset.body.length });
    res.end(req.method === 'HEAD' ? undefined : asset.body);
  });
  server.maxRequestsPerSocket = 100;
  server.maxConnections = 256;
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
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
