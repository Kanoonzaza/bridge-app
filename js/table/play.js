// The play of the cards: tricks, following suit, the result and its score, and how a robot picks a card.
// Pure functions. A card is "SA" (suit, rank); the play is stored as cards in order, separated by spaces.
import { SUITS, RANKS } from '../cards.js';
import { SEATS, partnerOf, sideOf, seatAt, isBid } from '../auction.js';

const nextSeat = (s) => SEATS[(SEATS.indexOf(s) + 1) % 4];
const rank = (c) => RANKS.indexOf(c[1]); // 0 = ace: lower is higher
const bySuit = (cards, s) => cards.filter((c) => c[0] === s);
const highest = (cards) => cards.reduce((a, b) => (rank(b) < rank(a) ? b : a));
const lowest = (cards) => cards.reduce((a, b) => (rank(b) > rank(a) ? b : a));
export const splitPlay = (s) => (s ? String(s).split(' ').filter((c) => /^[SHDC][AKQJT2-9]$/.test(c)) : []);

// The final contract: { bid, declarer, doubled } or null when passed out.
export function contract(a) {
  const li = a.calls.map((c, i) => (isBid(c) ? i : -1)).filter((i) => i >= 0).at(-1);
  if (li === undefined) return null;
  const c = a.calls[li];
  const side = sideOf(seatAt(a, li));
  const first = a.calls.findIndex((x, i) => isBid(x) && x[1] === c[1] && sideOf(seatAt(a, i)) === side);
  const after = a.calls.slice(li + 1).filter((x) => x !== 'P');
  return { bid: c, declarer: seatAt(a, first), doubled: after.at(-1) === 'XX' ? 'XX' : after.includes('X') ? 'X' : '' };
}

// Hands as card lists: { N: ['SA', 'SK', ...], ... }.
export const cardsOf = (hand) => SUITS.flatMap((s) => [...(hand[s] ?? '')].map((r) => s + r));

export function trickWinner(trick, trump) {
  const led = trick[0].card[0];
  const pool = trump && trick.some((p) => p.card[0] === trump) ? trick.filter((p) => p.card[0] === trump) : trick.filter((p) => p.card[0] === led);
  return pool.reduce((a, b) => (rank(b.card) < rank(a.card) ? b : a)).seat;
}

// Everything about the play so far. hands: { N: hand, ... } as { S: 'AK..', ... }.
export function playState(hands, k, play) {
  if (!k) return null;
  const declarer = k.declarer;
  const trump = k.bid[1] === 'N' ? null : k.bid[1];
  const remaining = Object.fromEntries(SEATS.map((s) => [s, cardsOf(hands[s])]));
  const tricks = [];
  let current = [];
  let seat = nextSeat(declarer);
  let ok = true;
  for (const card of splitPlay(play)) {
    if (!remaining[seat].includes(card)) { ok = false; break; }
    remaining[seat] = remaining[seat].filter((c) => c !== card);
    current.push({ seat, card });
    if (current.length === 4) {
      const winner = trickWinner(current, trump);
      tricks.push({ cards: current, winner });
      current = [];
      seat = winner;
    } else seat = nextSeat(seat);
  }
  const side = sideOf(declarer);
  const won = tricks.filter((t) => sideOf(t.winner) === side).length;
  return {
    contract: k, declarer, dummy: partnerOf(declarer), trump, tricks, current, remaining, ok,
    next: tricks.length === 13 ? null : seat,
    complete: tricks.length === 13,
    declarerTricks: won,
    defenderTricks: tricks.length - won,
    started: tricks.length > 0 || current.length > 0,
  };
}

// The seat whose player chooses the card: declarer also plays dummy's cards.
export const controller = (st, seat) => (seat === st.dummy ? st.declarer : seat);

export function legalCards(st, seat) {
  const hand = st.remaining[seat];
  if (!st.current.length) return hand;
  const follow = bySuit(hand, st.current[0].card[0]);
  return follow.length ? follow : hand;
}

// Duplicate score for the declaring side (negative when the contract fails).
export function score(k, vul, tricks) {
  const level = Number(k.bid[0]);
  const strain = k.bid[1];
  const v = vul === 'both' || vul === sideOf(k.declarer);
  const mult = k.doubled === 'XX' ? 4 : k.doubled === 'X' ? 2 : 1;
  const need = level + 6;
  if (tricks < need) {
    const down = need - tricks;
    if (mult === 1) return -down * (v ? 100 : 50);
    let p = 0;
    for (let i = 1; i <= down; i++) p += v ? (i === 1 ? 200 : 300) : i === 1 ? 100 : i <= 3 ? 200 : 300;
    return -p * (mult / 2);
  }
  const per = strain === 'C' || strain === 'D' ? 20 : 30;
  const trickScore = (strain === 'N' ? 40 + 30 * (level - 1) : per * level) * mult;
  let s = trickScore + (trickScore >= 100 ? (v ? 500 : 300) : 50);
  if (level === 6) s += v ? 750 : 500;
  if (level === 7) s += v ? 1500 : 1000;
  if (mult === 2) s += 50;
  if (mult === 4) s += 100;
  const over = tricks - need;
  s += mult === 1 ? over * per : over * (v ? 200 : 100) * (mult / 2);
  return s;
}

// ---------- Defenders' signals (standard carding) ----------
// Attitude on partner's lead: a high spot card asks for the suit (we hold the A, K or Q), a low one says no.
// Count when declarer's side leads: high then low = an even number of cards, low = odd. Only on the first
// round of a suit, and only with spot cards (9 or lower) to spare. Partner reads them when placing cards.
const SPOT = RANKS.indexOf('9');
export function signalKind(st, before, seat, trickIndex) {
  if (seat === st.declarer || seat === st.dummy || !before.length) return null;
  const s = before[0].card[0];
  if (st.tricks.slice(0, trickIndex).some((t) => t.cards[0].card[0] === s)) return null;
  if (before[0].seat === partnerOf(seat)) return 'attitude';
  if (before[0].seat === st.declarer || before[0].seat === st.dummy) return 'count';
  return null;
}
// The signal card from `options` (cards that are all fine to play), given the whole holding in the suit.
export function signalCard(kind, holding, options) {
  const spots = options.filter((c) => rank(c) >= SPOT);
  if (spots.length < 2) return null;
  const high = kind === 'attitude' ? holding.some((c) => rank(c) <= 2) : holding.length % 2 === 0;
  return high ? highest(spots) : lowest(spots);
}
// Discards: a defender's first discard is a signal. A high spot card asks for that suit (we hold the A, K or Q
// in it); otherwise the lowest card of a suit we do not want (no A or K there).
const hasDiscarded = (st, seat) => [...st.tricks.map((t) => t.cards), st.current]
  .some((tr) => tr.length && tr.some((p) => p.seat === seat && p.card[0] !== tr[0].card[0] && p.card[0] !== st.trump));
export function discardSignal(st, seat, options) {
  if (seat === st.declarer || seat === st.dummy || !st.current.length || hasDiscarded(st, seat)) return null;
  const led = st.current[0].card[0];
  const pool = options.filter((c) => c[0] !== led && c[0] !== st.trump);
  if (!pool.length) return null;
  const hand = st.remaining[seat];
  const want = SUITS.filter((x) => x !== st.trump && bySuit(hand, x).some((c) => rank(c) <= 2) && bySuit(pool, x).filter((c) => rank(c) >= SPOT).length >= 1 && bySuit(hand, x).length >= 3);
  if (want.length) return highest(bySuit(pool, want[0]).filter((c) => rank(c) >= SPOT));
  const not = SUITS.filter((x) => bySuit(pool, x).length && !bySuit(hand, x).some((c) => rank(c) <= 1));
  return not.length ? lowest(bySuit(pool, not.sort((a, b) => bySuit(hand, b).length - bySuit(hand, a).length)[0])) : null;
}

// Suit preference when giving partner a ruff: the card led asks for the suit to come back for the next ruff.
// High = the higher-ranking of the other two side suits, low = the lower (where we hold the A or K).
export function suitPreferenceLead(st, seat, options) {
  if (!st.trump || seat === st.declarer || seat === st.dummy || st.current.length) return null;
  const x = options[0]?.[0];
  if (!x || x === st.trump || options.some((c) => c[0] !== x) || options.length < 2) return null;
  if (!showedOut(st, partnerOf(seat), x)) return null;
  const others = SUITS.filter((t) => t !== st.trump && t !== x); // higher-ranking first
  const hand = st.remaining[seat];
  const entry = (t) => bySuit(hand, t).some((c) => rank(c) <= 1);
  if (entry(others[0]) && !entry(others[1])) return highest(options);
  if (entry(others[1]) && !entry(others[0])) return lowest(options);
  return null;
}

// A small card to follow with: the signal when one applies, otherwise the lowest.
function smallCard(st, seat, legal) {
  const kind = signalKind(st, st.current, seat, st.tricks.length);
  const led = st.current[0]?.card[0];
  if (kind && legal.every((c) => c[0] === led)) return signalCard(kind, bySuit(st.remaining[seat], led), legal) ?? lowest(legal);
  return lowest(legal);
}

// ---------- How a robot picks a card ----------
// Simple, sound habits: lead top of a sequence or partner's suit, second hand low, third hand high,
// win as cheaply as possible, ruff when void, draw trumps and cash winners as declarer.

// Cards a seat can see: its own, dummy's once the lead is made, and everything already played.
export function visible(st, seat) {
  const own = new Set(st.remaining[seat]);
  if (seat === st.declarer || seat === st.dummy) for (const c of st.remaining[partnerOf(seat)]) own.add(c);
  else if (st.started) for (const c of st.remaining[st.dummy]) own.add(c);
  return own;
}
// Cards still out that this seat cannot see (held by the other hands).
function unseen(st, seat) {
  const seen = visible(st, seat);
  return SEATS.flatMap((s) => st.remaining[s]).filter((c) => !seen.has(c));
}
// A card nobody else can beat in its suit (higher cards are played or in our own side's visible hands).
function isMaster(st, seat, card) {
  return !unseen(st, seat).some((c) => c[0] === card[0] && rank(c) < rank(card));
}
// The cheapest card in a group of touching cards (counting cards already played as touching).
function cheapestEqual(st, cards, card) {
  const live = new Set(SEATS.flatMap((s) => st.remaining[s]));
  let best = card;
  for (let r = rank(card) + 1; r < RANKS.length; r++) {
    const c = card[0] + RANKS[r];
    if (cards.includes(c)) best = c;
    else if (live.has(c)) break;
  }
  return best;
}
const beats = (st, card, win) => {
  if (card[0] === win[0]) return rank(card) < rank(win);
  return st.trump && card[0] === st.trump;
};

// Has `seat` already failed to follow to suit `s` (so it has none left)?
export const showedOut = (st, seat, s) => [...st.tricks.map((t) => t.cards), st.current].some((tr) => tr.length && tr[0].card[0] === s && tr.some((p) => p.seat === seat && p.card[0] !== s));

// The cards a seat could play to a trick in suit `led`.
const legalAfter = (st, seat, led) => (bySuit(st.remaining[seat], led).length ? bySuit(st.remaining[seat], led) : st.remaining[seat]);

function currentWinner(st) {
  return st.current.reduce((a, b) => (beats(st, b.card, a.card) ? b : a));
}

// Suits partner has bid naturally in the auction (for the opening lead).
function partnerSuits(auction, seat) {
  const out = [];
  auction.calls.forEach((c, i) => { if (seatAt(auction, i) === partnerOf(seat) && /^[1-7][SHDC]$/.test(c)) out.push(c[1]); });
  return out;
}

function openingLead(st, seat, auction) {
  const hand = st.remaining[seat];
  const suits = SUITS.filter((s) => bySuit(hand, s).length && s !== st.trump);
  const pool = suits.length ? suits : SUITS.filter((s) => bySuit(hand, s).length);
  const ranksIn = (s) => bySuit(hand, s).map((c) => c[1]).join('');
  // Top of a sequence: AK, KQ, QJ, JT.
  for (const s of pool) {
    const r = ranksIn(s);
    if (/^(AK|KQ|QJ|JT)/.test(r)) return s + r[0];
  }
  // Partner's suit: high from a doubleton or without an honour, low from an honour.
  const ps = partnerSuits(auction, seat).reverse().find((s) => bySuit(hand, s).length);
  if (ps) {
    const cs = bySuit(hand, ps);
    return cs.length <= 2 || !/[AKQJ]/.test(ranksIn(ps)) ? highest(cs) : lowest(cs);
  }
  if (!st.trump) {
    // Notrump: fourth best from the longest and strongest suit.
    const best = [...pool].sort((a, b) => bySuit(hand, b).length - bySuit(hand, a).length || (/[AKQ]/.test(ranksIn(b)) - /[AKQ]/.test(ranksIn(a))))[0];
    const cs = bySuit(hand, best);
    return cs.length >= 4 && /[AKQJ]/.test(ranksIn(best)) ? cs[3] : cs.length >= 4 ? cs[3] : highest(cs);
  }
  // Suit contract: a singleton (with a trump to ruff), else a suit we can lead safely.
  const single = pool.find((s) => bySuit(hand, s).length === 1 && !/[AK]/.test(ranksIn(s)) && bySuit(hand, st.trump).length);
  if (single) return bySuit(hand, single)[0];
  const safe = pool.filter((s) => !/[AKQ]/.test(ranksIn(s)));
  if (safe.length) {
    const s = safe.sort((a, b) => bySuit(hand, a).length - bySuit(hand, b).length)[0];
    return highest(bySuit(hand, s));
  }
  const longest = [...pool].sort((a, b) => bySuit(hand, b).length - bySuit(hand, a).length)[0];
  return lowest(bySuit(hand, longest));
}

function leadCard(st, seat) {
  const hand = st.remaining[seat];
  const mate = partnerOf(seat);
  const ours = seat === st.declarer || seat === st.dummy;
  const mateHand = st.remaining[mate];
  if (ours) {
    if (st.trump) {
      const theirs = unseen(st, seat).filter((c) => c[0] === st.trump);
      const mine = bySuit(hand, st.trump);
      const mates = bySuit(mateHand, st.trump);
      // Draw trumps: cash the top trump, or with 8+ trumps between us drive out the missing honours.
      if (theirs.length && mine.length) {
        const top = highest([...mine, ...mates]);
        if (isMaster(st, seat, top)) return mine.includes(top) ? top : lowest(mine);
        // Top of a sequence (KQJ: the king), otherwise low towards partner's honours.
        if (mine.length + mates.length >= 8) return /^(KQ|QJ|JT)/.test(mine.map((c) => c[1]).join('')) ? mine[0] : lowest(mine);
      }
    }
    // Cash a winner.
    const master = hand.filter((c) => c[0] !== st.trump && isMaster(st, seat, c));
    if (master.length) return master[0];
    // Lead towards partner's winner.
    const toward = SUITS.find((s) => s !== st.trump && bySuit(hand, s).length && bySuit(mateHand, s).some((c) => isMaster(st, seat, c)));
    if (toward) return lowest(bySuit(hand, toward));
    // Lead a suit partner can ruff.
    if (st.trump && bySuit(mateHand, st.trump).length) {
      const ruff = SUITS.find((s) => s !== st.trump && bySuit(hand, s).length && !bySuit(mateHand, s).length);
      if (ruff) return lowest(bySuit(hand, ruff));
    }
  } else {
    // Return partner's suit.
    const led = st.tricks.map((t) => t.cards[0]).filter((p) => p.seat === mate).map((p) => p.card[0]);
    const back = led.reverse().find((s) => s !== st.trump && bySuit(hand, s).length);
    if (back) {
      const cs = bySuit(hand, back);
      return cs.length === 2 ? highest(cs) : isMaster(st, seat, highest(cs)) ? highest(cs) : lowest(cs);
    }
    const master = hand.filter((c) => c[0] !== st.trump && isMaster(st, seat, c));
    if (master.length) return master[0];
    // Through strength, up to weakness: with dummy on our left lead its strong suit; with dummy on our
    // right, a suit where it is weak. Never a suit both declarer and dummy are out of (a ruff and discard).
    const dummy = st.dummy;
    const dummyLeft = nextSeat(seat) === dummy;
    const pts = (cs) => cs.reduce((n, c) => n + Math.max(0, 4 - rank(c)), 0);
    const declVoid = (x) => showedOut(st, st.declarer, x);
    const sluff = (x) => st.trump && x !== st.trump && !bySuit(st.remaining[dummy], x).length && declVoid(x);
    const opts = SUITS.filter((x) => x !== st.trump && bySuit(hand, x).length && !sluff(x));
    if (opts.length) {
      const value = (x) => {
        const d = bySuit(st.remaining[dummy], x);
        const ruffable = st.trump && !d.length && bySuit(st.remaining[dummy], st.trump).length;
        return (dummyLeft ? pts(d) : -pts(d)) + bySuit(hand, x).length - (ruffable ? 6 : 0) - pts(bySuit(hand, x)) / 2;
      };
      const x = opts.sort((a, b) => value(b) - value(a))[0];
      const cs = bySuit(hand, x);
      return /^(AK|KQ|QJ|JT)/.test(cs.map((c) => c[1]).join('')) ? cs[0] : lowest(cs);
    }
  }
  if (ours) {
    // Develop our best suit: most cards and honours between the two hands, led low (toward partner's honours).
    const pts = (cs) => cs.reduce((n, c) => n + Math.max(0, 4 - rank(c)), 0);
    const opts = SUITS.filter((x) => x !== st.trump && bySuit(hand, x).length);
    if (opts.length) {
      const value = (x) => 2 * (bySuit(hand, x).length + bySuit(mateHand, x).length) + pts([...bySuit(hand, x), ...bySuit(mateHand, x)]);
      const x = opts.sort((a, b) => value(b) - value(a))[0];
      return lowest(bySuit(hand, x));
    }
  }
  // Otherwise low from the longest side suit.
  const side = SUITS.filter((s) => s !== st.trump && bySuit(hand, s).length);
  const s = (side.length ? side : SUITS.filter((x) => bySuit(hand, x).length)).sort((a, b) => bySuit(hand, b).length - bySuit(hand, a).length)[0];
  return lowest(bySuit(hand, s));
}

function followCard(st, seat) {
  const legal = legalCards(st, seat);
  const led = st.current[0].card[0];
  const win = currentWinner(st);
  const mateWinning = sideOf(win.seat) === sideOf(seat);
  const pos = st.current.length; // 1 = second hand, 2 = third, 3 = fourth
  const winners = legal.filter((c) => beats(st, c, win.card));
  const following = legal[0][0] === led;
  if (following) {
    if (pos === 3) return mateWinning || !winners.length ? smallCard(st, seat, legal) : lowest(winners);
    if (pos === 2) {
      // Third hand: low if partner's card already wins against what is left to play.
      // The fourth hand is an opponent; we can see its cards only when it is dummy.
      const fourth = nextSeat(seat);
      const safe = mateWinning && (fourth === st.dummy
        ? !legalAfter(st, fourth, led).some((c) => beats(st, c, win.card))
        : win.card[0] !== led || isMaster(st, seat, win.card));
      if (safe || !winners.length) return smallCard(st, seat, legal);
      // Fourth hand is dummy: beat dummy's best card as cheaply as possible.
      if (fourth === st.dummy) {
        const dummyBest = legalAfter(st, fourth, led).filter((c) => c[0] === led);
        const over = dummyBest.length ? winners.filter((c) => rank(c) < rank(highest(dummyBest))) : winners;
        return over.length ? lowest(over) : lowest(legal);
      }
      // Declarer's side finesses: the cheapest card that wins now (AQ: the queen, hoping the king is on the left).
      // A finesse: play the card with one missing card above it (AQ against the K), hoping that card is with
      // second hand, who has already played. Not when second hand has shown out, and not when the missing card
      // should drop under our top cards ("eight ever, nine never": with 9+ cards play for the drop of the queen).
      if (seat === st.declarer || seat === st.dummy) {
        const out = unseen(st, seat).filter((c) => c[0] === led);
        const second = st.current[1];
        const fin = winners.filter((c) => out.filter((o) => rank(o) < rank(c)).length === 1).sort((a, b) => rank(b) - rank(a))[0];
        if (fin && second.card[0] === led) {
          const missing = out.find((o) => rank(o) < rank(fin));
          const ourHigher = [...st.remaining[seat], ...st.remaining[partnerOf(seat)]].filter((c) => c[0] === led && rank(c) < rank(missing)).length;
          if (out.length > 2 * ourHigher) return fin;
        }
        if (fin && showedOut(st, nextSeat(seat), led)) return lowest(winners);
      }
      return cheapestEqual(st, legal, highest(winners));
    }
    // Second hand low, but cover an honour with an honour (Q with the K) when the leader's side cannot
    // hold the trick with a touching card: that promotes our lower cards.
    const lead = st.current[0];
    if (sideOf(lead.seat) !== sideOf(seat) && rank(lead.card) >= 2 && rank(lead.card) <= 4 && winners.length) {
      const leaderMate = partnerOf(lead.seat);
      const seen = leaderMate === st.dummy || lead.seat === st.dummy;
      const touching = seen && [...st.remaining[lead.seat], ...st.remaining[leaderMate]].some((c) => c[0] === led && rank(c) === rank(lead.card) + 1);
      if (!touching) return lowest(winners);
    }
    return smallCard(st, seat, legal);
  }
  // Void in the suit led.
  if (st.trump && !mateWinning) {
    const ruffs = legal.filter((c) => c[0] === st.trump && beats(st, c, win.card));
    if (ruffs.length) return lowest(ruffs);
  }
  // Discard: a signal on the first discard; otherwise the lowest card of the least useful suit (keep winners and trumps).
  const signal = discardSignal(st, seat, legal.filter((c) => !isMaster(st, seat, c)));
  if (signal) return signal;
  const discards = legal.filter((c) => c[0] !== st.trump && !isMaster(st, seat, c));
  const pool = discards.length ? discards : legal.filter((c) => c[0] !== st.trump);
  const pick = pool.length ? pool : legal;
  const weakest = SUITS.filter((s) => bySuit(pick, s).length).sort((a, b) => bySuit(pick, a).length - bySuit(pick, b).length)[0];
  return lowest(bySuit(pick, weakest));
}

// The card a robot plays for `seat` now (declarer also plays dummy). auction: for the opening lead.
export function robotCard(st, seat, auction) {
  if (!st || st.next !== seat) return undefined;
  if (st.current.length) return followCard(st, seat);
  if (!st.started) return openingLead(st, seat, auction);
  return leadCard(st, seat);
}
