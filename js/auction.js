export const SEATS = ['N', 'E', 'S', 'W'];
export const STRAINS = ['C', 'D', 'H', 'S', 'N'];

export const isBid = (c) => /^[1-7][CDHSN]$/.test(c);
export const level = (c) => Number(c[0]);
export const strain = (c) => c[1];
export const bidRank = (c) => (level(c) - 1) * 5 + STRAINS.indexOf(strain(c));
export const sideOf = (seat) => (seat === 'N' || seat === 'S' ? 'NS' : 'EW');
export const partnerOf = (seat) => SEATS[(SEATS.indexOf(seat) + 2) % 4];

export function seatAt(auction, i) {
  return SEATS[(SEATS.indexOf(auction.dealer) + i) % 4];
}

export function nextSeat(auction) {
  return seatAt(auction, auction.calls.length);
}

export function lastBidIndex(calls) {
  for (let i = calls.length - 1; i >= 0; i--) if (isBid(calls[i])) return i;
  return -1;
}

export function isComplete({ calls }) {
  if (calls.length === 4 && calls.every((c) => c === 'P')) return true;
  return lastBidIndex(calls) >= 0 && calls.length >= 4 && calls.slice(-3).every((c) => c === 'P');
}

export function legalCalls(auction) {
  if (isComplete(auction)) return [];
  const { calls } = auction;
  const li = lastBidIndex(calls);
  const out = ['P'];
  for (let r = li < 0 ? 0 : bidRank(calls[li]) + 1; r < 35; r++) out.push(`${Math.floor(r / 5) + 1}${STRAINS[r % 5]}`);
  let last = calls.length - 1;
  while (last >= 0 && calls[last] === 'P') last--;
  if (last >= 0 && sideOf(seatAt(auction, last)) !== sideOf(nextSeat(auction))) {
    if (isBid(calls[last])) out.push('X');
    if (calls[last] === 'X') out.push('XX');
  }
  return out;
}

export function addCall(auction, call) {
  if (!legalCalls(auction).includes(call)) throw new Error(`Illegal call ${call}`);
  return { ...auction, calls: [...auction.calls, call] };
}

export function undo(auction) {
  return { ...auction, calls: auction.calls.slice(0, -1) };
}

// The situation facing the player about to make call number n, seen from that player's side.
// key: calls from the opening bid onward; own side plain, opponents' non-pass calls in brackets.
export function situationAt(auction, n) {
  const calls = auction.calls.slice(0, n);
  const actor = seatAt(auction, n);
  const side = sideOf(actor);
  const first = calls.findIndex(isBid);
  const key = [];
  if (first >= 0) {
    for (let i = first; i < calls.length; i++) {
      if (sideOf(seatAt(auction, i)) === side) key.push(calls[i]);
      else if (calls[i] !== 'P') key.push(`(${calls[i]})`);
    }
  }
  const openerSeat = first >= 0 ? seatAt(auction, first) : null;
  let role = 'opening';
  if (openerSeat) role = openerSeat === actor ? 'opener' : partnerOf(openerSeat) === actor ? 'responder' : 'defender';
  const ctx = {
    seat: first >= 0 ? first + 1 : n + 1,
    opened: openerSeat ? (sideOf(openerSeat) === side ? 'us' : 'them') : null,
    role,
    responderPassed: first >= 0 && calls.slice(0, first).some((_, i) => seatAt(auction, i) === partnerOf(openerSeat)),
    competitive: calls.some((c, i) => c !== 'P' && sideOf(seatAt(auction, i)) !== side),
  };
  return { key, ctx, actor };
}
