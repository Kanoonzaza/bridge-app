import { SUITS, NAME, SYMBOL, dummyPoints, quality } from '../cards.js';

const RAISE = 'raising-partners-major-tier-0';
const FNT = 'forcing-1nt-response-tier-0';
const GF = '21-game-forcing-tier-0';
const DRURY = 'drury-tier-1';
const UNPASSED = { responderPassed: false };
const PASSED = { responderPassed: true };

// Strength for a 2/1: 13+ HCP, or a good 12 (see "Exactly 12" in the notes).
export function gameForce(e, fit = false) {
  return e.hcp >= 13 || (e.hcp === 12 && quality(e, { fit }).good);
}

// The one short suit a splinter would show: a singleton (not A or K) or void outside trumps; null when there is none or two tie.
export function splinterSuit(e, trump) {
  const short = SUITS.filter((s) => s !== trump && e.len[s] <= 1 && !(e.len[s] === 1 && /[AK]/.test(e.hand[s])));
  if (!short.length) return null;
  const min = Math.min(...short.map((s) => e.len[s]));
  const best = short.filter((s) => e.len[s] === min);
  return best.length === 1 ? best[0] : null;
}

// 2/1 suit over 1M: longest eligible suit (2♥ needs 5, 2♦ 4, 2♣ 3). Equal 5+ suits: the higher; equal 4-card minors: clubs.
export function twoOverOneSuit(e, M) {
  const need = { H: 5, D: 4, C: 3 };
  const opts = (M === 'S' ? ['H', 'D', 'C'] : ['D', 'C']).filter((s) => e.len[s] >= need[s]);
  if (!opts.length) return 'C';
  const max = Math.max(...opts.map((s) => e.len[s]));
  const tied = opts.filter((s) => e.len[s] === max);
  return max >= 5 ? tied[0] : tied[tied.length - 1];
}

const SPLINTER = { H: ['3S', '4C', '4D'], S: ['4C', '4D'] };
const WJS = { H: { S: '2S', C: '3C', D: '3D' }, S: { C: '3C', D: '3D', H: '3H' } };
const hasShortness = (e, M) => SUITS.some((s) => s !== M && e.len[s] <= 1);

function weakJump(e, M) {
  if (e.hcp < 2 || e.hcp > 5) return null;
  const s = SUITS.find((t) => t !== M && e.len[t] >= 6);
  return s ? WJS[M][s] : null;
}

// The whole decision for responder's first bid after partner's 1♥/1♠ (opponents passing).
export function respondToMajor(e, M, passed) {
  const tr = e.len[M];
  const dp = dummyPoints(e, M);
  if (tr >= 4) {
    if (!passed) {
      const s = splinterSuit(e, M);
      const call = s && `${s === 'S' ? 3 : 4}${s}`;
      if (call && SPLINTER[M].includes(call) && e.hcp >= 10 && e.hcp <= 14) return call;
      if (e.hcp >= 10 && dp >= 13) return '2N';
    }
    if (tr >= 5 && hasShortness(e, M) && e.hcp <= 9 && dp >= 6) return `4${M}`;
    if (passed && dp >= 10 && e.hcp >= 7) return '2C';
    if (dp >= 10 && e.hcp >= 7) return `3${M}`;
  }
  if (tr === 3 && passed && dp >= 10 && e.hcp >= 7) return '2C';
  if (tr >= 3 && e.hcp >= 4 && dp >= 6 && (dp <= 9 || e.hcp < 7)) return `2${M}`;
  if (M === 'H' && e.len.S >= 4 && e.hcp >= 6) return '1S';
  if (!passed && gameForce(e, tr >= 3)) return `2${twoOverOneSuit(e, M)}`;
  if (passed && e.hcp >= 10) {
    const s = (M === 'S' ? ['H', 'D'] : ['D']).filter((t) => e.len[t] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
    if (s) return `2${s}`;
  }
  const wj = weakJump(e, M);
  if (wj) return wj;
  if (e.hcp >= 6) return '1N';
  return 'P';
}

const M_OF = (st) => st.key[0][1];
const pick = (call) => (e, st) => respondToMajor(e, M_OF(st), st.ctx.responderPassed) === call;
const dpWhy = (e, M) => `${dummyPoints(e, M)} dummy points with ${e.len[M]} ${NAME[M]}`;

function oneNtPlan(e, M) {
  const dp = dummyPoints(e, M);
  if (e.len[M] === 3 && dp >= 10) return `Next, jump to 3${SYMBOL[M]}: the 3-card limit raise.`;
  const long = SUITS.find((s) => s !== M && e.len[s] >= 6);
  if (long && e.hcp >= 10) return `Next, jump in ${NAME[long]} (invitational, 6+ cards).`;
  if (long) return `Next, bid ${NAME[long]} at the cheapest level (weak, to play).`;
  if (e.hcp >= 11) return 'Next, bid 2NT to invite game.';
  if (e.len[M] === 2) return `Next, pass or give preference to 2${SYMBOL[M]}.`;
  return "Next, pass partner's rebid or give simple preference.";
}

function twelveClose(e, M) {
  if (e.hcp !== 12) return null;
  const q = quality(e, { fit: e.len[M] >= 3 });
  return `Exactly 12: ${q.good ? 'a good 12' : 'a bad 12'} (${q.reasons.join(', ') || 'nothing special'}). A good 12 makes a 2/1; a bad 12 bids 1NT and invites.`;
}

function limitClose(e, M) {
  const dp = dummyPoints(e, M);
  if (dp === 10) return `Bottom of the limit raise (10 dummy points): with poor values, 2${SYMBOL[M]} is also fine.`;
  if (dp >= 13 && e.hcp < 10) return `${dp} dummy points but only ${e.hcp} HCP: too few high cards for Jacoby, so make the limit raise.`;
  if (dp === 12) return `Top of the limit raise (12): one more point and you would use Jacoby 2NT.`;
  return null;
}

const MAJ = { after: ['1M'] };

const entries = [
  {
    ...MAJ, ctx: UNPASSED, call: '2N', priority: 10, notes: RAISE,
    meaning: 'Jacoby 2NT: 4+ {M}, opening values (12+), game forcing.',
    shows: { hcp: [10, 37], len: { M: [4, 13] }, force: 'game' },
    pick: pick('2N'),
    why: (e, st) => [dpWhy(e, M_OF(st)), 'game-forcing raise: opener now describes shortness or strength'],
    plan: (e, st) => `Opener shows shortness (3 of a new suit), a good side suit (4 of a new suit), 3${SYMBOL[M_OF(st)]} = 18+, 3NT = 15–17 or 4${SYMBOL[M_OF(st)]} = minimum.`,
    close: (e, st) => (dummyPoints(e, M_OF(st)) === 13 ? 'Just 13 dummy points: Jacoby, but show no extra interest if opener signs off.' : null),
  },
  ...['4C', '4D'].map((call) => ({
    ...MAJ, ctx: UNPASSED, call, priority: 11, notes: RAISE,
    meaning: `Splinter: 4+ {M}, singleton or void in ${NAME[call[1]]}, 10–14 HCP, game forcing.`,
    shows: { hcp: [10, 14], len: { M: [4, 13], [call[1]]: [0, 1] }, force: 'game' },
    pick: pick(call),
    why: (e, st) => [`${e.len[M_OF(st)]} ${NAME[M_OF(st)]} and ${e.len[call[1]] ? 'a singleton' : 'a void'} in ${NAME[call[1]]}`, `${e.hcp} HCP: game values`],
    plan: (e, st) => `Opener with honors in ${NAME[call[1]]} (wasted) signs off in 4${SYMBOL[M_OF(st)]}; with no waste and extras, slam is on.`,
  })),
  {
    after: ['1H'], ctx: UNPASSED, call: '3S', priority: 11, notes: RAISE,
    meaning: 'Splinter: 4+ hearts, singleton or void in spades, 10–14 HCP, game forcing.',
    shows: { hcp: [10, 14], len: { H: [4, 13], S: [0, 1] }, force: 'game' },
    pick: pick('3S'),
    why: (e) => [`${e.len.H} hearts and ${e.len.S ? 'a singleton' : 'a void'} in spades`, `${e.hcp} HCP: game values`],
    plan: () => 'Opener with spade honors (wasted) signs off in 4♥; with no waste and extras, slam is on.',
  },
  {
    after: ['1S'], call: '4H', notes: RAISE,
    meaning: 'Natural, to play: long hearts (not a splinter).',
    shows: { len: { H: [7, 13] } },
  },
  {
    ...MAJ, call: '4M', priority: 12, notes: RAISE,
    meaning: 'Preemptive raise: 5+ {M}, weak (under 10 HCP), shapely.',
    shows: { hcp: [0, 9], len: { M: [5, 13] } },
    pick: pick('4M'),
    why: (e, st) => [`${e.len[M_OF(st)]} ${NAME[M_OF(st)]} with a singleton or void`, `${e.hcp} HCP: weak, so jump to game to shut out the opponents`],
  },
  {
    ...MAJ, ctx: PASSED, call: '2C', priority: 13, notes: DRURY,
    meaning: 'Drury: 3+ {M}, 10–11 points (a limit raise by a passed hand). Says nothing about clubs.',
    shows: { hcp: [7, 12], len: { M: [3, 13] }, force: 'round' },
    pick: pick('2C'),
    why: (e, st) => [dpWhy(e, M_OF(st)), 'you passed, so the limit raise goes through 2♣ (Drury)'],
    plan: (e, st) => `If opener signs off in 2${SYMBOL[M_OF(st)]} (light opening), pass${dummyPoints(e, M_OF(st)) >= 13 ? ' — or bid game anyway with your extra shape' : ''}. Anything else shows a full opening: head for game.`,
  },
  {
    ...MAJ, call: '3M', priority: 14, notes: RAISE,
    meaning: 'Limit raise: 4+ {M}, 10–12 dummy points. Invites game.',
    shows: { hcp: [7, 12], len: { M: [4, 13] } },
    pick: pick('3M'),
    why: (e, st) => [dpWhy(e, M_OF(st)), 'invitational: opener bids game with 14+'],
    close: (e, st) => limitClose(e, M_OF(st)),
  },
  {
    ...MAJ, call: '2M', priority: 15, notes: RAISE,
    meaning: 'Simple raise: 3+ {M}, 6–9 dummy points.',
    shows: { hcp: [4, 9], len: { M: [3, 13] } },
    pick: pick('2M'),
    why: (e, st) => [dpWhy(e, M_OF(st)), 'with support and a weak hand, raise before anything else'],
    close: (e, st) => (dummyPoints(e, M_OF(st)) === 9 && e.len[M_OF(st)] >= 4 ? 'Top of the simple raise: with 4 trumps and good values, 3 is also reasonable.' : null),
  },
  {
    after: ['1H'], call: '1S', priority: 16, notes: GF,
    meaning: '4+ spades, 6+ HCP. Forcing one round (any strength).',
    shows: { hcp: [6, 37], len: { S: [4, 13] }, force: 'round' },
    pick: pick('1S'),
    why: (e) => [`${e.len.S} spades, ${e.hcp} HCP`, 'over 1♥ show 4+ spades at any strength'],
    plan: (e) => (e.len.H >= 3 && dummyPoints(e, 'H') >= 10 ? 'Next, jump to 3♥ to show the 3-card limit raise.' : e.hcp >= 12 ? 'Strong hand: keep bidding to game; show it on your next bid.' : null),
  },
  ...['2C', '2D'].map((call) => ({
    ...MAJ, ctx: UNPASSED, call, priority: 20, notes: GF,
    meaning: call === '2C'
      ? '2/1 game force: 12+ HCP, 3+ clubs (usually 4+).'
      : '2/1 game force: 12+ HCP, 4+ diamonds (usually 5).',
    shows: { hcp: [12, 37], len: { [call[1]]: [call === '2C' ? 3 : 4, 13] }, force: 'game' },
    pick: pick(call),
    why: (e, st) => majorTwoWhy(e, M_OF(st), call[1]),
    plan: (e, st) => (e.len[M_OF(st)] === 3 ? `Next, support ${NAME[M_OF(st)]}: slowly (cheaply) with extras, a jump to 4${SYMBOL[M_OF(st)]} with a minimum.` : null),
    close: (e, st) => twelveClose(e, M_OF(st)),
  })),
  {
    after: ['1S'], ctx: UNPASSED, call: '2H', priority: 20, notes: GF,
    meaning: '2/1 game force: 12+ HCP, 5+ hearts.',
    shows: { hcp: [12, 37], len: { H: [5, 13] }, force: 'game' },
    pick: pick('2H'),
    why: (e) => majorTwoWhy(e, 'S', 'H'),
    plan: (e) => (e.len.S === 3 ? 'Next, support spades: slowly (cheaply) with extras, a jump to 4♠ with a minimum.' : null),
    close: (e) => twelveClose(e, 'S'),
  },
  {
    ...MAJ, ctx: PASSED, call: '2D', priority: 20, notes: GF,
    meaning: 'Passed hand: natural, 5+ diamonds, about 10–11. Non-forcing.',
    shows: { hcp: [10, 12], len: { D: [5, 13] } },
    pick: pick('2D'),
    why: (e) => [`${e.len.D} diamonds, ${e.hcp} HCP`, 'you passed, so 2/1 is off: a new suit is natural and non-forcing'],
  },
  {
    after: ['1S'], ctx: PASSED, call: '2H', priority: 20, notes: GF,
    meaning: 'Passed hand: natural, 5+ hearts, about 10–11. Non-forcing.',
    shows: { hcp: [10, 12], len: { H: [5, 13] } },
    pick: pick('2H'),
    why: (e) => [`${e.len.H} hearts, ${e.hcp} HCP`, 'you passed, so 2/1 is off: a new suit is natural and non-forcing'],
  },
  ...[['1H', '2S', 'S'], ['1H', '3C', 'C'], ['1H', '3D', 'D'], ['1S', '3C', 'C'], ['1S', '3D', 'D'], ['1S', '3H', 'H']].map(([open, call, s]) => ({
    after: [open], call, priority: 25, notes: GF,
    meaning: `Weak jump shift: 6+ ${NAME[s]}, about 2–5 HCP.`,
    shows: { hcp: [2, 5], len: { [s]: [6, 13] } },
    pick: pick(call),
    why: (e) => [`${e.len[s]} ${NAME[s]}, ${e.hcp} HCP`, 'too weak for 1NT: your long suit will play better'],
  })),
  {
    ...MAJ, ctx: UNPASSED, call: '1N', priority: 30, notes: FNT,
    meaning: 'Forcing 1NT: 6–12 HCP, no 4-card {M} support for a raise. Opener must bid again.',
    shows: { hcp: [6, 12], len: { M: [0, 3] }, force: 'round' },
    pick: pick('1N'),
    why: (e, st) => oneNtWhy(e, M_OF(st)),
    plan: (e, st) => oneNtPlan(e, M_OF(st)),
    close: (e, st) => twelveClose(e, M_OF(st)),
  },
  {
    ...MAJ, ctx: PASSED, call: '1N', priority: 30, notes: FNT,
    meaning: 'Passed hand: 6–11 HCP, natural. Not forcing.',
    shows: { hcp: [6, 11], len: { M: [0, 3] } },
    pick: pick('1N'),
    why: (e, st) => [...oneNtWhy(e, M_OF(st)), 'you passed, so 1NT is not forcing'],
  },
  {
    ...MAJ, call: 'P', priority: 99, notes: GF,
    meaning: 'Too weak to respond: 0–5 HCP.',
    shows: { hcp: [0, 5] },
    pick: pick('P'),
    why: (e, st) => [`${e.hcp} HCP${e.len[M_OF(st)] >= 3 ? `, ${dummyPoints(e, M_OF(st))} dummy points` : ''}: not enough to respond`],
  },
];

function majorTwoWhy(e, M, s) {
  const r = [`${e.hcp} HCP: enough for game opposite an opening`, `${e.len[s]} ${NAME[s]}${e.len[s] === 3 ? ': no 4-card diamonds and no 5-card hearts, so 2♣ with three' : ''}`];
  if (e.len[M] === 3) r.push(`3-card ${NAME[M]} support to show next`);
  return r;
}

function oneNtWhy(e, M) {
  const r = [`${e.hcp} HCP`];
  if (e.len[M] === 3) r.push(`3 ${NAME[M]}: ${dummyPoints(e, M) >= 10 ? 'too good for a simple raise' : 'support'}, but not enough for game`);
  else r.push(`no fit for ${NAME[M]}${M === 'H' ? ' and no 4 spades' : ''}`);
  if (e.hcp >= 11) r.push('not enough for a 2/1 game force');
  return r;
}

export default entries;
