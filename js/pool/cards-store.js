// The convention cards kept on this device, and the one in use. Stored under bc:cards as
// { list: [card, ...], active: index | null }; null means the house card (our own system).
import { normalizeCard, HOUSE_CARD } from './card.js';

export const MAX_CARDS = 12;
const KEY = 'cards';

export function loadCards(store) {
  const raw = store.load(KEY, { list: [], active: null });
  const list = (Array.isArray(raw.list) ? raw.list : []).slice(0, MAX_CARDS).map(normalizeCard);
  const active = Number.isInteger(raw.active) && raw.active >= 0 && raw.active < list.length ? raw.active : null;
  return { list, active };
}

// Every change is announced (event bc:cards) so other tabs can follow the card in use.
const write = (store, state) => {
  store.save(KEY, state);
  globalThis.dispatchEvent?.(new Event('bc:cards'));
};

// Save a card: replaces card i, or adds it when i is null. Returns the card's index, or null when the list is full.
export function saveCard(store, card, i = null) {
  const s = loadCards(store);
  const c = normalizeCard(card);
  if (i !== null && i >= 0 && i < s.list.length) s.list[i] = c;
  else if (s.list.length >= MAX_CARDS) return null;
  else i = s.list.push(c) - 1;
  write(store, s);
  return i;
}

export function removeCard(store, i) {
  const s = loadCards(store);
  if (i < 0 || i >= s.list.length) return;
  s.list.splice(i, 1);
  if (s.active === i) s.active = null;
  else if (s.active !== null && s.active > i) s.active--;
  write(store, s);
}

// i = null: the house card.
export function setActive(store, i) {
  const s = loadCards(store);
  s.active = Number.isInteger(i) && i >= 0 && i < s.list.length ? i : null;
  write(store, s);
}

export function activeCard(store) {
  const s = loadCards(store);
  return s.active === null ? HOUSE_CARD : s.list[s.active];
}
