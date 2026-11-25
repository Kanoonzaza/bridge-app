// The pool's options (js/pool/catalog.js): for each, a hand the option bids differently from the house card,
// and the meaning the option gives the call. Cards are bid exactly as written (tests/pool-helpers.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { card, bidWith, meaningWith } from './pool-helpers.js';

const HOUSE = card('2/1');

test('splinters off: a splinter hand bids Jacoby 2NT instead', () => {
  const h = '5.KQ75.AJ62.K973';
  assert.equal(bidWith(HOUSE, h, ['1H', 'P']).call, '3S');
  assert.equal(bidWith(card('2/1', { splinters: 'off' }), h, ['1H', 'P']).call, '2N');
});

test('passed-hand jump shift with no special meaning: a fit-showing hand uses Drury instead', () => {
  const h = 'AKJ84.Q872.93.42';
  const calls = ['P', 'P', '1H', 'P'];
  assert.equal(bidWith(HOUSE, h, calls, { dealer: 'S' }).call, '2S');
  assert.equal(bidWith(card('2/1', { 'passed-jump': 'none' }), h, calls, { dealer: 'S' }).call, '2C');
});

test('weak-two defence natural: no Leaping Michaels; 4♣ is a long minor', () => {
  const h = 'AKJ84.3.42.AQJ95';
  assert.equal(bidWith(HOUSE, h, ['2H'], { dealer: 'E' }).call, '4C');
  const nat = card('2/1', { 'weak-two-defence': 'natural' });
  assert.notEqual(bidWith(nat, h, ['2H'], { dealer: 'E' }).call, '4C');
  assert.match(meaningWith(nat, ['2H', '4C'], { dealer: 'E' }).meaning, /Natural: a long, strong/);
});

test('slam and artificial doubles for penalty: no lead-directing double of their Stayman', () => {
  const h = '84.J73.952.AKQ94';
  const calls = ['1N', 'P', '2C'];
  assert.equal(bidWith(HOUSE, h, calls, { dealer: 'W' }).call, 'X');
  const pen = card('2/1', { 'slam-doubles': 'penalty' });
  const r = bidWith(pen, h, calls, { dealer: 'W' });
  assert.equal(r.call, 'P');
  assert.equal(r.notCovered, undefined, 'the pass is a rule on every card');
});

test('responsive doubles off: a double of their raise is for penalty', () => {
  const h = 'KJ74.QT86.53.A92';
  const calls = ['1D', 'X', '2D'];
  assert.equal(bidWith(HOUSE, h, calls, { dealer: 'W' }).call, 'X');
  const off = card('2/1', { responsive: 'off' });
  assert.notEqual(bidWith(off, h, calls, { dealer: 'W' }).call, 'X');
  assert.match(meaningWith(off, [...calls, 'X'], { dealer: 'W' }).meaning, /^Penalty/);
});
