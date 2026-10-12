// General bidding judgment for later rounds that no specific rule covers.
// Works from what partner has shown (minimum strength, suit lengths, forcing status) and our own hand:
// find a fit, add up combined points, then choose slam / game / invitation / competition / penalty double / pass.
import { NAME, dummyPoints } from './cards.js';
import { legalCalls, seatAt, sideOf, partnerOf, isBid, relativeVul } from './auction.js';
import { agreedSuit } from './system/slam.js';

const SUITS = ['S', 'H', 'D', 'C'];
const isMajor = (s) => s === 'H' || s === 'S';
const RANK = { C: 0, D: 1, H: 2, S: 3, N: 4 };
const rank = (c) => (Number(c[0]) - 1) * 5 + RANK[c[1]];
const stopper = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3);

// Minimum strength a player's first action promises, when the rule's `shows` says nothing.
function firstCallMinimum(call, opened, isOpener, advancer, opening) {
  if (!call || call === 'P') return 0;
  if (isOpener) return { '1N': 15, '2N': 20, '2C': 22, '3N': 10 }[call] ?? (/^2[DHS]$|^[34]/.test(call) ? 5 : 12);
  if (opened === 'us') {
    if (opening === '2C') return call === '2D' ? 0 : 8;
    if (!/^1[CDHS]$/.test(opening ?? '')) return 0; // over notrump, weak twos and preempts: shown by the rules, not assumed
    return /^2[CDH]$/.test(call) && call[1] !== opening[1] ? 10 : 6;
  }
  if (advancer) return 5;
  return call === 'X' ? 12 : call === '1N' ? 15 : 8;
}

export function judge(e, auction, rows, summary, key) {
  const n = auction.calls.length;
  const me = seatAt(auction, n);
  const pard = partnerOf(me);
  const side = sideOf(me);
  const legal = new Set(legalCalls(auction));
  const ours = rows.filter((r) => sideOf(r.seat) === side);
  const theirs = rows.filter((r) => sideOf(r.seat) !== side);
  const pRows = ours.filter((r) => r.seat === pard);
  const mRows = ours.filter((r) => r.seat === me);
  const firstBid = rows.find((r) => isBid(r.call));
  if (!firstBid) return null;
  const opened = sideOf(firstBid.seat) === side ? 'us' : 'them';
  const pFirst = pRows.find((r) => r.call !== 'P');
  if (!pFirst) return null; // partner has not acted: other fallbacks decide
  const P = summary(pard);
  const myFirst = mRows.find((r) => r.call !== 'P');
  const advancer = opened === 'them' && myFirst && rows.indexOf(myFirst) < rows.indexOf(pFirst);
  const pMin = Math.max(P.known ? P.hcp[0] : 0, firstCallMinimum(pFirst.call, opened, firstBid.seat === pard, advancer, firstBid.call));
  const lastBidRow = [...rows].reverse().find((r) => isBid(r.call));
  const lastBid = lastBidRow.call;
  const theyBidLast = sideOf(lastBidRow.seat) !== side;
  const pLast = pRows.at(-1);
  const gameForced = ours.some((r) => r.shows?.force === 'game');
  const mustBid = !theyBidLast && pLast && pLast.seat === pard && isBid(pLast.call) && (pLast.shows?.force === 'round' || pLast.shows?.force === 'game');

  // Our suits and a fit: partner's shown length plus ours reaches 8.
  const theirSuits = new Set(theirs.filter((r) => isBid(r.call)).map((r) => r.call[1]));
  const ourBidSuits = new Set(ours.filter((r) => isBid(r.call) && r.shows?.len).flatMap((r) => Object.keys(r.shows.len).filter((s) => r.shows.len[s][0] >= 4)));
  const fits = SUITS.filter((s) => !theirSuits.has(s) && P.len[s][0] + e.len[s] >= 8);
  const agreed = agreedSuit(key);
  const T = (agreed && !theirSuits.has(agreed) ? agreed : null) ?? fits.sort((a, b) => isMajor(b) - isMajor(a) || P.len[b][0] + e.len[b] - P.len[a][0] - e.len[a])[0] ?? null;
  // The supporting hand counts shortness; the hand with the long trumps counts extra length.
  const mine = !T ? e.hcp : e.len[T] <= P.len[T][0] ? Math.max(e.hcp, dummyPoints(e, T)) : e.hcp + Math.max(0, e.len[T] - 5);
  const combined = mine + pMin;
  const trumps = T ? P.len[T][0] + e.len[T] : 0;
  const R = (call, why) => (legal.has(call) ? { call, why } : null);
  const cheapest = (s) => [...legal].filter((c) => /^[1-7]/.test(c) && c[1] === s).sort((a, b) => rank(a) - rank(b))[0];
  const gameCall = (s) => (s === 'N' ? '3N' : isMajor(s) ? `4${s}` : `5${s}`);
  const why = [`partner has shown about ${pMin}+ HCP`, `${combined} combined points`];

  // They redoubled partner's takeout double: run to our best suit.
  if (auction.calls.at(-1) === 'XX' || (auction.calls.at(-2) === 'XX' && auction.calls.at(-1) === 'P')) {
    const run = SUITS.filter((s) => !theirSuits.has(s)).sort((a, b) => e.len[b] - e.len[a])[0];
    const c = run && cheapest(run);
    if (c && pRows.some((r) => r.call === 'X')) return { call: c, why: ['they redoubled partner\'s takeout double: bid your longest suit'] };
  }
  // Slam with a fit: ask for key cards.
  if (T && combined >= 33 && !mRows.some((r) => r.call === '4N') && !pRows.some((r) => r.call === '4N')) {
    // In a minor, 4NT only with 2+ key cards of our own: a low reply could already pass 5 of the minor (proposed).
    const keys = SUITS.filter((s) => e.hand[s].includes('A')).length + (e.hand[T].includes('K') ? 1 : 0);
    if (!isMajor(T) && keys < 2) {
      const c = combined >= 35 ? `6${T}` : `5${T}`;
      if (legal.has(c)) return { call: c, why: [...why, `${NAME[T]} trumps but only ${keys} key card${keys === 1 ? '' : 's'}: skip 4NT, bid ${c[0] === '6' ? 'the slam' : 'game'}`] };
    }
    const r = R('4N', [...why, `${trumps} ${NAME[T]} between you: ask for key cards (RKCB)`]);
    if (r) return r;
  }
  if (!T && combined >= 33) {
    const r = R('6N', [...why, 'no fit but slam values: 6NT']);
    if (r) return r;
  }
  // They outbid our game: double for penalty.
  if (theyBidLast && combined >= 25 && rank(lastBid) >= rank('4H')) return R('X', [...why, 'they bid over our game: double for penalty']) ?? { call: 'P', why };
  // Game.
  if (combined >= 25) {
    const g = T && (isMajor(T) || combined >= 28) ? gameCall(T) : stopper(e, [...theirSuits][0] ?? 'S') || !theirSuits.size ? '3N' : T ? gameCall(T) : '3N';
    if (legal.has(g)) return { call: g, why: [...why, T ? `${trumps}-card ${NAME[T]} fit: game` : 'game in notrump'] };
    if (rank(lastBid) >= rank(g) && !theyBidLast) return { call: 'P', why: [...why, 'we are already at game'] };
  }
  // Penalty double without a fit: they are high, we have values and length in their suit.
  if (theyBidLast && !T && combined >= 23 && Number(lastBid[0]) >= 2 && e.len[lastBid[1]] >= 4 && /[AKQ]/.test(e.hand[lastBid[1]])) {
    const r = R('X', [...why, `${e.len[lastBid[1]]} ${NAME[lastBid[1]]}: penalty double`]);
    if (r) return r;
  }
  // Maximal double: they bid the suit just below our agreed suit at the 3-level; double is the only game try left.
  const BELOW = { S: 'H', H: 'D', D: 'C' };
  if (theyBidLast && agreed && lastBid === `3${BELOW[agreed]}` && combined >= 23 && combined <= 24 && legal.has('X')) {
    return { call: 'X', why: [...why, `maximal double: a game try in ${NAME[agreed]} (3${agreed === 'S' ? '♠' : agreed === 'H' ? '♥' : '♦'} would only compete)`] };
  }
  // Compete with a fit, by the Law of Total Tricks (trumps − 6).
  if (T) {
    const c = cheapest(T);
    // At favorable vulnerability (they vulnerable, we not) compete one level higher.
    const fav = relativeVul(auction.vul, side) === 'they' && theyBidLast ? 1 : 0;
    if (c && Number(c[0]) <= Math.max(2, trumps - 6 + fav) && (theyBidLast || mustBid || combined >= 23)) {
      return { call: c, why: [...why, `${trumps} trumps: safe to compete to the ${trumps - 6 + fav}-level${fav ? ' (favorable vulnerability: one more)' : ''}`] };
    }
  }
  // Forcing auctions must go on.
  if (gameForced || mustBid) {
    if (gameForced && legal.has('3N') && stopper(e, [...theirSuits][0] ?? 'S')) return { call: '3N', why: ['game forcing: 3NT'] };
    const long = SUITS.filter((s) => !theirSuits.has(s) && e.len[s] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
    const c = long && cheapest(long);
    if (c && Number(c[0]) <= 4) return { call: c, why: ['forcing: show your longest suit'] };
    if (legal.has('3N')) return { call: '3N', why: ['forcing: 3NT'] };
    const any = [...ourBidSuits].map(cheapest).filter(Boolean)[0];
    if (any) return { call: any, why: ['forcing: return to a suit already bid'] };
  }
  // A free bid with a long suit of our own.
  if (theyBidLast) {
    const long = SUITS.filter((s) => !theirSuits.has(s) && e.len[s] >= 6 && e.hcp >= 10).sort((a, b) => e.len[b] - e.len[a])[0];
    const c = long && cheapest(long);
    if (c && Number(c[0]) <= 3) return { call: c, why: [`${e.len[long]} ${NAME[long]}: compete`] };
  }
  // Invitation in an uncontested auction with a fit.
  if (!theyBidLast && T && combined >= 23 && combined <= 24) {
    const inv = isMajor(T) ? `3${T}` : '2N';
    if (legal.has(inv)) return { call: inv, why: [...why, 'invite game'] };
  }
  return { call: 'P', why: [...why, theyBidLast ? 'not enough to compete further: pass' : 'no game: pass'] };
}
