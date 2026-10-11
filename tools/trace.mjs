// Re-bids one quality example and prints each call with its source and reasons.
// Usage: node tools/trace.mjs <dealer> "<N hand>" "<E hand>" "<S hand>" "<W hand>"
import { parseHand, evaluate } from '../js/cards.js';
import { advise } from '../js/engine.js';
import { addCall, isComplete, nextSeat } from '../js/auction.js';

const [dealer, ...hs] = process.argv.slice(2);
const hands = Object.fromEntries(['N', 'E', 'S', 'W'].map((s, i) => [s, parseHand(hs[i])]));
let a = { dealer, calls: [] };
while (!isComplete(a) && a.calls.length < 60) {
  const s = nextSeat(a);
  const r = advise(hands[s], a);
  const call = r.notCovered ? 'P' : r.call;
  console.log(s, String(evaluate(hands[s]).hcp).padStart(2), call.padEnd(3), r.fallback ? `[${r.fallback}]` : '', r.notCovered ? 'NOT COVERED' : `${r.meaning} | ${r.reasons.join('; ')}`);
  a = addCall(a, call);
}
