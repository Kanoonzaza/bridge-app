// Studies one position: generates deals in which the Advisor really would have made the given auction, then at
// the next decision tries every alternative call (finishing the auction with the Advisor, scored double dummy on
// the real deal) and totals the IMPs against the Advisor's own call, overall and by the deciding hand.
// Usage: node tools/ddsituation.mjs "P P 1N 2C" [dealer=N] [vul=none] [samples=300] [procs=4] [dump.json]   (HANDFILTER="e.hcp >= 9" limits the hand that calls)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { advise } from '../js/engine.js';
import { SEATS, addCall, nextSeat, sideOf } from '../js/auction.js';
import { deal } from './coverage.mjs';
import { packHand } from '../js/table/model.js';
import { evaluate } from '../js/cards.js';
import { alternatives, finish, nsScore, imps } from './ddcheck.mjs';

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

// Would the Advisor, at every seat, have made exactly these calls on these hands?
const matches = (hands, dealer, vul, calls) => {
  let a = { dealer, vul, calls: [] };
  for (const c of calls) {
    const r = advise(hands[nextSeat(a)], a);
    if ((r.notCovered ? 'P' : r.call) !== c) return false;
    a = addCall(a, c);
  }
  return true;
};

// HANDFILTER="e.hcp >= 8 && e.hcp <= 10 && Math.max(...Object.values(e.len)) >= 6" keeps only deals where the hand to call fits.
const keep = process.env.HANDFILTER ? new Function('e', `return (${process.env.HANDFILTER});`) : null;

async function work({ calls, dealer, vul, samples, seed }) {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const r = rng(seed);
  const records = [];
  let tries = 0;
  while (records.length < samples && tries < 4_000_000) {
    tries++;
    const hands = deal(r);
    if (!matches(hands, dealer, vul, calls)) continue;
    if (keep && !keep(evaluate(hands[nextSeat(calls.reduce((x, c) => addCall(x, c), { dealer, vul, calls: [] }))]))) continue;
    const { resTable } = dds.CalcDDTablePBN({ cards: `N:${SEATS.map((s) => packHand(hands[s])).join(' ')}` });
    const a = calls.reduce((x, c) => addCall(x, c), { dealer, vul, calls: [] });
    const seat = nextSeat(a);
    const res = advise(hands[seat], a);
    const advisor = res.notCovered ? 'P' : res.call;
    const base = nsScore(finish(hands, addCall(a, advisor)), resTable, vul);
    const sign = sideOf(seat) === 'NS' ? 1 : -1;
    const gains = {};
    for (const [call, cat] of alternatives(a)) {
      if (call === advisor) continue;
      gains[call] = { cat, gain: sign * imps(nsScore(finish(hands, addCall(a, call)), resTable, vul) - base) };
    }
    const e = evaluate(hands[seat]);
    records.push({ seat, hand: packHand(hands[seat]), hcp: e.hcp, len: e.len, balanced: e.balanced, advisor, label: res.fallback ? `general:${res.fallback}` : `rule:${res.notes}`, gains, hands: SEATS.map((s) => packHand(hands[s])).join(' ') });
  }
  return { records, tries };
}

export function summarize(records, { min = 8 } = {}) {
  const lines = [];
  const byAdvisor = {};
  for (const r of records) (byAdvisor[r.advisor] ??= []).push(r);
  lines.push(`${records.length} deals. Advisor's calls here: ${Object.entries(byAdvisor).map(([c, v]) => `${c} ×${v.length}`).join(', ')}.`);
  const tot = {};
  for (const r of records) for (const [call, g] of Object.entries(r.gains)) {
    const t = (tot[call] ??= { n: 0, sum: 0, win: 0 });
    t.n++; t.sum += g.gain; if (g.gain > 0) t.win++;
  }
  lines.push('', 'Alternative → mean IMPs gained over the Advisor\'s call (win rate):');
  for (const [call, t] of Object.entries(tot).sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n).slice(0, 8)) lines.push(`  ${call.padEnd(4)} ${(t.sum / t.n >= 0 ? '+' : '') + (t.sum / t.n).toFixed(2)}  (${Math.round((100 * t.win) / t.n)}% of ${t.n})`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , prefix = '', dealer = 'N', vul = 'none', samples = '300', procs = '4', dump = ''] = process.argv;
  const calls = prefix.split(/\s+/).filter(Boolean);
  if (process.env.DDSIT_WORKER) {
    process.stdout.write(JSON.stringify(await work({ calls, dealer, vul, samples: Number(samples), seed: 1000 + Number(process.env.DDSIT_WORKER) })));
  } else {
    const n = Number(procs);
    const parts = await Promise.all(Array.from({ length: n }, (_, k) => new Promise((resolve, reject) => {
      const c = spawn(process.execPath, [process.argv[1], prefix, dealer, vul, String(Math.ceil(Number(samples) / n)), procs], { env: { ...process.env, DDSIT_WORKER: String(k + 1) } });
      let buf = '';
      c.stdout.on('data', (x) => { buf += x; });
      c.stderr.on('data', (x) => process.stderr.write(x));
      c.on('close', (code) => (code === 0 ? resolve(JSON.parse(buf)) : reject(new Error(`worker ${k + 1} exited ${code}`))));
    })));
    const records = parts.flatMap((p) => p.records);
    if (dump) writeFileSync(dump, JSON.stringify(records));
    console.log(summarize(records));
  }
}
