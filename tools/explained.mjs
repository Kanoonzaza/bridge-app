// How many calls in simulated auctions have an explanation (a Decoder meaning)?
// Splits our side's calls into uncontested and contested auctions; `general` also counts the general-rule meanings.
// Usage: node tools/explained.mjs [deals] [seed] [general]
import { explain } from '../js/engine.js';
import { SEATS, sideOf } from '../js/auction.js';
import { deal, bidDeal } from './coverage.mjs';

let a = Number(process.argv[3] ?? 3) >>> 0;
const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const n = Number(process.argv[2] ?? 500);
const stat = { quiet: [0, 0], contested: [0, 0] };
for (let i = 0; i < n; i++) {
  const { auction } = bidDeal(deal(r), SEATS[i % 4]);
  const rows = explain(auction, undefined, { general: process.argv[4] === "general" });
  rows.forEach((row, k) => {
    if (row.call === 'P') return;
    const side = sideOf(row.seat);
    const contested = auction.calls.slice(0, k).some((c, j) => c !== 'P' && sideOf(SEATS[(SEATS.indexOf(auction.dealer) + j) % 4]) !== side);
    const s = stat[contested ? 'contested' : 'quiet'];
    s[1]++;
    if (row.meaning) s[0]++;
  });
}
for (const [k, [ok, all]] of Object.entries(stat)) console.log(`${k}: ${ok}/${all} calls explained (${((100 * ok) / all).toFixed(1)}%)`);
