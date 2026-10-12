import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../js/cards.js';
import { advise, explain } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';

const open = (hand, vul) => advise(parseHand(hand), buildAuction({ opener: 'me', seat: 1, ourCalls: [], vul })).call;
const ask = (dealer, calls, hand, vul = 'none') => advise(parseHand(hand), { dealer, calls, vul });
const meaning = (dealer, calls) => explain({ dealer, calls }).at(-1).meaning ?? '';

test('vulnerability: sound weak twos when vulnerable, lighter at favorable', () => {
  assert.equal(open('KQJ953 74 K82 63', 'we'), '2S');
  assert.equal(open('QJ9853 74 K82 63', 'none'), '2S');
  assert.equal(open('QJ9853 74 K82 63', 'we'), 'P');
  assert.match(advise(parseHand('QJ9853 74 K82 63'), buildAuction({ opener: 'me', seat: 1, ourCalls: [], vul: 'we' })).reasons.join(' '), /vulnerable/);
  assert.equal(open('KJ9853 74 832 63', 'none'), 'P');
  assert.equal(open('KJ9853 74 832 63', 'they'), '2S');
});

test('vulnerability: compete one level higher at favorable vulnerability', () => {
  // 1♠ (2♥) 2♠ (3♥): 8 spades only → pass, but at favorable vulnerability → 3♠.
  assert.equal(ask('S', ['1S', '2H', '2S', '3H'], 'KQJ97 A3 K84 532', 'none').call, 'P');
  assert.equal(ask('S', ['1S', '2H', '2S', '3H'], 'KQJ97 A3 K84 532', 'NS' === 'NS' ? 'EW' : 'none').call, '3S');
});

test('lead-directing double of their Stayman', () => {
  assert.equal(ask('W', ['1N', 'P', '2C'], 'J84 732 Q93 AKJ84').call, 'X');
  assert.equal(ask('W', ['1N', 'P', '2C'], 'J84 732 Q93 A9842').call, 'P');
  assert.match(meaning('W', ['1N', 'P', '2C', 'X']), /Lead-directing/);
});

test('defense against their strong 2♣', () => {
  assert.equal(ask('E', ['2C'], 'KQJ9763 4 83 J52').call, '3S');
  assert.equal(ask('E', ['2C'], '4 3 QJ863 KJ9752').call, '2N');
  assert.equal(ask('E', ['2C'], 'J84 732 Q93 AKJ84').call, 'X');
  assert.match(meaning('E', ['2C', '2N']), /Both minors/);
});

test('responsive double after their raise', () => {
  assert.equal(ask('W', ['1D', 'X', '2D'], 'KJ84 Q973 83 K52').call, 'X');
  assert.match(meaning('W', ['1D', 'X', '2D', 'X']), /Responsive/);
  assert.equal(ask('W', ['1C', '1H', '2C'], 'K84 Q97 J832 852').call, '2H');
});

test('maximal double: game try when they bid the suit just below ours', () => {
  assert.equal(ask('S', ['1H', '2D', '2H', '3D'], 'A2 AKJ93 84 KQ52').call, 'X');
  assert.match(meaning('S', ['1H', '2D', '2H', '3D', 'X']), /Maximal double/);
  assert.match(meaning('S', ['1H', '2D', '2H', '3D', '3H']), /Competitive only/);
});

const respond = (open, hand, seat = 1) => advise(parseHand(hand), buildAuction({ opener: 'partner', seat, ourCalls: [open] })).call;
const rebid = (calls, hand) => advise(parseHand(hand), buildAuction({ opener: 'me', seat: 1, ourCalls: calls })).call;

test('1M–3NT: 15–17 balanced with 2 cards in the major; opener chooses', () => {
  assert.equal(respond('1S', 'K4 AQ5 KJ73 QJ62'), '3N');
  assert.equal(rebid(['1S', '3N'], 'AQ853 K4 Q74 J62'), 'P');
  assert.equal(rebid(['1S', '3N'], 'AQ8532 K4 Q7 J62'), '4S');
  assert.match(meaning('N', ['1S', 'P', '3N']), /15–17 balanced with exactly 2/);
});

test('passed hand: jump shift is fit-showing, not weak', () => {
  assert.equal(respond('1H', '84 QT74 AKJ83 52', 3), '3D');
  assert.notEqual(respond('1H', 'QJT963 4 732 852', 3), '2S');
  assert.equal(respond('1H', 'QJT963 4 732 852', 1), '2S');
  assert.match(meaning('S', ['P', 'P', '1H', 'P', '3D']), /Fit-showing jump/);
  assert.match(meaning('N', ['1H', 'P', '3D']), /Weak jump shift/);
});

test('their Michaels or Unusual 2NT: cue-bid of their cheaper suit = limit raise or better', () => {
  assert.equal(ask('N', ['1H', '2H'], 'K4 QT74 A983 852').call, '2S');
  assert.match(meaning('N', ['1H', '2H', '2S']), /limit raise or better in hearts/);
  assert.match(meaning('N', ['1C', '2N', '3D']), /limit raise or better in clubs/);
});

test('Leaping Michaels over their weak two', () => {
  assert.equal(ask('E', ['2S'], '4 AQJ93 5 KQJ862').call, '4C');
  assert.equal(ask('E', ['2D'], 'AKJ93 KQJ86 5 62').call, '4D');
  assert.match(meaning('E', ['2H', '4D']), /Leaping Michaels: 5\+ diamonds and 5\+ spades/);
});

test('doubles of their 4-level preempts', () => {
  assert.equal(ask('E', ['4H'], 'AQ93 5 KJ84 AQ62').call, 'X');
  assert.equal(ask('E', ['4S'], 'A93 K5 AJ84 KQ62').call, 'X');
  assert.match(meaning('E', ['4S', 'X']), /partner usually passes/);
  assert.equal(ask('W', ['4H', 'X', 'P'], 'KJ84 75 Q942 J62').call, '4S');
  assert.equal(ask('W', ['4S', 'X', 'P'], 'J84 975 Q942 J62').call, 'P');
});

test('strong minor hands over our 1NT', () => {
  assert.equal(advise(parseHand('A4 K3 KQ984 AJ62'), buildAuction({ opener: 'partner', seat: 1, ourCalls: ['1N'] })).call, '3S');
  assert.equal(advise(parseHand('A4 K3 82 AKQJ862'), buildAuction({ opener: 'partner', seat: 1, ourCalls: ['1N'] })).call, '2S');
  assert.equal(advise(parseHand('A4 K3 82 AKQJ862'), buildAuction({ opener: 'partner', seat: 1, ourCalls: ['1N', '2S', '3C'] })).call, '4C');
  assert.match(meaning('N', ['1N', 'P', '3S']), /Both minors/);
});

test('Lightner double of their slam', () => {
  assert.equal(ask('W', ['1S', 'P', '6S', 'P', 'P'], '984 - AJ9842 Q632').call, 'X');
  assert.equal(ask('W', ['1S', 'P', '6S', 'P', 'P'], '984 72 AJ98 Q632').call, 'P');
  assert.match(meaning('W', ['1S', 'P', '6S', 'X']), /Lightner/);
});
