// Rule checker: finds situations where the Advisor's call scores worse, on average, than an alternative.
// For random deals it bids the auction with the Advisor; at every decision it forces each alternative call,
// finishes the auction with the Advisor, and scores the final contract double dummy (DDS) on the real deal.
// Results are totalled per situation (which rule or judgment step answered, and what the Advisor called) in IMPs.
// Also reports the whole auction against double-dummy par.
//
// Usage: node tools/ddcheck.mjs [deals=400] [seed=1] [procs=4] [out=ddcheck.json]
// Hindsight caveat: the alternatives see the real deal, and double dummy flatters declarers a little. Read the
// numbers as "which alternatives deserve a look", never as proof that a rule is wrong.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { advise } from '../js/engine.js';
import { SEATS, addCall, isComplete, nextSeat, legalCalls, sideOf, situationAt } from '../js/auction.js';
import { deal } from './coverage.mjs';
import { packHand } from '../js/table/model.js';
import { contract, score } from '../js/table/play.js';

const STRAIN = { S: 0, H: 1, D: 2, C: 3, N: 4 };
const VULS = ['none', 'NS', 'EW', 'both'];
const DDS_VUL = { none: 0, both: 1, NS: 2, EW: 3 };

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

const IMP_TABLE = [15, 45, 85, 125, 165, 215, 265, 315, 365, 425, 495, 595, 745, 895, 1095, 1295, 1495, 1745, 1995, 2245, 2495, 2995, 3495, 3995];
export const imps = (diff) => { const d = Math.abs(diff); let n = 0; while (n < IMP_TABLE.length && d >= IMP_TABLE[n]) n++; return diff < 0 ? -n : n; };

// North-South score of a finished auction on a deal whose double-dummy table is `table`.
export function nsScore(a, table, vul) {
  const k = contract(a);
  if (!k) return 0;
  const tricks = table[STRAIN[k.bid[1]]][SEATS.indexOf(k.declarer)];
  const s = score(k, vul, tricks);
  return sideOf(k.declarer) === sideOf('N') ? s : -s;
}

export function finish(hands, a) {
  for (let g = 0; g < 60 && !isComplete(a); g++) {
    const r = advise(hands[nextSeat(a)], a);
    a = addCall(a, r.notCovered ? 'P' : r.call);
  }
  return a;
}

// The alternatives worth trying at a decision: pass, double, redouble, the cheapest bid and the game bid in each
// strain, and small slam. Each has a category name so results can be totalled across decisions.
export function alternatives(a) {
  const legal = legalCalls(a);
  const out = new Map();
  const add = (cat, call) => { if (legal.includes(call) && !out.has(call)) out.set(call, cat); };
  add('pass', 'P'); add('double', 'X'); add('redouble', 'XX');
  const bids = legal.filter((c) => /^[1-7][CDHSN]$/.test(c));
  for (const s of 'CDHSN') {
    const mine = bids.filter((c) => c[1] === s);
    if (mine.length) add(`cheapest ${s}`, mine[0]);
    add(`game ${s}`, s === 'N' ? '3N' : s === 'H' || s === 'S' ? `4${s}` : `5${s}`);
    add(`slam ${s}`, `6${s}`);
  }
  return out;
}

const labelOf = (r) => (r.notCovered ? 'not covered' : r.fallback ? `general:${r.fallback}` : `rule:${r.notes ?? '?'}`);
const callKind = (c) => (c === 'P' ? 'P' : c === 'X' || c === 'XX' ? 'X' : /^[1-7]N$/.test(c) ? 'bid N' : 'bid suit');

export async function checkDeals({ deals, seed, start = 0, step = 1 }) {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const r = rng(seed);
  const stats = new Map(); // key -> { n, alts: { cat -> { sum, n, better } }, examples }
  const parLoss = [];
  for (let i = 0; i < deals; i++) {
    const hands = deal(r); // every process draws the same sequence, then keeps its share
    if (i % step !== start) continue;
    const dealer = SEATS[i % 4];
    const vul = VULS[i % 4];
    const { resTable } = dds.CalcDDTablePBN({ cards: `N:${SEATS.map((s) => packHand(hands[s])).join(' ')}` });
    let a = { dealer, vul, calls: [] };
    const base = { dealer, vul, calls: [] };
    // The Advisor's own auction, remembering the decisions along the way.
    const decisions = [];
    for (let g = 0; g < 60 && !isComplete(a); g++) {
      const seat = nextSeat(a);
      const res = advise(hands[seat], a);
      const call = res.notCovered ? 'P' : res.call;
      decisions.push({ a, seat, res, call });
      a = addCall(a, call);
    }
    const actual = nsScore(a, resTable, vul);
    // The whole auction against double-dummy par.
    try {
      const par = dds.DealerPar({ resTable }, SEATS.indexOf(dealer), DDS_VUL[vul]);
      const parNS = par.score; // DDS reports par from North-South's side whoever deals
      parLoss.push({ i, dealer, vul, calls: a.calls.join(' '), actual, par: parNS, imp: imps(actual - parNS), hands: SEATS.map((s) => packHand(hands[s])).join(' ') });
    } catch { /* no par for this deal */ }
    for (const d of decisions) {
      const sign = sideOf(d.seat) === 'NS' ? 1 : -1;
      // Two groupings: by the rule or judgment step that answered, and by the exact position (their calls bracketed).
      const keys = [`${labelOf(d.res)} | ${callKind(d.call)}`, `at ${situationAt(d.a, d.a.calls.length).key.join(' ') || '(opening)'} | ${d.call}`];
      const sts = keys.map((k) => stats.get(k) ?? { n: 0, alts: {}, examples: [] });
      sts.forEach((st) => { st.n++; });
      let bestGain = 0;
      let bestAlt = null;
      for (const [call, cat] of alternatives(d.a)) {
        if (call === d.call) continue;
        const alt = finish(hands, addCall(d.a, call));
        const gain = sign * imps(nsScore(alt, resTable, vul) - actual);
        for (const st of sts) {
          const e = st.alts[cat] ?? { n: 0, sum: 0, better: 0 };
          e.n++; e.sum += gain; if (gain > 0) e.better++;
          st.alts[cat] = e;
        }
        if (gain > bestGain) { bestGain = gain; bestAlt = { call, cat }; }
      }
      for (const st of sts) {
        if (bestAlt && bestGain >= 6) {
          st.examples.push({ gain: bestGain, alt: bestAlt.call, advisor: d.call, calls: d.a.calls.join(' ') || '(opening)', seat: d.seat, dealer, vul, hands: SEATS.map((s) => packHand(hands[s])).join(' ') });
          st.examples.sort((x, y) => y.gain - x.gain);
          st.examples.length = Math.min(st.examples.length, 6);
        }
      }
      keys.forEach((k, i) => stats.set(k, sts[i]));
    }
  }
  return { stats: Object.fromEntries(stats), parLoss };
}

function merge(parts) {
  const stats = {};
  const parLoss = [];
  for (const p of parts) {
    parLoss.push(...p.parLoss);
    for (const [k, v] of Object.entries(p.stats)) {
      const m = (stats[k] ??= { n: 0, alts: {}, examples: [] });
      m.n += v.n;
      for (const [c, e] of Object.entries(v.alts)) {
        const t = (m.alts[c] ??= { n: 0, sum: 0, better: 0 });
        t.n += e.n; t.sum += e.sum; t.better += e.better;
      }
      m.examples.push(...v.examples);
      m.examples.sort((x, y) => y.gain - x.gain);
      m.examples.length = Math.min(m.examples.length, 6);
    }
  }
  return { stats, parLoss };
}

export function report({ stats, parLoss }, { minN = 25, top = 25 } = {}) {
  const lines = [];
  const imp = parLoss.map((p) => p.imp);
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  lines.push(`${parLoss.length} deals. Advisor's final contract vs double-dummy par: ${mean(imp).toFixed(2)} IMPs per deal (0 = par).`);
  lines.push(`Worse than par by 5+ IMPs: ${((100 * imp.filter((x) => x <= -5).length) / Math.max(1, imp.length)).toFixed(1)}% of deals; by 10+: ${((100 * imp.filter((x) => x <= -10).length) / Math.max(1, imp.length)).toFixed(1)}%.`);
  const rows = [];
  for (const [key, st] of Object.entries(stats)) {
    if (st.n < minN) continue;
    for (const [cat, e] of Object.entries(st.alts)) {
      if (e.n < minN) continue;
      rows.push({ key, cat, n: e.n, mean: e.sum / e.n, better: e.better / e.n, examples: st.examples });
    }
  }
  rows.sort((x, y) => y.mean * Math.sqrt(y.n) - x.mean * Math.sqrt(x.n));
  lines.push('', `Situations where an alternative beats the Advisor on average (IMPs gained per decision, n decisions, % of decisions where it wins):`);
  for (const r of rows.slice(0, top).filter((x) => x.mean > 0)) lines.push(`  +${r.mean.toFixed(2)}  n=${String(r.n).padStart(4)}  ${(100 * r.better).toFixed(0).padStart(3)}%  ${r.key}  →  ${r.cat}`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , d = '400', s = '1', p = '4', out = 'ddcheck.json'] = process.argv;
  if (process.env.DDCHECK_WORKER) {
    const res = await checkDeals({ deals: Number(d), seed: Number(s), start: Number(process.env.DDCHECK_WORKER) - 1, step: Number(p) });
    process.stdout.write(JSON.stringify(res));
  } else {
    const procs = Number(p);
    const parts = await Promise.all(Array.from({ length: procs }, (_, k) => new Promise((resolve, reject) => {
      const c = spawn(process.execPath, [process.argv[1], d, s, p, out], { env: { ...process.env, DDCHECK_WORKER: String(k + 1) } });
      let buf = '';
      c.stdout.on('data', (x) => { buf += x; });
      c.stderr.on('data', (x) => process.stderr.write(x));
      c.on('close', (code) => (code === 0 ? resolve(JSON.parse(buf)) : reject(new Error(`worker ${k + 1} exited ${code}`))));
    })));
    const all = merge(parts);
    writeFileSync(out, JSON.stringify(all));
    console.log(report(all));
  }
}
