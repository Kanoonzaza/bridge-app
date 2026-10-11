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
  ['KQJ953 74 K82 63', 4, 'P', 'never preempt in 4th seat'],
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
