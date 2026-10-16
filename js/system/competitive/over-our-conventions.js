import {
  LEB, SLAM, STRONG, SUITS4, RANK, MAJORS, isMajor, nm, cheapest, top3, stopper, longestOf, R, entries, def, advise,
} from './shared.js';
import { respond1NT } from '../opening/notrump.js';
import { agreedSuit } from '../rebids/slam.js';

// They interfere over our 1NT (Lebensohl; systems on after a double), our strong 2♣ and our 4NT.
// Notes: "Lebensohl", "1NT opening and responses", "Strong 2♣ opening", "RKCB 1430 and slam tools".
// Meanings come first (def: what each call says), then the Advisor's decisions (advise: which call to make).

// ---------- Meanings: their bid or double over our 1NT (Lebensohl; systems on after a double) ----------
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

// ---------- Meanings: they interfere over our 2♣ ----------
def(['2C', '(X)'], 'P', 'Weak (0–3).', { hcp: [0, 3] }, STRONG);
def(['2C', '(X)'], 'XX', 'Some values (4+).', { hcp: [4, 37] }, STRONG);
for (const ov of ['2D', '2H', '2S', '3C', '3D', '3H', '3S']) {
  def(['2C', `(${ov})`], 'P', 'Weak (0–3).', { hcp: [0, 3] }, STRONG);
  def(['2C', `(${ov})`], 'X', 'Some values (4+).', { hcp: [4, 37] }, STRONG);
  for (const s of SUITS4.filter((t) => t !== ov[1])) def(['2C', `(${ov})`], `${cheapest(ov, s)}${s}`, `Natural positive: good 5+ ${nm(s)}.`, { len: { [s]: [5, 13] } }, STRONG);
}

// ---------- Meanings: they interfere over our 4NT (RKCB) ----------
const agreed = (cut) => (key) => agreedSuit(key.slice(0, key.length - cut)) !== null;
entries.push(
  { tail: true, after: ['4N', '(X)'], call: 'XX', meaning: 'RKCB after their double: 0 or 3 key cards.', shows: {}, notes: SLAM, when: agreed(2) },
  { tail: true, after: ['4N', '(X)'], call: 'P', meaning: 'RKCB after their double: 1 or 4 key cards.', shows: {}, notes: SLAM, when: agreed(2) },
  { tail: true, after: ['4N', '(5x)'], call: 'X', meaning: 'RKCB after their bid: 0 or 3 key cards.', shows: {}, notes: SLAM, when: agreed(2) },
  { tail: true, after: ['4N', '(5x)'], call: 'P', meaning: 'RKCB after their bid: 1 or 4 key cards.', shows: {}, notes: SLAM, when: agreed(2) },
);

// ---------- Decisions: responder after our 1NT and their natural 2-level overcall (Lebensohl) ----------
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
  // Sitting over the overcall with length: their suit is breaking badly for them, so the double pays (measured double dummy).
  if (L[y] >= 4 && h >= 5) return R('X', [`${L[y]} ${nm(y)} behind the overcaller: penalty (their suit will not break)`]);
  if (L[y] === 3 && h >= 8 && h <= 9 && !five.length) return R('X', [`${h} HCP and 3 ${nm(y)} behind the overcaller, no suit of our own: double`]);
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

// ---------- Decisions: opener's answers after Lebensohl ----------
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
    else def(k, `4${x}`, `No ${nm(y)} stopper: raise the minor.`, { len: { [x]: [2, 13] } }, LEB);
    def(k, '3N', `A stopper in ${nm(y)}: 3NT.`, {}, LEB);
    advise(k, (e) => openerAfterGameForce(e, y, x), [{ dealer: 'N', calls: ['1N', `2${y}`, `3${x}`, 'P'] }]);
  }
}
