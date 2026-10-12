import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('notes anchors match the sections of the system notes', () => {
  const ids = [...read('notes/system-notes.html').matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(JSON.parse(read('data/notes-anchors.json')), ids);
});

test('the in-app notes (guide/) are up to date with notes/ (run `npm run stamp`)', async () => {
  const { outputs } = await import('../tools/build-notes.mjs');
  const root = new URL('..', import.meta.url).pathname;
  for (const [path, text] of Object.entries(outputs(root))) assert.equal(read(path), text, `${path} is stale`);
});

test('the in-app notes link to each other, not to claude.ai, and every app link target exists', () => {
  for (const f of ['guide/system-notes.html', 'guide/convention-card.html']) assert.doesNotMatch(read(f), /claude\.ai\/artifact/);
  const ids = new Set([...read('guide/system-notes.html').matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const s of JSON.parse(read('data/notes-toc.json'))) assert.ok(ids.has(s.id), s.id);
  assert.match(read('js/config.js'), /NOTES_URL = 'guide\/system-notes\.html'/);
});
