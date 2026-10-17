// Double-dummy table of a finished board: the tricks each seat takes in each strain with every card visible and
// perfect play, and the par result. Runs in a worker (about half a second).
import { SEATS } from '../auction.js';
import { packHand } from './model.js';

const DDS_VUL = { none: 0, both: 1, NS: 2, EW: 3 };

// hands: { N: { S: 'AK..', ... }, ... }. Returns { table, par }:
//   table[strain S H D C N][seat N E S W] = tricks the seat takes as declarer, double dummy;
//   par = { score (North-South), contracts: ['4S-EW', ...] } or null.
export function ddReview(dds, { hands, dealer, vul }) {
  const { resTable } = dds.CalcDDTablePBN({ cards: `N:${SEATS.map((s) => packHand(hands[s])).join(' ')}` });
  let par = null;
  try {
    const p = dds.DealerPar({ resTable }, SEATS.indexOf(dealer), DDS_VUL[vul]);
    par = { score: p.score, contracts: p.contracts.filter(Boolean) };
  } catch { /* no par for this deal */ }
  return { table: resTable, par };
}
