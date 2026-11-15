import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS } from '../js/pool/catalog.js';
import { PRESETS, HOUSE_CARD, normalizeCard, resolve, cardKey, pick, rebase, pack, unpack } from '../js/pool/card.js';

test('presets answer every slot with a real option', () => {
  for (const base of ['sayc', '2/1']) {
    for (const s of SLOTS) assert.ok(s.options.some((o) => o.id === PRESETS[base][s.id]), `${base} ${s.id}`);
  }
  assert.equal(PRESETS.sayc['passed-2c'], 'natural');
  assert.equal(PRESETS['2/1']['passed-2c'], 'drury');
});

test('the house preset uses only options whose rules exist', () => {
  for (const s of SLOTS) assert.ok(s.options.find((o) => o.id === PRESETS['2/1'][s.id]).ready, s.id);
});

test('normalizeCard turns anything into a well-formed card', () => {
  for (const raw of [null, 7, 'x', [], { base: 'acol', picks: 'no', discuss: {}, text: [] }]) {
    const c = normalizeCard(raw);
    assert.equal(c.base, 'sayc');
    assert.deepEqual(c.picks, {});
    assert.deepEqual(c.discuss, []);
    assert.deepEqual(c.text, {});
    assert.equal(c.name, '');
  }
});

test('normalizeCard drops unknown and preset-equal picks, long text and bad codes', () => {
  const c = normalizeCard({
    base: '2/1',
    name: 'x'.repeat(99),
    picks: { 'passed-2c': 'drury', 'nt-defence': 'landy', nope: 'x', keycard: 'nope' },
    discuss: ['keycard', 'keycard', 'nope'],
    text: { slam: ` ${'y'.repeat(900)} `, nope: 'z', majors: '   ' },
    code: 'bad',
  });
  assert.deepEqual(c.picks, { 'nt-defence': 'landy' });
  assert.deepEqual(c.discuss, ['keycard']);
  assert.equal(c.name.length, 40);
  assert.equal(c.text.slam.length, 500);
  assert.deepEqual(Object.keys(c.text), ['slam']);
  assert.equal('code' in c, false);
  assert.equal(normalizeCard({ code: 'K7M2QX' }).code, 'K7M2QX');
});

test('pick keeps only differences from the preset', () => {
  let c = normalizeCard({ base: 'sayc' });
  c = pick(c, 'passed-2c', 'drury');
  assert.deepEqual(c.picks, { 'passed-2c': 'drury' });
  c = pick(c, 'passed-2c', 'natural');
  assert.deepEqual(c.picks, {});
  assert.equal(pick(c, 'passed-2c', 'nope'), c);
});

test('rebase keeps the pair\'s own answers', () => {
  const c = pick(normalizeCard({ base: 'sayc', name: 'A' }), 'nt-defence', 'dont');
  const d = rebase(c, '2/1');
  assert.equal(d.base, '2/1');
  assert.equal(resolve(d)['nt-defence'], 'dont');
  assert.deepEqual(d.picks, {}, 'DONT is the 2/1 default, so no difference is left');
  assert.equal(resolve(d)['passed-2c'], 'drury', 'other answers follow the new base');
  const e = rebase(pick(normalizeCard({ base: '2/1' }), 'keycard', 'blackwood'), 'sayc');
  assert.equal(resolve(e).keycard, 'blackwood');
  assert.equal(resolve(e)['passed-2c'], 'natural');
});

test('pack and unpack keep what matters for bidding', () => {
  const c = pick(pick(normalizeCard({ base: '2/1', name: 'Noon & Pim', discuss: ['keycard'] }), 'keycard', 'rkcb-0314'), 'leads', 'ka');
  const back = unpack(JSON.parse(JSON.stringify(pack(c))));
  assert.equal(cardKey(back), cardKey(c));
  assert.equal(back.name, 'Noon & Pim');
  assert.deepEqual(back.discuss, ['keycard']);
  assert.equal(unpack(undefined).base, 'sayc');
});

test('cardKey ignores name, text, discuss and the defence text slots', () => {
  const a = normalizeCard({ base: '2/1' });
  const b = normalizeCard({ base: '2/1', name: 'B', text: { slam: 'x' }, discuss: ['keycard'], picks: { leads: 'ka' } });
  assert.equal(cardKey(a), cardKey(b));
  assert.equal(cardKey(HOUSE_CARD), cardKey(a));
  assert.notEqual(cardKey(a), cardKey(normalizeCard({ base: 'sayc' })));
  assert.notEqual(cardKey(a), cardKey(pick(a, 'smolen', 'off')));
});
