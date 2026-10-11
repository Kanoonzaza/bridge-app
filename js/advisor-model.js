import { SEATS, addCall, nextSeat, isComplete, isBid } from './auction.js';

export const ME = 'S';
export const PARTNER = 'N';
export const LHO = 'W';
export const RHO = 'E';
export const OPENER_SEAT = { me: ME, partner: PARTNER, lho: LHO, rho: RHO };
export const isOpp = (seat) => seat === LHO || seat === RHO;

export function dealerFor(opener, seat) {
  const pos = SEATS.indexOf(OPENER_SEAT[opener]);
  return SEATS[(pos - (seat - 1) + 8) % 4];
}

// Everyone passes before the opening. After it, our calls are entered; the opponents' calls are
// entered too when they compete (always when they opened), otherwise they pass.
export const oppsEnter = ({ opener, compete }) => Boolean(compete) || isOpp(OPENER_SEAT[opener]);

export function enteredTurn(state, auction) {
  const s = nextSeat(auction);
  return auction.calls.some(isBid) ? !isOpp(s) || oppsEnter(state) : s === OPENER_SEAT[state.opener];
}

export function buildAuction(state) {
  let a = { dealer: dealerFor(state.opener, state.seat), calls: [] };
  const queue = [...state.ourCalls];
  for (let guard = 0; guard < 200 && !isComplete(a); guard++) {
    if (!enteredTurn(state, a)) {
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
