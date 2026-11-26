// Pool question 'keycard' (4NT): Blackwood. Plan 13, task 4.13; DOPI over interference (owner, 2026-11-15).
//   4NT, a suit agreed: asks for aces. Replies 5♣ = 0 or 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.
//   The asker: two aces missing = stop in five; one missing = small slam; none missing = small slam (5NT asks for kings).
//   They bid over 4NT: double = 0 aces, pass = 1, the next step = 2 (DOPI). They double: redouble = 0, pass = 1 (ROPI).
// The asks that sit inside particular auctions keep their RKCB rules; the engine words them for the card
// (js/engine.js onCard), and the answers are these tail rules.
import { SUITS, NAME } from '../../cards.js';
import { agreedSuit } from '../rebids/slam.js';

const OPT = 'keycard:blackwood';
const SLAM = 'rkcb-1430-and-slam-tools-tier-1';
const R = (call, why) => ({ call, why });
const RANK5 = { C: 0, D: 1, H: 2, S: 3 };
const aces = (e) => SUITS.filter((s) => e.hand[s].includes('A')).length;

export function blackwoodReply(e) {
  const a = aces(e);
  return R({ 0: '5C', 4: '5C', 1: '5D', 2: '5H', 3: '5S' }[a], [`${a} ace${a === 1 ? '' : 's'}`]);
}

const SHOWS = { '5C': [0, 4], '5D': [1, 1], '5H': [2, 2], '5S': [3, 3] };
export function blackwoodContinue(e, T, reply) {
  const own = aces(e);
  const [lo, hi] = SHOWS[reply];
  const partner = own === 0 ? hi : lo;
  const missing = 4 - own - partner;
  const why = [`you hold ${own}, partner shows ${partner}: ${missing === 0 ? 'none' : missing} missing`];
  if (missing >= 2) {
    if (reply === `5${T}`) return R('P', [...why, 'two aces missing: stop']);
    return R(RANK5[T] > RANK5[reply[1]] ? `5${T}` : `6${T}`, [...why, RANK5[T] > RANK5[reply[1]] ? 'two aces missing: sign off' : 'too high to stop in five']);
  }
  return R(`6${T}`, [...why, 'small slam']);
}

const agreed = (key) => agreedSuit(key) !== null;
const agreedIs = (T, cut) => (key) => agreedSuit(key.slice(0, key.length - cut)) === T;

const entries = [
  {
    tail: true, after: [], call: '4N', notes: SLAM, opt: OPT, when: agreed,
    meaning: 'Blackwood: asks for aces (a suit is agreed).', shows: {},
  },
  ...[['5C', '0 or 4 aces.'], ['5D', '1 ace.'], ['5H', '2 aces.'], ['5S', '3 aces.']].map(([call, meaning]) => ({
    tail: true, after: ['4N'], call, notes: SLAM, opt: OPT, meaning, shows: {}, priority: 10,
    when: (key) => agreedSuit(key) !== null,
    pick: (e) => blackwoodReply(e).call === call,
    why: (e) => blackwoodReply(e).why,
  })),
  ...SUITS.flatMap((T) => [
    ['P', 'Sign-off: two aces are missing.'],
    [`5${T}`, 'Sign-off: two aces are missing.'],
    [`6${T}`, 'Small slam.'],
  ].map(([call, meaning]) => ({
    tail: true, after: ['4N', '5x'], call, variant: T, notes: SLAM, opt: OPT, meaning, shows: {}, priority: 10,
    when: agreedIs(T, 1),
    pick: (e, st) => blackwoodContinue(e, T, st.key.at(-1)).call === call,
    why: (e, st) => blackwoodContinue(e, T, st.key.at(-1)).why,
  }))),
  {
    tail: true, after: ['4N', '5x'], call: '5N', notes: SLAM, opt: OPT, when: (key) => agreedSuit(key.slice(0, -1)) !== null,
    meaning: 'King ask: promises all four aces. Replies 6♣ = 0 or 4, 6♦ = 1, 6♥ = 2, 6♠ = 3 kings.', shows: {},
  },
  // Interference: DOPI over their bid, ROPI over their double.
  { tail: true, after: ['4N', '(X)'], call: 'XX', notes: SLAM, opt: OPT, meaning: 'Blackwood after their double: 0 aces (ROPI).', shows: {}, when: (key) => agreedSuit(key.slice(0, -1)) !== null },
  { tail: true, after: ['4N', '(X)'], call: 'P', notes: SLAM, opt: OPT, meaning: 'Blackwood after their double: 1 ace (ROPI).', shows: {}, when: (key) => agreedSuit(key.slice(0, -1)) !== null },
  { tail: true, after: ['4N', '(5x)'], call: 'X', notes: SLAM, opt: OPT, meaning: 'Blackwood after their bid: 0 aces (DOPI).', shows: {}, when: (key) => agreedSuit(key.slice(0, -1)) !== null },
  { tail: true, after: ['4N', '(5x)'], call: 'P', notes: SLAM, opt: OPT, meaning: 'Blackwood after their bid: 1 ace (DOPI).', shows: {}, when: (key) => agreedSuit(key.slice(0, -1)) !== null },
];

void NAME;
export default entries;

// ---------- RKCB 0314 (pool question 'keycard', answer 'rkcb-0314'): 1430 with the two lowest replies swapped ----------
//   5♣ = 0 or 3 key cards · 5♦ = 1 or 4 · 5♥ = 2 without the trump queen · 5♠ = 2 with it. Interference as for 1430.
const O314 = 'keycard:rkcb-0314';
const keyCards = (e, T) => SUITS.filter((s) => e.hand[s].includes('A')).length + (e.hand[T].includes('K') ? 1 : 0);
export function rkcb0314Reply(e, T) {
  const k = keyCards(e, T);
  const q = e.hand[T].includes('Q');
  if (k === 0 || k === 3) return R('5C', [`${k} key cards`]);
  if (k === 1 || k === 4) return R('5D', [`${k} key card${k === 1 ? '' : 's'}`]);
  return R(q ? '5S' : '5H', ['2 key cards', `${q ? 'with' : 'without'} the ${NAME[T].slice(0, -1)} queen`]);
}
const SHOWS_0314 = { '5C': [0, 3], '5D': [1, 4], '5H': [2, 2], '5S': [2, 2] };
export function rkcb0314Continue(e, T, reply) {
  const own = keyCards(e, T);
  const [lo, hi] = SHOWS_0314[reply];
  const partner = own === 0 && hi + own <= 5 ? hi : lo;
  const missing = 5 - own - partner;
  const why = [`you hold ${own}, partner shows ${partner}: ${missing === 0 ? 'none' : missing} missing`];
  if (missing >= 2) {
    if (reply === `5${T}`) return R('P', [...why, 'two key cards missing: stop']);
    return R(RANK5[T] > RANK5[reply[1]] ? `5${T}` : `6${T}`, [...why, RANK5[T] > RANK5[reply[1]] ? 'two key cards missing: sign off' : 'too high to stop in five']);
  }
  return R(`6${T}`, [...why, 'small slam']);
}
const agreedAfter = (key) => agreedSuit(key.slice(0, -1)) !== null;
entries.push(
  { tail: true, after: [], call: '4N', notes: SLAM, opt: O314, when: agreed, meaning: 'RKCB 0314: asks for key cards (the four aces and the trump king) in the agreed suit.', shows: {} },
  ...SUITS.flatMap((T) => [['5C', '0 or 3 key cards.'], ['5D', '1 or 4 key cards.'], ['5H', '2 key cards, without the trump queen.'], ['5S', '2 key cards, with the trump queen.']]
    .map(([call, meaning]) => ({
      tail: true, after: ['4N'], call, variant: T, notes: SLAM, opt: O314, meaning, shows: {}, priority: 10,
      when: (key) => agreedSuit(key) === T,
      pick: (e) => rkcb0314Reply(e, T).call === call,
      why: (e) => rkcb0314Reply(e, T).why,
    }))),
  ...SUITS.flatMap((T) => [['P', 'Sign-off: two key cards are missing.'], [`5${T}`, 'Sign-off: two key cards are missing.'], [`6${T}`, 'Small slam.']]
    .map(([call, meaning]) => ({
      tail: true, after: ['4N', '5x'], call, variant: T, notes: SLAM, opt: O314, meaning, shows: {}, priority: 10,
      when: agreedIs(T, 1),
      pick: (e, st) => rkcb0314Continue(e, T, st.key.at(-1)).call === call,
      why: (e, st) => rkcb0314Continue(e, T, st.key.at(-1)).why,
    }))),
  { tail: true, after: ['4N', '5x'], call: '5N', notes: SLAM, opt: O314, when: agreedAfter, meaning: 'King ask: promises all key cards and the trump queen. Replies 6♣ = 0, 6♦ = 1, 6♥ = 2, 6♠ = 3 kings.', shows: {} },
  { tail: true, after: ['4N', '(X)'], call: 'XX', notes: SLAM, opt: O314, when: agreedAfter, meaning: 'RKCB after their double: 0 or 3 key cards.', shows: {} },
  { tail: true, after: ['4N', '(X)'], call: 'P', notes: SLAM, opt: O314, when: agreedAfter, meaning: 'RKCB after their double: 1 or 4 key cards.', shows: {} },
  { tail: true, after: ['4N', '(5x)'], call: 'X', notes: SLAM, opt: O314, when: agreedAfter, meaning: 'RKCB after their bid: 0 or 3 key cards.', shows: {} },
  { tail: true, after: ['4N', '(5x)'], call: 'P', notes: SLAM, opt: O314, when: agreedAfter, meaning: 'RKCB after their bid: 1 or 4 key cards.', shows: {} },
);
