import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCards, saveCard, removeCard, setActive, activeCard, MAX_CARDS } from '../js/pool/cards-store.js';
import { HOUSE_CARD } from '../js/pool/card.js';

// The same contract as js/store.js, in memory.
function memStore(init = {}) {
  const data = { ...init };
  return {
    data,
    load: (k, fallback) => (data[k] ? { ...fallback, ...JSON.parse(data[k]) } : fallback),
    save: (k, v) => { data[k] = JSON.stringify(v); },
  };
}

test('an empty or broken store gives no cards and the house card', () => {
  for (const s of [memStore(), memStore({ cards: JSON.stringify({ list: 'x', active: 9 }) })]) {
    assert.deepEqual(loadCards(s), { list: [], active: null });
    assert.equal(activeCard(s), HOUSE_CARD);
  }
});

test('save, use, replace and remove cards', () => {
  const s = memStore();
  const a = saveCard(s, { base: 'sayc', name: 'A' });
  const b = saveCard(s, { base: '2/1', name: 'B' });
  assert.deepEqual([a, b], [0, 1]);
  setActive(s, b);
  assert.equal(activeCard(s).name, 'B');
  saveCard(s, { base: '2/1', name: 'B2' }, b);
  assert.equal(activeCard(s).name, 'B2');
  removeCard(s, a);
  assert.equal(activeCard(s).name, 'B2', 'the active card moves down with the list');
  removeCard(s, 0);
  assert.equal(activeCard(s), HOUSE_CARD, 'removing the active card falls back to the house card');
  setActive(s, 5);
  assert.equal(loadCards(s).active, null);
});

test('the list is limited', () => {
  const s = memStore();
  for (let i = 0; i < MAX_CARDS; i++) assert.equal(saveCard(s, { name: `C${i}` }), i);
  assert.equal(saveCard(s, { name: 'one too many' }), null);
  assert.equal(loadCards(s).list.length, MAX_CARDS);
});
