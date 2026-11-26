// Responding to a 1-level suit opening: the pool's options the house card does not play. Plan 13, tasks 4.1, 4.3,
// 4.5, 4.6. The responses themselves are decided by the house decision functions (respondToMajor / respondToMinor,
// which ask the card); this file adds what those calls mean on such a card, and opener's next bid.
//   passed-2c:natural     a passed hand's 2♣ over 1♥/1♠ = clubs, 10–11; the passed limit raise is 3M with 3+ trumps
//   minor-raise:standard  2m = 6–10, 3m = 10–12 (limit), no 4-card major
//   minor-2nt:forcing     1m–2NT = 13–15 balanced, game forcing; 1m–3NT = 16–18
//   jump-shift:strong     a jump in a new suit = 17+, game forcing, slam interest
import { SUITS, NAME, SYMBOL } from '../../cards.js';
import { respondToMajor, strongJump } from '../responding/major.js';
import { respondToMinor } from '../responding/minor.js';
import { passedNewSuitSituation } from '../rebids/opener.js';

const RESP = 'responding-to-1-1-tier-0';
const RAISE = 'raising-partners-major-tier-0';
const GF = '21-game-forcing-tier-0';
const UNPASSED = { responderPassed: false };
const PASSED = { responderPassed: true };
const RANK = { C: 0, D: 1, H: 2, S: 3, N: 4 };
const R = (call, why) => ({ call, why });
const stopped = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3);
// The cheapest bid of strain s over the bid `last`.
const over = (last, s) => `${Number(last[0]) + (RANK[s] > RANK[last[1]] ? 0 : 1)}${s}`;

const entries = [];
// One situation: after, ctx, opt, calls { call: [meaning, shows, notes] }, decide(e, st) -> R(call, why).
function situation(after, ctx, opt, calls, decide) {
  for (const [call, [meaning, shows = {}, notes = RESP]] of Object.entries(calls)) {
    entries.push({
      after, ...(ctx ? { ctx } : {}), opt, call, meaning, shows, notes, priority: 10,
      pick: (e, st) => decide(e, st).call === call,
      why: (e, st) => decide(e, st).why,
    });
  }
}
// A response decided by the house decision function (which reads the card from st.sys).
const response = (after, ctx, opt, call, meaning, shows, notes, decideCall) => entries.push({
  after, ...(ctx ? { ctx } : {}), opt, call, meaning, shows, notes, priority: 10,
  pick: (e, st) => decideCall(e, st) === call,
  why: (e) => [`${e.hcp} HCP`],
});
const majorCall = (e, st) => respondToMajor(e, st.key[0][1], st.ctx.responderPassed, st.sys);
const minorCall = (e, st) => respondToMinor(e, st.key[0][1], st.ctx.responderPassed, st.sys);

// ---------- passed-2c:natural ----------
{
  const OPT = 'passed-2c:natural';
  for (const M of ['H', 'S']) {
    response([`1${M}`], PASSED, OPT, '2C', 'Passed hand: natural, 5+ clubs, about 10–11. Not forcing.', { hcp: [10, 12], len: { C: [5, 13] } }, GF, majorCall);
    response([`1${M}`], PASSED, OPT, `3${M}`, `Passed-hand limit raise: 3+ ${NAME[M]}, 10–11 dummy points. Invites game.`, { hcp: [7, 12], len: { [M]: [3, 13] } }, RAISE, majorCall);
    const sit = passedNewSuitSituation(M, 'C');
    situation(sit.after, sit.ctx, OPT, Object.fromEntries(Object.entries(sit.calls).map(([c, v]) => [c, [v.meaning, v.shows, v.notes]])), (e, st) => sit.decide(e, st));
    // Responder (a passed hand) after opener's minimum rebid of the major: nothing more to say.
    situation([`1${M}`, '2C', `2${M}`], PASSED, OPT, { P: ['Content: no game opposite a minimum.', {}, GF] }, () => R('P', ['opener has a minimum: pass']));
  }
}

// ---------- minor-raise:standard ----------
{
  const OPT = 'minor-raise:standard';
  for (const m of ['C', 'D']) {
    const n = m === 'C' ? 5 : 4;
    response([`1${m}`], null, OPT, `2${m}`, `Simple raise: 6–10 HCP, ${n}+ ${NAME[m]}, no 4-card major. Not forcing.`, { hcp: [6, 10], len: { [m]: [n, 13], H: [0, 3], S: [0, 3] } }, RESP, minorCall);
    response([`1${m}`], null, OPT, `3${m}`, `Limit raise: 10–12 HCP, 5+ ${NAME[m]}, no 4-card major. Invites game.`, { hcp: [10, 12], len: { [m]: [5, 13], H: [0, 3], S: [0, 3] } }, RESP, minorCall);
    // Opener after the simple raise.
    const sides = SUITS.filter((s) => s !== m && RANK[s] > RANK[m]);
    situation([`1${m}`, `2${m}`], null, OPT, {
      P: ['Minimum: content.', { hcp: [12, 15] }],
      '2N': ['18–19 balanced: invites 3NT.', { hcp: [18, 19], balanced: true }],
      [`3${m}`]: [`16–17 with 6+ ${NAME[m]}: invites game.`, { hcp: [16, 17], len: { [m]: [6, 13] } }],
      '3N': ['20–21: to play.', { hcp: [20, 21] }],
      ...Object.fromEntries(sides.map((s) => [`2${s}`, [`16+, 4+ ${NAME[s]} (a stopper there): game try, forcing one round.`, { hcp: [16, 37], len: { [s]: [4, 13] }, force: 'round' }]])),
    }, (e) => {
      const h = e.hcp;
      if (h <= 15) return R('P', [`${h} HCP opposite 6–10: no game`]);
      if (h >= 20) return R('3N', [`${h} HCP: game`]);
      if (e.balanced) return R('2N', [`${h} HCP, balanced: invite 3NT`]);
      if (e.len[m] >= 6 && h <= 17) return R(`3${m}`, [`${e.len[m]} ${NAME[m]}, ${h} HCP: invite`]);
      const s = sides.filter((t) => e.len[t] >= 4).sort((a, b) => e.len[b] - e.len[a])[0];
      return s ? R(`2${s}`, [`${e.len[s]} ${NAME[s]}, ${h} HCP: show where your values are`]) : R('2N', [`${h} HCP: invite 3NT`]);
    });
    situation([`1${m}`, `2${m}`, '2N'], null, OPT, {
      P: ['6–7: no game.', { hcp: [6, 7] }],
      '3N': ['8–10: accept.', { hcp: [8, 10] }],
    }, (e) => (e.hcp >= 8 ? R('3N', [`${e.hcp} HCP: accept`]) : R('P', [`${e.hcp} HCP: decline`])));
    situation([`1${m}`, `2${m}`, `3${m}`], null, OPT, {
      P: ['Minimum: no game.', {}],
      '3N': ['Maximum with the other suits stopped: 3NT.', { hcp: [9, 10] }],
      [`5${m}`]: ['Maximum, a suit unstopped: game in the minor.', { hcp: [9, 10] }],
    }, (e) => (e.hcp <= 8 ? R('P', [`${e.hcp} HCP: decline`]) : SUITS.filter((s) => s !== m).every((s) => stopped(e, s)) ? R('3N', ['maximum, stoppers: 3NT']) : R(`5${m}`, ['maximum: game in the minor'])));
    // Responder after opener's game try in a new suit: 3NT with the unbid suits stopped and a maximum, else 3m.
    for (const t of sides) {
      const unbid = SUITS.filter((u) => u !== m && u !== t);
      situation([`1${m}`, `2${m}`, `2${t}`], null, OPT, {
        [`3${m}`]: ['Minimum (6–8), or a suit unstopped: no game.', {}],
        '3N': ['Maximum (9–10) with the unbid suits stopped.', { hcp: [9, 10] }],
      }, (e) => (e.hcp >= 9 && unbid.every((u) => stopped(e, u)) ? R('3N', [`${e.hcp} HCP with ${unbid.map((u) => NAME[u]).join(' and ')} stopped`]) : R(`3${m}`, [e.hcp >= 9 ? 'a suit unstopped' : `${e.hcp} HCP: minimum`])));
    }
    // Opener after the limit raise.
    situation([`1${m}`, `3${m}`], null, OPT, {
      P: ['Minimum: decline.', { hcp: [12, 13] }],
      '3N': ['14+ with the other suits stopped (or balanced): 3NT.', { hcp: [14, 37] }],
      [`5${m}`]: ['14+, unbalanced: game in the minor.', { hcp: [14, 37] }],
    }, (e) => (e.hcp <= 13 ? R('P', [`${e.hcp} HCP: decline the invitation`]) : e.balanced || SUITS.filter((s) => s !== m).every((s) => stopped(e, s)) ? R('3N', [`${e.hcp} HCP: 3NT`]) : R(`5${m}`, [`${e.hcp} HCP, unbalanced: game in the minor`])));
  }
}

// ---------- minor-2nt:forcing ----------
{
  const OPT = 'minor-2nt:forcing';
  for (const m of ['C', 'D']) {
    response([`1${m}`], null, OPT, '2N', '13–15 HCP, balanced, no 4-card major. Game forcing.', { hcp: [13, 15], balanced: true, force: 'game' }, RESP, minorCall);
    response([`1${m}`], null, OPT, '3N', '16–18 HCP, balanced, no 4-card major.', { hcp: [16, 18], balanced: true }, RESP, minorCall);
    const sides = SUITS.filter((s) => s !== m);
    situation([`1${m}`, '2N'], null, OPT, {
      '3N': ['Minimum, balanced: to play.', {}],
      [`3${m}`]: [`6+ ${NAME[m]}: shows the suit, slam possible.`, { len: { [m]: [6, 13] } }],
      '4N': ['18–19 balanced: invites 6NT.', { hcp: [18, 19] }],
      ...Object.fromEntries(sides.map((s) => [`3${s}`, [`4+ ${NAME[s]}, unbalanced: natural.`, { len: { [s]: [4, 13] } }]])),
    }, (e) => {
      if (e.balanced) return e.hcp >= 18 ? R('4N', [`${e.hcp} HCP opposite 13–15: invite 6NT`]) : R('3N', [`${e.hcp} HCP, balanced: 3NT`]);
      if (e.len[m] >= 6) return R(`3${m}`, [`${e.len[m]} ${NAME[m]}`]);
      const s = sides.filter((t) => e.len[t] >= 4).sort((a, b) => e.len[b] - e.len[a])[0];
      return s ? R(`3${s}`, [`${e.len[s]} ${NAME[s]}: show the second suit`]) : R('3N', ['3NT']);
    });
    situation([`1${m}`, '3N'], null, OPT, {
      P: ['To play.', {}],
      '6N': ['16+: small slam (32+ between us).', { hcp: [16, 37] }],
    }, (e) => (e.hcp >= 16 ? R('6N', [`${e.hcp} HCP opposite 16–18: slam`]) : R('P', ['partner placed the contract'])));
  }
}

// ---------- jump-shift:strong ----------
{
  const OPT = 'jump-shift:strong';
  const JUMPS = { H: { S: '2S', C: '3C', D: '3D' }, S: { C: '3C', D: '3D', H: '3H' }, C: { D: '2D', H: '2H', S: '2S' }, D: { H: '2H', S: '2S', C: '3C' } };
  for (const [o, table] of Object.entries(JUMPS)) {
    for (const [s, js] of Object.entries(table)) {
      const decideCall = o === 'H' || o === 'S' ? majorCall : minorCall;
      response([`1${o}`], UNPASSED, OPT, js, `Strong jump shift: 17+, a good 5+ ${NAME[s]} (or ${NAME[o]} support), game forcing, slam interest.`, { hcp: [17, 37], len: { [s]: [5, 13] }, force: 'game' }, GF, decideCall);
      // Opener's rebid: raise, rebid a 6-card suit, notrump, or a new suit. Everything is forcing to game.
      const nt = over(js, 'N');
      const raise = over(js, s); // the same strain: one level up
      const own = over(js, o);
      const others = SUITS.filter((t) => t !== o && t !== s);
      const calls = {
        [raise]: [`Support: ${s === 'H' || s === 'S' ? 3 : 4}+ ${NAME[s]}.`, { len: { [s]: [3, 13] }, force: 'game' }],
        [own]: [`6+ ${NAME[o]}.`, { len: { [o]: [6, 13] }, force: 'game' }],
        [nt]: ['Balanced: no fit yet.', { balanced: true, force: 'game' }],
        ...Object.fromEntries(others.map((t) => [over(js, t), [`4+ ${NAME[t]}: natural.`, { len: { [t]: [4, 13] }, force: 'game' }]])),
      };
      // A passed hand's fit jump (or anything else) is not this: opener passes, as on the house card.
      situation([`1${o}`, js], PASSED, OPT, { P: ['Content: partner is a passed hand.', {}, GF] }, () => R('P', ['partner is a passed hand: no game']));
      situation([`1${o}`, js], UNPASSED, OPT, calls, (e) => {
        if (e.len[s] >= (s === 'H' || s === 'S' ? 3 : 4)) return R(raise, [`${e.len[s]} ${NAME[s]}: support partner's suit`]);
        if (e.len[o] >= 6) return R(own, [`${e.len[o]} ${NAME[o]}`]);
        if (e.balanced) return R(nt, ['balanced: notrump']);
        const t = others.filter((x) => e.len[x] >= 4).sort((a, b) => e.len[b] - e.len[a])[0];
        return t ? R(over(js, t), [`${e.len[t]} ${NAME[t]}`]) : R(nt, ['no fit and no second suit: notrump']);
      });
    }
  }
}

void SYMBOL; void strongJump;
export default entries;
