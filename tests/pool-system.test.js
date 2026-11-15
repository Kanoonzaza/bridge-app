import { test } from 'node:test';
import assert from 'node:assert/strict';
import ALL from '../js/system/index.js';
import { HOUSE_CARD, normalizeCard, pick } from '../js/pool/card.js';
import { systemFor, sysOf, isSystem, bookFor, forSeat, HOUSE } from '../js/pool/system.js';

test('the house card plays every rule: its list is ALL itself', () => {
  assert.equal(systemFor(HOUSE_CARD), ALL);
  assert.equal(systemFor(normalizeCard({ base: '2/1', name: 'Someone else' })), ALL);
  assert.equal(ALL.length, 6515);
  assert.equal(sysOf(ALL), HOUSE);
  assert.equal(HOUSE.is('passed-2c', 'drury'), true);
});

test('the same card gets the same list back', () => {
  const c = pick(normalizeCard({ base: '2/1' }), 'nt-defence', 'natural');
  assert.equal(systemFor(c), systemFor(normalizeCard({ ...c, name: 'Other name' })));
  assert.ok(isSystem(systemFor(c)));
  assert.equal(isSystem([...ALL]), false);
});

test('an option switched off takes its rules out and leaves the core', () => {
  const c = pick(normalizeCard({ base: '2/1' }), 'passed-2c', 'natural');
  const list = systemFor(c);
  assert.equal(list.filter((e) => e.opt === 'passed-2c:drury').length, 0);
  assert.equal(list.length, ALL.length - ALL.filter((e) => e.opt === 'passed-2c:drury').length);
  assert.equal(sysOf(list).is('passed-2c', 'natural'), true);
});

test('a SAYC card drops the 2/1 base and every house-only option, keeps the core', () => {
  const list = systemFor(normalizeCard({ base: 'sayc' }));
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
  const sayc = normalizeCard({ base: 'sayc' });
  const book = bookFor({ EW: sayc });
  assert.equal(book.NS, ALL);
  assert.equal(book.EW, systemFor(sayc));
  assert.equal(forSeat(book, 'S'), ALL);
  assert.equal(forSeat(book, 'W'), systemFor(sayc));
  assert.equal(forSeat(ALL, 'W'), ALL);
});
