import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../js/cards.js';
import { advise, explain, nextOptions } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';

const ask = (hand, seat = 1) => advise(parseHand(hand), buildAuction({ opener: 'me', seat, ourCalls: [] }));

const CASES = [
  ['AQ852 K73 Q4 J62', 1, '1S', '12 HCP, 5 spades'],
  ['KQT83 AJ974 5 84', 1, '1S', 'Rule of 20, 5-5 opens the higher'],
  ['KJ4 Q83 AT52 Q73', 1, '1D', '4 diamonds, no 5-card major'],
  ['KJ4 Q83 AT Q7532', 1, '1C', 'longest suit clubs'],
  ['AQ74 KJ83 Q72 J4', 1, '1D', '4-4-3-2 exception opens 1D with three'],
  ['KQT74 5 AQ8742 3', 1, '1D', '6-5: open the longer suit'],
  ['AK KJ862 Q74 K93', 1, '1N', '16 balanced with a 5-card major'],
  ['AK5 KQ4 AJ73 K82', 1, '2N', '20 balanced'],
  ['AKQT73 AK4 A5 K2', 1, '2C', '23 HCP'],
  ['84 73 52 AKQJ852', 1, '3N', 'gambling: solid 7-card minor'],
  ['KQJ953 74 K82 63', 1, '2S', 'weak two'],
  ['5 KQJ9852 83 742', 1, '3H', '7-card preempt'],
  ['KQJ98762 5 832 4', 1, '4S', '8-card preempt'],
  ['J83 Q74 K852 963', 1, 'P', '6 HCP'],
  ['Q842 KQT953 J4 7', 1, 'P', 'weak two blocked by a 4-card side major'],
  ['Q842 KQT953 J4 7', 3, '2H', '3rd seat allows the side major'],
  ['KQ94 A82 Q73 952', 4, '1C', 'Rule of 15 = 15'],
  ['K94 A82 Q73 Q952', 4, 'P', 'Rule of 15 = 14'],
  ['KQJ953 74 K82 63', 4, '1S', '9 HCP + 6 spades = 15'],
  ['3 AQ962 AKQ76 K5', 1, '1H', '18 HCP but no 6-card major: not 2C'],
  ['KQ83 KQ7654 AK 2', 1, '1H', '17 HCP'],
  ['Q842 - AKJT42 AKQ', 1, '1D', '19 HCP 6-card minor: not 2C'],
  ['KQ83 AKQ2 - AQ984', 1, '1C', '20 HCP, longest suit clubs'],
  ['AKQ9842 K - AK542', 1, '2C', '19 HCP, strong 7-card major, about 9 tricks'],
  ['- AKQ875 AT74 J54', 4, '1H', '14 HCP always opens in 4th seat'],
  ['KQJ9852 A4 73 82', 1, '3S', '10 HCP preempt'],
  ['96 AQT9876 A2 97', 1, '3H', '10 HCP preempt'],
  ['JT87652 5 832 74', 1, 'P', 'suit too weak to preempt'],
  ['JT9843 J54 AKJ 2', 1, 'P', 'poor 6-card suit: no weak two, short of the Rule of 20'],
  ['A62 JT7642 T53 8', 1, 'P', 'poor 6-card suit'],
  ['KQ9853 4 J8642 5', 1, 'P', '5-card side suit blocks the weak two'],
  ['QJ2 QJ 2 AKQ6543', 1, '1C', '15 HCP is too strong for gambling 3NT'],
  ['J52 9865 - AQJ762', 1, 'P', '6 clubs: no weak 2C'],
];

for (const [hand, seat, want, why] of CASES) {
  test(`${hand} in seat ${seat} opens ${want} (${why})`, () => {
    assert.equal(ask(hand, seat).call, want);
  });
}

test('1NT with a 5-card major carries a close-call note', () => {
  assert.match(ask('AK KJ862 Q74 K93').close, /5-card major/);
});

test('exactly 20 on the Rule of 20 is flagged as light', () => {
  assert.match(ask('KQT83 AJ974 5 84').close, /Rule of 20/);
});

test('Rule of 15 pass explains itself', () => {
  const r = ask('K94 A82 Q73 Q952', 4);
  assert.match(r.reasons.join(' '), /Rule of 15/);
  assert.match(r.close, /Rule of 15/);
});

test('reasons mention the HCP and the suit', () => {
  const r = ask('AQ852 K73 Q4 J62');
  assert.ok(r.reasons.includes('12 HCP'));
  assert.ok(r.reasons.some((x) => /5-card spades/.test(x)));
  assert.equal(r.notes, 'opening-bids-tier-0');
});

test('decoder explains openings', () => {
  const rows = explain({ dealer: 'N', calls: ['1N'] });
  assert.match(rows[0].meaning, /15–17/);
  const opts = nextOptions({ dealer: 'S', calls: [] }).map((o) => o.call);
  assert.ok(opts.includes('P') && opts.includes('2C') && opts.includes('3N') && opts.includes('4S'));
});

test('JT9843 J54 AKJ 2 never opens a weak two', () => {
  assert.notEqual(ask('JT9843 J54 AKJ 2').call, '2S');
});

test('a 5-card side suit rules out a weak two in 1st seat', () => {
  const r = ask('KQ9853 4 J8642 5');
  assert.notEqual(r.call, '2S');
  assert.match(r.reasons.join(' '), /5-card side suit/);
});

test('trick-based 2C explains the suit and losers', () => {
  const r = ask('AKQ9842 K - AK542');
  assert.match(r.reasons.join(' '), /strong 7-card spades suit and only \d losers/);
});

test('4th seat 14 HCP gives the always-open reason', () => {
  assert.match(ask('- AKQ875 AT74 J54', 4).reasons.join(' '), /14\+ HCP: always open in 4th seat/);
});

test('preempts and gambling and pass carry the right notes anchors', () => {
  assert.equal(ask('AK5 KQ4 AJ73 K82').notes, '1nt-opening-and-responses-tier-0');
  assert.equal(ask('AK KJ862 Q74 K93').notes, '1nt-opening-and-responses-tier-0');
  assert.equal(ask('84 73 52 AKQJ852').notes, '1nt-opening-and-responses-tier-0');
  assert.equal(ask('AKQT73 AK4 A5 K2').notes, 'strong-2-opening-tier-2');
  assert.equal(ask('KQJ953 74 K82 63').notes, 'weak-twos-and-ogust-tier-0');
  assert.equal(ask('5 KQJ9852 83 742').notes, 'preempts-tier-0');
  assert.equal(ask('J83 Q74 K852 963').notes, 'opening-bids-tier-0');
});

test('pass reasons name the actual blocker', () => {
  assert.match(ask('J52 9865 - AQJ762').reasons.join(' '), /no weak 2♣/);
  assert.match(ask('Q842 KQT953 J4 7').reasons.join(' '), /side major/);
  assert.match(ask('J83 Q74 K852 963').reasons.join(' '), /not enough to open/);
  assert.match(ask('JT87652 5 832 74').reasons.join(' '), /too weak to preempt/);
  assert.match(ask('3 QJ9732 98 8642').reasons.join(' '), /too weak even for a weak two/);
  assert.match(ask('K2 83 T9753 7642', 4).reasons.join(' '), /not enough to open/);
});
