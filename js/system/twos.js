import { SUITS, NAME } from '../cards.js';

// Strong 2♣, weak twos (with Ogust), 3- and 4-level preempts and Gambling 3NT: partner's responses and the follow-ups.
const STRONG = 'strong-2-opening-tier-2';
const WEAK = 'weak-twos-and-ogust-tier-0';
const PRE = 'preempts-tier-0';
const NT = '1nt-opening-and-responses-tier-0';
const R = (call, why, extra = {}) => ({ call, why, ...extra });
const top3 = (e, s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).length;
const RANK = { C: 0, D: 1, H: 2, S: 3 };
const table = (notes, rows) => Object.fromEntries(rows.map(([call, meaning, shows = {}]) => [call, { meaning, shows, notes }]));
const stopped = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3);

// ---------- Strong 2♣ ----------
const POSITIVE = { H: '2H', S: '2S', C: '3C', D: '3D' };
export function respond2C(e) {
  if (e.hcp >= 8) {
    const s = SUITS.filter((t) => e.len[t] >= 5 && top3(e, t) >= 2).sort((a, b) => e.len[b] - e.len[a] || RANK[b] - RANK[a])[0];
    if (s) return R(POSITIVE[s], [`${e.hcp} HCP`, `good ${e.len[s]}-card ${NAME[s]}: positive`]);
    if (e.balanced) return R('2N', [`${e.hcp} HCP, balanced, no good suit: positive`]);
  }
  return R('2D', [e.hcp >= 8 ? `${e.hcp} HCP but no good suit and not balanced: wait` : `${e.hcp} HCP: waiting`]);
}

export function rebidAfter2D(e) {
  if (e.balanced && e.hcp <= 24) return R('2N', [`${e.hcp} HCP, balanced`]);
  if (e.balanced) return R('3N', [`${e.hcp} HCP, balanced`]);
  const s = SUITS.filter((t) => e.len[t] >= 5).sort((a, b) => e.len[b] - e.len[a] || RANK[b] - RANK[a])[0] ?? [...SUITS].sort((a, b) => e.len[b] - e.len[a])[0];
  return R(POSITIVE[s], [`${e.len[s]} ${NAME[s]}: natural, game forcing`]);
}

// After 2♣–2♦–(2♥/2♠/3♣/3♦): second negative, raise, own suit or 2NT/3NT.
const SECOND_NEG = { H: '3C', S: '3C', C: '3D', D: '3H' };
export function afterOpenerSuit(e, x) {
  const neg = SECOND_NEG[x];
  if (e.hcp <= 3) return R(neg, [`${e.hcp} HCP: second negative`]);
  if (e.len[x] >= 3) return R(raiseCall(x), [`${e.len[x]} ${NAME[x]}: support`]);
  const own = SUITS.filter((t) => t !== x && e.len[t] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
  if (own && cheapest(x, own) !== neg) return R(cheapest(x, own), [`${e.len[own]} ${NAME[own]}`]);
  return R(x === 'H' || x === 'S' ? '2N' : '3N', [`${e.hcp} HCP, no fit`]);
}
const raiseCall = (x) => (x === 'H' || x === 'S' ? `3${x}` : `4${x}`);
const cheapest = (x, s) => `${(x === 'H' || x === 'S' ? 2 : 3) + (RANK[s] > RANK[x] ? 0 : 1)}${s}`;

function openerSuitTable(x) {
  const neg = SECOND_NEG[x];
  const rows = [
    [neg, 'Second negative: 0–3 HCP.', { hcp: [0, 3] }],
    [raiseCall(x), `3+ ${NAME[x]}: support.`, { len: { [x]: [3, 13] } }],
    [x === 'H' || x === 'S' ? '2N' : '3N', 'Values, no fit, no good suit.', { hcp: [4, 37] }],
  ];
  for (const s of SUITS.filter((t) => t !== x)) {
    const c = cheapest(x, s);
    if (c !== neg && c !== rows[2][0]) rows.push([c, `5+ ${NAME[s]}, natural.`, { len: { [s]: [5, 13] } }]);
  }
  return table(STRONG, rows);
}

// ---------- Weak twos ----------
export function respondWeakTwo(e, x) {
  const h = e.hcp;
  const fit = e.len[x];
  const major = x === 'H' || x === 'S';
  if (h >= 15) {
    if (major && fit >= 3 && h >= 17) return R(`4${x}`, [`${fit} ${NAME[x]}, ${h} HCP: game`]);
    if (fit >= 2) return R('2N', [`${h} HCP: ask with Ogust`]);
    const own = SUITS.filter((s) => s !== x && e.len[s] >= 5 && top3(e, s) >= 2)[0];
    if (own) return R(`${RANK[own] > RANK[x] ? 2 : 3}${own}`, [`good ${e.len[own]}-card ${NAME[own]}: forcing`]);
    if (h >= 16 && SUITS.filter((s) => s !== x).every((s) => stopped(e, s))) return R('3N', [`${h} HCP, other suits stopped`]);
    return R('2N', [`${h} HCP: ask with Ogust`]);
  }
  if (major && fit >= 4 && h <= 14) return R(`4${x}`, [`${fit} ${NAME[x]}`, h >= 12 ? `${h} HCP: game should make` : 'a bigger preempt: take away their bidding room']);
  if (fit >= 3 && h <= 14) return R(`3${x}`, [`${fit} ${NAME[x]}: preemptive raise`]);
  return R('P', [`${h} HCP, no fit: pass`]);
}

function weakTwoTable(x) {
  const rows = [
    ['P', 'No game.', {}],
    [`3${x}`, 'Preemptive raise: to play, not invitational.', { len: { [x]: [3, 13] } }],
    ['2N', 'Ogust: asks about strength and suit quality.', { hcp: [15, 37] }],
    ['3N', 'To play.', {}],
  ];
  if (x !== 'D') rows.push([`4${x}`, 'To play: to make, or a bigger preempt.', {}]);
  for (const s of SUITS.filter((t) => t !== x)) rows.push([`${RANK[s] > RANK[x] ? 2 : 3}${s}`, `Natural, 5+ ${NAME[s]}, forcing one round.`, { len: { [s]: [5, 13] }, force: 'round' }]);
  return table(WEAK, rows);
}

export function ogustReply(e, x) {
  const good = top3(e, x) >= 2;
  if (top3(e, x) === 3) return R('3N', ['solid suit (AKQ)']);
  const max = e.hcp >= 8;
  return R(max ? (good ? '3S' : '3H') : (good ? '3D' : '3C'), [`${e.hcp} HCP: ${max ? 'maximum' : 'minimum'}`, `${good ? 'good' : 'bad'} suit`]);
}
const OGUST = table(WEAK, [
  ['3C', 'Minimum (5–7), bad suit.', { hcp: [5, 7] }],
  ['3D', 'Minimum (5–7), good suit.', { hcp: [5, 7] }],
  ['3H', 'Maximum (8–10), bad suit.', { hcp: [8, 10] }],
  ['3S', 'Maximum (8–10), good suit.', { hcp: [8, 10] }],
  ['3N', 'Solid suit (AKQ).', {}],
]);

export function afterOgust(e, x, reply) {
  const max = reply === '3H' || reply === '3S' || reply === '3N';
  const game = max || e.hcp >= 18;
  const major = x === 'H' || x === 'S';
  if (game) {
    if (major) return R(`4${x}`, [max ? 'partner is maximum' : `${e.hcp} HCP: game anyway`]);
    return reply === '3N' ? R('P', ['3NT on the solid suit']) : R('3N', [max ? 'partner is maximum' : `${e.hcp} HCP: game anyway`]);
  }
  if (reply === `3${x}`) return R('P', ['partner is minimum: stop here']);
  return R(`3${x}`, ['partner is minimum: sign off']);
}
function afterOgustTable(x, reply) {
  const rows = [];
  if (reply === `3${x}` || reply === '3N') rows.push(['P', reply === '3N' ? 'To play.' : 'Sign-off.', {}]);
  if (reply !== '3N' && RANK[x] > RANK[reply[1]]) rows.push([`3${x}`, 'Sign-off.', {}]);
  if (x === 'H' || x === 'S') rows.push([`4${x}`, 'Game.', {}]);
  else if (reply !== '3N') rows.push(['3N', 'To play.', {}]);
  return table(WEAK, rows);
}

// ---------- Preempts and Gambling 3NT ----------
export function respondPreempt(e, call) {
  const x = call[1];
  const lv = Number(call[0]);
  const major = x === 'H' || x === 'S';
  const tricks = e.hcp >= 16 || (e.hcp >= 14 && e.len[x] >= 3);
  if (lv === 3 && major && e.len[x] >= 2 && tricks) return R(`4${x}`, [`${e.len[x]} ${NAME[x]}, ${e.hcp} HCP: game`]);
  if (lv === 3 && !major && e.hcp >= 16 && SUITS.filter((s) => s !== x).every((s) => stopped(e, s))) return R('3N', [`${e.hcp} HCP, other suits stopped: 3NT`]);
  return R('P', [`${e.hcp} HCP: no game opposite a preempt`]);
}
function preemptTable(call) {
  const x = call[1];
  const lv = Number(call[0]);
  const rows = [['P', 'No game.', {}]];
  if (lv === 3) {
    if (x === 'H' || x === 'S') rows.push([`4${x}`, 'To play.', {}]);
    else rows.push(['3N', 'To play.', {}]);
    for (const s of SUITS.filter((t) => RANK[t] > RANK[x])) rows.push([`3${s}`, `Natural, 5+ ${NAME[s]}, forcing.`, { len: { [s]: [5, 13] }, force: 'round' }]);
  }
  return table(PRE, rows);
}

export function respondGambling(e) {
  const hearts = /[AK]/.test(e.hand.H);
  const spades = /[AK]/.test(e.hand.S);
  const minorStop = /[AK]/.test(e.hand.C) || /[AK]/.test(e.hand.D);
  if (hearts && spades && minorStop) return R('P', ['both majors and a minor stopped: play 3NT']);
  if (e.hcp >= 12) return R('5C', ['a suit unstopped but game values: 5 of the minor (pass or correct)']);
  return R('4C', ['a suit unstopped: run to 4 of the minor (pass or correct)']);
}
const GAMBLING = table(NT, [
  ['P', 'To play: the other suits are stopped.', {}],
  ['4C', 'Pass or correct: to play in 4 of opener\'s minor.', {}],
  ['5C', 'Pass or correct: game in opener\'s minor.', {}],
]);
const gamblingCorrect = (lv) => (e) => (e.len.D > e.len.C ? R(`${lv}D`, ['the long suit is diamonds']) : R('P', ['the long suit is clubs']));

const SITUATIONS = [
  { after: ['2C'], calls: table(STRONG, [
    ['2D', 'Waiting: any hand without a positive. Says nothing about diamonds.', {}],
    ['2H', 'Positive: good 5+ hearts, 8+ HCP.', { hcp: [8, 37], len: { H: [5, 13] } }],
    ['2S', 'Positive: good 5+ spades, 8+ HCP.', { hcp: [8, 37], len: { S: [5, 13] } }],
    ['3C', 'Positive: good 5+ clubs, 8+ HCP.', { hcp: [8, 37], len: { C: [5, 13] } }],
    ['3D', 'Positive: good 5+ diamonds, 8+ HCP.', { hcp: [8, 37], len: { D: [5, 13] } }],
    ['2N', 'Positive: 8+ balanced, no good suit.', { hcp: [8, 37], balanced: true }],
  ]), decide: respond2C },
  { after: ['2C', '2D'], calls: table(STRONG, [
    ['2N', '22–24 balanced. Systems on.', { hcp: [22, 24], balanced: true }],
    ['3N', '25–27 balanced. Systems on.', { hcp: [25, 27], balanced: true }],
    ['2H', 'Natural, 5+ hearts, game forcing.', { len: { H: [5, 13] }, force: 'game' }],
    ['2S', 'Natural, 5+ spades, game forcing.', { len: { S: [5, 13] }, force: 'game' }],
    ['3C', 'Natural, 5+ clubs, game forcing.', { len: { C: [5, 13] }, force: 'game' }],
    ['3D', 'Natural, 5+ diamonds, game forcing.', { len: { D: [5, 13] }, force: 'game' }],
  ]), decide: rebidAfter2D },
  ...['H', 'S', 'C', 'D'].map((x) => ({ after: ['2C', '2D', POSITIVE[x]], calls: openerSuitTable(x), decide: (e) => afterOpenerSuit(e, x) })),
  ...['D', 'H', 'S'].flatMap((x) => [
    { after: [`2${x}`], calls: weakTwoTable(x), decide: (e) => respondWeakTwo(e, x) },
    { after: [`2${x}`, '2N'], calls: OGUST, decide: (e) => ogustReply(e, x) },
    ...['3C', '3D', '3H', '3S', '3N'].map((reply) => ({
      after: [`2${x}`, '2N', reply], calls: afterOgustTable(x, reply), decide: (e) => afterOgust(e, x, reply),
    })),
    { after: [`2${x}`, `3${x}`], calls: table(WEAK, [['P', 'To play.', {}]]), decide: () => R('P', ['partner\'s raise is to play']) },
  ]),
  ...['C', 'D', 'H', 'S'].flatMap((x) => [3, 4].map((lv) => ({ after: [`${lv}${x}`], calls: preemptTable(`${lv}${x}`), decide: (e) => respondPreempt(e, `${lv}${x}`) }))),
  { after: ['3N'], calls: GAMBLING, decide: respondGambling },
  { after: ['3N', '4C'], calls: table(NT, [['P', 'Clubs.', {}], ['4D', 'Diamonds.', {}]]), decide: gamblingCorrect(4) },
  { after: ['3N', '5C'], calls: table(NT, [['P', 'Clubs.', {}], ['5D', 'Diamonds.', {}]]), decide: gamblingCorrect(5) },
];

const entries = SITUATIONS.flatMap((sit) => Object.entries(sit.calls).map(([call, c]) => ({
  after: sit.after,
  call,
  meaning: c.meaning,
  shows: c.shows,
  notes: c.notes,
  priority: 10,
  pick: (e) => sit.decide(e).call === call,
  why: (e) => sit.decide(e).why,
  plan: (e) => sit.decide(e).plan ?? null,
  close: (e) => sit.decide(e).close ?? null,
})));

export default entries;
export { SITUATIONS };
