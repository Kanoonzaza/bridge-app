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

test('Texas off: a game hand with six spades transfers, then bids game', () => {
  const h = 'KQJ752.K3.Q42.73';
  assert.equal(bidWith(HOUSE, h, ['1N', 'P']).call, '4H');
  const off = card('2/1', { texas: 'off' });
  assert.equal(bidWith(off, h, ['1N', 'P']).call, '2H');
  assert.equal(bidWith(off, h, ['1N', 'P', '2H', 'P', '2S', 'P']).call, '4S');
  assert.match(meaningWith(off, ['1N', 'P', '4H']).meaning, /^To play: 6\+ hearts/);
});

test('Smolen off: 5 spades and 4 hearts show the spades; opener raises with three', () => {
  const h = 'AQJ43.KJ72.Q4.83';
  const calls = ['1N', 'P', '2C', 'P', '2D', 'P'];
  assert.equal(bidWith(HOUSE, h, calls).call, '3H');
  const off = card('2/1', { smolen: 'off' });
  assert.equal(bidWith(off, h, calls).call, '3S');
  assert.match(meaningWith(off, [...calls, '3S']).meaning, /^5 spades/);
  assert.equal(bidWith(off, 'K92.AQ5.KJ83.Q72', ['1N', 'P', '2C', 'P', '2D', 'P', '3S', 'P'], { dealer: 'S' }).call, '4S');
});

test('natural over their overcall of our 1NT: 2NT is an invitation, not a relay', () => {
  const h = 'K84.Q93.A762.984';
  const calls = ['1N', '2H'];
  const nat = card('2/1', { 'nt-interference': 'natural' });
  assert.equal(bidWith(nat, h, calls).call, '2N');
  assert.match(meaningWith(nat, [...calls, '2N']).meaning, /^Natural: 8–9/);
  assert.match(meaningWith(HOUSE, [...calls, '2N']).meaning, /Lebensohl/);
  assert.equal(bidWith(nat, 'AQ3.KJ4.QJ52.K94', [...calls, '2N', 'P'], { dealer: 'S' }).call, '3N', 'opener accepts with 16');
});

test('passed hand, natural 2♣: clubs; the 3-card limit raise jumps to 3 of the major', () => {
  const nat = card('2/1', { 'passed-2c': 'natural' });
  const calls = ['P', 'P', '1H', 'P'];
  assert.equal(bidWith(HOUSE, 'K32.Q73.A4.QJ932', calls, { dealer: 'S' }).call, '2C', 'Drury');
  assert.equal(bidWith(nat, 'K32.Q73.A4.QJ932', calls, { dealer: 'S' }).call, '3H');
  assert.equal(bidWith(nat, 'K3.72.A54.KJ9832', calls, { dealer: 'S' }).call, '2C');
  assert.match(meaningWith(nat, [...calls, '2C'], { dealer: 'S' }).meaning, /natural, 5\+ clubs/);
});

test('standard minor raises: 2♦ is 6–10, 3♦ a limit raise', () => {
  const std = card('2/1', { 'minor-raise': 'standard' });
  assert.equal(bidWith(HOUSE, '4.K32.KJ842.Q632', ['1D', 'P']).call, '3D', 'house: weak jump raise (inverted)');
  assert.equal(bidWith(std, '4.K32.KJ842.Q632', ['1D', 'P']).call, '2D');
  assert.equal(bidWith(std, '43.K32.KQ842.A32', ['1D', 'P']).call, '3D');
  assert.match(meaningWith(std, ['1D', 'P', '3D']).meaning, /^Limit raise/);
  assert.equal(bidWith(std, 'AQ3.K4.AJ42.K932', ['1D', 'P', '2D', 'P'], { dealer: 'S' }).call, '2N', '18 balanced invites');
});

test('1m–2NT forcing: 13–15 bids 2NT, opener with a balanced minimum bids 3NT', () => {
  const f = card('2/1', { 'minor-2nt': 'forcing' });
  const h = 'KJ3.Q92.K84.AJ92';
  assert.equal(bidWith(HOUSE, h, ['1D', 'P']).call, '3N');
  assert.equal(bidWith(f, h, ['1D', 'P']).call, '2N');
  assert.match(meaningWith(f, ['1D', 'P', '2N']).meaning, /Game forcing/);
  assert.equal(bidWith(f, 'A84.K73.QJ62.K53', ['1D', 'P', '2N', 'P'], { dealer: 'S' }).call, '3N');
});

test('strong jump shifts: 19 with a good 6-card suit jumps; opener supports', () => {
  const s = card('2/1', { 'jump-shift': 'strong' });
  const h = 'AKQJ84.A3.K42.Q3';
  assert.equal(bidWith(s, h, ['1H', 'P']).call, '2S');
  assert.match(meaningWith(s, ['1H', 'P', '2S']).meaning, /^Strong jump shift/);
  assert.match(meaningWith(HOUSE, ['1H', 'P', '2S']).meaning, /^Weak jump shift/);
  assert.equal(bidWith(s, 'Q73.AKJ84.65.K42', ['1H', 'P', '2S', 'P'], { dealer: 'S' }).call, '3S');
  assert.notEqual(bidWith(s, '83.42.T97532.J42', ['1H', 'P']).call, '3D', 'no weak jump shift');
});

test('feature ask over a weak two: a maximum shows its outside ace or king', () => {
  const f = card('2/1', { 'weak-two-ask': 'feature' });
  const calls = ['2S', 'P', '2N', 'P'];
  assert.equal(bidWith(f, 'KQJ952.83.A62.94', calls).call, '3D', 'maximum (9) with the diamond ace');
  assert.equal(bidWith(f, 'KJ9852.83.Q62.94', calls).call, '3S', 'minimum');
  assert.match(meaningWith(f, [...calls, '3D']).meaning, /ace or king of diamonds/);
  assert.match(meaningWith(HOUSE, [...calls, '3D']).meaning, /Minimum \(5–7\), good suit/, 'Ogust on the house card');
  assert.match(bidWith(f, 'A4.KQ5.AKJ62.Q73', ['2S', 'P']).reasons.join(' '), /feature/);
});

test('Blackwood: replies count aces; interference is DOPI; asks are worded for the card', () => {
  const bw = card('2/1', { keycard: 'blackwood' });
  const calls = ['1S', 'P', '2N', 'P', '3S', 'P', '4N', 'P'];
  const hand = 'KQJ84.A2.K73.K52';
  assert.equal(bidWith(HOUSE, hand, calls).call, '5S', 'RKCB 1430: 2 key cards (♥A, ♠K) with the queen');
  assert.equal(bidWith(bw, hand, calls).call, '5D', 'Blackwood: 1 ace');
  assert.equal(meaningWith(bw, [...calls, '5D']).meaning, '1 ace.');
  assert.match(meaningWith(bw, ['1S', 'P', '2N', 'P', '3S', 'P', '4N']).meaning, /^Blackwood/);
  assert.match(meaningWith(bw, ['1S', 'P', '2N', 'P', '3S', 'P', '4N', '5C', 'X']).meaning, /0 aces \(DOPI\)/);
  assert.equal(bidWith(bw, 'A9752.K3.AQ4.A63', ['1S', 'P', '2N', 'P', '3S', 'P', '4N', 'P', '5D', 'P'], { dealer: 'S' }).call, '6S', '3 + 1 aces: one missing');
});

test('natural defence to their 1NT: double is penalty, a long suit overcalls', () => {
  const nat = card('2/1', { 'nt-defence': 'natural' });
  assert.equal(bidWith(nat, 'AQ3.KJ4.AQ52.K94', ['1N'], { dealer: 'E' }).call, 'X');
  assert.match(meaningWith(nat, ['1N', 'X'], { dealer: 'E' }).meaning, /^Penalty/);
  assert.match(meaningWith(HOUSE, ['1N', 'X'], { dealer: 'E' }).meaning, /^DONT/);
  assert.equal(bidWith(nat, 'KQJ854.83.A62.94', ['1N'], { dealer: 'E' }).call, '2S');
});

test('no checkback: an invitational hand bids 2NT naturally, and opener accepts with 14', () => {
  const nat = card('2/1', { checkback: 'none' });
  const calls = ['1D', 'P', '1S', 'P', '1N', 'P'];
  const h = 'KJ84.Q93.K4.Q942';
  assert.equal(bidWith(HOUSE, h, calls).call, '2C', 'XYZ relay');
  assert.equal(bidWith(nat, h, calls).call, '2N');
  assert.match(meaningWith(nat, [...calls, '2N']).meaning, /^Natural: 11–12/);
  assert.match(meaningWith(HOUSE, [...calls, '2N']).meaning, /^Puppet/);
  assert.equal(bidWith(nat, 'A3.K84.AQ852.J73', [...calls, '2N', 'P'], { dealer: 'S' }).call, '3N');
});

test('fourth suit forcing one round: the same bid, worded as forcing one round', () => {
  const r = card('2/1', { 'fourth-suit': 'round' });
  const calls = ['1D', 'P', '1S', 'P', '2C', 'P', '2H'];
  assert.match(meaningWith(r, calls).meaning, /forcing one round/);
  assert.match(meaningWith(HOUSE, calls).meaning, /game forcing/);
});

test('support doubles off: three-card support passes with a minimum; a double shows 16+', () => {
  const off = card('2/1', { 'support-doubles': 'off' });
  const calls = ['1D', 'P', '1S', '2C'];
  assert.equal(bidWith(HOUSE, 'Q84.K3.AQ842.J73', calls, { dealer: 'S' }).call, 'X', 'support double');
  assert.equal(bidWith(off, 'Q84.K3.AQ842.J73', calls, { dealer: 'S' }).call, 'P');
  assert.match(meaningWith(off, [...calls, 'X'], { dealer: 'S' }).meaning, /extra values \(16\+\)/);
  assert.equal(bidWith(off, 'K4.AQ3.AKJ84.Q73', calls, { dealer: 'S' }).call, '2N', 'balanced 18–19 with a club stopper: 2NT, as on the house card');
});

test('RKCB 0314: 5♣ shows 0 or 3 key cards', () => {
  const k = card('2/1', { keycard: 'rkcb-0314' });
  const calls = ['1S', 'P', '2N', 'P', '3S', 'P', '4N', 'P'];
  const hand = 'KQJ84.A2.K73.A52';
  assert.equal(bidWith(HOUSE, hand, calls).call, '5D', '1430: 3 key cards');
  assert.equal(bidWith(k, hand, calls).call, '5C', '0314: 3 key cards');
  assert.equal(meaningWith(k, [...calls, '5C']).meaning, '0 or 3 key cards.');
  assert.match(meaningWith(k, ['1S', 'P', '2N', 'P', '3S', 'P', '4N']).meaning, /RKCB 0314/);
});

test('Bergen raises: 3♣ = 7–9 and 3♦ = 10–12 with four trumps', () => {
  const b = card('2/1', { 'major-raise': 'bergen' });
  assert.equal(bidWith(b, 'K872.432.Q97.K84', ['1S', 'P']).call, '3C');
  assert.equal(bidWith(b, 'K872.432.A97.K84', ['1S', 'P']).call, '3D');
  assert.match(meaningWith(b, ['1S', 'P', '3C']).meaning, /^Bergen: 4\+ spades, 7–9/);
  assert.match(meaningWith(HOUSE, ['1S', 'P', '3C']).meaning, /^Weak jump shift/);
  assert.equal(bidWith(b, 'AQJ95.K4.KJ5.A73', ['1S', 'P', '3D', 'P'], { dealer: 'S' }).call, '4S');
});

test('four-suit transfers: 2♠ shows clubs, 2NT diamonds; the 2NT invite goes through Stayman', () => {
  const f = card('2/1', { 'nt-2s': 'four-suit' });
  assert.equal(bidWith(f, '84.73.T942.QJ9843'.split('.').slice(0, 4).join('.'), ['1N', 'P']).call, '2S');
  assert.equal(bidWith(f, '84.73.QJ9843.942', ['1N', 'P']).call, '2N');
  assert.match(meaningWith(f, ['1N', 'P', '2N']).meaning, /^Transfer to diamonds/);
  assert.equal(bidWith(f, 'K84.Q73.K942.J84', ['1N', 'P']).call, '2C', 'balanced 9: Stayman, then 2NT');
  assert.equal(bidWith(f, '84.73.QJ9843.942', ['1N', 'P', '2N', 'P', '3D', 'P']).call, 'P');
});

test('New Minor Forcing: 1♣–1♠–1NT–2♦ with five spades and 12', () => {
  const n = card('2/1', { checkback: 'nmf' });
  const calls = ['1C', 'P', '1S', 'P', '1N', 'P'];
  assert.equal(bidWith(n, 'KQ984.A73.Q4.J84', calls).call, '2D');
  assert.match(meaningWith(n, [...calls, '2D']).meaning, /^New minor forcing/);
  assert.equal(bidWith(n, 'J73.K84.Q4.AQJ84', [...calls, '2D', 'P'], { dealer: 'S' }).call, '2S', '3 spades, minimum');
});

test('Landy: 2♣ shows both majors; Cappelletti: 2♦ both majors, 2♣ one long suit', () => {
  const l = card('2/1', { 'nt-defence': 'landy' });
  const c = card('2/1', { 'nt-defence': 'cappelletti' });
  const majors = 'KJ984.QJ73.4.K84';
  assert.equal(bidWith(l, majors, ['1N'], { dealer: 'E' }).call, '2C');
  assert.equal(bidWith(c, majors, ['1N'], { dealer: 'E' }).call, '2D');
  assert.match(meaningWith(l, ['1N', '2C'], { dealer: 'E' }).meaning, /^Landy: both majors/);
  assert.equal(bidWith(c, '84.7.KQJ9842.K84', ['1N'], { dealer: 'E' }).call, '2C');
  assert.equal(bidWith(c, '84.7.KQJ9842.K84', ['1N', '2C', 'P', '2D', 'P'], { dealer: 'E' }).call, 'P', 'my suit is diamonds');
});
