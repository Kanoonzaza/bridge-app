import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAdvisor, cleanDecoder, cleanTab, acceptedCalls } from '../js/state.js';
import { emptyHand } from '../js/cards.js';

const DEFAULT_ADVISOR = { hand: emptyHand(), opener: 'me', seat: 1, ourCalls: [], compete: false };

test('cleanAdvisor gives defaults for junk input', () => {
  for (const junk of [null, undefined, 5, 'x', [], [1, 2], true]) assert.deepEqual(cleanAdvisor(junk), DEFAULT_ADVISOR);
});

test('cleanAdvisor keeps a valid state unchanged', () => {
  const s = { hand: { S: 'AKQ', H: 'J98', D: 'T765', C: '432' }, opener: 'partner', seat: 3, ourCalls: ['1H', 'P', 'X', 'XX', '7N'], compete: true };
  assert.deepEqual(cleanAdvisor(s), s);
});

test('cleanAdvisor sanitises hand strings', () => {
  const h = cleanAdvisor({ hand: { S: '2KAK', H: 'zz9', D: 5, C: null } }).hand;
  assert.deepEqual(h, { S: 'AK2', H: '9', D: '', C: '' });
});

test('cleanAdvisor resets a hand with more than 13 cards', () => {
  assert.deepEqual(cleanAdvisor({ hand: { S: 'AKQJT98', H: 'AKQJT98', D: '', C: '' } }).hand, emptyHand());
  assert.deepEqual(cleanAdvisor({ hand: [] }).hand, emptyHand());
});

test('cleanAdvisor validates opener, seat and calls', () => {
  const c = cleanAdvisor({ opener: 'them', seat: 5, ourCalls: ['1S', 'bad', 9, '8C', '0N', 'P', null, 'XX'] });
  assert.equal(c.opener, 'me');
  assert.equal(c.seat, 1);
  assert.deepEqual(c.ourCalls, ['1S', 'P', 'XX']);
  assert.equal(cleanAdvisor({ seat: 2.5 }).seat, 1);
  assert.equal(cleanAdvisor({ seat: '2' }).seat, 1);
  assert.deepEqual(cleanAdvisor({ ourCalls: 'P' }).ourCalls, []);
});

test('cleanDecoder', () => {
  assert.deepEqual(cleanDecoder(null), { dealer: 'S', calls: [] });
  assert.deepEqual(cleanDecoder([]), { dealer: 'S', calls: [] });
  assert.deepEqual(cleanDecoder({ dealer: 'Q', calls: 'x' }), { dealer: 'S', calls: [] });
  assert.deepEqual(cleanDecoder({ dealer: 'W', calls: ['1C', 'X', 'zzz'] }), { dealer: 'W', calls: ['1C', 'X'] });
});

test('cleanTab falls back to the first tab', () => {
  const tabs = ['advisor', 'decoder'];
  assert.equal(cleanTab({ tab: 'decoder' }, tabs), 'decoder');
  assert.equal(cleanTab({ tab: 'nope' }, tabs), 'advisor');
  assert.equal(cleanTab(null, tabs), 'advisor');
  assert.equal(cleanTab([], tabs), 'advisor');
  assert.equal(cleanTab('decoder', tabs), 'decoder');
});

test('acceptedCalls keeps legal calls and drops the rest', () => {
  const base = { opener: 'me', seat: 1 };
  assert.deepEqual(acceptedCalls({ ...base, ourCalls: [] }), []);
  assert.deepEqual(acceptedCalls({ ...base, ourCalls: ['1S'] }), ['1S']);
  assert.deepEqual(acceptedCalls({ ...base, ourCalls: ['1S', '1H'] }), ['1S']);
  assert.deepEqual(acceptedCalls({ ...base, ourCalls: ['1S', '2H', 'P'] }), ['1S', '2H', 'P']);
});

test('acceptedCalls drops calls after the auction ends', () => {
  assert.deepEqual(acceptedCalls({ opener: 'me', seat: 1, ourCalls: ['1S', 'P', '1S'] }), ['1S', 'P']);
});

test('acceptedCalls handles a passed opener and later calls', () => {
  assert.deepEqual(acceptedCalls({ opener: 'me', seat: 1, ourCalls: ['P', '1H'] }), ['P']);
  assert.deepEqual(acceptedCalls({ opener: 'partner', seat: 3, ourCalls: ['1H', '2H'] }), ['1H', '2H']);
});
