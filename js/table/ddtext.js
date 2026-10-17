// The double-dummy table and par of a board (see ddreview.js) as text, for the board screen and the copied report.
import { SYMBOL } from '../cards.js';

const STRAINS = ['S', 'H', 'D', 'C', 'N'];
const SEATS = ['N', 'E', 'S', 'W'];
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

// The par line: "Par: your side +90 (2♦ by Partner or You, making)". name(seat) labels a seat; side(seat) its side.
export function parLine(rv, { name, side = (s) => (s === 'N' || s === 'S' ? 'N-S' : 'E-W') }) {
  if (!rv.par) return null;
  const sc = rv.par.score;
  return `Par: ${sc === 0 ? 'no score' : `${side(sc > 0 ? 'N' : 'E')} +${Math.abs(sc)}`}${rv.par.contracts.length ? ` (${rv.par.contracts.slice(0, 2).map((c) => parContractText(c, name)).join('; ')})` : ''}`;
}

// The tricks table as rows: [{ strain: '♠', N: 9, E: 4, S: 9, W: 4 }, ...] from the solver's table.
export const tableRows = (table) => STRAINS.map((s, i) => ({ strain: s === 'N' ? 'NT' : SYMBOL[s], ...Object.fromEntries(SEATS.map((q, j) => [q, table[i][j]])) }));
