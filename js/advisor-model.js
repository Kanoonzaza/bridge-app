import { SEATS, addCall, nextSeat, isComplete, isBid } from './auction.js';

export const ME = 'S';
export const PARTNER = 'N';

export function dealerFor(opener, seat) {
  const pos = SEATS.indexOf(opener === 'me' ? ME : PARTNER);
  return SEATS[(pos - (seat - 1) + 8) % 4];
}

// Opponents always pass; before the opening our non-opener passes too.
export function buildAuction({ opener, seat, ourCalls }) {
  const openerSeat = opener === 'me' ? ME : PARTNER;
  let a = { dealer: dealerFor(opener, seat), calls: [] };
  const queue = [...ourCalls];
  for (let guard = 0; guard < 200 && !isComplete(a); guard++) {
    const s = nextSeat(a);
    const ours = s === ME || s === PARTNER;
    if (!ours) {
      a = addCall(a, 'P');
    } else if (!a.calls.some(isBid) && s !== openerSeat) {
      a = addCall(a, 'P');
    } else if (queue.length) {
      try {
        a = addCall(a, queue.shift());
      } catch {
        break;
      }
    } else {
      break;
    }
  }
  return a;
}
