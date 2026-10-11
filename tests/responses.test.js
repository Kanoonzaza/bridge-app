import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, randomHand } from '../js/cards.js';
import { advise, explain, matchingEntries } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';
import { mulberry32 } from './helpers.js';

const auctionFor = (open, seat) => buildAuction({ opener: 'partner', seat, ourCalls: [open] });
const ask = (open, hand, seat = 1) => advise(parseHand(hand), auctionFor(open, seat));

const CASES = [
  // Partner opens 1♥ / 1♠, responder has not passed
  ['1S', 'KT74 A5 KQ83 J62', 1, '2N', 'Jacoby: 4 trumps, 14 dummy points'],
  ['1H', '84 K93 QJ74 9862', 1, '2H', '7 dummy points'],
  ['1H', 'K5 QT83 A764 852', 1, '3H', '4-card limit raise, 10 dummy points'],
  ['1H', 'K874 Q73 J62 Q54', 1, '2H', 'weak with support: raise before showing spades'],
  ['1H', 'KQ5 QT74 A9863 4', 1, '4C', 'splinter'],
  ['1H', '5 KJ74 AQ83 K762', 1, '3S', 'splinter in spades over 1♥'],
  ['1S', 'QT873 4 K8642 72', 1, '4S', 'weak, 5 trumps, singleton'],
  ['1S', 'Q4 A5 KQJT63 974', 1, '2D', 'good 12: strong 6-card suit'],
  ['1S', 'Q4 QJ5 QJ73 KJ62', 1, '1N', 'bad 12: flat queens and jacks'],
  ['1S', 'K73 A84 A962 T74', 1, '1N', '11 HCP and 3 spades: 1NT then 3♠'],
  ['1S', 'K73 A84 A962 J74', 1, '2D', 'good 12 with a fit'],
  ['1S', '4 KQ97 A8 KJ8642', 1, '2C', 'long clubs first'],
  ['1S', 'Q4 AQ83 KT5 Q942', 1, '2C', '2♥ needs five'],
  ['1S', 'K6 Q842 AJ5 KT7', 1, '2C', '2♣ with three clubs'],
  ['1S', '4 AKJ83 Q72 K952', 1, '2H', '5 hearts, 13 HCP'],
  ['1S', '4 KQ9853 862 Q74', 1, '1N', 'weak with long hearts: 1NT first'],
  ['1S', 'K74 A83 Q962 J52', 1, '1N', '3-card limit raise starts with 1NT'],
  ['1H', 'QJT963 4 732 852', 1, '2S', 'weak jump shift'],
  ['1S', '4 72 QJT9763 852', 1, '3D', 'weak jump shift in diamonds'],
  ['1S', 'J83 Q74 8652 963', 1, 'P', '3 HCP'],
  ['1H', 'AQ74 5 KJ83 Q962', 1, '1S', '4 spades at any strength'],
  // Responder passed (partner opened in 3rd or 4th seat)
  ['1S', 'KJ5 Q842 A73 965', 3, '2C', 'Drury'],
  ['1S', 'KT74 A5 KQ83 J62', 3, '2C', 'no Jacoby for a passed hand'],
  ['1H', '84 K7 AQJ84 9532', 3, '2D', 'passed hand: natural and non-forcing'],
  ['1S', 'Q4 Q95 QJ73 KJ62', 4, '1N', 'passed hand 1NT'],
  // Partner opens 1♣ / 1♦
  ['1C', 'KJ74 83 Q9752 K6', 1, '1S', 'Walsh'],
  ['1C', 'K73 Q82 A94 QT63', 1, '2N', '11 balanced'],
  ['1C', 'KJ74 Q983 A5 862', 1, '1H', '4-4 majors: up the line'],
  ['1C', 'Q8742 AJ963 5 K3', 1, '1S', '5-5 majors: spades'],
  ['1C', 'AK74 5 AQJ852 K3', 1, '1D', 'game values: longer diamonds first'],
  ['1C', '73 Q82 4 KJ86432', 1, '3C', 'weak raise'],
  ['1C', 'K73 Q82 AJ94 K63', 1, '3N', '13 balanced'],
  ['1C', 'K73 Q82 J94 9863', 1, '1N', '6 balanced'],
  ['1D', 'K4 A73 KJT52 Q62', 1, '2D', 'inverted raise'],
  ['1D', '4 A73 KQJ84 K852', 1, '3S', 'minor splinter'],
  ['1D', '83 K72 Q4 AKJ853', 1, '2C', '2/1 in clubs'],
  ['1D', 'QJT963 74 852 63', 1, '2S', 'weak jump shift'],
  ['1D', 'KJ74 83 Q4 AKJ53', 1, '2C', 'game values: longer clubs first'],
  ['1D', 'J83 Q74 8652 963', 1, 'P', '3 HCP'],
  ['1D', '83 K72 Q4 AKJ853', 3, '2C', 'passed hand: natural 2♣'],
];

for (const [open, hand, seat, want, why] of CASES) {
  test(`partner ${open} (seat ${seat}), ${hand} → ${want} (${why})`, () => {
    assert.equal(ask(open, hand, seat).call, want);
  });
}

test('the advisor explains Jacoby, Drury and the 1NT plan', () => {
  const j = ask('1S', 'KT74 A5 KQ83 J62');
  assert.match(j.meaning, /Jacoby/);
  assert.equal(j.notes, 'raising-partners-major-tier-0');
  const d = ask('1S', 'KJ5 Q842 A73 965', 3);
  assert.match(d.meaning, /Drury/);
  assert.equal(d.notes, 'drury-tier-1');
  assert.match(ask('1S', 'K74 A83 Q962 J52').plan, /jump to 3♠/);
  assert.match(ask('1S', 'Q4 QJ5 QJ73 KJ62').close, /Exactly 12/);
  assert.match(ask('1S', '4 KQ9853 862 Q74').plan, /hearts/);
});

test('Walsh reason is given', () => {
  assert.match(ask('1C', 'KJ74 83 Q9752 K6').reasons.join(' '), /Walsh/);
});

test('decoder meanings for first responses', () => {
  const meaning = (dealer, calls) => explain({ dealer, calls }).at(-1).meaning;
  assert.match(meaning('N', ['1D', 'P', '2D']), /Inverted raise/);
  assert.match(meaning('N', ['1S', 'P', '2N']), /Jacoby/);
  assert.match(meaning('S', ['P', 'P', '1S', 'P', '2C']), /Drury/);
  assert.match(meaning('N', ['1S', 'P', '2C']), /2\/1 game force/);
  assert.match(meaning('N', ['1H', 'P', '1N']), /Forcing 1NT/);
  assert.match(meaning('S', ['P', 'P', '1H', 'P', '1N']), /Not forcing/);
  assert.match(meaning('N', ['1C', 'P', '2H']), /Weak jump shift/);
  assert.match(meaning('N', ['1H', 'P', '3S']), /Splinter/);
  assert.match(meaning('N', ['1S', 'P', '4H']), /Natural/);
});

test('response sweep: one answer per priority, never "not covered", always decodable', () => {
  const rng = mulberry32(11);
  for (const open of ['1C', '1D', '1H', '1S']) {
    for (const seat of [1, 2, 3, 4]) {
      const auction = auctionFor(open, seat);
      for (let i = 0; i < 1500; i++) {
        const hand = randomHand(rng);
        const byPriority = new Map();
        for (const m of matchingEntries(hand, auction)) byPriority.set(m.priority, [...(byPriority.get(m.priority) ?? []), m.call]);
        for (const [p, calls] of byPriority) assert.ok(calls.length === 1, `${open} seat ${seat}: priority ${p} matched ${calls} for ${JSON.stringify(hand)}`);
        const r = advise(hand, auction);
        assert.ok(!r.notCovered, `${open} seat ${seat}: not covered for ${JSON.stringify(hand)}`);
        const row = explain({ ...auction, calls: [...auction.calls, r.call] }).at(-1);
        assert.ok(r.call === 'P' || row.entry, `${open} seat ${seat}: ${r.call} has no decoder entry`);
      }
    }
  }
});
