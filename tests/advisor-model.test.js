import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealerFor, buildAuction } from '../js/advisor-model.js';
import { nextSeat, situationAt } from '../js/auction.js';

test('dealer puts the opener in the chosen seat', () => {
  assert.equal(dealerFor('me', 1), 'S');
  assert.equal(dealerFor('me', 2), 'E');
  assert.equal(dealerFor('me', 3), 'N');
  assert.equal(dealerFor('me', 4), 'W');
  assert.equal(dealerFor('partner', 1), 'N');
  assert.equal(dealerFor('partner', 3), 'S');
});

test('I open in 1st seat: waits for my opening, then for partner', () => {
  assert.deepEqual(buildAuction({ opener: 'me', seat: 1, ourCalls: [] }).calls, []);
  const a = buildAuction({ opener: 'me', seat: 1, ourCalls: ['1S'] });
  assert.deepEqual(a.calls, ['1S', 'P']);
  assert.equal(nextSeat(a), 'N');
});

test('partner opens in 3rd seat after I passed', () => {
  const a = buildAuction({ opener: 'partner', seat: 3, ourCalls: ['1H'] });
  assert.deepEqual(a.calls, ['P', 'P', '1H', 'P']);
  assert.equal(nextSeat(a), 'S');
  assert.equal(situationAt(a, a.calls.length).ctx.responderPassed, true);
});

test('I open in 4th seat after three passes', () => {
  const a = buildAuction({ opener: 'me', seat: 4, ourCalls: [] });
  assert.deepEqual(a.calls, ['P', 'P', 'P']);
  assert.equal(situationAt(a, 3).ctx.seat, 4);
});

test('stops at an illegal call and when the auction ends', () => {
  assert.deepEqual(buildAuction({ opener: 'me', seat: 1, ourCalls: ['1S', '1H'] }).calls, ['1S', 'P']);
  assert.deepEqual(buildAuction({ opener: 'me', seat: 1, ourCalls: ['1S', 'P'] }).calls, ['1S', 'P', 'P', 'P']);
});

test('competing opponents: their calls are entered after our opening', () => {
  const a = buildAuction({ opener: 'partner', seat: 1, ourCalls: ['1H', '2C'], compete: true });
  assert.deepEqual(a.calls, ['1H', '2C']);
  assert.equal(nextSeat(a), 'S');
  const b = buildAuction({ opener: 'me', seat: 1, ourCalls: ['1S', 'P', '2S', '3H'], compete: true });
  assert.deepEqual(b.calls, ['1S', 'P', '2S', '3H']);
  assert.equal(nextSeat(b), 'S');
});

test('an opponent opens: right-hand opponent in 1st seat, then I act', () => {
  assert.equal(dealerFor('rho', 1), 'E');
  assert.equal(dealerFor('lho', 1), 'W');
  const a = buildAuction({ opener: 'rho', seat: 1, ourCalls: ['1H'] });
  assert.deepEqual(a.calls, ['1H']);
  assert.equal(nextSeat(a), 'S');
  const b = buildAuction({ opener: 'lho', seat: 2, ourCalls: ['1N', 'P', 'P'] });
  assert.deepEqual(b.calls, ['P', '1N', 'P', 'P']);
  assert.equal(nextSeat(b), 'S');
});
