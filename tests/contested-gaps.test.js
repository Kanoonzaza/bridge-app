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

test('advice never builds on an earlier call that does not describe the hand (board 19)', () => {
  const calls = ['1C', 'P', '1S', '2H', '2N', 'P', '3S', 'P'];
  const r = advise(parseHand('654 A43 A83 A532'), { dealer: 'S', vul: 'EW', calls });
  // 2NT showed 18-19; this hand has 12: the quiet auction's 4♠ would follow from a hand I do not hold.
  assert.notEqual(r.call, '4S');
  assert.equal(r.call, 'P');
  assert.notEqual(r.fallback, 'quiet');
  // The right call earlier is the support double, with its explanation.
  const x = advise(parseHand('654 A43 A83 A532'), { dealer: 'S', vul: 'EW', calls: calls.slice(0, 4) });
  assert.equal(x.call, 'X');
  assert.match(x.meaning, /exactly 3/);
  // With a genuine 18-19 the quiet reading is still used.
  const big = advise(parseHand('K54 AQ3 A83 AQ52'), { dealer: 'S', vul: 'EW', calls });
  assert.equal(big.call, '4S');
});

test('a 7-card major over 1♣: the Advisor starts with 1♠, explains why, and names 4♠ as the alternative (board 20)', async () => {
  const { explain } = await import('../js/engine.js');
  const r = advise(parseHand('AKQJ1075 86 2 1085'), { dealer: 'W', vul: 'both', calls: ['P', '1C', 'P'] });
  assert.equal(r.call, '1S');
  assert.match(r.reasons.join(' '), /7-card suit: 1♠ is forcing, so slam stays possible/);
  assert.match(r.close, /direct 4♠ is also reasonable/);
  // The Decoder reads the 4♠ jump with a real meaning, not a guess.
  const row = explain({ dealer: 'W', calls: ['P', '1C', 'P', '4S'] }).at(-1);
  assert.match(row.meaning, /^Jump to game: 7\+ spades, to play/);
  // A 5-card suit gets no such note.
  assert.equal(advise(parseHand('AKJ85 86 K72 1085'), { dealer: 'W', calls: ['P', '1C', 'P'] }).close ?? null, null);
});

// Opener's answers after Lebensohl (board 25).
const LEB_ANSWERS = [
  // slow Stayman (2NT, 3♣, then the cue-bid): answer the major
  ['N', ['1N', '2D', '2N', 'P', '3C', 'P', '3D', 'P'], 'AT52 AJ5 94 AKT8', '3S', '4 spades: answer Stayman (board 25)'],
  ['N', ['1N', '2D', '2N', 'P', '3C', 'P', '3D', 'P'], 'K52 AJ53 94 AKT8', '3H', '4 hearts: answer Stayman'],
  ['N', ['1N', '2D', '2N', 'P', '3C', 'P', '3D', 'P'], 'K52 AJ5 Q94 AKT8', '3N', 'no major: 3NT (responder has the stopper)'],
  ['N', ['1N', '2H', '2N', 'P', '3C', 'P', '3H', 'P'], 'AT52 AJ5 94 AKT8', '3S', 'over 2H: spades'],
  // direct cue-bid: no stopper; a stopper makes 3NT possible
  ['N', ['1N', '2D', '3D', 'P'], 'K52 AJ5 AQ4 AKT8', '3N', 'no major, I hold the diamond stopper'],
  ['N', ['1N', '2D', '3D', 'P'], 'K52 AJ5 Q94 AKT8', '3N', 'a stopper (Qxx)'],
  ['N', ['1N', '2D', '3D', 'P'], 'K52 AJ5 9874 AKT', '4C', 'no major, no stopper: longest minor'],
  ['N', ['1N', '2S', '3S', 'P'], 'K52 AJ53 94 AKT8', '4H', 'over 2S the heart answer is 4H'],
  // invitation after the relay
  ['N', ['1N', '2H', '2N', 'P', '3C', 'P', '3S', 'P'], 'KJ2 A53 K94 AKT8', '4S', '17 with support: accept'],
  ['N', ['1N', '2H', '2N', 'P', '3C', 'P', '3S', 'P'], 'K2 A53 Q94 AQT82', 'P', '15 with a doubleton: decline'],
  // direct game-forcing 3-level suit
  ['N', ['1N', '2H', '3S', 'P'], 'KJ2 A53 K94 AKT8', '4S', '3 spades: game in the major'],
  ['N', ['1N', '2H', '3C', 'P'], 'KJ2 A53 K94 AKT8', '3N', 'a heart stopper: 3NT'],
];
for (const [dealer, calls, hand, want, why] of LEB_ANSWERS) {
  test(`${calls.join(' ')}: ${hand} → ${want} (${why})`, () => {
    const r = ask(dealer, calls, hand);
    assert.equal(r.call, want);
    assert.equal(r.fallback, undefined, 'a rule, not general judgment');
  });
}

test('the Advisor\'s whole auction on board 25 no longer passes out a Stayman cue', () => {
  const H = { N: 'Q763.2.KT6.97542', E: 'AT52.AJ5.94.AKT8', S: 'J94.T9863.AKJ2.Q', W: 'K8.KQ74.Q753.J63' };
  const seats = ['N', 'E', 'S', 'W'];
  let calls = [];
  for (let i = 0; i < 20; i++) {
    const r = advise(parseHand(H[seats[calls.length % 4]].replace(/\./g, ' ')), { dealer: 'N', vul: 'EW', calls });
    calls = [...calls, r.call];
    if (calls.length >= 4 && calls.slice(-3).every((c) => c === 'P')) break;
  }
  // Either the cue-bid is answered, or West doubles the 2♦ (3 diamonds behind the overcaller): never a cue passed out.
  assert.ok(calls.join(' ').includes('3D P 3S') || calls.join(' ').includes('2D X'), calls.join(' '));
});

test('DONT explanations say the shape, the strength and the vulnerability (board 25)', () => {
  const r = advise(parseHand('J94 T9863 AKJ2 Q'), { dealer: 'N', vul: 'EW', calls: ['P', '1N'] });
  assert.equal(r.call, '2D');
  const why = r.reasons.join(' | ');
  assert.match(why, /4 diamonds and 5 hearts/);
  assert.match(why, /11 HCP: a playing hand/);
  assert.match(why, /they are vulnerable: a good time to get in/);
  assert.match(r.plan, /Partner passes with diamonds/);
  assert.match(r.close, /Your hearts \(T9863\) have no top honor/);
  const strong = advise(parseHand('J94 AKJ98 A982 Q'), { dealer: 'N', vul: 'none', calls: ['P', '1N'] });
  assert.equal(strong.call, '2D');
  assert.equal(strong.close ?? null, null);
});

test('DONT needs 10 HCP: eight and nine point hands with the shape pass', () => {
  for (const h of ['J94 T9863 AJ82 Q', 'KJ4 T9863 QJ82 5']) {
    assert.equal(advise(parseHand(h), { dealer: 'N', vul: 'none', calls: ['P', '1N'] }).call, 'P', h);
  }
});

test('board 13: 10 HCP with a 6-card suit headed by A-K-J overcalls 2♣ (the 2-level overcall starts at 10)', () => {
  const r = advise(parseHand('9 Q42 862 AKJT98'), { dealer: 'N', vul: 'both', calls: ['P', '1S'] });
  assert.equal(r.call, '2C');
  assert.equal(r.fallback, undefined);
  // One point short: pass by agreement, and say a 2-level overcall is a fair choice.
  const p = advise(parseHand('9 J42 862 AKJT98'), { dealer: 'N', vul: 'both', calls: ['P', '1S'] });
  assert.equal(p.call, 'P');
  assert.match(p.reasons.join(' | '), /headed by AKJT.*only 9 HCP.*10\+/);
  assert.match(p.close, /many players would overcall 2 of clubs with 9 HCP/);
});

test('board 17: 9 HCP with a good 6-card suit over their 1-level overcall bids 1NT by agreement and says 2-level suit is reasonable', () => {
  const r = advise(parseHand('A8 T74 AJT643 83'), { dealer: 'N', vul: 'none', calls: ['1C', '1S'] });
  assert.equal(r.call, '1N');
  assert.match(r.close, /6 diamonds headed by AJT.*many players would bid 2D with 9 HCP/);
  // A poor suit gets no such note, and 10 HCP simply bids the suit.
  assert.equal(advise(parseHand('A8 T74 K98643 83'), { dealer: 'N', vul: 'none', calls: ['1C', '1S'] }).close ?? null, null);
  assert.equal(advise(parseHand('A8 K74 AJT643 83'), { dealer: 'N', vul: 'none', calls: ['1C', '1S'] }).call, '2D');
});

test('board 18: 7 spades and 13 HCP opposite 1NT sign off with Texas and then ask for key cards', () => {
  const H = { N: 'KJT8652.A83.J.A7', E: '943.Q7.QT984.865', S: 'AQ.K642.A52.QT32', W: '7.JT95.K763.KJ94' };
  const seats = ['E', 'S', 'W', 'N'];
  let calls = [];
  for (let i = 0; i < 20; i++) {
    const r = advise(parseHand(H[seats[calls.length % 4]].replace(/\./g, ' ')), { dealer: 'E', vul: 'NS', calls });
    calls = [...calls, r.call];
    if (calls.length >= 4 && calls.slice(-3).every((c) => c === 'P')) break;
  }
  assert.equal(calls.join(' '), 'P 1N P 4H P 4S P 4N P 5S P 6S P P P');
  // Fewer than 12 HCP, or a 6-card suit: Texas is a sign-off.
  const sign = (hand) => advise(parseHand(hand), { dealer: 'S', vul: 'none', calls: ['1N', 'P', '4H', 'P', '4S', 'P'] }).call;
  assert.equal(sign('KJT8652 A83 J 87'), 'P');
  assert.equal(sign('KJT865 A83 J A74'), 'P');
});
