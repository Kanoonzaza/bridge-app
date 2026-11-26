import { test } from 'node:test';
import assert from 'node:assert/strict';
import ALL, { EVERY } from '../js/system/index.js';
import { HOUSE_CARD, normalizeCard, pick } from '../js/pool/card.js';
import { systemFor, rulesFor, sysOf, isSystem, bookFor, forSeat, HOUSE } from '../js/pool/system.js';

test('the house card plays every rule: its list is ALL itself', () => {
  assert.equal(systemFor(HOUSE_CARD), ALL);
  assert.equal(systemFor(normalizeCard({ base: '2/1', name: 'Someone else' })), ALL);
  assert.equal(ALL.length, 6515);
  assert.equal(sysOf(ALL), HOUSE);
  assert.equal(HOUSE.is('passed-2c', 'drury'), true);
});

test('the same card gets the same list back', () => {
  const c = pick(normalizeCard({ base: '2/1' }), 'nt-defence', 'natural');
  assert.equal(rulesFor(c), rulesFor(normalizeCard({ ...c, name: 'Other name' })));
  assert.ok(isSystem(rulesFor(c)));
  assert.equal(isSystem([...ALL]), false);
});

test('an option switched off takes its rules out and leaves the core', () => {
  const c = pick(normalizeCard({ base: '2/1' }), 'passed-2c', 'natural');
  const list = rulesFor(c);
  assert.equal(list.filter((e) => e.opt === 'passed-2c:drury').length, 0);
  const natural = EVERY.filter((e) => e.opt === 'passed-2c:natural').length;
  assert.ok(natural > 0, 'the natural answer has rules of its own');
  assert.equal(list.length, ALL.length - ALL.filter((e) => e.opt === 'passed-2c:drury').length + natural);
  assert.equal(sysOf(list).is('passed-2c', 'natural'), true);
});

test('a SAYC card drops the 2/1 base and every house-only option, keeps the core', () => {
  const list = rulesFor(normalizeCard({ base: 'sayc' }));
  assert.equal(list.some((e) => e.opt === 'base:2/1'), false);
  assert.equal(list.some((e) => e.opt === 'nt-defence:dont'), false);
  assert.equal(list.filter((e) => e.opt === null).length, ALL.filter((e) => e.opt === null).length);
});

test('"to discuss" marks belong to the card, even when the rules are the house card\'s', () => {
  const c = normalizeCard({ base: '2/1', discuss: ['keycard'] });
  assert.equal(sysOf(systemFor(c)).discuss('keycard'), true);
  assert.equal(HOUSE.discuss('keycard'), false);
});

test('a book has one list per side', () => {
  const other = normalizeCard({ base: '2/1', discuss: ['keycard'] });
  const book = bookFor({ EW: other });
  assert.equal(book.NS, ALL);
  assert.equal(book.EW, systemFor(other));
  assert.notEqual(book.EW, ALL);
  assert.equal(forSeat(book, 'S'), ALL);
  assert.equal(forSeat(book, 'W'), systemFor(other));
  assert.equal(forSeat(ALL, 'W'), ALL);
});

test('answers without rules are bid as on the house card', () => {
  assert.equal(systemFor(pick(normalizeCard({ base: '2/1' }), 'nt-defence', 'landy')), ALL, 'Landy has no rules yet');
  const sayc = systemFor(normalizeCard({ base: 'sayc' }));
  assert.equal(sayc.some((e) => e.opt === 'splinters:on'), false, 'SAYC answers with rules are played');
  assert.equal(sayc.some((e) => e.opt === 'base:2/1'), false, 'SAYC is written: no 2/1 rules');
  assert.equal(sayc.some((e) => e.opt === 'base:sayc'), true);
});
