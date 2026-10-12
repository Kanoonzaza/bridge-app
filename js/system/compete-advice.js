import { NAME, dummyPoints } from '../cards.js';
import entries, { def, cheapest, above } from './competitive.js';
import { respond1NT } from './notrump.js';

// Advisor decisions for contested auctions. Each decision is attached to the Decoder entries of its
// situation (competitive.js), so both tabs read the same meanings.
const COMP = 'competitive-bidding-tier-0';
const DONT = 'dont-against-their-1nt-tier-1';
const SUPPORT = 'support-doubles-and-redoubles-tier-2';
const LEB = 'lebensohl-tier-2';

const SUITS4 = ['C', 'D', 'H', 'S'];
const MAJORS = ['H', 'S'];
const RANK = { C: 0, D: 1, H: 2, S: 3 };
const isMajor = (s) => s === 'H' || s === 'S';
const nm = (s) => NAME[s];
const top3 = (e, s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).length;
const stopper = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3) || (/J/.test(e.hand[s]) && e.len[s] >= 4);
const shortness = (e, trump) => SUITS4.some((s) => s !== trump && e.len[s] <= 1);
const longestOf = (e, list) => [...list].sort((a, b) => e.len[b] - e.len[a] || RANK[b] - RANK[a])[0];
const R = (call, why, extra = {}) => ({ call, why, ...extra });
// A raise that has to go to the 3-level needs real values: 4 trumps and 6+ (7+ vulnerable),
// or 3 trumps and 8+ dummy points with 7+ HCP (9+ / 8+ vulnerable).
export function raiseAtThree(e, y, vul) {
  const weVul = vul === 'we' || vul === 'both';
  const dp = dummyPoints(e, y);
  return e.len[y] >= 4 ? dp >= (weVul ? 7 : 6) : e.hcp >= (weVul ? 8 : 7) && dp >= (weVul ? 9 : 8);
}

const SAMPLES = [];
function advise(after, decide, samples) {
  const k = JSON.stringify(after);
  for (const en of entries) {
    if (en.tail || JSON.stringify(en.after) !== k) continue;
    en.priority = 10;
    en.pick = (e, st) => decide(e, st).call === en.call;
    en.why = (e, st) => decide(e, st).why;
    en.plan = (e, st) => decide(e, st).plan ?? null;
    en.close = (e, st) => decide(e, st).close ?? null;
  }
  for (const s of samples) SAMPLES.push({ after, ...s });
}

// ---------- We opened 1o, they overcalled: responder ----------
export function afterTheirOvercall(e, o, ov) {
  const y = ov[1];
  const lv = Number(ov[0]);
  const h = e.hcp;
  const L = e.len;
  const r = cheapest(ov, o);
  const fitNeed = isMajor(o) ? 3 : o === 'D' ? 4 : 5;
  const unbid = MAJORS.filter((s) => s !== o && s !== y);
  const min = lv === 1 ? 6 : lv === 2 ? 8 : 10;
  const majorFirst = !isMajor(o) && h >= min && unbid.some((s) => L[s] >= 4);
  if (L[o] >= fitNeed && !majorFirst) {
    const dp = isMajor(o) ? dummyPoints(e, o) : h;
    const why = [`${L[o]} ${nm(o)}`, `${dp} ${isMajor(o) ? 'dummy points' : 'HCP'}`];
    if (dp >= 13 && isMajor(o) && lv >= 3 && r <= 4) return R(`4${o}`, [...why, 'game values: bid game directly']);
    if (dp >= 10) return R(`${lv + 1}${y}`, [...why, 'a limit raise or better goes through the cue-bid'], { plan: dp >= 13 ? 'You have game values: bid game next even if opener signs off.' : 'If opener signs off in 3 of the suit, pass.' });
    if (h <= 7 && r + 1 <= 4 && (L[o] >= fitNeed + 2 || (L[o] >= fitNeed + 1 && shortness(e, o)))) return R(`${r + 1}${o}`, [...why, 'weak with extra trumps: jump to take their room']);
    if (dp >= 6 && r <= 3) return R(`${r}${o}`, [...why, 'raise: support comes first']);
  }
  if (lv === 1 && unbid.length === 2 && L.H >= 4 && L.S >= 4 && h >= 6) return R('X', ['both majors: the negative double shows them']);
  const ones = SUITS4.filter((s) => s !== o && s !== y && cheapest(ov, s) === 1)
    .filter((s) => L[s] >= (y === 'H' && s === 'S' ? 5 : 4)).sort((a, b) => L[b] - L[a] || RANK[a] - RANK[b]);
  if (ones.length && h >= 6) return R(`1${ones[0]}`, [`${L[ones[0]]} ${nm(ones[0])}`, 'a 1-level new suit: forcing']);
  const big = unbid.find((s) => L[s] >= 5 && h >= 10 && cheapest(ov, s) <= 2);
  if (big) return R(`${cheapest(ov, big)}${big}`, [`${L[big]} ${nm(big)}, ${h} HCP`, 'natural and forcing']);
  if (h >= min && unbid.some((s) => L[s] >= 4)) return R('X', [`4 ${nm(longestOf(e, unbid))}`, `${h} HCP: negative double (${min}+ at this level)`]);
  const news = SUITS4.filter((s) => s !== o && s !== y && L[s] >= 5 && cheapest(ov, s) >= 2);
  if (h >= 10 && news.length) {
    const s = longestOf(e, news);
    return R(`${cheapest(ov, s)}${s}`, [`${L[s]} ${nm(s)}, ${h} HCP`, 'natural, forcing one round']);
  }
  if (stopper(e, y)) {
    if (lv === 1 && h >= 8 && h <= 10) return R('1N', [`${h} HCP with a ${nm(y)} stopper`]);
    if (h >= 11 && h <= 12 && above('2N', ov)) return R('2N', [`${h} HCP with a ${nm(y)} stopper: invitational`]);
    if (h >= 13) return R('3N', [`${h} HCP with a ${nm(y)} stopper`]);
  }
  if (h >= 2 && h <= 5) {
    const s = SUITS4.find((t) => t !== o && t !== y && L[t] >= 6 && cheapest(ov, t) + 1 <= 3);
    if (s) return R(`${cheapest(ov, s) + 1}${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: weak jump shift`]);
  }
  if (h >= min && (lv >= 2 || unbid.every((s) => L[s] >= 3))) return R('X', [`${h} HCP and no good bid: the negative double keeps the auction open`]);
  if (L[y] >= 4 && top3(e, y) >= 2) return R('P', [`${nm(y)} length: pass and hope opener reopens with a double`]);
  return R('P', [`${h} HCP: too weak to act`]);
}

// ---------- We opened 1o, they doubled: responder ----------
export function afterTheirDouble(e, o, passed) {
  const h = e.hcp;
  const L = e.len;
  const dp = isMajor(o) ? dummyPoints(e, o) : h;
  const four = isMajor(o) ? 4 : 5;
  if (L[o] >= four && dp >= 10) return R('2N', [`${L[o]} ${nm(o)}, ${dp} points`, 'Jordan 2NT: limit raise or better']);
  if (isMajor(o) && L[o] === 3 && dp >= 10) {
    return passed ? R('2C', ['3-card limit raise as a passed hand: Drury']) : R('XX', ['10+ with 3-card support'], { plan: `Raise ${nm(o)} on your next turn (3-card limit raise).` });
  }
  if (L[o] >= four && h <= 6 && shortness(e, o)) return R(`3${o}`, [`${L[o]} ${nm(o)}, weak: preemptive raise`]);
  if (L[o] >= four - 1 && dp >= 6) return R(`2${o}`, [`${L[o]} ${nm(o)}, ${dp} points: weak raise`]);
  if (h >= 10) return R('XX', [`${h} HCP: show the strength first`]);
  const ones = SUITS4.filter((s) => s !== o && cheapest(`1${o}`, s) === 1 && L[s] >= 4).sort((a, b) => L[b] - L[a] || RANK[a] - RANK[b]);
  if (ones.length && h >= 6) return R(`1${ones[0]}`, [`${L[ones[0]]} ${nm(ones[0])}: natural, forcing`]);
  const twos = SUITS4.filter((s) => s !== o && cheapest(`1${o}`, s) === 2 && L[s] >= 5 && !(s === 'C' && isMajor(o) && passed));
  if (twos.length && h >= 4) {
    const s = longestOf(e, twos);
    return R(`2${s}`, [`${L[s]} ${nm(s)}, weak: to play`]);
  }
  return R('P', [`${h} HCP: nothing to say yet`]);
}

// ---------- Opener after partner's negative double ----------
export function afterNegativeDouble(e, o, ov) {
  const y = ov[1];
  const lv = Number(ov[0]);
  const h = e.hcp;
  const L = e.len;
  if (lv <= 2 && L[y] >= 4 && top3(e, y) >= 2) return R('P', [`${L[y]} ${nm(y)} with two top honors: convert for penalty`]);
  const us = MAJORS.filter((s) => s !== o && s !== y && L[s] >= 4);
  if (us.length) {
    const u = longestOf(e, us);
    const ul = cheapest(ov, u);
    if (h <= 14) return R(`${ul}${u}`, [`${L[u]} ${nm(u)}: the major partner showed`, `${h} HCP: minimum`]);
    if (h <= 17 && ul + 1 <= 4) return R(`${ul + 1}${u}`, [`${L[u]} ${nm(u)}`, `${h} HCP: jump to invite`]);
    return R(`${lv + 1}${y}`, [`${h} HCP: a big hand`]);
  }
  if (h >= 18) return R(`${lv + 1}${y}`, [`${h} HCP: a big hand`]);
  if (lv === 1 && e.balanced && stopper(e, y)) return R('1N', [`${h} HCP balanced with a ${nm(y)} stopper`]);
  const ol = cheapest(ov, o);
  if (L[o] >= 6 && h >= 16 && ol + 1 <= 3) return R(`${ol + 1}${o}`, [`${L[o]} ${nm(o)}`, `${h} HCP: jump to invite`]);
  if (L[o] >= 6 && ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}`]);
  const other = SUITS4.filter((s) => s !== o && s !== y && !isMajor(s) && L[s] >= 4 && cheapest(ov, s) <= 3);
  if (other.length) return R(`${cheapest(ov, other[0])}${other[0]}`, [`${L[other[0]]} ${nm(other[0])}`]);
  if (ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}: nothing better`]);
  return R('P', [`${h} HCP: nothing to add`]);
}

// ---------- Our 1NT, their natural 2-level overcall: Lebensohl ----------
function lebensohlPlan(e, y) {
  const h = e.hcp;
  const L = e.len;
  const stop = stopper(e, y);
  const fourM = MAJORS.some((s) => s !== y && L[s] === 4);
  const five = SUITS4.filter((s) => s !== y && L[s] >= 5);
  const ups = five.filter((s) => RANK[s] > RANK[y]);
  const downs = five.filter((s) => RANK[s] < RANK[y]);
  return { h, L, stop, fourM, five, ups, downs };
}
export function lebensohl(e, y) {
  const { h, L, stop, fourM, five, ups, downs } = lebensohlPlan(e, y);
  if (L[y] >= 4 && top3(e, y) >= 2 && h >= 8) return R('X', [`${L[y]} ${nm(y)} with two top honors: penalty`]);
  if (h >= 10) {
    if (five.length) return R(`3${longestOf(e, five)}`, [`5+ ${nm(longestOf(e, five))}, ${h} HCP: game forcing`]);
    if (fourM) return stop ? R('2N', ['a 4-card major and a stopper: go slowly'], { plan: `After 3♣, bid 3${y === 'C' ? 'NT' : { D: '♦', H: '♥', S: '♠' }[y]} (Stayman with a stopper).` })
      : R(`3${y}`, ['a 4-card major, no stopper: cue-bid directly (fast denies)']);
    return stop ? R('2N', [`${h} HCP with a ${nm(y)} stopper`], { plan: 'After 3♣, bid 3NT (slow shows a stopper).' }) : R('3N', [`${h} HCP, no ${nm(y)} stopper: 3NT directly (fast denies)`]);
  }
  if (ups.length && h <= 7) return R(`2${longestOf(e, ups)}`, [`5+ ${nm(longestOf(e, ups))}, weak: to play`]);
  if (ups.length) return R('2N', [`5+ ${nm(longestOf(e, ups))}, ${h} HCP`], { plan: `After 3♣, bid 3 of ${nm(longestOf(e, ups))} (invitational).` });
  if (downs.length && h <= 9) return R('2N', [`5+ ${nm(longestOf(e, downs))}, weak`], { plan: downs.includes('C') ? 'After 3♣, pass.' : 'After 3♣, bid 3♦ to play.' });
  return R('P', [`${h} HCP: nothing to say`]);
}
export function afterLebensohlRelay(e, y) {
  const { h, stop, fourM, ups, downs } = lebensohlPlan(e, y);
  if (h >= 10) return fourM && y !== 'C' && stop ? R(`3${y}`, ['Stayman, with a stopper']) : R('3N', ['to play, with a stopper']);
  if (ups.length) return R(`3${longestOf(e, ups)}`, ['invitational']);
  if (downs.includes('D') && y !== 'D') return R('3D', ['diamonds: to play']);
  return y === 'C' ? R('3N', ['to play']) : R('P', ['clubs: to play']);
}

// ---------- They opened: our overcall ----------
export function overcall(e, x, balancing, vul = 'none') {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS4.filter((s) => s !== x);
  const stop = stopper(e, x);
  if (e.balanced && stop && (balancing ? h >= 11 && h <= 14 : h >= 15 && h <= 18)) return R('1N', [`${h} HCP balanced with a ${nm(x)} stopper`]);
  if (!balancing && ((h >= 6 && h <= 11) || h >= 16)) {
    if (!isMajor(x) && L.H >= 5 && L.S >= 5) return R(`2${x}`, ['5-5 in the majors: Michaels']);
    if (isMajor(x)) {
      const om = x === 'H' ? 'S' : 'H';
      if (L[om] >= 5 && (L.C >= 5 || L.D >= 5)) return R(`2${x}`, [`5 ${nm(om)} and a 5-card minor: Michaels`]);
    }
    const low = others.slice(0, 2);
    if (L[low[0]] >= 5 && L[low[1]] >= 5) return R('2N', [`5-5 in ${nm(low[0])} and ${nm(low[1])}: Unusual 2NT`]);
  }
  if (!balancing) {
    const minWj = vul === 'we' || vul === 'both' ? 7 : vul === 'they' ? 4 : 5;
    // A jump that lands at the 2-level is like a weak two (6 cards); one that lands at the 3-level is like a weak three (7 cards).
    const wj = others.find((s) => L[s] === (cheapest(`1${x}`, s) + 1 >= 3 ? 7 : 6) && top3(e, s) >= 2 && h >= minWj && h <= 10);
    if (wj) {
      const lvl = cheapest(`1${x}`, wj) + 1;
      return R(`${lvl}${wj}`, [`${L[wj]} good ${nm(wj)}, ${h} HCP: weak jump overcall`, lvl >= 3 ? 'at the 3-level it needs 7 cards, like a weak three' : 'a weak two-style jump: 6 cards']);
    }
  }
  if (h >= 17) return R('X', [`${h} HCP: double first, then bid again`]);
  for (const s of [...others].filter((t) => L[t] >= 5).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])) {
    const lv = cheapest(`1${x}`, s);
    if (lv === 1 && h >= (balancing ? 7 : 8) && h <= 16) return R(`1${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: overcall`]);
    if (lv === 2 && h >= (balancing ? 9 : 11) && h <= 16 && (top3(e, s) >= 2 || L[s] >= 6)) return R(`2${s}`, [`${L[s]} good ${nm(s)}, ${h} HCP: 2-level overcall`]);
  }
  if (L[x] <= 2 && others.every((s) => L[s] >= 3) && h >= (balancing ? 9 : 12)) return R('X', [`short in ${nm(x)}, support for the other suits`, `${h} HCP: takeout double`]);
  return overcallPass(e, x, balancing);
}

// Why no overcall: name the options that came closest and what each one lacks.
function overcallPass(e, x, balancing) {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS4.filter((s) => s !== x);
  const honors = (s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).join('') || 'no top honor';
  const minTwo = balancing ? 9 : 11;
  const weak3 = !balancing ? others.find((t) => L[t] === 6 && cheapest(`1${x}`, t) + 1 >= 3 && h >= 5 && h <= 10) : null;
  if (weak3) return R('P', [`6 ${nm(weak3)}: a weak jump to the 3-level needs 7 cards (a jump overcall that lands at the 2-level needs only 6)`, `${h} HCP: too weak for an ordinary overcall`]);
  if (h < (balancing ? 7 : 8)) return R('P', [`${h} HCP: too weak to act`]);
  const why = [];
  let close = null;
  const long = [...others].filter((t) => L[t] >= 5).sort((a, b) => L[b] - L[a])[0];
  if (long && cheapest(`1${x}`, long) === 2) {
    if (h >= minTwo && h <= 16) {
      why.push(`${L[long]} ${nm(long)} with ${honors(long)}: a 2-level overcall needs a good suit (two of the A-K-Q) or 6 cards`);
      if (h >= 13) close = `${h} HCP and ${L[long]} ${nm(long)}: many players would overcall 2 of ${nm(long)} anyway, especially not vulnerable. Our agreement asks for a better suit: at the 2-level, a weak suit opposite a weak partner can be doubled and go for a big penalty.`;
    } else if (h < minTwo) why.push(`${h} HCP: too few for a 2-level overcall (${minTwo}+)`);
  }
  if (L[x] >= 3) why.push(`${L[x]} ${nm(x)}: too many in their suit for a takeout double`);
  else if (others.some((t) => L[t] <= 2)) why.push(`only ${L[others.find((t) => L[t] <= 2)]} ${nm(others.find((t) => L[t] <= 2))}: no support for every unbid suit, so no takeout double`);
  if (e.balanced && h >= 15 && h <= 18 && !stopper(e, x)) why.push(`no ${nm(x)} stopper for a 1NT overcall`);
  else if (e.balanced && stopper(e, x) && !balancing && h < 15) why.push(`${h} HCP: too few for a 1NT overcall (15–18)`);
  why.push(h >= 12 ? 'pass for now: you can still compete later, when you know more' : 'pass');
  return R('P', why, close ? { close } : {});
}

export function dont(e, vul = 'none') {
  const h = e.hcp;
  const L = e.len;
  if (h < 8 || h > 15) return R('P', [`${h} HCP: ${h < 8 ? 'too weak' : 'defend'}`]);
  const risk = vul === 'we' || vul === 'both' ? ['we are vulnerable: DONT needs a sound hand, because a double costs more'] : vul === 'they' ? ['they are vulnerable: a good time to get in, the risk is low'] : [];
  const sh = (...parts) => [...parts, `${h} HCP: a playing hand (DONT is roughly 8–15)`, ...risk];
  const five = (a, b) => L[a] >= 4 && L[b] >= 4 && Math.max(L[a], L[b]) >= 5;
  if (five('H', 'S')) return R('2H', sh(`${L.H} hearts and ${L.S} spades`), { plan: 'Partner passes with hearts, or bids 2♠ with spades.' });
  if (L.S >= 6 && !SUITS4.some((s) => s !== 'S' && L[s] >= 4)) return R('2S', sh(`${L.S} spades, one-suited`));
  const lower = ['D', 'H', 'S'].find((s) => five('C', s));
  if (lower) return R('2C', sh(`${L.C} clubs and ${L[lower]} ${nm(lower)}`), { plan: 'Partner passes with clubs, or bids 2♦ to ask for your other suit.' });
  const mj = MAJORS.find((s) => five('D', s));
  if (mj) {
    const weak = top3(e, mj) === 0;
    return R('2D', sh(`${L.D} diamonds and ${L[mj]} ${nm(mj)}`), {
      plan: 'Partner passes with diamonds, or bids 2♥ (pass or correct: pass with hearts, then you bid 2♠ with spades).',
      close: weak ? `Your ${nm(mj)} (${e.hand[mj]}) have no top honor: DONT works best with a decent second suit, because partner may be left in a poor fit. Passing is also reasonable.` : null,
    });
  }
  if (SUITS4.some((s) => L[s] >= 6)) return R('X', sh('one long suit'), { plan: 'Partner bids 2♣: pass with clubs, or bid your suit.' });
  return R('P', ['no DONT shape: pass']);
}

export function overWeakTwo(e, x, lv, balancing) {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS4.filter((s) => s !== x);
  const stop = stopper(e, x);
  const minX = (lv === 3 ? 13 : 12) - (balancing ? 2 : 0);
  const leap = lv === 2 ? leapingMichaels(e, x) : null;
  if (leap) return leap;
  if (lv === 2 && e.balanced && stop && h >= 15 && h <= 18) return R('2N', [`${h} HCP balanced, ${nm(x)} stopped`]);
  if (stop && h >= (lv === 2 ? 19 : 16) && e.balanced) return R('3N', [`${h} HCP, ${nm(x)} stopped`]);
  if ((L[x] <= 2 && others.every((s) => L[s] >= 3) && h >= minX) || h >= 17) return R('X', [`${h} HCP`, 'takeout double']);
  const s = others.filter((t) => L[t] >= 5 && (top3(e, t) >= 2 || L[t] >= 6)).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])[0];
  if (s && h >= minX) return R(`${cheapest(`${lv}${x}`, s)}${s}`, [`${L[s]} good ${nm(s)}, ${h} HCP`]);
  return R('P', [`${h} HCP: pass`]);
}

// ---------- Advancing ----------
export function advanceOvercall(e, x, ov, vul = 'none') {
  const y = ov[1];
  const lv = Number(ov[0]);
  const h = e.hcp;
  const L = e.len;
  if (L[y] >= 3) {
    const dp = dummyPoints(e, y);
    if (dp >= 10) return R(`${cheapest(ov, x)}${x}`, [`${L[y]} ${nm(y)}, ${dp} points: cue-bid raise`]);
    if (h <= 7 && (L[y] >= 5 || (L[y] >= 4 && shortness(e, y)))) return R(`${lv + 2}${y}`, [`${L[y]} ${nm(y)}, weak: preemptive jump raise`]);
    if (lv + 1 <= 2 ? dp >= 5 : raiseAtThree(e, y, vul)) return R(`${lv + 1}${y}`, [`${L[y]} ${nm(y)}: raise`, lv + 1 <= 2 ? 'competitive: raise even when light' : 'enough for a raise to the 3-level']);
  }
  if (stopper(e, x)) {
    if (lv === 1 && h >= 8 && h <= 11) return R('1N', [`${h} HCP with a ${nm(x)} stopper`]);
    if (h >= 11 && h <= 12 && above('2N', ov)) return R('2N', [`${h} HCP with a ${nm(x)} stopper`]);
    if (h >= 13) return R('3N', [`${h} HCP with a ${nm(x)} stopper`]);
  }
  const own = SUITS4.filter((s) => s !== x && s !== y && L[s] >= 5);
  if (own.length && h >= 8) {
    const s = longestOf(e, own);
    return R(`${cheapest(ov, s)}${s}`, [`${L[s]} ${nm(s)}: natural, not forcing`]);
  }
  return R('P', [`${h} HCP: pass`]);
}

export function advanceTakeout(e, x) {
  const h = e.hcp;
  const L = e.len;
  if (h >= 12) return R(`2${x}`, [`${h} HCP: cue-bid, forcing`]);
  if (L[x] >= 5 && top3(e, x) >= 2 && h >= 8) return R('P', [`long strong ${nm(x)}: convert for penalty`]);
  const majors = MAJORS.filter((s) => s !== x && L[s] >= 4);
  const best = majors.length ? longestOf(e, majors) : null;
  if (!best && stopper(e, x) && h >= 6) {
    if (h <= 10) return R('1N', [`${h} HCP with a ${nm(x)} stopper`]);
    return R(h <= 12 ? '2N' : '3N', [`${h} HCP with a ${nm(x)} stopper`]);
  }
  const s = best ?? longestOf(e, SUITS4.filter((t) => t !== x));
  const lv = cheapest(`1${x}`, s);
  if (h >= 9) return R(`${lv + 1}${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: jump to invite`]);
  return R(`${lv}${s}`, [`${L[s]} ${nm(s)}`, `${h} HCP: bid your best suit cheaply (you must bid)`]);
}

export function advanceMichaels(e, x) {
  const L = e.len;
  if (!isMajor(x)) {
    const s = L.S >= L.H ? 'S' : 'H';
    return R(`${e.hcp >= 10 ? 3 : 2}${s}`, [`${L[s]} ${nm(s)}: choose the major`, e.hcp >= 10 ? 'invitational' : 'to play']);
  }
  const om = x === 'H' ? 'S' : 'H';
  const lv = cheapest(`2${x}`, om);
  if (L[om] >= 3) return R(`${e.hcp >= 10 ? lv + 1 : lv}${om}`, [`${L[om]} ${nm(om)}: support`]);
  return R('2N', [`no ${nm(om)} fit: ask for the minor`]);
}
export function advanceUnusual(e, x) {
  const [a, b] = SUITS4.filter((s) => s !== x).slice(0, 2);
  const s = e.len[b] > e.len[a] ? b : a;
  return R(`3${s}`, [`${e.len[s]} ${nm(s)}: choose`]);
}

export function advanceWeakTwoDouble(e, x) {
  const h = e.hcp;
  const L = e.len;
  const majors = MAJORS.filter((s) => s !== x && L[s] >= 4);
  if (h >= 12) {
    const five = majors.find((s) => L[s] >= 5);
    if (five) return R(`4${five}`, [`${L[five]} ${nm(five)}, ${h} HCP: game`]);
    if (majors.length) return R(`3${x}`, [`${h} HCP and a 4-card major: cue-bid`]);
    return stopper(e, x) ? R('3N', [`${h} HCP, ${nm(x)} stopped`]) : R(`3${x}`, [`${h} HCP, no stopper: cue-bid`]);
  }
  const s = majors.length ? longestOf(e, majors) : longestOf(e, SUITS4.filter((t) => t !== x));
  const lv = cheapest(`2${x}`, s);
  if (h >= 8) return R(`3${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: constructive`]);
  if (lv === 2) return R(`2${s}`, [`${L[s]} ${nm(s)}, weak`]);
  return R('2N', [`${h} HCP: weak`, 'Lebensohl: relay to 3♣'], { plan: s === 'C' ? 'After 3♣, pass.' : `After 3♣, bid 3 of ${nm(s)}.` });
}

// ---------- Registration (and the extra Decoder meanings the decisions need) ----------
for (const x of SUITS4) {
  for (const bal of [false, true]) {
    const k = bal ? [`(1${x})`, 'P'] : [`(1${x})`];
    def(k, 'P', 'Pass: no suitable action.');
    advise(k, (e, st) => overcall(e, x, bal, st.ctx.vul), [bal ? { dealer: 'W', calls: [`1${x}`, 'P', 'P'] } : { dealer: 'E', calls: [`1${x}`] }]);
  }
  for (const lv of [2, 3]) {
    if (lv === 2 && x === 'C') continue;
    for (const bal of lv === 2 ? [false, true] : [false]) {
      const k = bal ? [`(2${x})`, 'P'] : [`(${lv}${x})`];
      def(k, 'P', 'Pass.');
      advise(k, (e) => overWeakTwo(e, x, lv, bal), [bal ? { dealer: 'W', calls: [`2${x}`, 'P', 'P'] } : { dealer: 'E', calls: [`${lv}${x}`] }]);
    }
  }
  // Advancing
  for (const y of SUITS4.filter((t) => t !== x)) {
    const ov = `${cheapest(`1${x}`, y)}${y}`;
    const k = [`(1${x})`, ov];
    def(k, 'P', 'Pass: no fit and nothing to add.');
    def(k, '3N', `13+ with a ${nm(x)} stopper: to play.`, { hcp: [13, 37] });
    advise(k, (e, st) => advanceOvercall(e, x, ov, st.ctx.vul), [{ dealer: 'W', calls: [`1${x}`, ov, 'P'] }]);
  }
  advise([`(1${x})`, 'X'], (e) => advanceTakeout(e, x), [{ dealer: 'W', calls: [`1${x}`, 'X', 'P'] }]);
  advise([`(1${x})`, `2${x}`], (e) => advanceMichaels(e, x), [{ dealer: 'W', calls: [`1${x}`, `2${x}`, 'P'] }]);
  advise([`(1${x})`, '2N'], (e) => advanceUnusual(e, x), [{ dealer: 'W', calls: [`1${x}`, '2N', 'P'] }]);
}
for (const x of ['D', 'H', 'S']) {
  const k = [`(2${x})`, 'X'];
  for (const s of SUITS4.filter((t) => t !== x && cheapest(`2${x}`, t) === 2)) def(k, `3${s}`, `8–11, constructive: 4+ ${nm(s)}.`, { hcp: [8, 11], len: { [s]: [4, 13] } }, LEB);
  advise(k, (e) => advanceWeakTwoDouble(e, x), [{ dealer: 'W', calls: [`2${x}`, 'X', 'P'] }]);
  def([`(2${x})`, 'X', '2N'], '3C', 'Forced: partner signs off next.', {}, LEB);
  advise([`(2${x})`, 'X', '2N'], () => R('3C', ['the 2NT relay forces 3♣']), [{ dealer: 'E', calls: [`2${x}`, 'X', 'P', '2N', 'P'] }]);
  advise([`(2${x})`, 'X', '2N', '3C'], (e) => {
    const s = longestOf(e, SUITS4.filter((t) => t !== x));
    return s === 'C' ? R('P', ['clubs: to play']) : R(`3${s}`, [`${nm(s)}: to play`]);
  }, [{ dealer: 'W', calls: [`2${x}`, 'X', 'P', '2N', 'P', '3C', 'P'] }]);
}

// DONT
for (const pre of [['(1N)'], ['(1N)', 'P']]) {
  const bal = pre.length === 2;
  def(pre, 'P', 'Pass: no DONT shape.', {}, DONT);
  advise(pre, (e, st) => dont(e, st.ctx.vul), [bal ? { dealer: 'W', calls: ['1N', 'P', 'P'] } : { dealer: 'E', calls: ['1N'] }]);
  const adv = (their) => (bal ? { dealer: 'E', calls: ['1N', 'P', 'P', their, 'P'] } : { dealer: 'W', calls: ['1N', their, 'P'] });
  advise([...pre, 'X'], (e) => {
    const own = ['D', 'H', 'S'].find((s) => e.len[s] >= 6 && e.len.C <= 2);
    return own ? R(`2${own}`, [`${e.len[own]} ${nm(own)} of your own: to play`]) : R('2C', ['relay: partner shows the long suit']);
  }, [adv('X')]);
  advise([...pre, '2C'], (e) => (e.len.C >= 3 ? R('P', ['club support: play here']) : R('2D', ['ask for the other suit'])), [adv('2C')]);
  advise([...pre, '2D'], (e) => (e.len.D >= 3 ? R('P', ['diamond support: play here']) : R('2H', ['pass or correct'])), [adv('2D')]);
  advise([...pre, '2H'], (e) => (e.len.H >= e.len.S ? R('P', ['hearts: play here']) : R('2S', ['spades are better'])), [adv('2H')]);
  advise([...pre, '2S'], (e) => (e.len.S >= 4 && e.hcp >= 10 ? R('3S', ['a fit and values: raise']) : R('P', ['pass'])), [adv('2S')]);
  const own = (their, list) => (bal ? { dealer: 'W', calls: ['1N', 'P', 'P', their[0], 'P', their[1], 'P'] } : { dealer: 'E', calls: ['1N', their[0], 'P', their[1], 'P'] });
  advise([...pre, 'X', '2C'], (e) => {
    const s = longestOf(e, SUITS4);
    return s === 'C' ? R('P', ['my suit is clubs']) : R(`2${s}`, [`my suit is ${nm(s)}`]);
  }, [own(['X', '2C'])]);
  advise([...pre, '2C', '2D'], (e) => {
    const s = longestOf(e, ['D', 'H', 'S']);
    return s === 'D' ? R('P', ['my other suit is diamonds']) : R(`2${s}`, [`my other suit is ${nm(s)}`]);
  }, [own(['2C', '2D'])]);
  advise([...pre, '2D', '2H'], (e) => (e.len.H >= e.len.S ? R('P', ['my major is hearts']) : R('2S', ['my major is spades'])), [own(['2D', '2H'])]);
}

// We opened: responder after their overcall or double; opener after a negative double.
for (const o of SUITS4) {
  for (const y of SUITS4.filter((t) => t !== o)) {
    for (let lv = cheapest(`1${o}`, y); lv <= 3; lv++) {
      const ov = `${lv}${y}`;
      const k = [`1${o}`, `(${ov})`];
      def(k, 'P', 'Pass: weak, or length in their suit (hoping opener reopens with a double).');
      if (above('2N', ov)) def(k, '2N', `Natural: 11–12 with a ${nm(y)} stopper, invitational.`, { hcp: [11, 12] });
      def(k, '3N', `To play: 13+ with a ${nm(y)} stopper.`, { hcp: [13, 37] });
      advise(k, (e) => afterTheirOvercall(e, o, ov), [{ dealer: 'N', calls: [`1${o}`, ov] }, { dealer: 'S', calls: ['P', 'P', `1${o}`, ov] }]);
      const n = [`1${o}`, `(${ov})`, 'X'];
      for (const s of SUITS4.filter((t) => t !== o && t !== y && !isMajor(t) && cheapest(ov, t) <= 3)) def(n, `${cheapest(ov, s)}${s}`, `4+ ${nm(s)}, natural.`, { len: { [s]: [4, 13] } });
      advise(n, (e) => afterNegativeDouble(e, o, ov), [{ dealer: 'S', calls: [`1${o}`, ov, 'X', 'P'] }]);
    }
  }
  const d = [`1${o}`, '(X)'];
  def(d, 'P', 'Pass: weak, nothing to show.');
  advise(d, (e, st) => afterTheirDouble(e, o, st.ctx.responderPassed), [{ dealer: 'N', calls: [`1${o}`, 'X'] }, { dealer: 'S', calls: ['P', 'P', `1${o}`, 'X'] }]);
}

for (const [o, r] of [['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  const overs = ['X'];
  for (const s of SUITS4.filter((t) => t !== r)) {
    const lv = cheapest(`1${r}`, s);
    if (!above(`${lv}${s}`, `2${r}`)) overs.push(`${lv}${s}`);
  }
  for (const ov of overs) {
    const k = [`1${o}`, `1${r}`, `(${ov})`];
    def(k, 'P', `No ${nm(r)} support: pass for now.`, {}, SUPPORT);
    const ol = cheapest(ov === 'X' ? `1${r}` : ov, o);
    if (ol <= 3) def(k, `${ol}${o}`, `6+ ${nm(o)}, no ${nm(r)} support.`, { len: { [o]: [6, 13] } }, SUPPORT);
    // Opener's decision is attached with the third batch (openerFreeRebid), which adds the natural bids.
  }
}

for (const y of SUITS4) {
  const k = ['1N', `(2${y})`];
  def(k, 'P', 'Pass: nothing to say.', {}, LEB);
  advise(k, (e) => lebensohl(e, y), [{ dealer: 'N', calls: ['1N', `2${y}`] }]);
  advise(['1N', `(2${y})`, '2N'], () => R('3C', ['the Lebensohl relay forces 3♣']), [{ dealer: 'S', calls: ['1N', `2${y}`, '2N', 'P'] }]);
  advise(['1N', `(2${y})`, '2N', '3C'], (e) => afterLebensohlRelay(e, y), [{ dealer: 'N', calls: ['1N', `2${y}`, '2N', 'P', '3C', 'P'] }]);
}
def(['1N', '(X)'], 'P', 'Weak: pass (systems are on with any long suit).');
advise(['1N', '(X)'], (e) => {
  const c = respond1NT(e).call;
  if (['2C', '2D', '2H'].includes(c)) return R(c, ['systems on: same as without the double']);
  return e.hcp >= 9 ? R('XX', [`${e.hcp} HCP: we have the balance of strength`]) : R('P', [`${e.hcp} HCP: pass`]);
}, [{ dealer: 'N', calls: ['1N', 'X'] }]);


// ---------- We opened 1o; they bid Michaels (2o), Unusual 2NT or 1NT ----------
export function overTheirConvention(e, o, their, vul = 'none') {
  const h = e.hcp;
  const L = e.len;
  const fitNeed = isMajor(o) ? 3 : o === 'D' ? 4 : 5;
  const lv = their === '1N' ? 2 : 3;
  if (their === '1N' && h >= 9) return R('X', [`${h} HCP: penalty double of their 1NT`]);
  if (L[o] >= fitNeed) {
    const dp = isMajor(o) ? dummyPoints(e, o) : h;
    const cue = theirCue(o, their);
    if (cue && dp >= 10) return R(cue, [`${L[o]} ${nm(o)}, ${dp} points`, 'cue-bid of their cheaper suit: limit raise or better']);
    if (isMajor(o) && dp >= 13 && lv === 3) return R(`4${o}`, [`${L[o]} ${nm(o)}, ${dp} points: game`]);
    if (dp >= 6) return R(`${lv}${o}`, [`${L[o]} ${nm(o)}: compete`]);
  }
  if (their !== '1N' && h >= 10) return R('X', [`${h} HCP: values, interest in penalizing them`]);
  // Over their strong 1NT the weak suit bid must stand on its own: 6+ cards or a good 5-card suit
  // (two of the top three honors); vulnerable, a good suit either way. LHO sits over us with the rest.
  const playable = (t) => (vul === 'we' || vul === 'both' ? top3(e, t) >= 2 : L[t] >= 6 || top3(e, t) >= 2);
  const own = SUITS4.filter((t) => t !== o && L[t] >= 5 && h >= (their === '1N' ? 5 : 8) && (their !== '1N' || playable(t)));
  if (own.length) {
    const t = longestOf(e, own);
    return R(`${cheapest(their, t)}${t}`, [`${L[t]} ${nm(t)}${their === '1N' ? (top3(e, t) >= 2 ? ', a good suit' : ', a 6-card suit') : ''}: natural`]);
  }
  const poor = their === '1N' && SUITS4.find((t) => t !== o && L[t] >= 5);
  if (poor) return R('P', [`${h} HCP and a poor ${L[poor]}-card ${nm(poor)} suit: too weak to bid at the 2-level over their strong 1NT${vul === 'we' || vul === 'both' ? ' vulnerable' : ''}`]);
  return R('P', [`${h} HCP: pass`]);
}
// Their two suits: Michaels over a minor = both majors; over a major = the other major (+ a minor); Unusual 2NT = the two lowest unbid.
// Our cue-bid of the cheaper known suit = limit raise or better in our suit (proposed).
function theirCue(o, their) {
  if (their === '1N') return null;
  const known = their === '2N' ? SUITS4.filter((t) => t !== o).slice(0, 2) : isMajor(o) ? [o === 'H' ? 'S' : 'H'] : ['H', 'S'];
  const s = known[0];
  return `${cheapest(their, s)}${s}`;
}
for (const o of SUITS4) {
  for (const their of [`2${o}`, '2N', '1N']) {
    const k = [`1${o}`, `(${their})`];
    const cue = theirCue(o, their);
    if (cue) def(k, cue, `Cue-bid of their suit: limit raise or better in ${nm(o)} (10+${isMajor(o) ? ' points counting shortness' : ''}). (Proposed.)`, { hcp: [10, 37], len: { [o]: [3, 13] }, force: 'round', ...(isMajor(o) && { pts: o }) }, 'new-agreements-proposed');
    def(k, 'X', their === '1N' ? 'Penalty: 9+ HCP.' : 'Values (10+), usually short in our suit: interest in penalizing them.', { hcp: [their === '1N' ? 9 : 10, 37] });
    def(k, 'P', 'Pass.');
    const lv = their === '1N' ? 2 : 3;
    def(k, `${lv}${o}`, `Competitive raise of ${nm(o)}.`, { len: { [o]: [3, 13] } });
    if (isMajor(o) && lv === 3) def(k, `4${o}`, `Game in ${nm(o)}.`, { len: { [o]: [3, 13] } });
    // With more, responder doubles: a suit bid here is natural and limited, not forcing.
    for (const t of SUITS4.filter((x) => x !== o)) {
      def(k, `${cheapest(their, t)}${t}`, their === '1N' ? `Natural, to play: 6+ ${nm(t)} or a good 5-card suit, 5–8 HCP (with 9+ double). Not forcing.` : `Natural: 5+ ${nm(t)}, 8–9 HCP (with 10+ double). Not forcing.`,
        { hcp: their === '1N' ? [5, 8] : [8, 9], len: { [t]: [5, 13] } });
    }
    advise(k, (e, st) => overTheirConvention(e, o, their, st.ctx.vul), [{ dealer: 'N', calls: [`1${o}`, their] }]);
  }
}


// ---------- Responder after opener answers the negative double ----------
export function afterNegXAnswer(e, o, ov, z) {
  const y = ov[1];
  const h = e.hcp;
  const zs = z[1];
  if (zs === y) {
    // Opener's cue-bid (18+) is forcing: show the major, else notrump with a stopper, else support opener.
    const u = MAJORS.filter((s) => s !== o && s !== y && e.len[s] >= 4).sort((a, b) => e.len[b] - e.len[a])[0];
    if (u) return R(`${cheapest(z, u)}${u}`, [`opener has a big hand: show your ${nm(u)}`]);
    if (stopper(e, y) && above('3N', z)) return R('3N', [`${nm(y)} stopped`]);
    return R(`${cheapest(z, o)}${o}`, [`support ${nm(o)}`]);
  }
  if (isMajor(zs) && zs !== o && e.len[zs] >= 4) {
    const jumped = Number(z[0]) > cheapest(ov, zs);
    if ((h >= 13 || (jumped && h >= 9)) && Number(z[0]) < 4) return R(`4${zs}`, [`4 ${nm(zs)}: a fit`, jumped ? `${h} HCP opposite 15–17: game` : `${h} HCP: game`]);
    if (h >= 11 && Number(z[0]) < 3) return R(`3${zs}`, [`4 ${nm(zs)}: a fit`, `${h} HCP: invite`]);
    return R('P', [`${h} HCP: no game`]);
  }
  if (h >= 13 && above('3N', z)) return R('3N', [`${h} HCP: game`]);
  if (h >= 11 && stopper(e, y) && above('2N', z)) return R('2N', [`${h} HCP, ${nm(y)} stopped: invite`]);
  return R('P', [`${h} HCP: no game`]);
}
for (const o of SUITS4) {
  for (const y of SUITS4.filter((t) => t !== o)) {
    for (let lv = cheapest(`1${o}`, y); lv <= 3; lv++) {
      const ov = `${lv}${y}`;
      const negKey = JSON.stringify([`1${o}`, `(${ov})`, 'X']);
      const answers = entries.filter((en) => !en.tail && JSON.stringify(en.after) === negKey && en.call !== 'P' && !en.call.startsWith('X')).map((en) => en.call);
      for (const z of answers) {
        const k = [`1${o}`, `(${ov})`, 'X', z];
        if (z[1] === y) {
          for (const u of MAJORS.filter((s) => s !== o && s !== y)) def(k, `${cheapest(z, u)}${u}`, `4+ ${nm(u)}, as promised.`, { len: { [u]: [4, 13] } });
          if (above('3N', z)) def(k, '3N', `To play, ${nm(y)} stopped.`);
          def(k, `${cheapest(z, o)}${o}`, `${nm(o)} support.`);
        }
        def(k, 'P', 'No game.');
        if (above('2N', z)) def(k, '2N', `Invitational, ${nm(y)} stopped.`, { hcp: [11, 12] });
        if (above('3N', z)) def(k, '3N', 'To play.', { hcp: [13, 37] });
        if (isMajor(z[1]) && z[1] !== o) {
          if (Number(z[0]) < 3) def(k, `3${z[1]}`, `4 ${nm(z[1])}: invitational raise.`, { hcp: [11, 12] });
          if (Number(z[0]) < 4) def(k, `4${z[1]}`, `4 ${nm(z[1])}: game.`, { hcp: [13, 37] });
        }
        advise(k, (e) => afterNegXAnswer(e, o, ov, z), [{ dealer: 'N', calls: [`1${o}`, ov, 'X', 'P', z, 'P'] }]);
      }
    }
  }
}

// ---------- They opened and responded: our first action ----------
export function overTheirResponse(e, x, resp) {
  const h = e.hcp;
  const L = e.len;
  const theirs = [x, resp[1]].filter((s) => s !== 'N');
  const unbid = SUITS4.filter((s) => !theirs.includes(s));
  const own = unbid.filter((s) => L[s] >= 5 && (top3(e, s) >= 2 || L[s] >= 6)).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])[0];
  if (own) {
    const lv = cheapest(resp, own);
    if ((lv === 1 && h >= 9) || (lv === 2 && h >= 11)) return R(`${lv}${own}`, [`${L[own]} good ${nm(own)}, ${h} HCP`]);
  }
  if (h >= 12 && unbid.every((s) => L[s] >= 4) && theirs.every((s) => L[s] <= 2)) return R('X', [`${h} HCP, 4+ in both unbid suits: takeout`]);
  return R('P', [`${h} HCP: they have the values; pass`]);
}
for (const x of SUITS4) {
  const resps = [...SUITS4.filter((s) => RANK[s] > RANK[x]).map((s) => `1${s}`), '1N', `2${x}`];
  for (const resp of resps) {
    const k = [`(1${x})`, 'P', `(${resp})`];
    const theirs = [x, resp[1]].filter((s) => s !== 'N');
    const unbid = SUITS4.filter((s) => !theirs.includes(s));
    def(k, 'P', 'Pass.');
    def(k, 'X', `Takeout: the unbid suits (${unbid.map(nm).join(' and ')}), 12+.`, { hcp: [12, 37] });
    for (const s of unbid) def(k, `${cheapest(resp, s)}${s}`, `Natural: good 5+ ${nm(s)}.`, { len: { [s]: [5, 13] } });
    advise(k, (e) => overTheirResponse(e, x, resp), [{ dealer: 'W', calls: [`1${x}`, 'P', resp] }]);
  }
}


// ---------- Responder after opener's support double / redouble ----------
export function afterSupportDouble(e, r) {
  const h = e.hcp;
  const L = e.len;
  if (L[r] >= 5) {
    if (h >= 13) return R(`4${r}`, [`${L[r]} ${nm(r)} opposite 3: an 8-card fit`, `${h} HCP: game`]);
    if (h >= 10) return R(`3${r}`, [`${L[r]} ${nm(r)}: an 8-card fit`, `${h} HCP: invite`]);
    return R(`2${r}`, [`${L[r]} ${nm(r)}: an 8-card fit`, 'weak: compete']);
  }
  if (h >= 13) return R('3N', [`${h} HCP, only a 7-card fit: notrump`]);
  return R('P', [`${h} HCP, only 4 ${nm(r)}: no clear action`]);
}
for (const [o, r] of [['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  const overs = ['X'];
  for (const t of SUITS4.filter((u) => u !== r)) {
    const lv = cheapest(`1${r}`, t);
    if (!above(`${lv}${t}`, `2${r}`)) overs.push(`${lv}${t}`);
  }
  for (const ov of overs) {
    const sup = ov === 'X' ? 'XX' : 'X';
    const k = [`1${o}`, `1${r}`, `(${ov})`, sup];
    def(k, 'P', 'Pass.', {}, SUPPORT);
    if (ov !== `2${r}` && (ov === 'X' || !above(ov, `2${r}`))) def(k, `2${r}`, `5+ ${nm(r)}, weak: compete in the 8-card fit.`, {}, SUPPORT);
    def(k, `3${r}`, `5+ ${nm(r)}, invitational.`, {}, SUPPORT);
    def(k, `4${r}`, `5+ ${nm(r)}, game.`, {}, SUPPORT);
    def(k, '3N', 'To play.', {}, SUPPORT);
    advise(k, (e) => afterSupportDouble(e, r), [{ dealer: 'N', calls: [`1${o}`, 'P', `1${r}`, ov, sup, 'P'] }]);
  }
}


// ---------- New agreements (proposed, Oct 2026) ----------
const LEAD = 'new-agreements-proposed';
const goodSuit = (e, s) => e.len[s] >= 5 && top3(e, s) >= 2 || (e.len[s] >= 4 && top3(e, s) === 3);

// Lead-directing doubles of their artificial bids (Stayman and transfers over their notrump).
for (const [nt, arts] of [['1N', ['2C', '2D', '2H']], ['2N', ['3C', '3D', '3H']]]) {
  for (const a of arts) {
    const k = [`(${nt})`, 'P', `(${a})`];
    def(k, 'X', `Lead-directing: a good ${nm(a[1])} suit, please lead it.`, { len: { [a[1]]: [4, 13] } }, LEAD);
    def(k, 'P', 'Pass.', {}, LEAD);
    advise(k, (e) => (goodSuit(e, a[1]) ? R('X', [`good ${nm(a[1])}: ask partner to lead it`]) : R('P', ['no lead to suggest: pass'])), [{ dealer: 'W', calls: [nt, 'P', a] }]);
  }
}
// Lead-directing double of their RKCB reply.
entries.push(...SUITS4.map((s) => ({
  tail: true, after: ['(4N)', 'P', `(5${s})`], call: 'X', notes: LEAD, meaning: `Lead-directing: lead ${nm(s)}.`, shows: { len: { [s]: [4, 13] } },
})));

// Defense against their strong 2♣.
export function overStrong2C(e, after2D) {
  const L = e.len;
  const lead = after2D ? 'D' : 'C';
  if (L.C >= 5 && L.D >= 5) return R('2N', ['5-5 in the minors']);
  if (goodSuit(e, lead) && L[lead] <= 6) return R('X', [`good ${nm(lead)}: lead-directing`]);
  const s = SUITS4.filter((t) => L[t] >= 6 || (L[t] === 5 && top3(e, t) >= 2)).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])[0];
  if (s && !(after2D && s === 'D')) {
    const lv = cheapest(after2D ? '2D' : '2C', s);
    return R(`${L[s] >= 7 ? lv + 1 : lv}${s}`, [`${L[s]} ${nm(s)}: preempt their big hand`]);
  }
  if (goodSuit(e, lead)) return R('X', [`good ${nm(lead)}: lead-directing`]);
  return R('P', ['pass: they have the big hand']);
}
for (const after2D of [false, true]) {
  const k = after2D ? ['(2C)', 'P', '(2D)'] : ['(2C)'];
  const last = after2D ? '2D' : '2C';
  const lead = after2D ? 'D' : 'C';
  def(k, 'X', `Lead-directing: a good ${nm(lead)} suit.`, { len: { [lead]: [4, 13] } }, LEAD);
  def(k, 'P', 'Pass.', {}, LEAD);
  def(k, '2N', 'Both minors (5-5), preemptive.', { len: { C: [5, 13], D: [5, 13] } }, LEAD);
  for (const t of SUITS4.filter((u) => !(after2D && u === 'D'))) {
    const lv = cheapest(last, t);
    def(k, `${lv}${t}`, `Natural: 5+ ${nm(t)}, preemptive.`, { len: { [t]: [5, 13] } }, LEAD);
    def(k, `${lv + 1}${t}`, `Preemptive jump: 7+ ${nm(t)}.`, { len: { [t]: [7, 13] } }, LEAD);
  }
  advise(k, (e) => overStrong2C(e, after2D), [after2D ? { dealer: 'W', calls: ['2C', 'P', '2D'] } : { dealer: 'E', calls: ['2C'] }]);
}

// Responsive doubles: they raise over partner's takeout double or overcall (through 3♠).
export function responsive(e, x, partner) {
  const h = e.hcp;
  const L = e.len;
  const raise = partner;
  const unbid = SUITS4.filter((t) => t !== x && t !== partner[1]);
  if (partner !== 'X') {
    const y = partner[1];
    if (L[y] >= 3 && dummyPoints(e, y) >= 6) return R('RAISE', [`${L[y]} ${nm(y)}: compete in partner's suit`]);
  }
  const twoSuits = partner === 'X' ? MAJORS.filter((t) => t !== x) : unbid;
  if (h >= 8 && twoSuits.length >= 2 && twoSuits.every((t) => L[t] >= 4)) return R('X', [`4+ in ${twoSuits.map(nm).join(' and ')}, ${h} HCP: responsive double`]);
  const own = unbid.filter((t) => L[t] >= 5).sort((a, b) => L[b] - L[a])[0];
  if (own && h >= 6) return R(`OWN:${own}`, [`${L[own]} ${nm(own)}: natural`]);
  if (h >= 10) return R('X', [`${h} HCP and no clear suit: responsive double`]);
  void raise;
  return R('P', [`${h} HCP: pass`]);
}
for (const x of SUITS4) {
  const partners = ['X', ...SUITS4.filter((t) => t !== x).map((y) => `${cheapest(`1${x}`, y)}${y}`)];
  for (const pc of partners) {
    for (const lv of [2, 3]) {
      const theirRaise = `${lv}${x}`;
      if (pc !== 'X' && !above(theirRaise, pc)) continue;
      const k = [`(1${x})`, pc, `(${theirRaise})`];
      const unbid = SUITS4.filter((t) => t !== x && t !== pc[1]);
      def(k, 'X', pc === 'X'
        ? `Responsive double: values (8+), both unbid ${MAJORS.includes(x) ? 'suits' : 'majors'}.`
        : `Responsive double: values (8+), the unbid suits (${unbid.map(nm).join(' and ')}).`, { hcp: [8, 37] }, LEAD);
      def(k, 'P', 'Pass.');
      const raiseCall = pc === 'X' ? null : `${cheapest(theirRaise, pc[1])}${pc[1]}`;
      if (raiseCall) def(k, raiseCall, `Raise: competing in ${nm(pc[1])}.`, { len: { [pc[1]]: [3, 13] } });
      for (const t of unbid) def(k, `${cheapest(theirRaise, t)}${t}`, `Natural: 5+ ${nm(t)}.`, { len: { [t]: [5, 13] } });
      advise(k, (e, st) => {
        const r = responsive(e, x, pc);
        const tooThin = (why) => (e.hcp >= 10 ? R('X', [`${e.hcp} HCP: show the values with a responsive double`]) : R('P', [why]));
        if (r.call === 'RAISE') {
          if (!raiseCall || Number(raiseCall[0]) > 3) return R('P', ['too high to compete']);
          if (raiseCall[0] === '3' && !raiseAtThree(e, pc[1], st.ctx.vul)) return tooThin(`${e.len[pc[1]]} ${nm(pc[1])} and ${e.hcp} HCP: too thin to raise at the 3-level`);
          return R(raiseCall, r.why);
        }
        if (r.call.startsWith('OWN:')) {
          const t = r.call.slice(4);
          const c = `${cheapest(theirRaise, t)}${t}`;
          if (c[0] === '3' && e.hcp < 8 && e.len[t] < 6) return tooThin(`${e.len[t]} ${nm(t)} and ${e.hcp} HCP: too thin for a new suit at the 3-level`);
          if (Number(c[0]) <= 3) return R(c, r.why);
          return e.hcp >= 10 ? R('X', [`${e.hcp} HCP: too strong to pass, the suit is too high to bid: responsive double`]) : R('P', ['too high']);
        }
        return r;
      }, [{ dealer: 'W', calls: [`1${x}`, pc, theirRaise] }]);
    }
  }
}

// Maximal double: we agreed a suit and they bid the suit just below ours at the 3-level.
const BELOW = { S: 'H', H: 'D', D: 'C' };
for (const [o, them] of [['H', 'D'], ['S', 'H'], ['H', 'C'], ['S', 'C'], ['S', 'D']]) {
  for (const k of [[`1${o}`, `(2${them})`, `2${o}`, `(3${them})`], [`1${o}`, `2${o}`, `(3${them})`]]) {
    const maximal = BELOW[o] === them;
    def(k, 'X', maximal ? `Maximal double: a game try in ${nm(o)} (no room for anything else).` : 'Penalty: they have no fit and we have the values.', {}, LEAD);
    def(k, `3${o}`, maximal ? 'Competitive only: not a game try.' : 'Competing (or a mild invitation).', {}, COMP);
    def(k, `4${o}`, 'Game.', {}, COMP);
    def(k, 'P', 'Pass: content to defend.', {}, COMP);
  }
}


// ---------- Second batch of proposed agreements (gaps 5–8) ----------
const NEW = 'new-agreements-proposed';

// Leaping Michaels over their weak two: 5-5, game values.
export function leapingMichaels(e, x) {
  const L = e.len;
  if (e.hcp < 11) return null;
  if (x === 'D') {
    if (L.H >= 5 && L.S >= 5) return R('4D', ['5-5 in the majors, game values: Leaping Michaels']);
    if (L.C >= 5 && (L.H >= 5 || L.S >= 5)) return R('4C', ['clubs and a major, game values: Leaping Michaels']);
    return null;
  }
  const om = x === 'H' ? 'S' : 'H';
  const m = ['C', 'D'].filter((t) => L[t] >= 5).sort((a, b) => L[b] - L[a])[0];
  return L[om] >= 5 && m ? R(`4${m}`, [`5+ ${nm(m)} and 5+ ${nm(om)}, game values: Leaping Michaels`]) : null;
}
for (const x of ['D', 'H', 'S']) {
  for (const k of [[`(2${x})`], [`(2${x})`, 'P']]) {
    if (x === 'D') {
      def(k, '4D', 'Leaping Michaels: 5-5 in the majors, game values. (Proposed.)', { hcp: [11, 37], len: { H: [5, 13], S: [5, 13] } }, NEW);
      def(k, '4C', 'Leaping Michaels: 5+ clubs and a 5+ major, game values. (Proposed.)', { hcp: [11, 37], len: { C: [5, 13] } }, NEW);
    } else {
      const om = x === 'H' ? 'S' : 'H';
      for (const m of ['C', 'D']) def(k, `4${m}`, `Leaping Michaels: 5+ ${nm(m)} and 5+ ${nm(om)}, game values. (Proposed.)`, { hcp: [11, 37], len: { [m]: [5, 13], [om]: [5, 13] } }, NEW);
    }
    advise(k, (e) => overWeakTwo(e, x, 2, k.length === 2), []); // re-attach so the new calls are pickable
  }
}

// Doubles of their 4-level preempts: over 4♣/4♦/4♥ takeout; over 4♠ values (partner usually passes); 4NT over 4♠ = two suits.
export function overFourLevel(e, x) {
  const h = e.hcp;
  const L = e.len;
  const good6 = (s) => L[s] >= 6 && top3(e, s) >= 2;
  if (x === 'S') {
    const two = ['C', 'D', 'H'].filter((s) => L[s] >= 5);
    if (two.length >= 2 && h >= 12) return R('4N', [`5-5 in ${two.slice(0, 2).map(nm).join(' and ')}: takeout for two suits`]);
    const s = ['H', 'D', 'C'].find(good6);
    if (s && h >= 13) return R(`5${s}`, [`good ${L[s]}-card ${nm(s)}`]);
    if (h >= 14) return R('X', [`${h} HCP: show the values; partner usually passes`]);
    return R('P', [`${h} HCP: pass`]);
  }
  const majors = MAJORS.filter((s) => s !== x);
  const nat = SUITS4.filter((s) => s !== x && good6(s)).sort((a, b) => RANK[b] - RANK[a])[0];
  if (nat && h >= 13) return R(`${cheapest(`4${x}`, nat)}${nat}`, [`good ${L[nat]}-card ${nm(nat)}`]);
  if ((L[x] <= 2 && majors.every((s) => L[s] >= 4) && h >= 13) || h >= 17) return R('X', [`${h} HCP, short in ${nm(x)}: takeout double`]);
  return R('P', [`${h} HCP: pass`]);
}
export function advanceFourLevelDouble(e, x) {
  const L = e.len;
  if (x === 'S') {
    const s = ['H', 'D', 'C'].find((t) => L[t] >= 6) ;
    return s && L.S <= 1 ? R(`5${s}`, [`${L[s]} ${nm(s)} and a singleton spade: pull the double`]) : R('P', ['partner showed values: defend 4♠ doubled']);
  }
  if (L[x] >= 4 && /[AKQ]/.test(e.hand[x])) return R('P', [`${L[x]} ${nm(x)}: pass for penalty`]);
  if (x !== 'H' && x !== 'S') {
    const M = MAJORS.filter((t) => L[t] >= 4).sort((a, b) => L[b] - L[a])[0];
    if (M) return R(`4${M}`, [`${L[M]} ${nm(M)}`]);
  }
  if (x === 'H' && L.S >= 4) return R('4S', [`${L.S} spades`]);
  const s = SUITS4.filter((t) => t !== x).sort((a, b) => L[b] - L[a])[0];
  return R(`${cheapest(`4${x}`, s)}${s}`, [`${L[s]} ${nm(s)}: the best suit`]);
}
for (const x of SUITS4) {
  for (const k of [[`(4${x})`], [`(4${x})`, 'P']]) {
    def(k, 'X', x === 'S' ? 'Values (14+): partner usually passes. (Proposed.)' : `Takeout: short in ${nm(x)}, 13+. (Proposed.)`, { hcp: [13, 37] }, NEW);
    def(k, 'P', 'Pass.', {}, NEW);
    if (x === 'S') def(k, '4N', 'Takeout for two suits (5-5). (Proposed.)', {}, NEW);
    for (const s of SUITS4.filter((t) => t !== x)) def(k, `${cheapest(`4${x}`, s)}${s}`, `Natural: good 6+ ${nm(s)}.`, { len: { [s]: [6, 13] } }, NEW);
    advise(k, (e) => overFourLevel(e, x), [k.length === 2 ? { dealer: 'W', calls: [`4${x}`, 'P', 'P'] } : { dealer: 'E', calls: [`4${x}`] }]);
  }
  const a = [`(4${x})`, 'X'];
  def(a, 'P', x === 'S' ? 'Defend: partner showed values.' : `Penalty pass: length and strength in ${nm(x)}.`, {}, NEW);
  for (const s of SUITS4.filter((t) => t !== x)) def(a, `${cheapest(`4${x}`, s)}${s}`, `Our best suit.`, {}, NEW);
  advise(a, (e) => advanceFourLevelDouble(e, x), [{ dealer: 'W', calls: [`4${x}`, 'X', 'P'] }]);
}

// Lightner double of their freely bid slam: asks for an unusual lead (usually to get a ruff).
export function lightner(e, x) {
  const voids = SUITS4.filter((s) => s !== x && e.len[s] === 0);
  const aces = SUITS4.filter((s) => e.hand[s].includes('A')).length;
  return voids.length && aces >= 1 ? R('X', [`void in ${nm(voids[0])} and an ace: ask for an unusual lead`]) : R('P', ['no Lightner double: pass']);
}
for (const lv of [6, 7]) {
  for (const x of SUITS4) {
    for (const after of [[`(${lv}${x})`], [`(${lv}${x})`, 'P']]) {
      for (const call of ['X', 'P']) {
        entries.push({
          tail: true, after, call, variant: `${lv}${x}`, notes: NEW, shows: {}, priority: 10,
          meaning: call === 'X' ? 'Lightner double: do not lead our suit; make an unusual lead (often dummy\'s first suit). (Proposed.)' : 'Pass.',
          when: (key) => key.some((t) => t.startsWith('(')) && !key.some((t) => !t.startsWith('(') && /^[67]/.test(t)),
          pick: (e) => lightner(e, x).call === call,
          why: (e) => lightner(e, x).why,
        });
      }
    }
  }
}

// ---------- Third batch of proposed agreements (gaps 9–13) ----------
const lvOf = (c) => Number(c[0]);
const stops = (e, suits) => suits.every((y) => stopper(e, y));
const hcpIn = (e, s) => e.hcpBy?.[s] ?? 0;

// Gap 9. Opener after 1M–1NT (forcing) and their overcall: the 1NT is no longer forcing.
export function openerAfter1NTOvercall(e, M, ov) {
  const y = ov[1];
  const h = e.hcp;
  const L = e.len;
  const mLv = cheapest(ov, M);
  const side = SUITS4.filter((s) => s !== M && s !== y && L[s] >= 5 && !(M === 'H' && s === 'S'));
  if (h >= 18 && e.balanced && stopper(e, y)) return R(h >= 20 ? '3N' : '2N', [`${h} HCP balanced with a ${nm(y)} stopper`, h >= 20 ? 'game' : 'invite game']);
  if (L[M] >= 6) {
    if (h >= 16 && mLv === 2) return R(`3${M}`, [`${L[M]} ${nm(M)}, ${h} HCP: jump to invite`]);
    if (mLv === 2) return R(`2${M}`, [`${L[M]} ${nm(M)}: rebid the 6-card suit`]);
    if (L[M] >= 7 || h >= 14) return R(`3${M}`, [`${L[M]} ${nm(M)}, ${h} HCP: compete at the 3-level`]);
  }
  if ((L[y] <= 1 && h >= 13) || (L[y] <= 2 && h >= 16)) return R('X', [`${L[y]} ${nm(y)}, ${h} HCP`, 'takeout double: extra values and short in their suit']);
  const two = side.filter((s) => cheapest(ov, s) === 2);
  if (two.length && h >= 11) return R(`2${longestOf(e, two)}`, [`${L[longestOf(e, two)]} ${nm(longestOf(e, two))}: natural, not forcing`]);
  const three = side.filter((s) => cheapest(ov, s) === 3);
  if (three.length && (h >= 15 || (L[M] >= 5 && h >= 13))) return R(`3${longestOf(e, three)}`, [`5-5, ${h} HCP: show the second suit`]);
  if (h >= 18) return R('X', [`${h} HCP: too strong to pass`]);
  return R('P', [`${h} HCP, no sixth ${nm(M).slice(0, -1)}, no shortness in ${nm(y)}`, 'their bid ended the forcing 1NT: pass, partner can still act']);
}

// Gap 10. Opener's reopening after 1o–(overcall)–P–(P): double when short in their suit.
export function reopen(e, o, ov) {
  const y = ov[1];
  const lv = lvOf(ov);
  const h = e.hcp;
  const L = e.len;
  const nt = `${lv}N`;
  const ol = cheapest(ov, o);
  if (h >= 18 && e.balanced && stopper(e, y) && h <= 19) return R(nt, [`${h} HCP balanced with a ${nm(y)} stopper`]);
  if (L[y] <= 1 || (L[y] === 2 && L[o] < 6) || (h >= 19 && L[y] <= 3)) return R('X', [`${L[y]} ${nm(y)}: reopen with a double`, 'partner may be waiting to pass it for penalty']);
  if (L[o] >= 6 && ol <= 3) return R(h >= 16 && ol + 1 <= 3 ? `${ol + 1}${o}` : `${ol}${o}`, [`${L[o]} ${nm(o)}`, h >= 16 && ol + 1 <= 3 ? `${h} HCP: jump` : 'rebid the long suit']);
  const two = SUITS4.filter((s) => s !== o && s !== y && L[s] >= 5 && cheapest(ov, s) <= 2 && (RANK[s] < RANK[o] || h >= 16));
  if (two.length) return R(`${cheapest(ov, two[0])}${two[0]}`, [`5-5 (or 6-5): show the second suit`]);
  return R('P', [`${L[y]} ${nm(y)}: no reason to reopen`]);
}

// Responder after opener's takeout double (gaps 9 and 10): pass for penalty with their suit, else bid.
export function answerOpenersDouble(e, o, ov, after1NT) {
  const y = ov[1];
  const h = e.hcp;
  const L = e.len;
  if (L[y] >= 5 || (L[y] >= 4 && hcpIn(e, y) >= 4)) return R('P', [`${L[y]} ${nm(y)}: pass for penalty`]);
  const ntLv = cheapest(ov, 'N');
  const five = SUITS4.some((s) => s !== y && s !== o && L[s] >= 5);
  if (stopper(e, y) && L[o] <= 2 && !five) {
    if (h >= (after1NT ? 10 : 11) && ntLv <= 3) return R('3N', [`${h} HCP with a ${nm(y)} stopper: game`]);
    if (ntLv <= 2 && h >= (after1NT ? 8 : 6)) return R(`${ntLv}N`, [`a ${nm(y)} stopper: natural`]);
  }
  const need = after1NT ? 2 : 3;
  const others = SUITS4.filter((s) => s !== y && s !== o && L[s] >= 4).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a]);
  const pick = L[o] >= need + 1 || (L[o] >= need && !(others[0] && L[others[0]] >= 5)) ? o : others[0] ?? longestOf(e, SUITS4.filter((s) => s !== y));
  const c = cheapest(ov, pick);
  if (h >= 10 && c + 1 <= (isMajor(pick) ? 4 : 3)) return R(`${c + 1}${pick}`, [`${L[pick]} ${nm(pick)}, ${h} HCP: jump`]);
  return R(`${c}${pick}`, [`${L[pick]} ${nm(pick)}`, 'answer the double: bid your best suit']);
}

// Gap 11 (and opener's natural bids in the support-double situations): support first, then natural.
export function openerFreeRebid(e, o, r, theirs, last) {
  const L = e.len;
  const h = e.hcp;
  if (L[r] === 3) return R(last === 'X' ? 'XX' : 'X', [`exactly 3 ${nm(r)}`, `support ${last === 'X' ? 'redouble' : 'double'}`]);
  const ref = last === 'X' ? `1${r}` : last;
  if (L[r] >= 4) {
    const c = cheapest(ref, r);
    if (h >= 16 && c + 1 <= 3) return R(`${c + 1}${r}`, [`${L[r]} ${nm(r)}, ${h} HCP: jump raise`]);
    return R(`${c}${r}`, [`${L[r]} ${nm(r)}: raise`]);
  }
  const nt = cheapest(ref, 'N');
  if (h >= 18 && h <= 19 && e.balanced && stops(e, theirs) && nt <= 2) return R('2N', [`${h} HCP balanced, stoppers: invitational`]);
  if (h >= 18 && e.balanced && stops(e, theirs)) return R('3N', [`${h} HCP balanced, stoppers`]);
  const ol = cheapest(ref, o);
  if (L[o] >= 6 && ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}`, `no ${nm(r)} support`]);
  const seconds = SUITS4.filter((s) => s !== o && s !== r && !theirs.includes(s) && L[s] >= 4 && cheapest(ref, s) <= 2 && (cheapest(ref, s) === 1 || RANK[s] < RANK[o] || h >= 16));
  if (seconds.length) return R(`${cheapest(ref, seconds[0])}${seconds[0]}`, [`${L[seconds[0]]} ${nm(seconds[0])}: natural`, `no ${nm(r)} support`]);
  const five = SUITS4.filter((s) => s !== o && s !== r && !theirs.includes(s) && L[s] >= 5 && L[o] >= 5 && cheapest(ref, s) === 3);
  if (five.length && h >= 12) return R(`3${five[0]}`, [`5-5, ${h} HCP: show the second suit`, `no ${nm(r)} support`]);
  if (nt === 1 && h <= 14 && e.balanced && stops(e, theirs)) return R('1N', [`${h} HCP balanced with a stopper`]);
  if (h >= 18) {
    const cue = theirs.map((s) => `${cheapest(ref, s)}${s}`).find((c) => lvOf(c) <= 3);
    if (cue) return R(cue, [`${h} HCP, no clear bid: cue-bid their suit (forcing)`]);
  }
  return R('P', [`no ${nm(r)} support: pass for now`]);
}

// Gap 12. Advancer after partner's overcall and their response (new suit, 1NT or a negative double).
export function advanceAfterResponse(e, x, ov, rb, vul = 'none') {
  const y = ov[1];
  const h = e.hcp;
  const L = e.len;
  const last = rb === 'X' ? ov : rb;
  const theirs = rb === 'X' || rb[1] === 'N' ? [x] : [x, rb[1]];
  if (L[y] >= 3) {
    const dp = dummyPoints(e, y);
    const c = cheapest(last, y);
    const cue = cheapest(last, x);
    if (dp >= 10 && cue <= 3) return R(`${cue}${x}`, [`${L[y]} ${nm(y)}, ${dp} points: cue-bid raise`]);
    if (h <= 7 && (L[y] >= 5 || (L[y] >= 4 && shortness(e, y))) && c + 1 <= 4) return R(`${c + 1}${y}`, [`${L[y]} ${nm(y)}, weak: preemptive jump raise`]);
    // A 2-level raise is cheap; a 3-level raise needs real values.
    const weVul = vul === 'we' || vul === 'both';
    const ok = c <= 2 ? dp >= 6 || (L[y] >= 4 && dp >= 4) : c === 3 && raiseAtThree(e, y, vul);
    if (ok) return R(`${c}${y}`, [`${L[y]} ${nm(y)}, ${dp} points: raise${c === 3 ? ' to the 3-level' : ''}`]);
    if (c === 3) return R('P', [`${L[y]} ${nm(y)} but only ${h} HCP${weVul ? ', vulnerable' : ''}: too thin to raise at the 3-level`, 'their new suit is forcing: you can compete next round']);
  }
  const nt = cheapest(last, 'N');
  if (rb === 'X' && h >= 11 && !(e.balanced && stops(e, theirs) && nt === 1 && h <= 11)) return R('XX', [`${h} HCP: redouble shows the values`]);
  if (stops(e, theirs) && h >= 8) {
    if (nt === 1 && h <= 11) return R('1N', [`${h} HCP with stoppers`]);
    if (nt <= 2 && h >= 11 && h <= 12) return R('2N', [`${h} HCP with stoppers: invitational`]);
    if (h >= 13) return R('3N', [`${h} HCP with stoppers`]);
  }
  const own = SUITS4.filter((s) => !theirs.includes(s) && s !== y && L[s] >= 5 && cheapest(last, s) <= (h >= 10 ? 3 : 2));
  if (own.length && h >= 8) return R(`${cheapest(last, longestOf(e, own))}${longestOf(e, own)}`, [`${L[longestOf(e, own)]} ${nm(longestOf(e, own))}: natural, not forcing`]);
  return R('P', [`${h} HCP: pass`]);
}

// All four live in the proposed section (#opener-after-1m-1nt-and-their-overcall, #opener-reopening-double,
// #support-doubles-after-their-overcall, #advancing-after-their-response).
const OPEN_AFTER = NEW;
const REOPEN = NEW;
const SUPPORT_LATE = NEW;
const ADVANCE_LATE = NEW;

const answerDefs = (k, o, ov, notes) => {
  const y = ov[1];
  def(k, 'P', `Penalty pass: length in ${nm(y)}.`, { len: { [y]: [4, 13] } }, notes);
  for (const s of SUITS4.filter((t) => t !== y)) {
    const c = cheapest(ov, s);
    def(k, `${c}${s}`, s === o ? `Preference: support for opener's ${nm(o)}.` : `Natural: 4+ ${nm(s)}, answering the double.`, { len: { [s]: [s === o ? 2 : 4, 13] } }, notes);
    if (c + 1 <= 4) def(k, `${c + 1}${s}`, `Jump: ${s === o ? 'support' : `4+ ${nm(s)}`} and 10+ HCP.`, { hcp: [10, 37] }, notes);
  }
  const nt = cheapest(ov, 'N');
  if (nt <= 2) def(k, `${nt}N`, `Natural, a ${nm(y)} stopper, no fit and no 5-card suit.`, {}, notes);
  def(k, '3N', `To play: 10+ with a ${nm(y)} stopper.`, { hcp: [10, 37] }, notes);
};

for (const M of MAJORS) {
  for (const y of SUITS4.filter((t) => t !== M)) {
    const ov = `2${y}`;
    const k = [`1${M}`, '1N', `(${ov})`];
    const mLv = cheapest(ov, M);
    def(k, 'P', 'Minimum, nothing more to show: their bid ended the forcing 1NT. (Proposed.)', {}, OPEN_AFTER);
    def(k, `${mLv}${M}`, mLv === 2 ? `6+ ${nm(M)}, minimum.` : `6+ ${nm(M)} (7+, or extra values): competing at the 3-level.`, { len: { [M]: [6, 13] } }, OPEN_AFTER);
    if (mLv === 2) def(k, `3${M}`, `6+ ${nm(M)}, 16–18: invitational.`, { hcp: [16, 18], len: { [M]: [6, 13] } }, OPEN_AFTER);
    def(k, 'X', `Takeout: short in ${nm(y)} with extra values (13+ with a singleton, 16+ with a doubleton), or 18+. Partner passes with ${nm(y)} length.`, { hcp: [13, 37] }, OPEN_AFTER);
    for (const s of SUITS4.filter((t) => t !== M && t !== y && !(M === 'H' && t === 'S'))) {
      const c = cheapest(ov, s);
      def(k, `${c}${s}`, c === 2 ? `Natural: 5+ ${nm(s)}, not forcing.` : `Natural: 5+ ${nm(s)}, 5-5 or 15+, not forcing.`, { len: { [s]: [5, 13] } }, OPEN_AFTER);
    }
    def(k, '2N', `18–19 balanced with a ${nm(y)} stopper: invitational.`, { hcp: [18, 19], balanced: true }, OPEN_AFTER);
    def(k, '3N', `20–21 balanced with a ${nm(y)} stopper.`, { hcp: [20, 21], balanced: true }, OPEN_AFTER);
    advise(k, (e) => openerAfter1NTOvercall(e, M, ov), [{ dealer: 'S', calls: [`1${M}`, 'P', '1N', ov] }]);
    const a = [...k, 'X'];
    answerDefs(a, M, ov, OPEN_AFTER);
    advise(a, (e) => answerOpenersDouble(e, M, ov, true), [{ dealer: 'N', calls: [`1${M}`, 'P', '1N', ov, 'X', 'P'] }]);
  }
}

for (const o of SUITS4) {
  for (const y of SUITS4.filter((t) => t !== o)) {
    for (let lv = cheapest(`1${o}`, y); lv <= 2; lv++) {
      const ov = `${lv}${y}`;
      const k = [`1${o}`, `(${ov})`, 'P'];
      const ol = cheapest(ov, o);
      def(k, 'P', `Pass: length in ${nm(y)}, or nothing to add.`, {}, REOPEN);
      def(k, 'X', `Reopening double: short in ${nm(y)} (usually 0–2). Partner passes with ${nm(y)} length, or bids.`, {}, REOPEN);
      def(k, `${ol}${o}`, `6+ ${nm(o)}.`, { len: { [o]: [6, 13] } }, REOPEN);
      if (ol + 1 <= 3) def(k, `${ol + 1}${o}`, `6+ ${nm(o)}, 16–18.`, { hcp: [16, 18], len: { [o]: [6, 13] } }, REOPEN);
      for (const s of SUITS4.filter((t) => t !== o && t !== y && cheapest(ov, t) <= 2)) def(k, `${cheapest(ov, s)}${s}`, `Natural: 5+ ${nm(s)}, a two-suiter.`, { len: { [s]: [5, 13] } }, REOPEN);
      def(k, `${lv}N`, `18–19 balanced with a ${nm(y)} stopper.`, { hcp: [18, 19], balanced: true }, REOPEN);
      advise(k, (e) => reopen(e, o, ov), [{ dealer: 'S', calls: [`1${o}`, ov, 'P', 'P'] }]);
      const a = [...k, 'X'];
      answerDefs(a, o, ov, REOPEN);
      advise(a, (e) => answerOpenersDouble(e, o, ov, false), [{ dealer: 'N', calls: [`1${o}`, ov, 'P', 'P', 'X', 'P'] }]);
    }
  }
}

// Opener's natural bids next to the support doubles: after 1o–(P)–1r–(ov), and after 1o–(1y)–1r–(any bid through 2r).
const freeDefs = (k, o, r, theirs, last, notes) => {
  const ref = last === 'X' ? `1${r}` : last;
  def(k, last === 'X' ? 'XX' : 'X', `Support ${last === 'X' ? 'redouble' : 'double'}: exactly 3 ${nm(r)}.`, { len: { [r]: [3, 3] } }, notes);
  const c = cheapest(ref, r);
  def(k, `${c}${r}`, `4+ ${nm(r)}: raise.`, { len: { [r]: [4, 13] } }, notes);
  if (c + 1 <= 3) def(k, `${c + 1}${r}`, `4+ ${nm(r)}, 16–18: jump raise.`, { hcp: [16, 18], len: { [r]: [4, 13] } }, notes);
  const ol = cheapest(ref, o);
  if (ol <= 3) def(k, `${ol}${o}`, `6+ ${nm(o)}, no ${nm(r)} support.`, { len: { [o]: [6, 13] } }, notes);
  for (const s of SUITS4.filter((t) => t !== o && t !== r && !theirs.includes(t) && cheapest(ref, t) <= 3)) {
    const lv = cheapest(ref, s);
    def(k, `${lv}${s}`, lv <= 2 ? `Natural: 4+ ${nm(s)}, no ${nm(r)} support.` : `Natural: 5-5, no ${nm(r)} support.`, { len: { [s]: [lv <= 2 ? 4 : 5, 13] } }, notes);
  }
  const nt = cheapest(ref, 'N');
  if (nt === 1) def(k, '1N', `12–14 balanced with a stopper, no ${nm(r)} support.`, { hcp: [12, 14], balanced: true }, notes);
  if (nt <= 2) def(k, '2N', `18–19 balanced with stoppers, no ${nm(r)} support.`, { hcp: [18, 19], balanced: true }, notes);
  def(k, '3N', `18+ balanced with stoppers, no ${nm(r)} support.`, { hcp: [18, 21], balanced: true }, notes);
  for (const t of theirs) {
    const cue = `${cheapest(ref, t)}${t}`;
    if (lvOf(cue) <= 3) def(k, cue, `Cue-bid: 18+, no clear bid, forcing.`, { hcp: [18, 37], force: 'round' }, notes);
  }
  def(k, 'P', `No ${nm(r)} support: pass for now.`, {}, notes);
};
for (const [o, r] of [['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  // 1o–(P)–1r–(ov): extend the existing support-double situations with opener's natural bids.
  const overs = ['X'];
  for (const s of SUITS4.filter((t) => t !== r)) {
    const lv = cheapest(`1${r}`, s);
    if (!above(`${lv}${s}`, `2${r}`)) overs.push(`${lv}${s}`);
  }
  for (const ov of overs) {
    const k = [`1${o}`, `1${r}`, `(${ov})`];
    const theirs = ov === 'X' ? [] : [ov[1]];
    freeDefs(k, o, r, theirs, ov, SUPPORT);
    advise(k, (e) => openerFreeRebid(e, o, r, theirs, ov), [{ dealer: 'S', calls: [`1${o}`, 'P', `1${r}`, ov] }]);
  }
  // 1o–(1y)–1r–(their bid through 2r): support doubles stay on.
  for (const y of SUITS4.filter((t) => t !== o && t !== r && RANK[t] < RANK[r] && cheapest(`1${o}`, t) === 1)) {
    const lasts = ['X', '1N'];
    for (const s of SUITS4.filter((t) => t !== r)) {
      const lv = cheapest(`1${r}`, s);
      if (!above(`${lv}${s}`, `2${r}`)) lasts.push(`${lv}${s}`);
    }
    for (const last of lasts) {
      const k = [`1${o}`, `(1${y})`, `1${r}`, `(${last})`];
      const theirs = [...new Set([y, ...(last === 'X' || last === '1N' ? [] : [last[1]])])];
      freeDefs(k, o, r, theirs, last, SUPPORT_LATE);
      advise(k, (e) => openerFreeRebid(e, o, r, theirs, last), [{ dealer: 'S', calls: [`1${o}`, `1${y}`, `1${r}`, last] }]);
    }
  }
}

for (const x of SUITS4) {
  for (const y of SUITS4.filter((t) => t !== x)) {
    const ov = `${cheapest(`1${x}`, y)}${y}`;
    const responses = ['X'];
    if (ov[0] === '1') responses.push('1N');
    for (const t of SUITS4.filter((u) => u !== x && u !== y)) {
      const lv = cheapest(ov, t);
      if (lv <= 2) responses.push(`${lv}${t}`);
    }
    for (const rb of responses) {
      const k = [`(1${x})`, ov, `(${rb})`];
      const last = rb === 'X' ? ov : rb;
      const theirs = rb === 'X' || rb[1] === 'N' ? [x] : [x, rb[1]];
      const c = cheapest(last, y);
      def(k, 'P', 'Pass: no fit and nothing to add.', {}, ADVANCE_LATE);
      if (c <= 3) def(k, `${c}${y}`, c <= 2 ? `Raise: 3+ ${nm(y)}, 6–9 (4+ ${nm(y)} on less).` : `Raise to the 3-level: 4+ ${nm(y)} and 6–9, or 3 ${nm(y)} and 8–9 (9 vulnerable).`, { hcp: [4, 9], len: { [y]: [3, 13] }, pts: y }, ADVANCE_LATE);
      if (c + 1 <= 4) def(k, `${c + 1}${y}`, `Preemptive jump raise: 4+ ${nm(y)}, weak.`, { hcp: [0, 7], len: { [y]: [4, 13] } }, ADVANCE_LATE);
      const cue = cheapest(last, x);
      if (cue <= 3) def(k, `${cue}${x}`, `Cue-bid: 10+ points counting shortness, with 3+ ${nm(y)} (limit raise or better).`, { hcp: [10, 37], len: { [y]: [3, 13] }, force: 'round', pts: y }, ADVANCE_LATE);
      if (rb === 'X') def(k, 'XX', '11+ HCP, usually no fit for partner. From here our doubles are for penalty.', { hcp: [11, 37] }, ADVANCE_LATE);
      const nt = cheapest(last, 'N');
      if (nt === 1) def(k, '1N', `8–11 with stoppers in ${theirs.map(nm).join(' and ')}.`, { hcp: [8, 11] }, ADVANCE_LATE);
      if (nt <= 2) def(k, '2N', `11–12 with stoppers in ${theirs.map(nm).join(' and ')}.`, { hcp: [11, 12] }, ADVANCE_LATE);
      def(k, '3N', `13+ with stoppers in ${theirs.map(nm).join(' and ')}.`, { hcp: [13, 37] }, ADVANCE_LATE);
      for (const s of SUITS4.filter((t) => !theirs.includes(t) && t !== y && cheapest(last, t) <= 3)) def(k, `${cheapest(last, s)}${s}`, `Natural: 5+ ${nm(s)}, not forcing.`, { len: { [s]: [5, 13] } }, ADVANCE_LATE);
      advise(k, (e, st) => advanceAfterResponse(e, x, ov, rb, st.ctx.vul), [{ dealer: 'E', calls: [`1${x}`, ov, rb] }]);
    }
  }
}

// Opener after partner's negative double when they raise their suit: show the major, double with extras.
export function afterNegXRaise(e, o, ov, rz) {
  const y = ov[1];
  const h = e.hcp;
  const L = e.len;
  const us = MAJORS.filter((s) => s !== o && s !== y && L[s] >= 4);
  if (us.length) {
    const u = longestOf(e, us);
    const c = cheapest(rz, u);
    if (h >= 16 && c <= 4) return R(`4${u}`, [`${L[u]} ${nm(u)}, ${h} HCP: game in the major partner showed`]);
    if (c <= 3) return R(`${c}${u}`, [`${L[u]} ${nm(u)}: the major partner showed`]);
  }
  if (h >= 17 && stopper(e, y) && L[y] <= 3) return R('3N', [`${h} HCP with a ${nm(y)} stopper: game`]);
  if (h >= 17) return R('X', [`${h} HCP: cooperative double, partner passes or bids`]);
  const ol = cheapest(rz, o);
  if (L[o] >= 6 && ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}: compete`]);
  return R('P', [`${h} HCP: nothing more to say`]);
}
for (const o of SUITS4) {
  for (const y of SUITS4.filter((t) => t !== o)) {
    for (let lv = cheapest(`1${o}`, y); lv <= 2; lv++) {
      const ov = `${lv}${y}`;
      for (let rl = lv + 1; rl <= 3; rl++) {
        const rz = `${rl}${y}`;
        const k = [`1${o}`, `(${ov})`, 'X', `(${rz})`];
        def(k, 'P', 'Minimum: nothing more to say.', {}, NEW);
        def(k, 'X', 'Cooperative double: extra values (17+). Partner passes with their suit, or bids.', { hcp: [17, 37] }, NEW);
        def(k, '3N', `To play: 17+ with a ${nm(y)} stopper.`, { hcp: [17, 37] }, NEW);
        for (const u of MAJORS.filter((t) => t !== o && t !== y)) {
          const c = cheapest(rz, u);
          if (c <= 3) def(k, `${c}${u}`, `4 ${nm(u)}: the major partner showed.`, { len: { [u]: [4, 13] } }, NEW);
          if (c <= 4) def(k, `4${u}`, `4 ${nm(u)}, 16+: game.`, { hcp: [16, 37], len: { [u]: [4, 13] } }, NEW);
        }
        const ol = cheapest(rz, o);
        if (ol <= 3) def(k, `${ol}${o}`, `6+ ${nm(o)}: competing.`, { len: { [o]: [6, 13] } }, NEW);
        advise(k, (e) => afterNegXRaise(e, o, ov, rz), [{ dealer: 'S', calls: [`1${o}`, ov, 'X', rz] }]);
      }
    }
  }
}

// ---------- Advancing a balancing double ----------
const BAL = 'competitive-bidding-tier-0'; // section #takeout-doubles

// Advancing partner's balancing double: (1x)–P–(P)–X–(P). Partner may be light, and we passed once:
// we must bid (pass only to defend with long, strong trumps), and need a little more to jump.
export function advanceBalancingDouble(e, x, lv) {
  const h = e.hcp;
  const L = e.len;
  const their = `${lv}${x}`;
  if ((L[x] >= 5 && top3(e, x) >= 2) || (L[x] >= 4 && top3(e, x) >= 2 && h >= 10)) return R('P', [`${L[x]} ${nm(x)} with two top honors: pass to defend`]);
  const cue = `${lv + 1}${x}`;
  if (h >= 13) return R(cue, [`${h} HCP: cue-bid, game interest`]);
  const majors = MAJORS.filter((s) => s !== x && L[s] >= 4);
  const best = majors.length ? longestOf(e, majors) : null;
  const nt = cheapest(their, 'N');
  if (!best && stopper(e, x) && h >= 10) return R(h >= 12 && nt + 1 <= 3 ? `${nt + 1}N` : `${nt}N`, [`${h} HCP with a ${nm(x)} stopper`]);
  const s = best ?? longestOf(e, SUITS4.filter((t) => t !== x));
  const sl = cheapest(their, s);
  if (h >= 11 && sl + 1 <= 3) return R(`${sl + 1}${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: jump`]);
  return R(`${sl}${s}`, [`${L[s]} ${nm(s)}`, `${h} HCP: bid your best suit (passing would defend their contract doubled)`]);
}
for (const x of SUITS4) {
  for (const lv of x === 'C' ? [1] : [1, 2]) {
    const their = `${lv}${x}`;
    const k = [`(${their})`, 'P', 'X'];
    def(k, 'P', `Penalty pass: long, strong ${nm(x)}.`, { len: { [x]: [4, 13] } }, BAL);
    def(k, `${lv + 1}${x}`, 'Cue-bid: 13+, game interest.', { hcp: [13, 37], force: 'round' }, BAL);
    for (const t of SUITS4.filter((u) => u !== x)) {
      const sl = cheapest(their, t);
      def(k, `${sl}${t}`, `Best suit (usually 4+ ${nm(t)}), 0–10.`, { hcp: [0, 10], len: { [t]: [isMajor(t) ? 4 : 3, 13] } }, BAL);
      if (sl + 1 <= 3) def(k, `${sl + 1}${t}`, `Jump: 4+ ${nm(t)}, 11–12.`, { hcp: [11, 12], len: { [t]: [4, 13] } }, BAL);
    }
    const nt = cheapest(their, 'N');
    def(k, `${nt}N`, `${nt === 1 ? '10–11' : '10–12'} with a ${nm(x)} stopper.`, { hcp: [10, 12] }, BAL);
    if (nt + 1 <= 3) def(k, `${nt + 1}N`, `12 with a ${nm(x)} stopper: invitational.`, { hcp: [12, 12] }, BAL);
    advise(k, (e) => advanceBalancingDouble(e, x, lv), [{ dealer: 'W', calls: [their, 'P', 'P', 'X', 'P'] }]);
  }
}


// Opener after partner's pass and their (balancing) double: 1o–P–P–(X). Partner is weak, so no game:
// show shape to compete, or pass and let them find their suit.
export function openerAfterPassAndDouble(e, o) {
  const h = e.hcp;
  const L = e.len;
  const ol = cheapest(`1${o}`, o);
  if (L[o] >= 6 && h >= 11) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}: rebid the long suit`, 'competing, not extra strength']);
  const seconds = SUITS4.filter((s) => s !== o && L[s] >= 4 && L[o] >= 5)
    .map((s) => ({ s, lv: cheapest(`1${o}`, s) }))
    .filter(({ s, lv }) => lv === 1 || RANK[s] < RANK[o] || h >= 16)
    .sort((a, b) => L[b.s] - L[a.s] || a.lv - b.lv);
  if (seconds.length && h >= 13) {
    const { s, lv } = seconds[0];
    return R(`${lv}${s}`, [`${L[o]}-${L[s]} in ${nm(o)} and ${nm(s)}, ${h} HCP`, 'show the second suit: competing, partner chooses']);
  }
  return R('P', [`${h} HCP and partner passed`, 'nothing more to show: pass and compete later if needed']);
}
for (const o of SUITS4) {
  const k = [`1${o}`, 'P', '(X)'];
  const ol = cheapest(`1${o}`, o);
  def(k, 'P', 'Pass: nothing more to show (partner is weak; compete later if needed).', {}, REOPEN);
  def(k, `${ol}${o}`, `6+ ${nm(o)}, competing. Not extra strength.`, { len: { [o]: [6, 13] } }, REOPEN);
  for (const s of SUITS4.filter((t) => t !== o)) {
    const lv = cheapest(`1${o}`, s);
    def(k, `${lv}${s}`, lv === 1 || RANK[s] < RANK[o]
      ? `Natural: 4+ ${nm(s)} (5-4 or longer), competing. Not forcing.`
      : `Reverse: 4+ ${nm(s)}, ${nm(o)} longer, 16+.`, { len: { [s]: [4, 13], [o]: [5, 13] }, ...(lv === 1 || RANK[s] < RANK[o] ? {} : { hcp: [16, 37] }) }, REOPEN);
  }
  def(k, 'XX', 'Redouble: a strong hand (18+), suggesting we can penalize them.', { hcp: [18, 37] }, REOPEN);
  advise(k, (e) => openerAfterPassAndDouble(e, o), [{ dealer: 'S', calls: [`1${o}`, 'P', 'P', 'X'] }]);
}

// ---------- Opener's answers after Lebensohl (our 1NT, their natural 2-level overcall) ----------
// Responder's Stayman cue (direct = no stopper, slow = with a stopper), invitational 3M, and game-forcing 3-level suits.
export function openerAfterStayman(e, y, slow) {
  const h = e.hcp;
  const L = e.len;
  const cue = `3${y}`;
  const asked = MAJORS.filter((m) => m !== y && L[m] >= 4);
  if (asked.length) {
    const m = asked.includes('H') ? 'H' : 'S';
    return R(`${cheapest(cue, m)}${m}`, [`${L[m]} ${nm(m)}: answer Stayman`, asked.length === 2 ? 'both majors: hearts first' : `${h} HCP`]);
  }
  if (slow || stopper(e, y)) return R('3N', [`no 4-card major${slow ? '' : `, and a ${nm(y)} stopper`}`, slow ? 'responder has the stopper: 3NT' : 'game in notrump']);
  const minor = ['C', 'D'].filter((t) => t !== y).sort((a, b) => L[b] - L[a])[0];
  return R(`${cheapest(cue, minor)}${minor}`, ['no major and no stopper: show your longest minor', `${h} HCP`]);
}

export function openerAfterInvite(e, y, m) {
  const h = e.hcp;
  const L = e.len;
  if (h >= 17 || (h >= 16 && L[m] >= 3)) return R(`4${m}`, [`${h} HCP${L[m] >= 3 ? ` and ${L[m]} ${nm(m)}` : ''}: accept the invitation`]);
  return R('P', [`${h} HCP${L[m] >= 3 ? '' : ` and only ${L[m]} ${nm(m)}`}: a minimum, decline the invitation`]);
}

export function openerAfterGameForce(e, y, x) {
  const h = e.hcp;
  const L = e.len;
  if (isMajor(x)) {
    if (L[x] >= 3) return R(`4${x}`, [`${L[x]}-card ${nm(x)} support: game in the major`]);
    if (stopper(e, y)) return R('3N', [`only ${L[x]} ${nm(x)}, but a ${nm(y)} stopper: 3NT`]);
    return R(`4${x}`, [`no ${nm(y)} stopper: game in partner's 5-card ${nm(x)}`]);
  }
  if (stopper(e, y)) return R('3N', [`a ${nm(y)} stopper: 3NT`]);
  return R(`4${x}`, [`no ${nm(y)} stopper: raise the minor`, `${h} HCP`]);
}

for (const y of SUITS4) {
  const majorsAsked = MAJORS.filter((m) => m !== y);
  const reply = (k, slow, sample) => {
    const cue = `3${y}`;
    for (const m of majorsAsked) def(k, `${cheapest(cue, m)}${m}`, `4+ ${nm(m)}: answers Stayman.`, { len: { [m]: [4, 13] } }, LEB);
    def(k, '3N', slow ? 'No 4-card major: 3NT (responder has the stopper).' : 'No 4-card major, a stopper in their suit: 3NT.', {}, LEB);
    if (!slow) for (const t of ['C', 'D'].filter((u) => u !== y)) def(k, `${cheapest(cue, t)}${t}`, `No major, no ${nm(y)} stopper: my longest minor.`, {}, LEB);
    advise(k, (e) => openerAfterStayman(e, y, slow), [sample]);
  };
  reply(['1N', `(2${y})`, `3${y}`], false, { dealer: 'N', calls: ['1N', `2${y}`, `3${y}`, 'P'] });
  if (y !== 'C') reply(['1N', `(2${y})`, '2N', '3C', `3${y}`], true, { dealer: 'N', calls: ['1N', `2${y}`, '2N', 'P', '3C', 'P', `3${y}`, 'P'] });
  // Invitational 3M after the relay: accept or decline.
  for (const m of majorsAsked) {
    const k = ['1N', `(2${y})`, '2N', '3C', `3${m}`];
    if (y === 'C') continue;
    def(k, `4${m}`, `Accepts: 16–17 with 3+ ${nm(m)} (or 17).`, { hcp: [16, 17] }, LEB);
    def(k, 'P', 'Declines: a minimum.', { hcp: [15, 15] }, LEB);
    advise(k, (e) => openerAfterInvite(e, y, m), [{ dealer: 'N', calls: ['1N', `2${y}`, '2N', 'P', '3C', 'P', `3${m}`, 'P'] }]);
  }
  // Game-forcing direct 3-level suit (not their suit): choose the game.
  for (const x of SUITS4.filter((t) => t !== y)) {
    const k = ['1N', `(2${y})`, `3${x}`];
    if (isMajor(x)) def(k, `4${x}`, `Game in ${nm(x)}: support (3+), or no stopper in ${nm(y)}.`, {}, LEB);
    else def(k, `4${x}`, `No ${nm(y)} stopper: raise the minor.`, {}, LEB);
    def(k, '3N', `A stopper in ${nm(y)}: 3NT.`, {}, LEB);
    advise(k, (e) => openerAfterGameForce(e, y, x), [{ dealer: 'N', calls: ['1N', `2${y}`, `3${x}`, 'P'] }]);
  }
}

export { SAMPLES };
