import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, randomHand } from '../js/cards.js';
import { advise, explain, matchingEntries } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';
import { SITUATIONS } from '../js/system/rebids.js';
import { mulberry32 } from './helpers.js';

const auctionFor = (calls, seat) => buildAuction({ opener: 'me', seat, ourCalls: calls });
const ask = (calls, hand, seat = 1) => advise(parseHand(hand), auctionFor(calls, seat));

const CASES = [
  [['1S', '1N'], 'AQ853 K4 Q74 J62', 1, '2C', 'balanced minimum: cheaper 3-card minor'],
  [['1D', '1S'], '5 AQ74 KJ953 K82', 1, '1N', 'too weak to reverse'],
  [['1D', '1S'], '5 AQ74 AKJ83 K62', 1, '2H', 'a real reverse'],
  [['1S', '2N'], 'AQ853 KQ2 JT74 5', 1, '3C', 'Jacoby: show the singleton'],
  [['1S', '2S'], 'AKJ74 A6 K653 82', 1, '3D', 'help-suit game try'],
  [['1D', '2D'], 'AQ6 KJ4 Q874 953', 1, '2N', 'inverted raise: 12–14 balanced'],
  [['1S', '2C'], 'AQT74 K3 862 J74', 3, '2S', 'Drury: light opening signs off'],
  [['1S', '2C'], 'AQT74 K83 Q5 J62', 1, '2S', '2/1: balanced but no diamond stopper, so 2♠'],
  [['1S', '2D'], 'KQ863 A72 K4 Q93', 1, '2N', '2/1: balanced'],
  [['1S', '2H'], 'AQ853 K84 Q74 J2', 1, '4H', 'fast arrival with a minimum'],
  [['1S', '2H'], 'AKJ74 K84 AQ4 J2', 1, '3H', 'slow raise with extras'],
  [['1C', '1H'], 'KQ74 5 A83 KJ853', 1, '1S', 'show spades at the 1-level'],
  [['1C', '1H'], 'K4 QJ74 A83 KJ85', 1, '2H', '4-card support, minimum'],
  [['1C', '1H'], 'K4 AQJ4 83 KQ853', 1, '3H', '4-card support, 16–18'],
  [['1D', '1S'], 'K4 AQ5 KQ73 AJ62', 1, '2N', '18–19 balanced'],
  [['1D', '1S'], 'K84 Q5 KQ73 QJ6', 1, '1N', '12–14 balanced'],
  [['1D', '1S'], 'Q4 A5 AKJ863 K62', 1, '3D', 'good 6-card suit, 16'],
  [['1D', '1S'], '84 A5 KJ8632 K62', 1, '2D', '6 diamonds, minimum'],
  [['1D', '1S'], '4 AQ AKJ63 KQ862', 1, '3C', 'jump shift: 19+'],
  [['1H', '1S'], '4 AKJ85 K3 QT962', 1, '2C', 'lower new suit'],
  [['1H', '1N'], '4 AKJ963 K72 Q85', 1, '2H', '6 hearts, minimum'],
  [['1H', '1N'], 'AQ74 AKJ85 K3 72', 1, '2S', 'reverse over 1NT'],
  [['1S', '1N'], 'AQ853 K4 Q74 J62', 3, 'P', 'passed hand 1NT: balanced minimum passes'],
  [['1S', '3S'], 'AQ853 K4 Q74 J62', 1, 'P', 'limit raise: decline with 12'],
  [['1S', '3S'], 'AQ853 K4 A74 J62', 1, '4S', 'limit raise: accept with 16'],
  [['1C', '1N'], 'AK4 Q73 Q4 KJ852', 1, 'P', 'balanced 15 opposite 6–10'],
  [['1H', '4C'], 'AQ5 AKJ85 KQ4 72', 1, '4N', 'no wasted club honors, 19 HCP'],
  [['1H', '4C'], 'AQ5 AJ985 K4 KQ2', 1, '4H', 'club honors wasted'],
];

for (const [calls, hand, seat, want, why] of CASES) {
  test(`${calls.join('–')} (seat ${seat}), opener ${hand} → ${want} (${why})`, () => {
    assert.equal(ask(calls, hand, seat).call, want);
  });
}

test('decoder meanings for opener rebids', () => {
  const m = (calls) => explain({ dealer: 'N', calls }).at(-1).meaning;
  assert.match(m(['1D', 'P', '1S', 'P', '2H']), /Reverse: 16\+/);
  assert.match(m(['1C', 'P', '1H', 'P', '3S']), /Splinter/);
  assert.match(m(['1D', 'P', '1S', 'P', '4C']), /Splinter/);
  assert.match(m(['1D', 'P', '1S', 'P', '3C']), /Jump shift/);
  assert.match(m(['1S', 'P', '2N', 'P', '3C']), /Singleton or void in clubs/);
  assert.match(m(['1S', 'P', '2S', 'P', '3D']), /Help-suit game try/);
  assert.match(m(['1H', 'P', '2C', 'P', '2S']), /shape, not extra strength/);
});

test('rebid sweep: every situation answers every hand with a decodable call', () => {
  const rng = mulberry32(23);
  for (const sit of SITUATIONS) {
    const seat = sit.ctx?.responderPassed ? 3 : 1;
    const auction = auctionFor(sit.after, seat);
    assert.equal(auction.calls.filter((c) => c !== 'P').join(' '), sit.after.join(' '), `auction for ${sit.after}`);
    for (let i = 0; i < 400; i++) {
      const hand = randomHand(rng);
      const r = advise(hand, auction);
      assert.ok(!r.notCovered, `${sit.after} seat ${seat}: not covered for ${JSON.stringify(hand)}`);
      assert.ok(r.call in sit.calls, `${sit.after}: ${r.call} missing from the call table`);
      assert.equal(matchingEntries(hand, auction).length, 1, `${sit.after}: several entries matched`);
    }
  }
});
