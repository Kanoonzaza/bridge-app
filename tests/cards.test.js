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
