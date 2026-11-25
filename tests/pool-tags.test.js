import { test } from 'node:test';
import assert from 'node:assert/strict';
import ALL from '../js/system/index.js';
import { isTag } from '../js/pool/tags.js';

// Written down from `node tools/tags.mjs` after review (2026-11-15). A change here means a rule moved
// between the core and an option: run the audit and check it was meant.
const COUNTS = {
  'base:2/1': 410,
  'checkback:xyz': 453,
  core: 4448, // 2026-11-25: +22 plain passes (lead-directing, Lightner); -6 '4M after a transfer' (mild slam interest: Texas only)
  'fourth-suit:gf': 151,
  'jump-shift:weak': 51,
  'keycard:rkcb-1430': 34,
  'minor-2nt:invite': 10,
  'minor-raise:inverted': 45,
  'nt-2s:puppet': 10,
  'nt-defence:dont': 82,
  'nt-interference:lebensohl': 153,
  'passed-2c:drury': 11,
  'passed-jump:fit': 6,
  'responsive:on': 32,
  'slam-doubles:lead': 26,
  'smolen:on': 14,
  'splinters:on': 29,
  'support-doubles:on': 472,
  'texas:on': 22,
  'weak-two-ask:ogust': 44,
  'weak-two-defence:leaping': 12,
};

test('every rule has a valid tag (null = core)', () => {
  for (const e of ALL) assert.ok(isTag(e.opt), `${JSON.stringify(e.after)} ${e.call}: ${e.opt}`);
});

test('rules per option are as reviewed', () => {
  const c = {};
  for (const e of ALL) c[e.opt ?? 'core'] = (c[e.opt ?? 'core'] ?? 0) + 1;
  assert.deepEqual(c, COUNTS);
});

const find = (after, call, ctx = undefined, extra = () => true) => {
  const hits = ALL.filter((e) => !e.tail && JSON.stringify(e.after) === JSON.stringify(after) && e.call === call
    && (ctx === undefined || JSON.stringify(e.ctx ?? {}) === JSON.stringify(ctx)) && extra(e));
  assert.equal(hits.length, 1, `${after.join(' ')} ${call} ${JSON.stringify(ctx)}: ${hits.length} rules`);
  return hits[0].opt;
};

test('spot checks', () => {
  assert.equal(find(['1M'], '2C', { responderPassed: true }), 'passed-2c:drury');
  assert.equal(find(['1M'], '2C', { responderPassed: false }), 'base:2/1');
  assert.equal(find(['1M'], '1N', { responderPassed: false }), 'base:2/1');
  assert.equal(find(['1M'], '1N', { responderPassed: true }), null, 'a passed hand\'s 1NT is natural in both systems');
  assert.equal(find(['(1N)'], '2H'), 'nt-defence:dont');
  assert.equal(find(['1N'], '2C'), null, 'Stayman is core');
  assert.equal(find(['1N'], '4C'), null, 'Gerber is core');
  assert.equal(find(['1N'], '4D'), 'texas:on');
  assert.equal(find(['1N'], '2S'), 'nt-2s:puppet');
  assert.equal(find(['1M'], '2N'), null, 'Jacoby 2NT is core');
  assert.equal(find(['1M'], '4C'), 'splinters:on');
  assert.equal(find(['1m'], '2N'), 'minor-2nt:invite');
  assert.equal(find(['1m'], '3m'), 'minor-raise:inverted');
  assert.equal(find(['1H'], '2S', {}), 'jump-shift:weak');
  assert.equal(find(['1H'], '2S', { responderPassed: true }), 'passed-jump:fit');
  assert.equal(find(['1M'], '3M'), null, 'the limit raise is core until SAYC gets its own (phase 5)');
  const tail = (after, call) => ALL.find((e) => e.tail && JSON.stringify(e.after) === JSON.stringify(after) && e.call === call).opt;
  assert.equal(tail(['4N'], '5C'), 'keycard:rkcb-1430');
  assert.equal(tail(['4C'], '4D'), null, 'Gerber replies are core');
});

test('their takeout double of a weak two stays core; only the Lebensohl replies to it are tagged', () => {
  for (const e of ALL) {
    if (e.after.length === 1 && /^\(2[DHS]\)$/.test(e.after[0]) && e.call === 'X') assert.equal(e.opt, null);
  }
});
