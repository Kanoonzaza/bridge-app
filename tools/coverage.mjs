// Bids random deals with all four players using the Advisor and reports the situations it does not cover.
// Usage: node tools/coverage.mjs [deals] [seed]
import { SUITS, RANKS } from '../js/cards.js';
import { advise } from '../js/engine.js';
import { SEATS, addCall, isComplete, nextSeat, situationAt } from '../js/auction.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deal(r) {
  const deck = SUITS.flatMap((s) => [...RANKS].map((k) => [s, k]));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = {};
  SEATS.forEach((seat, n) => {
    const h = { S: '', H: '', D: '', C: '' };
    for (const [s, k] of deck.slice(n * 13, n * 13 + 13)) h[s] += k;
    for (const s of SUITS) h[s] = [...h[s]].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b)).join('');
    hands[seat] = h;
  });
  return hands;
}

export function bidDeal(hands, dealer) {
  let a = { dealer, calls: [] };
  const gaps = [];
  for (let guard = 0; guard < 60 && !isComplete(a); guard++) {
    const seat = nextSeat(a);
    const r = advise(hands[seat], a);
    if (r.notCovered) {
      gaps.push(situationAt(a, a.calls.length).key.join(' '));
      a = addCall(a, 'P');
    } else {
      a = addCall(a, r.call);
    }
  }
  return { auction: a, gaps };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 2000);
  const r = rng(Number(process.argv[3] ?? 1));
  const count = new Map();
  let withGap = 0;
  for (let i = 0; i < n; i++) {
    const { gaps } = bidDeal(deal(r), SEATS[i % 4]);
    if (gaps.length) withGap++;
    for (const g of gaps) count.set(g, (count.get(g) ?? 0) + 1);
  }
  console.log(`${n} deals, ${withGap} reach an uncovered situation (${((100 * withGap) / n).toFixed(1)}%)`);
  for (const [k, v] of [...count].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[4] ?? 40))) console.log(String(v).padStart(5), k);
}
