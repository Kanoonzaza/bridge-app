import { SUITS, NAME } from '../cards.js';

// RKCB 1430 (whenever a suit is agreed) and the asker's continuation after Gerber.
const SLAM = 'rkcb-1430-and-slam-tools-tier-1';
const R = (call, why) => ({ call, why });
const SPLINTERS = { H: ['3S', '4C', '4D'], S: ['4C', '4D'] };

// The suit our side has agreed, or null (then 4NT is quantitative, not RKCB).
export function agreedSuit(key) {
  const ours = key.filter((t) => !t.startsWith('('));
  if (/^[12]N$/.test(ours[0] ?? '') && (ours[1] === '4D' || ours[1] === '4H')) return ours[1] === '4D' ? 'H' : 'S';
  if (/^1[HS]$/.test(ours[0] ?? '') && (ours[1] === '2N' || SPLINTERS[ours[0][1]].includes(ours[1]))) return ours[0][1];
  const bids = ours.map((c, i) => ({ c, who: i % 2 }))
    .filter((b, i) => /^[1-7][CDHS]$/.test(b.c) && !(i === 0 && b.c === '2C') && !(i === 1 && ours[0] === '2C' && b.c === '2D'));
  for (let i = bids.length - 1; i >= 0; i--) {
    const s = bids[i].c[1];
    if (bids.some((b) => b.who !== bids[i].who && b.c[1] === s)) return s;
  }
  return null;
}

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

const isAgreed = (T) => (prefixLen) => (key) => agreedSuit(key.slice(0, key.length - prefixLen)) === T;

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
    when: (key) => agreedSuit(key.slice(0, -2)) !== null,
    meaning: 'King ask: promises all key cards and the trump queen. Replies 6♣ = 0, 6♦ = 1, 6♥ = 2, 6♠ = 3 kings.',
    shows: {},
  },
];

// Gerber: after the ace reply, notrump by the asker is to play.
const ACES = { '4D': [0, 4], '4H': [1, 1], '4S': [2, 2], '4N': [3, 3] };
export function gerberContinue(e, reply) {
  const own = SUITS.filter((s) => e.hand[s].includes('A')).length;
  const [lo, hi] = ACES[reply];
  const partner = own === 0 ? hi : lo;
  const missing = 4 - own - partner;
  const why = [`you hold ${own} ace${own === 1 ? '' : 's'}, partner ${partner}`];
  if (missing >= 2) return reply === '4N' ? R('P', [...why, 'two aces missing: stop']) : R('4N', [...why, 'two aces missing: stop in 4NT']);
  return R('6N', [...why, missing ? 'one ace missing: small slam' : 'all aces: at least a small slam']);
}
for (const pre of [['1N'], ['2N'], ['2C', '2D', '2N']]) {
  for (const reply of Object.keys(ACES)) {
    const calls = reply === '4N'
      ? [['P', 'To play: two aces are missing.'], ['6N', 'To play.'], ['5C', 'Asks for kings.']]
      : [['4N', 'To play: two aces are missing.'], ['6N', 'To play.'], ['5C', 'Asks for kings.']];
    for (const [call, meaning] of calls) {
      entries.push({
        after: [...pre, '4C', reply], call, notes: SLAM, meaning, shows: {},
        ...(call === '5C' ? {} : { priority: 10, pick: (e) => gerberContinue(e, reply).call === call, why: (e) => gerberContinue(e, reply).why }),
      });
    }
  }
}

export default entries;
