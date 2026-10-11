import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('notes anchors match the sections of the system notes', () => {
  const ids = [...read('notes/system-notes.html').matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(JSON.parse(read('data/notes-anchors.json')), ids);
});
