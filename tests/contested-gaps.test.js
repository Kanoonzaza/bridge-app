import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../js/cards.js';
import { advise } from '../js/engine.js';

const ask = (dealer, calls, hand) => advise(parseHand(hand), { dealer, calls });

// [dealer, calls, hand, expected call, why]
const CASES = [
  // Opener after 1M–1NT and their overcall
  ['S', ['1S', 'P', '1N', '2D'], 'AKQ85 J7 Q84 Q105', 'P', 'minimum balanced: their bid ends the forcing 1NT'],
  ['S', ['1S', 'P', '1N', '2D'], 'AKQ85 KJ7 4 KQ105', 'X', '17 with a singleton: takeout double'],
  ['S', ['1S', 'P', '1N', '2D'], 'AKQ853 J7 Q84 Q5', '2S', 'six spades'],
  ['S', ['1S', 'P', '1N', '2D'], 'AKQ853 KJ7 A4 Q5', '3S', 'six spades, 17: invitational jump'],
  ['S', ['1H', 'P', '1N', '2S'], 'K5 AQJ84 K42 AJ2', '2N', '18 balanced with a spade stopper'],
  ['S', ['1H', 'P', '1N', '2S'], 'K5 AQJ84 K42 A92', 'X', '17 with a doubleton spade: double'],
  ['N', ['1S', 'P', '1N', '2D', 'X', 'P'], '4 Q1064 KJ1095 853', 'P', 'diamond length: pass for penalty'],
  ['N', ['1S', 'P', '1N', '2D', 'X', 'P'], '94 K1064 J5 Q8532', '3C', 'answer with the 5-card suit'],
  // Opener's reopening double
  ['S', ['1D', '2C', 'P', 'P'], 'KQ8 A853 AKJ63 Q', 'X', 'singleton club: reopen with a double'],
  ['S', ['1D', '2C', 'P', 'P'], '2 AKQ6 A742 QJ54', 'P', 'four clubs: no reason to reopen'],
  ['S', ['1D', '1S', 'P', 'P'], '4 KQ6 A8764 KQ82', 'X', 'singleton spade'],
  ['N', ['1D', '1S', 'P', 'P', 'X', 'P'], 'KQ1094 J52 Q4 763', 'P', 'spade stack: pass for penalty'],
  ['N', ['1D', '1S', 'P', 'P', 'X', 'P'], 'J2 Q1052 K4 J8763', '2C', 'answer the double'],
  // Support doubles after their overcall, and opener's natural bids
  ['S', ['1D', '1H', '1S', '2H'], 'AQ5 Q QJ654 AQ42', 'X', 'exactly 3 spades'],
  ['S', ['1D', '1H', '1S', '2H'], 'K6 4 AJ632 AQ1095', '3C', '5-5: show the second suit'],
  ['S', ['1C', '1D', '1S', '2D'], '1065 AK95 K105 K42', 'X', 'exactly 3 spades'],
  ['S', ['1D', 'P', '1H', '1S'], '84 K73 AQ953 K62', 'X', 'support double still first'],
  ['S', ['1D', 'P', '1H', '1S'], 'AQ4 K3 AJ1052 KQ2', '2N', '19 balanced, spade stopper, no support'],
  // Advancing after their response
  ['N', ['P', '1D', '1H', '1S'], '532 963 Q9654 73', 'P', '2 HCP: no raise'],
  ['N', ['P', '1D', '1H', '1S'], 'K7 8543 AJ92 Q92', '2D', 'cue-bid raise'],
  ['N', ['P', '1C', '1S', 'X'], 'Q95 J973 1065 K94', '2S', 'raise: 3 spades, 6 points'],
  // Opener after a negative double and their raise
  ['E', ['P', 'P', '1D', '1H', 'X', '3H'], 'QJ6 AK6 AQ743 K10', '3N', '19 with a heart stopper'],
  ['S', ['1C', '1D', 'X', '3D'], 'A87 Q842 A2 K1076', '3H', 'the major partner showed'],
  // Judgment
  ['S', ['1H', '1S', '2H', '2S'], 'Q3 AKJ82 KJ95 A7', '3H', 'fit and extra values: compete'],
  ['W', ['1S', 'X', '3S'], '2 K108 AQ654 KQ42', 'X', 'too strong to pass: responsive double'],
  ['N', ['1C', '1S', 'X', '3S'], 'K AK7 AK54 J10862', 'X', '18 and short in spades: double'],
  ['S', ['1D', '1H', 'P', '2D'], 'KQJ82 - AKJ954 53', '2S', 'partner passed: show the second suit'],
];

for (const [dealer, calls, hand, want, why] of CASES) {
  test(`${calls.join(' ')} (dealer ${dealer}): ${hand} → ${want} (${why})`, () => {
    const r = ask(dealer, calls, hand);
    assert.equal(r.call, want);
    assert.ok(r.meaning && r.meaning !== 'Natural (general judgment).');
  });
}

test('the Pass explains why: the forcing 1NT is off after their bid', () => {
  const r = ask('S', ['1S', 'P', '1N', '2D'], 'AKQ85 J7 Q84 Q105');
  assert.match(r.meaning, /ended the forcing 1NT/);
  assert.match(r.reasons.join(' '), /no sixth spade/);
});
