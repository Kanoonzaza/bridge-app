import { dummyPoints } from '../../cards.js';
import {
  OURS, JORDAN, SUPPORT, DRURY, SUITS4, RANK, MAJORS, isMajor, nm, cheapest, above, lvOf, top3, stopper, stops, shortness, longestOf, hcpIn, R, entries, def, advise,
} from './shared.js';

// We opened and they overcalled or doubled: negative doubles, responder's bids, opener's next move,
// support doubles, Jordan 2NT. Notes: Part 5, "Competitive bidding: when we open and they compete".
// Meanings come first (def: what each call says), then the Advisor's decisions (advise: which call to make).

// ---------- Meanings: we opened and they overcalled (negative double, responder's bids, opener's reply) ----------
function negativeDouble(o, ov) {
  const y = ov[1];
  const lv = Number(ov[0]);
  const unbid = MAJORS.filter((s) => s !== o && s !== y);
  const min = lv === 1 ? 6 : lv === 2 ? 8 : 10;
  let shape;
  if (unbid.length === 2) shape = lv === 1 ? 'both majors, at least 4-4 (bid 1♥/1♠ with only one major); 3-3 only with values and no other good bid' : 'both majors, or one major without the strength to bid it at this level';
  else if (unbid.length === 1) {
    const u = unbid[0];
    if (lv === 1 && u === 'S') shape = 'exactly 4 spades (1♠ would show 5+); 3 only with values and no other good bid';
    else if (lv === 1 && u === 'H') shape = '4+ hearts (2♥ would show 5+ hearts and 10+); 3 only with values and no other good bid';
    else shape = `4 ${nm(u)} plus the other unbid suit, or a hand with values and no good bid`;
  } else shape = 'both minors, or a hand with values and no good bid';
  // The majors it promises at the 1-level (3+: a hand with values and no other bid may have only 3).
  // Higher up it may be a hand with values and no good bid, so no length is promised.
  const len = lv > 1 ? undefined : unbid.length === 2 ? { H: [3, 13], S: [3, 13] } : unbid.length === 1 ? { [unbid[0]]: [3, 13] } : undefined;
  return [`Negative double: ${shape}. ${min}+ HCP.`, len ? { hcp: [min, 37], len } : { hcp: [min, 37] }];
}

// Over our 1♣ their 2♣ is natural (our 1♣ may be short), so it is handled like any overcall, without raise or cue-bid.
const overcallSuits = (o) => SUITS4.filter((t) => t !== o || o === 'C');
for (const o of SUITS4) {
  for (const y of overcallSuits(o)) {
    for (let lv = cheapest(`1${o}`, y); lv <= 3; lv++) {
      const ov = `${lv}${y}`;
      const k = [`1${o}`, `(${ov})`];
      const [neg, shows] = negativeDouble(o, ov);
      def(k, 'X', neg, shows);
      const r = cheapest(ov, o);
      if (r <= 4 && y !== o) {
        def(k, `${r}${o}`, `Simple raise: 6–9${isMajor(o) ? ' points counting shortness' : ' (inverted minors are off)'}.`, { hcp: [6, 9], len: { [o]: [isMajor(o) ? 3 : 4, 13] }, ...(isMajor(o) && { pts: o }) });
        if (r + 1 <= 4) def(k, `${r + 1}${o}`, `Preemptive jump raise: 4+ ${nm(o)}, weak.`, { len: { [o]: [4, 13] } });
      }
      if (y !== o) def(k, `${lv + 1}${y}`, `Cue-bid: limit raise or better in ${nm(o)} (10+${isMajor(o) ? ' points counting shortness' : ''}).`, { hcp: [10, 37], len: { [o]: [isMajor(o) ? 3 : o === 'D' ? 4 : 5, 13] }, force: 'round', ...(isMajor(o) && { pts: o }) });
      if (lv === 1) def(k, '1N', `Natural: about 8–10 with a ${nm(y)} stopper.`, { hcp: [8, 10] });
      for (const s of SUITS4.filter((t) => t !== o && t !== y)) {
        const sl = cheapest(ov, s);
        def(k, `${sl}${s}`, sl === 1
          ? `Natural: ${y === 'H' && s === 'S' ? '5+' : '4+'} ${nm(s)}, forcing.`
          : `Natural: 5+ ${nm(s)}, 10+, forcing one round (2/1 is off).`, { ...(sl === 1 ? { hcp: [6, 37] } : { hcp: [10, 37] }), len: { [s]: [sl === 1 ? 4 : 5, 13] }, force: 'round' });
        if (sl + 1 <= 3) def(k, `${sl + 1}${s}`, `Weak jump shift: 6+ ${nm(s)}.`, { hcp: [2, 5], len: { [s]: [6, 13] } });
      }
    }
  }
  // Opener's reply to the negative double.
  for (const y of overcallSuits(o)) {
    for (let lv = cheapest(`1${o}`, y); lv <= 3; lv++) {
      const ov = `${lv}${y}`;
      const k = [`1${o}`, `(${ov})`, 'X'];
      def(k, 'P', `Penalty pass: a trump stack in ${nm(y)}.`, { len: { [y]: [4, 13] } });
      for (const u of MAJORS.filter((t) => t !== o && t !== y)) {
        const ul = cheapest(ov, u);
        def(k, `${ul}${u}`, `4 ${nm(u)}, minimum (12–14).`, { hcp: [12, 14], len: { [u]: [4, 13] }, light: true });
        if (ul + 1 <= 4) def(k, `${ul + 1}${u}`, `4 ${nm(u)}, 15–17: invitational jump.`, { hcp: [15, 17], len: { [u]: [4, 13] } });
      }
      if (y !== o) def(k, `${lv + 1}${y}`, 'Cue-bid: a big hand (18+), forcing.', { hcp: [18, 37], force: 'round' });
      else if (above('2N', ov)) def(k, lv === 2 ? '2N' : '3N', lv === 2 ? `18–19 balanced with a ${nm(y)} stopper.` : 'To play.', lv === 2 ? { hcp: [18, 19] } : {});
      if (lv === 1) def(k, '1N', `12–14 balanced with a ${nm(y)} stopper.`, { hcp: [12, 14], balanced: true });
      const ol = cheapest(ov, o);
      if (ol <= 3) def(k, `${ol}${o}`, `6+ ${nm(o)} (5 with nothing better to bid), minimum, no 4-card unbid major.`, { hcp: [12, 15], len: { [o]: [5, 13] }, light: true });
      if (ol + 1 <= 3) def(k, `${ol + 1}${o}`, `6+ ${nm(o)}, 16–17: invitational jump.`, { hcp: [16, 17], len: { [o]: [6, 13] } });
    }
  }
  // They doubled our opening.
  const k = [`1${o}`, '(X)'];
  def(k, 'XX', '10+ HCP, usually no fit: plans to double them or show a suit.', { hcp: [10, 37] });
  def(k, `2${o}`, `Weak raise: 6–9.`, { hcp: [6, 9], len: { [o]: [isMajor(o) ? 3 : 4, 13] } });
  def(k, '2N', `Jordan 2NT: ${isMajor(o) ? '4+' : '5+'} ${nm(o)}, limit raise or better (10+${isMajor(o) ? ' points counting shortness' : ''}).`, { hcp: [10, 37], len: { [o]: [isMajor(o) ? 4 : 5, 13] }, ...(isMajor(o) && { pts: o }) }, JORDAN);
  def(k, `3${o}`, `Preemptive raise: 4+ ${nm(o)}, weak.`, { len: { [o]: [4, 13] } });
  for (const s of SUITS4.filter((t) => t !== o)) {
    const lv = cheapest(`1${o}`, s);
    if (lv === 1) def(k, `1${s}`, `Natural: 4+ ${nm(s)}, forcing.`, { len: { [s]: [4, 13] }, force: 'round' });
    else if (!(s === 'C' && isMajor(o))) def(k, `2${s}`, `Natural: 5+ ${nm(s)}, weak, not forcing.`, { len: { [s]: [5, 13] } });
  }
  if (isMajor(o)) {
    def(k, '2C', 'Natural: 5+ clubs, weak, not forcing.', { len: { C: [5, 13] } }, OURS, { ctx: { responderPassed: false } });
    def(k, '2C', `Drury: 3-card ${nm(o)} support, 10–11 (Jordan 2NT shows 4).`, { len: { [o]: [3, 3] } }, DRURY, { ctx: { responderPassed: true } });
  }
}

// ---------- Meanings: support doubles and redoubles ----------
for (const [o, r] of [['C', 'H'], ['C', 'S'], ['D', 'H'], ['D', 'S'], ['H', 'S']]) {
  const resp = `1${r}`;
  const overs = [];
  for (const s of SUITS4.filter((t) => t !== r)) {
    const lv = cheapest(resp, s);
    if (!above(`${lv}${s}`, `2${r}`)) overs.push(`${lv}${s}`);
  }
  for (const ov of overs) {
    def([`1${o}`, resp, `(${ov})`], 'X', `Support double: exactly 3 ${nm(r)}. Shows support length, not extra strength.`, { len: { [r]: [3, 3] } }, SUPPORT);
    def([`1${o}`, resp, `(${ov})`], `2${r}`, `4-card ${nm(r)} support.`, { len: { [r]: [4, 13] } }, SUPPORT);
  }
  def([`1${o}`, resp, '(X)'], 'XX', `Support redouble: exactly 3 ${nm(r)}.`, { len: { [r]: [3, 3] } }, SUPPORT);
  def([`1${o}`, resp, '(X)'], `2${r}`, `4-card ${nm(r)} support.`, { len: { [r]: [4, 13] } }, SUPPORT);
}

// ---------- Decisions: responder after their overcall ----------
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
  if (L[o] >= fitNeed && !majorFirst && y !== o) {
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
    if (lv === 1 && h >= 8 && h <= 10) {
      // One or two points short of a 2-level suit with a good 6-card suit: say that bidding the suit is reasonable too.
      const six = h < 10 ? SUITS4.find((t) => t !== o && t !== y && L[t] >= 6 && cheapest(ov, t) === 2 && top3(e, t) + ['J', 'T'].filter((r) => e.hand[t].includes(r)).length >= 3) : null;
      return R('1N', [`${h} HCP with a ${nm(y)} stopper`], six ? { close: `A new suit at the 2-level asks for 10+ HCP, so 1NT is the agreed call. But ${L[six]} ${nm(six)} headed by ${[...'AKQJT'].filter((r) => e.hand[six].includes(r)).join('')} is a good suit: many players would bid 2${six} with ${h} HCP, and over 1NT partner will not know about the long suit. Bidding it is a reasonable choice, not a mistake.` } : {});
    }
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

// ---------- Decisions: responder after their double (Jordan 2NT, redouble) ----------
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

// ---------- Decisions: opener after partner's negative double ----------
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
    if (y !== o) return R(`${lv + 1}${y}`, [`${h} HCP: a big hand`]);
    return R(`${ul + 1}${u}`, [`${L[u]} ${nm(u)}`, `${h} HCP: jump`]);
  }
  if (h >= 18 && y !== o) return R(`${lv + 1}${y}`, [`${h} HCP: a big hand`]);
  if (h >= 18 && y === o && lv === 2 && e.balanced && stopper(e, y)) return R('2N', [`${h} HCP balanced with a ${nm(y)} stopper`]);
  if (lv === 1 && e.balanced && stopper(e, y)) return R('1N', [`${h} HCP balanced with a ${nm(y)} stopper`]);
  const ol = cheapest(ov, o);
  if (L[o] >= 6 && h >= 16 && ol + 1 <= 3) return R(`${ol + 1}${o}`, [`${L[o]} ${nm(o)}`, `${h} HCP: jump to invite`]);
  if (L[o] >= 6 && ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}`]);
  const other = SUITS4.filter((s) => s !== o && s !== y && !isMajor(s) && L[s] >= 4 && cheapest(ov, s) <= 3);
  if (other.length) return R(`${cheapest(ov, other[0])}${other[0]}`, [`${L[other[0]]} ${nm(other[0])}`]);
  if (ol <= 3) return R(`${ol}${o}`, [`${L[o]} ${nm(o)}: nothing better`]);
  return R('P', [`${h} HCP: nothing to add`]);
}

// Attach the three decisions above to their situations.
for (const o of SUITS4) {
  for (const y of overcallSuits(o)) {
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
    // Opener's decision is attached further down (openerFreeRebid), which adds the natural bids.
  }
}

// ---------- Responder when they show two suits (Michaels, Unusual 2NT) or overcall 1NT ----------
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
  for (const their of [...(o === 'C' ? [] : [`2${o}`]), '2N', '1N']) {
    const k = [`1${o}`, `(${their})`];
    const cue = theirCue(o, their);
    if (cue) def(k, cue, `Cue-bid of their suit: limit raise or better in ${nm(o)} (10+${isMajor(o) ? ' points counting shortness' : ''}). (Proposed.)`, { hcp: [10, 37], len: { [o]: [3, 13] }, force: 'round', ...(isMajor(o) && { pts: o }) }, 'their-two-suiters');
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

// ---------- After our values double of their two-suiter, and their runout ----------
// 1x–(2NT or minor Michaels)–X–(their suit): we have the balance of strength. Opener doubles with length in their
// suit, shows real shape, or passes (forcing); responder then doubles for penalty, bids a suit (forcing) or supports.
const TWO = 'their-two-suiters';
const knownTwo = (o, their) => (their === '2N' ? SUITS4.filter((t) => t !== o).slice(0, 2) : ['H', 'S']);
const bothStopped = (e, known) => known.every((t) => stopper(e, t));

export function openerAfterRunout(e, o, known, run) {
  const L = e.len;
  const r = run[1];
  if (L[r] >= 4) return R('X', [`${L[r]} ${nm(r)}: penalty`]);
  if (L[o] >= 6 && lvOf(`${cheapest(run, o)}${o}`) <= 3) return R(`${cheapest(run, o)}${o}`, [`${L[o]} ${nm(o)}: show the long suit`]);
  const second = SUITS4.find((t) => t !== o && !known.includes(t) && L[t] >= 5 && L[o] >= 5 && cheapest(run, t) <= 3);
  if (second) return R(`${cheapest(run, second)}${second}`, [`5-5: show ${nm(second)}`]);
  return R('P', ['partner has 10+: pass is forcing, partner doubles them or bids']);
}

export function doublerAfterRunout(e, o, known, run) {
  const L = e.len;
  const h = e.hcp;
  const r = run[1];
  const free = SUITS4.filter((t) => t !== o && !known.includes(t));
  const six = free.filter((t) => L[t] >= 6 && cheapest(run, t) <= 4).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])[0];
  if (six) return R(`${cheapest(run, six)}${six}`, [`${L[six]} ${nm(six)}: natural and forcing (the double showed the values)`]);
  if (L[r] >= 4 || (L[r] === 3 && /[AK]/.test(e.hand[r]) && h >= 12)) return R('X', [`${L[r]} ${nm(r)}: penalty`]);
  if (isMajor(o) && L[o] >= 3) return R(`4${o}`, [`${L[o]} ${nm(o)}`, 'opener 12+ and my 10+: game']);
  if (bothStopped(e, known) && above('3N', run)) return R('3N', [`${known.map(nm).join(' and ')} stopped: game`]);
  if (!isMajor(o) && L[o] >= 4) return R(`${cheapest(run, o)}${o}`, [`${L[o]} ${nm(o)}: support`]);
  const five = free.filter((t) => L[t] >= 5 && cheapest(run, t) <= 4).sort((a, b) => L[b] - L[a] || RANK[b] - RANK[a])[0];
  if (five) return R(`${cheapest(run, five)}${five}`, [`${L[five]} ${nm(five)}: natural and forcing`]);
  return R('X', ['no fit and no long suit: double, opener passes or pulls']);
}

export function openerAfterDoublersSuit(e, o, known, d) {
  const L = e.len;
  const t = d[1];
  if (isMajor(t) && L[t] >= 3 && above(`4${t}`, d)) return R(`4${t}`, [`${L[t]} ${nm(t)}`, 'partner has 10+: game']);
  if (isMajor(t) && L[t] >= 3) return R('P', [`${L[t]} ${nm(t)}: game reached`]);
  if (bothStopped(e, known) && above('3N', d)) return R('3N', [`${known.map(nm).join(' and ')} stopped: game`]);
  if (L[t] >= 3) return R(`${cheapest(d, t)}${t}`, [`${L[t]} ${nm(t)}: support`]);
  return R(`${cheapest(d, o)}${o}`, [`no fit for ${nm(t)}: back to ${nm(o)}`]);
}

for (const o of SUITS4) {
  for (const their of ['2N', ...(isMajor(o) || o === 'C' ? [] : [`2${o}`])]) {
    const known = knownTwo(o, their);
    const free = SUITS4.filter((t) => t !== o && !known.includes(t));
    for (const r of known) {
      const run = `${cheapest(their, r)}${r}`;
      const k = [`1${o}`, `(${their})`, 'X', `(${run})`];
      def(k, 'X', `Penalty: 4+ ${nm(r)}.`, { len: { [r]: [4, 13] } }, TWO);
      def(k, 'P', 'Forcing pass: partner has 10+, so partner doubles them or bids.', {}, TWO);
      if (cheapest(run, o) <= 3) def(k, `${cheapest(run, o)}${o}`, `6+ ${nm(o)}: shape, not extra strength.`, { len: { [o]: [6, 13] } }, TWO);
      for (const t of free) if (cheapest(run, t) <= 3) def(k, `${cheapest(run, t)}${t}`, `5-5: a second suit, ${nm(t)}.`, { len: { [t]: [5, 13], [o]: [5, 13] } }, TWO);
      advise(k, (e) => openerAfterRunout(e, o, known, run), [{ dealer: 'N', calls: [`1${o}`, their, 'X', run] }]);

      const k2 = [...k, 'P'];
      def(k2, 'X', `Penalty: length or honours in ${nm(r)}, or no better call (opener may pull with shape).`, {}, TWO);
      if (isMajor(o)) def(k2, `4${o}`, `Game: 3+ ${nm(o)}.`, { len: { [o]: [3, 13] } }, TWO);
      else if (cheapest(run, o) <= 4) def(k2, `${cheapest(run, o)}${o}`, `4+ ${nm(o)}: support. Forcing.`, { len: { [o]: [4, 13] }, force: 'round' }, TWO);
      if (above('3N', run)) def(k2, '3N', `To play: ${known.map(nm).join(' and ')} stopped.`, {}, TWO);
      const suits = [];
      for (const t of free) {
        const c = cheapest(run, t);
        if (c > 4) continue;
        def(k2, `${c}${t}`, `Natural: 5+ ${nm(t)}, 10+ (the double showed the values). Forcing.`, { hcp: [10, 37], len: { [t]: [5, 13] }, force: 'round' }, TWO);
        suits.push(`${c}${t}`);
      }
      advise(k2, (e) => doublerAfterRunout(e, o, known, run), [{ dealer: 'N', calls: [`1${o}`, their, 'X', run, 'P', 'P'] }]);

      for (const d of suits) {
        const k3 = [...k2, d];
        const t = d[1];
        if (isMajor(t) && above(`4${t}`, d)) def(k3, `4${t}`, `3+ ${nm(t)}: game.`, { len: { [t]: [3, 13] } }, TWO);
        if (isMajor(t) && d === `4${t}`) def(k3, 'P', `3+ ${nm(t)}: game reached.`, {}, TWO);
        if (above('3N', d)) def(k3, '3N', `To play: ${known.map(nm).join(' and ')} stopped.`, {}, TWO);
        if (!(isMajor(t) && above(`4${t}`, d)) || cheapest(d, t) < 4) def(k3, `${cheapest(d, t)}${t}`, `3+ ${nm(t)}: support.`, { len: { [t]: [3, 13] } }, TWO);
        def(k3, `${cheapest(d, o)}${o}`, `No fit for ${nm(t)}: back to ${nm(o)}.`, {}, TWO);
        advise(k3, (e) => openerAfterDoublersSuit(e, o, known, d), [{ dealer: 'N', calls: [`1${o}`, their, 'X', run, 'P', 'P', d, 'P'] }]);
      }
    }
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

// ---------- Responder after opener's support double or redouble ----------
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

// ---------- Opener after 1M–1NT and their overcall (proposed): the 1NT is no longer forcing ----------
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

// ---------- Opener's reopening double (proposed): 1o–(overcall)–P–(P), short in their suit ----------
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

// Responder after opener's takeout double (both situations above): pass for penalty with their suit, else bid.
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

// ---------- Opener's free rebid after our response and their bid (proposed): support first, then natural ----------
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

// Their notes subsections (each marked Proposed).
const OPEN_AFTER = 'opener-after-1m-1nt-and-their-overcall';
const REOPEN = 'opener-reopening-double';
const SUPPORT_LATE = 'support-doubles-after-their-overcall';

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

// ---------- Opener after a negative double when they raise (proposed): show the major, double with extras ----------
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
        def(k, 'P', 'Minimum: nothing more to say.', {}, 'opener-after-negative-double-and-their-raise');
        def(k, 'X', 'Cooperative double: extra values (17+). Partner passes with their suit, or bids.', { hcp: [17, 37] }, 'opener-after-negative-double-and-their-raise');
        def(k, '3N', `To play: 17+ with a ${nm(y)} stopper.`, { hcp: [17, 37] }, 'opener-after-negative-double-and-their-raise');
        for (const u of MAJORS.filter((t) => t !== o && t !== y)) {
          const c = cheapest(rz, u);
          if (c <= 3) def(k, `${c}${u}`, `4 ${nm(u)}: the major partner showed.`, { len: { [u]: [4, 13] } }, 'opener-after-negative-double-and-their-raise');
          if (c <= 4) def(k, `4${u}`, `4 ${nm(u)}, 16+: game.`, { hcp: [16, 37], len: { [u]: [4, 13] } }, 'opener-after-negative-double-and-their-raise');
        }
        const ol = cheapest(rz, o);
        if (ol <= 3) def(k, `${ol}${o}`, `6+ ${nm(o)}: competing.`, { len: { [o]: [6, 13] } }, 'opener-after-negative-double-and-their-raise');
        advise(k, (e) => afterNegXRaise(e, o, ov, rz), [{ dealer: 'S', calls: [`1${o}`, ov, 'X', rz] }]);
      }
    }
  }
}

// ---------- Opener after partner's pass and their balancing double: 1o–P–P–(X) ----------
// Partner is weak, so no game:
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
