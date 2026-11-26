import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SLOTS, GROUPS, slot, option, isOpt } from '../js/pool/catalog.js';

const anchors = JSON.parse(readFileSync(new URL('../data/notes-anchors.json', import.meta.url), 'utf8'));

test('slots and options have unique ids', () => {
  assert.equal(new Set(SLOTS.map((s) => s.id)).size, SLOTS.length);
  for (const s of SLOTS) assert.equal(new Set(s.options.map((o) => o.id)).size, s.options.length, s.id);
});

test('every slot has a known group, a title and two or more options with a card line', () => {
  const groups = new Set(GROUPS.map(([g]) => g));
  for (const s of SLOTS) {
    assert.ok(groups.has(s.group), s.id);
    assert.ok(s.title, s.id);
    assert.ok(s.options.length >= 2, s.id);
    for (const o of s.options) {
      assert.ok(o.title && o.line, `${s.id}:${o.id}`);
      assert.equal(typeof o.ready, 'boolean', `${s.id}:${o.id}`);
    }
  }
});

test('every option that links to the notes links to a real section', () => {
  for (const s of SLOTS) for (const o of s.options) if (o.notes) assert.ok(anchors.includes(o.notes), `${s.id}:${o.id} -> ${o.notes}`);
});

test('every bidding slot has at least one ready option (the one our system plays)', () => {
  for (const s of SLOTS) assert.ok(s.options.some((o) => o.ready), s.id);
});

test('lookups', () => {
  assert.equal(slot('passed-2c').title.includes('2♣'), true);
  assert.equal(option('passed-2c', 'drury').title, 'Drury');
  assert.equal(option('passed-2c', 'nope'), null);
  assert.equal(isOpt('nt-defence:dont'), true);
  assert.equal(isOpt('nt-defence:nope'), false);
  assert.equal(isOpt('nope'), false);
});
