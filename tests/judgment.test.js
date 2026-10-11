import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../js/cards.js';
import { advise } from '../js/engine.js';

const ask = (dealer, calls, hand) => advise(parseHand(hand), { dealer, calls });

test('Law of Total Tricks: compete to the 3-level with 9 trumps, not with 8', () => {
  assert.equal(ask('S', ['1S', '2H', '2S', '3H'], 'KQJ974 A3 K84 52').call, '3S');
  assert.equal(ask('S', ['1S', '2H', '2S', '3H'], 'KQJ97 A3 K84 532').call, 'P');
});

test('game with combined values after interference', () => {
  assert.equal(ask('S', ['1S', '2H', '2S', '3H'], 'AKJ97 A3 KQ4 Q32').call, '4S');
});

test('they redoubled partner\'s takeout double: run', () => {
  assert.equal(ask('N', ['1C', 'X', 'XX'], '972 9853 432 965').call, '1H');
});

test('opener\'s cue-bid after a negative double is answered', () => {
  assert.equal(ask('N', ['P', '1D', '1S', 'X', 'P', '2S', 'P'], '975 KJ32 8 Q9874').call, '3H');
});

test('a forcing new suit in competition is not passed', () => {
  const r = ask('W', ['P', '1C', '1S', '2D', 'P'], 'K86 AK9 AJ6 K962');
  assert.notEqual(r.call, 'P');
});

test('strong 2♣: opener sets trumps after a positive', () => {
  assert.equal(ask('S', ['2C', 'P', '2H', 'P'], 'AK4 KQ8 AKQ4 A52').call, '3H');
  assert.equal(ask('S', ['2C', 'P', '2S', 'P'], 'AK AQ8 AKQ4 KQ52').call, '2N');
});

test('the 2♣ responder looks for slam after opener sets trumps', () => {
  const r = ask('S', ['2C', 'P', '2H', 'P', '3H', 'P'], '84 AKJ93 K72 853');
  assert.equal(r.call, '4N');
});
