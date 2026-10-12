// Where does the Advisor fall back to general judgment, and which of those calls look wrong?
// Bids random deals, groups every fallback call by situation, and flags suspicious ones:
//   strong-pass: passes with 17+ HCP while the auction is still low (below 3NT) and partner has not placed it;
//   short-pass:  passes with 15+, at most one card in the suit they just bid, at the 2-level;
//   long-pass:   passes with 12+ and an unbid 6-card suit, they just bid at the 2-level.
// Usage: node tools/fallbacks.mjs [deals] [seed] [top]
import { advise } from '../js/engine.js';
import { evaluate, formatHand } from '../js/cards.js';
import { SEATS, addCall, isComplete, nextSeat, situationAt, sideOf, isBid, bidRank } from '../js/auction.js';
import { deal } from './coverage.mjs';

let a = Number(process.argv[3] ?? 5) >>> 0;
const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const n = Number(process.argv[2] ?? 3000);
const top = Number(process.argv[4] ?? 30);

export function suspicious(hand, auction, call) {
  if (call !== 'P') return null;
  const e = evaluate(hand);
  const me = nextSeat(auction);
  const bids = auction.calls.map((c, i) => [c, SEATS[(SEATS.indexOf(auction.dealer) + i) % 4]]).filter(([c]) => isBid(c));
  if (!bids.length) return null;
  const [last, by] = bids.at(-1);
  const theyBid = sideOf(by) !== sideOf(me);
  if (!theyBid) return null;
  const theirSuits = new Set(bids.filter(([, s]) => sideOf(s) !== sideOf(me)).map(([c]) => c[1]));
  const ourSuits = new Set(bids.filter(([, s]) => sideOf(s) === sideOf(me)).map(([c]) => c[1]));
  if (e.hcp >= 17 && bidRank(last) < bidRank('3N')) return 'strong-pass';
  if (e.hcp >= 15 && last[0] === '2' && last[1] !== 'N' && e.len[last[1]] <= 1) return 'short-pass';
  if (e.hcp >= 12 && last[0] === '2' && ['S', 'H', 'D', 'C'].some((s) => !theirSuits.has(s) && !ourSuits.has(s) && e.len[s] >= 6)) return 'long-pass';
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const groups = new Map();
  let calls = 0;
  let fallbacks = 0;
  for (let i = 0; i < n; i++) {
    const hands = deal(r);
    let auc = { dealer: SEATS[i % 4], calls: [] };
    for (let g = 0; g < 60 && !isComplete(auc); g++) {
      const seat = nextSeat(auc);
      const res = advise(hands[seat], auc);
      const call = res.notCovered ? 'P' : res.call;
      calls++;
      if (res.fallback) {
        fallbacks++;
        const s = situationAt(auc, auc.calls.length);
        const key = s.key.join(' ');
        const flag = suspicious(hands[seat], auc, call);
        const grp = groups.get(key) ?? { n: 0, flags: 0, kinds: new Map(), examples: [] };
        grp.n++;
        grp.kinds.set(`${res.fallback}:${call}`, (grp.kinds.get(`${res.fallback}:${call}`) ?? 0) + 1);
        if (flag) {
          grp.flags++;
          if (grp.examples.length < 2) grp.examples.push(`${flag} ${formatHand(hands[seat])} (${evaluate(hands[seat]).hcp})`);
        }
        groups.set(key, grp);
      }
      auc = addCall(auc, call);
    }
  }
  console.log(`${n} deals: ${fallbacks}/${calls} calls from a fallback (${((100 * fallbacks) / calls).toFixed(1)}%)`);
  const flagged = [...groups.values()].reduce((x, g) => x + g.flags, 0);
  console.log(`suspicious: ${flagged}`);
  console.log('\nMost frequent fallback situations:');
  for (const [k, g] of [...groups].sort((x, y) => y[1].n - x[1].n).slice(0, top)) {
    console.log(`${String(g.n).padStart(4)} ${k.padEnd(28)} ${[...g.kinds].map(([c, m]) => `${c}×${m}`).join(' ')}`);
  }
  console.log('\nMost suspicious:');
  for (const [k, g] of [...groups].filter(([, g]) => g.flags).sort((x, y) => y[1].flags - x[1].flags).slice(0, top)) {
    console.log(`${String(g.flags).padStart(4)}/${g.n} ${k}\n       ${g.examples.join('\n       ')}`);
  }
}
