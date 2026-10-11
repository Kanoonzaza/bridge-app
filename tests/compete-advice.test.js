import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, randomHand } from '../js/cards.js';
import { advise, matchingEntries } from '../js/engine.js';
import { situationAt } from '../js/auction.js';
import { SAMPLES } from '../js/system/compete-advice.js';
import { mulberry32 } from './helpers.js';

const ask = (dealer, calls, hand) => advise(parseHand(hand), { dealer, calls });

const CASES = [
  // We opened, they overcalled (examples from the notes)
  ['N', ['1H', '2C'], 'A73 K962 QJ4 652', '3C', 'cue-bid: good heart raise'],
  ['N', ['1H', '2C'], '73 K9862 Q84 652', '3H', 'weak with 5 trumps: preemptive raise'],
  ['N', ['1D', '1S'], '84 KJ73 Q962 J53', 'X', 'negative double: 4 hearts'],
  ['N', ['1C', '1H'], 'KJ74 83 Q962 J53', 'X', 'negative double: exactly 4 spades'],
  ['N', ['1C', '1H'], 'KJ742 83 Q96 J53', '1S', '1♠ shows 5+ after a 1♥ overcall'],
  ['N', ['1C', '1D'], 'KJ74 Q983 962 J5', 'X', 'both majors'],
  ['N', ['1H', '1S'], 'K4 83 QJ962 AJ53', '2D', '5+ diamonds and 10+: natural, forcing'],
  ['N', ['1H', 'X'], '84 KJ73 A962 Q53', '2N', 'Jordan 2NT'],
  ['S', ['P', 'P', '1S', 'X'], 'KJ5 Q842 A73 965', '2C', 'Drury after the double'],
  ['N', ['1S', 'X'], 'A84 K7 QJ962 K53', 'XX', '10+ without a fit'],
  // Opener's continuations
  ['S', ['1D', 'P', '1H', '1S'], '84 K73 AQ953 K62', 'X', 'support double'],
  ['S', ['1D', 'P', '1H', '1S'], '84 K973 AQ953 K6', '2H', '4-card support: raise'],
  ['S', ['1D', '1S', 'X', 'P'], '84 KJ73 AQ95 K62', '2H', 'opener shows the hearts'],
  // Our 1NT, they overcalled
  ['N', ['1N', '2H'], 'KQ74 83 A962 K53', '3H', 'cue-bid without a heart stopper: Stayman, fast denies'],
  ['N', ['1N', '2H'], 'K4 A83 Q962 K953', '2N', 'stopper: go slowly'],
  ['N', ['1N', '2H'], 'KJ742 83 962 953', '2S', 'weak spades: to play'],
  // They opened
  ['E', ['1C'], 'KQJ74 83 A962 53', '1S', '1-level overcall'],
  ['E', ['1H'], 'AK74 3 KJ62 Q953', 'X', 'takeout double'],
  ['E', ['1H'], 'AQ4 K93 KJ62 Q95', '1N', '1NT overcall: 15–18 with a stopper'],
  ['E', ['1D'], 'KJ974 AQ863 5 84', '2D', 'Michaels: both majors'],
  ['E', ['1S'], '4 KQ974 5 AJ863', '2S', 'Michaels: hearts and a minor'],
  ['E', ['1H'], 'KQJ863 4 J72 853', '2S', 'weak jump overcall'],
  ['E', ['1N'], 'KQT74 AJ863 5 84', '2H', 'DONT: both majors'],
  ['E', ['1N'], '4 KQJT73 A84 953', 'X', 'DONT: one long suit'],
  ['E', ['1N'], 'KQ84 5 63 AJT862', '2C', 'DONT: clubs and a higher suit'],
  ['W', ['1C', '1H', 'P'], 'K84 Q963 AJ2 854', '2C', 'advancing: cue-bid raise'],
  ['W', ['1C', '1H', 'P'], 'K84 Q963 972 854', '2H', 'advancing: simple raise'],
  ['W', ['1H', 'X', 'P'], 'K84 63 Q9762 854', '2D', 'advancing a takeout double: cheapest suit'],
  ['W', ['1H', 'X', 'P'], 'KQ84 63 A972 854', '2S', 'advancing: jump with 9–11'],
  ['W', ['2H', 'X', 'P'], '8432 63 Q972 854', '2S', 'weak: bid the 2-level suit'],
  ['W', ['2H', 'X', 'P'], '84 63 Q9762 J854', '2N', 'weak with a minor: Lebensohl relay'],
];

for (const [dealer, calls, hand, want, why] of CASES) {
  test(`${calls.join(' ')} (dealer ${dealer}): ${hand} → ${want} (${why})`, () => {
    assert.equal(ask(dealer, calls, hand).call, want);
  });
}

test('every contested situation answers every hand with exactly one call', () => {
  const rng = mulberry32(53);
  for (const s of SAMPLES) {
    const auction = { dealer: s.dealer, calls: s.calls };
    const key = situationAt(auction, s.calls.length).key;
    assert.deepEqual(key, s.after, `sample ${s.dealer} ${s.calls}`);
    for (let i = 0; i < 40; i++) {
      const hand = randomHand(rng);
      const r = advise(hand, auction);
      assert.ok(!r.notCovered, `${s.after} (${s.calls}): not covered for ${JSON.stringify(hand)}`);
      assert.equal(matchingEntries(hand, auction).length, 1, `${s.after}: matches for ${JSON.stringify(hand)}`);
    }
  }
});
