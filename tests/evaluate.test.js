import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, evaluate, losingTricks, ruleOf20, ruleOf15, adjustedHcp, dummyPoints, quality } from '../js/cards.js';

const ev = (t) => evaluate(parseHand(t));

test('HCP, lengths, pattern and shape', () => {
  const e = ev('KJ852 83 Q4 J953');
  assert.equal(e.hcp, 7);
  assert.deepEqual(e.len, { S: 5, H: 2, D: 2, C: 4 });
  assert.deepEqual(e.pattern, [5, 4, 2, 2]);
  assert.equal(e.shape, 'semi');
  assert.equal(ev('K5 AJ73 KQ84 J62').shape, 'balanced');
  assert.equal(ev('AK KJ862 Q74 K93').balanced, true);
  assert.equal(ev('5 AQ74 AKJ83 K62').shape, 'unbalanced');
});

test('good suit means 2 of the top 3 honors', () => {
  const e = ev('KQJ953 74 K82 63');
  assert.equal(e.good.S, true);
  assert.equal(e.good.D, false);
});

test('losing trick count', () => {
  assert.equal(losingTricks(parseHand('AKQT73 AK4 A5 K2')), 3);
  assert.equal(losingTricks(parseHand('AK5 KQ4 AJ73 K82')), 6);
});

test('Rule of 20 and Rule of 15', () => {
  assert.equal(ruleOf20(ev('KQT83 AJ974 5 84')), 20);
  assert.equal(ruleOf15(ev('KQ94 A82 Q73 952')), 15);
});

test('short honors lose value', () => {
  assert.equal(adjustedHcp(ev('KT63 Q A8752 J94')), 8);
  assert.equal(adjustedHcp(ev('QT63 K A8752 J94')), 9);
  assert.equal(adjustedHcp(ev('KT63 A Q8752 J94')), 10);
  assert.equal(adjustedHcp(ev('Q4 QJ5 QJ73 KJ62')), 11);
});

test('dummy points add shortness outside trumps', () => {
  assert.equal(dummyPoints(ev('5 KT74 A9653 Q72'), 'H'), 12);
  assert.equal(dummyPoints(ev('K83 QT7 A965 742'), 'H'), 9);
  assert.equal(dummyPoints(ev('KT63 Q A8752 J94'), 'S'), 11);
  assert.equal(dummyPoints(ev('QT63 K A8752 J94'), 'S'), 12);
  assert.equal(dummyPoints(ev('KT63 A Q8752 J94'), 'S'), 13);
});

test('hand quality: good 12 versus bad 12', () => {
  assert.equal(quality(ev('Q4 A5 KQJT63 974')).good, true);
  assert.equal(quality(ev('Q4 QJ5 QJ73 KJ62')).good, false);
  assert.equal(quality(ev('K73 A84 A962 J74'), { fit: true }).good, true);
});
