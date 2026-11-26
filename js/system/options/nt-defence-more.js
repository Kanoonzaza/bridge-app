// Pool question 'nt-defence' (their 1NT): Landy and Cappelletti (Plan 13, phase 7). Both keep the natural
// defence's penalty double (15+, balancing 12+) and 2NT for the minors.
//   Landy        2♣ = both majors (5-4 or longer) · 2♦/2♥/2♠ = natural, 6+ (or a good 5), 8–14
//                advancer: 2♥/2♠ = preference (the longer; equal: 2♦ asks overcaller to pick) · 3♥/3♠ = 4+, 11+, invitational
//   Cappelletti  2♣ = one long suit (6+), 8–14: advancer relays 2♦, overcaller passes or names it
//                2♦ = both majors · 2♥/2♠ = that major (5+) and a minor (4+): advancer passes, or 2NT asks for the minor
import { SUITS4, MAJORS, nm, top3, R, def, advise } from '../competitive/shared.js';

const DONT = 'dont-against-their-1nt-tier-1';
const LANDY = 'nt-defence:landy';
const CAPP = 'nt-defence:cappelletti';
const longer = (e, a, b) => (e.len[b] > e.len[a] ? b : a);
const longMajor = (e) => (e.len.S > e.len.H ? 'S' : 'H');

// The parts both play: the penalty double and advancer's escape, 2NT for the minors, and standing a double.
function shared(pre, opt, bal) {
  const X = { opt };
  def(pre, 'X', bal ? 'Penalty: 12+ (balancing).' : 'Penalty: 15+.', { hcp: [bal ? 12 : 15, 37] }, DONT, X);
  def(pre, 'P', 'Pass.', {}, DONT, X);
  def(pre, '2N', 'Both minors: 5-5 or longer.', { len: { C: [5, 13], D: [5, 13] } }, DONT, X);
  const dbl = [...pre, 'X'];
  def(dbl, 'P', 'Pass: defend 1NT doubled.', {}, DONT, X);
  for (const s of SUITS4) def(dbl, `2${s}`, `Weak: 5+ ${nm(s)}, 0–5. To play.`, { hcp: [0, 5], len: { [s]: [5, 13] } }, DONT, X);
  advise(dbl, (e) => {
    const s = SUITS4.filter((t) => e.len[t] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
    return e.hcp <= 5 && s ? R(`2${s}`, [`${e.hcp} HCP and ${e.len[s]} ${nm(s)}: run`]) : R('P', ['pass: defend 1NT doubled']);
  }, [], opt);
  const un = [...pre, '2N'];
  def(un, '3C', 'Prefers clubs.', {}, DONT, X);
  def(un, '3D', 'Prefers diamonds.', {}, DONT, X);
  advise(un, (e) => (e.len.D > e.len.C ? R('3D', [`${e.len.D} diamonds`]) : R('3C', [`${e.len.C} clubs`])), [], opt);
}

// Advancer after a natural 2-level suit, and after their double of it.
function naturalSuit(pre, opt, s) {
  const X = { opt };
  const k = [...pre, `2${s}`];
  def(k, 'P', 'Pass: to play.', {}, DONT, X);
  def(k, `3${s}`, `Raise: 3+ ${nm(s)}, 10+. Invitational.`, { hcp: [10, 37], len: { [s]: [3, 13] } }, DONT, X);
  advise(k, (e) => (e.hcp >= 10 && e.len[s] >= 3 ? R(`3${s}`, [`${e.len[s]} ${nm(s)}, ${e.hcp} HCP: invite`]) : R('P', ['pass: partner chose the contract'])), [], opt);
  def([...k, '(X)'], 'P', 'Pass: play it doubled.', {}, DONT, X);
  advise([...k, '(X)'], () => R('P', ['stay']), [], opt);
}

// Advancer after both majors are shown (Landy 2♣, Cappelletti 2♦).
// They double the artificial bid: advancer says the same as without the double.
function majorsShown(pre, opt, call) {
  majorsShownAt(pre, opt, call, false);
  majorsShownAt(pre, opt, call, true);
}
function majorsShownAt(pre, opt, call, doubled) {
  const X = { opt };
  const k = [...pre, call, ...(doubled ? ['(X)'] : [])];
  const cheap = call === '2C' ? 2 : 2;
  def(k, `${cheap}H`, 'Preference: hearts (to play).', {}, DONT, X);
  def(k, `${cheap}S`, 'Preference: spades (to play).', {}, DONT, X);
  def(k, '3H', '4+ hearts, 11+: invitational.', { hcp: [11, 37], len: { H: [4, 13] } }, DONT, X);
  def(k, '3S', '4+ spades, 11+: invitational.', { hcp: [11, 37], len: { S: [4, 13] } }, DONT, X);
  if (call === '2C') def(k, '2D', 'Equal length in the majors: overcaller picks.', {}, DONT, X);
  advise(k, (e) => {
    const m = longMajor(e);
    if (e.hcp >= 11 && e.len[m] >= 4) return R(`3${m}`, [`${e.len[m]} ${nm(m)}, ${e.hcp} HCP: invite`]);
    if (call === '2C' && e.len.H === e.len.S) return R('2D', ['equal length: let partner pick']);
    return R(`2${m}`, [`${e.len[m]} ${nm(m)}: the better fit`]);
  }, [], opt);
  // Overcaller after the preference: pass; after the invitation, game with 12+.
  for (const M of MAJORS) {
    def([...k, `2${M}`], 'P', 'Pass: to play.', {}, DONT, X);
    advise([...k, `2${M}`], () => R('P', ['partner chose the major']), [], opt);
    def([...k, `3${M}`], 'P', 'Minimum: decline.', {}, DONT, X);
    def([...k, `3${M}`], `4${M}`, 'Accept: game.', { hcp: [12, 37] }, DONT, X);
    advise([...k, `3${M}`], (e) => (e.hcp >= 12 ? R(`4${M}`, [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])), [], opt);
  }
  if (call === '2C' && !doubled) {
    const pick = [...k, '2D'];
    def(pick, '2H', 'Longer (or equal) hearts.', {}, DONT, X);
    def(pick, '2S', 'Longer spades.', {}, DONT, X);
    advise(pick, (e) => (e.len.S > e.len.H ? R('2S', ['longer spades']) : R('2H', ['hearts'])), [], opt);
  }
}

// ---------- Landy ----------
export function landy(e, bal) {
  const h = e.hcp;
  const L = e.len;
  if (h >= (bal ? 12 : 15)) return R('X', [`${h} HCP: penalty double`]);
  if (L.H >= 4 && L.S >= 4 && Math.max(L.H, L.S) >= 5 && h >= 7) return R('2C', [`${L.S} spades and ${L.H} hearts: Landy`]);
  if (L.C >= 5 && L.D >= 5 && h >= 8) return R('2N', ['5-5 in the minors']);
  const s = ['D', 'H', 'S'].filter((t) => L[t] >= 6 || (L[t] === 5 && top3(e, t) >= 2)).sort((a, b) => L[b] - L[a])[0];
  if (s && h >= (bal ? 7 : 8) && h <= 14) return R(`2${s}`, [`${L[s]} ${nm(s)}, ${h} HCP: natural`]);
  return R('P', [`${h} HCP: pass`]);
}

// ---------- Cappelletti ----------
export function cappelletti(e, bal) {
  const h = e.hcp;
  const L = e.len;
  if (h >= (bal ? 12 : 15)) return R('X', [`${h} HCP: penalty double`]);
  if (h < (bal ? 7 : 8)) return R('P', [`${h} HCP: pass`]);
  if (L.H >= 4 && L.S >= 4 && Math.max(L.H, L.S) >= 5) return R('2D', [`${L.S} spades and ${L.H} hearts: both majors`]);
  const M = MAJORS.find((t) => L[t] >= 5 && ['C', 'D'].some((m) => L[m] >= 4));
  if (M) return R(`2${M}`, [`${L[M]} ${nm(M)} and a 4+ minor`]);
  if (L.C >= 5 && L.D >= 5) return R('2N', ['5-5 in the minors']);
  const one = SUITS4.filter((t) => L[t] >= 6).sort((a, b) => L[b] - L[a])[0];
  if (one && h <= 14) return R('2C', [`${L[one]} ${nm(one)}: one long suit`]);
  return R('P', [`${h} HCP: pass`]);
}

for (const pre of [['(1N)'], ['(1N)', 'P']]) {
  const bal = pre.length === 2;

  // Landy
  shared(pre, LANDY, bal);
  def(pre, '2C', 'Landy: both majors, 5-4 or longer.', { len: { H: [4, 13], S: [4, 13] } }, DONT, { opt: LANDY });
  for (const s of ['D', 'H', 'S']) def(pre, `2${s}`, `Natural: 6+ ${nm(s)} (or a good 5), 8–14.`, { hcp: [bal ? 7 : 8, 14], len: { [s]: [5, 13] } }, DONT, { opt: LANDY });
  advise(pre, (e) => landy(e, bal), [], LANDY);
  majorsShown(pre, LANDY, '2C');
  for (const s of ['D', 'H', 'S']) naturalSuit(pre, LANDY, s);

  // Cappelletti
  shared(pre, CAPP, bal);
  def(pre, '2C', 'Cappelletti: one long suit (6+), 8–14. Partner relays 2♦.', { len: {} }, DONT, { opt: CAPP });
  def(pre, '2D', 'Cappelletti: both majors, 5-4 or longer.', { len: { H: [4, 13], S: [4, 13] } }, DONT, { opt: CAPP });
  def(pre, '2H', 'Cappelletti: 5+ hearts and a 4+ minor.', { len: { H: [5, 13] } }, DONT, { opt: CAPP });
  def(pre, '2S', 'Cappelletti: 5+ spades and a 4+ minor.', { len: { S: [5, 13] } }, DONT, { opt: CAPP });
  advise(pre, (e) => cappelletti(e, bal), [], CAPP);
  majorsShown(pre, CAPP, '2D');
  // After 2♣ (one suit): advancer relays 2♦ (or bids a long major of his own, to play); overcaller names the suit.
  const one = [...pre, '2C'];
  for (const k of [one, [...one, '(X)']]) {
    def(k, '2D', 'Relay: what is your suit?', {}, DONT, { opt: CAPP });
    def(k, '2H', 'Own long hearts: to play.', { len: { H: [6, 13] } }, DONT, { opt: CAPP });
    def(k, '2S', 'Own long spades: to play.', { len: { S: [6, 13] } }, DONT, { opt: CAPP });
    advise(k, (e) => (e.hcp <= 9 && MAJORS.some((t) => e.len[t] >= 6) ? R(`2${longMajor(e)}`, [`${e.len[longMajor(e)]} ${nm(longMajor(e))}: to play`]) : R('2D', ['relay: partner names the suit'])), [], CAPP);
    // Advancer's own long major is to play.
    for (const M of MAJORS) {
      def([...k, `2${M}`], 'P', 'Pass: partner has a long suit of his own.', {}, DONT, { opt: CAPP });
      advise([...k, `2${M}`], () => R('P', ['partner is to play in his own suit']), [], CAPP);
    }
  }
  const relay = [...one, '2D'];
  def(relay, 'P', 'My suit is diamonds.', {}, DONT, { opt: CAPP });
  def(relay, '2H', 'My suit is hearts.', {}, DONT, { opt: CAPP });
  def(relay, '2S', 'My suit is spades.', {}, DONT, { opt: CAPP });
  def(relay, '3C', 'My suit is clubs.', {}, DONT, { opt: CAPP });
  advise(relay, (e) => {
    const s = SUITS4.filter((t) => e.len[t] >= 6).sort((a, b) => e.len[b] - e.len[a])[0] ?? 'D';
    return R(s === 'D' ? 'P' : s === 'C' ? '3C' : `2${s}`, [`my suit is ${nm(s)}`]);
  }, [], CAPP);
  // After 2♥/2♠ (major + minor): pass with support, else 2NT asks for the minor.
  for (const M of MAJORS) {
    const k = [...pre, `2${M}`];
    def(k, 'P', `Pass: ${nm(M)} will do.`, {}, DONT, { opt: CAPP });
    def(k, '2N', 'Asks for the minor.', {}, DONT, { opt: CAPP });
    advise(k, (e) => (e.len[M] >= 2 ? R('P', [`${e.len[M]} ${nm(M)}: play there`]) : R('2N', [`short in ${nm(M)}: ask for the minor`])), [], CAPP);
    const ask = [...k, '2N'];
    def(ask, '3C', 'My minor is clubs.', {}, DONT, { opt: CAPP });
    def(ask, '3D', 'My minor is diamonds.', {}, DONT, { opt: CAPP });
    advise(ask, (e) => R(longer(e, 'C', 'D') === 'D' ? '3D' : '3C', ['my minor']), [], CAPP);
    def([...k, '(X)'], 'P', 'Pass: play it doubled.', {}, DONT, { opt: CAPP });
    advise([...k, '(X)'], () => R('P', ['stay']), [], CAPP);
  }
}
