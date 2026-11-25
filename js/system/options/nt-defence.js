// Pool question 'nt-defence' (their 1NT), answer 'natural'. Plan 13, task 4.14.
//   Double = penalty, 15+ (balancing: 12+) · 2 of a suit = 6+ cards (or a good 5), 8–14 · 2NT = both minors, 5-5.
//   Advancer: passes the double, or runs with a weak hand (0–5) and a 5+ suit; raises a suit with 3+ and 10+;
//   picks a minor over 2NT.
import { SUITS4, nm, top3, R, def, advise, COMP } from '../competitive/shared.js';

const OPT = 'nt-defence:natural';
const DONT = 'dont-against-their-1nt-tier-1';
const X = { opt: OPT };

export function naturalDefence(e, balancing) {
  const h = e.hcp;
  const L = e.len;
  if (h >= (balancing ? 12 : 15)) return R('X', [`${h} HCP: penalty double`]);
  if (L.C >= 5 && L.D >= 5 && h >= 8) return R('2N', ['5-5 in the minors']);
  const s = SUITS4.filter((t) => L[t] >= 6 || (L[t] === 5 && top3(e, t) >= 2)).sort((a, b) => L[b] - L[a] || 'CDHS'.indexOf(b) - 'CDHS'.indexOf(a))[0];
  if (s && h >= (balancing ? 7 : 8) && h <= 14) return R(`2${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: natural overcall`]);
  return R('P', [h >= 15 ? 'pass' : `${h} HCP: pass`]);
}

for (const pre of [['(1N)'], ['(1N)', 'P']]) {
  const bal = pre.length === 2;
  def(pre, 'X', bal ? 'Penalty: 12+ (balancing).' : 'Penalty: 15+.', { hcp: [bal ? 12 : 15, 37] }, DONT, X);
  def(pre, 'P', 'Pass.', {}, DONT, X);
  def(pre, '2N', 'Both minors: 5-5 or longer.', { len: { C: [5, 13], D: [5, 13] } }, DONT, X);
  for (const s of SUITS4) def(pre, `2${s}`, `Natural: 6+ ${nm(s)} (or a good 5), 8–14.`, { hcp: [bal ? 7 : 8, 14], len: { [s]: [5, 13] } }, DONT, X);
  advise(pre, (e) => naturalDefence(e, bal), [], OPT);

  // Advancer after the penalty double.
  const dbl = [...pre, 'X'];
  def(dbl, 'P', 'Pass: defend 1NT doubled.', {}, DONT, X);
  for (const s of SUITS4) def(dbl, `2${s}`, `Weak: 5+ ${nm(s)}, 0–5. To play.`, { hcp: [0, 5], len: { [s]: [5, 13] } }, DONT, X);
  advise(dbl, (e) => {
    const s = SUITS4.filter((t) => e.len[t] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
    return e.hcp <= 5 && s ? R(`2${s}`, [`${e.hcp} HCP and ${e.len[s]} ${nm(s)}: run to the long suit`]) : R('P', ['pass: defend 1NT doubled']);
  }, [], OPT);

  // Advancer after a natural 2-level suit.
  for (const s of SUITS4) {
    const k = [...pre, `2${s}`];
    def(k, 'P', 'Pass: to play.', {}, DONT, X);
    def(k, `3${s}`, `Raise: 3+ ${nm(s)}, 10+. Invitational.`, { hcp: [10, 37], len: { [s]: [3, 13] } }, DONT, X);
    advise(k, (e) => (e.hcp >= 10 && e.len[s] >= 3 ? R(`3${s}`, [`${e.len[s]} ${nm(s)}, ${e.hcp} HCP: invite`]) : R('P', ['pass: partner chose the contract'])), [], OPT);
    // They double the overcall for penalty: partner has a real suit, so stay.
    def([...k, '(X)'], 'P', 'Pass: partner has a long suit; play it doubled.', {}, DONT, X);
    advise([...k, '(X)'], () => R('P', ['partner showed a long suit: stay']), [], OPT);
  }

  // Advancer after 2NT (both minors): the longer minor.
  const unusual = [...pre, '2N'];
  def(unusual, '3C', 'Prefers clubs.', {}, DONT, X);
  def(unusual, '3D', 'Prefers diamonds.', {}, DONT, X);
  advise(unusual, (e) => (e.len.D > e.len.C ? R('3D', [`${e.len.D} diamonds`]) : R('3C', [`${e.len.C} clubs`])), [], OPT);
}

void COMP;
