import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../js/cards.js';
import { advise, explain } from '../js/engine.js';

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

// Errors fixed after the batch-3 review.
const FIXES = [
  // Partner's direct 1NT overcall: systems on
  ['W', ['1C', '1N', 'P'], 'KJ852 Q4 973 J82', '2H', 'transfer to spades'],
  ['W', ['1C', '1N', 'P'], 'KJ85 Q4 Q73 J82', '2C', 'Stayman'],
  ['W', ['1D', '1N', 'P'], 'Q73 J84 952 10632', 'P', 'weak: pass'],
  ['W', ['1C', '1N', 'P', '2H', 'P'], 'A4 KQ5 AJ74 K1092', '2S', 'complete the transfer'],
  // Advancing a balancing double: bid, do not leave it in
  ['W', ['1C', 'P', 'P', 'X', 'P'], 'Q73 J842 K95 1063', '1H', 'best suit'],
  ['W', ['2H', 'P', 'P', 'X', 'P'], 'Q73 J84 K952 1063', '3D', 'best suit over a weak two'],
  ['W', ['1C', 'P', 'P', 'X', 'P'], 'Q7 J84 95 AQJ1063', 'P', 'long strong clubs: defend'],
  ['W', ['1D', 'P', 'P', 'X', 'P'], 'K73 AQ42 95 Q1063', '2H', '11 HCP: jump'],
];
for (const [dealer, calls, hand, want, why] of FIXES) {
  test(`${calls.join(' ')} (dealer ${dealer}): ${hand} → ${want} (${why})`, () => {
    const r = ask(dealer, calls, hand);
    assert.equal(r.call, want);
    assert.equal(r.fallback, undefined);
  });
}

test('the Decoder reads the 1NT overcall auction with our 1NT meanings', async () => {
  const { explain } = await import('../js/engine.js');
  const rows = explain({ dealer: 'W', calls: ['1C', '1N', 'P', '2D', 'P', '2H'] });
  assert.match(rows[3].meaning, /Transfer/);
  assert.match(rows[5].meaning, /Completes the transfer/);
});

test('advancing at the 3-level needs real values (the 5-count raise to 3♦, both vulnerable)', () => {
  const a = (vul, hand) => advise(parseHand(hand), { dealer: 'W', vul, calls: ['1H', '2D', '2S'] }).call;
  assert.equal(a('both', '93 A10965 J93 1094'), 'P', '5 HCP, 3 trumps, vulnerable: pass');
  assert.equal(a('none', '93 A10965 J93 1094'), 'P', 'still too thin not vulnerable');
  assert.equal(a('none', '93 A1096 KJ93 1094'), '3D', '4 trumps: raise');
  assert.equal(a('none', '93 A1096 QJ9 J1094'), '3D', '3 trumps, 8 HCP: raise');
  assert.equal(a('none', '93 A1096 KJ9 Q1094'), '3H', '3 trumps, 10 HCP: cue-bid raise');
  assert.equal(a('both', '93 A1096 J93 Q1094'), 'P', '3 trumps, 7 HCP vulnerable: pass');
});

// Found by the level-versus-strength audit.
const AUDIT = [
  // Opener's 1-level new suit: responder passes only with a weak hand
  ['N', ['1D', 'P', '1H', 'P', '1S', 'P'], 'J93 K10985 5 AQ98', '1N', '10 HCP: do not pass'],
  ['N', ['1D', 'P', '1H', 'P', '1S', 'P'], 'AQ3 A7543 10962 9', '1N', '10 HCP: do not pass'],
  ['N', ['1C', 'P', '1H', 'P', '1S', 'P'], '742 J8654 KQ96 5', 'P', '6 HCP and 3 spades: pass is fine'],
  // Partner's cue-bid raise is forcing, not a contract
  ['N', ['1S', '3H', '4H', 'P'], 'KQ765 J76 Q4 A54', '4S', 'minimum: back to spades'],
  ['N', ['1D', '3C', '4C', 'P'], 'AKJ4 QJ63 J987 J', '4D', 'minimum: back to diamonds'],
  // A raise to the 3-level needs real values
  ['E', ['1S', '2C', 'P'], 'J3 J8642 K96 753', 'P', '5 HCP, 3 clubs: too thin for 3♣'],
  ['E', ['1S', '2C', 'P'], 'J3 Q8642 K96 Q53', '3C', '8 HCP, 3 clubs: raise'],
];
for (const [dealer, calls, hand, want, why] of AUDIT) {
  test(`${calls.join(' ')} (dealer ${dealer}): ${hand} → ${want} (${why})`, () => {
    assert.equal(ask(dealer, calls, hand).call, want);
  });
}

test('partner\'s takeout double later in the auction is answered, not passed (board 14)', () => {
  const a = (hand) => advise(parseHand(hand), { dealer: 'E', vul: 'none', calls: ['1S', 'P', '1N', 'P', '2D', 'P', 'P', 'X', 'P'] });
  assert.equal(a('1082 J973 Q3 10853').call, '2H', '3 HCP, 4 hearts: bid hearts');
  assert.equal(a('1082 J97 KQJ93 853').call, 'P', 'five good diamonds: pass for penalty');
  assert.equal(a('1082 K973 Q3 AJ53').call, '3H', '10 HCP: jump');
});

test('opener after partner\'s pass and their balancing double (board 15)', () => {
  const a = (hand) => advise(parseHand(hand), { dealer: 'S', vul: 'NS', calls: ['1D', 'P', 'P', 'X'] });
  const r = a('106 A2 AKQJ5 K1042');
  assert.equal(r.call, '2C', '5-4 with 17: show clubs');
  assert.match(r.meaning, /4\+ clubs/);
  assert.equal(r.fallback, undefined);
  assert.equal(a('106 A2 AKQJ53 K42').call, '2D', 'six diamonds: rebid them');
  assert.equal(a('Q106 A2 AKJ5 K42').call, 'P', 'nothing to show: pass');
  const row = explain({ dealer: 'S', vul: 'NS', calls: ['1D', 'P', 'P', 'X', '2D'] }).at(-1);
  assert.match(row.meaning, /6\+ diamonds/);
});

test('a pass over their opening says why no overcall (board 16)', () => {
  const r = advise(parseHand('KQ A94 632 AJ863'), { dealer: 'W', vul: 'EW', calls: ['P', 'P', '1D'] });
  assert.equal(r.call, 'P');
  const why = r.reasons.join(' | ');
  assert.match(why, /5 clubs with A: a 2-level overcall needs a good suit/);
  assert.match(why, /3 diamonds: too many in their suit for a takeout double/);
  assert.ok(r.close, 'flagged as a close call');
});

test('a weak jump overcall at the 3-level needs 7 cards (board 18)', () => {
  const over = (hand, calls = ['1S']) => advise(parseHand(hand), { dealer: 'E', vul: 'NS', calls });
  // The 6-card suit that would have jumped to 3♥ over 1♠: now passes, and says why.
  const six = over('842 KQJ742 J2 103');
  assert.equal(six.call, 'P');
  assert.match(six.reasons.join(' '), /3-level needs 7 cards/);
  // The same suit with 7 cards: weak three-style jump.
  assert.equal(over('42 KQJ7432 J2 103').call, '3H', '7 hearts over 1♠: 3♥');
  // Landing at the 2-level, 6 cards is still enough: (1♣)–2♥.
  assert.equal(over('842 KQJ742 J2 103', ['1C']).call, '2H', '6 hearts over 1♣: weak two-style 2♥');
});
