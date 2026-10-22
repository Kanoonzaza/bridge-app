import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, randomHand } from '../js/cards.js';
import { advise, explain, matchingEntries } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';
import { SITUATIONS } from '../js/system/rebids/responder.js';
import { mulberry32 } from './helpers.js';

const auctionFor = (calls, seat = 1) => buildAuction({ opener: 'partner', seat, ourCalls: calls });
const ask = (calls, hand) => advise(parseHand(hand), auctionFor(calls));

// Responder's second bid, examples from the system notes.
const CASES = [
  [['1D', '1S', '1N'], 'Q8743 K952 4 J73', '2H', 'XYZ: weak 5♠ + 4♥'],
  [['1D', '1S', '1N'], 'AJ743 K952 4 Q73', '2C', 'XYZ: invitational 5♠ + 4♥ via the relay'],
  [['1D', '1S', '1N'], 'AQ74 K6 J5 KJT63', '2D', 'XYZ: game forcing'],
  [['1D', '1S', '1N'], 'K874 Q93 J5 9632', 'P', 'XYZ: weak balanced passes'],
  [['1D', '1S', '1N'], '8743 Q2 5 KJ9632', '2N', 'XYZ: puppet to clubs'],
  [['1C', '1H', '1S'], 'K874 QJ93 J5 963', '2S', 'XYZ: weak raise'],
  [['1C', '1H', '1S'], 'K874 AJ93 Q5 963', '2C', 'XYZ: invitational raise via the relay'],
  [['1D', '1S', '2C'], 'AQ753 843 K5 A62', '2H', 'fourth suit forcing: no heart stopper'],
  [['1D', '1S', '2C'], 'AQ753 K43 85 A62', '3N', 'hearts stopped: 3NT'],
  [['1D', '1S', '2C'], 'Q8753 843 K5 962', 'P', 'weak: 3 clubs against 2 diamonds, pass'],
  [['1D', '1S', '2C'], 'Q8753 84 K52 962', '2D', 'weak preference to diamonds'],
  [['1D', '1S', '2H'], 'Q8753 84 K52 962', '2N', 'after a reverse: weak relay'],
  [['1D', '1S', '2H'], 'AQ753 84 K52 962', '3D', 'after a reverse: game-forcing preference'],
  [['1D', '1S', '2H'], 'AQ75 K843 52 962', '3H', 'after a reverse: 4 hearts'],
  [['1S', '1N', '2C'], 'K74 A83 Q962 J52', '3S', '3-card limit raise'],
  [['1S', '1N', '2C'], '4 KQ9853 862 Q74', '2H', 'weak long hearts'],
  [['1S', '1N', '2D'], 'Q4 KJ5 J73 KJ62', '2N', 'invitational'],
  [['1S', '1N', '2N'], '84 K53 QJ74 Q862', '3N', 'opposite 18–19 with 8'],
  [['1H', '1N', '2C'], 'KJ4 52 QJ74 9862', 'P', 'fit for clubs, minimum'],
];

for (const [calls, hand, want, why] of CASES) {
  test(`${calls.join('–')}, responder ${hand} → ${want} (${why})`, () => {
    assert.equal(ask(calls, hand).call, want);
  });
}

test('decoder meanings for responder second bids', () => {
  const m = (calls) => explain({ dealer: 'N', calls }).at(-1).meaning;
  assert.match(m(['1D', 'P', '1S', 'P', '1N', 'P', '2C']), /XYZ relay/);
  assert.match(m(['1D', 'P', '1S', 'P', '1N', 'P', '2D']), /artificial, game forcing/);
  assert.match(m(['1D', 'P', '1S', 'P', '2C', 'P', '2H']), /Fourth suit forcing/);
  assert.match(m(['1D', 'P', '1S', 'P', '2H', 'P', '2N']), /Weak/);
  assert.match(m(['1S', 'P', '1N', 'P', '2C', 'P', '3S']), /3-card limit raise/);
});

test('responder second-bid sweep', () => {
  const rng = mulberry32(31);
  for (const sit of SITUATIONS) {
    const auction = auctionFor(sit.after);
    assert.equal(auction.calls.filter((c) => c !== 'P').join(' '), sit.after.join(' '));
    for (let i = 0; i < 400; i++) {
      const hand = randomHand(rng);
      const r = advise(hand, auction);
      assert.ok(!r.notCovered, `${sit.after}: not covered for ${JSON.stringify(hand)}`);
      assert.ok(r.call in sit.calls, `${sit.after}: ${r.call} missing from the call table`);
      assert.equal(matchingEntries(hand, auction).length, 1, `${sit.after}: several entries matched`);
    }
  }
});

test('board 56: 19+ balanced with no fit bids 6NT after 1D-1H-1S, 13-18 bids 3NT', () => {
  const full = (calls, hand) => advise(parseHand(hand), { dealer: 'W', vul: 'none', calls }).call;
  assert.equal(full(['P', '1D', 'P', '1H', 'P', '1S', 'P'], 'A5 A9842 A93 AK3'), '6N', '19 HCP');
  assert.equal(full(['P', '1D', 'P', '1H', 'P', '1S', 'P'], 'A5 KJ842 A93 KQ3'), '3N', '17 HCP: game');
});

test('XYZ: responder places the contract after opener answers the game-forcing 2♦', () => {
  // Board 19: 18 HCP opposite 1♦–1♠ and a 2NT answer: 3NT, not 5♦.
  assert.equal(ask(['1D', '1H', '1S', '2D', '2N'], 'QJ AKQT2 AQ75 T5').call, '3N');
  assert.equal(ask(['1D', '1H', '1S', '2D', '2N'], 'QJ AKQT2 AQ75 K5').call, '6N', '19 HCP: slam');
  assert.equal(ask(['1D', '1H', '1S', '2D', '2H'], 'Q2 AKJ72 Q75 K54').call, '4H', '5 hearts opposite 3-card support');
  assert.equal(ask(['1D', '1H', '1S', '2D', '3D'], 'Q2 AKJ72 Q75 K54').call, '3N');
});
