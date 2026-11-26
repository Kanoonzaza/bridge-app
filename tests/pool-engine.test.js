import { test } from 'node:test';
import assert from 'node:assert/strict';
import ALL from '../js/system/index.js';
import { advise, explain, nextOptions } from '../js/engine.js';
import { addCall, isComplete, nextSeat, SEATS } from '../js/auction.js';
import { bookFor } from '../js/pool/system.js';
import { deal } from '../tools/coverage.mjs';
import { mulberry32 } from './helpers.js';

const VUL = ['none', 'NS', 'EW', 'both'];
function bidOut(hands, dealer, vul, book) {
  let a = { dealer, vul, calls: [] };
  const results = [];
  for (let g = 0; g < 60 && !isComplete(a); g++) {
    const r = advise(hands[nextSeat(a)], a, book);
    results.push(r);
    a = addCall(a, r.notCovered ? 'P' : r.call);
  }
  return { a, results };
}

test('a house book on both sides bids and explains exactly like the plain engine', () => {
  const rng = mulberry32(2026);
  const book = bookFor({});
  for (let i = 0; i < 300; i++) {
    const hands = deal(rng);
    const dealer = SEATS[i % 4];
    const vul = VUL[i % 4];
    const plain = bidOut(hands, dealer, vul);
    const booked = bidOut(hands, dealer, vul, book);
    assert.deepEqual(booked.a.calls, plain.a.calls, `deal ${i}`);
    assert.deepEqual(booked.results.map((r) => r.reasons), plain.results.map((r) => r.reasons), `deal ${i}`);
    assert.deepEqual(explain(booked.a, book, { general: true }).map((r) => r.meaning), explain(plain.a, undefined, { general: true }).map((r) => r.meaning), `deal ${i}`);
  }
});

test('each call is read with the rules of the side that made it', () => {
  // E-W play a two-rule card: their 1♣ opening and nothing else.
  const tiny = [{ after: [], call: '1C', meaning: 'Tiny card: 1♣.', shows: {}, notes: 'opening-bids-tier-0', opt: null, priority: 1, pick: () => true, why: () => [] }];
  const book = { NS: ALL, EW: tiny };
  // East opens, South passes, West responds 1♦, North balances... (dealer E: E S W N).
  const a = { dealer: 'E', vul: 'none', calls: ['1C', 'P', '1D'] };
  const rows = explain(a, book);
  assert.equal(rows[0].meaning, 'Tiny card: 1♣.');
  assert.notEqual(explain(a)[0].meaning, 'Tiny card: 1♣.');
  assert.equal(rows[2].meaning, null, 'E-W have no rule for 1♦');
  assert.ok(explain(a)[2].meaning, 'the house card has one');
  // South (house card) has options over 1♣; West (tiny card) has none.
  assert.ok(nextOptions({ dealer: 'E', vul: 'none', calls: ['1C'] }, book).length > 0);
  assert.equal(nextOptions({ dealer: 'E', vul: 'none', calls: ['1C', 'P'] }, book).length, 0);
  // A hand-made list gets no general judgment: West with no rule is "not covered".
  const hand = { S: 'AKQ2', H: 'K32', D: 'Q32', C: 'J32' };
  assert.equal(advise(hand, { dealer: 'E', vul: 'none', calls: ['1C', 'P'] }, book).notCovered, true);
  assert.equal(advise(hand, { dealer: 'E', vul: 'none', calls: ['1C', 'P'] }).notCovered, undefined);
});

test('advise names the option the call came from', () => {
  const hand = { S: 'K32', H: 'Q3', D: 'AJ432', C: 'K32' };
  const r = advise(hand, { dealer: 'N', vul: 'none', calls: ['P', 'P', '1S', 'P'] });
  assert.equal(r.call, '2C');
  assert.equal(r.opt, 'passed-2c:drury');
});
