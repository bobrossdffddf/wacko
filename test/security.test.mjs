import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
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

test('page and locally referenced assets load with security headers', async () => {
  const page = await request('/');
  assert.equal(page.status, 200);
  assert.match(page.body, /I'm Wacko/);
  assert.match(page.headers['content-security-policy'], /script-src 'self'/);
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(page.headers['x-content-type-options'], 'nosniff');
  assert.equal(page.headers['x-frame-options'], 'DENY');
  assert.equal(page.headers['referrer-policy'], 'no-referrer');
  assert.equal(page.headers['x-powered-by'], undefined);
  assert.equal(page.headers['set-cookie'], undefined);
  for (const path of new Set([...page.body.matchAll(/(?:href|src)="(\/[^"#]+)"/g)].map(match => match[1]))) {
    assert.equal((await request(path)).status, 200, path);
  }
  assert.equal((await request('/assets/particles.min.js')).status, 200);
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
  for (const path of ['/server.mjs', '/package.json', '/package-lock.json', '/ecosystem.config.cjs', '/Caddyfile', '/README.md', '/.env', '/.git/config', '/.openai/hosting.json', '/assets/', '/not-found']) {
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
test('only local external scripts are allowed, with no inline handlers or remote assets', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../dist/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script(?![^>]+src=)|\son\w+=|<!--|<iframe|<form|<meta[^>]+generator/i);
  assert.doesNotMatch(css, /@import|https?:\/\/|\/\*/);
  assert.match(html, /mailto:contactweb@wackoxyz\.org/);
  assert.doesNotMatch(html, /Message me|At home|15-node/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);
  assert.equal([...html.matchAll(/<script src="\/[^"]+" integrity="sha384-[^"]+" defer><\/script>/g)].length, 2);
  for (const name of ['comptia', 'cisco', 'discord', 'proxmox', 'terminal']) {
    const svg = readFileSync(new URL(`../dist/assets/${name}.svg`, import.meta.url), 'utf8');
    assert.doesNotMatch(svg, /<script|\son\w+=|<foreignObject|(?:href|src)=|<!ENTITY|<!DOCTYPE/i);
  }
});
