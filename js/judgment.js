// General bidding judgment for later rounds that no specific rule covers.
// Works from what partner has shown (minimum strength, suit lengths, forcing status) and our own hand:
// find a fit, add up combined points, then choose slam / game / invitation / competition / penalty double / pass.
import { NAME, dummyPoints } from './cards.js';
import { legalCalls, seatAt, sideOf, partnerOf, isBid, relativeVul } from './auction.js';
import { agreedSuit } from './system/slam.js';
import { describeCall } from './general.js';

const SUITS = ['S', 'H', 'D', 'C'];
const isMajor = (s) => s === 'H' || s === 'S';
const RANK = { C: 0, D: 1, H: 2, S: 3, N: 4 };
const rank = (c) => (Number(c[0]) - 1) * 5 + RANK[c[1]];
const stopper = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3) || (/J/.test(e.hand[s]) && e.len[s] >= 4);

// Cheapest level for strain s over the bid `last`.
const cheapest2 = (last, s) => Number(last[0]) + (RANK[s] > RANK[last[1]] ? 0 : 1);

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
  // A rule that states responder's strength wins over the general assumption for a first call.
  const ruled = opened === 'us' && firstBid.seat !== pard && pFirst?.entry && pFirst.shows?.hcp;
  let pMin = ruled ? P.hcp[0] : Math.max(P.known ? P.hcp[0] : 0, firstCallMinimum(pFirst.call, opened, firstBid.seat === pard, advancer, firstBid.call));
  // I doubled for takeout and partner answered with a jump: about 10+.
  const myX = [...mRows].reverse().find((r) => r.call === 'X');
  const pAns = myX && pRows.find((r) => r.i > myX.i && isBid(r.call));
  if (pAns && !pAns.entry) {
    const before = rows.slice(0, pAns.i).reverse().find((r) => isBid(r.call));
    const cheap = before && cheapest2(before.call, pAns.call[1]);
    if (cheap && Number(pAns.call[0]) > cheap) pMin = Math.max(pMin, 10);
    // A cheap answer with no bid in between was forced: it shows nothing.
    else if (pAns === pFirst && auction.calls[pAns.i - 1] === 'P') pMin = P.known ? P.hcp[0] : 0;
  }
  const lastBidRow = [...rows].reverse().find((r) => isBid(r.call));
  const lastBid = lastBidRow.call;
  const theyBidLast = sideOf(lastBidRow.seat) !== side;
  const pLast = pRows.at(-1);
  const gameForced = ours.some((r) => r.shows?.force === 'game');
  const mustBid = !theyBidLast && pLast && pLast.seat === pard && isBid(pLast.call) && (pLast.shows?.force === 'round' || pLast.shows?.force === 'game');

  // Our suits and a fit: partner's shown length plus ours reaches 8.
  // Their suits: what their calls show (a Michaels cue-bid shows the other suits), or the suit named.
  const theirSuits = new Set(theirs.filter((r) => isBid(r.call)).flatMap((r) => (r.shows?.len ? SUITS.filter((s) => (r.shows.len[s]?.[0] ?? 0) >= 3) : r.call[1] === 'N' ? [] : [r.call[1]])));
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
  // 3NT promises a stopper in each suit they have shown.
  // Partner's natural notrump after they bid a suit already promised a stopper there.
  const pardStops = (s) => pRows.some((r) => isBid(r.call) && r.call[1] === 'N' && /stopper|balanced/i.test(r.meaning ?? '')
    && theirs.some((t) => t.i < r.i && isBid(t.call) && t.call[1] === s));
  const stopsAll = [...theirSuits].every((s) => stopper(e, s) || pardStops(s));
  // Without a stopper: game in a 6-card suit of our own instead of 3NT.
  const longGame = () => SUITS.filter((s) => !theirSuits.has(s) && e.len[s] >= 6).map(gameCall).find((c) => legal.has(c));

  // They redoubled partner's takeout double: run to our best suit.
  if (auction.calls.at(-1) === 'XX' || (auction.calls.at(-2) === 'XX' && auction.calls.at(-1) === 'P')) {
    const run = SUITS.filter((s) => !theirSuits.has(s)).sort((a, b) => e.len[b] - e.len[a])[0];
    const c = run && cheapest(run);
    if (c && pRows.some((r) => r.call === 'X')) return { call: c, why: ['they redoubled partner\'s takeout double: bid your longest suit'] };
  }
  // Partner's takeout double, and they passed: answer it. Passing turns it into a penalty double,
  // so pass only with long, strong trumps. (Takeout or penalty: the same general rule the Decoder shows.)
  const lastAct = [...rows].reverse().find((r) => r.call !== 'P');
  if (lastAct && lastAct.seat === pard && lastAct.call === 'X') {
    const meaning = lastAct.entry ? lastAct.meaning ?? '' : describeCall(auction, lastAct.i, rows)?.meaning ?? '';
    // A real takeout double leaves at least two suits to choose from; after they bid three suits it shows values.
    if (/takeout/i.test(meaning) && !/penalty/i.test(meaning) && SUITS.filter((x) => !theirSuits.has(x)).length >= 2) {
      const t = lastBid[1];
      const top = ['A', 'K', 'Q'].filter((x) => e.hand[t]?.includes(x)).length;
      const unbid = SUITS.filter((x) => !theirSuits.has(x));
      const majors = unbid.filter((x) => isMajor(x) && e.len[x] >= 4);
      // Longest first; on a tie a major, then a suit our side has not bid yet.
      const fresh = (x) => !mRows.some((r) => isBid(r.call) && r.call[1] === x);
      const suit = (majors.length ? majors : unbid).sort((a, b) => e.len[b] - e.len[a] || isMajor(b) - isMajor(a) || fresh(b) - fresh(a))[0];
      const answer = suit && cheapest(suit);
      // Defend with length in their suit: 5+, or 4 when the only answer is a weak 3-level bid.
      const high = Number(lastBid[0]) >= 3;
      if (t !== 'N' && ((e.len[t] >= 5) || (e.len[t] >= 4 && top >= 2 && e.hcp >= 8) || (e.len[t] >= 4 && high && top >= 1) || (e.len[t] >= 4 && e.hcp <= 7 && answer && Number(answer[0]) >= 3))) {
        return { call: 'P', why: [`${e.len[t]} ${NAME[t]}: defend, pass partner's takeout double for penalty`] };
      }
      // Game values opposite the double: bid game rather than the cheapest suit (12+ over a 3-level double).
      if (e.hcp >= (Number(lastBid[0]) >= 3 ? 12 : 13)) {
        const M = majors.sort((a, b) => e.len[b] - e.len[a])[0];
        const g = M && legal.has(`4${M}`) ? `4${M}` : stopsAll && legal.has('3N') ? '3N'
          : unbid.find((x) => !isMajor(x) && e.len[x] >= 6 && legal.has(`5${x}`)) ? `5${unbid.find((x) => !isMajor(x) && e.len[x] >= 6)}` : null;
        if (g) return { call: g, why: [`${e.hcp} HCP opposite partner's takeout double: game values`, g === '3N' ? 'game in notrump' : `game in ${NAME[g[1]]}`] };
      }
      // No suit worth bidding (the best unbid suit is a doubleton): defend.
      if (suit && e.len[suit] <= 2) return { call: 'P', why: [`no unbid suit longer than ${e.len[suit]} cards: defend`] };
      const nt = cheapest('N');
      if (!majors.length && t !== 'N' && stopper(e, t) && e.hcp >= 8 && nt && Number(nt[0]) <= 2) return { call: nt, why: [`${e.hcp} HCP with a ${NAME[t]} stopper: answer partner's takeout double in notrump`] };
      const c = suit && cheapest(suit);
      if (c) {
        const jump = e.hcp >= 10 && Number(c[0]) + 1 <= 3 && legal.has(`${Number(c[0]) + 1}${suit}`);
        return { call: jump ? `${Number(c[0]) + 1}${suit}` : c, why: [`partner's double is for takeout: bid your best unbid suit (${e.len[suit]} ${NAME[suit]})`, jump ? `${e.hcp} HCP: jump to show values` : 'passing would play their contract doubled with no trump tricks'] };
      }
    }
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
  // After our redouble, our doubles are for penalty: double them with length in their suit.
  if (theyBidLast && ours.some((r) => r.call === 'XX') && Number(lastBid[0]) <= 3 && lastBid[1] !== 'N' && e.len[lastBid[1]] >= 3 && legal.has('X')) {
    return { call: 'X', why: [`we redoubled: ${e.len[lastBid[1]]} ${NAME[lastBid[1]]}, double for penalty`] };
  }
  // They outbid our game: double for penalty.
  if (theyBidLast && combined >= 25 && rank(lastBid) >= rank('4H')) return R('X', [...why, 'they bid over our game: double for penalty']) ?? { call: 'P', why };
  // Game.
  if (combined >= 25) {
    // No fit, no stopper and no long suit: double them when they bid last, rather than a blind 3NT.
    // A minor-suit game needs about 28; with less, 3NT if we have the stoppers.
    // Over partner's forcing bid, bid the minor cheaply: partner goes on with extras.
    const g = T && (isMajor(T) || combined >= 28) ? gameCall(T) : stopsAll ? '3N' : T ? (mustBid ? null : gameCall(T)) : longGame() ?? (theyBidLast || mustBid || gameForced ? null : '3N');
    if (g && legal.has(g)) return { call: g, why: [...why, T ? `${trumps}-card ${NAME[T]} fit: game` : 'game in notrump'] };
    if (rank(lastBid) >= rank(g ?? (T ? gameCall(T) : '3N')) && !theyBidLast) return { call: 'P', why: [...why, 'we are already at game'] };
  }
  // No fit but the balance of strength, and they are still low: double (takeout below the 4-level), partner decides.
  if (theyBidLast && !T && !gameForced && (combined >= 25 || (e.hcp >= 17 && e.len[lastBid[1]] <= 2)) && Number(lastBid[0]) <= 3 && lastBid[1] !== 'N') {
    const r = R('X', [...why, 'no fit yet but most of the strength: double, partner passes or bids']);
    if (r) return r;
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
    // A raise needs a few points of our own (4+), unless the fit is 9+ cards (then it is preemptive)
    // or it is a 2-level preference to partner's 5-card suit.
    const worth = mine >= 4 || trumps >= 9 || mustBid || e.len[T] > P.len[T][0] || (P.len[T][0] >= 5 && c && Number(c[0]) <= 2);
    if (c && worth && Number(c[0]) <= Math.max(2, trumps - 6 + fav) && (theyBidLast || mustBid || combined >= 23)) {
      return { call: c, why: [...why, `${trumps} trumps: safe to compete to the ${trumps - 6 + fav}-level${fav ? ' (favorable vulnerability: one more)' : ''}`] };
    }
  }
  // Forcing auctions must go on.
  if (gameForced || mustBid) {
    if (gameForced && legal.has('3N') && stopsAll) return { call: '3N', why: ['game forcing: 3NT'] };
    const long = SUITS.filter((s) => !theirSuits.has(s) && e.len[s] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
    const c = long && cheapest(long);
    if (c && Number(c[0]) <= 4) return { call: c, why: ['forcing: show your longest suit'] };
    if (legal.has('3N') && stopsAll) return { call: '3N', why: ['forcing: 3NT'] };
    const any = [...ourBidSuits].map(cheapest).filter(Boolean)[0];
    if (any) return { call: any, why: ['forcing: return to a suit already bid'] };
    // Partner's cue-bid raise: bid the suit partner supports at the cheapest level (minimum).
    const pSuit = SUITS.filter((s) => !theirSuits.has(s) && P.len[s][0] >= 3).sort((a, b) => P.len[b][0] - P.len[a][0])[0];
    const back = pSuit && cheapest(pSuit);
    if (back && Number(back[0]) <= 5) return { call: back, why: [`forcing: bid ${NAME[pSuit]}, the suit partner supports, at the cheapest level`] };
    // A suit I named before, or my longest unbid suit, rather than notrump without a stopper.
    const mine2 = SUITS.filter((s) => !theirSuits.has(s) && (mRows.some((r) => isBid(r.call) && r.call[1] === s) || e.len[s] >= 4)).sort((a, b) => e.len[b] - e.len[a]);
    const own = mine2.map(cheapest).find((c) => c && Number(c[0]) <= 4);
    if (!stopsAll && own) return { call: own, why: [`forcing: bid ${NAME[own[1]]} (no stopper in their suit for notrump)`] };
    // They bid over our game force: a pass is forcing, partner bids again.
    if (gameForced && theyBidLast && !stopsAll) return { call: 'P', why: ['game forcing: after their bid a pass is forcing, so partner will bid again'] };
    if (legal.has('3N')) return { call: '3N', why: ['forcing: 3NT'] };
  }
  // A free bid with a long suit of our own.
  if (theyBidLast) {
    const long = SUITS.filter((s) => !theirSuits.has(s) && e.len[s] >= 6 && e.hcp >= 10).sort((a, b) => e.len[b] - e.len[a])[0];
    const c = long && cheapest(long);
    if (c && Number(c[0]) <= 3) return { call: c, why: [`${e.len[long]} ${NAME[long]}: compete`] };
  }
  // With a fit and extra values after they compete: compete to the 3-level (Law of Total Tricks plus strength).
  if (theyBidLast && T && combined >= 23) {
    const c = cheapest(T);
    if (c && Number(c[0]) <= 3) return { call: c, why: [...why, `${trumps}-card fit and extra values: compete to the 3-level`] };
  }
  // Misfit: partner's non-forcing new suit opposite my void or singleton, and a 6-card suit I have bid: rebid it.
  const pSuit = pLast && isBid(pLast.call) && pLast.call[1] !== 'N' ? pLast.call[1] : null;
  if (!theyBidLast && !T && pSuit && e.len[pSuit] <= 1) {
    const mine = SUITS.find((s) => s !== pSuit && !theirSuits.has(s) && e.len[s] >= 6 && mRows.some((r) => isBid(r.call) && r.call[1] === s));
    const c = mine && cheapest(mine);
    if (c && (Number(c[0]) <= 2 || (Number(c[0]) === 3 && e.len[mine] >= 7))) {
      return { call: c, why: [`${e.len[pSuit] ? 'a singleton' : 'a void'} in partner's ${NAME[pSuit]}: a misfit`, `${e.len[mine]} ${NAME[mine]}: play in my suit, not partner's`] };
    }
  }
  // Invitation in an uncontested auction with a fit.
  if (!theyBidLast && T && combined >= 23 && combined <= 24) {
    const inv = isMajor(T) ? `3${T}` : '2N';
    if (legal.has(inv)) return { call: inv, why: [...why, 'invite game'] };
  }
  return { call: 'P', why: [...why, ...passReasons({ e, T, theyBidLast, theirs, combined, auction, side })] };
}

// Why we do not go on: say what is missing (a fit, the points, safety), not just "not enough".
function passReasons({ e, T, theyBidLast, theirs, combined, auction, side }) {
  if (!theyBidLast) return ['no game: pass'];
  const out = [];
  const by = {};
  for (const r of theirs) if (isBid(r.call) && r.call[1] !== 'N') (by[r.call[1]] ??= new Set()).add(r.seat);
  const fit = Object.entries(by).find(([, seats]) => seats.size >= 2)?.[0];
  if (fit) out.push(`they have a fit in ${NAME[fit]} (both of them bid it), so their contract will often make`);
  if (!T) out.push('no 8-card fit of our own is known, so competing would be a guess');
  const v = relativeVul(auction.vul, side);
  if (v === 'we' || v === 'both') out.push('we are vulnerable: a failed push costs 100–300 or more');
  out.push(combined >= 23 ? 'close to game strength, but no clear action: pass' : `${combined} points between us is below game, and nothing here is worth the risk of competing: pass`);
  return out;
}
