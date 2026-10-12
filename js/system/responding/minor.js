import { SUITS, NAME } from '../../cards.js';
import { splinterSuit } from './major.js';

// Responder's first bid after partner's 1♣ / 1♦ (opponents passing). One decision function, respondToMinor,
// picks the call. Notes: Part 3, "Responding to 1♣ / 1♦" and "Inverted minor raises".
const RESP = 'responding-to-1-1-tier-0';
const INV = 'inverted-minor-raises-tier-1';
const GF = '21-game-forcing-tier-0';
const RAISE = 'raising-partners-major-tier-0';
const UNPASSED = { responderPassed: false };
const PASSED = { responderPassed: true };
const WJS = { C: { D: '2D', H: '2H', S: '2S' }, D: { H: '2H', S: '2S', C: '3C' } };

const majorsOf = (e) => ['H', 'S'].filter((s) => e.len[s] >= 4);

// 4-4 majors: hearts (up the line). Otherwise the longer; 5-5 or longer: spades.
export function majorToShow(e) {
  const [h, s] = [e.len.H, e.len.S];
  if (h >= 4 && s >= 4) return s > h || (s === h && s >= 5) ? 'S' : 'H';
  return s >= 4 ? 'S' : 'H';
}

function notrump(e) {
  if (e.hcp <= 10) return '1N';
  if (e.hcp <= 12) return '2N';
  return '3N';
}

// The whole decision for responder's first bid after partner's 1♣/1♦ (opponents passing).
export function respondToMinor(e, m, passed) {
  const majors = majorsOf(e);
  const maxMajor = Math.max(e.len.H, e.len.S);
  if (!passed && !majors.length && e.len[m] >= 5 && e.hcp >= 12 && e.hcp <= 15) {
    const s = splinterSuit(e, m);
    if (s === 'H' || s === 'S') return `3${s}`;
  }
  if (!passed && e.hcp >= 12 && majors.length) {
    if (m === 'C' && e.len.D >= 5 && e.len.D > maxMajor) return '1D';
    if (m === 'D' && e.len.C >= 5 && e.len.C > maxMajor) return '2C';
  }
  if (majors.length && e.hcp >= 6) return `1${majorToShow(e)}`;
  if (!majors.length && e.balanced && e.hcp >= 6 && e.hcp <= 15 && (e.len[m] < 5 || e.hcp < 10)) return notrump(e);
  if (e.hcp >= 5 && e.hcp <= 9 && e.len[m] >= 5 && !e.balanced) return `3${m}`;
  if (e.hcp >= 2 && e.hcp <= 5) {
    const s = SUITS.find((t) => t !== m && e.len[t] >= 6);
    if (s) return WJS[m][s];
  }
  if (e.hcp < 6) return 'P';
  if (m === 'C') {
    if (e.len.D >= 4 && (e.len.D >= e.len.C || e.hcp < 10 || e.len.C < 5)) return '1D';
    if (e.hcp >= 10 && e.len.C >= 4) return '2C';
  } else {
    if (passed && e.hcp >= 10 && e.len.C >= 5 && e.len.C > e.len.D) return '2C';
    if (e.len.D >= 4 && e.hcp >= 10 && (passed || e.hcp < 12 || e.len.D >= e.len.C)) return '2D';
    if (!passed && e.hcp >= 12 && e.len.C >= 4) return '2C';
  }
  return notrump(e);
}

const M_OF = (st) => st.key[0][1];
const pick = (callFor) => (e, st) => respondToMinor(e, M_OF(st), st.ctx.responderPassed) === callFor(M_OF(st));
const fixed = (call) => pick(() => call);

function majorWhy(e, s, st) {
  const r = [`${e.len[s]} ${NAME[s]}, ${e.hcp} HCP`];
  if (e.len.H >= 4 && e.len.S >= 4) r.push(e.len.H === e.len.S ? (s === 'H' ? '4-4 in the majors: bid hearts first (up the line)' : '5-5 in the majors: bid spades first') : 'longer major first');
  if (M_OF(st) === 'C' && e.len.D > e.len[s] && e.hcp < 12) r.push('Walsh: under 12 HCP, show the major and skip the longer diamonds');
  return r;
}

function ntWhy(e, call) {
  const r = [`${e.hcp} HCP, balanced`, 'no 4-card major'];
  if (call === '2N') r.push('invitational');
  if (!e.balanced) r[0] = `${e.hcp} HCP`;
  return r;
}

const MIN = { after: ['1m'] };
const NT_MEANING = {
  '1N': ['6–10 HCP, no 4-card major. Not forcing.', [6, 10]],
  '2N': ['11–12 HCP, balanced, no 4-card major. Invitational.', [11, 12]],
  '3N': ['13–15 HCP, balanced, no 4-card major. To play.', [13, 15]],
};

const entries = [
  ...['3H', '3S'].map((call) => ({
    ...MIN, ctx: UNPASSED, call, priority: 10, notes: RAISE,
    meaning: `Splinter: 5+ {m}, singleton or void in ${NAME[call[1]]}, no 4-card major, game forcing.`,
    shows: { hcp: [12, 15], len: { m: [5, 13], [call[1]]: [0, 1] }, force: 'game' },
    pick: fixed(call),
    why: (e, st) => [`${e.len[M_OF(st)]} ${NAME[M_OF(st)]} and ${e.len[call[1]] ? 'a singleton' : 'a void'} in ${NAME[call[1]]}`, `${e.hcp} HCP: game values`],
    plan: () => `Opener with ${NAME[call[1]]} honors (wasted) heads for 3NT or game in the minor; with no waste, slam is possible.`,
  })),
  {
    after: ['1C'], call: '1D', priority: 12, notes: RESP,
    meaning: '4+ diamonds, 6+ HCP. Forcing one round. With a 4-card major, only when game forcing (12+).',
    shows: { hcp: [6, 37], len: { D: [4, 13] }, force: 'round' },
    pick: fixed('1D'),
    why: (e) => (majorsOf(e).length
      ? [`${e.hcp} HCP and ${e.len.D} diamonds: game values, so bid the longer suit first`, `show the ${NAME[majorToShow(e)]} next`]
      : [`${e.len.D} diamonds, ${e.hcp} HCP`, 'no 4-card major']),
  },
  {
    after: ['1D'], ctx: UNPASSED, call: '2C', priority: 12, notes: GF,
    meaning: '2/1 game force: 12+ HCP, 4+ clubs (usually 5+).',
    shows: { hcp: [12, 37], len: { C: [4, 13] }, force: 'game' },
    pick: fixed('2C'),
    why: (e) => [`${e.hcp} HCP: game values`, `${e.len.C} clubs${majorsOf(e).length ? `: the longer suit first, show the ${NAME[majorToShow(e)]} next` : ''}`],
  },
  {
    after: ['1D'], ctx: PASSED, call: '2C', priority: 12, notes: GF,
    meaning: 'Passed hand: natural, 5+ clubs, about 10–11. Not forcing.',
    shows: { hcp: [10, 12], len: { C: [5, 13] } },
    pick: fixed('2C'),
    why: (e) => [`${e.len.C} clubs, ${e.hcp} HCP`, 'you passed, so 2/1 is off: natural and not forcing'],
  },
  ...['H', 'S'].map((s) => ({
    ...MIN, call: `1${s}`, priority: 14, notes: RESP,
    meaning: s === 'H'
      ? '4+ hearts, 6+ HCP. Forcing one round.'
      : '4+ spades, 6+ HCP. Forcing one round. Denies 4 hearts unless spades are 5+.',
    shows: { hcp: [6, 37], len: { [s]: [4, 13] }, force: 'round' },
    pick: fixed(`1${s}`),
    why: (e, st) => [
      ...majorWhy(e, s, st),
      ...(e.len[s] >= 7 && e.hcp >= 8 ? [`a ${e.len[s]}-card suit: 1${s === 'H' ? '♥' : '♠'} is forcing, so slam stays possible and you can jump to game next turn`] : []),
    ],
    plan: (e) => (e.hcp >= 12 ? 'Game values: make sure the auction reaches game (new suits and fourth suit forcing).' : null),
    close: (e) => (e.len[s] >= 7 && e.hcp >= 8
      ? `A direct 4${s === 'H' ? '♥' : '♠'} is also reasonable with ${e.len[s]} cards: it shows a long suit, to play, and ends the auction. Prefer 1${s === 'H' ? '♥' : '♠'} when slam is possible (partner has 12–21); prefer 4${s === 'H' ? '♥' : '♠'} when you are sure nothing more is needed.`
      : null),
  })),
  // Jump to game in a major: a long suit, to play (Decoder only: the Advisor starts with the forcing 1M).
  ...['H', 'S'].map((s) => ({
    ...MIN, call: `4${s}`, priority: 19, notes: RESP,
    meaning: `Jump to game: 7+ ${NAME[s]}, to play, little interest in slam. (Proposed.)`,
    shows: { hcp: [6, 13], len: { [s]: [7, 13] } },
  })),
  ...Object.entries(NT_MEANING).map(([call, [meaning, hcp]]) => ({
    ...MIN, call, priority: 16, notes: RESP,
    meaning,
    shows: { hcp, balanced: call !== '1N' },
    pick: fixed(call),
    why: (e) => ntWhy(e, call),
  })),
  {
    ...MIN, call: '3m', priority: 18, notes: INV,
    meaning: 'Weak raise (inverted): 5–9 HCP, 5+ {m}, preemptive.',
    shows: { hcp: [5, 9], len: { m: [5, 13] } },
    pick: pick((m) => `3${m}`),
    why: (e, st) => [`${e.len[M_OF(st)]} ${NAME[M_OF(st)]}, ${e.hcp} HCP`, 'weak with long support: jump to take bidding room away'],
  },
  ...[['C', 'D'], ['D', 'C']].map(([m, other]) => ({
    after: [`1${m}`], call: `2${m}`, priority: 20, notes: INV,
    meaning: `Inverted raise: 10+ HCP, ${m === 'C' ? '5+ clubs' : '4+ diamonds'}, no 4-card major. Forcing one round.`,
    shows: { hcp: [10, 37], len: { [m]: [m === 'C' ? 5 : 4, 13], H: [0, 3], S: [0, 3] }, force: 'round' },
    pick: fixed(`2${m}`),
    why: (e) => [`${e.len[m]} ${NAME[m]}, ${e.hcp} HCP`, 'no 4-card major: the strong raise'],
    plan: () => 'Opener: 2NT = 12–14 balanced, 3NT = 18–19, new suit = stopper, 3 of the minor = minimum. With 10–12 you may pass 2NT or 3 of the minor; with 13+ go to game.',
    close: (e) => (m === 'C' && e.len.C === 4 ? `Only 4 clubs, but with no 4 ${NAME[other]} there is no better forcing bid.` : null),
  })),
  ...[['C', '2D', 'D'], ['C', '2H', 'H'], ['C', '2S', 'S'], ['D', '2H', 'H'], ['D', '2S', 'S'], ['D', '3C', 'C']].map(([m, call, s]) => ({
    after: [`1${m}`], call, priority: 22, notes: RESP,
    meaning: `Weak jump shift: 6+ ${NAME[s]}, about 2–5 HCP.`,
    shows: { hcp: [2, 5], len: { [s]: [6, 13] } },
    pick: fixed(call),
    why: (e) => [`${e.len[s]} ${NAME[s]}, ${e.hcp} HCP`, 'too weak for a normal response: your long suit will play better'],
  })),
  {
    ...MIN, call: 'P', priority: 99, notes: RESP,
    meaning: 'Too weak to respond: 0–5 HCP.',
    shows: { hcp: [0, 5] },
    pick: fixed('P'),
    why: (e) => [`${e.hcp} HCP: not enough to respond`],
  },
];

export default entries;
