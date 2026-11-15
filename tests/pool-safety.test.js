// The safety net for the convention pool: every card that can be built from options whose rules exist
// (the presets, and each single change from them) must bid as consistently as the house card.
// Cards with an option that is not ready are skipped, so each new option joins this test by itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, option } from '../js/pool/catalog.js';
import { PRESETS, BASES, HOUSE_CARD, normalizeCard, pick, resolve, cardKey } from '../js/pool/card.js';
import { systemFor } from '../js/pool/system.js';
import { advise, leaks } from '../js/engine.js';
import { selfcheck } from '../tools/selfcheck.mjs';
import { deal } from '../tools/coverage.mjs';
import { addCall, isComplete, nextSeat, SEATS } from '../js/auction.js';
import { mulberry32 } from './helpers.js';

const ready = (card) => Object.entries(resolve(card)).every(([s, o]) => option(s, o)?.ready);

export function cardsToCheck() {
  const out = new Map([[cardKey(HOUSE_CARD), HOUSE_CARD]]);
  for (const base of BASES) {
    const preset = normalizeCard({ base, name: base });
    if (ready(preset) && !out.has(cardKey(preset))) out.set(cardKey(preset), preset);
    for (const s of SLOTS) {
      if (s.text) continue;
      for (const o of s.options) {
        if (o.id === PRESETS[base][s.id]) continue;
        const c = pick(preset, s.id, o.id);
        if (ready(c) && !out.has(cardKey(c))) out.set(cardKey(c), { ...c, name: `${base}+${s.id}=${o.id}` });
      }
    }
  }
  return [...out.values()];
}

const DEALS = 150;
const house = selfcheck(DEALS, 31);
const rate = (r) => r.issues.length / Math.max(1, r.calls);

for (const card of cardsToCheck()) {
  test(`card "${card.name}": no more inconsistencies than the house card`, () => {
    const r = selfcheck(DEALS, 31, systemFor(card));
    assert.ok(rate(r) <= rate(house) * 1.25 + 0.002, `${card.name}: ${r.issues.length} issues in ${r.calls} calls (house ${house.issues.length} in ${house.calls})\n${r.issues.slice(0, 5).map((x) => x.text).join('\n')}`);
  });

  test(`card "${card.name}": no decision picks a call the card does not play`, () => {
    const book = systemFor(card);
    const rng = mulberry32(5);
    const found = [];
    for (let i = 0; i < DEALS; i++) {
      const hands = deal(rng);
      let a = { dealer: SEATS[i % 4], vul: 'none', calls: [] };
      for (let g = 0; g < 60 && !isComplete(a); g++) {
        const h = hands[nextSeat(a)];
        for (const l of leaks(h, a, book)) found.push(`${a.calls.join(' ') || '(opening)'} → ${l.call} [${l.opt}]`);
        const r = advise(h, a, book);
        a = addCall(a, r.notCovered ? 'P' : r.call);
      }
    }
    assert.deepEqual(found.slice(0, 10), [], `${found.length} leaks`);
  });
}

test('the list of cards to check includes the house card and grows with ready options', () => {
  const cards = cardsToCheck();
  assert.equal(cardKey(cards[0]), cardKey(HOUSE_CARD));
  for (const c of cards) assert.ok(ready(c), c.name);
});
