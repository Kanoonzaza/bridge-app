import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advise } from '../js/engine.js';
import { unpackHand } from '../js/table/model.js';
import { sampleHands, candidatesFor, honest, simulateParts, mergeParts, decideBid, imps, MIN_GAIN } from '../js/sim-bid.js';
import { misfit } from '../js/table/review.js';
import { explain } from '../js/engine.js';
import { confidence } from '../js/confidence.js';

const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const hcp = (h) => [...'SHDC'].reduce((n, s) => n + [...(h[s] ?? '')].reduce((m, r) => m + ({ A: 4, K: 3, Q: 2, J: 1 }[r] ?? 0), 0), 0);

test('IMP scale', () => {
  assert.equal(imps(10), 0);
  assert.equal(imps(20), 1);
  assert.equal(imps(-420), -9);
  assert.equal(imps(620 - -100), 12);
});

test('sampled hands keep my cards and fit what the bidding showed', () => {
  // Partner opened 1NT (15–17 balanced); I am South with 7 HCP.
  const hand = unpackHand('AT875.T72.Q72.QT');
  const auction = { dealer: 'N', vul: 'none', calls: ['1N', 'P'] };
  const rand = rng(5);
  for (let i = 0; i < 15; i++) {
    const h = sampleHands(auction, 'S', hand, rand);
    assert.ok(h, 'a layout is found');
    assert.deepEqual(h.S, hand);
    assert.ok(hcp(h.N) >= 14 && hcp(h.N) <= 18, `partner's 1NT: ${hcp(h.N)} HCP`);
    const cards = ['N', 'E', 'S', 'W'].flatMap((s) => 'SHDC'.split('').flatMap((x) => [...h[s][x]].map((r) => x + r)));
    assert.equal(new Set(cards).size, 52, 'every card exactly once');
  }
});

test('candidates always include the Advisor\'s call, pass and double when legal', () => {
  const hand = unpackHand('QJT98632.A7.AT.4');
  const auction = { dealer: 'E', vul: 'NS', calls: ['P', '1S', '2S', 'X', '4H'] };
  const c = candidatesFor(hand, auction, '4S');
  assert.ok(c.includes('4S') && c.includes('P') && c.includes('X'));
  assert.ok(c.length >= 3 && c.length <= 9);
});

test('shares from several workers combine, and the decision needs a clear gain', () => {
  const a = { n: 6, sums: { P: { sum: 0, win: 0 }, X: { sum: 9, win: 5 } } };
  const b = { n: 10, sums: { P: { sum: 0, win: 0 }, X: { sum: 14, win: 8 } } };
  const m = mergeParts([a, null, b]);
  assert.equal(m.n, 16);
  assert.equal(m.sums.X.sum, 23);
  const d = decideBid('P', m);
  assert.equal(d.call, 'X');
  assert.equal(d.changed, true);
  assert.ok(d.table.X.gain >= MIN_GAIN);
  // Too few samples, too small a gain, or a gain that wins too rarely: the Advisor's call stays.
  assert.equal(decideBid('P', { n: 6, sums: { P: { sum: 0, win: 0 }, X: { sum: 20, win: 5 } } }).changed, false);
  assert.equal(decideBid('P', { n: 20, sums: { P: { sum: 0, win: 0 }, X: { sum: 10, win: 12 } } }).changed, false);
  assert.equal(decideBid('P', { n: 20, sums: { P: { sum: 0, win: 0 }, X: { sum: 30, win: 5 } } }).changed, false);
  assert.equal(decideBid('P', { n: 0, sums: {} }).call, 'P');
});

test('simulation: a hand with 8 spades opposite a limit raise keeps the game bid; the result is tagged as a simulation', async () => {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const hand = unpackHand('QJT98632.A7.AT.4');
  const auction = { dealer: 'E', vul: 'NS', calls: ['P', '1S', '2S', 'X', '4H'] };
  const r = advise(hand, auction);
  const p = simulateParts({ hand, auction, baseCall: r.call, dds, rand: rng(9), samples: 6, minSamples: 6, timeMs: 1e9 });
  assert.equal(p.n, 6);
  const d = decideBid(r.call, p);
  assert.ok(d.call);
  assert.equal(confidence({ ...r, sim: { changed: true, n: 6 } }).label, 'Simulation');
  assert.match(confidence({ ...r, sim: { changed: false, n: 6 } }).note, /held up/);
});

test('board 16: the simulation may not pick a call whose meaning the hand does not fit', () => {
  const west = unpackHand('KJ74.KQT7.762.62');
  const auction = { dealer: 'W', vul: 'EW', calls: 'P 1S 2C P P X P 2D P 2S P P'.split(' ') };
  // 2NT here is "natural, with a stopper in ♠ and ♦": West has ♦762.
  const row = explain({ ...auction, calls: [...auction.calls, '2N'] }, undefined, { general: true })[auction.calls.length];
  assert.match(row.meaning, /stopper in ♠ and ♦/);
  assert.match(misfit(west, row).join(' '), /claims a ♦ stopper; you hold 762/);
  const kept = honest(west, auction, ['P', 'X', '2N', '3N'], 'P');
  assert.deepEqual(kept.sort(), ['P', 'X']);
  // The Advisor's own call stays even if it would not pass the test.
  assert.ok(honest(west, auction, ['2N'], '2N').includes('2N'));
});
