import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('notes anchors match the sections and subsections of the system notes', () => {
  const ids = [...read('notes/system-notes.html').matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(JSON.parse(read('data/notes-anchors.json')), ids);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
});

test('the proposed agreements in the code are exactly the notes headings marked Proposed', async () => {
  const { PROPOSED } = await import('../js/proposed.js');
  const marked = [...read('notes/system-notes.html').matchAll(/<h3 id="([^"]+)">[^<]*(?:<[^h][^>]*>[^<]*<\/[^>]+>[^<]*)*<span class="tier tp">Proposed<\/span><\/h3>/g)].map((m) => m[1]);
  assert.deepEqual([...PROPOSED].sort(), marked.sort());
});

test('the notes are grouped in parts and every section belongs to one', () => {
  const toc = JSON.parse(read('data/notes-toc.json'));
  assert.ok(toc.every((s) => /^Part \d · /.test(s.part)), 'every section has a part');
  assert.deepEqual([...new Set(toc.map((s) => s.part))].map((p) => p.match(/Part (\d)/)[1]), ['1', '2', '3', '4', '5', '6', '7']);
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
