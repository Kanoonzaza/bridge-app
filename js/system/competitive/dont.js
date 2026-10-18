import {
  DONT, SUITS4, MAJORS, nm, top3, longestOf, R, entries, def, advise,
} from './shared.js';

// Against their 1NT: DONT. Notes: "DONT against their 1NT".
// Meanings come first (def: what each call says), then the Advisor's decisions (advise: which call to make).

// ---------- Meanings: DONT calls and partner's replies ----------
const DONT_CALLS = [
  ['X', 'DONT: one long suit (6+). Partner bids 2♣; pass with clubs or bid your suit.'],
  ['2C', 'DONT: clubs and a higher suit (5-4 or longer).'],
  ['2D', 'DONT: diamonds and a major.'],
  ['2H', 'DONT: hearts and spades.'],
  ['2S', 'DONT: spades only (6+ usually).'],
];
const ADVANCE_DONT = {
  X: [['2C', 'Relay: forced (unless you have a long suit of your own to play).'], ['2D', 'Own long diamonds: to play.'], ['2H', 'Own long hearts: to play.'], ['2S', 'Own long spades: to play.']],
  '2C': [['P', 'Club support: to play.'], ['2D', '"Show me your other suit."']],
  '2D': [['P', 'Diamond support: to play.'], ['2H', 'Pass or correct: pass with hearts, partner bids 2♠ with spades.']],
  '2H': [['P', 'Hearts: to play.'], ['2S', 'Spades: to play.']],
  '2S': [['P', 'To play.'], ['3S', 'Raise: a fit.']],
};
for (const pre of [['(1N)'], ['(1N)', 'P']]) {
  for (const [call, meaning] of DONT_CALLS) def(pre, call, meaning, {}, DONT);
  for (const [their, rows] of Object.entries(ADVANCE_DONT)) for (const [call, meaning] of rows) def([...pre, their], call, meaning, {}, DONT);
  def([...pre, 'X', '2C'], 'P', 'My long suit is clubs.', { len: { C: [6, 13] } }, DONT);
  for (const s of ['D', 'H', 'S']) def([...pre, 'X', '2C'], `2${s}`, `My long suit is ${nm(s)}.`, { len: { [s]: [6, 13] } }, DONT);
  for (const s of ['D', 'H', 'S']) def([...pre, '2C', '2D'], s === 'D' ? 'P' : `2${s}`, s === 'D' ? 'My other suit is diamonds.' : `My other suit is ${nm(s)}.`, {}, DONT);
  def([...pre, '2D', '2H'], 'P', 'My major is hearts.', {}, DONT);
  def([...pre, '2D', '2H'], '2S', 'My major is spades.', {}, DONT);
  // Their penalty double of our DONT bid: pass with length in the suit, otherwise redouble to ask for the other suit.
  for (const c of ['2C', '2D', '2H']) {
    const s = c[1];
    def([...pre, c, '(X)'], 'P', `Doubled: I have ${nm(s)} (4+): play here.`, { len: { [s]: [4, 13] } }, DONT);
    def([...pre, c, '(X)'], 'XX', `Doubled: I am short in ${nm(s)}: please bid your other suit.`, { len: { [s]: [0, 3] } }, DONT);
  }
  for (const s of ['D', 'H', 'S']) def([...pre, '2C', '(X)', 'XX'], s === 'D' ? '2D' : `2${s}`, `My other suit is ${nm(s)}.`, {}, DONT);
  for (const s of ['H', 'S']) def([...pre, '2D', '(X)', 'XX'], `2${s}`, `My major is ${nm(s)}.`, {}, DONT);
  def([...pre, '2D', '(X)', 'XX'], 'P', 'Stay in diamonds (redoubled).', {}, DONT);
  def([...pre, '2H', '(X)', 'XX'], '2S', 'My other major is spades.', {}, DONT);
  def([...pre, '2H', '(X)', 'XX'], 'P', 'Stay in hearts (redoubled).', {}, DONT);
}

export function dont(e, vul = 'none') {
  const h = e.hcp;
  const L = e.len;
  if (h < 10 || h > 15) return R('P', [`${h} HCP: ${h < 10 ? 'too weak: DONT needs 10 or more' : 'defend'}`]);
  const risk = vul === 'we' || vul === 'both' ? ['we are vulnerable: DONT needs a sound hand, because a double costs more'] : vul === 'they' ? ['they are vulnerable: a good time to get in, the risk is low'] : [];
  const sh = (...parts) => [...parts, `${h} HCP: a playing hand (DONT is roughly 10–15)`, ...risk];
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

// ---------- Decisions: our DONT call and partner's replies ----------
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
  const dbl = (c, ...more) => (bal ? { dealer: 'E', calls: ['1N', 'P', 'P', c, 'X', ...more] } : { dealer: 'W', calls: ['1N', c, 'X', ...more] });
  for (const c of ['2C', '2D', '2H']) {
    const s = c[1];
    advise([...pre, c, '(X)'], (e) => (e.len[s] >= 4 ? R('P', [`${e.len[s]} ${nm(s)}: play here, doubled`]) : R('XX', [`only ${e.len[s]} ${nm(s)}: redouble, partner bids the other suit`])), [dbl(c)]);
  }
  advise([...pre, '2C', '(X)', 'XX'], (e) => {
    const s = longestOf(e, ['D', 'H', 'S']);
    return R(`2${s}`, [`my other suit is ${nm(s)}`]);
  }, [dbl('2C', 'XX', 'P')]);
  advise([...pre, '2D', '(X)', 'XX'], (e) => {
    const s = e.len.H >= e.len.S ? 'H' : 'S';
    return e.len[s] >= 4 ? R(`2${s}`, [`my major is ${nm(s)}`]) : R('P', ['stay in diamonds']);
  }, [dbl('2D', 'XX', 'P')]);
  advise([...pre, '2H', '(X)', 'XX'], (e) => (e.len.S > e.len.H ? R('2S', ['spades are longer']) : R('P', ['hearts are as long: stay'])), [dbl('2H', 'XX', 'P')]);
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
