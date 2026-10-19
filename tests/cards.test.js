import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, formatHand, cardCount, toggleCard, randomHand, emptyHand } from '../js/cards.js';
import { mulberry32 } from './helpers.js';

test('parses plain and symbol forms, with 10 and voids', () => {
  assert.deepEqual(parseHand('KJ852 83 Q4 J953'), { S: 'KJ852', H: '83', D: 'Q4', C: 'J953' });
  assert.deepEqual(parseHand('♠AK ♥KJ862 ♦Q74 ♣K93'), { S: 'AK', H: 'KJ862', D: 'Q74', C: 'K93' });
  assert.equal(parseHand('♠KQ1083 ♥AJ974 ♦5 ♣84').S, 'KQT83');
  assert.equal(parseHand('♠J863 ♥Q752 ♦97632 ♣—').C, '');
  assert.equal(parseHand('J863 Q752 97632 -').C, '');
});

test('sorts ranks high to low', () => {
  assert.equal(parseHand('25KJ8 38 4Q 395J').S, 'KJ852');
});

test('rejects bad input', () => {
  assert.throws(() => parseHand('KJ852 83 Q4'), /four suit groups/);
  assert.throws(() => parseHand('KJ85Z 83 Q4 J953'), /Unknown card/);
  assert.throws(() => parseHand('KK852 83 Q4 J953'), /Duplicate/);
});

test('formats with symbols, 10 and a dash for voids', () => {
  assert.equal(formatHand(parseHand('KQ1083 AJ974 5 84')), '♠KQ1083 ♥AJ974 ♦5 ♣84');
  assert.equal(formatHand(parseHand('J863 Q752 97632 -')), '♠J863 ♥Q752 ♦97632 ♣—');
});

test('counts and toggles cards', () => {
  let h = emptyHand();
  assert.equal(cardCount(h), 0);
  h = toggleCard(h, 'S', '5');
  h = toggleCard(h, 'S', 'A');
  assert.equal(h.S, 'A5');
  h = toggleCard(h, 'S', 'A');
  assert.equal(h.S, '5');
  assert.equal(cardCount(h), 1);
});

test('random hands have 13 distinct cards', () => {
  const rng = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const h = randomHand(rng);
    assert.equal(cardCount(h), 13);
    const all = ['S', 'H', 'D', 'C'].flatMap((s) => [...h[s]].map((r) => s + r));
    assert.equal(new Set(all).size, 13);
  }
});

test('symbol form assigns groups by symbol, in any order', () => {
  assert.deepEqual(parseHand('♥KJ862 ♠AK ♦Q74 ♣K93'), { S: 'AK', H: 'KJ862', D: 'Q74', C: 'K93' });
});

test('symbol form needs each symbol exactly once and nothing before the first', () => {
  assert.throws(() => parseHand('♠AK ♥KJ862 ♦Q74'), /four suit groups/);
  assert.throws(() => parseHand('♠AK ♠KJ862 ♦Q74 ♣K93'), /four suit groups/);
  assert.throws(() => parseHand('AK ♠AK ♥KJ862 ♦Q74 ♣K93'), /four suit groups/);
});

test('empty group in symbol form is a void; dash still works', () => {
  assert.equal(parseHand('♠AK ♥ ♦Q74 ♣K93').H, '');
  assert.equal(parseHand('♠AK ♥— ♦Q74 ♣K93').H, '');
});

test('emoji variation selector is ignored', () => {
  assert.equal(parseHand('♠AK ♥️KJ862 ♦Q74 ♣K93').H, 'KJ862');
});

test('a dash is a void only as the whole group', () => {
  assert.throws(() => parseHand('A-K 83 Q4 J953'), /Unknown card/);
  assert.equal(parseHand('J863 Q752 97632 –').C, '');
});

test('toggleCard validates suit and rank', () => {
  assert.throws(() => toggleCard(emptyHand(), 'X', 'A'), Error);
  assert.throws(() => toggleCard(emptyHand(), 'S', '1'), Error);
});

test('suits left to right: trump first, colours alternating', async () => {
  const { suitOrder } = await import('../js/cards.js');
  assert.deepEqual(suitOrder(null), ['S', 'H', 'C', 'D']);
  assert.deepEqual(suitOrder('S'), ['S', 'H', 'C', 'D']);
  assert.deepEqual(suitOrder('H'), ['H', 'S', 'D', 'C']);
  assert.deepEqual(suitOrder('D'), ['D', 'S', 'H', 'C']);
  assert.deepEqual(suitOrder('C'), ['C', 'H', 'S', 'D']);
});
