// Double-dummy card play, the way strong bridge robots do it: deal the cards this player cannot see in many
// ways that fit everything known (cards played, voids shown, what the bidding showed), solve each deal
// double dummy with DDS, and play the card that takes the most tricks on average.
import { SUITS, RANKS } from '../cards.js';
import { SEATS } from '../auction.js';
import { visible, showedOut, legalCards, signalKind, signalCard, discardSignal, suitPreferenceLead } from './play.js';

const DIR = { N: 0, E: 1, S: 2, W: 3 };
const STRAIN = { S: 0, H: 1, D: 2, C: 3 };
const RANK_NUM = (r) => 14 - RANKS.indexOf(r); // A = 14 … 2 = 2
const RANK_CH = (n) => RANKS[14 - n];

// The original 13 cards of a seat in this sample: what it still holds plus what it has played.
const playedBy = (st, seat) => [...st.tricks.flatMap((t) => t.cards), ...st.current].filter((p) => p.seat === seat).map((p) => p.card);
const HCP = { A: 4, K: 3, Q: 2, J: 1 };
const hcpOf = (cards) => cards.reduce((n, c) => n + (HCP[c[1]] ?? 0), 0);

// One layout of the hidden cards, or null. Hidden seats keep their known card counts and shown voids;
// with `strict`, their whole hand must also fit what the bidding showed (HCP range and suit lengths).
function sampleOnce(st, viewer, hidden, pool, constraints, rand, strict) {
  const deck = [...pool];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const need = Object.fromEntries(hidden.map((s) => [s, st.remaining[s].length]));
  const out = Object.fromEntries(hidden.map((s) => [s, []]));
  // Cards whose suit some hidden seat is void in go first, to the seats that can take them.
  deck.sort((a, b) => hidden.filter((s) => showedOut(st, s, a[0])).length - hidden.filter((s) => showedOut(st, s, b[0])).length).reverse();
  for (const c of deck) {
    const ok = hidden.filter((s) => need[s] > 0 && !showedOut(st, s, c[0]));
    if (!ok.length) return null;
    const room = ok.reduce((n, s) => n + need[s], 0);
    let x = rand() * room;
    const s = ok.find((t) => (x -= need[t]) < 0) ?? ok[ok.length - 1];
    out[s].push(c);
    need[s]--;
  }
  if (strict && !signalsFit(st, viewer, out)) return null;
  if (strict) {
    for (const s of hidden) {
      const k = constraints?.[s];
      if (!k) continue;
      const full = [...out[s], ...playedBy(st, s)];
      const h = hcpOf(full);
      if (h < k.hcp[0] - 1 || h > k.hcp[1] + 1) return null;
      for (const suit of SUITS) {
        const n = full.filter((c) => c[0] === suit).length;
        if (n < k.len[suit][0] || n > k.len[suit][1]) return null;
      }
    }
  }
  return out;
}

// A defender reads partner's signals: in this layout, would partner have played the small cards they did?
function signalsFit(st, viewer, out) {
  if (viewer === st.declarer || viewer === st.dummy) return true;
  const mate = SEATS[(SEATS.indexOf(viewer) + 2) % 4];
  if (!out[mate]) return true;
  const plays = st.tricks.map((t) => t.cards);
  for (let ti = 0; ti < plays.length; ti++) {
    const tr = plays[ti];
    const k = tr.findIndex((p) => p.seat === mate);
    if (k <= 0 || st.tricks[ti].winner === mate) continue;
    const { card } = tr[k];
    const led = tr[0].card[0];
    if (card[0] !== led) continue;
    const kind = signalKind(st, tr.slice(0, k), mate, ti);
    if (!kind) continue;
    // Partner's cards in the suit at that moment: what they hold now (in this layout) plus what they played since.
    const later = plays.slice(ti).flat().filter((p) => p.seat === mate && p.card[0] === led).map((p) => p.card);
    const holding = [...out[mate].filter((c) => c[0] === led), ...later];
    const want = signalCard(kind, holding, holding);
    if (want && want !== card && RANKS.indexOf(card[1]) >= RANKS.indexOf('9')) return false;
  }
  // Partner's cards in suit x at trick ti: held now in this layout, plus played since.
  const held = (ti, x) => [...out[mate].filter((c) => c[0] === x), ...plays.slice(ti).flat().filter((p) => p.seat === mate && p.card[0] === x).map((p) => p.card)];
  const r = (c) => RANKS.indexOf(c[1]);
  // First discard: a high spot asks for the suit (an honour there); the lowest card says not that suit (no A or K).
  const d = plays.findIndex((tr) => tr.some((p) => p.seat === mate && p.card[0] !== tr[0].card[0] && p.card[0] !== st.trump));
  if (d >= 0) {
    const card = plays[d].find((p) => p.seat === mate).card;
    const h = held(d, card[0]);
    if (h.length >= 2) {
      const low = h.every((c) => r(c) <= r(card));
      if (low && h.some((c) => r(c) <= 1)) return false;
      if (!low && r(card) >= RANKS.indexOf('9') && !h.some((c) => r(c) <= 2)) return false;
    }
  }
  // Suit preference: partner led a suit for us to ruff. Their highest card = an entry (A or K) in the higher
  // other side suit, their lowest = in the lower one.
  if (st.trump) {
    for (let ti = 0; ti < plays.length; ti++) {
      const tr = plays[ti];
      if (tr[0].seat !== mate || tr[0].card[0] === st.trump) continue;
      const mine = tr.find((p) => p.seat === viewer);
      if (!mine || mine.card[0] !== st.trump) continue;
      const x = tr[0].card[0];
      const h = held(ti, x);
      if (h.length < 2) continue;
      const others = SUITS.filter((t) => t !== st.trump && t !== x);
      const entry = (t) => held(ti, t).some((c) => r(c) <= 1);
      if (h.every((c) => r(c) >= r(tr[0].card)) && !entry(others[0])) return false;
      if (h.every((c) => r(c) <= r(tr[0].card)) && !entry(others[1])) return false;
    }
  }
  return true;
}

export function sampleLayout(st, seat, constraints, rand) {
  const seen = visible(st, seat);
  const hidden = SEATS.filter((s) => st.remaining[s].some((c) => !seen.has(c)));
  const pool = hidden.flatMap((s) => st.remaining[s]);
  for (let i = 0; i < 400; i++) {
    const r = sampleOnce(st, seat, hidden, pool, constraints, rand, true);
    if (r) return r;
  }
  for (let i = 0; i < 200; i++) {
    const r = sampleOnce(st, seat, hidden, pool, constraints, rand, false);
    if (r) return r;
  }
  return null;
}

const pbnHand = (cards) => SUITS.map((s) => cards.filter((c) => c[0] === s).map((c) => c[1]).sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b)).join('')).join('.');

// Score every legal card on one layout: tricks for the side to play from here on.
function solve(dds, st, hands) {
  const cur = st.current;
  const first = cur.length ? cur[0].seat : st.next;
  const res = dds.SolveBoardPBN({
    trump: st.trump ? STRAIN[st.trump] : 4,
    first: DIR[first],
    currentTrickSuit: cur.map((p) => STRAIN[p.card[0]]),
    currentTrickRank: cur.map((p) => RANK_NUM(p.card[1])),
    remainCards: `N:${SEATS.map((s) => pbnHand(hands[s])).join(' ')}`,
  }, -1, 3, 1);
  const scores = {};
  for (let i = 0; i < res.cards; i++) {
    const suit = SUITS[res.suit[i]];
    scores[suit + RANK_CH(res.rank[i])] = res.score[i];
    for (let r = 2; r <= 14; r++) if (res.equals[i] & (1 << r)) scores[suit + RANK_CH(r)] = res.score[i];
  }
  return scores;
}

// The best card for `seat` (st.next) by sampling. Returns { card, samples, scores } or null.
export function ddChoose(dds, st, seat, { constraints = null, rand = Math.random, maxSamples = 24, minSamples = 6, timeMs = 1500, now = () => Date.now() } = {}) {
  const legal = legalCards(st, seat);
  if (legal.length === 1) return { card: legal[0], samples: 0 };
  // Every card the same (all small in one suit): nothing to work out.
  const total = Object.fromEntries(legal.map((c) => [c, 0]));
  const start = now();
  let n = 0;
  while (n < maxSamples && (n < minSamples || now() - start < timeMs)) {
    const layout = sampleLayout(st, seat, constraints, rand);
    if (!layout) break;
    const hands = Object.fromEntries(SEATS.map((s) => [s, layout[s] ?? st.remaining[s]]));
    const sc = solve(dds, st, hands);
    for (const c of legal) total[c] += sc[c] ?? 0;
    n++;
  }
  if (!n) return null;
  const best = Math.max(...legal.map((c) => total[c]));
  const equal = legal.filter((c) => total[c] === best);
  // Among equally good cards: a defender's signal when one applies, otherwise the lowest card.
  const kind = signalKind(st, st.current, seat, st.tricks.length);
  const led = st.current[0]?.card[0];
  const sig = (kind && equal.every((c) => c[0] === led) ? signalCard(kind, st.remaining[seat].filter((c) => c[0] === led), equal) : null)
    ?? (led && !equal.some((c) => c[0] === led) ? discardSignal(st, seat, equal) : null)
    ?? (!led ? suitPreferenceLead(st, seat, equal) : null);
  const card = sig ?? equal.sort((a, b) => RANKS.indexOf(b[1]) - RANKS.indexOf(a[1]))[0];
  return { card, samples: n, scores: Object.fromEntries(legal.map((c) => [c, total[c] / n])) };
}
