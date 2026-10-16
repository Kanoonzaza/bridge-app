// Does simulating judgment calls make the Advisor's results better? One side simulates its judgment calls
// while the other plays the plain Advisor, on the same deals; the result is compared with the all-plain auction,
// double dummy, in IMPs for the simulating side. Positive = simulation helps.
// Usage: node tools/simcheck.mjs [deals=200] [seed=3] [procs=4] [samples=16]
import { spawn } from 'node:child_process';
import { advise } from '../js/engine.js';
import { SEATS, addCall, isComplete, nextSeat, sideOf } from '../js/auction.js';
import { deal } from './coverage.mjs';
import { packHand } from '../js/table/model.js';
import { contract, score } from '../js/table/play.js';
import { simulateBid, imps } from '../js/sim-bid.js';

const STRAIN = { S: 0, H: 1, D: 2, C: 3, N: 4 };
const VULS = ['none', 'NS', 'EW', 'both'];

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

const nsScore = (a, table, vul) => {
  const k = contract(a);
  if (!k) return 0;
  const s = score(k, vul, table[STRAIN[k.bid[1]]][SEATS.indexOf(k.declarer)]);
  return sideOf(k.declarer) === 'NS' ? s : -s;
};

async function run({ deals, seed, start, step, samples }) {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const r = rng(seed);
  const rand = rng(seed + 7);
  const out = { n: 0, gain: { NS: 0, EW: 0 }, decisions: 0, changed: 0, rows: [] };
  for (let i = 0; i < deals; i++) {
    const hands = deal(r);
    if (i % step !== start) continue;
    const dealer = SEATS[i % 4];
    const vul = VULS[i % 4];
    const { resTable } = dds.CalcDDTablePBN({ cards: `N:${SEATS.map((s) => packHand(hands[s])).join(' ')}` });
    const bid = (simSide) => {
      let a = { dealer, vul, calls: [] };
      const log = [];
      for (let g = 0; g < 60 && !isComplete(a); g++) {
        const seat = nextSeat(a);
        const res = advise(hands[seat], a);
        let call = res.notCovered ? 'P' : res.call;
        if (simSide && sideOf(seat) === simSide && res.fallback === 'judgment') {
          const s = simulateBid({ hand: hands[seat], auction: a, advised: res, dds, rand, samples });
          out.decisions++;
          if (s.changed) { out.changed++; log.push({ calls: a.calls.join(' ') || '(opening)', seat, advisor: call, sim: s.call, table: s.table }); }
          call = s.call;
        }
        a = addCall(a, call);
      }
      return { a, log };
    };
    const base = nsScore(bid(null).a, resTable, vul);
    for (const side of ['NS', 'EW']) {
      const { a, log } = bid(side);
      const gain = imps((nsScore(a, resTable, vul) - base) * (side === 'NS' ? 1 : -1));
      out.gain[side] += gain;
      if (log.length) out.rows.push({ i, side, dealer, vul, gain, calls: a.calls.join(' '), log, hands: SEATS.map((s) => packHand(hands[s])).join(' ') });
    }
    out.n++;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , d = '200', s = '3', p = '4', m = '16'] = process.argv;
  if (process.env.SIMCHECK_WORKER) {
    process.stdout.write(JSON.stringify(await run({ deals: Number(d), seed: Number(s), start: Number(process.env.SIMCHECK_WORKER) - 1, step: Number(p), samples: Number(m) })));
  } else {
    const procs = Number(p);
    const parts = await Promise.all(Array.from({ length: procs }, (_, k) => new Promise((resolve, reject) => {
      const c = spawn(process.execPath, [process.argv[1], d, s, p, m], { env: { ...process.env, SIMCHECK_WORKER: String(k + 1) } });
      let buf = '';
      c.stdout.on('data', (x) => { buf += x; });
      c.stderr.on('data', (x) => process.stderr.write(x));
      c.on('close', (code) => (code === 0 ? resolve(JSON.parse(buf)) : reject(new Error(`worker ${k + 1} exited ${code}`))));
    })));
    const tot = parts.reduce((t, x) => ({ n: t.n + x.n, ns: t.ns + x.gain.NS, ew: t.ew + x.gain.EW, dec: t.dec + x.decisions, ch: t.ch + x.changed, rows: t.rows.concat(x.rows) }), { n: 0, ns: 0, ew: 0, dec: 0, ch: 0, rows: [] });
    console.log(`${tot.n} deals | judgment decisions simulated ${tot.dec}, changed ${tot.ch} (${((100 * tot.ch) / Math.max(1, tot.dec)).toFixed(0)}%)`);
    console.log(`IMPs per deal for the simulating side vs the plain Advisor: NS ${(tot.ns / tot.n).toFixed(3)}, EW ${(tot.ew / tot.n).toFixed(3)}, both ${((tot.ns + tot.ew) / (2 * tot.n)).toFixed(3)}`);
    const changed = tot.rows.filter((x) => x.gain !== 0);
    console.log(`Deals where a changed call changed the result: ${changed.length}; better ${changed.filter((x) => x.gain > 0).length}, worse ${changed.filter((x) => x.gain < 0).length}`);
    for (const x of changed.sort((a, b) => a.gain - b.gain).slice(0, 5)) console.log(`  worst ${x.gain} IMPs | ${x.dealer} ${x.vul} | ${x.calls} | ${x.log.map((l) => `${l.seat}: ${l.advisor}→${l.sim} after ${l.calls}`).join('; ')} | ${x.hands}`);
  }
}
