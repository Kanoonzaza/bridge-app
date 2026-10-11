import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheName, currentCache, listedFiles } from '../tools/sw-hash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const listed = [...sw.matchAll(/'([^']+\.(?:js|css|html|json|png|webmanifest))'/g)].map((m) => m[1]);

function jsFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? jsFiles(`${dir}/${d.name}`) : d.name.endsWith('.js') ? [`${dir}/${d.name}`] : []);
}

test('service worker caches every app module', () => {
  for (const f of jsFiles('js')) assert.ok(listed.includes(f), `sw.js is missing ${f}`);
});

test('every cached file exists', () => {
  for (const f of listed) assert.ok(existsSync(join(root, f)), `missing file ${f}`);
});

test('non-JS shell files are cached', () => {
  for (const f of ['index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']) {
    assert.ok(listed.includes(f), `sw.js is missing ${f}`);
  }
});

test('fetches fresh copies when installing', () => {
  assert.match(sw, /cache: 'reload'/);
});

test('CACHE matches the current files (run `npm run stamp`)', () => {
  assert.equal(currentCache(sw), cacheName(root, sw));
});

test('listedFiles reads the FILES array', () => {
  assert.deepEqual(listedFiles("const FILES = [\n  './',\n  'a.js',\n];"), ['./', 'a.js']);
});
