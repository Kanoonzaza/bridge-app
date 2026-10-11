import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bidRank, legalCalls, isComplete, addCall, undo, nextSeat, seatAt, situationAt } from '../js/auction.js';

test('bid ranks order clubs < diamonds < hearts < spades < NT', () => {
  assert.ok(bidRank('1C') < bidRank('1D'));
  assert.ok(bidRank('1S') < bidRank('1N'));
  assert.ok(bidRank('1N') < bidRank('2C'));
  assert.equal(bidRank('7N'), 34);
});

test('opening legal calls: pass and all 35 bids, no doubles', () => {
  const legal = legalCalls({ dealer: 'N', calls: [] });
  assert.equal(legal.length, 36);
  assert.ok(!legal.includes('X'));
});

test('bids must be higher; doubles only of opponents', () => {
  const a = { dealer: 'N', calls: ['1S'] };
  const legal = legalCalls(a);
  assert.ok(!legal.includes('1H'));
  assert.ok(!legal.includes('1S'));
  assert.ok(legal.includes('1N'));
  assert.ok(legal.includes('X'));
  assert.ok(!legal.includes('XX'));
  const b = { dealer: 'N', calls: ['1S', 'X'] };
  assert.ok(legalCalls(b).includes('XX'));
  assert.ok(!legalCalls(b).includes('X'));
  const c = { dealer: 'N', calls: ['1S', 'P'] };
  assert.ok(!legalCalls(c).includes('X'));
  const d = { dealer: 'N', calls: ['1S', 'P', 'P'] };
  assert.ok(legalCalls(d).includes('X'));
});

test('completion', () => {
  assert.equal(isComplete({ dealer: 'N', calls: ['P', 'P', 'P'] }), false);
  assert.equal(isComplete({ dealer: 'N', calls: ['P', 'P', 'P', 'P'] }), true);
  assert.equal(isComplete({ dealer: 'N', calls: ['1S', 'P', 'P', 'P'] }), true);
  assert.equal(isComplete({ dealer: 'N', calls: ['P', '1S', 'P', 'P'] }), false);
  assert.deepEqual(legalCalls({ dealer: 'N', calls: ['1S', 'P', 'P', 'P'] }), []);
});

test('addCall rejects illegal calls; undo removes the last', () => {
  const a = addCall({ dealer: 'N', calls: [] }, '1H');
  assert.throws(() => addCall(a, '1D'), /Illegal/);
  assert.deepEqual(undo(a).calls, []);
});

test('seats rotate from the dealer', () => {
  const a = { dealer: 'E', calls: ['P'] };
  assert.equal(seatAt(a, 0), 'E');
  assert.equal(nextSeat(a), 'S');
});

test('situation for the opener after a raise', () => {
  const s = situationAt({ dealer: 'N', calls: ['1S', 'P', '2S', 'P'] }, 4);
  assert.deepEqual(s.key, ['1S', '2S']);
  assert.equal(s.actor, 'N');
  assert.equal(s.ctx.role, 'opener');
  assert.equal(s.ctx.responderPassed, false);
  assert.equal(s.ctx.competitive, false);
});

test('situation for a passed-hand responder in 3rd seat', () => {
  const s = situationAt({ dealer: 'S', calls: ['P', 'P', '1H', 'P'] }, 4);
  assert.deepEqual(s.key, ['1H']);
  assert.equal(s.ctx.role, 'responder');
  assert.equal(s.ctx.responderPassed, true);
  assert.equal(s.ctx.seat, 3);
});

test('situation with an overcall puts the opponent bid in brackets', () => {
  const s = situationAt({ dealer: 'N', calls: ['1S', '2C'] }, 2);
  assert.deepEqual(s.key, ['1S', '(2C)']);
  assert.equal(s.ctx.competitive, true);
});

test('opening situation and defender situation', () => {
  const open = situationAt({ dealer: 'E', calls: ['P'] }, 1);
  assert.deepEqual(open.key, []);
  assert.equal(open.ctx.role, 'opening');
  assert.equal(open.ctx.seat, 2);
  const def = situationAt({ dealer: 'E', calls: ['1H'] }, 1);
  assert.deepEqual(def.key, ['(1H)']);
  assert.equal(def.ctx.role, 'defender');
  assert.equal(def.ctx.opened, 'them');
});
