// The SAYC base (pool question 'base', answer 'sayc'). Plan 13, phase 5. ACBL SAYC booklet (2006 revision):
//   1♥/1♠–1NT: 6–10, not forcing. The auction after it reads as after a passed hand's 1NT (js/engine.js asCard),
//     whose rules are already written: opener may pass, and every later rule follows.
//   2-over-1 (1♥–2♣/2♦, 1♠–2♣/2♦/2♥, 1♦–2♣): 10+, 4+ cards (2♥ 5+), forcing one round; responder bids again.
//   1♥/1♠–3 of the major: limit raise, 10–11 dummy points, 3+ trumps.
// Opener's rebid after a 2-over-1, and responder's second bid, are written here; later rounds fall to judgment.
import { SUITS, NAME, SYMBOL } from '../../cards.js';
import { respondToMajor } from '../responding/major.js';
import { respondToMinor } from '../responding/minor.js';

const OPT = 'base:sayc';
const GF = '21-game-forcing-tier-0';
const FNT = 'forcing-1nt-response-tier-0';
const RAISE = 'raising-partners-major-tier-0';
const UNPASSED = { responderPassed: false };
const RANK = { C: 0, D: 1, H: 2, S: 3 };
const isMajor = (s) => s === 'H' || s === 'S';
const R = (call, why) => ({ call, why });
const BID = (c) => (c[1] === 'N' ? 4 : RANK[c[1]]) + (Number(c[0]) - 1) * 5;
const above = (a, b) => BID(a) > BID(b);

const entries = [];
const response = (after, call, meaning, shows, notes, decide) => entries.push({
  after, ctx: UNPASSED, opt: OPT, call, meaning, shows, notes, priority: 10,
  pick: (e, st) => decide(e, st) === call,
  why: (e) => [`${e.hcp} HCP`],
});
function situation(after, calls, decide) {
  for (const [call, [meaning, shows = {}]] of Object.entries(calls)) {
    entries.push({
      after, ctx: UNPASSED, opt: OPT, call, meaning, shows, notes: GF, priority: 10,
      pick: (e, st) => decide(e, st).call === call,
      why: (e, st) => decide(e, st).why,
    });
  }
}
const majorCall = (e, st) => respondToMajor(e, st.key[0][1], st.ctx.responderPassed, st.sys);
const minorCall = (e, st) => respondToMinor(e, st.key[0][1], st.ctx.responderPassed, st.sys);

// ---------- Responses ----------
for (const M of ['H', 'S']) {
  response([`1${M}`], '1N', `6–10, not forcing. No 3-card ${NAME[M]} support worth a raise${M === 'H' ? ', no 4 spades' : ''}.`, { hcp: [6, 10] }, FNT, majorCall);
  response([`1${M}`], `3${M}`, `Limit raise: 3+ ${NAME[M]}, 10–11 dummy points. Invites game.`, { hcp: [7, 11], len: { [M]: [3, 13] } }, RAISE, majorCall);
  for (const r of (M === 'S' ? ['C', 'D', 'H'] : ['C', 'D'])) {
    const n = { C: 3, D: 4, H: 5 }[r];
    const text = r === 'C' ? '4+ clubs (3 with a balanced 12+ and nothing better)' : `${n}+ ${NAME[r]}`;
    response([`1${M}`], `2${r}`, `Two over one: 10+, ${text}. Forcing one round; responder bids again.`, { hcp: [10, 37], len: { [r]: [n, 13] }, force: 'round' }, GF, majorCall);
  }
}
response(['1D'], '2C', 'Two over one: 10+, 4+ clubs (3 with a balanced 11–12 and nothing better). Forcing one round; responder bids again.', { hcp: [10, 37], len: { C: [3, 13] }, force: 'round' }, GF, minorCall);

// ---------- Opener after a 2-over-1 (forcing one round) ----------
// 2 of opener's suit: 6+ or nothing better · 2NT: 12–14 balanced · 3NT: 18–19 balanced · raise: 4-card support
// (3 for a major) · new suit at the 2-level: 4+, forcing · new suit at the 3-level or a reverse: 15+ · 3 of opener's
// suit: a good 6+, 15–17.
export function saycAfterTwoOverOne(e, o, r) {
  const h = e.hcp;
  const L = e.len;
  if (L[r] >= (isMajor(r) ? 3 : 4)) return h >= 15 && isMajor(r) ? R(`4${r}`, [`${L[r]} ${NAME[r]}, ${h} HCP: game`]) : R(`3${r}`, [`${L[r]} ${NAME[r]}: raise`]);
  if (e.balanced && h >= 18) return R('3N', [`${h} HCP, balanced`]);
  if (e.balanced && h <= 14) return R('2N', [`${h} HCP, balanced`]);
  if (L[o] >= 6) return h >= 15 ? R(`3${o}`, [`${L[o]} ${NAME[o]}, ${h} HCP: invite game`]) : R(`2${o}`, [`${L[o]} ${NAME[o]}`]);
  const news = SUITS.filter((s) => s !== o && s !== r && L[s] >= 4).sort((a, b) => L[b] - L[a]);
  for (const s of news) {
    const c = newSuit(o, r, s);
    if (c[0] === '2' && RANK[s] < RANK[o]) return R(c, [`${L[s]} ${NAME[s]}: natural, forcing`]);
    if (h >= 15) return R(c, [`${L[s]} ${NAME[s]}, ${h} HCP: shows extras`]);
  }
  return R(`2${o}`, [`${L[o]} ${NAME[o]}: nothing better to say`]);
}
const newSuit = (o, r, s) => `${RANK[s] > RANK[r] ? 2 : 3}${s}`;

function openerCalls(o, r) {
  const calls = {
    [`2${o}`]: [`6+ ${NAME[o]}, or no better bid. 12–14.`, { len: { [o]: [5, 13] } }],
    [`3${o}`]: [`Good 6+ ${NAME[o]}, 15–17.`, { hcp: [15, 17], len: { [o]: [6, 13] } }],
    '2N': ['12–14 balanced.', { hcp: [12, 14], balanced: true }],
    '3N': ['18–19 balanced.', { hcp: [18, 19], balanced: true }],
    [`3${r}`]: [`Raise: ${isMajor(r) ? 3 : 4}+ ${NAME[r]}.`, { len: { [r]: [isMajor(r) ? 3 : 4, 13] } }],
  };
  if (isMajor(r)) calls[`4${r}`] = [`${NAME[r][0].toUpperCase()}${NAME[r].slice(1)} support, 15+: game.`, { hcp: [15, 21], len: { [r]: [3, 13] } }];
  for (const s of SUITS.filter((t) => t !== o && t !== r)) {
    const c = newSuit(o, r, s);
    calls[c] = [c[0] === '2' && RANK[s] < RANK[o] ? `4+ ${NAME[s]}: natural, forcing.` : `4+ ${NAME[s]}, 15+: forcing.`, { len: { [s]: [4, 13] }, force: 'round' }];
  }
  return calls;
}

// ---------- Responder's second bid ----------
// Responder has 10+ and promised to bid again: 12+ bids a game (or makes a forcing bid), 10–11 invites.
export function saycResponderAgain(e, o, r, rb) {
  const h = e.hcp;
  const L = e.len;
  if (rb === '3N' || rb === `4${r}`) return R('P', ['opener chose the game']);
  const fitO = L[o] >= (isMajor(o) ? 3 : 4) || (rb[1] === o && L[o] >= 2 && isMajor(o));
  if (h >= 12) {
    if (fitO && isMajor(o)) return R(`4${o}`, [`${L[o]} ${NAME[o]}, ${h} HCP: game`]);
    if (rb === `3${r}` && isMajor(r)) return R(`4${r}`, [`${h} HCP: game in ${NAME[r]}`]);
    return R('3N', [`${h} HCP: game`]);
  }
  if (rb === `3${r}`) return R('P', [`${h} HCP: opener raised a minimum hand: stop`]);
  if (rb === '2N') return R('P', [`${h} HCP opposite 12–14: no game`]);
  if (fitO && above(`3${o}`, rb)) return R(`3${o}`, [`${L[o]} ${NAME[o]}, ${h} HCP: invite`]);
  if (L[r] >= 6 && above(`3${r}`, rb)) return R(`3${r}`, [`${L[r]} ${NAME[r]}, ${h} HCP: invite`]);
  if (above('2N', rb)) return R('2N', [`${h} HCP: invite`]);
  return R('P', [`${h} HCP: no game`]);
}

function responderCalls(o, r, rb) {
  const calls = {
    P: ['Minimum (10–11): no game opposite this rebid.', { hcp: [10, 11] }],
    '3N': ['12+: game.', { hcp: [12, 37] }],
  };
  if (rb !== '3N' && rb !== `4${r}`) {
    if (isMajor(o)) calls[`4${o}`] = [`${NAME[o][0].toUpperCase()}${NAME[o].slice(1)} support, 12+: game.`, { hcp: [12, 37] }];
    if (isMajor(r) && rb === `3${r}`) calls[`4${r}`] = ['12+: game.', { hcp: [12, 37] }];
    if (above(`3${o}`, rb)) calls[`3${o}`] = [`${NAME[o][0].toUpperCase()}${NAME[o].slice(1)} support, 10–11: invites game.`, { hcp: [10, 11] }];
    if (above(`3${r}`, rb)) calls[`3${r}`] = [`6+ ${NAME[r]}, 10–11: invites game.`, { hcp: [10, 11], len: { [r]: [6, 13] } }];
    if (above('2N', rb)) calls['2N'] = ['10–11: invites game.', { hcp: [10, 11] }];
  } else {
    for (const k of Object.keys(calls)) if (k !== 'P') delete calls[k];
    calls.P = ['To play.', {}];
  }
  return calls;
}

for (const [o, r] of [['H', 'C'], ['H', 'D'], ['S', 'C'], ['S', 'D'], ['S', 'H'], ['D', 'C']]) {
  const opener = openerCalls(o, r);
  situation([`1${o}`, `2${r}`], opener, (e) => saycAfterTwoOverOne(e, o, r));
  for (const rb of Object.keys(opener)) situation([`1${o}`, `2${r}`, rb], responderCalls(o, r, rb), (e) => saycResponderAgain(e, o, r, rb));
}

void SYMBOL;
export default entries;
