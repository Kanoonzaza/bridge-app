// Self-consistency: every call the Advisor makes must fit the meaning the app itself gives that call
// (strength, suit lengths, balance, stoppers), and a forcing bid by partner must not be passed.
// Usage: node tools/selfcheck.mjs [deals] [seed] [examples]
import { advise, explain } from '../js/engine.js';
import { misfit } from '../js/table/review.js';
import { SEATS, addCall, isComplete, nextSeat, partnerOf, isBid } from '../js/auction.js';
import { deal } from './coverage.mjs';
import { packHand } from '../js/table/model.js';

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

const VUL = ['none', 'NS', 'EW', 'both'];

// Bids n random deals with the Advisor at all four seats and lists every inconsistency.
export function selfcheck(n = 2000, seed = 77) {
  const r = rng(seed);
  const out = { deals: n, calls: 0, bids: 0, dealsWithIssue: 0, issues: [] };
  for (let i = 0; i < n; i++) {
    const hands = deal(r);
    let auc = { dealer: SEATS[i % 4], vul: VUL[i % 4], calls: [] };
    let issue = false;
    for (let g = 0; g < 60 && !isComplete(auc); g++) {
      const seat = nextSeat(auc);
      const res = advise(hands[seat], auc);
      const c = res.notCovered ? 'P' : res.call;
      out.calls++;
      const next = addCall(auc, c);
      const rows = explain(next, undefined, { general: true });
      const row = rows.at(-1);
      const src = res.fallback ? `general:${res.fallback}` : 'rule';
      const where = auc.calls.join(' ') || '(opening)';
      if (c !== 'P') {
        out.bids++;
        const m = misfit(hands[seat], row);
        if (m.length) {
          issue = true;
          out.issues.push({ kind: 'misfit', src, hand: packHand(hands[seat]), text: `${where} → ${c} [${src}] "${row.meaning}" — ${m.join('; ')}` });
        }
      } else if (auc.calls.at(-1) === 'P') {
        // Partner's last call was forcing and the opponent passed: we must not pass.
        const pl = rows.slice(0, -1).reverse().find((x) => x.call !== 'P');
        if (pl && pl.seat === partnerOf(seat) && isBid(pl.call) && (pl.shows?.force === 'round' || pl.shows?.force === 'game')) {
          issue = true;
          out.issues.push({ kind: 'forcingPassed', src, hand: packHand(hands[seat]), text: `${where} → Pass [${src}] over partner's forcing ${pl.call} ("${pl.meaning}")` });
        }
      }
      auc = next;
    }
    if (issue) out.dealsWithIssue++;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 2000);
  const res = selfcheck(n, Number(process.argv[3] ?? 77));
  const shown = Number(process.argv[4] ?? 30);
  const by = (k) => Object.fromEntries([...res.issues.reduce((m, x) => m.set(x[k], (m.get(x[k]) ?? 0) + 1), new Map())]);
  console.log(`${res.deals} deals, ${res.calls} calls (${res.bids} bids)`);
  console.log(`deals with at least one inconsistency: ${res.dealsWithIssue} (${((100 * res.dealsWithIssue) / res.deals).toFixed(1)}%)`);
  console.log('by kind:', by('kind'), 'by source:', by('src'));
  console.log(res.issues.slice(0, shown).map((x) => `${x.text}  {${x.hand}}`).join('\n'));
}
