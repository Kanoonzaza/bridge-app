import { dummyPoints } from '../../cards.js';
import {
  LEB, SUITS4, RANK, MAJORS, isMajor, cap, nm, cheapest, above, top3, stopper, stops, shortness, longestOf, goodSuit, R, raiseAtThree, def, advise,
} from './shared.js';

// They opened: our overcalls, takeout doubles, two-suiters and bids over their preempts and strong 2♣,
// and how partner advances. Notes: Part 5, "Competitive bidding: when they open".
// Meanings come first (def: what each call says), then the Advisor's decisions (advise: which call to make).

// ---------- Meanings: overcalling their 1-level suit opening (direct, and balancing after two passes) ----------
for (const x of SUITS4) {
  for (const balancing of [false, true]) {
    const k = balancing ? [`(1${x})`, 'P'] : [`(1${x})`];
    def(k, 'X', balancing ? `Takeout (balancing): short in ${nm(x)}, can be lighter (about 9+).` : `Takeout: short in ${nm(x)}, support for the unbid suits, 12+; or any 17+.`, { hcp: [balancing ? 9 : 12, 37] });
    def(k, '1N', balancing ? `Balancing 1NT: 11–14 balanced with a ${nm(x)} stopper.` : `15–18 balanced with a ${nm(x)} stopper. Systems on.`, { hcp: balancing ? [11, 14] : [15, 18], balanced: true });
    for (const s of SUITS4.filter((t) => t !== x)) {
      const lv = cheapest(`1${x}`, s);
      const lo = lv === 1 ? (balancing ? 7 : 8) : (balancing ? 9 : 10);
      const light = lv === 1 && !balancing ? ' (7 with a good 6-card suit)' : '';
      def(k, `${lv}${s}`, `${balancing ? 'Balancing overcall' : 'Overcall'}: ${lv === 1 ? '' : 'good '}5+ ${nm(s)}${lv === 1 ? '' : ' (usually 6)'}, ${lo}–16${light}.`, { hcp: [light ? 7 : lo, 16], len: { [s]: [5, 13] } });
      if (!balancing) {
        const jumpLv = lv + 1;
        def(k, `${jumpLv}${s}`, jumpLv >= 3 ? `Weak jump overcall, like a weak three: 7 ${nm(s)}, 5–10.` : `Weak jump overcall: 6 ${nm(s)}, 5–10.`, { hcp: [5, 10], len: { [s]: jumpLv >= 3 ? [7, 7] : [6, 6] } });
      }
    }
    if (!balancing) {
      def(k, `2${x}`, isMajor(x)
        ? `Michaels: 5+ ${nm(x === 'H' ? 'S' : 'H')} and a 5+ minor. Weak (6–11) or very strong (16+).`
        : 'Michaels: 5-5 in the majors. Weak (6–11) or very strong (16+).', { len: isMajor(x) ? { [x === 'H' ? 'S' : 'H']: [5, 13] } : { H: [5, 13], S: [5, 13] } });
      const low = SUITS4.filter((t) => t !== x).slice(0, 2);
      def(k, '2N', `Unusual 2NT: 5-5 in ${nm(low[0])} and ${nm(low[1])}. Weak (6–11) or very strong (16+).`, { len: { [low[0]]: [5, 13], [low[1]]: [5, 13] } });
    }
  }
}

// ---------- Meanings: over their weak two and 3-level preempts ----------
for (const x of ['D', 'H', 'S']) {
  for (const k of [[`(2${x})`], [`(2${x})`, 'P']]) {
    const bal = k.length === 2;
    def(k, 'X', bal ? `Takeout (balancing): short in ${nm(x)}, can be lighter (about 10+).` : `Takeout: opening values, short in ${nm(x)}.`, { hcp: [bal ? 10 : 12, 37] });
    def(k, '2N', `15–18 balanced with a ${nm(x)} stopper.`, { hcp: [15, 18], balanced: true });
    def(k, `3${x}`, `Asks partner for a ${nm(x)} stopper (for 3NT with a long running minor).`);
    def(k, '3N', 'To play.');
    for (const s of SUITS4.filter((t) => t !== x)) def(k, `${cheapest(`2${x}`, s)}${s}`, `Natural: good 5+ ${nm(s)}, about 12+.`, { hcp: [12, 37], len: { [s]: [5, 13] } });
  }
  // Advancing partner's double of the weak two (Lebensohl).
  const k = [`(2${x})`, 'X'];
  def(k, '2N', 'Lebensohl: weak (0–7). Forces 3♣; then pass or sign off.', { hcp: [0, 7] }, LEB);
  def(k, `3${x}`, 'Cue-bid: game forcing, asks for 4 spades or a stopper.', { hcp: [12, 37], force: 'game' }, LEB);
  def(k, '3N', 'To play.', {}, LEB);
  for (const s of SUITS4.filter((t) => t !== x)) {
    const lv = cheapest(`2${x}`, s);
    def(k, `${lv}${s}`, lv === 2 ? `Weak (0–7): 4+ ${nm(s)}, to play.` : `8–11, constructive: 4+ ${nm(s)}.`, { hcp: lv === 2 ? [0, 7] : [8, 11], len: { [s]: [4, 13] } }, LEB);
    if (isMajor(s)) def(k, `4${s}`, 'To play.', {}, LEB);
  }
  def([`(2${x})`, 'X', '2N', '3C'], 'P', 'To play in clubs.', {}, LEB);
  for (const s of ['D', 'H', 'S'].filter((t) => t !== x)) def([`(2${x})`, 'X', '2N', '3C'], `3${s}`, 'To play (weak).', {}, LEB);
}
for (const x of SUITS4) {
  def([`(3${x})`], 'X', 'Takeout.', { hcp: [13, 37] });
  def([`(3${x})`], '3N', 'To play.');
  for (const s of SUITS4.filter((t) => t !== x)) def([`(3${x})`], `${cheapest(`3${x}`, s)}${s}`, `Natural: good 5+ ${nm(s)}, opening values.`, { hcp: [13, 37], len: { [s]: [5, 13] } });
}

// ---------- Meanings: advancing partner's overcall, takeout double, Michaels or Unusual 2NT ----------
for (const x of SUITS4) {
  for (const y of SUITS4.filter((t) => t !== x)) {
    const ov = `${cheapest(`1${x}`, y)}${y}`;
    const k = [`(1${x})`, ov];
    const lv = Number(ov[0]);
    def(k, `${lv + 1}${y}`, `Raise: 6–9 points counting shortness, 3+ ${nm(y)}.`, { hcp: [6, 9], len: { [y]: [3, 13] }, pts: y });
    def(k, `${lv + 2}${y}`, `Preemptive jump raise: weak, 4+ ${nm(y)}.`, { len: { [y]: [4, 13] } });
    const cue = `${cheapest(ov, x)}${x}`;
    def(k, cue, `Cue-bid: 10+ points counting shortness, with ${nm(y)} support (limit raise or better).`, { hcp: [10, 37], len: { [y]: [3, 13] }, force: 'round', pts: y });
    if (lv === 1) def(k, '1N', `8–11 with a ${nm(x)} stopper.`, { hcp: [8, 11] });
    if (above('2N', ov)) def(k, '2N', `11–12 with a ${nm(x)} stopper.`, { hcp: [11, 12] });
    for (const z of SUITS4.filter((t) => t !== x && t !== y)) def(k, `${cheapest(ov, z)}${z}`, `Natural: 5+ ${nm(z)}, not forcing.`, { len: { [z]: [5, 13] } });
  }
  const k = [`(1${x})`, 'X'];
  def(k, 'P', `Penalty: long, strong ${nm(x)} (rare).`, { len: { [x]: [5, 13] } });
  def(k, `2${x}`, 'Cue-bid: 12+, forcing.', { hcp: [12, 37], force: 'round' });
  def(k, '1N', `6–10 with a ${nm(x)} stopper.`, { hcp: [6, 10] });
  def(k, '2N', `11–12 with a ${nm(x)} stopper.`, { hcp: [11, 12] });
  def(k, '3N', `13+ with a ${nm(x)} stopper.`, { hcp: [13, 37] });
  for (const s of SUITS4.filter((t) => t !== x)) {
    const lv = cheapest(`1${x}`, s);
    def(k, `${lv}${s}`, `0–8, 4+ ${nm(s)}: the cheapest bid in your best suit.`, { hcp: [0, 8], len: { [s]: [4, 13] } });
    def(k, `${lv + 1}${s}`, `9–11, invitational: 4+ ${nm(s)}.`, { hcp: [9, 11], len: { [s]: [4, 13] } });
  }
  // Michaels and Unusual 2NT. If they double, advancer still chooses: the same calls keep their meanings.
  for (const dbl of [[], ['(X)']]) {
    const m = [`(1${x})`, `2${x}`, ...dbl];
    if (isMajor(x)) {
      const o = x === 'H' ? 'S' : 'H';
      def(m, '2N', 'Asks which minor partner holds.');
      def(m, `${cheapest(`2${x}`, o)}${o}`, `Prefers ${nm(o)}: to play.`);
      def(m, `${cheapest(`2${x}`, o) + 1}${o}`, `${cap(nm(o))}, invitational.`);
    } else {
      for (const s of MAJORS) {
        def(m, `2${s}`, `Prefers ${nm(s)}: to play (weak).`);
        def(m, `3${s}`, `Prefers ${nm(s)}: invitational.`);
      }
    }
    const low = SUITS4.filter((t) => t !== x).slice(0, 2);
    for (const s of low) def([`(1${x})`, '2N', ...dbl], `3${s}`, `Prefers ${nm(s)}: to play.`);
  }
}

// ---------- Decisions: our first call over their opening (overcall, double, two-suiter or pass) ----------
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
    // Suit quality: two of the top three honours; at favourable vulnerability two of the top five (J109 counts).
    const solid = (s) => (vul === 'they' ? [...'AKQJT'].filter((r) => e.hand[s].includes(r)).length : top3(e, s)) >= 2;
    const wj = others.find((s) => L[s] === (cheapest(`1${x}`, s) + 1 >= 3 ? 7 : 6) && solid(s) && h >= minWj && h <= 10);
    if (wj) {
      const lvl = cheapest(`1${x}`, wj) + 1;
      return R(`${lvl}${wj}`, [`${L[wj]} good ${nm(wj)}, ${h} HCP: weak jump overcall`, lvl >= 3 ? 'at the 3-level it needs 7 cards, like a weak three' : 'a weak two-style jump: 6 cards']);
    }
  }
  if (h >= 17) return R('X', [`${h} HCP: double first, then bid again`]);
  for (const s of [...others].filter((t) => L[t] >= 5).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])) {
    const lv = cheapest(`1${x}`, s);
    // A 6-card suit with two of the top five honours makes up for a point at the 1-level.
    const six = !balancing && L[s] >= 6 && [...'AKQJT'].filter((r) => e.hand[s].includes(r)).length >= 2;
    if (lv === 1 && h >= (balancing || six ? 7 : 8) && h <= 16) return R(`1${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: overcall`, ...(h < 8 && !balancing ? ['a good 6-card suit makes up for the missing point'] : [])]);
    if (lv === 2 && h >= (balancing ? 9 : 10) && h <= 16 && (top3(e, s) >= 2 || L[s] >= 6)) return R(`2${s}`, [`${L[s]} good ${nm(s)}, ${h} HCP: 2-level overcall`]);
    // A 5-card suit with one top honour is enough when the hand has the points (12+): the extras make up for the suit.
    if (lv === 2 && !balancing && h >= 12 && h <= 16 && top3(e, s) >= 1) return R(`2${s}`, [`${L[s]} ${nm(s)} with ${honors5(e, s)}, ${h} HCP: the points make up for a suit with one top honor`]);
  }
  if (L[x] <= 2 && others.every((s) => L[s] >= 3) && h >= (balancing ? 9 : 12)) return R('X', [`short in ${nm(x)}, support for the other suits`, `${h} HCP: takeout double`]);
  return overcallPass(e, x, balancing);
}

const honors5 = (e, s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).join('');

// Why no overcall: name the options that came closest and what each one lacks.
function overcallPass(e, x, balancing) {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS4.filter((s) => s !== x);
  const honors = (s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).join('') || 'no top honor';
  const minTwo = balancing ? 9 : 10;
  // One point short of a 2-level overcall with a strong long suit: say so, and that many players would bid it.
  const near = others.find((t) => L[t] >= 6 && cheapest(`1${x}`, t) === 2 && h === minTwo - 1 && top3(e, t) >= 2);
  if (near) {
    const top = [...'AKQJT'].filter((r) => e.hand[near].includes(r)).join('');
    return R('P', [`${L[near]} ${nm(near)} headed by ${top}, but only ${h} HCP: our 2-level overcall asks for ${minTwo}+`, 'pass'], {
      close: `A ${L[near]}-card suit headed by ${top} is strong enough that many players would overcall 2 of ${nm(near)} with ${h} HCP. Our agreement says ${minTwo}+ because a 2-level overcall can be doubled and partner, often weak, may have little to offer. Bidding it is a reasonable choice, not a mistake.`,
    });
  }
  const weak3 = !balancing ? others.find((t) => L[t] === 6 && cheapest(`1${x}`, t) + 1 >= 3 && h >= 5 && h <= 10) : null;
  if (weak3) return R('P', [`6 ${nm(weak3)}: a weak jump to the 3-level needs 7 cards (a jump overcall that lands at the 2-level needs only 6)`, `${h} HCP: too weak for an ordinary overcall`]);
  if (h < (balancing ? 7 : 8)) return R('P', [`${h} HCP: too weak to act`]);
  const why = [];
  let close = null;
  const long = [...others].filter((t) => L[t] >= 5).sort((a, b) => L[b] - L[a])[0];
  if (long && cheapest(`1${x}`, long) === 2) {
    if (h >= minTwo && h <= 16) {
      why.push(`${L[long]} ${nm(long)} with ${honors(long)}: a 2-level overcall needs a good suit (two of the A-K-Q), 6 cards, or 12+ HCP with one top honor`);
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

export function overWeakTwo(e, x, lv, balancing) {
  const h = e.hcp;
  const L = e.len;
  const others = SUITS4.filter((s) => s !== x);
  const stop = stopper(e, x);
  const minX = (lv === 3 ? 13 : 12) - (balancing ? 2 : 0);
  const leap = lv === 2 ? leapingMichaels(e, x) : null;
  if (leap) return leap;
  if (lv === 2 && e.balanced && stop && h >= 15 && h <= 18) return R('2N', [`${h} HCP balanced, ${nm(x)} stopped`]);
  // With 4 cards in the other major, double is the alternative: it can find a 4-4 fit, but partner, often weak, may answer at the 4-level.
  const om = x === 'S' ? 'H' : x === 'H' ? 'S' : null;
  if (stop && h >= (lv === 2 ? 19 : 16) && e.balanced) return R('3N', [`${h} HCP, ${nm(x)} stopped`], { close: om && L[om] === 4 ? `With 4 ${nm(om)}, double is the alternative: it finds a 4-4 ${nm(om)} fit, but over a weak partner it often ends in a minor at the 4-level, so 3NT is usually better.` : null });
  if ((L[x] <= 2 && others.every((s) => L[s] >= 3) && h >= minX) || h >= 17) return R('X', [`${h} HCP`, 'takeout double']);
  const s = others.filter((t) => L[t] >= 5 && (top3(e, t) >= 2 || L[t] >= 6)).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])[0];
  if (s && h >= minX) return R(`${cheapest(`${lv}${x}`, s)}${s}`, [`${L[s]} good ${nm(s)}, ${h} HCP`]);
  return R('P', [`${h} HCP: pass`]);
}

// ---------- Decisions: advancing partner's overcall, takeout double, Michaels, Unusual 2NT, double of a weak two ----------
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

// ---------- Attach the decisions above to their situations (plus the few meanings they need) ----------
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
  // Over their double too: passing would leave partner doubled in a contract without a fit.
  for (const [dbl, r] of [[[], 'P'], [['(X)'], 'X']]) {
    advise([`(1${x})`, `2${x}`, ...dbl], (e) => advanceMichaels(e, x), [{ dealer: 'W', calls: [`1${x}`, `2${x}`, r] }]);
    advise([`(1${x})`, '2N', ...dbl], (e) => advanceUnusual(e, x), [{ dealer: 'W', calls: [`1${x}`, '2N', r] }]);
  }
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

// ---------- They opened and responded: our first call ----------
export function overTheirResponse(e, x, resp) {
  const h = e.hcp;
  const L = e.len;
  const theirs = [x, resp[1]].filter((s) => s !== 'N');
  const unbid = SUITS4.filter((s) => !theirs.includes(s));
  const own = unbid.filter((s) => L[s] >= 5 && (top3(e, s) >= 2 || L[s] >= 6)).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])[0];
  if (own) {
    const lv = cheapest(resp, own);
    if ((lv === 1 && h >= 9) || (lv === 2 && h >= 11) || (lv === 3 && (L[own] >= 6 ? h >= 12 : h >= 15))) return R(`${lv}${own}`, [`${L[own]} good ${nm(own)}, ${h} HCP`]);
  }
  if (h >= 12 && unbid.every((s) => L[s] >= 4) && theirs.every((s) => L[s] <= 2)) return R('X', [`${h} HCP, 4+ in both unbid suits: takeout`]);
  return R('P', [`${h} HCP: they have the values; pass`]);
}
for (const x of SUITS4) {
  // Their 1-level responses, 1NT, the raise, and a weak jump shift (2 of a higher suit).
  const resps = [...SUITS4.filter((s) => RANK[s] > RANK[x]).map((s) => `1${s}`), '1N', `2${x}`, ...SUITS4.filter((s) => RANK[s] > RANK[x]).map((s) => `2${s}`)];
  for (const resp of resps) {
    const k = [`(1${x})`, 'P', `(${resp})`];
    const theirs = [x, resp[1]].filter((s) => s !== 'N');
    const unbid = SUITS4.filter((s) => !theirs.includes(s));
    def(k, 'P', 'Pass.');
    def(k, 'X', `Takeout: 4+ in each unbid suit (${unbid.map(nm).join(' and ')}), 12+.`, { hcp: [12, 37], ...(unbid.length === 2 && { len: Object.fromEntries(unbid.map((s) => [s, [4, 13]])) }) });
    for (const s of unbid) def(k, `${cheapest(resp, s)}${s}`, `Natural: good 5+ ${nm(s)}.`, { len: { [s]: [5, 13] } });
    advise(k, (e) => overTheirResponse(e, x, resp), [{ dealer: 'W', calls: [`1${x}`, 'P', resp] }]);
  }
}

// ---------- Against their strong 2♣ (proposed) ----------
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
  def(k, 'X', `Lead-directing: a good ${nm(lead)} suit.`, { len: { [lead]: [4, 13] } }, 'against-their-strong-2');
  def(k, 'P', 'Pass.', {}, 'against-their-strong-2');
  def(k, '2N', 'Both minors (5-5), preemptive.', { len: { C: [5, 13], D: [5, 13] } }, 'against-their-strong-2');
  for (const t of SUITS4.filter((u) => !(after2D && u === 'D'))) {
    const lv = cheapest(last, t);
    def(k, `${lv}${t}`, `Natural: 5+ ${nm(t)}, preemptive.`, { len: { [t]: [5, 13] } }, 'against-their-strong-2');
    def(k, `${lv + 1}${t}`, `Preemptive jump: 7+ ${nm(t)}.`, { len: { [t]: [7, 13] } }, 'against-their-strong-2');
  }
  advise(k, (e) => overStrong2C(e, after2D), [after2D ? { dealer: 'W', calls: ['2C', 'P', '2D'] } : { dealer: 'E', calls: ['2C'] }]);
}

// ---------- Responsive doubles (proposed): they raise over partner's takeout double or overcall (through 3♠) ----------
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
        : `Responsive double: values (8+), the unbid suits (${unbid.map(nm).join(' and ')}).`, { hcp: [8, 37] }, 'responsive-doubles');
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

// ---------- Leaping Michaels over their weak two (proposed): 5-5, game values ----------
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
      def(k, '4D', 'Leaping Michaels: 5-5 in the majors, game values. (Proposed.)', { hcp: [11, 37], len: { H: [5, 13], S: [5, 13] } }, 'leaping-michaels');
      def(k, '4C', 'Leaping Michaels: 5+ clubs and a 5+ major, game values. (Proposed.)', { hcp: [11, 37], len: { C: [5, 13] } }, 'leaping-michaels');
    } else {
      const om = x === 'H' ? 'S' : 'H';
      for (const m of ['C', 'D']) def(k, `4${m}`, `Leaping Michaels: 5+ ${nm(m)} and 5+ ${nm(om)}, game values. (Proposed.)`, { hcp: [11, 37], len: { [m]: [5, 13], [om]: [5, 13] } }, 'leaping-michaels');
    }
    advise(k, (e) => overWeakTwo(e, x, 2, k.length === 2), []); // re-attach so the new calls are pickable
  }
}

// ---------- Doubling their 4-level preempts (proposed) ----------
// over 4♣/4♦/4♥ takeout; over 4♠ values (partner usually passes); 4NT over 4♠ = two suits.
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
    def(k, 'X', x === 'S' ? 'Values (14+): partner usually passes. (Proposed.)' : `Takeout: short in ${nm(x)}, 13+. (Proposed.)`, { hcp: [13, 37] }, 'doubling-their-4-level-preempts');
    def(k, 'P', 'Pass.', {}, 'doubling-their-4-level-preempts');
    if (x === 'S') def(k, '4N', 'Takeout for two suits (5-5). (Proposed.)', {}, 'doubling-their-4-level-preempts');
    for (const s of SUITS4.filter((t) => t !== x)) def(k, `${cheapest(`4${x}`, s)}${s}`, `Natural: good 6+ ${nm(s)}.`, { len: { [s]: [6, 13] } }, 'doubling-their-4-level-preempts');
    advise(k, (e) => overFourLevel(e, x), [k.length === 2 ? { dealer: 'W', calls: [`4${x}`, 'P', 'P'] } : { dealer: 'E', calls: [`4${x}`] }]);
  }
  const a = [`(4${x})`, 'X'];
  def(a, 'P', x === 'S' ? 'Defend: partner showed values.' : `Penalty pass: length and strength in ${nm(x)}.`, {}, 'doubling-their-4-level-preempts');
  for (const s of SUITS4.filter((t) => t !== x)) def(a, `${cheapest(`4${x}`, s)}${s}`, `Our best suit.`, {}, 'doubling-their-4-level-preempts');
  advise(a, (e) => advanceFourLevelDouble(e, x), [{ dealer: 'W', calls: [`4${x}`, 'X', 'P'] }]);
}

// ---------- Advancing when they bid over partner's overcall (proposed): their new suit, 1NT or negative double ----------
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

const ADVANCE_LATE = 'advancing-after-their-response';

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

// ---------- Advancing partner's takeout double when their partner has bid a suit: (1♦)–X–(1♥) ----------
// The double still asks for our suit. Measured double dummy (5+ spades after (1♦)–X–(1♥)): bidding the suit beat passing,
// which the Advisor used to do for lack of a rule.
export function advanceDoubleAfterResponse(e, x, rb) {
  const h = e.hcp;
  const L = e.len;
  const theirs = [x, rb[1]];
  const own = SUITS4.filter((t) => !theirs.includes(t) && L[t] >= 5).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a]);
  const t = own[0];
  if (t) {
    const lv = cheapest(rb, t);
    if (lv <= 2 && h >= 10 && lv + 1 <= 3) return R(`${lv + 1}${t}`, [`${L[t]} ${nm(t)}, ${h} HCP: jump to invite`]);
    if (lv <= 2) return R(`${lv}${t}`, [`${L[t]} ${nm(t)}: partner's double asked for a suit`, `${h} HCP: bid it, even though they bid in between`]);
  }
  return R('P', [`${h} HCP and no 5-card suit to bid: pass, partner can still bid`]);
}
for (const x of SUITS4) {
  for (const rb of SUITS4.filter((u) => u !== x).map((u) => `${cheapest(`1${x}`, u) <= 1 ? 1 : 2}${u}`).filter((c) => c[0] === '1')) {
    const k = [`(1${x})`, 'X', `(${rb})`];
    def(k, 'P', 'Pass: no suit of our own to bid.', {});
    for (const t of SUITS4.filter((u) => u !== x && u !== rb[1])) {
      const lv = cheapest(rb, t);
      if (lv <= 2) def(k, `${lv}${t}`, `Natural: 5+ ${nm(t)}. Partner's double asked for a suit.`, { len: { [t]: [5, 13] } });
      if (lv + 1 <= 3) def(k, `${lv + 1}${t}`, `Invitational jump: 5+ ${nm(t)}, 10+.`, { hcp: [10, 37], len: { [t]: [5, 13] } });
    }
    advise(k, (e) => advanceDoubleAfterResponse(e, x, rb), [{ dealer: 'E', calls: [`1${x}`, 'X', rb] }]);
  }
}

// ---------- Overcaller after advancer's cue-bid raise (major overcalls) ----------
const CUE_RAISE = 'overcaller-after-the-cue-bid-raise';

// A key (their calls in brackets, passes left out) as the auction it stands for, starting with their opening.
// Overcaller's turn comes after five calls.
const toCalls = (k) => k.reduce((calls, c) => {
  const theirs = c.startsWith('(');
  if ((calls.length % 2 === 0) !== theirs) calls.push('P');
  calls.push(c.replace(/[()]/g, ''));
  return calls;
}, []);

// The cue-bid shows a limit raise or better. With a hand that would accept a limit raise (15+ HCP, 5 losers or
// fewer, or 6 losers with a 6+ card suit), bid game; otherwise sign off in the suit and let partner go on with game values.
export function overcallerAfterCue(e, y, last, intervened) {
  const h = e.hcp;
  if (h >= 15 || e.ltc <= 5 || (e.ltc <= 6 && e.len[y] >= 6)) return R(`4${y}`, [`${h} HCP, ${e.len[y]} ${nm(y)}, ${e.ltc} losers`, 'opposite a limit raise that is enough for game']);
  const c = cheapest(last, y);
  // Over their call, by total tricks an 8-card fit competes to the 2-level only: with 5 cards, pass rather than bid at the 3-level.
  if (intervened && (c >= 4 || (c === 3 && e.len[y] < 6))) return R('P', [`${h} HCP, ${e.ltc} losers: minimum overcall`, c >= 4 ? 'too high to compete further' : `${e.len[y]} ${nm(y)}: an 8-card fit competes only to the 2-level`]);
  return R(`${c}${y}`, [`${h} HCP, ${e.ltc} losers: minimum overcall`, 'sign off; partner goes on with game values']);
}

for (const x of SUITS4) {
  for (const y of MAJORS.filter((t) => t !== x)) {
    const ov = `${cheapest(`1${x}`, y)}${y}`;
    const paths = [[`(1${x})`, ov, `${cheapest(ov, x)}${x}`]];
    const responses = ['X', ...(ov[0] === '1' ? ['1N'] : []), ...SUITS4.filter((u) => u !== x && u !== y && cheapest(ov, u) <= 2).map((u) => `${cheapest(ov, u)}${u}`)];
    for (const rb of responses) {
      const cue = cheapest(rb === 'X' ? ov : rb, x);
      if (cue <= 3) paths.push([`(1${x})`, ov, `(${rb})`, `${cue}${x}`]);
    }
    for (const base of paths) {
      const cue = base.at(-1);
      if (!above(`4${y}`, cue)) continue;
      const theirs = ['X'];
      for (let lv = 2; lv <= 4; lv++) for (const z of [...SUITS4, 'N']) if (z !== y && above(`${lv}${z}`, cue) && above(`4${y}`, `${lv}${z}`)) theirs.push(`${lv}${z}`);
      for (const t of [null, ...theirs]) {
        const k = t ? [...base, `(${t})`] : base;
        const last = t && t !== 'X' ? t : cue;
        const c = cheapest(last, y);
        if (c < 4) def(k, `${c}${y}`, `Minimum overcall: would pass a limit raise. Partner bids game with game values.`, { hcp: [7, 14] }, CUE_RAISE);
        if (t) def(k, 'P', 'Minimum overcall: nothing more to say.', { hcp: [7, 14] }, CUE_RAISE);
        def(k, `4${y}`, `Game: would accept a limit raise (15+ HCP, 5 losers or fewer, or 6 losers with 6+ ${nm(y)}).`, {}, CUE_RAISE);
        const calls = toCalls(k);
        while (calls.length < 5) calls.push('P');
        advise(k, (e) => overcallerAfterCue(e, y, last, Boolean(t)), [{ dealer: 'E', calls }]);
      }
    }
  }
}

// ---------- Advancing partner's balancing double ----------
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
