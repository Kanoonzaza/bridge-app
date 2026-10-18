// Training data for a trick estimator: random deals with their exact double-dummy tables.
// Appends one line per deal to <out>: the four packed hands (N E S W) and the 20 declarer-trick counts
// (strains S H D C N, seats N E S W). Usage: node tools/nn-data.mjs <out.jsonl> <seed> [seconds=3600]
import { appendFileSync } from 'node:fs';
import { loadDds, Dds } from '../js/vendor/dds/api.js';
import { SEATS } from '../js/auction.js';
import { packHand } from '../js/table/model.js';
import { deal } from './coverage.mjs';

const [, , out, seed = '1', seconds = '3600'] = process.argv;
if (!out) { console.error('Usage: node tools/nn-data.mjs <out.jsonl> <seed> [seconds]'); process.exit(1); }
let a = Number(seed) >>> 0;
const rng = () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const dds = new Dds(await loadDds());
const end = Date.now() + Number(seconds) * 1000;
let buf = [];
let n = 0;
while (Date.now() < end) {
  const hands = deal(rng);
  const packed = SEATS.map((s) => packHand(hands[s]));
  const { resTable } = dds.CalcDDTablePBN({ cards: `N:${packed.join(' ')}` });
  buf.push(JSON.stringify([packed, resTable.flat()]));
  if (++n % 50 === 0) { appendFileSync(out, `${buf.join('\n')}\n`); buf = []; }
}
if (buf.length) appendFileSync(out, `${buf.join('\n')}\n`);
