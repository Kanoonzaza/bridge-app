import { SUITS, NAME, ruleOf20, ruleOf15 } from '../cards.js';

const NOTES = 'opening-bids-tier-0';
const NT_NOTES = '1nt-opening-and-responses-tier-0';
const OPEN = { after: [], ctx: { role: 'opening' } };
const honorsIn = (e, s) => [...e.hand[s]].filter((r) => 'AKQJ'.includes(r)).length;
const longest = (e) => SUITS.find((s) => e.len[s] === e.pattern[0]);

export function openingSuit(e) {
  const max = e.pattern[0];
  if (max >= 5) return SUITS.find((s) => e.len[s] === max); // SUITS run S,H,D,C: first hit is the higher suit
  if (e.len.D >= 4) return 'D';
  if (e.len.S === 4 && e.len.H === 4 && e.len.D === 3) return 'D';
  return 'C';
}

export function openable(e, seat) {
  if (e.hcp > 21) return false;
  if (seat === 4) return e.hcp >= 14 || (e.hcp >= 9 && ruleOf15(e) >= 15);
  if (e.hcp < 10) return false;
  if (e.hcp >= 12) return true;
  if (seat === 3 && SUITS.some((s) => e.len[s] >= 5 && e.good[s])) return true;
  return ruleOf20(e) >= 20;
}

export function isStrong(e) {
  if (e.hcp >= 22) return true;
  const s = longest(e);
  return e.ltc <= 3 && e.hcp >= 18 && e.pattern[0] >= 6 && (s === 'S' || s === 'H') && e.good[s];
}

export function gamblingSuit(e) {
  for (const s of ['C', 'D']) {
    if (e.hcp <= 14 && e.len[s] >= 7 && e.hand[s].startsWith('AKQ') && !SUITS.some((t) => t !== s && /[AK]/.test(e.hand[t]))) return s;
  }
  return null;
}

// Vulnerable: a sound preempt (7+ HCP, two of the top three honors). Favorable (they are vulnerable, we are not): as light as 4 HCP.
const preemptOk = (e, s, vul) => (vul === 'we' || vul === 'both' ? e.hcp >= 7 && e.good[s] : true);
const minPreempt = (vul) => (vul === 'they' ? 4 : 5);

export function weakTwoSuit(e, seat, vul = 'none') {
  if (seat === 4 || e.hcp < minPreempt(vul) || e.hcp > 10) return null;
  const s = ['S', 'H', 'D'].find((t) => e.len[t] === 6);
  if (!s || honorsIn(e, s) < 2 || !preemptOk(e, s, vul)) return null;
  if (seat <= 2 && (['S', 'H'].some((m) => m !== s && e.len[m] >= 4) || e.pattern[3] === 0 || SUITS.some((t) => t !== s && e.len[t] >= 5))) return null;
  return s;
}

export function preemptCall(e, seat, vul = 'none') {
  if (seat === 4 || e.hcp > 10) return null;
  const s = SUITS.find((t) => e.len[t] >= 7);
  if (!s || honorsIn(e, s) < 2 || !preemptOk(e, s, vul)) return null;
  return `${e.len[s] >= 8 ? 4 : 3}${s}`;
}

function oneLevelWhy(e, seat, s) {
  const r = [`${e.hcp} HCP`];
  const tied = SUITS.filter((t) => e.len[t] === e.pattern[0]).length > 1;
  if (e.len[s] >= 5) r.push(`${e.len[s]}-card ${NAME[s]}${tied ? ' (equal long suits: open the higher)' : ''}`);
  else if (s === 'D' && e.len.D === 3) r.push('4♠ 4♥ 3♦ 2♣: the one hand that opens 1♦ with three');
  else r.push(`no 5-card suit: open the ${s === 'D' ? 'diamonds (4+)' : 'clubs (3+)'}`);
  if (seat === 4) r.push(e.hcp >= 14 ? '14+ HCP: always open in 4th seat' : `Rule of 15: ${e.hcp} + ${e.len.S} spades = ${ruleOf15(e)}`);
  else if (e.hcp < 12 && ruleOf20(e) >= 20) r.push(`Rule of 20: ${e.hcp} + ${e.pattern[0]} + ${e.pattern[1]} = ${ruleOf20(e)}`);
  else if (e.hcp < 12) r.push('light 3rd-seat opening with a good suit');
  return r;
}

function oneLevelClose(e, seat) {
  if (e.pattern.join('') === '4441') return 'Three 4-card suits: open 1♦, or 1♣ when the singleton is a diamond.';
  if (seat <= 2 && e.hcp < 12 && ruleOf20(e) === 20) return 'Exactly 20 on the Rule of 20: open, but treat it as a light opening.';
  return null;
}

function passWhy(e, seat, vul = 'none') {
  if ((vul === 'we' || vul === 'both') && (weakTwoSuit(e, seat) || preemptCall(e, seat))) return ['vulnerable: a preempt needs 7+ HCP and two of the top three honors'];
  if (seat === 4) {
    if (e.hcp >= 9) {
      return [`Rule of 15: ${e.hcp} + ${e.len.S} spades = ${ruleOf15(e)}, short of 15`, 'in 4th seat, passing scores 0 instead of letting the opponents win the part-score'];
    }
    return [`${e.hcp} HCP: not enough to open`, 'never preempt in 4th seat'];
  }
  const s = longest(e);
  const L = e.pattern[0];
  const nm = NAME[s];
  if (L === 6 && s === 'C') return ['6-card clubs: we have no weak 2♣ (2♣ is strong)'];
  if (L === 6 && e.hcp >= 5 && e.hcp <= 10 && honorsIn(e, s) >= 2 && seat <= 2) {
    if (['S', 'H'].some((m) => m !== s && e.len[m] >= 4)) return [`6-card ${nm}, but a 4-card side major rules out a weak two in 1st/2nd seat`];
    if (e.pattern[3] === 0) return [`6-card ${nm}, but a void rules out a weak two in 1st/2nd seat`];
    if (SUITS.some((t) => t !== s && e.len[t] >= 5)) return [`6-card ${nm}, but a 5-card side suit rules out a weak two in 1st/2nd seat`];
  }
  if (L >= 6 && honorsIn(e, s) < 2) return [`${L}-card ${nm} too weak to preempt (needs two of A K Q J)`];
  if (L >= 6 && e.hcp < 5) return [`${e.hcp} HCP: too weak even for a weak two`];
  if (L === 6 && e.hcp === 11) return ['11 HCP: too strong for a weak two, short of the Rule of 20'];
  const r = [`${e.hcp} HCP${e.hcp >= 10 ? `, Rule of 20 total ${ruleOf20(e)}` : ''}: not enough to open`];
  if (L < 6) r.push('no 6+ card suit to preempt');
  return r;
}

function passClose(e, seat) {
  if (seat <= 2 && e.hcp >= 10 && ruleOf20(e) === 19) return 'One short of the Rule of 20 (19): pass.';
  if (seat === 4 && e.hcp >= 9 && e.hcp < 14 && ruleOf15(e) === 14) return 'One short of the Rule of 15 (14): pass.';
  return null;
}

const ONE_MEANING = {
  S: '5+ spades, 12–21.',
  H: '5+ hearts, 12–21.',
  D: '4+ diamonds (3 only with exactly 4♠ 4♥ 3♦ 2♣), 12–21.',
  C: '3+ clubs, 12–21.',
};

const entries = [
  {
    ...OPEN, call: '2N', priority: 5, notes: NT_NOTES,
    meaning: '20–21 balanced.',
    shows: { hcp: [20, 21], balanced: true },
    pick: (e) => e.balanced && e.hcp >= 20 && e.hcp <= 21,
    why: (e) => [`${e.hcp} HCP, balanced`],
  },
  {
    ...OPEN, call: '2C', priority: 6, notes: 'strong-2-opening-tier-2',
    meaning: 'Strong and artificial: 22+ HCP, or about 9 playing tricks. Says nothing about clubs.',
    shows: { hcp: [22, 37], force: 'game' },
    pick: (e) => isStrong(e),
    why: (e) => (e.hcp >= 22 ? [`${e.hcp} HCP`] : [`${e.hcp} HCP with a strong ${e.pattern[0]}-card ${NAME[longest(e)]} suit and only ${e.ltc} losers: about 9 playing tricks`]),
  },
  {
    ...OPEN, call: '3N', priority: 8, notes: NT_NOTES,
    meaning: 'Gambling: a solid 7+ card minor (AKQxxxx) and no ace or king outside.',
    shows: { hcp: [9, 14] },
    pick: (e) => gamblingSuit(e) !== null,
    why: (e) => {
      const s = gamblingSuit(e);
      return [`solid ${e.len[s]}-card ${NAME[s]}`, 'no ace or king outside'];
    },
  },
  {
    ...OPEN, call: '1N', priority: 10, notes: NT_NOTES,
    meaning: '15–17 balanced. May contain a 5-card major.',
    shows: { hcp: [15, 17], balanced: true },
    pick: (e) => e.balanced && e.hcp >= 15 && e.hcp <= 17,
    why: (e) => [`${e.hcp} HCP, balanced`],
    close: (e) => (e.len.S === 5 || e.len.H === 5 ? 'Balanced 15–17 with a 5-card major: we open 1NT. 1♥/1♠ is also fine with a very strong suit.' : null),
  },
  ...SUITS.map((s) => ({
    ...OPEN, call: `1${s}`, priority: 20, notes: NOTES,
    meaning: ONE_MEANING[s],
    shows: { hcp: [9, 21], len: { [s]: [s === 'S' || s === 'H' ? 5 : 3, 13] } },
    pick: (e, st) => openable(e, st.ctx.seat) && openingSuit(e) === s,
    why: (e, st) => oneLevelWhy(e, st.ctx.seat, s),
    close: (e, st) => oneLevelClose(e, st.ctx.seat),
  })),
  ...['S', 'H', 'D'].map((s) => ({
    ...OPEN, call: `2${s}`, priority: 30, notes: 'weak-twos-and-ogust-tier-0',
    meaning: `Weak two: 6 ${NAME[s]}, 5–10 HCP.`,
    shows: { hcp: [5, 10], len: { [s]: [6, 6] } },
    pick: (e, st) => weakTwoSuit(e, st.ctx.seat, st.ctx.vul) === s,
    why: (e) => [`6-card ${NAME[s]}`, `${e.hcp} HCP: too weak for a 1-level opening`],
  })),
  ...SUITS.flatMap((s) => [3, 4].map((lv) => ({
    ...OPEN, call: `${lv}${s}`, priority: 40, notes: 'preempts-tier-0',
    meaning: `Preempt: about ${lv + 4} ${NAME[s]}, weak.`,
    shows: { hcp: [0, 10], len: { [s]: [lv + 4, 13] } },
    pick: (e, st) => preemptCall(e, st.ctx.seat, st.ctx.vul) === `${lv}${s}`,
    why: (e) => [`${e.len[s]}-card ${NAME[s]}`, `${e.hcp} HCP: weak, so jump to make the opponents' bidding harder`],
  }))),
  {
    ...OPEN, call: 'P', priority: 99, notes: NOTES,
    meaning: 'No opening: usually under 12 HCP.',
    shows: { hcp: [0, 13] },
    pick: () => true,
    why: (e, st) => passWhy(e, st.ctx.seat, st.ctx.vul),
    close: (e, st) => passClose(e, st.ctx.seat),
  },
];

export default entries;
