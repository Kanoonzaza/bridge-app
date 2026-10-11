import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../js/cards.js';
import { explain, summarize, describeShown, nextOptions, advise, matchingEntries } from '../js/engine.js';

const FIX = [
  { after: [], ctx: { role: 'opening' }, call: '1S', meaning: '5+ spades', shows: { hcp: [12, 21], len: { S: [5, 13] } },
    pick: (e) => e.hcp >= 12 && e.len.S >= 5, why: (e) => [`${e.hcp} HCP`], priority: 20, notes: 'a' },
  { after: [], ctx: { role: 'opening' }, call: 'P', meaning: 'No opening', shows: { hcp: [0, 11] },
    pick: () => true, priority: 99, notes: 'a' },
  { after: ['1M'], call: '2M', meaning: 'Raise of {M}', shows: { hcp: [6, 10], len: { M: [3, 13] }, force: 'none' },
    pick: (e, st) => e.len[st.bind.M] >= 3, priority: 10, notes: 'b' },
];

test('explain gives each call its meaning, with suits filled in', () => {
  const rows = explain({ dealer: 'N', calls: ['1S', 'P', '2S', 'P'] }, FIX);
  assert.equal(rows[0].seat, 'N');
  assert.equal(rows[0].meaning, '5+ spades');
  assert.equal(rows[2].meaning, 'Raise of ♠');
  assert.deepEqual(rows[2].shows.len, { S: [3, 13] });
  assert.equal(rows[1].meaning, null);
});

test('summarize intersects what a player has shown', () => {
  const rows = explain({ dealer: 'N', calls: ['1S', 'P', '2S', 'P'] }, FIX);
  const acc = summarize(rows, 'N');
  assert.deepEqual(acc.hcp, [12, 21]);
  assert.deepEqual(acc.len.S, [5, 13]);
  assert.deepEqual(describeShown(acc), ['12–21 HCP', '5+♠']);
  assert.deepEqual(describeShown(summarize(rows, 'E')), []);
});

test('describeShown wording', () => {
  const acc = { known: true, hcp: [22, 37], len: { S: [0, 13], H: [4, 4], D: [5, 13], C: [0, 13] }, balanced: true, force: 'game' };
  assert.deepEqual(describeShown(acc), ['22+ HCP', '4♥', '5+♦', 'Balanced', 'Game forcing']);
});

test('nextOptions lists defined calls in bidding order', () => {
  const opts = nextOptions({ dealer: 'S', calls: [] }, FIX);
  assert.deepEqual(opts.map((o) => o.call), ['P', '1S']);
  assert.equal(opts[1].meaning, '5+ spades');
});

test('advise picks the first matching entry by priority', () => {
  const hand = parseHand('K83 Q742 J5 9863');
  const r = advise(hand, { dealer: 'N', calls: ['1S', 'P'] }, FIX);
  assert.equal(r.call, '2S');
  assert.equal(r.meaning, 'Raise of ♠');
  assert.equal(r.notes, 'b');
  const o = advise(parseHand('AKJ74 K5 AJ3 Q62'), { dealer: 'S', calls: [] }, FIX);
  assert.equal(o.call, '1S');
  assert.deepEqual(o.reasons, ['18 HCP']);
});

test('advise reports situations it does not cover', () => {
  const r = advise(parseHand('K83 Q742 J5 9863'), { dealer: 'N', calls: ['1D', 'P'] }, FIX);
  assert.equal(r.notCovered, true);
  assert.deepEqual(r.options, []);
});

test('matchingEntries lists every entry whose pick accepts the hand', () => {
  const m = matchingEntries(parseHand('AKJ74 K5 AJ3 Q62'), { dealer: 'S', calls: [] }, FIX);
  assert.deepEqual(m.map((x) => x.call).sort(), ['1S', 'P']);
});

test('advise falls back to a pickable generic entry; explain keeps decoder text', () => {
  const entries = [
    { after: ['1H'], call: '2H', meaning: 'decoder text' },
    { after: ['1M'], call: '2M', meaning: 'raise', pick: () => true, priority: 1, notes: 'n' },
  ];
  const auction = { dealer: 'N', calls: ['1H', 'P'] };
  const r = advise(parseHand('K83 Q742 J5 9863'), auction, entries);
  assert.equal(r.call, '2H');
  assert.equal(r.meaning, 'raise');
  assert.equal(explain({ dealer: 'N', calls: ['1H', 'P', '2H'] }, entries)[2].meaning, 'decoder text');
  assert.equal(nextOptions(auction, entries).find((o) => o.call === '2H').meaning, 'decoder text');
});

test('advise treats a missing priority as 50', () => {
  const entries = [
    { after: [], call: '1C', meaning: 'late', pick: () => true, priority: 60 },
    { after: [], call: '1D', meaning: 'default', pick: () => true },
    { after: [], call: '1H', meaning: 'early', pick: () => false, priority: 10 },
  ];
  assert.equal(advise(parseHand('K83 Q742 J5 9863'), { dealer: 'S', calls: [] }, entries).call, '1D');
});

test('describeShown omits untouched HCP and reports conflicts', () => {
  const full = { S: [0, 13], H: [0, 13], D: [0, 13], C: [0, 13] };
  assert.deepEqual(describeShown({ known: true, hcp: [0, 37], len: { ...full, S: [5, 13] }, balanced: false, force: 'none' }), ['5+♠']);
  assert.deepEqual(describeShown({ known: true, hcp: [15, 10], len: full, balanced: false, force: 'none' }), ['Conflicting HCP']);
  assert.deepEqual(describeShown({ known: true, hcp: [12, 21], len: { ...full, S: [6, 4] }, balanced: false, force: 'none' }), ['12–21 HCP', 'Conflicting ♠ length']);
});
