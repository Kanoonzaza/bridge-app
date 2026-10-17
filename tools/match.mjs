// Duplicate match between two versions of the Advisor on the same random deals, scored double dummy.
// On every deal the NEW version (this checkout) sits North-South at table 1 and East-West at table 2, with the BASE
// version (another checkout, e.g. `git worktree add ../base main`) on the other side of each table. The new team's
// result is table 1 minus table 2 in IMPs, so luck of the deal cancels out and only the difference in bidding is left.
// Usage: node tools/match.mjs <base-checkout> [deals=2000] [seed=1] [procs=4]
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SEATS, addCall, isComplete, nextSeat, sideOf } from '../js/auction.js';
import { deal } from './coverage.mjs';
import { packHand } from '../js/table/model.js';
import { nsScore, imps } from './ddcheck.mjs';

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

// The auction when `ns` advises North-South and `ew` advises East-West.
function bid(hands, dealer, vul, ns, ew) {
  let a = { dealer, vul, calls: [] };
  for (let g = 0; g < 60 && !isComplete(a); g++) {
    const seat = nextSeat(a);
    const r = (sideOf(seat) === 'NS' ? ns : ew)(hands[seat], a);
    a = addCall(a, r.notCovered ? 'P' : r.call);
  }
  return a;
}

async function play({ base, deals, seed, start, step }) {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const mine = (await import('../js/engine.js')).advise;
  const theirs = (await import(pathToFileURL(resolve(base, 'js/engine.js')).href)).advise;
  const r = rng(seed);
  const out = { boards: 0, differ: 0, imps: 0, won: 0, lost: 0, sumSq: 0, rows: [] };
  for (let i = 0; i < deals; i++) {
    const hands = deal(r); // every process draws the same sequence, then plays its share
    if (i % step !== start) continue;
    out.boards++;
    const dealer = SEATS[i % 4];
    const vul = VULS[i % 4];
    const t1 = bid(hands, dealer, vul, mine, theirs); // new team North-South
    const t2 = bid(hands, dealer, vul, theirs, mine); // new team East-West
    if (t1.calls.join(' ') === t2.calls.join(' ')) continue;
    out.differ++;
    const { resTable } = dds.CalcDDTablePBN({ cards: `N:${SEATS.map((s) => packHand(hands[s])).join(' ')}` });
    const g = imps(nsScore(t1, resTable, vul) - nsScore(t2, resTable, vul));
    out.imps += g;
    out.sumSq += g * g;
    if (g > 0) out.won++; else if (g < 0) out.lost++;
    out.rows.push({ i, g, dealer, vul, newNS: t1.calls.join(' '), newEW: t2.calls.join(' '), hands: SEATS.map((s) => packHand(hands[s])).join(' ') });
  }
  return out;
}

export function report(parts, base) {
  const t = parts.reduce((x, p) => ({ boards: x.boards + p.boards, differ: x.differ + p.differ, imps: x.imps + p.imps, won: x.won + p.won, lost: x.lost + p.lost, sumSq: x.sumSq + p.sumSq, rows: x.rows.concat(p.rows) }), { boards: 0, differ: 0, imps: 0, won: 0, lost: 0, sumSq: 0, rows: [] });
  const mean = t.imps / t.boards;
  const sd = Math.sqrt(Math.max(0, t.sumSq / t.boards - mean * mean));
  const lines = [
    `New vs ${base}: ${t.boards} boards, the two tables differ on ${t.differ} (${((100 * t.differ) / t.boards).toFixed(1)}%).`,
    `New version ${mean >= 0 ? 'gains' : 'loses'} ${Math.abs(mean).toFixed(3)} IMPs per board (± ${(sd / Math.sqrt(t.boards)).toFixed(3)}); wins ${t.won}, loses ${t.lost} of the differing boards.`,
  ];
  const rows = t.rows.sort((a, b) => a.g - b.g);
  lines.push('', 'Worst for the new version:');
  for (const x of rows.slice(0, 5)) lines.push(`  ${x.g} IMPs | ${x.dealer} ${x.vul} | as NS: ${x.newNS} | as EW: ${x.newEW} | ${x.hands}`);
  lines.push('', 'Best for the new version:');
  for (const x of rows.slice(-3).reverse()) lines.push(`  +${x.g} IMPs | ${x.dealer} ${x.vul} | as NS: ${x.newNS} | as EW: ${x.newEW} | ${x.hands}`);
  return { text: lines.join('\n'), total: t };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , base, d = '2000', s = '1', p = '4'] = process.argv;
  if (!base) { console.error('Usage: node tools/match.mjs <base-checkout> [deals] [seed] [procs]'); process.exit(1); }
  if (process.env.MATCH_WORKER) {
    process.stdout.write(JSON.stringify(await play({ base, deals: Number(d), seed: Number(s), start: Number(process.env.MATCH_WORKER) - 1, step: Number(p) })));
  } else {
    const procs = Number(p);
    const parts = await Promise.all(Array.from({ length: procs }, (_, k) => new Promise((res, rej) => {
      const c = spawn(process.execPath, [process.argv[1], base, d, s, p], { env: { ...process.env, MATCH_WORKER: String(k + 1) } });
      let buf = '';
      c.stdout.on('data', (x) => { buf += x; });
      c.stderr.on('data', (x) => process.stderr.write(x));
      c.on('close', (code) => (code === 0 ? res(JSON.parse(buf)) : rej(new Error(`worker ${k + 1} exited ${code}`))));
    })));
    console.log(report(parts, base).text);
  }
}
