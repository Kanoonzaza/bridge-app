// SAYC (pool question 'base', answer 'sayc'), against the ACBL SAYC booklet. Each hand also shows what our 2/1
// house card does differently. Hands: spades.hearts.diamonds.clubs; dealer North unless said.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { card, bidWith, meaningWith } from './pool-helpers.js';

const SAYC = card('sayc');
const HOUSE = card('2/1');

test('1♥/1♠–1NT is 6–10 and not forcing', () => {
  assert.equal(bidWith(SAYC, '72.KJ84.Q973.Q84', ['1S', 'P']).call, '1N');
  assert.match(meaningWith(SAYC, ['1S', 'P', '1N']).meaning, /^6–10, not forcing/);
  assert.match(meaningWith(HOUSE, ['1S', 'P', '1N']).meaning, /^Forcing 1NT/);
});

test('opener passes 1NT with a balanced minimum; with 18–19 invites', () => {
  const calls = ['1S', 'P', '1N', 'P'];
  assert.equal(bidWith(SAYC, 'AK852.K73.Q84.J3', calls, { dealer: 'S' }).call, 'P');
  assert.notEqual(bidWith(HOUSE, 'AK852.K73.Q84.J3', calls, { dealer: 'S' }).call, 'P', 'the house 1NT is forcing');
  assert.equal(bidWith(SAYC, 'AK852.K73.AQ4.K3', calls, { dealer: 'S' }).call, '2N');
});

test('a two-over-one needs only 10+: 1♥–2♣ with 11 and five clubs', () => {
  const h = 'K32.72.Q84.KQJ84';
  assert.equal(bidWith(SAYC, h, ['1H', 'P']).call, '2C');
  assert.match(meaningWith(SAYC, ['1H', 'P', '2C']).meaning, /^Two over one: 10\+.*forcing one round/i);
  assert.equal(bidWith(HOUSE, h, ['1H', 'P']).call, '1N', 'house: 11 is not a 2/1 game force');
});

test('the limit raise allows three trumps (10–11 dummy points)', () => {
  const h = 'K32.Q73.A842.Q84';
  assert.equal(bidWith(SAYC, h, ['1H', 'P']).call, '3H');
  assert.match(meaningWith(SAYC, ['1H', 'P', '3H']).meaning, /3\+ hearts, 10–11/);
});

test('2♣ over 1♦ is 10+ and forcing one round', () => {
  const h = 'K32.Q7.A4.QJ8642';
  assert.equal(bidWith(SAYC, h, ['1D', 'P']).call, '2C');
  assert.match(meaningWith(SAYC, ['1D', 'P', '2C']).meaning, /^Two over one: 10\+/);
});

test('opener after a two-over-one: 2NT with 12–14 balanced, raise with support, rebid a 6-card suit', () => {
  const calls = ['1S', 'P', '2C', 'P'];
  assert.equal(bidWith(SAYC, 'AQ852.K73.Q84.J3', calls, { dealer: 'S' }).call, '2N');
  assert.equal(bidWith(SAYC, 'AQ852.K7.84.QJ73', calls, { dealer: 'S' }).call, '3C');
  assert.equal(bidWith(SAYC, 'AQJ852.K7.843.J3', calls, { dealer: 'S' }).call, '2S');
});

test('responder bids again: 10–11 invites or stops, 12+ bids game', () => {
  assert.equal(bidWith(SAYC, 'K3.72.Q842.AKJ84', ['1S', 'P', '2C', 'P', '2N', 'P']).call, '3N', '13: game');
  assert.equal(bidWith(SAYC, 'K3.72.Q842.KQJ84', ['1S', 'P', '2C', 'P', '2N', 'P']).call, 'P', '11 opposite 12–14');
  assert.equal(bidWith(SAYC, 'K73.72.Q84.KQJ84', ['1S', 'P', '2C', 'P', '2S', 'P']).call, '3S', '3-card support, 11: invite');
});

test('the SAYC preset plays the booklet answers', async () => {
  const { resolve } = await import('../js/pool/card.js');
  const r = resolve(SAYC);
  assert.equal(r['passed-2c'], 'natural');
  assert.equal(r.keycard, 'blackwood');
  assert.equal(r['weak-two-ask'], 'feature');
  assert.equal(r['minor-raise'], 'standard');
  assert.equal(r['minor-2nt'], 'forcing');
  assert.equal(r['jump-shift'], 'strong');
  assert.equal(r['nt-defence'], 'natural');
});
