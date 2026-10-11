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
    if (dp >= 13 && isMajor(o) && lv >= 3 && r <= 4) return R(`${r}${o}`, [...why, 'game values: bid game directly']);
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
  if (h >= min) return R('X', [`${h} HCP and no good bid: the negative double keeps the auction open`]);
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
  if (L[o] >= 6 && ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}`]);
  const other = SUITS4.filter((s) => s !== o && s !== y && !isMajor(s) && L[s] >= 4 && cheapest(ov, s) <= 3);
  if (other.length) return R(`${cheapest(ov, other[0])}${other[0]}`, [`${L[other[0]]} ${nm(other[0])}`]);
  if (ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}: nothing better`]);
  return R('P', [`${h} HCP: nothing to add`]);
}

// ---------- Opener after 1o–1r and their interference (support doubles) ----------
export function supportDecision(e, o, r, ov) {
  const L = e.len;
  if (L[r] === 3) return R(ov === 'X' ? 'XX' : 'X', [`exactly 3 ${nm(r)}`, `support ${ov === 'X' ? 'redouble' : 'double'}`]);
  if (L[r] >= 4) return R(`2${r}`, [`${L[r]} ${nm(r)}: raise`]);
  const ol = cheapest(ov === 'X' ? `1${r}` : ov, o);
  if (L[o] >= 6 && ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}`, `no ${nm(r)} support`]);
  return R('P', [`no ${nm(r)} support: pass for now`]);
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
export function overcall(e, x, balancing) {
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
    const wj = others.find((s) => L[s] === 6 && top3(e, s) >= 2 && h >= 5 && h <= 10);
    if (wj) return R(`${cheapest(`1${x}`, wj) + 1}${wj}`, [`6 good ${nm(wj)}, ${h} HCP: weak jump overcall`]);
  }
  if (h >= 17) return R('X', [`${h} HCP: double first, then bid again`]);
  for (const s of [...others].filter((t) => L[t] >= 5).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])) {
    const lv = cheapest(`1${x}`, s);
    if (lv === 1 && h >= (balancing ? 7 : 8) && h <= 16) return R(`1${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: overcall`]);
    if (lv === 2 && h >= (balancing ? 9 : 11) && h <= 16 && (top3(e, s) >= 2 || L[s] >= 6)) return R(`2${s}`, [`${L[s]} good ${nm(s)}, ${h} HCP: 2-level overcall`]);
  }
  if (L[x] <= 2 && others.every((s) => L[s] >= 3) && h >= (balancing ? 9 : 12)) return R('X', [`short in ${nm(x)}, support for the other suits`, `${h} HCP: takeout double`]);
  return R('P', [`${h} HCP: no good action`]);
}

export function dont(e) {
  const h = e.hcp;
  const L = e.len;
  if (h < 8 || h > 15) return R('P', [`${h} HCP: ${h < 8 ? 'too weak' : 'defend'}`]);
  const five = (a, b) => L[a] >= 4 && L[b] >= 4 && Math.max(L[a], L[b]) >= 5;
  if (five('H', 'S')) return R('2H', ['hearts and spades']);
  if (L.S >= 6 && !SUITS4.some((s) => s !== 'S' && L[s] >= 4)) return R('2S', [`${L.S} spades, one-suited`]);
  if (['D', 'H', 'S'].some((s) => five('C', s))) return R('2C', ['clubs and a higher suit']);
  if (MAJORS.some((s) => five('D', s))) return R('2D', ['diamonds and a major']);
  if (SUITS4.some((s) => L[s] >= 6)) return R('X', ['one long suit'], { plan: 'Partner bids 2♣: pass with clubs, or bid your suit.' });
  return R('P', ['no DONT shape: pass']);
}

export function overWeakTwo(e, x, lv, balancing) {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS4.filter((s) => s !== x);
  const stop = stopper(e, x);
  const minX = (lv === 3 ? 13 : 12) - (balancing ? 2 : 0);
  if (lv === 2 && e.balanced && stop && h >= 15 && h <= 18) return R('2N', [`${h} HCP balanced, ${nm(x)} stopped`]);
  if (stop && h >= (lv === 2 ? 19 : 16) && e.balanced) return R('3N', [`${h} HCP, ${nm(x)} stopped`]);
  if ((L[x] <= 2 && others.every((s) => L[s] >= 3) && h >= minX) || h >= 17) return R('X', [`${h} HCP`, 'takeout double']);
  const s = others.filter((t) => L[t] >= 5 && (top3(e, t) >= 2 || L[t] >= 6)).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])[0];
  if (s && h >= minX) return R(`${cheapest(`${lv}${x}`, s)}${s}`, [`${L[s]} good ${nm(s)}, ${h} HCP`]);
  return R('P', [`${h} HCP: pass`]);
}

// ---------- Advancing ----------
export function advanceOvercall(e, x, ov) {
  const y = ov[1];
  const lv = Number(ov[0]);
  const h = e.hcp;
  const L = e.len;
  if (L[y] >= 3) {
    const dp = dummyPoints(e, y);
    if (dp >= 10) return R(`${cheapest(ov, x)}${x}`, [`${L[y]} ${nm(y)}, ${dp} points: cue-bid raise`]);
    if (h <= 7 && (L[y] >= 5 || (L[y] >= 4 && shortness(e, y)))) return R(`${lv + 2}${y}`, [`${L[y]} ${nm(y)}, weak: preemptive jump raise`]);
    if (dp >= 5) return R(`${lv + 1}${y}`, [`${L[y]} ${nm(y)}: raise`, 'competitive: raise even when light']);
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
    advise(k, (e) => overcall(e, x, bal), [bal ? { dealer: 'W', calls: [`1${x}`, 'P', 'P'] } : { dealer: 'E', calls: [`1${x}`] }]);
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
    advise(k, (e) => advanceOvercall(e, x, ov), [{ dealer: 'W', calls: [`1${x}`, ov, 'P'] }]);
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
  advise(pre, (e) => dont(e), [bal ? { dealer: 'W', calls: ['1N', 'P', 'P'] } : { dealer: 'E', calls: ['1N'] }]);
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
    advise(k, (e) => supportDecision(e, o, r, ov), [{ dealer: 'S', calls: [`1${o}`, 'P', `1${r}`, ov] }]);
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
export function overTheirConvention(e, o, their) {
  const h = e.hcp;
  const L = e.len;
  const fitNeed = isMajor(o) ? 3 : o === 'D' ? 4 : 5;
  const lv = their === '1N' ? 2 : 3;
  if (their === '1N' && h >= 9) return R('X', [`${h} HCP: penalty double of their 1NT`]);
  if (L[o] >= fitNeed) {
    const dp = isMajor(o) ? dummyPoints(e, o) : h;
    if (isMajor(o) && dp >= 13 && lv === 3) return R(`4${o}`, [`${L[o]} ${nm(o)}, ${dp} points: game`]);
    if (dp >= 6) return R(`${lv}${o}`, [`${L[o]} ${nm(o)}: compete`]);
  }
  if (their !== '1N' && h >= 10) return R('X', [`${h} HCP: values, interest in penalizing them`]);
  const own = SUITS4.filter((t) => t !== o && L[t] >= 5 && h >= (their === '1N' ? 5 : 8));
  if (own.length) {
    const t = longestOf(e, own);
    return R(`${cheapest(their, t)}${t}`, [`${L[t]} ${nm(t)}: natural`]);
  }
  return R('P', [`${h} HCP: pass`]);
}
for (const o of SUITS4) {
  for (const their of [`2${o}`, '2N', '1N']) {
    const k = [`1${o}`, `(${their})`];
    def(k, 'X', their === '1N' ? 'Penalty: 9+ HCP.' : 'Values (10+): interest in penalizing them.', { hcp: [their === '1N' ? 9 : 10, 37] });
    def(k, 'P', 'Pass.');
    const lv = their === '1N' ? 2 : 3;
    def(k, `${lv}${o}`, `Competitive raise of ${nm(o)}.`, { len: { [o]: [3, 13] } });
    if (isMajor(o) && lv === 3) def(k, `4${o}`, `Game in ${nm(o)}.`, { len: { [o]: [3, 13] } });
    for (const t of SUITS4.filter((x) => x !== o)) def(k, `${cheapest(their, t)}${t}`, `Natural: 5+ ${nm(t)}.`, { len: { [t]: [5, 13] } });
    advise(k, (e) => overTheirConvention(e, o, their), [{ dealer: 'N', calls: [`1${o}`, their] }]);
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
          for (const u of MAJORS.filter((s) => s !== o && s !== y)) def(k, `${cheapest(z, u)}${u}`, `4+ ${nm(u)}, as promised.`);
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

export { SAMPLES };
