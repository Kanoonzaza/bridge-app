import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryCards, normalizeShared, isMember, isFull } from '../js/pool/sync.js';
import { normalizeCard } from '../js/pool/card.js';

const card = (name, extra = {}) => normalizeCard({ base: 'sayc', name, ...extra });

test('create, join, edit: two partners, nobody else', async () => {
  let t = 1000;
  const hub = memoryCards(() => t);
  const me = hub('me');
  const pard = hub('pard');
  const stranger = hub('stranger');
  assert.equal(await me.create('K7M2QX', card('Noon & Pim')), true);
  assert.equal(await stranger.create('K7M2QX', card('Mine now')), false, 'a code cannot be taken over');
  assert.equal(await pard.save('K7M2QX', card('Hacked')), false, 'only members edit');
  assert.equal(await pard.join('K7M2QX'), true);
  assert.equal(await pard.join('K7M2QX'), false, 'already a member');
  assert.equal(await stranger.join('K7M2QX'), false, 'two partners at most');
  t = 2000;
  assert.equal(await pard.save('K7M2QX', card('Noon & Pim', { picks: { keycard: 'rkcb-1430' } })), true);
  const s = await me.load('K7M2QX');
  assert.equal(s.card.name, 'Noon & Pim');
  assert.equal(s.card.picks.keycard, 'rkcb-1430');
  assert.equal(s.card.updated, 2000);
  assert.ok(isMember(s, 'me') && isMember(s, 'pard') && !isMember(s, 'stranger'));
  assert.equal(isFull(s), true);
  assert.equal(await me.load('NOPE22'), null);
});

test('a watching partner sees the other\'s edit', async () => {
  const hub = memoryCards(() => 5);
  const me = hub('me');
  const pard = hub('pard');
  await me.create('ABCDEF', card('A'));
  await pard.join('ABCDEF');
  const seen = [];
  pard.watch('ABCDEF', (x) => seen.push(x?.card.name));
  await me.save('ABCDEF', card('B'));
  assert.deepEqual(seen, ['A', 'B']);
});

test('what the database returns is normalized', () => {
  assert.equal(normalizeShared(null), null);
  assert.equal(normalizeShared({ members: { a: true } }), null);
  const s = normalizeShared({ card: { base: '2/1', name: 'X', discuss: { 0: 'keycard' }, updated: '7' }, members: { a: true, b: true, c: true, d: 'no' } });
  assert.deepEqual(s.card.discuss, ['keycard']);
  assert.equal(s.card.updated, 7);
  assert.deepEqual(s.members, ['a', 'b']);
});
