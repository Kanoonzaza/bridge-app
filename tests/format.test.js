import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callLabel, rankLabel } from '../js/format.js';

test('call labels', () => {
  assert.equal(callLabel('1S'), '1♠');
  assert.equal(callLabel('2D'), '2♦');
  assert.equal(callLabel('3N'), '3NT');
  assert.equal(callLabel('P'), 'Pass');
  assert.equal(callLabel('X'), 'Dbl');
  assert.equal(callLabel('XX'), 'Rdbl');
});

test('rank labels', () => {
  assert.equal(rankLabel('T'), '10');
  assert.equal(rankLabel('A'), 'A');
});
