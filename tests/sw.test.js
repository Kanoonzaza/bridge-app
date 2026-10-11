import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
