// Pool question 'nt-interference', answer 'natural' (no Lebensohl): what our calls mean after they overcall our
// 1NT, and when advancing partner's takeout double of their weak two. Plan 13, task 4.9.
//
// Over their 2-level overcall of our 1NT:          Advancing partner's double of their weak two:
//   2 of a suit   5+, to play                        cheapest suit   0–8, 4+ cards, to play
//   3 of a suit   5+, game forcing                   jump in a suit  9–11, 4+ cards, invitational
//   2NT           8–9 with a stopper, invitational   2NT             10–12 with a stopper, invitational
//   cue-bid       Stayman, game values               cue-bid         game forcing
//   double        penalty                            3NT, 4 of a major: to play
//   3NT           to play
import { dummyPoints } from '../../cards.js';
import { SUITS4, RANK, MAJORS, isMajor, nm, cheapest, stopper, longestOf, R, def, advise, LEB, COMP } from '../competitive/shared.js';
import { openerAfterStayman, openerAfterGameForce } from '../competitive/over-our-conventions.js';

const OPT = 'nt-interference:natural';
const X = { opt: OPT };
void dummyPoints;

// ---------- Over their overcall of our 1NT ----------
export function naturalOver1NT(e, y) {
  const h = e.hcp;
  const L = e.len;
  const stop = stopper(e, y);
  const five = SUITS4.filter((s) => s !== y && L[s] >= 5);
  const ups = five.filter((s) => RANK[s] > RANK[y]);
  const fourM = MAJORS.some((s) => s !== y && L[s] === 4);
  if (L[y] >= 4 && h >= 6) return R('X', [`${L[y]} ${nm(y)} behind the overcaller, ${h} HCP: penalty double`]);
  if (h >= 10) {
    if (five.length) return R(`3${longestOf(e, five)}`, [`5+ ${nm(longestOf(e, five))}, ${h} HCP: game forcing`]);
    if (fourM) return R(`3${y}`, [`a 4-card major, ${h} HCP: cue-bid as Stayman`]);
    return R('3N', [`${h} HCP${stop ? `, ${nm(y)} stopped` : ''}: game in notrump`]);
  }
  if (ups.length && h <= 9) return R(`2${longestOf(e, ups)}`, [`5+ ${nm(longestOf(e, ups))}: to play`]);
  if (h >= 8 && stop) return R('2N', [`${h} HCP with a ${nm(y)} stopper: invite`]);
  return R('P', [`${h} HCP: nothing to say`]);
}

for (const y of SUITS4) {
  const k = ['1N', `(2${y})`];
  def(k, 'X', `Penalty: length in ${nm(y)}.`, { len: { [y]: [4, 13] } }, LEB, X);
  def(k, 'P', 'Pass: nothing to say.', {}, LEB, X);
  def(k, '2N', `Natural: 8–9 with a ${nm(y)} stopper, invitational.`, { hcp: [8, 9] }, LEB, X);
  def(k, `3${y}`, 'Cue-bid: Stayman for an unbid major, game values.', { hcp: [10, 37], force: 'game' }, LEB, X);
  def(k, '3N', 'To play.', { hcp: [10, 37] }, LEB, X);
  for (const s of SUITS4.filter((t) => t !== y)) {
    if (RANK[s] > RANK[y]) def(k, `2${s}`, `Natural: 5+ ${nm(s)}, to play.`, { len: { [s]: [5, 13] } }, LEB, X);
    def(k, `3${s}`, `Game forcing: 5+ ${nm(s)}.`, { len: { [s]: [5, 13] }, force: 'game' }, LEB, X);
  }
  advise(k, (e) => naturalOver1NT(e, y), [], OPT);

  // Opener after 2NT (invitational): accept with a maximum.
  const inv = ['1N', `(2${y})`, '2N'];
  def(inv, 'P', 'Minimum: decline.', { hcp: [15, 15] }, LEB, X);
  def(inv, '3N', 'Accepts: 16–17.', { hcp: [16, 17] }, LEB, X);
  advise(inv, (e) => (e.hcp >= 16 ? R('3N', [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])), [], OPT);

  // Opener after the cue-bid (Stayman) and after a game-forcing 3-level suit: as with Lebensohl's fast calls.
  const cue = ['1N', `(2${y})`, `3${y}`];
  for (const m of MAJORS.filter((t) => t !== y)) def(cue, `${cheapest(`3${y}`, m)}${m}`, `4+ ${nm(m)}: answers Stayman.`, { len: { [m]: [4, 13] } }, LEB, X);
  def(cue, '3N', 'No 4-card major, a stopper in their suit: 3NT.', {}, LEB, X);
  for (const t of ['C', 'D'].filter((u) => u !== y)) def(cue, `${cheapest(`3${y}`, t)}${t}`, `No major, no ${nm(y)} stopper: my longest minor.`, {}, LEB, X);
  advise(cue, (e) => openerAfterStayman(e, y, false), [], OPT);
  for (const x of SUITS4.filter((t) => t !== y)) {
    const gf = ['1N', `(2${y})`, `3${x}`];
    def(gf, `4${x}`, isMajor(x) ? `Game in ${nm(x)}: support (3+), or no stopper in ${nm(y)}.` : `No ${nm(y)} stopper: raise the minor.`, {}, LEB, X);
    def(gf, '3N', `A stopper in ${nm(y)}: 3NT.`, {}, LEB, X);
    advise(gf, (e) => openerAfterGameForce(e, y, x), [], OPT);
  }
}

// ---------- Advancing partner's takeout double of their weak two ----------
export function naturalAdvanceWeakTwoDouble(e, x) {
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
  if (h >= 9) {
    if (lv === 2) return R(`3${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: jump to invite`]);
    if (h >= 10 && stopper(e, x) && !majors.length) return R('2N', [`${h} HCP with a ${nm(x)} stopper: invite`]);
  }
  return R(`${lv}${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: the cheapest bid`]);
}

for (const x of ['D', 'H', 'S']) {
  const k = [`(2${x})`, 'X'];
  def(k, '2N', `Natural: 10–12 with a ${nm(x)} stopper, invitational.`, { hcp: [10, 12] }, COMP, X);
  def(k, `3${x}`, 'Cue-bid: game forcing.', { hcp: [12, 37], force: 'game' }, COMP, X);
  def(k, '3N', 'To play.', {}, COMP, X);
  for (const s of SUITS4.filter((t) => t !== x)) {
    const lv = cheapest(`2${x}`, s);
    def(k, `${lv}${s}`, `0–8: 4+ ${nm(s)}, to play.`, { hcp: [0, 8], len: { [s]: [4, 13] } }, COMP, X);
    if (lv === 2) def(k, `3${s}`, `9–11: 4+ ${nm(s)}, invitational.`, { hcp: [9, 11], len: { [s]: [4, 13] } }, COMP, X);
    if (isMajor(s) && lv === 3) def(k, `4${s}`, 'To play.', {}, COMP, X);
    if (isMajor(s) && lv === 2) def(k, `4${s}`, 'To play.', {}, COMP, X);
  }
  advise(k, (e) => naturalAdvanceWeakTwoDouble(e, x), [], OPT);
}
