import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPattern, resolveCall, fill, candidates } from '../js/engine.js';

test('exact pattern matches only the same key', () => {
  assert.deepEqual(matchPattern(['1S', '2C'], ['1S', '2C']), {});
  assert.equal(matchPattern(['1S', '2C'], ['1S', '2D']), null);
  assert.equal(matchPattern(['1S'], ['1S', '2C']), null);
  assert.deepEqual(matchPattern([], []), {});
});

test('M binds once to a major', () => {
  assert.deepEqual(matchPattern(['1M', '2M'], ['1H', '2H']), { M: 'H' });
  assert.equal(matchPattern(['1M', '2M'], ['1H', '2S']), null);
  assert.equal(matchPattern(['1M'], ['1D']), null);
});

test('O is the other major, n the other minor', () => {
  assert.deepEqual(matchPattern(['1M', '2O'], ['1H', '2S']), { M: 'H' });
  assert.equal(matchPattern(['1M', '2O'], ['1H', '2H']), null);
  assert.deepEqual(matchPattern(['1m', '1n'], ['1C', '1D']), { m: 'C' });
});

test('bracketed tokens only match opponents calls', () => {
  assert.deepEqual(matchPattern(['1M', '(2x)'], ['1S', '(2C)']), { M: 'S', x: 'C' });
  assert.equal(matchPattern(['1M', '(2x)'], ['1S', '2C']), null);
  assert.deepEqual(matchPattern(['1S', '(X)'], ['1S', '(X)']), {});
});

test('resolveCall and fill substitute bound suits', () => {
  assert.equal(resolveCall('2M', { M: 'S' }), '2S');
  assert.equal(resolveCall('2O', { M: 'S' }), '2H');
  assert.equal(resolveCall('3n', { m: 'D' }), '3C');
  assert.equal(resolveCall('P', {}), 'P');
  assert.equal(fill('Raise of {M}, other major {O}', { M: 'H' }), 'Raise of ♥, other major ♠');
});

test('candidates keeps the most specific entry per call and checks ctx', () => {
  const entries = [
    { after: ['1M'], call: '2M', meaning: 'generic raise' },
    { after: ['1S'], call: '2S', meaning: 'spade raise' },
    { after: ['1M'], call: '2N', meaning: 'Jacoby', ctx: { responderPassed: false } },
  ];
  const sit = { key: ['1S'], ctx: { responderPassed: true } };
  assert.deepEqual(candidates(sit, entries).map((c) => [c.call, c.entry.meaning]), [['2S', 'spade raise']]);
});

test('candidates prefers literal over M over x regardless of list order', () => {
  const a = { after: ['1M', '2M'], call: '3M', meaning: 'M-specific' };
  const b = { after: ['1M', '2x'], call: '3M', meaning: 'x-generic' };
  const sit = { key: ['1H', '2H'], ctx: {} };
  assert.equal(candidates(sit, [a, b])[0].entry.meaning, 'M-specific');
  assert.equal(candidates(sit, [b, a])[0].entry.meaning, 'M-specific');
  const lit = { after: ['1H', '2H'], call: '3H', meaning: 'literal' };
  assert.equal(candidates(sit, [a, lit])[0].entry.meaning, 'literal');
  assert.equal(candidates(sit, [lit, a])[0].entry.meaning, 'literal');
});

test('candidates breaks ties by number of ctx keys', () => {
  const plain = { after: ['1S'], call: '2S', meaning: 'plain' };
  const withCtx = { after: ['1S'], call: '2S', meaning: 'ctx', ctx: { responderPassed: false } };
  const sit = { key: ['1S'], ctx: { responderPassed: false } };
  assert.equal(candidates(sit, [plain, withCtx])[0].entry.meaning, 'ctx');
  assert.equal(candidates(sit, [withCtx, plain])[0].entry.meaning, 'ctx');
});

test('candidates onlyPickable skips entries without pick before choosing', () => {
  const dec = { after: ['1H'], call: '2H', meaning: 'decoder text' };
  const gen = { after: ['1M'], call: '2M', meaning: 'raise', pick: () => true, priority: 1 };
  const sit = { key: ['1H'], ctx: {} };
  assert.equal(candidates(sit, [dec, gen])[0].entry.meaning, 'decoder text');
  assert.equal(candidates(sit, [dec, gen], true)[0].entry.meaning, 'raise');
});

test('tail entries match the end of the auction and lose to exact patterns', async () => {
  const { candidates } = await import('../js/engine.js');
  const entries = [
    { tail: true, after: ['4N'], call: '5C', meaning: 'tail', when: (key) => key.length >= 3 },
    { after: ['1S', '2N', '4N'], call: '5C', meaning: 'exact' },
  ];
  const at = (key) => candidates({ key, ctx: {} }, entries).map((c) => c.entry.meaning);
  assert.deepEqual(at(['1H', '3H', '4N']), ['tail']);
  assert.deepEqual(at(['1S', '2N', '4N']), ['exact']);
  assert.deepEqual(at(['1N', '4N']), []);
});
