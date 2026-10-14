import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selfcheck } from '../tools/selfcheck.mjs';
import { misfit } from '../js/table/review.js';
import { explain } from '../js/engine.js';
import { unpackHand } from '../js/table/model.js';

// A ratchet: the number of Advisor calls that contradict the app's own explanation of them
// (strength, length, balance, stoppers, passing a forcing bid) may only go down.
// When a fix lowers the count, lower CEILING to match. Details: node tools/selfcheck.mjs 600 77
const CEILING = 16;

test(`self-consistency: at most ${CEILING} contradictions in 600 deals`, () => {
  const r = selfcheck(600, 77);
  assert.ok(r.issues.length <= CEILING, `${r.issues.length} contradictions (ceiling ${CEILING}):\n${r.issues.map((x) => x.text).join('\n')}`);
});

test('ranges in points count shortness with the fit; minimum rebids allow a light opening', () => {
  // 1♥ (2♣) 3♣: a cue-bid raise with 9 HCP and a singleton club is 11 points counting shortness.
  const cue = explain({ dealer: 'N', calls: ['1H', '2C', '3C'] }).at(-1);
  assert.equal(cue.shows.pts, 'H');
  assert.deepEqual(misfit(unpackHand('Q932.K74.KJ652.7'), cue), []);
  assert.match(misfit(unpackHand('Q932.K74.J8652.7'), cue).join(), /shows 10\+ points counting the fit; you have 8/);
  // 1♦ 1♠ 2♦ by a Rule-of-20 opener with 11 HCP ("minimum, 12–15").
  const rebid = explain({ dealer: 'N', calls: ['1D', 'P', '1S', 'P', '2D'] }).at(-1);
  assert.deepEqual(misfit(unpackHand('7.K84.AQT965.Q93'), rebid), []);
});

test('errors the self-check found stay fixed', async () => {
  const { advise } = await import('../js/engine.js');
  const ask = (hand, calls) => advise(unpackHand(hand), { dealer: 'N', calls }).call;
  // Game values over their preempt: 4♠, not a "simple raise" to 3♠.
  assert.equal(ask('KQ2.AKT8.T875.Q2', ['1S', '3C']), '4S');
  // 19+ with a long suit and the other suits stopped: 3NT, not an invitational 3♣.
  assert.equal(ask('AQ4.AJ.K6.KQT964', ['1C', 'P', '1S', 'P']), '3N');
  // 17 HCP and 7 diamonds after a negative double: jump, not a minimum 2♦.
  assert.equal(ask('3.KJ.AKQ8532.A92', ['1D', '1H', 'X', 'P']), '3D');
  // A suit bid answering partner's (competitive) double is not a forcing free bid.
  const row = explain({ dealer: 'N', calls: ['P', '1C', 'P', 'P', '1D', 'X', 'P', '1H'] }, undefined, { general: true }).at(-1);
  assert.match(row.meaning, /^Answer to partner's double/);
  assert.equal(row.shows.force, undefined);
});

test('every suggestion says how firm it is: agreed system, proposed agreement or general judgment', async () => {
  const { advise } = await import('../js/engine.js');
  const { confidence } = await import('../js/confidence.js');
  const { advisorReport } = await import('../js/report.js');
  const hand = unpackHand('AKQ85.J7.Q84.QT5');
  const open = advise(hand, { dealer: 'S', calls: [] });
  assert.equal(confidence(open).level, 'agreed');
  assert.match(advisorReport(hand, { dealer: 'S', calls: [] }, open), /Suggested: 1♠ \[Agreed system\]/);
  assert.equal(confidence({ call: '3C', fallback: 'judgment' }).label, 'General judgment');
  assert.equal(confidence({ call: '3S', notes: 'leaping-michaels' }).level, 'proposed');
  assert.equal(confidence({ notCovered: true }), null);
});

test('board 44: 1♠ (1NT) 2♥ is limited and not forcing; opener with a heart void rebids the spades', async () => {
  const { advise } = await import('../js/engine.js');
  const calls = ['P', '1S', '1N', '2H'];
  const row = explain({ dealer: 'W', calls }).at(-1);
  assert.deepEqual(row.shows.hcp, [5, 8]);
  assert.match(row.meaning, /Not forcing/);
  // Q9764 is a poor suit and N-S are vulnerable: pass. With KQ1094 (or 6 hearts) 2♥ is fine.
  assert.equal(advise(unpackHand('6.Q9764.T965.K43'), { dealer: 'W', vul: 'NS', calls: calls.slice(0, 3) }).call, 'P');
  assert.equal(advise(unpackHand('6.KQ1094.T965.43'), { dealer: 'W', vul: 'NS', calls: calls.slice(0, 3) }).call, '2H');
  assert.equal(advise(unpackHand('6.Q97642.T96.K43'), { dealer: 'W', vul: 'none', calls: calls.slice(0, 3) }).call, '2H');
  assert.equal(advise(unpackHand('KQJT43..J872.AJ6'), { dealer: 'W', vul: 'NS', calls: [...calls, 'P'] }).call, '2S');
});

test('board 56: after Drury and opener\'s light 2♠, the passed hand passes (not a 2/1 fast arrival)', async () => {
  const { advise } = await import('../js/engine.js');
  const north = unpackHand('QJ83.KQ.J65.Q973');
  assert.equal(advise(unpackHand('AK962.9872.Q97.K'), { dealer: 'W', calls: ['P', 'P', 'P', '1S', 'P', '2C', 'P'] }).call, '2S');
  assert.equal(advise(north, { dealer: 'W', calls: ['P', 'P', 'P', '1S', 'P', '2C', 'P', '2S', 'P'] }).call, 'P');
  // An unpassed 2/1 still uses fast arrival.
  assert.equal(advise(north, { dealer: 'N', calls: ['1S', 'P', '2C', 'P', '2S', 'P'] }).call, '4S');
});

test('board 62: a 21-count opener does not sell out to their 2♠ after Michaels', async () => {
  const { systemAuction } = await import('../js/table/review.js');
  const hands = { N: '52.K87542.KT.J54', E: '973.T.Q532.AT986', S: 'AK8.A.AJ8764.KQ3', W: 'QJT64.QJ963.9.72' };
  const seats = Object.fromEntries(['N', 'E', 'S', 'W'].map((s) => [s, { kind: 'robot' }]));
  const calls = systemAuction({ dealer: 'E', vul: 'none', hands, calls: '' }, seats).calls;
  assert.deepEqual(calls.slice(0, 6), ['P', '1D', '2D', 'P', '2S', 'X']);
  assert.ok(calls.includes('3N'), calls.join(' '));
});

test('board 66: over 1♥–(P)–2♠ (weak jump shift) a 13-count with both minors doubles; partner answers in the 5-card suit', async () => {
  const { advise } = await import('../js/engine.js');
  assert.equal(advise(unpackHand('A3.AJT6.Q8753.76'), { dealer: 'E', vul: 'NS', calls: ['1H'] }).call, 'P');
  assert.equal(advise(unpackHand('J8.K9.AT942.KQT2'), { dealer: 'E', vul: 'NS', calls: ['1H', 'P', '2S'] }).call, 'X');
  assert.equal(advise(unpackHand('A3.AJT6.Q8753.76'), { dealer: 'E', vul: 'NS', calls: ['1H', 'P', '2S', 'X', 'P'] }).call, '3D');
});

test('board 74: with 5 hearts and club support, double (responsive) rather than raise; partner finds 4♥', async () => {
  const { systemAuction } = await import('../js/table/review.js');
  const hands = { N: 'A85.A743.2.AQT63', E: 'KJ63.J6.AKJT9.98', S: '7.T9852.Q84.KJ74', W: 'QT942.KQ.7653.52' };
  const seats = Object.fromEntries(['N', 'E', 'S', 'W'].map((s) => [s, { kind: 'robot' }]));
  const calls = systemAuction({ dealer: 'E', vul: 'both', hands, calls: '' }, seats).calls;
  assert.deepEqual(calls.slice(0, 7), ['1D', 'P', '1S', '2C', '2S', 'X', 'P']);
  assert.ok(calls.includes('4H'), calls.join(' '));
  const x = explain({ dealer: 'E', calls: ['1D', 'P', '1S', '2C', '2S', 'X'] }, undefined, { general: true }).at(-1);
  assert.match(x.meaning, /^Responsive double/);
  assert.doesNotMatch(x.meaning, /♦/, 'their opened suit is not an unbid suit');
});

test('board 76: a game-forcing auction stops at game (2♣ … 3NT is passed); 4♦ is not game', async () => {
  const { systemAuction } = await import('../js/table/review.js');
  const hands = { N: 'T864.QT6.Q6.9875', E: 'J32.8432.K75.J63', S: 'AQ7.AK.AT432.AQT', W: 'K95.J975.J98.K42' };
  const seats = Object.fromEntries(['N', 'E', 'S', 'W'].map((s) => [s, { kind: 'robot' }]));
  const calls = systemAuction({ dealer: 'W', vul: 'NS', hands, calls: '' }, seats).calls;
  assert.equal(calls.join(' '), 'P P P 2C P 2D P 2N P 3C P 3D P 3N P P P');
});

test('board 80: after 1♠–1NT–2♦ a long suit below diamonds is shown at the 3-level, not 2NT with a singleton spade', async () => {
  const { advise } = await import('../js/engine.js');
  const calls = ['P', '1S', 'P', '1N', 'P', '2D', 'P'];
  assert.equal(advise(unpackHand('6.65.AKJ.QJT7432'), { dealer: 'W', calls }).call, '3C');
  assert.match(explain({ dealer: 'W', calls: [...calls, '3C'] }).at(-1).meaning, /^6\+ clubs, not forcing/);
  assert.equal(advise(unpackHand('AJ8754.Q.T9762.K'), { dealer: 'W', calls: [...calls, '3C', 'P'] }).call, 'P');
  // 11–12 with no singleton still invites with 2NT.
  assert.equal(advise(unpackHand('J8.A6.QJ9654.A54'), { dealer: 'W', calls: ['P', '1S', 'P', '1N', 'P', '2H', 'P'] }).call, '2N');
  // Not without a stopper in the other unbid suit.
  assert.equal(advise(unpackHand('65.J4.A98.KQJ742'), { dealer: 'W', calls }).call, '3C');
  assert.equal(advise(unpackHand('65.K4.Q98.AKJ742'), { dealer: 'W', calls }).call, '2N');
});

test('board 88: over the cue-bid raise, a shapely overcaller (6 losers) bids game', async () => {
  const { advise } = await import('../js/engine.js');
  const { systemAuction } = await import('../js/table/review.js');
  assert.equal(advise(unpackHand('Q872.J95.AT.Q872'), { dealer: 'W', calls: ['1D', '1S', 'X'] }).call, '2D');
  assert.equal(advise(unpackHand('AKJT654.T.3.T643'), { dealer: 'W', calls: ['1D', '1S', 'X', '2D', '2H'] }).call, '4S');
  assert.equal(advise(unpackHand('KQJ65.K72.43.Q72'), { dealer: 'W', calls: ['1D', '1S', 'P', '2D', 'P'] }).call, '2S');
  const hands = { N: 'AKJT654.T.3.T643', E: '93.K743.8754.A95', S: 'Q872.J95.AT.Q872', W: '.AQ862.KQJ962.KJ' };
  const seats = Object.fromEntries(['N', 'E', 'S', 'W'].map((s) => [s, { kind: 'robot' }]));
  assert.ok(systemAuction({ dealer: 'W', vul: 'none', hands, calls: '' }, seats).calls.includes('4S'));
});

test('board 95: after a double of Unusual 2NT, advancer picks a suit; our side follows up and reaches 4♠', async () => {
  const { advise } = await import('../js/engine.js');
  const { systemAuction } = await import('../js/table/review.js');
  assert.equal(advise(unpackHand('95.K8.764.KT6542'), { dealer: 'S', calls: ['1C', '2N', 'X'] }).call, '3D');
  const hands = { N: 'KQT763.943.A83.Q', E: '95.K8.764.KT6542', S: 'AJ84.A7.T2.A9873', W: '2.QJT652.KQJ95.J' };
  const seats = Object.fromEntries(['N', 'E', 'S', 'W'].map((s) => [s, { kind: 'robot' }]));
  assert.equal(systemAuction({ dealer: 'S', vul: 'NS', hands, calls: '' }, seats).calls.join(' '), '1C 2N X 3D P P 3S P 4S P P P');
  const row = explain({ dealer: 'S', calls: ['1C', '2N', 'X', '3D', 'P', 'P', '3S'] }).at(-1);
  assert.equal(row.shows.force, 'round');
});

test('board 97: a 12-count with an 8-card suit is a good 12 (2/1), and asks for key cards over the fast-arrival raise', async () => {
  const { systemAuction } = await import('../js/table/review.js');
  const hands = { N: 'T7654.AJ6..KQ754', E: 'K.2.KT986432.JT2', S: 'A.QT987543.AQ7.8', W: 'QJ9832.K.J5.A963' };
  const seats = Object.fromEntries(['N', 'E', 'S', 'W'].map((s) => [s, { kind: 'robot' }]));
  // Two key cards are missing (♣A, ♥K): stop in 5♥.
  assert.equal(systemAuction({ dealer: 'N', vul: 'none', hands, calls: '' }, seats).calls.join(' '), '1S P 2H P 4H P 4N P 5C P 5H P P P');
});
