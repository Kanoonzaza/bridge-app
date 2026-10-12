import { NAME } from '../cards.js';
import { agreedSuit } from './slam.js';

// Decoder meanings for contested auctions (no advisor picks). Opponents' calls appear in brackets in the key.
const COMP = 'competitive-bidding-tier-0';
const DONT = 'dont-against-their-1nt-tier-1';
const JORDAN = 'jordan-2nt-tier-1';
const SUPPORT = 'support-doubles-and-redoubles-tier-2';
const LEB = 'lebensohl-tier-2';
const SLAM = 'rkcb-1430-and-slam-tools-tier-1';
const STRONG = 'strong-2-opening-tier-2';
const DRURY = 'drury-tier-1';

const SUITS4 = ['C', 'D', 'H', 'S'];
const RANK = { C: 0, D: 1, H: 2, S: 3, N: 4 };
const MAJORS = ['H', 'S'];
const isMajor = (s) => s === 'H' || s === 'S';
const cap = (t) => t[0].toUpperCase() + t.slice(1);
const nm = (s) => NAME[s];
// Cheapest level at which suit s can be bid over the bid `last` (e.g. '1H').
const cheapest = (last, s) => Number(last[0]) + (RANK[s] > RANK[last[1]] ? 0 : 1);
const above = (a, b) => (Number(a[0]) - Number(b[0])) * 5 + RANK[a[1]] - RANK[b[1]] > 0;

const entries = [];
const def = (after, call, meaning, shows = {}, notes = COMP, extra = {}) => {
  if (entries.some((e) => !e.tail && JSON.stringify(e.after) === JSON.stringify(after) && e.call === call && JSON.stringify(e.ctx ?? {}) === JSON.stringify(extra.ctx ?? {}))) return;
  entries.push({ after, call, meaning, shows, notes, ...extra });
};

// ---------- A. Overcalling their 1-level suit opening (direct, and balancing after two passes) ----------
for (const x of SUITS4) {
  for (const balancing of [false, true]) {
    const k = balancing ? [`(1${x})`, 'P'] : [`(1${x})`];
    def(k, 'X', balancing ? `Takeout (balancing): short in ${nm(x)}, can be lighter (about 9+).` : `Takeout: short in ${nm(x)}, support for the unbid suits, 12+; or any 17+.`, { hcp: [balancing ? 9 : 12, 37] });
    def(k, '1N', balancing ? `Balancing 1NT: 11–14 balanced with a ${nm(x)} stopper.` : `15–18 balanced with a ${nm(x)} stopper. Systems on.`, { hcp: balancing ? [11, 14] : [15, 18], balanced: true });
    for (const s of SUITS4.filter((t) => t !== x)) {
      const lv = cheapest(`1${x}`, s);
      def(k, `${lv}${s}`, lv === 1 ? `Overcall: 5+ ${nm(s)}, 8–16.` : `Overcall: good 5+ ${nm(s)} (usually 6), 11–16.`, { hcp: lv === 1 ? [8, 16] : [11, 16], len: { [s]: [5, 13] } });
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

// ---------- B. DONT against their 1NT ----------
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
}

// ---------- C. Their weak two and 3-level preempts ----------
for (const x of ['D', 'H', 'S']) {
  for (const k of [[`(2${x})`], [`(2${x})`, 'P']]) {
    def(k, 'X', `Takeout: opening values, short in ${nm(x)}.`, { hcp: [12, 37] });
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

// ---------- D. Advancing partner's overcall; E. advancing a takeout double, Michaels, Unusual 2NT ----------
for (const x of SUITS4) {
  for (const y of SUITS4.filter((t) => t !== x)) {
    const ov = `${cheapest(`1${x}`, y)}${y}`;
    const k = [`(1${x})`, ov];
    const lv = Number(ov[0]);
    def(k, `${lv + 1}${y}`, `Raise: 6–9, 3+ ${nm(y)}.`, { hcp: [6, 9], len: { [y]: [3, 13] } });
    def(k, `${lv + 2}${y}`, `Preemptive jump raise: weak, 4+ ${nm(y)}.`, { len: { [y]: [4, 13] } });
    const cue = `${cheapest(ov, x)}${x}`;
    def(k, cue, `Cue-bid: 10+ with ${nm(y)} support (limit raise or better).`, { hcp: [10, 37], len: { [y]: [3, 13] }, force: 'round' });
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
  // Michaels and Unusual 2NT
  const m = [`(1${x})`, `2${x}`];
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
  for (const s of low) def([`(1${x})`, '2N'], `3${s}`, `Prefers ${nm(s)}: to play.`);
}

// ---------- F. We opened and they overcalled: negative double and responder's bids ----------
function negativeDouble(o, ov) {
  const y = ov[1];
  const lv = Number(ov[0]);
  const unbid = MAJORS.filter((s) => s !== o && s !== y);
  const min = lv === 1 ? 6 : lv === 2 ? 8 : 10;
  let shape;
  if (unbid.length === 2) shape = lv === 1 ? 'both majors, at least 4-4 (bid 1♥/1♠ with only one major)' : 'both majors, or one major without the strength to bid it at this level';
  else if (unbid.length === 1) {
    const u = unbid[0];
    if (lv === 1 && u === 'S') shape = 'exactly 4 spades (1♠ would show 5+)';
    else if (lv === 1 && u === 'H') shape = '4+ hearts (2♥ would show 5+ hearts and 10+)';
    else shape = `4 ${nm(u)} plus the other unbid suit, or a hand with values and no good bid`;
  } else shape = 'both minors, or a hand with values and no good bid';
  // The majors it promises: both at the 1-level, or the one unbid major.
  const len = unbid.length === 2 && lv === 1 ? { H: [4, 13], S: [4, 13] } : unbid.length === 1 ? { [unbid[0]]: [4, 13] } : undefined;
  return [`Negative double: ${shape}. ${min}+ HCP.`, len ? { hcp: [min, 37], len } : { hcp: [min, 37] }];
}

for (const o of SUITS4) {
  for (const y of SUITS4.filter((t) => t !== o)) {
    for (let lv = cheapest(`1${o}`, y); lv <= 3; lv++) {
      const ov = `${lv}${y}`;
      const k = [`1${o}`, `(${ov})`];
      const [neg, shows] = negativeDouble(o, ov);
      def(k, 'X', neg, shows);
      const r = cheapest(ov, o);
      if (r <= 4) {
        def(k, `${r}${o}`, `Simple raise: 6–9${isMajor(o) ? '' : ' (inverted minors are off)'}.`, { hcp: [6, 9], len: { [o]: [isMajor(o) ? 3 : 4, 13] } });
        if (r + 1 <= 4) def(k, `${r + 1}${o}`, `Preemptive jump raise: 4+ ${nm(o)}, weak.`, { len: { [o]: [4, 13] } });
      }
      def(k, `${lv + 1}${y}`, `Cue-bid: limit raise or better in ${nm(o)} (10+).`, { hcp: [10, 37], len: { [o]: [3, 13] }, force: 'round' });
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
  for (const y of SUITS4.filter((t) => t !== o)) {
    for (let lv = cheapest(`1${o}`, y); lv <= 3; lv++) {
      const ov = `${lv}${y}`;
      const k = [`1${o}`, `(${ov})`, 'X'];
      def(k, 'P', `Penalty pass: a trump stack in ${nm(y)}.`, { len: { [y]: [4, 13] } });
      for (const u of MAJORS.filter((t) => t !== o && t !== y)) {
        const ul = cheapest(ov, u);
        def(k, `${ul}${u}`, `4 ${nm(u)}, minimum (12–14).`, { hcp: [12, 14], len: { [u]: [4, 13] } });
        if (ul + 1 <= 4) def(k, `${ul + 1}${u}`, `4 ${nm(u)}, 15–17: invitational jump.`, { hcp: [15, 17], len: { [u]: [4, 13] } });
      }
      def(k, `${lv + 1}${y}`, 'Cue-bid: a big hand (18+), forcing.', { hcp: [18, 37], force: 'round' });
      if (lv === 1) def(k, '1N', `12–14 balanced with a ${nm(y)} stopper.`, { hcp: [12, 14], balanced: true });
      const ol = cheapest(ov, o);
      if (ol <= 3) def(k, `${ol}${o}`, `6+ ${nm(o)}, minimum, no 4-card unbid major.`, { hcp: [12, 15], len: { [o]: [6, 13] } });
    }
  }
  // G. They doubled our opening.
  const k = [`1${o}`, '(X)'];
  def(k, 'XX', '10+ HCP, usually no fit: plans to double them or show a suit.', { hcp: [10, 37] });
  def(k, `2${o}`, `Weak raise: 6–9.`, { hcp: [6, 9], len: { [o]: [isMajor(o) ? 3 : 4, 13] } });
  def(k, '2N', `Jordan 2NT: ${isMajor(o) ? '4+' : '5+'} ${nm(o)}, limit raise or better.`, { hcp: [10, 37], len: { [o]: [isMajor(o) ? 4 : 5, 13] } }, JORDAN);
  def(k, `3${o}`, `Preemptive raise: 4+ ${nm(o)}, weak.`, { len: { [o]: [4, 13] } });
  for (const s of SUITS4.filter((t) => t !== o)) {
    const lv = cheapest(`1${o}`, s);
    if (lv === 1) def(k, `1${s}`, `Natural: 4+ ${nm(s)}, forcing.`, { len: { [s]: [4, 13] }, force: 'round' });
    else if (!(s === 'C' && isMajor(o))) def(k, `2${s}`, `Natural: 5+ ${nm(s)}, weak, not forcing.`, { len: { [s]: [5, 13] } });
  }
  if (isMajor(o)) {
    def(k, '2C', 'Natural: 5+ clubs, weak, not forcing.', { len: { C: [5, 13] } }, COMP, { ctx: { responderPassed: false } });
    def(k, '2C', `Drury: 3-card ${nm(o)} support, 10–11 (Jordan 2NT shows 4).`, { len: { [o]: [3, 3] } }, DRURY, { ctx: { responderPassed: true } });
  }
}

// ---------- H. Support doubles and redoubles ----------
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

// ---------- I. Interference over our 1NT: Lebensohl, systems on after a double ----------
for (const y of SUITS4) {
  const k = ['1N', `(2${y})`];
  def(k, 'X', 'Penalty.', {}, LEB);
  def(k, '2N', 'Lebensohl relay: opener must bid 3♣.', {}, LEB);
  def(k, `3${y}`, `Cue-bid: Stayman for an unbid major, no ${nm(y)} stopper.`, { force: 'game' }, LEB);
  def(k, '3N', `To play, no ${nm(y)} stopper.`, {}, LEB);
  for (const s of SUITS4.filter((t) => t !== y)) {
    if (RANK[s] > RANK[y]) def(k, `2${s}`, `Natural: 5+ ${nm(s)}, to play (competitive).`, { len: { [s]: [5, 13] } }, LEB);
    def(k, `3${s}`, `Game forcing: 5+ ${nm(s)}.`, { len: { [s]: [5, 13] }, force: 'game' }, LEB);
  }
  def(['1N', `(2${y})`, '2N'], '3C', 'Forced.', {}, LEB);
  const after = ['1N', `(2${y})`, '2N', '3C'];
  if (y !== 'C') def(after, 'P', 'To play in clubs.', {}, LEB);
  def(after, '3N', `To play, with a ${nm(y)} stopper.`, {}, LEB);
  if (y !== 'C') def(after, `3${y}`, `Stayman, with a ${nm(y)} stopper.`, {}, LEB);
  for (const s of ['D', 'H', 'S'].filter((t) => t !== y)) def(after, `3${s}`, RANK[s] < RANK[y] ? 'To play.' : `Invitational: 5+ ${nm(s)}.`, { len: { [s]: [5, 13] } }, LEB);
}
def(['1N', '(X)'], 'XX', 'We have the balance of strength (about 9+).', { hcp: [9, 37] });
def(['1N', '(X)'], '2C', 'Stayman (systems on).');
def(['1N', '(X)'], '2D', 'Transfer: 5+ hearts (systems on).', { len: { H: [5, 13] } });
def(['1N', '(X)'], '2H', 'Transfer: 5+ spades (systems on).', { len: { S: [5, 13] } });

// ---------- K. They interfere over our 2♣ ----------
def(['2C', '(X)'], 'P', 'Weak (0–3).', { hcp: [0, 3] }, STRONG);
def(['2C', '(X)'], 'XX', 'Some values (4+).', { hcp: [4, 37] }, STRONG);
for (const ov of ['2D', '2H', '2S', '3C', '3D', '3H', '3S']) {
  def(['2C', `(${ov})`], 'P', 'Weak (0–3).', { hcp: [0, 3] }, STRONG);
  def(['2C', `(${ov})`], 'X', 'Some values (4+).', { hcp: [4, 37] }, STRONG);
  for (const s of SUITS4.filter((t) => t !== ov[1])) def(['2C', `(${ov})`], `${cheapest(ov, s)}${s}`, `Natural positive: good 5+ ${nm(s)}.`, { len: { [s]: [5, 13] } }, STRONG);
}

// ---------- J. They interfere over our 4NT (RKCB) ----------
const agreed = (cut) => (key) => agreedSuit(key.slice(0, key.length - cut)) !== null;
entries.push(
  { tail: true, after: ['4N', '(X)'], call: 'XX', meaning: 'RKCB after their double: 0 or 3 key cards.', shows: {}, notes: SLAM, when: agreed(2) },
  { tail: true, after: ['4N', '(X)'], call: 'P', meaning: 'RKCB after their double: 1 or 4 key cards.', shows: {}, notes: SLAM, when: agreed(2) },
  { tail: true, after: ['4N', '(5x)'], call: 'X', meaning: 'RKCB after their bid: 0 or 3 key cards.', shows: {}, notes: SLAM, when: agreed(2) },
  { tail: true, after: ['4N', '(5x)'], call: 'P', meaning: 'RKCB after their bid: 1 or 4 key cards.', shows: {}, notes: SLAM, when: agreed(2) },
);

export default entries;
export { def, cheapest, above };
