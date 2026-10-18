import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, randomHand } from '../js/cards.js';
import { advise, matchingEntries } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';
import { SITUATIONS } from '../js/system/rebids/third-round.js';
import { mulberry32 } from './helpers.js';

// seat 3: the opening comes after a pass by responder (a passed hand), as Drury needs.
const auctionFor = (calls, ctx) => buildAuction({ opener: calls.length % 2 ? 'partner' : 'me', seat: ctx?.responderPassed ? 3 : 1, ourCalls: calls });
const ask = (calls, hand) => advise(parseHand(hand), auctionFor(calls));
const askFull = (dealer, calls, hand) => advise(parseHand(hand), { dealer, calls });

const CASES = [
  [['1D', '1S', '2S'], 'KQ74 A83 Q94 J62', '3S', 'invite opposite a minimum raise'],
  [['1D', '1S', '2S'], 'KQ74 A83 K94 J62', '4S', 'game opposite a minimum raise'],
  [['1D', '1H', '2D'], 'K4 AJ83 Q94 J862', '3D', 'invite with diamond support'],
  [['1D', '1H', '2D'], 'K4 J983 54 Q8762', 'P', 'minimum: pass'],
  [['1C', '1S', '2N'], 'KJ874 83 Q94 862', '3S', '5 spades: let opener choose'],
  [['1S', '2S', '3D'], 'K74 983 Q4 K8762', '4S', 'help-suit try: diamond help'],
  [['1S', '2S', '3D'], 'K74 Q83 974 J862', '3S', 'help-suit try: no help'],
  [['1H', '2N', '3C'], 'K74 AJ83 KQ94 62', '4H', 'Jacoby: minimum sign-off'],
  [['1S', '2C', '2S'], 'Q74 A83 K4 KJ862', '4S', '2/1: fast arrival with 3 spades'],
  [['1N', '2H', '2S', '3N'], 'AK4 KQ8 Q942 J62', '4S', 'opener picks the 5-3 spade fit'],
  [['1N', '2C', '2D', '3H'], 'AK4 KQ8 Q942 J62', '4S', 'Smolen: 3 spades'],
  [['1D', '1S', '1N', '2C'], 'A4 KQ8 Q9842 J62', '2D', 'XYZ relay is forced'],
  [['1D', '1S', '1N', '2C', '2D'], 'AJ743 K952 4 Q73', '2H', 'XYZ: the planned invitation'],
];
for (const [calls, hand, want, why] of CASES) {
  test(`${calls.join('–')}: ${hand} → ${want} (${why})`, () => assert.equal(ask(calls, hand).call, want));
}

test('fallbacks: game placed, partner silent, quiet opponents, defending', () => {
  assert.equal(ask(['1D', '1H', '2N', '3N'], 'K4 AQ8 KQ94 AJ62').call, 'P');
  assert.equal(askFull('S', ['1S', 'P', 'P', 'X'], 'KQJ974 A83 Q4 62').call, '2S');
  assert.equal(askFull('S', ['1S', 'P', 'P', 'X'], 'KQ974 A83 Q4 652').call, 'P');
  const quiet = askFull('N', ['1C', '1D', '1H', 'P', '1S', 'P'], 'K4 AQ83 Q94 J862');
  assert.equal(quiet.fallback, 'quiet');
  assert.equal(askFull('W', ['1D', 'P', '1S'], '874 Q83 J94 Q862').call, 'P');
});

test('negative double: accept the jump with 9+', () => {
  assert.equal(askFull('E', ['P', '1S', '2D', 'X', 'P', '3H', 'P'], '5 K853 K62 A8753').call, '4H');
});

test('round 3 sweep', () => {
  const rng = mulberry32(61);
  for (const sit of SITUATIONS) {
    const auction = auctionFor(sit.after, sit.ctx);
    assert.equal(auction.calls.filter((c) => c !== 'P').join(' '), sit.after.join(' '), `auction for ${sit.after}`);
    for (let i = 0; i < 60; i++) {
      const hand = randomHand(rng);
      const r = advise(hand, auction);
      assert.ok(r.call in sit.calls, `${sit.after}: ${r.call} for ${JSON.stringify(hand)}`);
      assert.equal(matchingEntries(hand, auction).length, 1, `${sit.after}: matches`);
    }
  }
});

test('board 50: 14+ HCP opposite a jump rebid in a minor bids 6NT, not 3NT', () => {
  const full = (calls, hand) => advise(parseHand(hand), { dealer: 'E', vul: 'NS', calls }).call;
  assert.equal(full(['P', '1C', 'P', '1S', 'P', '3C', 'P'], 'AKQ92 K9 A54 843'), '6N', '16 HCP');
  assert.equal(full(['P', '1C', 'P', '1S', 'P', '3C', 'P'], 'AKJ92 K9 Q54 843'), '3N', '12 HCP: game only');
  assert.equal(full(['P', '1D', 'P', '1H', 'P', '3D', 'P'], 'K4 AKJ92 Q54 K83'), '6N', 'diamonds too');
  assert.equal(full(['P', '1H', 'P', '1S', 'P', '3H', 'P'], 'AKJ92 K9 Q54 A83'), '6H', 'major jump rebid: 14+ with a heart fit bids the slam');
  assert.equal(full(['P', '1H', 'P', '1S', 'P', '3H', 'P'], 'AKJ92 7 Q54 AK83'), '6N', '14+ with a singleton heart: notrump');
  assert.equal(full(['P', '1H', 'P', '1S', 'P', '3H', 'P'], 'KJ92 K97 Q54 A83'), '4H', '12 HCP: just game');
});
