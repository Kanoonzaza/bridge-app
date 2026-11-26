// Helpers for the tests of the pool's options: bid a hand with a card exactly as written (ready or not).
import { advise, explain } from '../js/engine.js';
import { unpackHand } from '../js/table/model.js';
import { normalizeCard, pick } from '../js/pool/card.js';
import { rulesFor } from '../js/pool/system.js';

// card('2/1', { 'passed-2c': 'natural' }) or card('sayc')
export function card(base = '2/1', picks = {}) {
  let c = normalizeCard({ base, name: `${base} ${JSON.stringify(picks)}` });
  for (const [s, o] of Object.entries(picks)) c = pick(c, s, o);
  return c;
}

// The Advisor's answer for a hand ('AKQ2.K32.Q32.J32' = spades.hearts.diamonds.clubs) after the calls so far.
// Dealer is North; the hand belongs to whoever is next.
export function bidWith(c, hand, calls, { dealer = 'N', vul = 'none' } = {}) {
  return advise(unpackHand(hand), { dealer, vul, calls }, rulesFor(c));
}
// The meaning a card gives the last call of an auction (dealer North).
export function meaningWith(c, calls, { dealer = 'N', vul = 'none' } = {}) {
  return explain({ dealer, vul, calls }, rulesFor(c), { general: true }).at(-1);
}
