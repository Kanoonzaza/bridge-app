import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, nextOptions } from '../js/engine.js';

const last = (dealer, calls) => explain({ dealer, calls }).at(-1).meaning ?? '';

const CASES = [
  ['W', ['1C', '1H', 'P', '2C'], /Cue-bid: 10\+ with hearts support/, 'advancing an overcall: cue-bid raise'],
  ['W', ['1C', '1H', 'P', '2H'], /Raise: 6–9/, 'advancing an overcall: simple raise'],
  ['N', ['1H', '2C', '3C'], /limit raise or better in hearts/, 'cue-bid raise after their overcall'],
  ['N', ['1H', '2C', '3H'], /Preemptive jump raise/, 'jump raise is preemptive'],
  ['N', ['1D', '1S', 'X'], /4\+ hearts/, '1♦–(1♠)–X'],
  ['N', ['1C', '1H', 'X'], /exactly 4 spades/, '1♣–(1♥)–X'],
  ['N', ['1C', '1D', 'X'], /both majors/, '1♣–(1♦)–X'],
  ['N', ['1H', '1S', 'X'], /both minors/, '1♥–(1♠)–X'],
  ['N', ['1D', '1S', 'X', 'P', '2H'], /4 hearts, minimum/, 'opener answers the negative double'],
  ['N', ['1D', '1S', 'X', 'P', '3H'], /15–17/, 'opener jumps with extras'],
  ['N', ['1D', '1S', 'X', 'P', 'P'], /Penalty pass/, 'opener converts for penalty'],
  ['N', ['1D', '1S', '2D'], /inverted minors are off/, 'minor raise in competition is weak'],
  ['N', ['1H', 'X', '2N'], /Jordan/, 'Jordan 2NT'],
  ['S', ['P', 'P', '1S', 'X', '2C'], /Drury/, 'Drury still on after a double'],
  ['N', ['1H', 'X', '2C'], /weak, not forcing/, '2-level new suit after their double is weak'],
  ['N', ['1D', 'P', '1H', '1S', 'X'], /Support double: exactly 3 hearts/, 'support double'],
  ['N', ['1D', 'P', '1H', 'X', 'XX'], /Support redouble/, 'support redouble'],
  ['W', ['1N', '2H'], /hearts and spades/, 'DONT 2♥'],
  ['W', ['1N', 'X'], /one long suit/, 'DONT double'],
  ['W', ['1N', 'X', 'P', '2C'], /Relay/, 'advancing the DONT double'],
  ['N', ['1N', '2H', '2N'], /Lebensohl relay/, 'Lebensohl after our 1NT'],
  ['N', ['1N', '2H', '3H'], /no hearts stopper/, 'fast cue denies a stopper'],
  ['N', ['1N', '2H', '2N', 'P', '3C', 'P', '3N'], /with a hearts stopper/, 'slow 3NT shows a stopper'],
  ['W', ['2H', 'X', 'P', '2N'], /Lebensohl: weak/, 'advancing a double of a weak two'],
  ['W', ['2H', 'X', 'P', '3C'], /8–11/, 'direct 3-level advance is constructive'],
  ['W', ['1H', '2H'], /Michaels: 5\+ spades and a 5\+ minor/, 'Michaels over a major'],
  ['W', ['1C', '2C'], /5-5 in the majors/, 'Michaels over a minor'],
  ['W', ['1C', '2N'], /diamonds and hearts/, 'Unusual 2NT over 1♣'],
  ['W', ['1H', '2S'], /Weak jump overcall/, 'jump overcall'],
  ['W', ['1H', 'P', 'P', '1N'], /Balancing 1NT: 11–14/, 'balancing 1NT'],
  ['W', ['1H', 'X', 'P', '2S'], /9–11, invitational/, 'jump advance of a takeout double'],
  ['N', ['1H', 'P', '2N', 'P', '3C', 'P', '4N', 'X', 'XX'], /0 or 3 key cards/, 'RKCB after their double'],
  ['N', ['2C', '2S', 'P'], /Weak \(0–3\)/, 'interference over 2♣'],
];

for (const [dealer, calls, re, why] of CASES) {
  test(`${calls.join(' ')} (dealer ${dealer}): ${why}`, () => {
    assert.match(last(dealer, calls), re);
  });
}

test('the decoder lists our options after an overcall', () => {
  const opts = nextOptions({ dealer: 'N', calls: ['1H', '2C'] }).map((o) => o.call);
  for (const c of ['X', '2H', '3C', '3H']) assert.ok(opts.includes(c), c);
});
