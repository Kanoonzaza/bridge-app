// Pool question 'major-raise', answer 'bergen' (Plan 13, phase 7). Unpassed responder, 4+ trumps:
//   3♣ = 7–9 dummy points · 3♦ = 10–12 (a limit raise) · 3 of the major = 0–6, preemptive.
// Off by a passed hand and in competition (the house rules apply there). Opener: game with enough, else 3 of the major.
import { NAME } from '../../cards.js';
import { respondToMajor } from '../responding/major.js';

const OPT = 'major-raise:bergen';
const RAISE = 'raising-partners-major-tier-0';
// Two context keys: more specific than the SAYC limit raise and the strong jump shift (one key each) on the same calls,
// so on a card with Bergen its meanings win.
const UNPASSED = { responderPassed: false, opened: 'us' };
const R = (call, why) => ({ call, why });
const entries = [];

for (const M of ['H', 'S']) {
  const decide = (e, st) => respondToMajor(e, M, st.ctx.responderPassed, st.sys);
  // Concrete opening and a context: these beat the weak jump shifts' meanings for the same calls.
  for (const [call, meaning, shows] of [
    ['3C', `Bergen: 4+ ${NAME[M]}, 7–9 dummy points.`, { hcp: [5, 9], len: { [M]: [4, 13] } }],
    ['3D', `Bergen: 4+ ${NAME[M]}, 10–12 dummy points (a limit raise).`, { hcp: [7, 12], len: { [M]: [4, 13] } }],
    [`3${M}`, `Bergen: 4+ ${NAME[M]}, 0–6, preemptive.`, { hcp: [0, 6], len: { [M]: [4, 13] } }],
  ]) {
    entries.push({ after: [`1${M}`], ctx: UNPASSED, opt: OPT, call, meaning, shows, notes: RAISE, priority: 9, pick: (e, st) => decide(e, st) === call, why: (e) => [`${e.len[M]} ${NAME[M]}`, `${e.hcp} HCP`] });
  }
  // Opener: over 3♣ game with 15+ (a good 14), over 3♦ game with 14+, over the preemptive raise pass.
  const reply = (after, need, meaning) => {
    const d = (e) => (e.hcp >= need ? R(`4${M}`, [`${e.hcp} HCP: game`]) : R(`3${M}`, [`${e.hcp} HCP: sign off`]));
    for (const call of [`3${M}`, `4${M}`]) {
      entries.push({ after, ctx: UNPASSED, opt: OPT, call, meaning: call[0] === '4' ? 'Game.' : meaning, shows: {}, notes: RAISE, priority: 5, pick: (e) => d(e).call === call, why: (e) => d(e).why });
    }
  };
  reply([`1${M}`, '3C'], 15, 'Sign-off: no game opposite 7–9.');
  reply([`1${M}`, '3D'], 14, 'Sign-off: no game opposite 10–12.');
  entries.push({ after: [`1${M}`, `3${M}`], ctx: UNPASSED, opt: OPT, call: 'P', meaning: 'Pass: partner is weak (preemptive raise).', shows: {}, notes: RAISE, priority: 5, pick: (e) => e.hcp < 19, why: () => ['partner made a preemptive raise'] });
  entries.push({ after: [`1${M}`, `3${M}`], ctx: UNPASSED, opt: OPT, call: `4${M}`, meaning: 'Game: a strong hand.', shows: { hcp: [19, 37] }, notes: RAISE, priority: 5, pick: (e) => e.hcp >= 19, why: (e) => [`${e.hcp} HCP: game anyway`] });
}

export default entries;
