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
