import { SUITS, NAME } from '../../cards.js';

// RKCB 1430 (whenever a suit is agreed) and the asker's continuation after Gerber.
const SLAM = 'rkcb-1430-and-slam-tools-tier-1';
const R = (call, why) => ({ call, why });
const SPLINTERS = { H: ['3S', '4C', '4D'], S: ['4C', '4D'] };

// The suit our side has agreed, or null (then 4NT is quantitative, not RKCB).
export function agreedSuit(key) {
  const ours = key.filter((t) => !t.startsWith('('));
  if (ours.some((c, i) => c === '4C' && gerberRoot(ours.slice(0, i)))) return null;
  if (/^[12]N$/.test(ours[0] ?? '') && (ours[1] === '4D' || ours[1] === '4H')) return ours[1] === '4D' ? 'H' : 'S';
  if (/^1[HS]$/.test(ours[0] ?? '') && (ours[1] === '2N' || ours[1] === '4N' || SPLINTERS[ours[0][1]].includes(ours[1]))) return ours[0][1];
  const bids = ours.map((c, i) => ({ c, who: i % 2 }))
    .filter((b, i) => /^[1-7][CDHS]$/.test(b.c) && !(i === 0 && b.c === '2C') && !(i === 1 && ours[0] === '2C' && b.c === '2D'));
  for (let i = bids.length - 1; i >= 0; i--) {
    const s = bids[i].c[1];
    if (bids.some((b) => b.who !== bids[i].who && b.c[1] === s)) return s;
  }
  return null;
}

// Gerber's 4♣ is not a raise of opener's clubs: it asks for aces directly over a natural notrump bid, the 1NT/2NT
// openings and 2♣–2♦–2NT, or a notrump rebid in an uncontested suit auction (1♦–1♠–2NT, 1♣–1♥–1NT).
export function gerberRoot(ours) {
  const last = ours.at(-1) ?? '';
  if (!/^[123]N$/.test(last)) return false;
  if (ours.length === 1) return last !== '3N';
  if (ours.length !== 3) return false;
  if (ours[0] === '2C') return ours[1] === '2D' && last === '2N';
  return /^1[CDHS]$/.test(ours[0]) && /^[1-3][CDHS]$/.test(ours[1]) && ours[0][1] !== ours[1][1];
}
const gerberKey = (n) => (key) => !key.some((t) => t.startsWith('(')) && gerberRoot(key.slice(0, key.length - n));
// The fewest points the notrump bidder can have: the asker needs this to judge a grand slam.
const ntMin = (root) => {
  if (root.length === 1) return root[0] === '1N' ? 15 : 20;
  if (root[0] === '2C') return 22;
  return { '1N': 12, '2N': 18, '3N': 19 }[root.at(-1)];
};

const keyCards = (e, T) => SUITS.filter((s) => e.hand[s].includes('A')).length + (e.hand[T].includes('K') ? 1 : 0);

export function rkcbReply(e, T) {
  const k = keyCards(e, T);
  const q = e.hand[T].includes('Q');
  if (k === 1 || k === 4) return R('5C', [`${k} key card${k === 1 ? '' : 's'}`]);
  if (k === 0 || k === 3) return R('5D', [`${k} key cards`]);
  return R(q ? '5S' : '5H', ['2 key cards', `${q ? 'with' : 'without'} the ${NAME[T].slice(0, -1)} queen`]);
}

const REPLY_SHOWS = { '5C': [1, 4], '5D': [0, 3], '5H': [2, 2], '5S': [2, 2] };
export function rkcbContinue(e, T, reply) {
  const own = keyCards(e, T);
  const [lo, hi] = REPLY_SHOWS[reply];
  const partner = own === 0 && hi + own <= 5 ? hi : lo;
  const missing = 5 - own - partner;
  const why = [`you hold ${own}, partner shows ${partner}: ${missing === 0 ? 'none' : missing} missing`];
  if (missing >= 2) {
    if (reply === `5${T}`) return R('P', [...why, 'two key cards missing: stop']);
    return R(RANK5[T] > RANK5[reply[1]] ? `5${T}` : `6${T}`, [...why, RANK5[T] > RANK5[reply[1]] ? 'two key cards missing: sign off' : 'too high to stop in 5']);
  }
  return R(`6${T}`, [...why, 'small slam']);
}
const RANK5 = { C: 0, D: 1, H: 2, S: 3 };

// The suit is agreed counting the 4NT itself (1♥–4NT is Blackwood for hearts), so the answers cut the key after it.
const isAgreed = (T) => (prefixLen) => (key) => agreedSuit(key.slice(0, key.length - prefixLen + 1)) === T;

const entries = [
  {
    tail: true, after: [], call: '4N', notes: SLAM,
    when: (key) => agreedSuit(key) !== null,
    meaning: 'RKCB 1430: asks for key cards (the four aces and the trump king) in the agreed suit.',
    shows: {},
  },
  ...SUITS.flatMap((T) => [
    ['5C', '1 or 4 key cards.'], ['5D', '0 or 3 key cards.'], ['5H', '2 key cards, without the trump queen.'], ['5S', '2 key cards, with the trump queen.'],
  ].map(([call, meaning]) => ({
    tail: true, after: ['4N'], call, variant: T, notes: SLAM, meaning, shows: {}, priority: 10,
    when: isAgreed(T)(1),
    pick: (e) => rkcbReply(e, T).call === call,
    why: (e) => rkcbReply(e, T).why,
  }))),
  ...SUITS.flatMap((T) => [
    ['P', 'Sign-off: two key cards are missing.'],
    [`5${T}`, 'Sign-off: two key cards are missing.'],
    [`6${T}`, 'Small slam.'],
  ].map(([call, meaning]) => ({
    tail: true, after: ['4N', '5x'], call, variant: T, notes: SLAM, meaning, shows: {}, priority: 10,
    when: isAgreed(T)(2),
    pick: (e, st) => rkcbContinue(e, T, st.key.at(-1)).call === call,
    why: (e, st) => rkcbContinue(e, T, st.key.at(-1)).why,
  }))),
  {
    tail: true, after: ['4N', '5x'], call: '5N', notes: SLAM,
    when: (key) => agreedSuit(key.slice(0, -1)) !== null,
    meaning: 'King ask: promises all key cards and the trump queen. Replies 6♣ = 0, 6♦ = 1, 6♥ = 2, 6♠ = 3 kings.',
    shows: {},
  },
];

// Gerber: after the ace reply, notrump by the asker is to play; with every ace and a hand that could reach 7NT, 5♣ asks for kings.
const ACES = { '4D': [0, 4], '4H': [1, 1], '4S': [2, 2], '4N': [3, 3] };
const ownAces = (e) => SUITS.filter((s) => e.hand[s].includes('A')).length;
const ownKings = (e) => SUITS.filter((s) => e.hand[s].includes('K')).length;
const rootOf = (key, n) => key.filter((t) => !t.startsWith('(')).slice(0, -n);
export function gerberContinue(e, reply, root = ['1N']) {
  const own = ownAces(e);
  const [lo, hi] = ACES[reply];
  const partner = own === 0 ? hi : lo;
  const missing = 4 - own - partner;
  const why = [`you hold ${own} ace${own === 1 ? '' : 's'}, partner ${partner}`];
  if (missing >= 2) return reply === '4N' ? R('P', [...why, 'two aces missing: stop']) : R('4N', [...why, 'two aces missing: stop in 4NT']);
  if (missing === 0 && e.hcp + ntMin(root) >= 35) return R('5C', [...why, `${e.hcp} HCP opposite at least ${ntMin(root)}: ask for kings before choosing 6NT or 7NT`]);
  return R('6N', [...why, missing ? 'one ace missing: small slam' : 'all aces: at least a small slam']);
}
const KING_STEP = { 0: '5D', 4: '5D', 1: '5H', 2: '5S', 3: '5N' };
export const kingReply = (e) => R(KING_STEP[ownKings(e)], [`${ownKings(e)} king${ownKings(e) === 1 ? '' : 's'}`]);
const KINGS = { '5D': [0, 4], '5H': [1, 1], '5S': [2, 2], '5N': [3, 3] };
export function kingsContinue(e, reply, root = ['1N']) {
  const own = ownKings(e);
  const [lo, hi] = KINGS[reply];
  const partner = own === 0 ? hi : lo;
  const missing = 4 - own - partner;
  const why = [`all four aces; you hold ${own} king${own === 1 ? '' : 's'}, partner ${partner}`];
  if (missing === 0 && e.hcp + ntMin(root) >= 37) return R('7N', [...why, `${e.hcp} HCP opposite at least ${ntMin(root)}: all the top cards`]);
  return R('6N', [...why, missing ? 'a king missing: small slam' : 'not enough extra strength for the grand slam']);
}
export const acesReply = (e) => {
  const aces = ownAces(e);
  return R({ 0: '4D', 4: '4D', 1: '4H', 2: '4S', 3: '4N' }[aces], [`${aces} ace${aces === 1 ? '' : 's'}`]);
};
for (const pre of [['1N'], ['2N'], ['2C', '2D', '2N']]) {
  for (const reply of Object.keys(ACES)) {
    const calls = reply === '4N'
      ? [['P', 'To play: two aces are missing.'], ['6N', 'To play.'], ['5C', 'Asks for kings.']]
      : [['4N', 'To play: two aces are missing.'], ['6N', 'To play.'], ['5C', 'Asks for kings.']];
    for (const [call, meaning] of calls) {
      entries.push({
        after: [...pre, '4C', reply], call, notes: SLAM, meaning, shows: {},
        priority: 10, pick: (e, st) => gerberContinue(e, reply, pre).call === call, why: (e) => gerberContinue(e, reply, pre).why,
      });
    }
  }
}

// The same after a notrump rebid (1♦–1♠–2NT–4♣), and the king ask in every Gerber auction.
entries.push({
  tail: true, after: [], call: '4C', notes: SLAM, when: gerberKey(0), meaning: 'Gerber: asks for aces.', shows: {},
});
for (const [call, meaning] of [['4D', '0 or 4 aces.'], ['4H', '1 ace.'], ['4S', '2 aces.'], ['4N', '3 aces.']]) {
  entries.push({
    tail: true, after: ['4C'], call, notes: SLAM, when: gerberKey(1), meaning, shows: {}, priority: 10,
    pick: (e) => acesReply(e).call === call, why: (e) => acesReply(e).why,
  });
}
for (const reply of Object.keys(ACES)) {
  const calls = reply === '4N'
    ? [['P', 'To play: two aces are missing.'], ['6N', 'To play.'], ['5C', 'Asks for kings.']]
    : [['4N', 'To play: two aces are missing.'], ['6N', 'To play.'], ['5C', 'Asks for kings.']];
  for (const [call, meaning] of calls) {
    entries.push({
      tail: true, after: ['4C', reply], call, notes: SLAM, when: gerberKey(2), meaning, shows: {}, priority: 10,
      pick: (e, st) => gerberContinue(e, reply, rootOf(st.key, 2)).call === call, why: (e, st) => gerberContinue(e, reply, rootOf(st.key, 2)).why,
    });
  }
  for (const [call, meaning] of [['5D', '0 or 4 kings.'], ['5H', '1 king.'], ['5S', '2 kings.'], ['5N', '3 kings.']]) {
    entries.push({
      tail: true, after: ['4C', reply, '5C'], call, notes: SLAM, when: gerberKey(3), meaning, shows: {}, priority: 10,
      pick: (e) => kingReply(e).call === call, why: (e) => kingReply(e).why,
    });
  }
  for (const kr of Object.keys(KINGS)) {
    for (const [call, meaning] of [['6N', 'Small slam.'], ['7N', 'Grand slam: every ace and king is held.']]) {
      entries.push({
        tail: true, after: ['4C', reply, '5C', kr], call, notes: SLAM, when: gerberKey(4), meaning, shows: {}, priority: 10,
        pick: (e, st) => kingsContinue(e, kr, rootOf(st.key, 4)).call === call, why: (e, st) => kingsContinue(e, kr, rootOf(st.key, 4)).why,
      });
    }
  }
}

export default entries;
