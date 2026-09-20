import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = path => readFileSync(new URL('./src/' + path, import.meta.url));
const data = (path, type) => `data:${type};base64,${read(path).toString('base64')}`;
const hash = content => `'sha384-${createHash('sha384').update(content).digest('base64')}'`;
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
let html = read('index.html').toString('utf8');
let css = read('style.css').toString('utf8');
css = css.replace('/assets/dm-sans.woff2', data('assets/dm-sans.woff2', 'font/woff2'));
html = html.replace(/  <link rel="preload"[^>]+>\n/, '');
html = html.replace(/<link rel="stylesheet" href="\/style.css">/, `<style>${css}</style>`);
html = html.replace(/(src|href)="\/assets\/([^"/]+\.svg)"/g, (_match, attr, file) => `${attr}="${data('assets/' + file, 'image/svg+xml')}"`);
const scripts = [];
html = html.replace(/<script src="\/([^"]+)"[^>]*><\/script>\n?/g, (_match, file) => {
  const js = read(file).toString('utf8');
  if (/<\/script/i.test(js)) throw new Error('Unexpected script terminator');
  scripts.push(js);
  return '';
});
html = html.replace('</body>', scripts.map(js => `<script>${js}</script>`).join('\n') + '\n</body>');
const policy = `default-src 'none'; script-src ${scripts.map(hash).join(' ')}; style-src ${hash(css)}; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
html = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]+/, (_match, prefix) => prefix + policy);
html = html.replace('__ASSET_CREDITS__', escape(read('credits.txt').toString('utf8')));
if (/(?:href|src)="\//.test(html) || /url\(["']?\//.test(css)) throw new Error('Unbundled asset URL');
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/index.html', import.meta.url), html);
console.log('Built one self-contained page with hash-pinned scripts and styles.');
