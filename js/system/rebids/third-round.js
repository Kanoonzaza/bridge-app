import { SUITS, NAME, SYMBOL, dummyPoints } from '../../cards.js';

// Third round of uncontested auctions: responder after opener's rebid (raises, own-suit rebids, 2NT,
// jump rebids, inverted raises, game tries, 2/1, Jacoby) and opener after notrump, XYZ and fourth-suit sequences.
const REBID = 'openers-rebids-tier-0';
const RAISE = 'raising-partners-major-tier-0';
const GF = '21-game-forcing-tier-0';
const INV = 'inverted-minor-raises-tier-1';
const NT = '1nt-opening-and-responses-tier-0';
const SMOLEN = 'smolen-tier-2';
const XYZ = 'xyz-tier-1';
const FSF = 'fourth-suit-forcing-tier-1';
const FNT = 'forcing-1nt-response-tier-0';
const SLAM = 'rkcb-1430-and-slam-tools-tier-1';
const DRURY = 'drury-tier-1';
const UNPASSED = { responderPassed: false };
const PASSED = { responderPassed: true };

const RANK = { C: 0, D: 1, H: 2, S: 3, N: 4 };
const isMajor = (s) => s === 'H' || s === 'S';
const nm = (s) => NAME[s];
const top3 = (e, s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).length;
const stopper = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3) || (/J/.test(e.hand[s]) && e.len[s] >= 4);
const above = (a, b) => (Number(a[0]) - Number(b[0])) * 5 + RANK[a[1]] - RANK[b[1]] > 0;
const R = (call, why, extra = {}) => ({ call, why, ...extra });

const SITUATIONS = [];
// calls: [call, meaning, notes?, shows?][]; decide(e) must return one of them.
const sit = (after, calls, decide, notes = REBID, ctx) => SITUATIONS.push({
  after,
  ctx,
  calls: Object.fromEntries(calls.map(([c, m, n, sh]) => [c, { meaning: m, shows: sh ?? {}, notes: n ?? notes }])),
  decide,
});

// ---------- Responder after opener raises the major: 1x–1M–2M / 3M / 4M ----------
for (const [x, M] of [['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  const pts = (e) => e.hcp + Math.max(0, e.len[M] - 4);
  sit([`1${x}`, `1${M}`, `2${M}`], [['P', 'No game.'], [`3${M}`, 'Invitational (11–12).'], [`4${M}`, 'Game.'], ['4N', 'RKCB: slam interest.', SLAM]],
    (e) => (pts(e) >= 20 ? R('4N', [`${pts(e)} points opposite 12–15: slam`]) : pts(e) >= 13 ? R(`4${M}`, [`${pts(e)} points opposite 12–15: game`]) : pts(e) >= 11 ? R(`3${M}`, [`${pts(e)} points: invite`]) : R('P', [`${pts(e)} points: no game`])));
  sit([`1${x}`, `1${M}`, `3${M}`], [['P', 'Decline.'], [`4${M}`, 'Accept.'], ['4N', 'RKCB: slam interest.', SLAM]],
    (e) => (pts(e) >= 16 ? R('4N', [`${pts(e)} points opposite 16–18: slam`]) : pts(e) >= 8 ? R(`4${M}`, [`${pts(e)} points opposite 16–18: game`]) : R('P', [`${pts(e)} points: decline`])));
  sit([`1${x}`, `1${M}`, `4${M}`], [['P', 'To play.'], ['4N', 'RKCB: slam interest.', SLAM]], (e) => (pts(e) >= 13 ? R('4N', [`${pts(e)} points opposite 19–20: slam`]) : R('P', ['opener bid game'])));
}

// ---------- Responder after opener's own-suit rebid, 2NT, jump rebid or 3NT ----------
for (const [x, y] of [['C', 'D'], ['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  const yOK = RANK[y] > RANK[x];
  const two = [[`P`, 'Weak: no game.'], ['2N', 'Invitational (11–12).'], [`3${x}`, `Invitational with ${nm(x)} support.`], ['3N', 'To play (13+).'], [`3${y}`, `6+ ${nm(y)}, invitational.`]];
  if (yOK) two.push([`2${y}`, `6+ ${nm(y)}, weak: to play.`]);
  if (isMajor(x)) two.push([`4${x}`, `Game with ${nm(x)} support.`]);
  if (isMajor(y)) two.push([`4${y}`, `Good 6+ ${nm(y)}: game.`]);
  sit([`1${x}`, `1${y}`, `2${x}`], two, (e) => {
    const h = e.hcp;
    const L = e.len;
    if (h >= 13) {
      if (isMajor(x) && L[x] >= 2) return R(`4${x}`, [`${L[x]} ${nm(x)} opposite 6+`, `${h} HCP: game`]);
      if (isMajor(y) && L[y] >= 6) return R(`4${y}`, [`${L[y]} ${nm(y)}`, 'game']);
      return R('3N', [`${h} HCP: game`]);
    }
    if (h >= 11) {
      if (L[x] >= (isMajor(x) ? 2 : 3)) return R(`3${x}`, [`${L[x]} ${nm(x)}`, `${h} HCP: invite`]);
      if (L[y] >= 6) return R(`3${y}`, [`${L[y]} ${nm(y)}`, `${h} HCP: invite`]);
      return R('2N', [`${h} HCP: invite`]);
    }
    if (yOK && L[y] >= 6 && L[x] <= 1) return R(`2${y}`, [`${L[y]} ${nm(y)}, weak: to play`]);
    return R('P', [`${h} HCP opposite a minimum: no game`]);
  });
  const nt = [['P', 'No game (0–5).'], ['3N', 'To play.'], ['4N', 'Quantitative: invites 6NT.'], ['6N', 'To play.']];
  if (isMajor(y)) nt.push([`3${y}`, `5 ${nm(y)}: opener chooses 3NT or 4${SYMBOL[y]}.`], [`4${y}`, `6+ ${nm(y)}: to play.`]);
  sit([`1${x}`, `1${y}`, '2N'], nt, (e) => {
    if (e.hcp < 6) return R('P', [`${e.hcp} HCP opposite 18–19: no game`]);
    if (e.hcp >= 15) return R('6N', [`${e.hcp} HCP opposite 18–19: small slam`]);
    if (e.hcp >= 13) return R('4N', [`${e.hcp} HCP opposite 18–19: invite 6NT`]);
    if (isMajor(y) && e.len[y] >= 6) return R(`4${y}`, [`${e.len[y]} ${nm(y)}: game`]);
    if (isMajor(y) && e.len[y] === 5) return R(`3${y}`, [`5 ${nm(y)}: let opener choose`]);
    return R('3N', [`${e.hcp} HCP opposite 18–19: game`]);
  });
  const jump = [['P', 'Decline.'], ['3N', 'To play.']];
  if (isMajor(x)) jump.push([`4${x}`, 'Game.']);
  else jump.push(['6N', 'Slam: 14+ opposite a good 6-card minor and 16–18.']);
  sit([`1${x}`, `1${y}`, `3${x}`], jump, (e) => {
    if (e.hcp < 8) return R('P', [`${e.hcp} HCP opposite 16–18: decline`]);
    if (!isMajor(x) && e.hcp >= 14) return R('6N', [`${e.hcp} HCP opposite 16–18 and a good minor suit: ${e.hcp + 16}+ points make small slam`]);
    return isMajor(x) && e.len[x] >= 2 ? R(`4${x}`, [`${e.len[x]} ${nm(x)}: game`]) : R('3N', [`${e.hcp} HCP: game`]);
  });
  sit([`1${x}`, `1${y}`, '3N'], [['P', 'To play.']], () => R('P', ['opener bid game']));
}

// ---------- Inverted minor continuations ----------
for (const m of ['C', 'D']) {
  sit([`1${m}`, `2${m}`, '2N'], [['P', '10–12: no game.'], ['3N', 'Game.']], (e) => (e.hcp >= 13 ? R('3N', [`${e.hcp} HCP: game`]) : R('P', [`${e.hcp} HCP opposite 12–14: no game`])), INV);
  sit([`1${m}`, `2${m}`, `3${m}`], [['P', '10–12: no game.'], ['3N', 'Game, the other suits stopped.'], [`5${m}`, 'Game in the minor.']],
    (e) => (e.hcp < 13 ? R('P', [`${e.hcp} HCP: no game`]) : SUITS.filter((s) => s !== m).every((s) => stopper(e, s)) ? R('3N', ['the other suits stopped']) : R(`5${m}`, ['a suit unstopped: game in the minor'])), INV);
  sit([`1${m}`, `2${m}`, '3N'], [['P', 'To play.']], () => R('P', ['opener bid game']), INV);
  for (const z of SUITS.filter((s) => RANK[s] > RANK[m])) {
    const unbid = SUITS.filter((s) => s !== m && s !== z);
    sit([`1${m}`, `2${m}`, `2${z}`], [['3N', 'To play: the unbid suits stopped.'], [`3${m}`, 'Minimum, a suit unstopped: not forcing.'], ['2N', 'Stopper in the unbid suit, 10–12.']],
      (e) => {
        const ok = unbid.every((s) => stopper(e, s));
        if (e.hcp >= 13) return ok ? R('3N', ['the unbid suits stopped']) : R(`3${m}`, ['a suit unstopped: keep looking']);
        return ok ? R('2N', [`${e.hcp} HCP with the unbid suits stopped`]) : R(`3${m}`, [`${e.hcp} HCP: minimum`]);
      }, INV);
  }
}

// ---------- Game tries after 1M–2M ----------
for (const M of ['H', 'S']) {
  const dp = (e) => dummyPoints(e, M);
  for (const s of SUITS.filter((t) => t !== M)) {
    const call = `${M === 'H' && s === 'S' ? 2 : 3}${s}`;
    sit([`1${M}`, `2${M}`, call], [[`3${M}`, 'Decline: no help in that suit and a minimum.'], [`4${M}`, 'Accept: help in that suit, or a maximum.']], (e) => {
      const help = /[AKQ]/.test(e.hand[s]) || e.len[s] <= 2;
      if (dp(e) >= 9 || (dp(e) >= 7 && help)) return R(`4${M}`, [help ? `help in ${nm(s)}` : `${dp(e)} dummy points: a maximum`]);
      return R(`3${M}`, [`no help in ${nm(s)}`, `${dp(e)} dummy points`]);
    }, RAISE);
  }
  sit([`1${M}`, `2${M}`, `3${M}`], [['P', 'Minimum: decline.'], [`4${M}`, 'Maximum: accept.']], (e) => (dp(e) >= 8 ? R(`4${M}`, [`${dp(e)} dummy points: accept`]) : R('P', [`${dp(e)} dummy points: decline`])), RAISE);
  sit([`1${M}`, `2${M}`, `4${M}`], [['P', 'To play.']], () => R('P', ['opener bid game']), RAISE);
  // Jacoby: responder after opener's reply.
  for (const reply of [...SUITS.filter((t) => t !== M).flatMap((t) => [`3${t}`, `4${t}`]), `3${M}`, '3N']) {
    const off = above(`4${M}`, reply) ? `4${M}` : `5${M}`;
    sit([`1${M}`, '2N', reply], [[off, 'Sign-off: no slam interest.'], ['4N', 'RKCB: slam interest.', SLAM]],
      (e) => (e.hcp >= 16 ? R('4N', [`${e.hcp} HCP: slam interest`]) : R(off, [`${e.hcp} HCP: sign off`])), RAISE);
  }
  sit([`1${M}`, '2N', `4${M}`], [['P', 'Opener is minimum.'], ['4N', 'RKCB anyway: a big hand.', SLAM]], (e) => (e.hcp >= 18 ? R('4N', [`${e.hcp} HCP: still slam`]) : R('P', ['opener is minimum'])), RAISE);
  // Opener after the 3-card limit raise in the 1NT sequence.
  for (const x of ['C', 'D', 'H'].filter((t) => t !== M)) {
    sit([`1${M}`, '1N', `2${x}`, `3${M}`], [['P', 'Decline.'], [`4${M}`, 'Accept.']], (e) => (e.hcp >= 14 ? R(`4${M}`, [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])), FNT);
    sit([`1${M}`, '1N', `2${x}`, '2N'], [['P', 'Decline.'], ['3N', 'Accept.'], [`3${M}`, `6 ${nm(M)}, minimum.`]],
      (e) => (e.hcp >= 14 ? R('3N', [`${e.hcp} HCP: accept`]) : e.len[M] >= 6 ? R(`3${M}`, [`${e.len[M]} ${nm(M)}`]) : R('P', [`${e.hcp} HCP: decline`])), FNT);
    sit([`1${M}`, '1N', `2${x}`, `2${M}`], [['P', 'Content.']], () => R('P', ['partner gave preference']), FNT);
  }
}

// ---------- After a 2/1: responder's second bid ----------
for (const [o, r] of [['S', 'C'], ['S', 'D'], ['S', 'H'], ['H', 'C'], ['H', 'D'], ['D', 'C']]) {
  const rebids = [`2${o}`, '2N', `3${r}`, ...SUITS.filter((s) => s !== o && s !== r && RANK[s] > RANK[r]).map((s) => `2${s}`)];
  if (isMajor(o)) rebids.push(`3${o}`);
  if (isMajor(r)) rebids.push(`4${r}`);
  for (const z of rebids) {
    const calls = [];
    const add = (c, m) => { if (above(c, z) && !calls.some((x) => x[0] === c)) calls.push([c, m]); };
    if (z === `4${r}`) { sit([`1${o}`, `2${r}`, z], [['P', 'To play.'], ['4N', 'RKCB: slam interest.', SLAM]], (e) => (e.hcp >= 18 ? R('4N', [`${e.hcp} HCP opposite a minimum: still slam`])
      // Playing strength counts too: a long suit with 4 losers or fewer can make slam opposite a minimum with the right key cards.
      : e.len[r] >= 6 && e.ltc <= 4 ? R('4N', [`${e.len[r]} ${nm(r)}, ${e.ltc} losers: slam is possible opposite a minimum`, 'ask for key cards'])
      : R('P', ['opener is minimum'])), GF, UNPASSED); continue; }
    if (isMajor(o)) { add(`3${o}`, `3+ ${nm(o)}, slam interest (slow).`); add(`4${o}`, `3+ ${nm(o)}, minimum (fast arrival).`); }
    if (z !== `3${r}` && z !== '2N') { add('2N', 'Balanced, stoppers in the unbid suits.'); }
    add('3N', 'To play, no slam interest.');
    add(`3${r}`, `6+ ${nm(r)}.`);
    if (isMajor(r)) add(`4${r}`, `${nm(r)} game.`);
    const zs = z[1];
    if (zs !== o && zs !== r && zs !== 'N') { add(`3${zs}`, `4+ ${nm(zs)} support, slow.`); if (isMajor(zs)) add(`4${zs}`, `4+ ${nm(zs)}, minimum.`); }
    add('4N', 'RKCB: slam interest.');
    sit([`1${o}`, `2${r}`, z], calls.map((c) => (c[0] === '4N' ? [...c, SLAM] : c)), (e) => {
      const h = e.hcp;
      const L = e.len;
      const has = (c) => calls.some((x) => x[0] === c);
      if (z === `3${r}` && isMajor(r)) return h >= 16 ? R('4N', [`${h} HCP and opener's extras: slam`]) : R(`4${r}`, [`${h} HCP: game`]);
      if (isMajor(zs) && zs !== o && L[zs] >= 4) return has(`4${zs}`) && h <= 14 ? R(`4${zs}`, [`4 ${nm(zs)}: a fit`, 'minimum']) : R(`3${zs}`, [`4 ${nm(zs)}: a fit`, 'extras: raise slowly']);
      if (isMajor(o) && L[o] >= (z === `2${o}` || z === `3${o}` ? 2 : 3)) {
        if (h >= 17 && has('4N')) return R('4N', [`${L[o]} ${nm(o)}, ${h} HCP: slam`]);
        if (h <= 14 && has(`4${o}`)) return R(`4${o}`, [`${L[o]} ${nm(o)}`, 'minimum: fast arrival']);
        if (has(`3${o}`)) return R(`3${o}`, [`${L[o]} ${nm(o)}`, 'extras: raise slowly']);
        return R(`4${o}`, [`${L[o]} ${nm(o)}`]);
      }
      if (L[r] >= 6 && has(`3${r}`) && !e.balanced) return R(`3${r}`, [`${L[r]} ${nm(r)}`]);
      const unbid = SUITS.filter((s) => s !== o && s !== r && s !== zs);
      if (has('2N') && unbid.every((s) => stopper(e, s)) && h <= 14) return R('2N', ['balanced with the unbid suits stopped']);
      if (isMajor(r) && L[r] >= 6 && has(`4${r}`)) return R(`4${r}`, [`${L[r]} ${nm(r)}`]);
      return R('3N', [`${h} HCP: game`]);
    }, GF, UNPASSED);
  }
}

// ---------- After Drury (a passed hand's 2♣): responder's second bid ----------
// 2M = a light opening: pass. 4M = a full opening: pass (game already bid).
for (const M of ['H', 'S']) {
  sit([`1${M}`, '2C', `2${M}`], [['P', 'Opener is light: no game.']], () => R('P', ['opener showed a light opening: no game opposite a passed hand']), DRURY, PASSED);
  sit([`1${M}`, '2C', `4${M}`], [['P', 'To play.']], () => R('P', ['opener bid game']), DRURY, PASSED);
}

// ---------- A passed hand's 2-level new suit (natural, 10–11): responder's second bid ----------
// (1M–2♣ by a passed hand is Drury, above.)
for (const [o, r] of [['S', 'D'], ['S', 'H'], ['H', 'D'], ['D', 'C']]) {
  sit([`1${o}`, `2${r}`, `2${o}`], [['P', 'Content: no game.'], [`3${r}`, `6+ ${nm(r)}: to play.`]],
    (e) => (e.len[r] >= 6 && e.len[o] <= 1 ? R(`3${r}`, [`${e.len[r]} ${nm(r)} and a misfit: play in your suit`]) : R('P', ['opener is minimum (or has nothing more to show): no game'])), GF, PASSED);
  const accept = isMajor(o) ? [[`4${o}`, 'Accept: game.']] : [];
  sit([`1${o}`, `2${r}`, `3${o}`], [['P', 'Decline: a minimum without help.'], ...accept, ['3N', 'Accept in notrump: the other suits stopped.']],
    (e) => (isMajor(o) && e.len[o] >= 2 && (e.hcp >= 10 || /[AKQ]/.test(e.hand[o])) ? R(`4${o}`, [`${e.len[o]} ${nm(o)} and ${e.hcp} HCP opposite 14+: game`])
      : e.hcp >= 11 && SUITS.filter((s) => s !== o && s !== r).every((s) => stopper(e, s)) ? R('3N', [`${e.hcp} HCP, the other suits stopped`])
        : R('P', [`${e.len[o]} ${nm(o)}: decline`])), GF, PASSED);
}

// ---------- Opener after notrump sequences ----------
const ntSeqs = (pre, min) => {
  const lv = pre.length === 1 && pre[0] === '1N' ? 2 : 3;
  const max = (e) => e.hcp >= min + 1;
  const s = (calls, ...rest) => sit([...pre, ...calls], ...rest);
  for (const M of ['H', 'S']) {
    const xf = `${lv}${M === 'H' ? 'D' : 'H'}`;
    const comp = `${lv}${M}`;
    s([xf, comp, '3N'], [['P', `2 ${nm(M)}: play 3NT.`], [`4${M}`, `3+ ${nm(M)}: play the major.`]], (e) => (e.len[M] >= 3 ? R(`4${M}`, [`${e.len[M]} ${nm(M)}: 8-card fit`]) : R('P', [`${e.len[M]} ${nm(M)}: 3NT`])), NT);
    if (lv === 2) {
      s([xf, comp, '2N'], [['P', `Minimum, 2 ${nm(M)}.`], [`3${M}`, `Minimum, 3 ${nm(M)}.`], ['3N', `Maximum, 2 ${nm(M)}.`], [`4${M}`, `Maximum, 3 ${nm(M)}.`]],
        (e) => (e.len[M] >= 3 ? (max(e) ? R(`4${M}`, ['3-card fit, maximum']) : R(`3${M}`, ['3-card fit, minimum'])) : (max(e) ? R('3N', ['maximum, no fit']) : R('P', ['minimum, no fit']))), NT);
      s([xf, comp, `3${M}`], [['P', 'Minimum: decline.'], [`4${M}`, 'Accept.']], (e) => (max(e) || e.len[M] >= 3 ? R(`4${M}`, ['accept']) : R('P', ['minimum, 2 trumps: decline'])), NT);
    }
  }
  // Stayman continuations
  const st = `${lv === 2 ? 2 : 3}C`;
  const d = `${lv}D`;
  s([st, d, '3N'], [['P', 'To play.']], () => R('P', ['partner placed the contract']), NT);
  for (const sm of ['H', 'S']) {
    const other = sm === 'H' ? 'S' : 'H';
    s([st, d, `3${sm}`], [[`4${other}`, `3 ${nm(other)}: game in the 5-3 fit.`], ['3N', `Only 2 ${nm(other)}.`]], (e) => (e.len[other] >= 3 ? R(`4${other}`, [`${e.len[other]} ${nm(other)}`]) : R('3N', [`${e.len[other]} ${nm(other)}`])), SMOLEN);
  }
  for (const rep of ['H', 'S']) {
    s([st, `${lv}${rep}`, '3N'], rep === 'H' ? [['P', 'No 4 spades.'], ['4S', '4 spades: partner holds them too.']] : [['P', 'To play.']],
      (e) => (rep === 'H' && e.len.S >= 4 ? R('4S', ['4 spades: partner showed 4 too']) : R('P', ['3NT'])), NT);
    s([st, `${lv}${rep}`, `4${rep}`], [['P', 'To play.']], () => R('P', ['partner bid game']), NT);
  }
  if (lv === 2) {
    s([st, '2D', '2N'], [['P', 'Minimum.'], ['3N', 'Maximum.']], (e) => (max(e) ? R('3N', ['maximum']) : R('P', ['minimum'])), NT);
    s([st, '2H', '2N'], [['P', 'Minimum, not 4 spades.'], ['3N', 'Maximum, not 4 spades.'], ['3S', 'Minimum, 4 spades.'], ['4S', 'Maximum, 4 spades.']],
      (e) => (e.len.S >= 4 ? (max(e) ? R('4S', ['4 spades, maximum']) : R('3S', ['4 spades, minimum'])) : (max(e) ? R('3N', ['maximum']) : R('P', ['minimum']))), NT);
    s([st, '2S', '2N'], [['P', 'Minimum.'], ['3N', 'Maximum.']], (e) => (max(e) ? R('3N', ['maximum']) : R('P', ['minimum'])), NT);
    s([st, '2H', '2S'], [['2N', 'Minimum, not 4 spades.'], ['3N', 'Maximum, not 4 spades.'], ['3S', 'Minimum, 4 spades.'], ['4S', 'Maximum, 4 spades.']],
      (e) => (e.len.S >= 4 ? (max(e) ? R('4S', ['4 spades, maximum']) : R('3S', ['4 spades, minimum'])) : (max(e) ? R('3N', ['maximum']) : R('2N', ['minimum']))), NT);
    for (const rep of ['H', 'S']) s([st, `2${rep}`, `3${rep}`], [['P', 'Minimum: decline.'], [`4${rep}`, 'Accept.']], (e) => (max(e) ? R(`4${rep}`, ['accept']) : R('P', ['decline'])), NT);
    for (const five of ['H', 'S']) {
      s([st, '2D', `2${five}`], [['P', `Minimum, 2 ${nm(five)}.`], ['2N', 'Minimum, no fit.'], [`3${five}`, `Minimum, 3 ${nm(five)}.`], ['3N', 'Maximum, no fit.'], [`4${five}`, `Maximum, 3 ${nm(five)}.`]],
        (e) => (e.len[five] >= 3 ? (max(e) ? R(`4${five}`, ['3-card fit, maximum']) : R(`3${five}`, ['3-card fit, minimum'])) : (max(e) ? R('3N', ['maximum, no fit']) : R('2N', ['minimum, no fit']))), NT);
    }
  }
};
ntSeqs(['1N'], 15);
ntSeqs(['2N'], 20);

// ---------- Opener after XYZ and fourth suit forcing ----------
const XYZ_AUCTIONS = [['C', 'D', 'H'], ['C', 'D', 'S'], ['C', 'D', 'N'], ['C', 'H', 'S'], ['C', 'H', 'N'], ['C', 'S', 'N'], ['D', 'H', 'S'], ['D', 'H', 'N'], ['D', 'S', 'N'], ['H', 'S', 'N']];
for (const [o, r, z] of XYZ_AUCTIONS) {
  const pre = [`1${o}`, `1${r}`, `1${z}`];
  sit([...pre, '2C'], [['2D', 'Forced.']], () => R('2D', ['the 2♣ relay forces 2♦']), XYZ);
  sit([...pre, '2N'], [['3C', 'Forced.']], () => R('3C', ['the 2NT puppet forces 3♣']), XYZ);
  const unbid = SUITS.filter((s) => ![o, r, z].includes(s));
  const calls = [];
  if (isMajor(r)) calls.push([`2${r}`, `3-card ${nm(r)} support.`, undefined, { len: { [r]: [3, 13] } }]);
  for (const s of ['H', 'S']) if (s !== r && s !== o && s !== z && !calls.some((c) => c[0] === `2${s}`)) calls.push([`2${s}`, `4 ${nm(s)}.`, undefined, { len: { [s]: [4, 13] } }]);
  calls.push(['2N', 'Stopper in the unbid suit.'], [`3${o}`, `Long ${nm(o)}, nothing else to show.`]);
  sit([...pre, '2D'], calls, (e) => {
    if (isMajor(r) && e.len[r] >= 3) return R(`2${r}`, [`${e.len[r]} ${nm(r)}: support first`]);
    const m = ['H', 'S'].find((s) => calls.some((c) => c[0] === `2${s}` && c[1].startsWith('4')) && e.len[s] >= 4);
    if (m) return R(`2${m}`, [`4 ${nm(m)}`]);
    if (unbid.every((s) => stopper(e, s))) return R('2N', ['the unbid suit stopped']);
    return R(`3${o}`, [`${e.len[o]} ${nm(o)}`]);
  }, XYZ);
}
for (const [o, r, z] of [['D', 'H', 'C'], ['D', 'S', 'C'], ['H', 'S', 'C'], ['H', 'S', 'D']]) {
  const w = SUITS.find((s) => ![o, r, z].includes(s));
  const fsf = `${RANK[w] > RANK[z] ? 2 : 3}${w}`;
  const calls = [];
  const add = (c, m, sh) => { if (above(c, fsf) && !calls.some((x) => x[0] === c)) calls.push([c, m, undefined, sh]); };
  add(`${RANK[r] > RANK[w] ? Number(fsf[0]) : Number(fsf[0]) + 1}${r}`, `3-card ${nm(r)} support.`, { len: { [r]: [3, 13] } });
  add(fsf[0] === '2' ? '2N' : '3N', `Stopper in ${nm(w)}.`);
  add(`${RANK[o] > RANK[w] ? Number(fsf[0]) : Number(fsf[0]) + 1}${o}`, `Extra length in ${nm(o)}.`);
  add(`${RANK[z] > RANK[w] ? Number(fsf[0]) : Number(fsf[0]) + 1}${z}`, `Extra length in ${nm(z)}.`);
  add(`${Number(fsf[0]) + 1}${w}`, `4 ${nm(w)}.`, { len: { [w]: [4, 13] } });
  sit([`1${o}`, `1${r}`, `2${z}`, fsf], calls, (e) => {
    const c = (prefix) => calls.find((x) => x[1].startsWith(prefix))?.[0];
    if (e.len[r] >= 3) return R(c('3-card'), [`${e.len[r]} ${nm(r)}: support first`]);
    if (stopper(e, w)) return R(c('Stopper'), [`${nm(w)} stopped`]);
    if (e.len[o] >= 6 && c(`Extra length in ${nm(o)}`)) return R(c(`Extra length in ${nm(o)}`), [`${e.len[o]} ${nm(o)}`]);
    if (e.len[z] >= 5 && c(`Extra length in ${nm(z)}`)) return R(c(`Extra length in ${nm(z)}`), [`${e.len[z]} ${nm(z)}`]);
    if (e.len[w] >= 4) return R(c('4 '), [`4 ${nm(w)}`]);
    return R(c(`Extra length in ${nm(o)}`) ?? c('Stopper'), ['nothing better: rebid the long suit']);
  }, FSF);
}


// ---------- XYZ: responder's next bid, opener after weak sign-offs and 1NT ----------
for (const [o, r, z] of XYZ_AUCTIONS) {
  const pre = [`1${o}`, `1${r}`, `1${z}`];
  const inv = [['P', 'Weak with diamonds: to play.'], ['2N', 'Balanced, invitational.'], [`3${o}`, `${nm(o)} support, invitational.`]];
  if (isMajor(r)) inv.push([`2${r}`, `6+ ${nm(r)}, invitational.`]);
  if (r === 'S' && o !== 'H' && z !== 'H') inv.push(['2H', '5 spades + 4 hearts, invitational.']);
  if (isMajor(z)) inv.push([`3${z}`, `4 ${nm(z)}, invitational raise.`]);
  sit([...pre, '2C', '2D'], inv, (e) => {
    const L = e.len;
    if (isMajor(z) && L[z] >= 4) return R(`3${z}`, [`4 ${nm(z)}`, 'invitational raise']);
    if (e.hcp <= 9 && (L.D >= 5 || o === 'D')) return R('P', ['weak with diamonds: play 2♦']);
    if (isMajor(r) && L[r] >= 6) return R(`2${r}`, [`${L[r]} ${nm(r)}`, 'invitational']);
    if (inv.some((c) => c[0] === '2H') && L.S >= 5 && L.H >= 4) return R('2H', ['5 spades + 4 hearts', 'invitational']);
    if (L[o] >= 4) return R(`3${o}`, [`${L[o]} ${nm(o)}`, 'invitational']);
    return R('2N', ['balanced invitation']);
  }, XYZ);
  sit([...pre, '2N', '3C'], [['P', 'Clubs: to play.'], ['3D', 'Diamonds: to play.']], (e) => (e.len.D > e.len.C ? R('3D', ['diamonds: to play']) : R('P', ['clubs: to play'])), XYZ);
  const weak = [];
  if (isMajor(r)) weak.push(`2${r}`);
  if (isMajor(z)) weak.push(`2${z}`);
  for (const w of weak) sit([...pre, w], [['P', 'Partner signed off.']], () => R('P', ['partner signed off']), XYZ);
  if (r === 'S' && o !== 'H' && z === 'N') sit([...pre, '2H'], [['P', '3+ hearts: play here.'], ['2S', 'Prefers spades.']], (e) => (e.len.S > e.len.H ? R('2S', ['spades are better']) : R('P', ['hearts: play here'])), XYZ);
  if (z !== 'N') {
    sit([...pre, '1N'], [['P', 'Minimum: content.'], ['2N', '15–16: invite.'], ['3N', '17–18: game.']],
      (e) => (e.hcp >= 17 ? R('3N', [`${e.hcp} HCP opposite 6–10: game`]) : e.hcp >= 15 ? R('2N', [`${e.hcp} HCP: invite`]) : R('P', [`${e.hcp} HCP: content`])), XYZ);
  }
}

// ---------- Responder after 1m–1NT and opener's rebid ----------
for (const m of ['C', 'D']) {
  const pre = [`1${m}`, '1N'];
  sit([...pre, '2N'], [['P', 'Minimum: decline.'], ['3N', 'Accept.']], (e) => (e.hcp >= 8 ? R('3N', [`${e.hcp} HCP opposite 17–18: accept`]) : R('P', [`${e.hcp} HCP: decline`])), REBID);
  sit([...pre, `2${m}`], [['P', 'Content.']], () => R('P', ['opener is minimum: pass']), REBID);
  sit([...pre, `3${m}`], [['P', 'Decline.'], ['3N', 'Accept with stoppers.']], (e) => (e.hcp >= 8 ? R('3N', [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])), REBID);
  for (const s2 of SUITS.filter((t) => t !== m)) {
    if (RANK[s2] > RANK[m]) {
      sit([...pre, `2${s2}`], [['2N', 'Weak: relay to 3♣.'], ['3N', 'To play.'], [`3${m}`, `${nm(m)} preference, forcing.`], [`3${s2}`, `4 ${nm(s2)}, forcing.`]],
        (e) => (e.hcp <= 7 ? R('2N', [`${e.hcp} HCP: weak relay`]) : e.len[s2] >= 4 ? R(`3${s2}`, [`4 ${nm(s2)}`]) : e.len[m] >= 4 ? R(`3${m}`, [`${e.len[m]} ${nm(m)}`]) : R('3N', [`${e.hcp} HCP: game`])), REBID);
    } else {
      sit([...pre, `2${s2}`], [['P', `Prefers ${nm(s2)}.`], [`2${m}`, `Preference to ${nm(m)}.`]], (e) => (e.len[m] > e.len[s2] ? R(`2${m}`, ['preference']) : R('P', [`${nm(s2)}: play here`])), REBID);
    }
  }
}

// ---------- Opener after responder's invitation in a raised major ----------
for (const [x, M] of [['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  sit([`1${x}`, `1${M}`, `2${M}`, `3${M}`], [['P', 'Minimum: decline.'], [`4${M}`, 'Accept.']], (e) => (e.hcp >= 14 ? R(`4${M}`, [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])), REBID);
}


// ---------- Opener answers an XYZ invitation ----------
for (const [o, r, z] of XYZ_AUCTIONS) {
  const pre = [`1${o}`, `1${r}`, `1${z}`, '2C', '2D'];
  const acc = (e) => e.hcp >= 13;
  sit([...pre, '2N'], [['P', 'Minimum: decline.'], ['3N', 'Maximum: accept.'], ...(isMajor(r) ? [[`3${r}`, `3 ${nm(r)}, minimum.`], [`4${r}`, `3 ${nm(r)}, maximum.`]] : [])],
    (e) => (isMajor(r) && e.len[r] >= 3 ? (acc(e) ? R(`4${r}`, ['3-card support, maximum']) : R(`3${r}`, ['3-card support, minimum'])) : acc(e) ? R('3N', [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])), XYZ);
  sit([...pre, `3${o}`], [['P', 'Minimum: decline.'], ['3N', 'Maximum: accept.']], (e) => (acc(e) ? R('3N', ['accept']) : R('P', ['decline'])), XYZ);
  if (isMajor(r)) sit([...pre, `2${r}`], [['P', 'Minimum: decline.'], [`3${r}`, 'Accept the invitation in part (2 trumps, maximum).'], [`4${r}`, 'Accept.'], ['2N', 'Minimum with a singleton: no fit.']],
    (e) => (acc(e) ? (e.len[r] >= 2 ? R(`4${r}`, ['accept']) : R('2N', ['no fit'])) : R('P', ['decline'])), XYZ);
  if (isMajor(z)) sit([...pre, `3${z}`], [['P', 'Minimum: decline.'], [`4${z}`, 'Accept.']], (e) => (acc(e) ? R(`4${z}`, ['accept']) : R('P', ['decline'])), XYZ);
  if (r === 'S' && o !== 'H' && z !== 'H') sit([...pre, '2H'], [['P', 'Minimum, hearts.'], ['2S', 'Minimum, spades.'], ['3N', 'Maximum, no fit.'], ['4H', 'Maximum, 4 hearts.'], ['4S', 'Maximum, 3 spades.']],
    (e) => (acc(e) ? (e.len.H >= 4 ? R('4H', ['heart fit']) : e.len.S >= 3 ? R('4S', ['spade fit']) : R('3N', ['no fit'])) : e.len.S >= 3 ? R('2S', ['spades']) : R('P', ['hearts'])), XYZ);
}


// ---------- Opener's third bid after common invitations ----------
for (const [x, y] of [['C', 'D'], ['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  sit([`1${x}`, `1${y}`, `2${x}`, '2N'], [['P', 'Minimum: decline.'], ['3N', 'Accept.'], [`3${x}`, 'Minimum, long suit: to play.']],
    (e) => (e.hcp >= 14 ? R('3N', [`${e.hcp} HCP: accept`]) : e.balanced ? R('P', [`${e.hcp} HCP: decline`]) : R(`3${x}`, [`${e.hcp} HCP, unbalanced: play the suit`])), REBID);
  sit([`1${x}`, `1${y}`, `2${x}`, `3${x}`], [['P', 'Minimum: decline.'], ['3N', 'Accept.'], ...(isMajor(x) ? [[`4${x}`, 'Accept.']] : [])],
    (e) => (e.hcp >= 14 ? (isMajor(x) ? R(`4${x}`, ['accept']) : R('3N', ['accept'])) : R('P', ['decline'])), REBID);
  if (isMajor(y)) {
    sit([`1${x}`, `1${y}`, '2N', `3${y}`], [['3N', `Only 2 ${nm(y)}.`], [`4${y}`, `3 ${nm(y)}: the 5-3 fit.`]], (e) => (e.len[y] >= 3 ? R(`4${y}`, [`${e.len[y]} ${nm(y)}`]) : R('3N', [`${e.len[y]} ${nm(y)}`])), REBID);
  }
}
for (const [o, r, z] of XYZ_AUCTIONS) {
  if (!isMajor(r)) continue;
  sit([`1${o}`, `1${r}`, `1${z}`, `3${r}`], [['3N', `Only 2 ${nm(r)}.`], [`4${r}`, `2+ ${nm(r)}: game.`]], (e) => (e.len[r] >= 2 ? R(`4${r}`, [`${e.len[r]} ${nm(r)} opposite 6+`]) : R('3N', ['a singleton: 3NT'])), XYZ);
}


// ---------- Responder after opener answers fourth suit forcing (game forcing) ----------
for (const [o, r, z] of [['D', 'H', 'C'], ['D', 'S', 'C'], ['H', 'S', 'C'], ['H', 'S', 'D']]) {
  const w = SUITS.find((t) => ![o, r, z].includes(t));
  const fsf = `${RANK[w] > RANK[z] ? 2 : 3}${w}`;
  const replies = SITUATIONS.find((x) => x.after.join() === [`1${o}`, `1${r}`, `2${z}`, fsf].join())?.calls ?? {};
  for (const reply of Object.keys(replies)) {
    const calls = [];
    const add = (c, m) => { if ((c === 'P' || above(c, reply)) && !calls.some((x) => x[0] === c)) calls.push([c, m]); };
    if (reply === '3N') add('P', 'To play.');
    add('3N', 'To play.');
    add(`4${r}`, `${nm(r)} game.`);
    if (isMajor(o)) add(`4${o}`, `${nm(o)} game.`);
    add('4N', 'RKCB: slam interest.');
    add(`5${o}`, `${nm(o)} game.`);
    sit([`1${o}`, `1${r}`, `2${z}`, fsf, reply], calls.map((c) => (c[0] === '4N' ? [...c, SLAM] : c)), (e) => {
      const has = (c) => calls.some((x) => x[0] === c);
      const rs = reply[1];
      if (rs === r) return e.hcp >= 17 && has('4N') ? R('4N', [`${nm(r)} agreed, ${e.hcp} HCP: slam`]) : R(`4${r}`, [`opener has ${nm(r)} support: game`]);
      if (rs === 'N') return reply === '3N' ? R('P', ['opener chose 3NT']) : R('3N', [`${nm(w)} stopped by opener: 3NT`]);
      if (isMajor(o) && e.len[o] >= 2 && has(`4${o}`)) return R(`4${o}`, [`${e.len[o]} ${nm(o)} opposite long ${nm(o)}`]);
      if (stopper(e, w) && has('3N')) return R('3N', [`${nm(w)} stopped`]);
      if (isMajor(r) && e.len[r] >= 5 && has(`4${r}`)) return R(`4${r}`, [`${e.len[r]} ${nm(r)}`]);
      return has('3N') ? R('3N', ['game']) : R(`5${o}`, ['game in the minor']);
    }, FSF);
  }
}


// ---------- Opener answers a quantitative 4NT ----------
for (const [x, y] of [['C', 'D'], ['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  sit([`1${x}`, `1${y}`, '2N', '4N'], [['P', '18: decline.'], ['6N', '19: accept.']], (e) => (e.hcp >= 19 ? R('6N', [`${e.hcp} HCP: maximum`]) : R('P', [`${e.hcp} HCP: minimum`])), REBID);
}
for (const [pre, min] of [[['1N', '2C'], 15], [['2N', '3C'], 20]]) {
  const lv = Number(pre[1][0]);
  for (const rep of ['D', 'H', 'S']) {
    sit([...pre, `${lv}${rep}`, '4N'], [['P', 'Minimum: decline.'], ['6N', 'Maximum: accept.']], (e) => (e.hcp >= min + 2 || (e.hcp === min + 1 && e.pattern[0] >= 5) ? R('6N', [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])), NT);
  }
}


// ---------- Opener after 1M–3NT (15–17, 2 cards in the major; proposed) ----------
const NEW = '1m3nt';
for (const M of ['H', 'S']) {
  sit([`1${M}`, '3N'], [['P', 'Balanced 5-card major: play 3NT.'], [`4${M}`, `6+ ${nm(M)} or unbalanced: play the major.`], ['4N', 'Quantitative: 16–17, invites 6NT.'], ['6N', '18+: small slam.']], (e) => {
    if (e.hcp >= 18) return R('6N', [`${e.hcp} HCP opposite 15–17: slam`]);
    if (e.len[M] >= 6 || !e.balanced) return R(`4${M}`, [`${e.len[M]} ${nm(M)}${e.balanced ? '' : ', unbalanced'}: the major plays better`]);
    if (e.hcp >= 16) return R('4N', [`${e.hcp} HCP: invite 6NT`]);
    return R('P', ['balanced minimum: 3NT']);
  }, NEW);
  sit([`1${M}`, '3N', '4N'], [['P', '15–16: decline.'], ['6N', '17: accept.']], (e) => (e.hcp >= 17 ? R('6N', ['maximum: accept']) : R('P', ['decline'])), NEW);
}

const entries = SITUATIONS.flatMap((s) => Object.entries(s.calls).map(([call, c]) => ({
  after: s.after,
  ...(s.ctx && { ctx: s.ctx }),
  call,
  meaning: c.meaning,
  shows: c.shows,
  notes: c.notes,
  priority: 10,
  pick: (e) => s.decide(e).call === call,
  why: (e) => s.decide(e).why,
  plan: (e) => s.decide(e).plan ?? null,
  close: (e) => s.decide(e).close ?? null,
})));

export default entries;
export { SITUATIONS };
