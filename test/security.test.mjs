import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from '../server.mjs';

let server;
let port;
before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});
function request(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('the only public page loads with security headers', async () => {
  const page = await request('/');
  assert.equal(page.status, 200);
  assert.match(page.body, /I'm Wacko/);
  assert.match(page.headers['content-security-policy'], /script-src 'sha384-/);
  assert.equal(page.headers['strict-transport-security'], 'max-age=31536000');
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(page.headers['x-content-type-options'], 'nosniff');
  assert.equal(page.headers['x-frame-options'], 'DENY');
  assert.equal(page.headers['referrer-policy'], 'no-referrer');
  assert.equal(page.headers['x-powered-by'], undefined);
  assert.equal(page.headers['set-cookie'], undefined);
  assert.doesNotMatch(page.body, /(?:src|href)="\//);
  assert.equal((await request('/index.html')).status, 404);
  assert.equal((await request('/assets/particles.min.js')).status, 404);
});
test('only GET and HEAD are accepted', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'TRACE']) {
    const response = await request('/', method);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.allow, 'GET, HEAD');
  }
  const head = await request('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});
test('traversal, encoded paths, and protocol-relative targets are rejected', async () => {
  for (const path of ['/../server.mjs', '/assets/../../package.json', '/%2e%2e/server.mjs', '/assets%2f..%2fserver.mjs', '/%252e%252e/server.mjs', '/assets\\..\\server.mjs', '/%00', '/%GG', '//example.com/']) {
    assert.equal((await request(path)).status, 400, path);
  }
});
test('private source, dotfiles, configs, and unknown resources are never served', async () => {
  for (const path of ['/server.mjs', '/package.json', '/package-lock.json', '/ecosystem.config.cjs', '/cloudflared.example.yml', '/index.html', '/credits.txt', '/style.css', '/background.js', '/src/index.html', '/api', '/admin', '/health', '/debug', '/metrics', '/README.md', '/.env', '/.git/config', '/.openai/hosting.json', '/assets/', '/not-found']) {
    const response = await request(path);
    assert.ok([400, 404].includes(response.status), path);
    assert.match(response.headers['content-security-policy'], /default-src 'none'/);
    assert.doesNotMatch(response.body, /import |secret|appgprj_/);
  }
});
test('request limits and query parameters do not expose files or reflect markup', async () => {
  assert.equal((await request('/' + 'a'.repeat(2050))).status, 414);
  const query = await request('/?file=../server.mjs&x=%3Cscript%3E');
  assert.equal(query.status, 200);
  assert.doesNotMatch(query.body, /file=|server\.mjs/);
  assert.equal((await request('/', 'GET', { 'Content-Length': '1' })).status, 400);
});
test('embedded scripts and styles have matching restrictive CSP hashes', async () => {
  const { body: html, headers } = await request('/');
  const blocks = [...html.matchAll(/<(script|style)>([\s\S]*?)<\/\1>/g)];
  assert.equal(blocks.filter(m => m[1] === 'script').length, 2);
  assert.equal(blocks.filter(m => m[1] === 'style').length, 1);
  for (const block of blocks) {
    const hash = "'sha384-" + createHash('sha384').update(block[2]).digest('base64') + "'";
    assert.ok(headers['content-security-policy'].includes(hash));
  }
  assert.doesNotMatch(headers['content-security-policy'], /unsafe-inline|unsafe-eval|https:|http:/);
  assert.match(headers['content-security-policy'], /connect-src 'none'/);
  assert.doesNotMatch(html, /\son\w+=|<iframe|<form|<meta[^>]+generator/i);
  assert.match(html, /mailto:contactweb@wackoxyz\.org/);
  assert.doesNotMatch(html, /Message me|At home|15-node/);
  assert.doesNotMatch(html, /(?:src|href)="\//);
  const css = blocks.find(m => m[1] === 'style')[2];
  assert.doesNotMatch(css, /@import|url\(["']?\//);
  for (const name of ['comptia', 'cisco', 'discord', 'proxmox', 'terminal']) {
    const svg = readFileSync(new URL(`../src/assets/${name}.svg`, import.meta.url), 'utf8');
    assert.doesNotMatch(svg, /<script|\son\w+=|<foreignObject|(?:href|src)=|<!ENTITY|<!DOCTYPE/i);
  }
});
test('public interface binding is refused', () => {
  const result = spawnSync(process.execPath, ['server.mjs'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, HOST: '0.0.0.0' }, encoding: 'utf8', timeout: 3000
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /only binds to 127\.0\.0\.1/);
});
