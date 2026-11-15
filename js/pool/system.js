// The rules a card plays, and the card's answers for decision functions that mix several conventions.
//   systemFor(card) -> rule list: the core plus the options the card picked. The house card's list is ALL itself.
//   sysOf(list)     -> { base, is(slot, option), get(slot), discuss(slot), active(opt) } for that list.
//   book            -> one rule list, or { NS, EW } with one list per side (two pairs on different cards).
import ALL from '../system/index.js';
import { resolve, cardKey, HOUSE_CARD, playable } from './card.js';
import { splitOpt } from './catalog.js';

function makeSys(card) {
  const picks = resolve(card);
  const discuss = new Set(card.discuss ?? []);
  return {
    base: card.base,
    is: (slotId, optId) => picks[slotId] === optId,
    get: (slotId) => picks[slotId],
    discuss: (slotId) => discuss.has(slotId),
    active(opt) {
      if (!opt) return true;
      if (opt.startsWith('base:')) return opt === `base:${card.base}`;
      const [s, o] = splitOpt(opt);
      return picks[s] === o;
    },
  };
}

export const HOUSE = makeSys(HOUSE_CARD);

const SYS = new WeakMap();     // rule list -> sys
const LISTS = new Map();       // cardKey + discuss -> rule list
SYS.set(ALL, HOUSE);

const keyOf = (card) => `${cardKey(card)}|${[...(card.discuss ?? [])].sort().join(',')}`;
const houseKey = cardKey(HOUSE_CARD);

// The rules exactly as the card says, ready or not (for tests and tools; the app uses systemFor).
// The same card always gets the same array back, so the engine indexes it once.
export function rulesFor(card) {
  if (cardKey(card) === houseKey && !(card.discuss ?? []).length) return ALL;
  const key = keyOf(card);
  let list = LISTS.get(key);
  if (!list) {
    const sys = makeSys(card);
    list = ALL.filter((e) => sys.active(e.opt));
    SYS.set(list, sys);
    LISTS.set(key, list);
  }
  return list;
}

// The rules the app bids a card with: answers whose rules are not written yet are played as on the house card
// (playable, js/pool/card.js).
export const systemFor = (card = HOUSE_CARD) => rulesFor(playable(card));

export const sysOf = (entries) => SYS.get(entries) ?? HOUSE;
// A list made by systemFor (not a hand-made list from a test): the engine's fallback runs only for these.
export const isSystem = (entries) => SYS.has(entries);
export const isBook = (x) => Array.isArray(x) || (x && Array.isArray(x.NS) && Array.isArray(x.EW));
export const forSeat = (book, seat) => (Array.isArray(book) ? book : book[seat === 'N' || seat === 'S' ? 'NS' : 'EW']);
export const forSide = (book, side) => (Array.isArray(book) ? book : book[side]);
export const bookFor = (cards = {}) => ({ NS: systemFor(cards.NS ?? HOUSE_CARD), EW: systemFor(cards.EW ?? HOUSE_CARD) });
