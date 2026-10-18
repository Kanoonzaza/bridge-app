// Which situations does the Advisor answer by general judgment (or the general pass) instead of a rule?
// Bids random deals with the Advisor on every seat and counts, per situation (their calls in brackets), the decisions
// that no rule answered. These are the calls the table robots hand to the simulation, so the commonest ones are the
// rules worth writing first.
// Usage: node tools/gaps.mjs [deals=4000] [seed=1] [top=40]
import { advise } from '../js/engine.js';
import { SEATS, addCall, isComplete, nextSeat, situationAt } from '../js/auction.js';
import { deal } from './coverage.mjs';

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

export function gaps(deals, seed) {
  const r = rng(seed);
  const VULS = ['none', 'NS', 'EW', 'both'];
  const rows = new Map();
  let decisions = 0;
  let judged = 0;
  for (let i = 0; i < deals; i++) {
    const hands = deal(r);
    let a = { dealer: SEATS[i % 4], vul: VULS[i % 4], calls: [] };
    for (let g = 0; g < 60 && !isComplete(a); g++) {
      const seat = nextSeat(a);
      const res = advise(hands[seat], a);
      const call = res.notCovered ? 'P' : res.call;
      decisions++;
      if (res.fallback === 'judgment' || res.notCovered) {
        judged++;
        const key = situationAt(a, a.calls.length).key.join(' ') || '(opening)';
        const row = rows.get(key) ?? { n: 0, calls: {}, example: { dealer: a.dealer, vul: a.vul, calls: a.calls.join(' ') } };
        row.n++;
        row.calls[call] = (row.calls[call] ?? 0) + 1;
        rows.set(key, row);
      }
      a = addCall(a, call);
    }
  }
  return { rows, decisions, judged };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , d = '4000', s = '1', top = '40'] = process.argv;
  const { rows, decisions, judged } = gaps(Number(d), Number(s));
  console.log(`${d} deals, ${decisions} decisions, ${judged} by general judgment (${((100 * judged) / decisions).toFixed(1)}%).`);
  const sorted = [...rows.entries()].sort((a, b) => b[1].n - a[1].n);
  console.log(`${sorted.length} different situations. The commonest:`);
  if (process.env.EXAMPLES) console.log(JSON.stringify(sorted.slice(0, Number(top)).map(([key, v]) => ({ key, n: v.n, ...v.example, calls_made: v.calls }))));
  else for (const [key, v] of sorted.slice(0, Number(top))) console.log(`${String(v.n).padStart(5)}  ${key}   → ${Object.entries(v.calls).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c}×${n}`).join(' ')}`);
}
