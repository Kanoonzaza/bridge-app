import { test } from 'node:test';
import assert from 'node:assert/strict';
import ALL from '../js/system/index.js';

test('rules table loads as an array', () => {
  assert.ok(Array.isArray(ALL));
});
