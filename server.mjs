import http from 'node:http';
import { isIP, BlockList } from 'node:net';
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

const privateIPv4 = value => {
  if (isIP(value) !== 4) return false;
  const [a, b] = value.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};
export function getListenConfig(env = process.env) {
  const host = env.HOST || '192.168.68.58';
  const port = Number(env.PORT || 3000);
  const subnet = env.ALLOWED_SUBNET || '192.168.68.0/24';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  if (host !== '127.0.0.1' && !privateIPv4(host)) throw new Error('HOST must be 127.0.0.1 or a specific private IPv4 address; wildcard and public binding are refused.');
  const [network, prefixText, extra] = subnet.split('/');
  const prefix = Number(prefixText);
  if (extra || !privateIPv4(network) || !/^\d+$/.test(prefixText || '') || !Number.isInteger(prefix) || prefix < 24 || prefix > 32) throw new Error('ALLOWED_SUBNET must be a private IPv4 subnet with prefix /24 through /32.');
  const allowed = new BlockList();
  allowed.addSubnet(network, prefix, 'ipv4');
  allowed.addAddress('127.0.0.1', 'ipv4');
  allowed.addAddress('::1', 'ipv6');
  if (host !== '127.0.0.1' && !allowed.check(host, 'ipv4')) throw new Error('HOST must belong to ALLOWED_SUBNET.');
  return { host, port, subnet, allowedPeers: { has: peer => allowed.check(peer, isIP(peer) === 6 ? 'ipv6' : 'ipv4') } };
}
export function createServer({ allowedPeers = getListenConfig().allowedPeers } = {}) {
  const server = http.createServer({ maxHeaderSize: 8192, headersTimeout: 10000, requestTimeout: 15000, keepAliveTimeout: 5000, connectionsCheckingInterval: 1000 }, (req, res) => {
    for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
    const fail = (status, message, extra = {}) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(message), 'Cache-Control': 'no-store', ...extra });
      res.end(req.method === 'HEAD' ? undefined : message);
    };
    const peer = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (!allowedPeers.has(peer)) return fail(403, 'Forbidden\n', { Connection: 'close' });
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

export function startServer() {
  const { host, port, allowedPeers } = getListenConfig();
  const server = createServer({ allowedPeers });
  server.on('error', error => { console.error(`Unable to start Wacko: ${error.message}`); process.exit(1); });
  server.listen(port, host, () => console.log(`Wacko listening on http://${host}:${port}`));
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
