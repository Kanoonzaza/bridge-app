// Double-dummy review of a finished board: what each side could make with every card visible and perfect play,
// the par result, and the cards that gave away tricks. Pure functions apart from the solver passed in; runs in a worker.
import { SEATS } from '../auction.js';
import { playState, splitPlay, legalCards, score } from './play.js';
import { solve } from './dd.js';
import { packHand } from './model.js';

const STRAIN = { S: 0, H: 1, D: 2, C: 3, N: 4 };
const DDS_VUL = { none: 0, both: 1, NS: 2, EW: 3 };
// DDS stops after twelve tricks: the last trick is forced.
const LAST_CHECKED = 48;

// hands: { N: { S: 'AK..', ... }, ... }; k: the contract or null; play: the cards played, in order.
// Returns { table, par, contract, mistakes }:
//   table[strain S H D C N][seat N E S W] = tricks the seat takes as declarer, double dummy;
//   par = { score (North-South), contracts: ['4S-EW', ...] };
//   contract = { tricks, score } for the actual contract at its double-dummy trick count (or null);
//   mistakes = cards that gave away tricks, in play order: { trick, seat, card, lost, best: [cards] }.
export function ddReview(dds, { hands, k, play, dealer, vul }) {
  const { resTable } = dds.CalcDDTablePBN({ cards: `N:${SEATS.map((s) => packHand(hands[s])).join(' ')}` });
  let par = null;
  try {
    const p = dds.DealerPar({ resTable }, SEATS.indexOf(dealer), DDS_VUL[vul]);
    par = { score: p.score, contracts: p.contracts.filter(Boolean) };
  } catch { /* no par for this deal */ }
  const tricks = k ? resTable[STRAIN[k.bid[1]]][SEATS.indexOf(k.declarer)] : null;
  const contract = k ? { tricks, score: score(k, vul, tricks) } : null;
  const cards = splitPlay(play);
  const mistakes = [];
  for (let i = 0; i < Math.min(cards.length, LAST_CHECKED); i++) {
    const st = k ? playState(hands, k, cards.slice(0, i).join(' ')) : null;
    if (!st || !st.ok || !st.next) break;
    const legal = legalCards(st, st.next);
    if (legal.length < 2) continue;
    const sc = solve(dds, st, st.remaining);
    const best = Math.max(...legal.map((c) => sc[c] ?? 0));
    const got = sc[cards[i]] ?? 0;
    if (got < best) mistakes.push({ trick: Math.floor(i / 4) + 1, seat: st.next, card: cards[i], lost: best - got, best: legal.filter((c) => (sc[c] ?? 0) === best) });
  }
  return { table: resTable, par, contract, mistakes };
}
