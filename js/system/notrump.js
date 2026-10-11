import { SUITS, NAME, SYMBOL } from '../cards.js';

// 1NT (15–17) and 2NT (20–21, or 22–24 after 2♣–2♦) auctions: responses, opener's replies, responder's next bid.
const NT = '1nt-opening-and-responses-tier-0';
const SMOLEN = 'smolen-tier-2';
const GERBER = 'rkcb-1430-and-slam-tools-tier-1';
const R = (call, why, extra = {}) => ({ call, why, ...extra });
const top3 = (e, s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).length;
const other = (M) => (M === 'H' ? 'S' : 'H');

// ---------- Responder over 1NT ----------
export function respond1NT(e) {
  const h = e.hcp;
  const { S, H, D, C } = e.len;
  const long = ['H', 'S'].filter((M) => e.len[M] >= 6).sort((a, b) => e.len[b] - e.len[a])[0];
  const xfer = (M) => (M === 'H' ? '2D' : '2H');
  if (long) {
    if (h + e.len[long] - 6 >= 10 && h <= 15) return R(M4(long), [`${e.len[long]} ${NAME[long]}`, `${h} HCP: game, no slam interest`], { plan: `Opener bids 4${SYMBOL[long]}: pass.` });
    return R(xfer(long), [`${e.len[long]} ${NAME[long]}`, 'transfer: the strong hand declares'],
      { plan: h <= 7 ? `Pass 2${SYMBOL[long]}.` : h <= 9 ? `Then 3${SYMBOL[long]} (invitational).` : `Then 4${SYMBOL[long]} (mild slam interest).` });
  }
  if (S >= 5 && H >= 5) {
    if (h <= 7) return R('2H', ['5-5 in the majors, weak: transfer to spades and pass']);
    if (h <= 9) return R('2D', ['5-5 in the majors, invitational'], { plan: 'Over 2♥, bid 2♠.' });
    return R('2H', ['5-5 in the majors, game forcing'], { plan: 'Over 2♠, bid 3♥.' });
  }
  const five = ['S', 'H'].find((M) => e.len[M] === 5);
  if (five && e.len[other(five)] === 4) {
    if (h <= 7) return R(xfer(five), [`5 ${NAME[five]} + 4 ${NAME[other(five)]}, weak: transfer to the 5-card major`], { plan: `Pass 2${SYMBOL[five]}.` });
    return R('2C', [`5 ${NAME[five]} + 4 ${NAME[other(five)]}`, 'Stayman first'],
      { plan: h <= 9 ? `Over 2♦, bid 2${SYMBOL[five]} (5 cards, invitational).` : `Over 2♦, bid 3${SYMBOL[other(five)]} (Smolen).` });
  }
  if (five) {
    return R(xfer(five), [`5 ${NAME[five]}`, 'transfer: the strong hand declares'],
      { plan: h <= 7 ? `Pass 2${SYMBOL[five]}.` : h <= 9 ? 'Then 2NT (5 cards, invitational).' : h <= 15 ? 'Then 3NT (choice of games).' : 'Then 4NT (quantitative).' });
  }
  if (h <= 7 && S >= 4 && H >= 4 && C <= 1) return R('2C', ['garbage Stayman: 4-4 in the majors, short clubs'], { plan: 'Pass whatever opener replies.' });
  if ((S >= 4 || H >= 4) && h >= 8) return R('2C', [`a 4-card major, ${h} HCP`, 'Stayman: look for a 4-4 fit']);
  const minor = ['C', 'D'].find((m) => e.len[m] >= 6);
  if (minor && e.len[minor] === 6 && top3(e, minor) >= 2 && h >= 6 && h <= 9) return R(`3${minor}`, [`good 6-card ${NAME[minor]}`, 'invites 3NT']);
  if (minor && h <= 7) return R('2S', [`${e.len[minor]} ${NAME[minor]}, weak`], { plan: minor === 'C' ? 'Opener bids 3♣: pass.' : 'Opener bids 3♣: bid 3♦ to play.' });
  if (h >= 20) return R('4C', [`${h} HCP: slam values`, 'Gerber: ask for aces']);
  if (h >= 18) return R('6N', [`${h} HCP opposite 15–17: small slam`]);
  if (h >= 16) return R('4N', [`${h} HCP: invite 6NT`]);
  if (h >= 10) return R('3N', [`${h} HCP: game`]);
  if (h >= 8) return R('2N', [`${h} HCP: invite`]);
  return R('P', [`${h} HCP opposite 15–17: no game`]);
}
const M4 = (M) => (M === 'H' ? '4D' : '4H');

const callTable = (rows, notes = NT) => Object.fromEntries(rows.map(([call, meaning, shows = {}]) => [call, { meaning, shows, notes }]));

const ONE_NT = callTable([
  ['P', '0–7, no game.', { hcp: [0, 7] }],
  ['2C', 'Stayman: asks for a 4-card major (garbage Stayman allowed).', {}],
  ['2D', 'Transfer: 5+ hearts.', { len: { H: [5, 13] } }],
  ['2H', 'Transfer: 5+ spades.', { len: { S: [5, 13] } }],
  ['2S', 'Minor puppet: opener must bid 3♣ (weak with a long minor).', {}],
  ['2N', '8–9 balanced, invitational.', { hcp: [8, 9] }],
  ['3C', 'Good 6-card clubs, invites 3NT.', { len: { C: [6, 6] } }],
  ['3D', 'Good 6-card diamonds, invites 3NT.', { len: { D: [6, 6] } }],
  ['3N', '10–15, to play.', { hcp: [10, 15] }],
  ['4C', 'Gerber: asks for aces.', {}],
  ['4D', 'Texas: transfer to 4♥, to play.', { len: { H: [6, 13] } }],
  ['4H', 'Texas: transfer to 4♠, to play.', { len: { S: [6, 13] } }],
  ['4N', 'Quantitative: 16–17, invites 6NT.', { hcp: [16, 17] }],
  ['6N', 'To play.', { hcp: [18, 19] }],
]);

// ---------- Responder over 2NT (20–21) or 2♣–2♦–2NT (22–24): same structure one level higher ----------
export function respond2NT(e, min) {
  const h = e.hcp;
  const need = 25 - min;
  const long = ['H', 'S'].filter((M) => e.len[M] >= 6).sort((a, b) => e.len[b] - e.len[a])[0];
  if (long && h >= need && h <= need + 6) return R(M4(long), [`${e.len[long]} ${NAME[long]}`, `${h} HCP: game`]);
  const five = ['S', 'H'].find((M) => e.len[M] >= 5);
  if (five && e.len[other(five)] === 4 && h >= need) return R('3C', [`5 ${NAME[five]} + 4 ${NAME[other(five)]}`, 'Stayman'], { plan: `Over 3♦, bid 3${SYMBOL[other(five)]} (Smolen).` });
  if (five) return R(five === 'H' ? '3D' : '3H', [`${e.len[five]} ${NAME[five]}`, 'transfer'], { plan: h < need ? 'Pass the completion.' : 'Then 3NT (choice of games) or game in the major with 6.' });
  if ((e.len.S >= 4 || e.len.H >= 4) && h >= need) return R('3C', ['a 4-card major', 'Stayman']);
  if (e.len.C >= 5 && e.len.D >= 4 || e.len.D >= 5 && e.len.C >= 4) { if (h >= need + 6) return R('3S', ['both minors', 'slam interest']); }
  if (h >= need + 10) return R('6N', [`${h} HCP: small slam`]);
  if (h >= need + 7) return R('4N', [`${h} HCP: invite 6NT`]);
  if (h >= need) return R('3N', [`${h} HCP: game`]);
  return R('P', [`${h} HCP: no game`]);
}

const twoNTTable = () => callTable([
  ['P', 'No game.', {}],
  ['3C', 'Stayman.', {}],
  ['3D', 'Transfer: 5+ hearts.', { len: { H: [5, 13] } }],
  ['3H', 'Transfer: 5+ spades.', { len: { S: [5, 13] } }],
  ['3S', 'Both minors (5-4 or longer), slam interest.', {}],
  ['3N', 'To play.', {}],
  ['4C', 'Gerber: asks for aces.', {}],
  ['4D', 'Texas: transfer to 4♥.', { len: { H: [6, 13] } }],
  ['4H', 'Texas: transfer to 4♠.', { len: { S: [6, 13] } }],
  ['4N', 'Quantitative: invites 6NT.', {}],
  ['6N', 'To play.', {}],
]);

// ---------- Opener's replies ----------
const stayman = (lv) => (e) => (e.len.H >= 4 ? R(`${lv}H`, ['4 hearts (bid hearts first with both majors)']) : e.len.S >= 4 ? R(`${lv}S`, ['4 spades']) : R(`${lv}D`, ['no 4-card major']));
const staymanTable = (lv) => callTable([
  [`${lv}D`, 'No 4-card major.', { len: { H: [0, 3], S: [0, 3] } }],
  [`${lv}H`, '4 hearts (may also have 4 spades).', { len: { H: [4, 5] } }],
  [`${lv}S`, '4 spades, not 4 hearts.', { len: { S: [4, 5], H: [0, 3] } }],
]);
const transferReply = (M, lv, superOk) => (e) => (superOk && e.len[M] >= 4 && e.hcp >= 17
  ? R(`${lv + 1}${M}`, [`4 ${NAME[M]} and a maximum`, 'super-accept'])
  : R(`${lv}${M}`, ['complete the transfer']));
const transferTable = (M, lv, superOk) => callTable([
  [`${lv}${M}`, 'Completes the transfer.', {}],
  ...(superOk ? [[`${lv + 1}${M}`, `Super-accept: 4 ${NAME[M]} and a maximum.`, { len: { [M]: [4, 5] } }]] : []),
]);
const gerberReply = (lv) => (e) => {
  const aces = SUITS.filter((s) => e.hand[s].includes('A')).length;
  const call = { 0: '4D', 4: '4D', 1: '4H', 2: '4S', 3: '4N' }[aces];
  return R(call, [`${aces} ace${aces === 1 ? '' : 's'}`]);
};
const GERBER_REPLIES = callTable([
  ['4D', '0 or 4 aces.', {}], ['4H', '1 ace.', {}], ['4S', '2 aces.', {}], ['4N', '3 aces.', {}],
], GERBER);

// ---------- Responder's next bid ----------
export function afterStayman(e, reply, min) {
  const h = e.hcp;
  const need = 25 - min;
  const lv = Number(reply[0]);
  const inv = lv === 2 && h >= need - 2 && h < need;
  const s = reply[1];
  if (!inv && h < need) return R('P', [s === 'D' ? 'weak: play the diamond part-score' : 'weak: pass the reply']);
  if (s === 'D') {
    const five = ['S', 'H'].find((M) => e.len[M] === 5 && e.len[other(M)] === 4);
    if (five && inv) return R(`2${five}`, [`5 ${NAME[five]} + 4 ${NAME[other(five)]}`, 'invitational']);
    if (five) return R(`3${other(five)}`, [`4 ${NAME[other(five)]} + 5 ${NAME[five]}`, 'Smolen: game forcing, the notrump hand declares']);
    if (h >= 33 - min) return R('6N', [`${h} HCP: small slam`]);
    if (h >= 31 - min) return R('4N', [`${h} HCP: invite 6NT`]);
    return inv ? R('2N', [`${h} HCP: invite`]) : R('3N', [`${h} HCP: game`, 'no major fit']);
  }
  if (e.len[s] >= 4) return inv ? R(`3${s}`, [`4 ${NAME[s]}: a fit`, 'invitational']) : h >= 33 - min ? R(`6${s}`, [`4 ${NAME[s]}: a fit`, `${h} HCP: small slam`]) : R(`4${s}`, [`4 ${NAME[s]}: a fit`, 'game']);
  if (h >= 33 - min) return R('6N', [`${h} HCP: small slam`]);
  if (h >= 31 - min) return R('4N', [`${h} HCP: invite 6NT`]);
  if (s === 'H' && e.len.S >= 4) return inv ? R('2S', ['4 spades, no heart fit', 'invitational']) : R('3N', ['4 spades, game values', 'opener corrects to 4♠ with 4 spades']);
  return inv ? R('2N', [`${h} HCP: invite`]) : R('3N', [`${h} HCP: game`]);
}

function staymanFollowTable(reply) {
  const lv = Number(reply[0]);
  const s = reply[1];
  const rows = [['P', 'Weak: to play.', {}]];
  if (s === 'D') {
    if (lv === 2) {
      rows.push(['2H', '5 hearts + 4 spades, invitational.', { len: { H: [5, 5], S: [4, 4] } }]);
      rows.push(['2S', '5 spades + 4 hearts, invitational.', { len: { S: [5, 5], H: [4, 4] } }]);
    }
    rows.push(['3H', 'Smolen: 4 hearts + 5 spades, game forcing.', { len: { H: [4, 4], S: [5, 5] } }, SMOLEN]);
    rows.push(['3S', 'Smolen: 4 spades + 5 hearts, game forcing.', { len: { S: [4, 4], H: [5, 5] } }, SMOLEN]);
  } else {
    if (lv === 2) rows.push([`3${s}`, `4 ${NAME[s]}, invitational.`, { len: { [s]: [4, 13] } }]);
    rows.push([`4${s}`, `4 ${NAME[s]}, to play.`, { len: { [s]: [4, 13] } }]);
    if (s === 'H' && lv === 2) rows.push(['2S', '4 spades (not 4 hearts), invitational.', { len: { S: [4, 4] } }]);
  }
  if (lv === 2) rows.push(['2N', 'Invitational, no fit.', {}]);
  rows.push(['3N', s === 'H' ? 'To play; may hold 4 spades (opener corrects to 4♠ with 4).' : 'To play.', {}]);
  rows.push(['4N', 'Quantitative: invites 6NT.', {}], ['6N', 'To play.', {}]);
  if (s !== 'D') rows.push([`6${s}`, 'Small slam.', {}]);
  return Object.fromEntries(rows.map(([call, meaning, shows, notes = NT]) => [call, { meaning, shows, notes }]));
}

export function afterTransfer(e, M, completion, min) {
  const h = e.hcp;
  const need = 25 - min;
  const lv = Number(completion[0]);
  const L = e.len[M];
  if (min === 15 && lv === 3) return h >= 4 ? R(`4${M}`, ['opener super-accepted: game']) : R('P', [`${h} HCP: pass`]);
  if (lv === 3) {
    if (h < need) return R('P', [`${h} HCP: no game`]);
    if (L >= 6) return R(`4${M}`, [`${L} ${NAME[M]}`, 'game']);
    if (h >= need + 7) return R('4N', [`${h} HCP: quantitative, 5-card ${NAME[M]}`]);
    return R('3N', ['5 cards, game values: opener chooses 3NT or the major']);
  }
  if (M === 'H' && e.len.S >= 5) return R('2S', ['5 spades too, invitational']);
  if (M === 'S' && e.len.H >= 5 && h >= need) return R('3H', ['5 hearts too, game forcing']);
  if (h < need - 2) return R('P', [`${h} HCP: weak, play here`]);
  if (L >= 6) return h < need ? R(`3${M}`, [`${L} ${NAME[M]}`, 'invitational']) : R(`4${M}`, [`${L} ${NAME[M]}`, 'game with mild slam interest']);
  if (h < need) return R('2N', ['5 cards, invitational']);
  if (h >= need + 6) return R('4N', [`${h} HCP: quantitative, 5-card ${NAME[M]}`]);
  return R('3N', ['5 cards, game values: opener chooses 3NT or the major']);
}

function transferFollowTable(M, completion, superAccepted) {
  const lv = Number(completion[0]);
  if (superAccepted) return callTable([['P', 'No game.', {}], [`4${M}`, 'Game.', {}]]);
  const rows = [
    ['P', 'Weak: to play.', {}],
    ['3N', `Exactly 5 ${NAME[M]}, game values: choose 3NT or 4${SYMBOL[M]}.`, { len: { [M]: [5, 5] } }],
    [`4${M}`, lv === 2 ? `6+ ${NAME[M]}, game, mild slam interest.` : `6+ ${NAME[M]}, game.`, { len: { [M]: [6, 13] } }],
    ['4N', `Quantitative with 5 ${NAME[M]} (not RKCB).`, {}],
  ];
  if (lv === 2) {
    rows.push([`3${M}`, `6+ ${NAME[M]}, invitational.`, { len: { [M]: [6, 13] } }]);
    rows.push(['2N', `Exactly 5 ${NAME[M]}, invitational.`, { len: { [M]: [5, 5] } }]);
    if (M === 'H') rows.push(['2S', '5-5 in the majors, invitational.', { len: { H: [5, 13], S: [5, 13] } }]);
    if (M === 'S') rows.push(['3H', '5-5 in the majors, game forcing.', { len: { H: [5, 13], S: [5, 13] } }]);
    for (const s of ['C', 'D']) rows.push([`3${s}`, `Natural, 4+ ${NAME[s]}, game forcing.`, { len: { [s]: [4, 13] }, force: 'game' }]);
  }
  return callTable(rows);
}

const quantReply = (e, min) => (e.hcp >= min + 2 || (e.hcp === min + 1 && e.pattern[0] >= 5) ? R('6N', [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`]));

const S1 = [];
const add = (after, calls, decide, extra = {}) => S1.push({ after, calls, decide, ...extra });

// 1NT
add(['1N'], ONE_NT, respond1NT);
add(['1N', '2C'], staymanTable(2), stayman(2));
add(['1N', '2D'], transferTable('H', 2, true), transferReply('H', 2, true));
add(['1N', '2H'], transferTable('S', 2, true), transferReply('S', 2, true));
add(['1N', '2S'], callTable([['3C', 'Forced.', {}]]), () => R('3C', ['the puppet forces 3♣']));
add(['1N', '2N'], callTable([['P', '15: decline.', { hcp: [15, 15] }], ['3N', '16–17: accept.', { hcp: [16, 17] }]]),
  (e) => (e.hcp >= 16 ? R('3N', [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])));
for (const m of ['C', 'D']) {
  add(['1N', `3${m}`], callTable([['P', 'No fitting honor or a suit unstopped.', {}], ['3N', `To play: a ${NAME[m]} honor and the other suits stopped.`, {}]]),
    (e) => (/[AKQ]/.test(e.hand[m]) ? R('3N', [`an honor in ${NAME[m]}: the suit should run`]) : R('P', [`no ${NAME[m]} honor`])));
}
add(['1N', '4D'], callTable([['4H', 'Completes the Texas transfer.', {}]]), () => R('4H', ['complete the Texas transfer']));
add(['1N', '4H'], callTable([['4S', 'Completes the Texas transfer.', {}]]), () => R('4S', ['complete the Texas transfer']));
add(['1N', '4N'], callTable([['P', '15: decline.', {}], ['6N', '17, or 16 with a good 5-card suit: accept.', {}]]), (e) => quantReply(e, 15));
add(['1N', '4C'], GERBER_REPLIES, gerberReply(4));
for (const pass of ['3N', '6N']) add(['1N', pass], callTable([['P', 'To play.', {}]]), () => R('P', ['partner placed the contract']));
for (const reply of ['2D', '2H', '2S']) add(['1N', '2C', reply], staymanFollowTable(reply), (e) => afterStayman(e, reply, 15));
add(['1N', '2D', '2H'], transferFollowTable('H', '2H', false), (e) => afterTransfer(e, 'H', '2H', 15));
add(['1N', '2H', '2S'], transferFollowTable('S', '2S', false), (e) => afterTransfer(e, 'S', '2S', 15));
add(['1N', '2D', '3H'], transferFollowTable('H', '3H', true), (e) => afterTransfer(e, 'H', '3H', 15));
add(['1N', '2H', '3S'], transferFollowTable('S', '3S', true), (e) => afterTransfer(e, 'S', '3S', 15));
add(['1N', '2S', '3C'], callTable([['P', 'Long clubs: to play.', {}], ['3D', 'Long diamonds: to play.', {}]]),
  (e) => (e.len.D > e.len.C ? R('3D', ['long diamonds: to play']) : R('P', ['long clubs: to play'])));

// 2NT and 2♣–2♦–2NT
for (const [pre, min] of [[['2N'], 20], [['2C', '2D', '2N'], 22]]) {
  add([...pre], twoNTTable(), (e) => respond2NT(e, min));
  add([...pre, '3C'], staymanTable(3), stayman(3));
  add([...pre, '3D'], transferTable('H', 3, false), transferReply('H', 3, false));
  add([...pre, '3H'], transferTable('S', 3, false), transferReply('S', 3, false));
  add([...pre, '4D'], callTable([['4H', 'Completes the Texas transfer.', {}]]), () => R('4H', ['complete the Texas transfer']));
  add([...pre, '4H'], callTable([['4S', 'Completes the Texas transfer.', {}]]), () => R('4S', ['complete the Texas transfer']));
  add([...pre, '4N'], callTable([['P', 'Minimum: decline.', {}], ['6N', 'Maximum: accept.', {}]]), (e) => quantReply(e, min));
  add([...pre, '4C'], GERBER_REPLIES, gerberReply(4));
  add([...pre, '3S'], callTable([['3N', 'No minor fit.', {}], ['4C', '4+ clubs.', {}], ['4D', '4+ diamonds.', {}]]),
    (e) => (e.len.C >= 4 && e.len.C >= e.len.D ? R('4C', ['club fit']) : e.len.D >= 4 ? R('4D', ['diamond fit']) : R('3N', ['no minor fit'])));
  for (const pass of ['3N', '6N']) add([...pre, pass], callTable([['P', 'To play.', {}]]), () => R('P', ['partner placed the contract']));
  for (const reply of ['3D', '3H', '3S']) add([...pre, '3C', reply], staymanFollowTable(reply), (e) => afterStayman(e, reply, min));
  add([...pre, '3D', '3H'], transferFollowTable('H', '3H', false), (e) => afterTransfer(e, 'H', '3H', min));
  add([...pre, '3H', '3S'], transferFollowTable('S', '3S', false), (e) => afterTransfer(e, 'S', '3S', min));
}

const SITUATIONS = S1;
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
