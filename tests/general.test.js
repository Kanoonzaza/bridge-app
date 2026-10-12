import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHand } from '../js/cards.js';
import { explain, advise, generalOptions } from '../js/engine.js';
import { SEATS, sideOf } from '../js/auction.js';
import { deal, bidDeal } from '../tools/coverage.mjs';

const last = (dealer, calls) => explain({ dealer, calls }, undefined, { general: true }).at(-1);
const ask = (dealer, calls, hand) => advise(parseHand(hand), { dealer, calls });

test('without the option, calls no rule covers stay unexplained', () => {
  const row = explain({ dealer: 'S', calls: ['1D', '2C', 'X', 'P', '2H', 'P', 'P', '3C'] }).at(-1);
  assert.equal(row.meaning, null);
  assert.equal(row.general, undefined);
});

test('doubles follow the penalty-or-takeout rule', () => {
  assert.match(last('N', ['P', '1D', 'X', '2C', 'P', '2N', 'X']).meaning, /^Penalty double: they bid notrump/);
  assert.match(last('S', ['1S', '2H', '4S', '5H', 'P', 'P', 'X']).meaning, /^Penalty double/);
  assert.match(last('N', ['P', 'P', '1D', 'P', 'P', '1H', 'X']).meaning, /takeout/i);
});

test('raises in competition', () => {
  const r = last('S', ['1D', '2C', 'X', 'P', '2H', 'P', 'P', '3C']);
  assert.match(r.meaning, /^Competitive raise: 3\+ ♣/);
  assert.deepEqual(r.shows.len, { C: [3, 13] });
  assert.match(last('S', ['1S', '2H', '2S', '3H', 'P', 'P', '3S']).meaning, /^Competing in our ♠ fit/);
  // After partner's cue raise, going back to our suit is a sign-off.
  assert.match(last('S', ['1H', '2C', '3C', 'P', '3H']).meaning, /^Back to our ♥: no extra values/);
});

test('cue-bids, control bids and key-card replies', () => {
  assert.match(last('S', ['1H', '1S', '2D', '2S', '3S']).meaning, /^Cue-bid of their suit: a strong hand, forcing/);
  assert.equal(last('S', ['1H', '1S', '2D', '2S', '3S']).shows.force, 'round');
  assert.match(last('S', ['1S', '2H', '2S', '3H', '4H']).meaning, /^Control bid: a slam try in ♠/);
  assert.match(last('N', ['P', '1S', 'P', '2C', 'P', '2H', 'P', '4N', 'P', '5S']).meaning, /^RKCB reply: 2 key cards with the trump queen/);
});

test('a suit after a takeout double shows a strong hand; levels read correctly', () => {
  assert.match(last('E', ['2S', 'X', '3S', 'P', 'P', '4C']).meaning, /strong hand \(doubled first/);
  assert.match(last('W', ['1S', '2C', '2S', 'P', 'P', '3D']).meaning, /^Natural: 5\+ ♦, with values to bid at the 3-level\.$/);
  assert.match(last('S', ['1C', '1S', 'X', '2S', '3D']).meaning, /^Natural: a second suit, 4\+ ♦/, 'the opener\'s new suit shows 4+');
});

test('every general meaning points at a section of the notes', () => {
  const html = readFileSync(new URL('../notes/system-notes.html', import.meta.url), 'utf8');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  let a = 11;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let general = 0;
  for (let i = 0; i < 120; i++) {
    const { auction } = bidDeal(deal(r), SEATS[i % 4]);
    for (const row of explain(auction, undefined, { general: true })) {
      if (row.call === 'P') continue;
      assert.ok(row.meaning, `${auction.calls.join(' ')}: call ${row.i} has no meaning`);
      if (row.general) {
        general++;
        assert.ok(ids.has(row.notes), `missing anchor ${row.notes}`);
      }
    }
  }
  assert.ok(general > 20);
});

test('opponents\' calls get the meaning a standard system would give them', () => {
  const rows = explain({ dealer: 'W', calls: ['1H', 'P', '2H'] }, undefined, { general: true });
  assert.equal(sideOf(rows[2].seat), 'EW');
  assert.ok(rows[2].meaning);
});

test('the Advisor says what a judgment call tells partner', () => {
  const r = ask('S', ['1D', '2C', 'X', 'P', '2H', 'P', 'P'], '72 K4 A9874 KJ93');
  assert.equal(r.fallback, 'judgment');
  assert.notEqual(r.meaning, 'Natural (general judgment).');
  assert.ok(r.meaning.length > 10);
});

test('with no rule for the next call, the general options are listed', () => {
  const opts = generalOptions({ dealer: 'S', calls: ['1S', '2H', '2S', '3H'] });
  const calls = opts.map((o) => o.call);
  assert.ok(calls.includes('3N') && calls.includes('X') && calls.includes('4S'));
  assert.ok(opts.every((o) => o.meaning));
});
