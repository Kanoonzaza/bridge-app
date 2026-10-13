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
