import { SUITS, NAME, SYMBOL, dummyPoints } from '../../cards.js';

// Responder's second bid in uncontested auctions: XYZ, fourth suit forcing, after a reverse, after a forcing 1NT.
const XYZ = 'xyz-tier-1';
const FSF = 'fourth-suit-forcing-tier-1';
const REV = 'reverses-tier-0';
const FNT = 'forcing-1nt-response-tier-0';

const RANK = { C: 0, D: 1, H: 2, S: 3 };
const isMajor = (s) => s === 'H' || s === 'S';
const top3 = (e, s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).length;
const stopper = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3) || (/J/.test(e.hand[s]) && e.len[s] >= 4);
const R = (call, why, extra = {}) => ({ call, why, ...extra });
const fourthCall = (z, w) => `${RANK[w] > RANK[z] ? 2 : 3}${w}`;

// ---------- XYZ: 1o–1r–1z (z a suit or NT) ----------
export function afterXYZ(e, o, r, z) {
  const h = e.hcp;
  const L = e.len;
  if (z !== 'N' && L[z] >= 4) {
    const dp = dummyPoints(e, z);
    const why = [`4 ${NAME[z]}: a fit`, `${dp} dummy points`];
    if (dp >= 13) return R(`4${z}`, why);
    if (dp >= 10) return R('2C', [...why, 'invitational: start with the 2♣ relay'], { plan: `Over 2♦, bid 3${SYMBOL[z]} (invitational raise).` });
    if (dp >= 6) return R(`2${z}`, [...why, 'weak raise, to play']);
    return R('P', why);
  }
  if (o === 'C' && r === 'D' && z === 'H' && L.S >= 4 && h >= 6 && h <= 12) return R('1S', [`${L.S} spades: natural at the 1-level`]);
  if (h >= 13) {
    if (L[r] >= 6 && top3(e, r) >= 2) return R(`3${r}`, [`${h} HCP`, `good ${L[r]}-card ${NAME[r]}: jump to force game`]);
    if (e.balanced && !(z === 'N' && isMajor(r) && L[r] >= 5)) return R('3N', [`${h} HCP, balanced: game`, z === 'N' ? 'opener is 12–14' : 'no fit found']);
    return R('2D', [`${h} HCP: game forcing`, 'artificial: opener describes further'],
      { plan: z === 'N' && isMajor(r) ? `Opener shows 3-card ${NAME[r]} support first; then choose the game.` : 'Opener describes; then choose the game.' });
  }
  if (h >= 11 || (h === 10 && ((r === 'S' && L.S >= 5 && L.H >= 4) || (isMajor(r) && L[r] >= 6)))) {
    let plan = e.balanced ? 'Over 2♦, bid 2NT (balanced invite).' : 'Over 2♦, show your hand naturally at the cheapest level (invitational).';
    if (isMajor(r) && L[r] >= 6) plan = `Over 2♦, bid 2${SYMBOL[r]} (6+ cards, invitational).`;
    else if (r === 'S' && L.H >= 4) plan = 'Over 2♦, bid 2♥ (5♠ + 4♥, invitational).';
    else if (L[o] >= 4) plan = `Over 2♦, bid 3${SYMBOL[o]} (support, invitational).`;
    return R('2C', [`${h} HCP: invitational`, 'the 2♣ relay starts every invitation'], { plan });
  }
  if (z === 'N') {
    if (isMajor(r) && L[r] >= 6) return R(`2${r}`, [`${L[r]} ${NAME[r]}, weak: to play`]);
    if (r === 'S' && L.S >= 5 && L.H >= 4 && o !== 'H') return R('2H', ['5 spades and 4 hearts, weak: to play']);
    if (L.C >= 6 && o !== 'C') return R('2N', [`${L.C} clubs, weak`], { plan: 'Opener must bid 3♣: pass.' });
    if (L.D >= 6 || (o === 'D' && L.D >= 4 && !e.balanced)) return R('2C', ['weak with diamonds'], { plan: 'Opener must bid 2♦: pass.' });
    return R('P', [`${h} HCP opposite 12–14: no game`]);
  }
  if (isMajor(r) && L[r] >= 6) return R(`2${r}`, [`${L[r]} ${NAME[r]}, weak: to play`]);
  if (L[z] >= 3 && !e.balanced && h <= 7) return R('P', [`${h} HCP`, `${L[z]} ${NAME[z]}: play here`]);
  if (h >= 6) return R('1N', [`${h} HCP: natural, weak`]);
  return R('P', [`${h} HCP: weak`]);
}

function xyzSituation(o, r, z) {
  const calls = {};
  const put = (call, meaning, shows, force) => { calls[call] = { meaning, shows: { ...shows, ...(force ? { force } : {}) }, notes: XYZ }; };
  put('P', z === 'N' ? 'Weak, content with 1NT.' : 'Weak (about 0–7), content here.', z === 'N' ? {} : { hcp: [0, 7] });
  if (z !== 'N') put('1N', 'Natural, weak (6–10).', { hcp: [6, 10] });
  if (z === 'H' && o === 'C' && r === 'D') put('1S', '4+ spades, natural (the fourth suit at the 1-level).', { len: { S: [4, 13] } }, 'round');
  put('2C', 'XYZ relay: opener must bid 2♦. Then pass (weak with diamonds) or an invitation.', {}, 'round');
  put('2D', 'XYZ: artificial, game forcing.', { hcp: [13, 37] }, 'game');
  if (isMajor(r)) put(`2${r}`, `6+ ${NAME[r]}, weak: to play.`, { hcp: [0, 10], len: { [r]: [6, 13] } });
  if (z === 'N' && r === 'S' && o !== 'H') put('2H', '5 spades + 4 hearts, weak: to play.', { hcp: [0, 10], len: { S: [5, 13], H: [4, 13] } });
  if (z !== 'N') put(`2${z}`, `4 ${NAME[z]}, weak raise: to play.`, { hcp: [6, 9], len: { [z]: [4, 13] } });
  put('2N', 'Puppet: opener must bid 3♣ (to play in clubs, or 3♦ next).', {});
  put(`3${r}`, `Good 6+ ${NAME[r]}, game forcing.`, { hcp: [13, 37], len: { [r]: [6, 13] } }, 'game');
  put('3N', 'To play.', { hcp: [13, 37] });
  if (z !== 'N') put(`4${z}`, `4 ${NAME[z]}, game: to play.`, { len: { [z]: [4, 13] } });
  return { after: [`1${o}`, `1${r}`, `1${z}`], calls, decide: (e) => afterXYZ(e, o, r, z) };
}

// ---------- Fourth suit forcing: 1o–1r–2z, z lower than o (not a reverse) ----------
export function afterNewLowerSuit(e, o, r, z, w) {
  const h = e.hcp;
  const L = e.len;
  const fsf = fourthCall(z, w);
  if (h >= 13) {
    if (isMajor(o) && L[o] >= 3 && h <= 15) return R(`4${o}`, [`${L[o]}-card ${NAME[o]} support`, `${h} HCP: game`]);
    if (isMajor(r) && L[r] >= 6 && top3(e, r) >= 2 && h <= 15) return R(`4${r}`, [`good ${L[r]}-card ${NAME[r]}`, 'game']);
    if (stopper(e, w) && (e.balanced || e.shape === 'semi')) return R('3N', [`${h} HCP`, `${NAME[w]} stopped`]);
    return R(fsf, [`${h} HCP: game forcing`, `no ${NAME[w]} stopper or no clear game yet: bid the fourth suit`],
      { plan: 'Opener shows 3-card support for your suit, a stopper (2NT/3NT), extra length, or 4 cards in the fourth suit.' });
  }
  if (h >= 10) {
    if (L[o] >= 3 && isMajor(o)) return R(`3${o}`, [`${L[o]}-card ${NAME[o]} support`, `${h} HCP: invitational`]);
    if (L[z] >= 4) return R(`3${z}`, [`${L[z]}-card ${NAME[z]} support`, `${h} HCP: invitational`]);
    if (L[r] >= 6) return R(`3${r}`, [`${L[r]} ${NAME[r]}`, `${h} HCP: invitational`]);
    if (stopper(e, w)) return R('2N', [`${h} HCP`, `${NAME[w]} stopped: invitational`]);
    if (L[o] >= 3) return R(`3${o}`, [`${L[o]}-card ${NAME[o]} support`, `${h} HCP: invitational`]);
    return R('2N', [`${h} HCP: invitational`], { close: `No ${NAME[w]} stopper: 2NT is the least bad invitation.` });
  }
  if (L[r] >= 6) return R(`2${r}`, [`${L[r]} ${NAME[r]}, weak: to play`]);
  if (L[o] >= L[z] && L[o] >= 2) return R(`2${o}`, [`preference: ${L[o]} ${NAME[o]} against ${L[z]} ${NAME[z]}`]);
  return R('P', [`${h} HCP`, `${L[z]} ${NAME[z]}: play here`]);
}

function fsfSituation(o, r, z) {
  const w = SUITS.find((s) => ![o, r, z].includes(s));
  const calls = {
    P: { meaning: `Weak: prefers ${NAME[z]}.`, shows: { hcp: [6, 9] }, notes: FSF },
    [`2${o}`]: { meaning: `Preference: weak, usually 2–3 ${NAME[o]}.`, shows: { hcp: [6, 9] }, notes: FSF },
    [`2${r}`]: { meaning: `6+ ${NAME[r]}, weak: to play.`, shows: { hcp: [6, 9], len: { [r]: [6, 13] } }, notes: FSF },
    '2N': { meaning: `Invitational (10–12) with ${NAME[w]} stopped.`, shows: { hcp: [10, 12] }, notes: FSF },
    [`3${o}`]: { meaning: `${NAME[o][0].toUpperCase() + NAME[o].slice(1)} support, invitational (10–12).`, shows: { hcp: [10, 12], len: { [o]: [3, 13] } }, notes: FSF },
    [`3${z}`]: { meaning: `4+ ${NAME[z]}, invitational (10–12).`, shows: { hcp: [10, 12], len: { [z]: [4, 13] } }, notes: FSF },
    [`3${r}`]: { meaning: `6+ ${NAME[r]}, invitational (10–12).`, shows: { hcp: [10, 12], len: { [r]: [6, 13] } }, notes: FSF },
    '3N': { meaning: `To play: 13+ with ${NAME[w]} stopped.`, shows: { hcp: [13, 37] }, notes: FSF },
    [fourthCall(z, w)]: { meaning: `Fourth suit forcing: artificial, game forcing. Says nothing about ${NAME[w]}.`, shows: { hcp: [13, 37], force: 'game' }, notes: FSF },
  };
  if (isMajor(o)) calls[`4${o}`] = { meaning: `3+ ${NAME[o]}, game: to play.`, shows: { len: { [o]: [3, 13] } }, notes: FSF };
  if (isMajor(r)) calls[`4${r}`] = { meaning: `Good 6+ ${NAME[r]}, game: to play.`, shows: { len: { [r]: [6, 13] } }, notes: FSF };
  return { after: [`1${o}`, `1${r}`, `2${z}`], calls, decide: (e) => afterNewLowerSuit(e, o, r, z, w) };
}

// ---------- After opener's reverse: 1o–1r–2z ----------
export function afterReverse(e, o, r, z, w) {
  const h = e.hcp;
  const L = e.len;
  if (h <= 7) {
    if (L[r] >= 6) return R(`2${r}`, [`${L[r]} ${NAME[r]}`, 'forcing one round']);
    return R('2N', [`${h} HCP: weak`, 'the 2NT relay forces 3♣'], { plan: `After 3♣: pass with clubs, or sign off in 3${SYMBOL[o]}${L[z] >= 4 ? ` or 3${SYMBOL[z]}` : ''}.` });
  }
  if (L[z] >= 4) return R(`3${z}`, [`4 ${NAME[z]}`, `${h} HCP: game forcing`]);
  if (L[o] >= 3) return R(`3${o}`, [`${L[o]}-card ${NAME[o]} support`, `${h} HCP: game forcing`]);
  if (L[r] >= 5) return R(`2${r}`, [`${L[r]} ${NAME[r]}`, 'forcing one round']);
  if (stopper(e, w)) return R('3N', [`${h} HCP`, `${NAME[w]} stopped`]);
  return R(fourthCall(z, w), [`${h} HCP: game forcing`, `no ${NAME[w]} stopper`]);
}

function reverseSituation(o, r, z) {
  const w = SUITS.find((s) => ![o, r, z].includes(s));
  return {
    after: [`1${o}`, `1${r}`, `2${z}`],
    calls: {
      '2N': { meaning: 'Weak (about 5–7): opener must bid 3♣, then responder passes or signs off.', shows: { hcp: [0, 7] }, notes: REV },
      [`2${r}`]: { meaning: `5+ ${NAME[r]}, forcing one round.`, shows: { len: { [r]: [5, 13] }, force: 'round' }, notes: REV },
      [`3${o}`]: { meaning: `${NAME[o][0].toUpperCase() + NAME[o].slice(1)} support, game forcing.`, shows: { hcp: [8, 37], len: { [o]: [3, 13] }, force: 'game' }, notes: REV },
      [`3${z}`]: { meaning: `4 ${NAME[z]}, game forcing.`, shows: { hcp: [8, 37], len: { [z]: [4, 13] }, force: 'game' }, notes: REV },
      '3N': { meaning: `To play, ${NAME[w]} stopped.`, shows: { hcp: [8, 37] }, notes: REV },
      [fourthCall(z, w)]: { meaning: 'Fourth suit: game forcing, asks opener to describe further.', shows: { hcp: [8, 37], force: 'game' }, notes: REV },
    },
    decide: (e) => afterReverse(e, o, r, z, w),
  };
}

// ---------- After 1M–1NT and opener's rebid ----------
export function afterForcingNT(e, M, rb) {
  const h = e.hcp;
  const L = e.len;
  const lv = Number(rb[0]);
  const x = rb[1];
  const dp = dummyPoints(e, M);
  if (rb === '2N') {
    if (h >= 7) return L[M] >= 3 ? R(`4${M}`, [`${L[M]} ${NAME[M]}`, `${h} HCP opposite 18–19: game`]) : R('3N', [`${h} HCP opposite 18–19: game`]);
    return R('P', [`${h} HCP opposite 18–19: no game`]);
  }
  if (rb === `3${M}`) return h >= 8 || (h >= 7 && L[M] >= 2) ? R(`4${M}`, [`${h} HCP opposite 16–18: accept`]) : R('P', [`${h} HCP: decline`]);
  if (M === 'H' && rb === '2S') {
    if (h <= 7) return R('2N', [`${h} HCP: weak`, 'the 2NT relay forces 3♣']);
    if (L.H >= 3) return R('4H', [`${L.H} hearts`, `${h} HCP opposite a reverse: game`]);
    if (['C', 'D'].every((s) => stopper(e, s))) return R('3N', [`${h} HCP`, 'minors stopped']);
    return R('3H', [`${L.H} hearts`, 'game forcing preference']);
  }
  if (L[M] === 3 && dp >= 10 && h >= 7) return R(`3${M}`, [`3 ${NAME[M]}, ${dp} dummy points`, 'the 3-card limit raise']);
  if (rb === `2${M}`) {
    if (h >= 11) return L[M] >= 2 ? R(`3${M}`, [`${h} HCP with ${L[M]} ${NAME[M]}: invite`]) : R('2N', [`${h} HCP: invite`]);
    return R('P', [`${h} HCP: no game`]);
  }
  if (h >= 11 && e.balanced) return R('2N', [`${h} HCP balanced: invite`]);
  if (h >= 10 && L[x] >= (x === 'C' || x === 'D' ? 5 : 4)) return R(`3${x}`, [`${L[x]} ${NAME[x]}`, `${h} HCP: invitational raise`]);
  const long = SUITS.find((s) => s !== M && s !== x && L[s] >= 6);
  if (long && RANK[long] > RANK[x] && lv === 2) {
    return h >= 10 ? R(`3${long}`, [`${L[long]} ${NAME[long]}`, `${h} HCP: invitational`]) : R(`2${long}`, [`${L[long]} ${NAME[long]}, weak: to play`]);
  }
  // A long suit below opener's second suit can only be shown at the 3-level: natural, not forcing.
  // 2NT invites instead only with 11–12, no singleton and both unbid suits stopped; with 3 cards in opener's second major, pass is a fit.
  const ntHand = h >= 11 && SUITS.every((s) => L[s] >= 2) && SUITS.filter((s) => s !== M && s !== x && s !== long).every((s) => stopper(e, s));
  if (long && (h >= 8 || L[long] >= 7) && !ntHand && !(x === 'H' && L.H >= 3)) return R(`3${long}`, [`${L[long]} ${NAME[long]}`, `${h} HCP: no fit for ${NAME[M]}, play in my suit`]);
  if (h >= 11) return R('2N', [`${h} HCP: invite`]);
  if (L[M] >= 2 && L[M] > L[x] - 2 && L[x] < 4) return R(`2${M}`, [`preference: ${L[M]} ${NAME[M]}`]);
  return R('P', [`${h} HCP`, `${L[x]} ${NAME[x]}: play here`]);
}

function forcingNTSituation(M, rb) {
  const x = rb[1];
  const calls = {};
  const put = (call, meaning, shows) => { calls[call] = { meaning, shows, notes: FNT }; };
  if (rb === '2N') {
    put('P', 'No game.', { hcp: [6, 6] });
    put('3N', 'To play.', { hcp: [7, 12] });
    put(`4${M}`, `3 ${NAME[M]}, game.`, { len: { [M]: [3, 3] } });
  } else if (rb === `3${M}`) {
    put('P', 'Minimum: decline.', {});
    put(`4${M}`, 'Accept: game.', {});
  } else if (M === 'H' && rb === '2S') {
    put('2N', 'Weak: relay to 3♣.', { hcp: [6, 7] });
    put('3H', 'Heart preference, game forcing.', { len: { H: [2, 3] } });
    put('4H', '3 hearts, game.', { len: { H: [3, 3] } });
    put('3N', 'To play, minors stopped.', {});
  } else {
    put('P', `Weak: content in ${x === M ? NAME[M] : NAME[x]}.`, {});
    put('2N', '11–12, invitational.', { hcp: [11, 12] });
    put(`3${M}`, x === M ? 'Invitational with 2+ trumps.' : '3-card limit raise (10–12).', { len: { [M]: [x === M ? 2 : 3, 3] } });
    if (x !== M) {
      put(`2${M}`, `Preference: 2 ${NAME[M]}, weak.`, { len: { [M]: [2, 2] } });
      put(`3${x}`, `Raise: 10–12 with ${x === 'C' || x === 'D' ? 5 : 4}+ ${NAME[x]}.`, { hcp: [10, 12], len: { [x]: [4, 13] } });
      for (const s of SUITS.filter((t) => t !== M && t !== x && RANK[t] > RANK[x])) {
        put(`2${s}`, `6+ ${NAME[s]}, weak: to play.`, { hcp: [6, 9], len: { [s]: [6, 13] } });
        put(`3${s}`, `6+ ${NAME[s]}, invitational (10–12).`, { hcp: [10, 12], len: { [s]: [6, 13] } });
      }
      for (const s of SUITS.filter((t) => t !== M && RANK[t] < RANK[x])) {
        put(`3${s}`, `6+ ${NAME[s]}, not forcing: to play.`, { hcp: [6, 12], len: { [s]: [6, 13] } });
      }
    }
  }
  return { after: [`1${M}`, '1N', rb], calls, decide: (e) => afterForcingNT(e, M, rb) };
}

const SITUATIONS = [
  ...[['C', 'D', 'H'], ['C', 'D', 'S'], ['C', 'D', 'N'], ['C', 'H', 'S'], ['C', 'H', 'N'], ['C', 'S', 'N'], ['D', 'H', 'S'], ['D', 'H', 'N'], ['D', 'S', 'N'], ['H', 'S', 'N']]
    .map(([o, r, z]) => xyzSituation(o, r, z)),
  ...[['D', 'H', 'C'], ['D', 'S', 'C'], ['H', 'S', 'C'], ['H', 'S', 'D']].map(([o, r, z]) => fsfSituation(o, r, z)),
  ...[['C', 'H', 'D'], ['C', 'S', 'D'], ['C', 'S', 'H'], ['D', 'S', 'H']].map(([o, r, z]) => reverseSituation(o, r, z)),
  ...['2C', '2D', '2H', '2S', '2N', '3S'].map((rb) => forcingNTSituation('S', rb)),
  ...['2C', '2D', '2H', '2S', '2N', '3H'].map((rb) => forcingNTSituation('H', rb)),
];

const entries = SITUATIONS.flatMap((sit) => Object.entries(sit.calls).map(([call, c]) => ({
  after: sit.after,
  ...(sit.ctx ? { ctx: sit.ctx } : {}),
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
