// The double-dummy review of a board (see ddreview.js) as words, for the board screen and the copied report.
import { SYMBOL, RANKS } from '../cards.js';

const STRAINS = ['S', 'H', 'D', 'C', 'N'];
const SEATS = ['N', 'E', 'S', 'W'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const cardText = (c) => `${SYMBOL[c[0]]}${c[1] === 'T' ? '10' : c[1]}`;
const bidText = (lv, d) => `${lv}${d === 'N' ? 'NT' : SYMBOL[d]}`;

// One contract of the par list: "4S-EW+1", "2S*-NS-1", "3N-W". name(seat or 'NS'/'EW') labels who plays it.
export function parContractText(c, name) {
  const m = /^(\d)([SHDCN])(\*{0,2})-([NESW]{1,2})([+-]\d+)?$/.exec(c);
  if (!m) return c;
  const [, lv, d, stars, who, extra] = m;
  const dbl = stars === '**' ? ' redoubled' : stars ? ' doubled' : '';
  const by = who.length === 1 ? name(who) : `${name(who[0])} or ${name(who[1])}`;
  const res = !extra ? 'making' : extra[0] === '-' ? `down ${extra.slice(1)}` : `making +${extra.slice(1)}`;
  return `${bidText(lv, d)}${dbl} by ${by}, ${res}`;
}

// The best cards, one per suit (equal cards in a suit are alike): "♦9 or ♠2".
const bestText = (best) => {
  const seen = new Set();
  const top = [...best].sort((a, b) => RANKS.indexOf(a[1]) - RANKS.indexOf(b[1])).filter((c) => (seen.has(c[0]) ? false : seen.add(c[0])));
  return top.slice(0, 3).map(cardText).join(' or ');
};

// Lines of text: par, the contract at its double-dummy tricks, and the cards that gave away tricks.
// k: the contract played (or null); took: tricks declarer took (or null); name(seat): a label for a seat;
// side(seat): a label for the seat's side ("your side", "N-S").
export function ddLines(rv, { k, took = null, name, side = (s) => (s === 'N' || s === 'S' ? 'N-S' : 'E-W') }) {
  const out = [];
  if (k && rv.contract) {
    const kt = bidText(k.bid[0], k.bid[1]);
    const need = Number(k.bid[0]) + 6;
    const t = rv.contract.tricks;
    out.push(`With every card visible, ${kt} by ${name(k.declarer)} takes ${plural(t, 'trick')}${t >= need ? ` (${t === need ? 'makes' : `makes with ${plural(t - need, 'overtrick')}`})` : ` (down ${need - t})`}.${took === null ? '' : took === t ? ' Declarer took the same.' : ` Declarer took ${took}.`}`);
  }
  if (rv.par) {
    const sc = rv.par.score;
    out.push(`Par: ${sc === 0 ? 'no score' : `${side(sc > 0 ? 'N' : 'E')} +${Math.abs(sc)}`}${rv.par.contracts.length ? ` (${rv.par.contracts.map((c) => parContractText(c, name)).join('; ')})` : ''}.`);
  }
  if (k) {
    if (!rv.mistakes.length) out.push('No card gave away a trick against perfect play.');
    else {
      for (const m of rv.mistakes.slice(0, 8)) {
        const better = bestText(m.best);
        out.push(`Trick ${m.trick}: ${name(m.seat)} played ${cardText(m.card)}; ${better} would have won ${plural(m.lost, 'more trick')} for ${side(m.seat)}.`);
      }
      if (rv.mistakes.length > 8) out.push(`…and ${rv.mistakes.length - 8} more.`);
    }
  }
  return out;
}

// The tricks table as rows: [{ strain: '♠', N: 9, E: 4, S: 9, W: 4 }, ...] from the solver's table.
export const tableRows = (table) => STRAINS.map((s, i) => ({ strain: s === 'N' ? 'NT' : SYMBOL[s], ...Object.fromEntries(SEATS.map((q, j) => [q, table[i][j]])) }));
