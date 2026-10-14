// What the Advisor does when no rule of the system covers the situation. The steps run in order and
// the first one that answers decides. Every answer is marked `fallback` (the confidence tag shows
// "General judgment", except step 5, which reuses a real rule).
//
//   1. Partner has placed the contract (game or higher) and the opponents passed: pass.
//   2. Uncontested auction: general judgment (judgment.js) — points, fit, which game.
//   3. We opened, partner has only passed, they compete: opener competes (6-card suit, second suit,
//      takeout double when short, a double with 18+), or passes with 16 or less.
//   4. We opened, I (responder) have only passed, they compete: raise to the 2-level with support, or pass.
//   5. We opened and their bids took none of our room: bid as if they had passed (the quiet auction's rule).
//   6. General judgment (judgment.js).
//   7. They opened and I hold 14 or less: pass.
//   8. They opened and I hold 15+ and have not bid: show a 5-card suit, bid notrump with a stopper, or double.
//   9. Pass.
import { evaluate, pointsFor } from './cards.js';
import { legalCalls, seatAt, situationAt, sideOf } from './auction.js';
import { advise, explain, summarize } from './engine.js';
import { judge } from './judgment.js';

const GAME = /^(3N|4[HS]|5[CDHS]|[67][CDHSN])$/;
const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const pass = (why) => ({ call: 'P', meaning: 'Pass.', reasons: why, plan: null, close: null, notes: 'opening-bids-tier-0', fallback: 'pass' });

// Two meanings agree when they show the same suits at about the same length and strength.
function sameShape(a, b) {
  if (!a) return true; // no agreement in competition: assume the natural meaning
  if (!b) return false;
  const la = a.len ?? {};
  const lb = b.len ?? {};
  const keys = new Set([...Object.keys(la), ...Object.keys(lb)]);
  for (const k of keys) if (!la[k] || !lb[k] || Math.abs(la[k][0] - lb[k][0]) > 1) return false;
  if ((a.force ?? 'none') !== (b.force ?? 'none')) return false;
  return Math.abs((a.hcp?.[0] ?? 6) - (b.hcp?.[0] ?? 6)) <= 4;
}

// What a call will tell partner: the rule partner will read it by, or else its general meaning.
export function tells(auction, call, entries) {
  const row = explain({ ...auction, calls: [...auction.calls, call] }, entries, { general: true }).at(-1);
  return row.meaning ? { meaning: row.meaning, notes: row.entry?.notes ?? row.notes } : null;
}

const told = (auction, call, entries) => {
  const t = tells(auction, call, entries);
  return { meaning: t?.meaning ?? 'Natural.', notes: t?.notes ?? 'competitive-bidding-tier-0' };
};

// Does the hand fit what a call showed (about 1 HCP of slack; suit lengths exactly)?
function fitsHand(e, shows) {
  if (!shows) return true;
  const v = pointsFor(e, shows.pts);
  const lo = shows.light ? Math.min(shows.hcp?.[0] ?? 0, 10) : shows.hcp?.[0];
  if (shows.hcp && (v < lo - 1 || v > shows.hcp[1] + 1)) return false;
  return Object.entries(shows.len ?? {}).every(([suit, [lo, hi]]) => e.len[suit] >= lo && e.len[suit] <= hi);
}

// ---------- 1. Partner placed the contract ----------
function partnerPlacedGame({ s, e, auction }) {
  const last = s.key.at(-1) ?? '';
  const cueOfTheirs = s.key.some((t) => t.startsWith('(') && t[2] === last[1]);
  if (GAME.test(last) && !cueOfTheirs && e.hcp <= 19 && legalCalls(auction).includes('P')) return pass(['partner placed the contract: pass']);
  return null;
}

// ---------- 2 and 6. General judgment ----------
function judged({ s, e, auction, entries }) {
  const rows = explain(auction, entries);
  const j = judge(e, auction, rows, (seat) => summarize(rows, seat), s.key);
  if (!j) return null;
  const t = j.call === 'P' ? null : tells(auction, j.call, entries);
  return { call: j.call, meaning: t?.meaning ?? 'Pass.', reasons: j.why, plan: null, close: null, notes: t?.notes ?? (s.ctx.competitive ? 'competitive-bidding-tier-0' : '21-game-forcing-tier-0'), fallback: 'judgment' };
}

const ourCalls = (s) => s.key.filter((t) => !t.startsWith('('));
const firstSuitBid = (auction, o) => (['C', 'D', 'H', 'S'].includes(o) ? legalCalls(auction).find((c) => c[1] === o && /^[1-7]/.test(c)) : null);

// ---------- 3. We opened, partner has only passed, they compete: opener ----------
function openerAlone({ s, e, auction, entries }) {
  const ours = ourCalls(s);
  if (!(s.ctx.opened === 'us' && s.ctx.role === 'opener' && ours.slice(1).every((t) => t === 'P'))) return null;
  const o = ours[0][1];
  const call = firstSuitBid(auction, o);
  // A 6-card suit cheaply.
  if (call && e.len[o] >= 6 && Number(call[0]) <= 2 && e.hcp >= 11) {
    return { call, meaning: `6+ ${SUIT_NAME[o]}: competing for the part-score.`, reasons: [`${e.len[o]}-card suit`, 'partner is weak: compete at the 2-level'], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'compete' };
  }
  // A second 5-card suit at the 2-level, or a takeout double when short in the suit they just bid.
  const theirBids = s.key.filter((t) => /^\(\d[CDHS]\)$/.test(t)).map((t) => t.slice(1, -1));
  const theirSuits = new Set(theirBids.map((c) => c[1]));
  const lastTheirs = theirBids.at(-1);
  const legal = legalCalls(auction);
  const second = ['S', 'H', 'D', 'C'].filter((x) => x !== o && !theirSuits.has(x) && e.len[x] >= 5 && e.len[o] >= 5)
    .map((x) => legal.find((c) => c[1] === x && /^[1-7]/.test(c))).find((c) => c && Number(c[0]) <= 2);
  if (second && e.hcp >= 11) return { call: second, ...told(auction, second, entries), reasons: ['5-5: show the second suit', 'partner is weak: compete at the 2-level'], plan: null, close: null, fallback: 'compete' };
  if (lastTheirs && Number(lastTheirs[0]) <= 2 && e.len[lastTheirs[1]] <= 1 && e.hcp >= 13 && legal.includes('X')) {
    return { call: 'X', ...told(auction, 'X', entries), reasons: [`${e.len[lastTheirs[1]]} card${e.len[lastTheirs[1]] === 1 ? '' : 's'} in their suit, ${e.hcp} HCP`, 'takeout double: partner chooses'], plan: null, close: null, fallback: 'compete' };
  }
  // A strong opener (18+) does not sell out at a low level: double to show the values (partner passes for
  // penalty or bids); with 15–17 and a 6-card suit, compete at the 3-level.
  if (lastTheirs && Number(lastTheirs[0]) <= 3 && e.hcp >= 18 && legal.includes('X')) {
    return { call: 'X', ...told(auction, 'X', entries), reasons: [`${e.hcp} HCP: far too strong to let them play a part-score`, 'double shows the extra values: partner passes for penalty or bids'], plan: 'Next: notrump with stoppers in their suits, or your long suit.', close: null, fallback: 'compete' };
  }
  if (call && e.len[o] >= 6 && Number(call[0]) <= 3 && e.hcp >= 15) {
    return { call, ...told(auction, call, entries), reasons: [`${e.len[o]}-card suit and ${e.hcp} HCP`, 'extra values: compete at the 3-level'], plan: null, close: null, fallback: 'compete' };
  }
  if (e.hcp <= 16) return pass([`${e.hcp} HCP and partner passed: let them play`]);
  return null;
}

// ---------- 4. We opened, I (responder) have only passed, they compete ----------
function passedResponder({ s, e, auction }) {
  const ours = ourCalls(s);
  if (!(s.ctx.opened === 'us' && s.ctx.role === 'responder' && ours.slice(1).every((t) => t === 'P') && ours.length > 1)) return null;
  const o = ours[0][1];
  const call = firstSuitBid(auction, o);
  if (call && Number(call[0]) <= 2 && e.len[o] >= (o === 'H' || o === 'S' ? 3 : 4) && e.hcp >= 5) {
    return { call, meaning: 'Competitive raise.', reasons: [`${e.len[o]}-card support`, 'compete for the part-score'], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'compete' };
  }
  if (e.hcp <= 10) return pass([`${e.hcp} HCP: nothing to add`]);
  return null;
}

// ---------- 5. Their bids took none of our room: bid as if they had passed ----------
function asIfTheyPassed({ s, e, hand, auction, entries }) {
  if (s.ctx.opened !== 'us') return null;
  const n = auction.calls.length;
  const side = sideOf(s.actor);
  const calls = auction.calls.map((c, i) => (sideOf(seatAt(auction, i)) !== side && c !== 'P' ? 'P' : c));
  const quiet = { dealer: auction.dealer, calls };
  const r = situationAt(quiet, n).ctx.competitive ? null : advise(hand, quiet, entries);
  // Only when every call our side made means the same without their interference.
  const real = explain(auction, entries);
  const calm = explain(quiet, entries);
  const same = real.every((row, i) => sideOf(row.seat) !== side || row.call === 'P' || sameShape(row.shows, calm[i].shows));
  // My own earlier calls must also describe this hand: if I bid 2NT (18-19) with 12 HCP, the quiet auction's
  // advice would follow from a hand I do not hold.
  const honest = real.every((row, i) => row.seat !== s.actor || row.call === 'P' || fitsHand(e, calm[i].shows));
  const lastBid = auction.calls.map((c, i) => [c, i]).filter(([c]) => /^[1-7]/.test(c)).at(-1);
  const theyOutbid = lastBid && sideOf(seatAt(auction, lastBid[1])) !== side;
  if (same && honest && r && !r.notCovered && !r.fallback && !theyOutbid && legalCalls(auction).includes(r.call)) {
    return { ...r, reasons: [...r.reasons, "the opponents' bids took none of our room: bid as if they had passed"], fallback: 'quiet' };
  }
  return null;
}

// ---------- 7. They opened and my hand is modest ----------
const modestOverTheirOpening = ({ s, e }) => (s.ctx.opened === 'them' && e.hcp <= 14 ? pass([`${e.hcp} HCP and no clear action: pass`]) : null);

// ---------- 8. They opened and I have a strong hand I have not shown ----------
function strongOverTheirOpening({ s, e, auction, entries }) {
  const firstBid = auction.calls.findIndex((x) => /^[1-7]/.test(x));
  const iBid = auction.calls.some((c, i) => seatAt(auction, i) === s.actor && /^[1-7]/.test(c) && i >= firstBid && sideOf(seatAt(auction, firstBid)) !== sideOf(s.actor));
  // "Strong" is relative to their opening: over their 1NT, 2NT or strong 2♣, 15+ is not a strong hand.
  if (['1N', '2N', '2C'].includes(auction.calls[firstBid])) return null;
  if (!(e.hcp >= 15 && !iBid && s.ctx.opened === 'them')) return null;
  const theirs = new Set(s.key.filter((t) => t.startsWith('(') && /\d/.test(t)).map((t) => t[2]));
  const legal = legalCalls(auction);
  const suit = ['S', 'H', 'D', 'C'].filter((x) => !theirs.has(x) && e.len[x] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
  const bid = suit && legal.find((c) => c[1] === suit && /^[1-4]/.test(c));
  if (bid) return { call: bid, meaning: `Natural: 5+ ${SUIT_NAME[suit]}, a strong hand.`, reasons: [`${e.hcp} HCP and ${e.len[suit]} cards: bid again voluntarily (17+)`], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'strong' };
  // Double only when short in their suit (partner will take it out); with length and a stopper, notrump.
  const their = [...s.key].reverse().find((t) => /^\(\d[CDHS]\)$/.test(t))?.[2];
  const stop = their && (/A/.test(e.hand[their]) || (/K/.test(e.hand[their]) && e.len[their] >= 2) || (/Q/.test(e.hand[their]) && e.len[their] >= 3));
  const nt = legal.find((c) => c[1] === 'N' && /^[1-3]/.test(c));
  if (their && e.len[their] >= 3 && stop && nt) return { call: nt, ...told(auction, nt, entries), reasons: [`${e.hcp} HCP with ${e.len[their]} cards and a stopper in their suit: notrump, not a takeout double`], plan: null, close: null, fallback: 'strong' };
  if (legal.includes('X') && e.hcp >= 17 && (!their || e.len[their] <= 2)) return { call: 'X', meaning: 'Double: a strong hand.', reasons: [`${e.hcp} HCP: double to show strength`], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'strong' };
  return null;
}

export function fallback(hand, auction, entries) {
  const s = situationAt(auction, auction.calls.length);
  const ctx = { s, e: evaluate(hand), hand, auction, entries };
  const placed = partnerPlacedGame(ctx);
  if (placed) return placed;
  // Uncontested: judgment answers, or nothing does.
  if (!s.ctx.competitive) return judged(ctx);
  for (const step of [openerAlone, passedResponder, asIfTheyPassed, judged, modestOverTheirOpening, strongOverTheirOpening]) {
    const r = step(ctx);
    if (r) return r;
  }
  return pass([`${ctx.e.hcp} HCP: no clear action, so pass`]);
}
