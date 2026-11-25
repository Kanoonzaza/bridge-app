// A pair card: the base system, the answers that differ from that base's preset, free text, and the
// answers the pair marked "to discuss". Plain data, safe to store and send.
//   { v: 1, name, base: 'sayc' | '2/1', picks: { slotId: optionId }, discuss: [slotId], text: { groupId: '…' }, code? }
import { SLOTS, GROUPS, slot, option } from './catalog.js';

// Same alphabet as table codes (js/table/model.js); not imported, because the table model will import this file.
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/;

export const BASES = ['sayc', '2/1'];
export const NAME_MAX = 40;
export const TEXT_MAX = 500;

// What each base answers before the pair changes anything. SAYC: the first option of every slot.
// 2/1: our own system, the one the rules were written for (the "house card").
const first = Object.fromEntries(SLOTS.map((s) => [s.id, s.options[0].id]));
export const PRESETS = {
  sayc: { ...first, base: 'sayc' },
  '2/1': {
    ...first,
    base: '2/1',
    'jump-shift': 'weak',
    splinters: 'on',
    'passed-2c': 'drury',
    'passed-jump': 'fit',
    'major-raise': 'limit',
    'minor-raise': 'inverted',
    'minor-2nt': 'invite',
    smolen: 'on',
    texas: 'on',
    'nt-2s': 'puppet',
    'nt-interference': 'lebensohl',
    'weak-two-ask': 'ogust',
    checkback: 'xyz',
    'fourth-suit': 'gf',
    keycard: 'rkcb-1430',
    'nt-defence': 'dont',
    'support-doubles': 'on',
    responsive: 'on',
    'weak-two-defence': 'leaping',
    'slam-doubles': 'lead',
  },
};

export const HOUSE_CARD = Object.freeze({ v: 1, name: 'House convention card', base: '2/1', picks: {}, discuss: [], text: {} });

const str = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');

// Whatever storage or a link returns becomes a well-formed card: unknown slots and options are dropped,
// and answers equal to the base's preset are removed so `picks` holds only the differences.
export function normalizeCard(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const base = BASES.includes(r.base) ? r.base : 'sayc';
  const picks = {};
  for (const [k, v] of Object.entries(r.picks && typeof r.picks === 'object' ? r.picks : {})) {
    if (k === 'base' || !option(k, v) || PRESETS[base][k] === v) continue;
    picks[k] = v;
  }
  const discuss = Array.isArray(r.discuss) ? [...new Set(r.discuss.filter((k) => typeof k === 'string' && slot(k)))] : [];
  const groups = new Set(GROUPS.map(([g]) => g));
  const text = {};
  for (const [k, v] of Object.entries(r.text && typeof r.text === 'object' ? r.text : {})) {
    const t = str(v, TEXT_MAX);
    if (groups.has(k) && t) text[k] = t;
  }
  return {
    v: 1,
    name: str(r.name, NAME_MAX),
    base,
    picks,
    discuss,
    text,
    ...(typeof r.code === 'string' && CODE.test(r.code) ? { code: r.code } : {}),
  };
}

// Every slot answered: the base preset, then the card's own picks.
export const resolve = (card) => ({ ...PRESETS[card.base] ?? PRESETS.sayc, ...card.picks, base: card.base });

// Cards that bid alike have equal keys. Name, text, discuss and the text-only slots do not count.
export const cardKey = (card) => {
  const r = resolve(card);
  return `${card.base}|${SLOTS.filter((s) => !s.text && s.id !== 'base').map((s) => r[s.id]).join(',')}`;
};

// Set one answer. An answer equal to the preset is removed.
export function pick(card, slotId, optId) {
  if (slotId === 'base') return rebase(card, optId);
  if (!option(slotId, optId)) return card;
  const picks = { ...card.picks };
  if (PRESETS[card.base][slotId] === optId) delete picks[slotId];
  else picks[slotId] = optId;
  return { ...card, picks };
}

// Change the base system and keep every answer the pair chose themselves (every slot exists in both bases).
export function rebase(card, base) {
  if (!BASES.includes(base) || base === card.base) return card;
  const own = { ...resolve(card) };
  const kept = Object.fromEntries(Object.keys(card.picks).map((k) => [k, own[k]]));
  return normalizeCard({ ...card, base, picks: kept });
}

// Small form for a table: { b, p, n, d? }.
export const pack = (card) => ({ b: card.base, p: { ...card.picks }, n: card.name, ...(card.discuss.length ? { d: [...card.discuss] } : {}) });
export const unpack = (x) => normalizeCard({ base: x?.b, picks: x?.p, name: x?.n, discuss: x?.d });

// Is a rule tag on this card? (null = core, always; 'base:x' = the base; 'slot:option' = that answer.)
export function optActive(card, opt) {
  if (!opt) return true;
  if (opt.startsWith('base:')) return opt === `base:${card.base}`;
  const i = opt.indexOf(':');
  return resolve(card)[opt.slice(0, i)] === opt.slice(i + 1);
}

// The answers on this card whose rules are not written yet: [{ slot, option }] (text slots excluded).
export function unready(card) {
  const r = resolve(card);
  return SLOTS.filter((s) => !s.text && !option(s.id, r[s.id])?.ready).map((s) => ({ slot: s.id, option: r[s.id] }));
}

// The card the robots can bid: every answer whose rules are not written yet is played as on the house card
// (and an unready base as 2/1), so a pair can write down what they really play before the app knows all of it.
export function playable(card) {
  if (!unready(card).length) return card;
  const r = resolve(card);
  const base = option('base', card.base)?.ready ? card.base : '2/1';
  const picks = {};
  for (const s of SLOTS) {
    if (s.id === 'base') continue;
    picks[s.id] = s.text || option(s.id, r[s.id])?.ready ? r[s.id] : PRESETS['2/1'][s.id];
  }
  return normalizeCard({ ...card, base, picks });
}

// The cards a board is played with, stored packed as { NS?, EW? } (a side left out plays the house card).
export const sideCards = (packed) => ({
  NS: packed?.NS ? unpack(packed.NS) : HOUSE_CARD,
  EW: packed?.EW ? unpack(packed.EW) : HOUSE_CARD,
});
