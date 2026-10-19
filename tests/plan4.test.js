import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, randomHand } from '../js/cards.js';
import { advise, explain, matchingEntries } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';
import { SITUATIONS as NT } from '../js/system/opening/notrump.js';
import { SITUATIONS as TWOS } from '../js/system/opening/twos.js';
import { agreedSuit } from '../js/system/rebids/slam.js';
import { mulberry32 } from './helpers.js';

// Odd number of our calls: partner opened and it is our (responder's) turn; even: we opened.
const auctionFor = (calls) => buildAuction({ opener: calls.length % 2 ? 'partner' : 'me', seat: 1, ourCalls: calls });
const ask = (calls, hand) => advise(parseHand(hand), auctionFor(calls));

const CASES = [
  [['1N'], 'J863 Q752 97632 -', '2C', 'garbage Stayman'],
  [['1N'], 'KJ63 QT74 K52 Q4', '2C', 'Stayman with game values'],
  [['1N', '2C', '2D'], 'KJ63 QT74 K52 Q4', '3N', 'no fit: 3NT'],
  [['1N', '2C', '2H'], 'KJ63 QT74 K52 Q4', '4H', 'heart fit'],
  [['1N', '2C', '2S'], 'KJ63 QT74 K52 Q4', '4S', 'spade fit'],
  [['1N'], 'KQT63 84 J72 853', '2H', 'weak transfer'],
  [['1N', '2H', '2S'], 'KQT63 84 J72 853', 'P', 'pass the completion'],
  [['1N'], '4 J82 Q987632 73', '2S', 'minor puppet'],
  [['1N', '2S', '3C'], '4 J82 Q987632 73', '3D', 'diamonds: to play'],
  [['1N'], '84 73 AQJ953 842', '3D', 'good 6-card minor invites'],
  [['1N'], 'KQJ8743 5 K62 84', '4H', 'Texas'],
  [['1N'], 'KQT63 A984 85 Q4', '2C', 'Stayman with 5-4'],
  [['1N', '2C', '2D'], 'KQT63 A984 85 Q4', '3H', 'Smolen'],
  [['1N', '2H', '2S'], 'KQT63 A84 J5 Q42', '3N', '5 spades, game: choice of games'],
  [['1N'], 'K73 Q82 A94 QT63', '3N', '11 balanced'],
  [['1N'], 'K73 Q82 A94 9863', '2N', '9: invite'],
  [['1N', '2C'], 'AQ73 KJ82 A94 Q3', '2H', 'both majors: hearts first'],
  [['1N', '2H'], 'AQ73 KJ82 A94 K3', '3S', 'super-accept with 4 and 17'],
  [['2N'], 'KJ63 QT74 852 94', '3C', 'Stayman over 2NT'],
  [['2N'], 'K73 Q82 9432 T63', '3N', '5 HCP opposite 20–21'],
  [['2S'], 'A4 AK63 A975 Q82', '2N', 'Ogust with 19'],
  [['2S', '2N'], 'KQJ953 74 K82 63', '3S', 'maximum, good suit'],
  [['2S', '2N', '3S'], 'A4 AK63 A975 Q82', '4S', 'partner maximum'],
  [['2S', '2N', '3C'], 'A4 AK63 A975 Q82', '3S', 'minimum, bad suit: stop in 3♠'],
  [['2H'], 'K74 Q83 J9652 84', '3H', 'preemptive raise'],
  [['2H'], 'K74 83 QJ652 J84', 'P', 'no fit'],
  [['2C', '2D'], 'AKQT73 AK4 A5 K2', '2S', 'natural, game forcing'],
  [['2C'], 'KQJ74 83 A92 852', '2S', 'positive'],
  [['2C'], 'K874 83 Q92 8652', '2D', 'waiting'],
  [['2C', '2D', '2S'], '874 83 J92 86532', '3C', 'second negative'],
  [['2C', '2D', '3D'], 'T872 86 QJ9432 5', '3H', 'second negative over 3♦'],
  [['3N'], 'A84 K73 K962 J52', 'P', 'majors and a minor stopped'],
  [['3N'], '984 K73 Q962 J52', '4C', 'spades unstopped: run'],
  [['3H'], 'AK4 K73 AQ62 J52', '4H', 'game opposite a preempt'],
];

for (const [calls, hand, want, why] of CASES) {
  test(`${calls.join('–')}: ${hand} → ${want} (${why})`, () => {
    assert.equal(ask(calls, hand).call, want);
  });
}

test('agreed suit decides whether 4NT is RKCB', () => {
  assert.equal(agreedSuit(['1H', '2N']), 'H');
  assert.equal(agreedSuit(['1S', '2C', '2D', '3S']), 'S');
  assert.equal(agreedSuit(['1N', '4H', '4S']), 'S');
  assert.equal(agreedSuit(['1N']), null);
  assert.equal(agreedSuit(['1N', '2H', '2S']), null);
  const m = (calls) => explain({ dealer: 'N', calls }).at(-1).meaning;
  assert.match(m(['1H', 'P', '2N', 'P', '3C', 'P', '4N']), /RKCB/);
  assert.match(m(['1N', 'P', '2H', 'P', '2S', 'P', '4N']), /Quantitative/);
  assert.match(m(['1N', 'P', '4N']), /Quantitative/);
});

test('RKCB replies and the asker\'s decision', () => {
  // 1♥–2NT–3♣–4NT: the Jacoby responder holds the ♥A, ♦A and ♥Q.
  const reply = ask(['1H', '2N', '3C', '4N'], 'K74 AQ5 AQ83 J62');
  assert.equal(reply.call, '5S');
  assert.equal(ask(['1H', '2N', '3C', '4N', '5S'], 'A5 KJ974 KQ6 A84').call, '6H');
  assert.equal(ask(['1H', '2N', '3C', '4N', '5D'], 'Q5 KJ974 KQ6 A84').call, '5H');
});

test('Gerber: replies and the asker\'s sign-off', () => {
  assert.equal(ask(['1N', '4C'], 'AK4 KQ73 A62 Q52').call, '4S');
  assert.equal(ask(['1N', '4C', '4S'], 'KQ5 A84 KQJ74 A3').call, '6N');
  assert.equal(ask(['1N', '4C', '4H'], 'KQ5 KJ84 KQJ74 A').call, '4N');
});

test('Gerber: also over a notrump rebid, with the king ask', () => {
  // 1♦–1♠–2NT–4♣: partner's 4♣ is Gerber, not a raise of diamonds (and the 4♠/4NT answers are not RKCB).
  assert.match(explain(auctionFor(['1D', '1S', '2N', '4C'])).find((r) => r.call === '4C').meaning, /Gerber/);
  assert.equal(ask(['1D', '1S', '2N', '4C'], 'AK4 KQ73 A62 Q52').call, '4S');
  assert.equal(ask(['1C', '1H', '1N', '4C'], 'K42 A73 Q62 KQ52').call, '4H');
  assert.equal(ask(['1D', '1S', '2N', '4C', '4H'], 'AK4 KQ73 A62 Q52').call, '6N');
  assert.equal(ask(['1C', '1H', '1N', '4C', '4S', '4N'], 'AK4 KQ73 A62 Q52').call, 'P');
  // Not Gerber when a suit is agreed: 1♥–2♥ then 2NT, and 4♣ is a cue-bid.
  assert.equal(agreedSuit(['1H', '2H', '2N', '4C']), 'H');
  // All four aces and a hand that could make 7NT: 5♣ asks for kings; the answer counts kings, the asker chooses.
  assert.equal(ask(['1N', '4C', '4S'], 'AQJ AKQ KQ4 J32').call, '5C');
  assert.equal(ask(['2N', '4C', '4S'], 'KQ5 A84 KQJ74 A3').call, '5C');
  assert.equal(ask(['1N', '4C', '4S', '5C'], 'KQ5 A84 KQJ74 A3').call, '5S');
  assert.equal(ask(['1N', '4C', '4S', '5C'], 'Q52 A84 QJ74 A32').call, '5D');
  assert.equal(ask(['1N', '4C', '4S', '5C', '5S'], 'AQJ AKQ KQ4 J32').call, '7N');
  assert.equal(ask(['1N', '4C', '4S', '5C', '5H'], 'AQJ AKQ KQ4 J32').call, '6N');
});

test('Plan 4 sweep: every situation answers every hand with a decodable call', () => {
  const rng = mulberry32(47);
  for (const sit of [...NT, ...TWOS]) {
    const auction = auctionFor(sit.after);
    assert.equal(auction.calls.filter((c) => c !== 'P').join(' '), sit.after.join(' '), `auction for ${sit.after}`);
    for (let i = 0; i < 300; i++) {
      const hand = randomHand(rng);
      const r = advise(hand, auction);
      assert.ok(!r.notCovered, `${sit.after}: not covered for ${JSON.stringify(hand)}`);
      assert.ok(r.call in sit.calls, `${sit.after}: ${r.call} missing from the call table`);
      assert.equal(matchingEntries(hand, auction).length, 1, `${sit.after}: several entries matched`);
    }
  }
});
