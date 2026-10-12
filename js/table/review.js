// After a board: compare the table's auction with what the Advisor would bid, call by call.
import { advise, explain } from '../engine.js';
import { addCall, isComplete, nextSeat, seatAt, sideOf, isBid } from '../auction.js';
import { auctionOf, handOf } from './model.js';

// The whole auction as the Advisor would bid it, with the table's opponents
// (robots bid by the engine, always-pass seats pass, human opponents are bid by the engine too).
export function systemAuction(b, seats) {
  let a = { dealer: b.dealer, vul: b.vul, calls: [] };
  for (let g = 0; g < 60 && !isComplete(a); g++) {
    const s = nextSeat(a);
    const r = seats[s].kind === 'pass' ? { call: 'P' } : advise(handOf(b, s), a);
    a = addCall(a, r.notCovered ? 'P' : r.call);
  }
  return a;
}

// Each call of the table's auction, with its meaning and, for human seats, the Advisor's call at that point.
export function reviewRows(b, seats) {
  const a = auctionOf(b);
  const rows = explain(a, undefined, { general: true });
  const earlier = {}; // seat → the first call of theirs that differed from the Advisor
  return rows.map((row) => {
    const seat = seatAt(a, row.i);
    const human = seats[seat].kind === 'human';
    let advisor = null;
    if (human) {
      const r = advise(handOf(b, seat), { ...a, calls: a.calls.slice(0, row.i) });
      advisor = r.notCovered ? null : { call: r.call, meaning: r.meaning, reasons: r.reasons };
    }
    const differs = !!advisor && advisor.call !== row.call;
    // The Advisor's later advice builds on the call this player actually made: say so after a first difference.
    const out = { ...row, seat, human, advisor, differs, since: earlier[seat] ?? null };
    if (differs && !earlier[seat]) earlier[seat] = row.call;
    return out;
  });
}

// "4♠ by North, doubled" style summary of the final contract.
export function contract(a) {
  const li = a.calls.map((c, i) => (isBid(c) ? i : -1)).filter((i) => i >= 0).at(-1);
  if (li === undefined) return null;
  const c = a.calls[li];
  const side = sideOf(seatAt(a, li));
  const first = a.calls.findIndex((x, i) => isBid(x) && x[1] === c[1] && sideOf(seatAt(a, i)) === side);
  const after = a.calls.slice(li + 1).filter((x) => x !== 'P');
  return { bid: c, declarer: seatAt(a, first), doubled: after.at(-1) === 'XX' ? 'XX' : after.includes('X') ? 'X' : '' };
}
