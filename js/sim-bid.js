// Simulation for judgment calls: the way strong bridge robots decide when no agreement covers the hand.
// Deal the hidden hands many ways that fit the auction (point and length ranges the Decoder reads from the calls,
// checked by asking the Advisor whether each hidden player would really have made the calls they made), finish the
// auction after each candidate call, score the final contract double dummy (DDS) and total the results in IMPs.
// The Advisor's own call stays unless an alternative is clearly better on average.
import { SUITS, RANKS } from './cards.js';
import { advise, explain, summarize } from './engine.js';
import { SEATS, addCall, isComplete, nextSeat, seatAt, legalCalls, sideOf } from './auction.js';
import { packHand } from './table/model.js';
import { misfit } from './table/review.js';
import { contract, score } from './table/play.js';

const STRAIN = { S: 0, H: 1, D: 2, C: 3, N: 4 };
const DIR = { N: 0, E: 1, S: 2, W: 3 };
const HCP = { A: 4, K: 3, Q: 2, J: 1 };

// A different call replaces the Advisor's only when it gains at least this many IMPs per deal on average and
// wins on more than this share of the sampled deals.
export const MIN_GAIN = 0.75;
export const MIN_WIN = 0.52;

const IMP_TABLE = [15, 45, 85, 125, 165, 215, 265, 315, 365, 425, 495, 595, 745, 895, 1095, 1295, 1495, 1745, 1995, 2245, 2495, 2995, 3495, 3995];
export function imps(diff) {
  const d = Math.abs(diff);
  let n = 0;
  while (n < IMP_TABLE.length && d >= IMP_TABLE[n]) n++;
  return diff < 0 ? -n : n;
}

const cardsOf = (hand) => SUITS.flatMap((s) => [...hand[s]].map((r) => s + r));
const toHand = (cards) => Object.fromEntries(SUITS.map((s) => [s, cards.filter((c) => c[0] === s).map((c) => c[1]).sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b)).join('')]));
const hcpOf = (cards) => cards.reduce((n, c) => n + (HCP[c[1]] ?? 0), 0);

// What each seat has shown, as ranges (from the Decoder's reading of the calls so far).
function shownRanges(auction) {
  const rows = explain(auction, undefined, { general: true });
  return Object.fromEntries(SEATS.map((s) => [s, summarize(rows, s)]));
}

// Would this hand have made the calls this seat made, if the Advisor decided? (Not for the player asking.)
function consistent(auction, hands, seat) {
  for (let i = 0; i < auction.calls.length; i++) {
    const s = seatAt(auction, i);
    if (s === seat) continue;
    const r = advise(hands[s], { ...auction, calls: auction.calls.slice(0, i) });
    if ((r.notCovered ? 'P' : r.call) !== auction.calls[i]) return false;
  }
  return true;
}

// One layout of the other three hands, or null. strict: also check the calls against the Advisor.
export function sampleHands(auction, seat, hand, rand, { strict = true, tries = 6000, ranges = shownRanges(auction) } = {}) {
  const mine = new Set(cardsOf(hand));
  const deck = SUITS.flatMap((s) => [...RANKS].map((r) => s + r)).filter((c) => !mine.has(c));
  const hidden = SEATS.filter((s) => s !== seat);
  for (let t = 0; t < tries; t++) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const out = { [seat]: hand };
    let ok = true;
    hidden.forEach((s, k) => {
      if (!ok) return;
      const cards = deck.slice(k * 13, k * 13 + 13);
      const r = ranges[s];
      if (r?.known) {
        const h = hcpOf(cards);
        if (h < r.hcp[0] - 1 || h > r.hcp[1] + 1) { ok = false; return; }
        for (const x of SUITS) {
          const n = cards.filter((c) => c[0] === x).length;
          if (n < r.len[x][0] || n > r.len[x][1]) { ok = false; return; }
        }
      }
      out[s] = toHand(cards);
    });
    if (ok && (!strict || consistent(auction, out, seat))) return out;
  }
  return null;
}

// A contract at the 5-level or higher, bid by the side that did not make the first bid of the auction: a sacrifice
// or a competitive push. The Advisor, defending, does not double these as boldly as people do.
export function isSacrifice(a, k) {
  if (k.doubled || Number(k.bid[0]) < 5) return false;
  const first = a.calls.findIndex((c) => /^[1-7]/.test(c));
  return first >= 0 && sideOf(seatAt(a, first)) !== sideOf(k.declarer);
}

// Finish the auction with the Advisor playing every seat (no simulation inside).
function finish(hands, a) {
  for (let g = 0; g < 60 && !isComplete(a); g++) {
    const r = advise(hands[nextSeat(a)], a);
    a = addCall(a, r.notCovered ? 'P' : r.call);
  }
  return a;
}

// Tricks the declarer takes double dummy against the best defence, opening lead by the declarer's left-hand opponent.
function declarerTricks(dds, hands, k) {
  const leader = SEATS[(SEATS.indexOf(k.declarer) + 1) % 4];
  const res = dds.SolveBoardPBN({
    trump: STRAIN[k.bid[1]], first: DIR[leader], currentTrickSuit: [], currentTrickRank: [],
    remainCards: `N:${SEATS.map((s) => packHand(hands[s])).join(' ')}`,
  }, -1, 1, 1);
  return 13 - res.score[0];
}

// Calls worth testing against the Advisor's: pass, double, and bids in suits we or partner have, plus notrump and
// the games. Fewer candidates means more sampled deals in the time available.
export function candidatesFor(hand, auction, advisedCall, shown = null) {
  const legal = legalCalls(auction);
  const out = new Set([advisedCall]);
  const add = (c) => { if (legal.includes(c)) out.add(c); };
  const seat = nextSeat(auction);
  const pard = SEATS[(SEATS.indexOf(seat) + 2) % 4];
  const bids = legal.filter((c) => /^[1-7][CDHSN]$/.test(c));
  const cheapest = (s) => bids.find((c) => c[1] === s);
  const game = (s) => (s === 'N' ? '3N' : s === 'H' || s === 'S' ? `4${s}` : `5${s}`);
  add('P'); add('X');
  const pLen = shown?.[pard]?.len;
  for (const s of 'SHDC') {
    const n = hand[s].length;
    const together = n + (pLen?.[s]?.[0] ?? 0);
    if (n >= 5 || (n >= 4 && (s === 'H' || s === 'S')) || together >= 8) {
      const c = cheapest(s);
      if (c) add(c);
      if (together >= 8 || n >= 6) add(game(s));
    }
  }
  const nt = cheapest('N');
  if (nt && Number(nt[0]) <= 3) add(nt);
  add('3N');
  return [...out];
}

// A call must not claim what the hand lacks: the meaning the Decoder would give it (a stopper in their suits, a
// balanced hand, a minimum length or strength) has to fit the hand. The Advisor's own call is always kept.
export function honest(hand, auction, calls, advisedCall) {
  const rows = (c) => explain({ ...auction, calls: [...auction.calls, c] }, undefined, { general: true })[auction.calls.length];
  return calls.filter((c) => {
    if (c === advisedCall) return true;
    const row = rows(c);
    return !row || misfit(hand, row).length === 0;
  });
}

// Simulate a share of the samples: for each candidate call, the IMPs it gains against the Advisor's call (baseCall)
// summed over the sampled deals, and on how many deals it does better. One worker runs one share; shares from
// several workers are combined with mergeParts and judged with decideBid.
export function simulateParts({ hand, auction, baseCall, dds, rand = Math.random, samples = 16, minSamples = 0, timeMs = 2500, now = () => Date.now(), candidates }) {
  const seat = nextSeat(auction);
  const ranges = shownRanges(auction);
  const calls = candidates ?? honest(hand, auction, candidatesFor(hand, auction, baseCall, ranges), baseCall);
  const sums = Object.fromEntries(calls.map((c) => [c, { sum: 0, win: 0 }]));
  if (calls.length < 2) return { n: 0, sums };
  const mySide = sideOf(seat);
  const start = now();
  let n = 0;
  let misses = 0;
  while (n < samples && (n < minSamples || now() - start < timeMs) && misses < 6) {
    const hands = sampleHands(auction, seat, hand, rand, { ranges }) ?? sampleHands(auction, seat, hand, rand, { strict: false, ranges, tries: 3000 });
    if (!hands) { misses++; continue; }
    const cache = new Map();
    const result = (call) => {
      const a = finish(hands, addCall(auction, call));
      const k = contract(a);
      if (!k) return 0;
      const key = `${k.bid}${k.doubled}${k.declarer}`;
      if (!cache.has(key)) {
        const tricks = declarerTricks(dds, hands, k);
        // A sacrifice that fails would be doubled by sensible opponents, so score it doubled.
        const sc = score(isSacrifice(a, k) && tricks < Number(k.bid[0]) + 6 ? { ...k, doubled: 'X' } : k, auction.vul ?? 'none', tricks);
        cache.set(key, sideOf(k.declarer) === mySide ? sc : -sc);
      }
      return cache.get(key);
    };
    const base = result(baseCall);
    for (const c of calls) {
      const g = c === baseCall ? 0 : imps(result(c) - base);
      sums[c].sum += g;
      if (g > 0) sums[c].win++;
    }
    n++;
  }
  return { n, sums };
}

// Add the shares of several workers (a share that failed is null and is skipped).
export function mergeParts(parts) {
  const out = { n: 0, sums: {} };
  for (const p of parts) {
    if (!p?.n) continue;
    out.n += p.n;
    for (const [c, v] of Object.entries(p.sums)) {
      const t = (out.sums[c] ??= { sum: 0, win: 0 });
      t.sum += v.sum;
      t.win += v.win;
    }
  }
  return out;
}

// The decision from the combined samples.
//   call: the call to make; changed: whether it differs from the Advisor's; table: per candidate, mean IMPs gained
//   against the Advisor's call and the share of deals where it does better.
export function decideBid(baseCall, { n, sums }) {
  if (!n) return { call: baseCall, changed: false, n: 0, table: {} };
  const table = Object.fromEntries(Object.entries(sums).map(([c, v]) => [c, { gain: v.sum / n, win: v.win / n }]));
  let best = baseCall;
  for (const c of Object.keys(table)) if (c !== baseCall && table[c].gain > (table[best]?.gain ?? 0)) best = c;
  const take = best !== baseCall && table[best].gain >= MIN_GAIN && table[best].win >= MIN_WIN && n >= 8;
  return { call: take ? best : baseCall, changed: take, n, table };
}

// All in one go (for the checking tools).
export function simulateBid({ advised, ...opts }) {
  const baseCall = advised.notCovered ? 'P' : advised.call;
  return decideBid(baseCall, simulateParts({ ...opts, baseCall }));
}
