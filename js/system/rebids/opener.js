import { SUITS, NAME, SYMBOL, dummyPoints } from '../../cards.js';
import { splinterSuit } from '../responding/major.js';

// Opener's second bid after each uncontested first response. Notes: Part 4, "Opener's rebids" (and the raise, 2/1 and Drury sections).
const REBID = 'openers-rebids-tier-0';
const REV = 'reverses-tier-0';
const FNT = 'forcing-1nt-response-tier-0';
const RAISE = 'raising-partners-major-tier-0';
const GF = '21-game-forcing-tier-0';
const INV = 'inverted-minor-raises-tier-1';
const DRURY = 'drury-tier-1';
const RESP = 'responding-to-1-1-tier-0';
const UNPASSED = { responderPassed: false };
const PASSED = { responderPassed: true };

const RANK = { C: 0, D: 1, H: 2, S: 3 };
const isMajor = (s) => s === 'H' || s === 'S';
const S = (s) => SYMBOL[s];
const top3 = (e, s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).length;
const byLength = (e) => (a, b) => e.len[b] - e.len[a] || RANK[b] - RANK[a];
const R = (call, why, extra = {}) => ({ call, why, ...extra });
// Opener's minimum-range rebids: fewer HCP are possible after a light (Rule of 20) opening.
const light = (shows) => (shows?.hcp?.[0] === 12 ? { ...shows, light: true } : shows);

// After 1o–1r: a new suit is a 1-level suit (ranks above r), a lower suit (ranks below o) or a reverse suit (between them).
const kind = (o, r, s) => (RANK[s] > RANK[r] ? 'one' : RANK[s] < RANK[o] ? 'lower' : 'reverse');
const splinterCall = (o, r, s) => `${kind(o, r, s) === 'lower' ? 4 : 3}${s}`;
const jumpShiftCall = (o, r, s) => `${kind(o, r, s) === 'one' ? 2 : 3}${s}`;

// ---------- 1o–1r ----------
export function afterOneLevel(e, o, r) {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS.filter((s) => s !== o && s !== r);
  if (isMajor(r) && L[r] >= 4) {
    const sp = dummyPoints(e, r);
    const s = splinterSuit(e, r);
    const why = [`4-card ${NAME[r]} support`, `${sp} points counting shortness`];
    if (s && s !== o && sp >= 19 && h >= 15) return R(splinterCall(o, r, s), [...why, `${e.len[s] ? 'singleton' : 'void'} in ${NAME[s]}: splinter`]);
    if (sp >= 19) return R(`4${r}`, why);
    if (sp >= 16) return R(`3${r}`, why);
    return R(`2${r}`, why);
  }
  const oneMajors = ['H', 'S'].filter((s) => RANK[s] > RANK[r] && L[s] >= 4);
  if (e.balanced) {
    if (h >= 20) return R('3N', [`${h} HCP, balanced`]);
    if (h >= 18) return R('2N', [`${h} HCP, balanced`]);
    if (oneMajors.length) return R(`1${oneMajors[0]}`, [`4 ${NAME[oneMajors[0]]}: show a major at the 1-level before notrump`]);
    return R('1N', [`${h} HCP, balanced`, isMajor(r) ? `no 4-card ${NAME[r]} support` : 'no major to show'],
      { close: h >= 15 ? 'Balanced 15–17 would normally have opened 1NT.' : null });
  }
  if (h >= 19) {
    const js = others.filter((s) => L[s] >= 4 && kind(o, r, s) !== 'reverse').sort(byLength(e))[0];
    if (js) return R(jumpShiftCall(o, r, js), [`${h} HCP: game forcing`, `${L[js]} ${NAME[js]}`]);
    // A long suit and game values: game in the major, or 3NT with the other suits stopped.
    if (L[o] >= 6 && isMajor(o)) return R(`4${o}`, [`${L[o]} ${NAME[o]}`, `${h} HCP: game values`]);
    if (L[o] >= 6 && others.every((s) => stopper(e, s))) return R('3N', [`${L[o]} ${NAME[o]} and ${h} HCP`, `${others.map((s) => NAME[s]).join(' and ')} stopped: 3NT`]);
  }
  if (oneMajors.length) {
    const s = oneMajors.length === 2 && L.S > L.H ? 'S' : oneMajors[0];
    return R(`1${s}`, [`${L[s]} ${NAME[s]}`, 'a new suit at the 1-level: natural, 12–18']);
  }
  if (r === 'D' && L.D >= 4) return R(h >= 16 ? '3D' : '2D', [`${L.D}-card diamond support`, `${h} HCP`]);
  if (L[o] >= 6 && !others.some((s) => L[s] >= 5)) {
    if (h >= 16 && e.good[o]) return R(`3${o}`, [`good ${L[o]}-card ${NAME[o]}`, `${h} HCP: invitational`], { close: h >= 19 ? `${h} HCP: more than 3${S(o)} shows, but without stoppers 3NT is a guess. Partner should bid on with any help.` : null });
    return R(`2${o}`, [`${L[o]} ${NAME[o]}`, `${h} HCP`], { close: h >= 16 ? `${h} HCP but the suit is not good enough for a jump.` : null });
  }
  const rev = others.filter((s) => kind(o, r, s) === 'reverse' && L[s] >= 4).sort(byLength(e))[0];
  if (rev && h >= 16 && L[o] > L[rev]) return R(`2${rev}`, [`${h} HCP: enough to reverse`, `${L[o]} ${NAME[o]} and ${L[rev]} ${NAME[rev]}`]);
  const low = others.filter((s) => kind(o, r, s) === 'lower' && L[s] >= 4).sort(byLength(e))[0];
  if (low) return R(`2${low}`, [`${L[low]} ${NAME[low]}`, 'a lower new suit: not a reverse, 12–18']);
  if (isMajor(r) && L[r] === 3 && e.pattern[3] <= 1 && h <= 15) return R(`2${r}`, [`3 ${NAME[r]} and a ruffing value`, 'nothing better to bid']);
  if (h >= 18) return R('2N', [`${h} HCP`]);
  if (L[o] >= 6) return R(`2${o}`, [`${L[o]} ${NAME[o]}`]);
  return R('1N', [`${h} HCP`, rev ? `too weak to reverse into ${NAME[rev]} (needs 16+)` : 'no good suit bid'],
    { close: rev ? 'Hiding the second suit is better than reversing with a minimum.' : null });
}

function oneLevelSituation(o, r) {
  const calls = {};
  const others = SUITS.filter((s) => s !== o && s !== r);
  const put = (call, meaning, shows, notes = REBID) => { calls[call] = { meaning, shows: light(shows), notes }; };
  put('1N', '12–14, balanced or nearly (no better rebid).', { hcp: [12, 14] });
  put('2N', '18–19 balanced. Invites game (not forcing).', { hcp: [18, 19], balanced: true });
  put('3N', 'To play: 20+ balanced, or 19+ with a long suit and the other suits stopped.', { hcp: [19, 21] });
  put(`2${o}`, `6+ ${NAME[o]}, minimum (12–15).`, { hcp: [12, 15], len: { [o]: [6, 13] } });
  if (isMajor(o)) put(`4${o}`, `6+ good ${NAME[o]}, 19+: game. To play.`, { hcp: [19, 21], len: { [o]: [6, 13] } });
  put(`3${o}`, `6+ good ${NAME[o]}, 16–18. Invitational.`, { hcp: [16, 18], len: { [o]: [6, 13] } });
  if (isMajor(r)) {
    put(`2${r}`, `4 ${NAME[r]} (rarely 3 with a ruffing value), 12–15.`, { hcp: [12, 15], len: { [r]: [3, 13] } });
    put(`3${r}`, `4 ${NAME[r]}, 16–18 points counting shortness. Invitational.`, { hcp: [16, 18], len: { [r]: [4, 13] }, pts: r });
    put(`4${r}`, `4 ${NAME[r]}, 19+ points counting shortness. To play.`, { hcp: [19, 23], len: { [r]: [4, 13] }, pts: r });
  } else {
    put('2D', '4+ diamonds, 12–15.', { hcp: [12, 15], len: { D: [4, 13] } });
    put('3D', '4+ diamonds, 16–18. Invitational.', { hcp: [16, 18], len: { D: [4, 13] } });
  }
  for (const s of others) {
    const k = kind(o, r, s);
    if (k === 'one') put(`1${s}`, `4+ ${NAME[s]}, 12–18. Not forcing, but responder passes only with a weak hand (0–7) and support.`, { hcp: [12, 18], len: { [s]: [4, 13] } });
    if (k === 'lower') put(`2${s}`, `4+ ${NAME[s]}, 12–18. Not a reverse; not forcing.`, { hcp: [12, 18], len: { [s]: [4, 13] } });
    if (k === 'reverse') put(`2${s}`, `Reverse: 16+, 4+ ${NAME[s]}, ${NAME[o]} longer. Forcing one round.`, { hcp: [16, 37], len: { [s]: [4, 13], [o]: [5, 13] }, force: 'round' }, REV);
    if (k !== 'reverse') put(jumpShiftCall(o, r, s), `Jump shift: 19+, 4+ ${NAME[s]}. Game forcing.`, { hcp: [19, 37], len: { [s]: [4, 13] }, force: 'game' });
    if (isMajor(r)) put(splinterCall(o, r, s), `Splinter: 4 ${NAME[r]}, singleton or void in ${NAME[s]}, about 18+.`, { hcp: [15, 37], len: { [r]: [4, 13], [s]: [0, 1] }, force: 'game' }, RAISE);
  }
  return { after: [`1${o}`, `1${r}`], calls, decide: (e) => afterOneLevel(e, o, r) };
}

// ---------- 1m–1NT (6–10, not forcing) ----------
export function afterMinorNT(e, o) {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS.filter((s) => s !== o);
  if (e.balanced) {
    if (h >= 19) return R('3N', [`${h} HCP opposite 6–10: game`]);
    if (h >= 17) return R('2N', [`${h} HCP balanced: invite`]);
    return R('P', [`${h} HCP balanced opposite 6–10: no game`]);
  }
  if (h >= 19) {
    const js = others.filter((s) => L[s] >= 4).sort(byLength(e))[0];
    return js ? R(`3${js}`, [`${h} HCP: game forcing`, `${L[js]} ${NAME[js]}`]) : R('3N', [`${h} HCP: game`]);
  }
  if (L[o] >= 6) return h >= 16 && e.good[o] ? R(`3${o}`, [`good ${L[o]}-card ${NAME[o]}`, `${h} HCP: invitational`]) : R(`2${o}`, [`${L[o]} ${NAME[o]}`, 'minimum']);
  const rev = others.filter((s) => RANK[s] > RANK[o] && L[s] >= 4).sort(byLength(e))[0];
  if (rev && h >= 16 && L[o] > L[rev]) return R(`2${rev}`, [`${h} HCP: enough to reverse`, `${L[rev]} ${NAME[rev]}`]);
  const low = others.filter((s) => RANK[s] < RANK[o] && L[s] >= 4)[0];
  if (low) return R(`2${low}`, [`${L[low]} ${NAME[low]}`]);
  if (L[o] >= 5) return R(`2${o}`, [`${L[o]} ${NAME[o]}`, 'unbalanced: play in the suit']);
  return R('P', [`${h} HCP: no game opposite 6–10`]);
}

function minorNTSituation(o) {
  const calls = {};
  const put = (call, meaning, shows, notes = REBID) => { calls[call] = { meaning, shows: light(shows), notes }; };
  put('P', 'Content: no game opposite 6–10.', {});
  put('2N', '17–18 balanced, invites 3NT.', { hcp: [17, 18], balanced: true });
  put('3N', '19+, to play.', { hcp: [19, 21] });
  put(`2${o}`, `5+ ${NAME[o]}, minimum. To play.`, { hcp: [12, 15], len: { [o]: [5, 13] } });
  put(`3${o}`, `6+ good ${NAME[o]}, 16–18. Invitational.`, { hcp: [16, 18], len: { [o]: [6, 13] } });
  for (const s of SUITS.filter((t) => t !== o)) {
    if (RANK[s] > RANK[o]) put(`2${s}`, `Reverse: 16+, 4+ ${NAME[s]}, ${NAME[o]} longer.`, { hcp: [16, 37], len: { [s]: [4, 13] }, force: 'round' }, REV);
    else put(`2${s}`, `4+ ${NAME[s]}, 12–18. Not forcing.`, { hcp: [12, 18], len: { [s]: [4, 13] } });
    put(`3${s}`, `Jump shift: 19+, 4+ ${NAME[s]}. Game forcing.`, { hcp: [19, 37], len: { [s]: [4, 13] }, force: 'game' });
  }
  return { after: [`1${o}`, '1N'], calls, decide: (e) => afterMinorNT(e, o) };
}

// ---------- 1M–1NT (forcing; not forcing from a passed hand) ----------
export function afterMajorNT(e, M, passed) {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS.filter((s) => s !== M);
  const cheapMinor = () => (L.C >= 3 ? 'C' : L.D >= 3 ? 'D' : null);
  if (e.balanced) {
    if (h >= 20) return R('3N', [`${h} HCP balanced: game`]);
    if (h >= 18) return R('2N', [`${h} HCP balanced: invite`]);
    if (passed) return R('P', [`${h} HCP balanced`, 'partner passed and 1NT is not forcing']);
    const m = cheapMinor();
    if (m) return R(`2${m}`, [`balanced minimum: bid the cheaper 3-card minor`, `${L[m]} ${NAME[m]}`]);
  }
  if (h >= 19) {
    const js = others.filter((s) => L[s] >= 4).sort(byLength(e))[0];
    if (js) return R(`3${js}`, [`${h} HCP: game forcing`, `${L[js]} ${NAME[js]}`]);
  }
  if (L[M] >= 6 && !others.some((s) => L[s] >= 5)) {
    if (h >= 16 && e.good[M]) return R(`3${M}`, [`good ${L[M]}-card ${NAME[M]}`, `${h} HCP: invitational`]);
    return R(`2${M}`, [`${L[M]} ${NAME[M]}`, 'minimum']);
  }
  if (M === 'H' && L.S >= 4 && h >= 16 && L.H > L.S) return R('2S', [`${h} HCP: enough to reverse`, `${L.S} spades`]);
  const low = others.filter((s) => RANK[s] < RANK[M] && L[s] >= 4).sort(byLength(e))[0];
  if (low) return R(`2${low}`, [`${L[low]} ${NAME[low]}`, 'a lower suit: natural, 12–18']);
  if (passed && h <= 14) return R('P', [`${h} HCP`, 'partner passed and 1NT is not forcing']);
  if (h >= 18) return R('2N', [`${h} HCP`]);
  const m = cheapMinor();
  return m ? R(`2${m}`, ['nothing natural to show: bid the cheaper 3-card minor']) : R(`2${M}`, [`${L[M]} ${NAME[M]}`]);
}

function majorNTSituation(M, passed) {
  const calls = {};
  const put = (call, meaning, shows, notes = FNT) => { calls[call] = { meaning, shows: light(shows), notes }; };
  if (passed) put('P', 'Content to play 1NT opposite a passed hand.', {});
  put('2N', '18–19 balanced. Invites game.', { hcp: [18, 19], balanced: true });
  put('3N', '20+ balanced, to play.', { hcp: [20, 21] });
  put(`2${M}`, `6+ ${NAME[M]}, minimum (5 only with no 3-card minor to bid).`, { hcp: [12, 15], len: { [M]: [5, 13] } });
  put(`3${M}`, `6+ good ${NAME[M]}, 16–18. Invitational.`, { hcp: [16, 18], len: { [M]: [6, 13] } });
  for (const s of SUITS.filter((t) => t !== M)) {
    if (RANK[s] < RANK[M]) {
      const minor = s === 'C' || s === 'D';
      put(`2${s}`, minor ? `4+ ${NAME[s]}, or a balanced minimum with 3 (the cheaper 3-card minor).` : `4+ ${NAME[s]}, 12–18.`,
        { hcp: [12, 18], len: { [s]: [minor ? 3 : 4, 13] } });
    } else {
      put('2S', 'Reverse: 16+, 4 spades, 5+ hearts. Forcing one round.', { hcp: [16, 37], len: { S: [4, 13], H: [5, 13] }, force: 'round' }, REV);
    }
    put(`3${s}`, `Jump shift: 19+, 4+ ${NAME[s]}. Game forcing.`, { hcp: [19, 37], len: { [s]: [4, 13] }, force: 'game' });
  }
  return { after: [`1${M}`, '1N'], ctx: passed ? PASSED : UNPASSED, calls, decide: (e) => afterMajorNT(e, M, passed) };
}

// ---------- Raises of a major ----------
const pts = (e, M) => e.hcp + Math.max(0, e.len[M] - 5);
const losersIn = (e, s) => Math.min(3, e.len[s]) - top3(e, s);

export function afterSimpleRaise(e, M) {
  const p = pts(e, M);
  if (p >= 18) return R(`4${M}`, [`${p} points opposite a raise: game`]);
  if (p <= 14) return R('P', [`${p} points: no game opposite 6–9`]);
  const help = SUITS.filter((s) => s !== M && e.len[s] >= 3 && losersIn(e, s) >= 2)
    .sort((a, b) => losersIn(e, b) - losersIn(e, a) || (a === 'S' ? 1 : 0) - (b === 'S' ? 1 : 0))[0];
  if (help) return R(`${M === 'H' && help === 'S' ? 2 : 3}${help}`, [`${p} points: invite game`, `${e.hand[help].replace(/T/g, '10')} in ${NAME[help]}: ${losersIn(e, help)} losers, so ask for help there`]);
  return R(`3${M}`, [`${p} points: invite game`, 'no side suit needs help']);
}

function simpleRaiseSituation(M) {
  const calls = {
    P: { meaning: 'Minimum: no game.', shows: { hcp: [12, 14], light: true }, notes: RAISE },
    [`3${M}`]: { meaning: 'General game invitation (15–17 points, counting length). Partner bids game with a maximum.', shows: { hcp: [15, 17], pts: `len:${M}` }, notes: RAISE },
    [`4${M}`]: { meaning: 'To play: 18+ points, counting length.', shows: { hcp: [18, 23], pts: `len:${M}` }, notes: RAISE },
  };
  for (const s of SUITS.filter((t) => t !== M)) {
    calls[`${M === 'H' && s === 'S' ? 2 : 3}${s}`] = { meaning: `Help-suit game try: 15–17, two or three losers in ${NAME[s]}. Partner bids game with help there.`, shows: { hcp: [15, 17], len: { [s]: [3, 13] }, pts: `len:${M}` }, notes: RAISE };
  }
  return { after: [`1${M}`, `2${M}`], calls, decide: (e) => afterSimpleRaise(e, M) };
}

function limitRaiseSituation(M) {
  return {
    after: [`1${M}`, `3${M}`],
    calls: {
      P: { meaning: 'Minimum: decline the invitation.', shows: { hcp: [12, 13], light: true, pts: `len:${M}` }, notes: RAISE },
      [`4${M}`]: { meaning: 'Accept: game.', shows: { hcp: [14, 23], pts: `len:${M}` }, notes: RAISE },
    },
    decide: (e) => (pts(e, M) >= 14 ? R(`4${M}`, [`${pts(e, M)} points opposite 10–12: accept`])
      : R('P', [`${pts(e, M)} points: decline`], { close: pts(e, M) === 13 ? '13: accept with good trumps or a ruffing value.' : null })),
  };
}

export function afterJacoby(e, M) {
  const short = SUITS.filter((s) => s !== M && e.len[s] <= 1).sort((a, b) => e.len[a] - e.len[b])[0];
  if (short) return R(`3${short}`, [`${e.len[short] ? 'singleton' : 'void'} in ${NAME[short]}: show it first`]);
  const side = SUITS.filter((s) => s !== M && e.len[s] >= 5 && top3(e, s) >= 2)[0];
  if (side) return R(`4${side}`, [`good 5-card ${NAME[side]}`]);
  if (e.hcp >= 18) return R(`3${M}`, [`${e.hcp} HCP, no shortness: slam interest`]);
  if (e.hcp >= 15) return R('3N', [`${e.hcp} HCP, no shortness`]);
  return R(`4${M}`, [`${e.hcp} HCP, no shortness: minimum`]);
}

function jacobySituation(M) {
  const calls = {
    [`3${M}`]: { meaning: '18+, no shortness. Slam interest.', shows: { hcp: [18, 21] }, notes: RAISE },
    '3N': { meaning: '15–17, no shortness.', shows: { hcp: [15, 17] }, notes: RAISE },
    [`4${M}`]: { meaning: 'Minimum (12–14), no shortness.', shows: { hcp: [12, 14] }, notes: RAISE },
  };
  for (const s of SUITS.filter((t) => t !== M)) {
    calls[`3${s}`] = { meaning: `Singleton or void in ${NAME[s]}.`, shows: { len: { [s]: [0, 1] } }, notes: RAISE };
    calls[`4${s}`] = { meaning: `Good 5-card ${NAME[s]} (two of the top three honors).`, shows: { len: { [s]: [5, 13] } }, notes: RAISE };
  }
  return { after: [`1${M}`, '2N'], ctx: UNPASSED, calls, decide: (e) => afterJacoby(e, M) };
}

function splinterReply(M, s) {
  return {
    after: [`1${M}`, `${s === 'S' ? 3 : 4}${s}`],
    ctx: UNPASSED,
    calls: {
      [`4${M}`]: { meaning: 'Sign-off: no slam interest (often wasted honors in the splinter suit).', shows: {}, notes: RAISE },
      '4N': { meaning: `RKCB for ${NAME[M]}: slam interest.`, shows: { hcp: [16, 37] }, notes: 'rkcb-1430-and-slam-tools-tier-1' },
    },
    decide: (e) => {
      const wasted = /[KQJ]/.test(e.hand[s]);
      if (e.hcp >= 16 && !wasted) return R('4N', [`${e.hcp} HCP and nothing wasted in ${NAME[s]}`, 'slam is likely: ask for key cards']);
      return R(`4${M}`, [wasted ? `honors in ${NAME[s]} are wasted opposite the shortness` : `${e.hcp} HCP: not enough for slam`]);
    },
  };
}

function passOnly(after, meaning, notes, why, ctx) {
  return { after, ctx, calls: { P: { meaning, shows: {}, notes } }, decide: () => R('P', [why]) };
}

function druryReply(M) {
  return {
    after: [`1${M}`, '2C'],
    ctx: PASSED,
    calls: {
      [`2${M}`]: { meaning: 'Light opening: no game interest. Responder passes.', shows: { hcp: [9, 12] }, notes: DRURY },
      [`4${M}`]: { meaning: 'Full opening: game.', shows: { hcp: [13, 21] }, notes: DRURY },
    },
    decide: (e) => (e.hcp >= 13 ? R(`4${M}`, [`${e.hcp} HCP: a full opening opposite a limit raise`], { close: e.hcp === 13 ? '13: with a poor hand, sign off in 2 instead.' : null })
      : R(`2${M}`, [`${e.hcp} HCP: a light opening`, 'stop at the 2-level'])),
  };
}

// ---------- Minor raises and notrump responses ----------
export function afterInverted(e, m) {
  const h = e.hcp;
  if (e.balanced && h <= 14) return R('2N', [`${h} HCP, balanced`]);
  if (e.balanced) return R('3N', [`${h} HCP, balanced`]);
  if (h >= 15) {
    const stop = SUITS.filter((s) => s !== m && RANK[s] > RANK[m] && /[AK]/.test(e.hand[s])).sort((a, b) => RANK[a] - RANK[b])[0];
    if (stop) return R(`2${stop}`, [`${h} HCP`, `${NAME[stop]} stopped: head for 3NT`]);
  }
  return R(`3${m}`, [`${h} HCP, unbalanced: minimum`]);
}

function invertedSituation(m) {
  const calls = {
    '2N': { meaning: '12–14 balanced. Not forcing.', shows: { hcp: [12, 14], balanced: true }, notes: INV },
    '3N': { meaning: '18–19 balanced.', shows: { hcp: [18, 19], balanced: true }, notes: INV },
    [`3${m}`]: { meaning: 'Minimum, unbalanced. Not forcing.', shows: { hcp: [12, 14], light: true }, notes: INV },
  };
  for (const s of SUITS.filter((t) => RANK[t] > RANK[m])) calls[`2${s}`] = { meaning: `Stopper in ${NAME[s]}, natural, forcing: heading for 3NT.`, shows: {}, notes: INV };
  return { after: [`1${m}`, `2${m}`], calls, decide: (e) => afterInverted(e, m) };
}

function weakMinorRaise(m) {
  return {
    after: [`1${m}`, `3${m}`],
    calls: {
      P: { meaning: 'No game.', shows: {}, notes: INV },
      '3N': { meaning: 'To play: a strong hand with the other suits stopped.', shows: { hcp: [18, 21] }, notes: INV },
    },
    decide: (e) => (e.hcp >= 18 ? R('3N', [`${e.hcp} HCP opposite a weak raise: try 3NT`]) : R('P', [`${e.hcp} HCP opposite 5–9: no game`])),
  };
}

function minorTwoNT(m) {
  return {
    after: [`1${m}`, '2N'],
    calls: {
      P: { meaning: 'Minimum: decline.', shows: { hcp: [12, 13] }, notes: RESP },
      '3N': { meaning: 'Accept: game.', shows: { hcp: [14, 21] }, notes: RESP },
      [`3${m}`]: { meaning: 'Minimum with a long suit: to play.', shows: { len: { [m]: [6, 13] } }, notes: RESP },
    },
    decide: (e) => {
      if (e.hcp >= 14) return R('3N', [`${e.hcp} HCP opposite 11–12: accept`]);
      if (e.len[m] >= 6 && !e.balanced) return R(`3${m}`, [`${e.len[m]} ${NAME[m]}, minimum: play in the suit`]);
      return R('P', [`${e.hcp} HCP: decline`], { close: e.hcp === 13 ? '13: accept with a good 5-card suit.' : null });
    },
  };
}

// ---------- After a 2/1 (game forcing) ----------
const stopper = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3) || (/J/.test(e.hand[s]) && e.len[s] >= 4);

export function afterTwoOverOne(e, o, r) {
  const L = e.len;
  if (isMajor(r) && L[r] >= 3) return e.hcp <= 14 ? R(`4${r}`, [`${L[r]}-card ${NAME[r]} support`, `${e.hcp} HCP: minimum, so jump to game (fast arrival)`]) : R(`3${r}`, [`${L[r]}-card ${NAME[r]} support`, `${e.hcp} HCP: extras, so raise slowly`]);
  const unbid = SUITS.filter((s) => s !== o && s !== r);
  if (e.balanced && unbid.every((s) => stopper(e, s))) return R('2N', ['balanced with the unbid suits stopped', 'strength not shown yet']);
  const side = SUITS.filter((s) => s !== o && s !== r && L[s] >= 4 && RANK[s] > RANK[r])
    .sort((a, b) => (isMajor(b) - isMajor(a)) || RANK[a] - RANK[b])[0];
  if (side) return R(`2${side}`, [`${L[side]} ${NAME[side]}: describe the hand`, 'game is forced, so this shows shape, not extra strength']);
  if (L[r] >= 4) return R(`3${r}`, [`${L[r]}-card ${NAME[r]} support`]);
  if (isMajor(o) && L[o] >= 6 && (top3(e, o) === 3 || (top3(e, o) === 2 && /[JT]/.test(e.hand[o])))) return R(`3${o}`, [`very good ${L[o]}-card ${NAME[o]}: sets trumps`]);
  return R(`2${o}`, [`${L[o]} ${NAME[o]}, nothing else to show`, 'any strength: game is forced'], { close: e.balanced ? 'Balanced, but an unbid suit has no stopper: rebid the suit rather than 2NT.' : null });
}

function twoOverOneSituation(o, r) {
  const calls = {
    '2N': { meaning: 'Balanced with the unbid suits stopped. Strength not shown yet (12–14 or 18–19).', shows: { balanced: true }, notes: GF },
    [`2${o}`]: { meaning: `5+ ${NAME[o]}, nothing else to show. Any strength.`, shows: { len: { [o]: [5, 13] } }, notes: GF },
  };
  if (isMajor(o)) calls[`3${o}`] = { meaning: `Very good 6+ ${NAME[o]}: sets trumps.`, shows: { len: { [o]: [6, 13] } }, notes: GF };
  if (isMajor(r)) {
    calls[`3${r}`] = { meaning: `3+ ${NAME[r]} support with extras: slam possible.`, shows: { len: { [r]: [3, 13] } }, notes: GF };
    calls[`4${r}`] = { meaning: `3+ ${NAME[r]} support, minimum: fast arrival.`, shows: { len: { [r]: [3, 13] } }, notes: GF };
  } else {
    calls[`3${r}`] = { meaning: `4+ ${NAME[r]}: a real fit.`, shows: { len: { [r]: [4, 13] } }, notes: GF };
  }
  for (const s of SUITS.filter((t) => t !== o && t !== r && RANK[t] > RANK[r])) {
    calls[`2${s}`] = { meaning: `4+ ${NAME[s]}, natural. Shows shape, not extra strength.`, shows: { len: { [s]: [4, 13] } }, notes: GF };
  }
  return { after: [`1${o}`, `2${r}`], ctx: UNPASSED, calls, decide: (e) => afterTwoOverOne(e, o, r) };
}

// A passed hand's new suit at the 2-level: natural, about 10–11, not forcing.
export function afterPassedNewSuit(e, o, r) {
  if (e.hcp <= 13) return e.len[o] >= 6 ? R(`2${o}`, [`${e.len[o]} ${NAME[o]}`, 'minimum']) : R('P', [`${e.hcp} HCP opposite a passed hand: no game`]);
  if (e.len[r] >= 3) return R(`3${r}`, [`${e.len[r]}-card ${NAME[r]} support`, `${e.hcp} HCP: invite`]);
  if (e.balanced) return R('2N', [`${e.hcp} HCP, balanced: invite`]);
  if (e.len[o] >= 6) return R(`3${o}`, [`${e.len[o]} ${NAME[o]}`, `${e.hcp} HCP: invite`]);
  const side = SUITS.filter((s) => s !== o && s !== r && e.len[s] >= 4).sort(byLength(e))[0];
  if (side) return R(newSuitOver(r, side), [`${e.len[side]} ${NAME[side]}`, `${e.hcp} HCP: show the second suit (forcing one round)`]);
  return R(`2${o}`, [`${e.len[o]} ${NAME[o]}`]);
}

// The cheapest bid of s over partner's 2-level r.
const newSuitOver = (r, s) => `${RANK[s] > RANK[r] ? 2 : 3}${s}`;

function passedNewSuitSituation(o, r) {
  const sides = Object.fromEntries(SUITS.filter((s) => s !== o && s !== r).map((s) => [newSuitOver(r, s), { meaning: `4+ ${NAME[s]}, 14+: natural, forcing one round.`, shows: { hcp: [14, 21], len: { [s]: [4, 13] }, force: 'round' }, notes: GF }]));
  return {
    after: [`1${o}`, `2${r}`],
    ctx: PASSED,
    calls: {
      P: { meaning: 'Minimum: content.', shows: {}, notes: GF },
      [`2${o}`]: { meaning: `6+ ${NAME[o]} with a minimum; or 5 with extras and nothing better to bid. Not forcing.`, shows: { len: { [o]: [5, 13] } }, notes: GF },
      '2N': { meaning: '14+ balanced: invites game.', shows: { hcp: [14, 21], balanced: true }, notes: GF },
      [`3${r}`]: { meaning: `3+ ${NAME[r]}, 14+: invites game.`, shows: { hcp: [14, 21], len: { [r]: [3, 13] } }, notes: GF },
      [`3${o}`]: { meaning: `6+ ${NAME[o]}, 14+: invites game.`, shows: { hcp: [14, 21], len: { [o]: [6, 13] } }, notes: GF },
      ...sides,
    },
    decide: (e) => afterPassedNewSuit(e, o, r),
  };
}

const SITUATIONS = [
  ...[['C', 'D'], ['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']].map(([o, r]) => oneLevelSituation(o, r)),
  minorNTSituation('C'), minorNTSituation('D'),
  ...['H', 'S'].flatMap((M) => [majorNTSituation(M, false), majorNTSituation(M, true), simpleRaiseSituation(M), limitRaiseSituation(M), jacobySituation(M), druryReply(M),
    passOnly([`1${M}`, `4${M}`], 'To play.', RAISE, 'partner bid game: pass')]),
  splinterReply('H', 'S'), splinterReply('H', 'C'), splinterReply('H', 'D'), splinterReply('S', 'C'), splinterReply('S', 'D'),
  passOnly(['1S', '4H'], 'To play.', RAISE, "partner's long hearts: pass"),
  ...['C', 'D'].flatMap((m) => [invertedSituation(m), weakMinorRaise(m), minorTwoNT(m),
    passOnly([`1${m}`, '3N'], 'To play.', RESP, 'partner chose 3NT: pass')]),
  ...[['1C', '3H'], ['1C', '3S'], ['1D', '3H'], ['1D', '3S']].map((after) => ({
    after, ctx: UNPASSED,
    calls: { '3N': { meaning: 'To play: no slam interest.', shows: {}, notes: RAISE } },
    decide: () => R('3N', ['3NT is the likely game opposite the splinter']),
  })),
  ...[['1H', '2S'], ['1H', '3C'], ['1H', '3D'], ['1S', '3C'], ['1S', '3D'], ['1S', '3H'], ['1C', '2D'], ['1C', '2H'], ['1C', '2S'], ['1D', '2H'], ['1D', '2S'], ['1D', '3C']]
    .map((after) => passOnly(after, 'Pass: partner is weak with a long suit.', RESP, 'partner made a weak jump shift: pass')),
  ...[['S', 'C'], ['S', 'D'], ['S', 'H'], ['H', 'C'], ['H', 'D'], ['D', 'C']].map(([o, r]) => twoOverOneSituation(o, r)),
  ...[['S', 'D'], ['S', 'H'], ['H', 'D'], ['D', 'C']].map(([o, r]) => passedNewSuitSituation(o, r)),
];

// 1♣–2♣ / 1♦–2♦ and 1♣–1♦ etc. need no ctx; 2/1 and passed-hand variants carry it.
const entries = SITUATIONS.flatMap((sit) => Object.entries(sit.calls).map(([call, c]) => ({
  after: sit.after,
  ...(sit.ctx ? { ctx: sit.ctx } : {}),
  call,
  meaning: c.meaning,
  shows: c.shows,
  notes: c.notes,
  priority: 10,
  pick: (e, st) => sit.decide(e, st).call === call,
  why: (e, st) => sit.decide(e, st).why,
  plan: (e, st) => sit.decide(e, st).plan ?? null,
  close: (e, st) => sit.decide(e, st).close ?? null,
})));

export default entries;
export { SITUATIONS };
