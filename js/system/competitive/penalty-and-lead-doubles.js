import {
  SUITS4, nm, goodSuit, R, entries, def, advise,
} from './shared.js';
import { plays } from '../../pool/answers.js';

// Pool question 'slam-doubles' (js/pool/catalog.js): the doubles are tagged 'slam-doubles:lead' (js/pool/tags.js);
// the passes are plain bridge on every card (opt: null). With 'penalty', the decisions do not make these doubles.
const leading = (st) => plays(st?.sys, 'slam-doubles', 'lead');

// Doubles that are not takeout: lead-directing doubles of their artificial bids, the maximal double,
// and the Lightner double of their slam. Notes: "Competitive judgment" and "Defense".
// Meanings come first (def: what each call says), then the Advisor's decisions (advise: which call to make).

// ---------- Lead-directing doubles (proposed): their Stayman and transfers over their notrump ----------
for (const [nt, arts] of [['1N', ['2C', '2D', '2H']], ['2N', ['3C', '3D', '3H']]]) {
  for (const a of arts) {
    const k = [`(${nt})`, 'P', `(${a})`];
    def(k, 'X', `Lead-directing: a good ${nm(a[1])} suit, please lead it.`, { len: { [a[1]]: [4, 13] } }, 'lead-directing-doubles');
    def(k, 'P', 'Pass.', {}, 'lead-directing-doubles', { opt: null });
    advise(k, (e, st) => (leading(st) && goodSuit(e, a[1]) ? R('X', [`good ${nm(a[1])}: ask partner to lead it`]) : R('P', [leading(st) ? 'no lead to suggest: pass' : 'pass']))
      , [{ dealer: 'W', calls: [nt, 'P', a] }]);
    for (const en of entries) if (JSON.stringify(en.after) === JSON.stringify(k) && en.call === 'P' && en.opt === null) {
      const decide = (e, st) => (leading(st) && goodSuit(e, a[1]) ? 'X' : 'P');
      en.priority = 10;
      en.pick = (e, st) => decide(e, st) === 'P';
      en.why = (e, st) => [leading(st) ? 'no lead to suggest: pass' : 'pass'];
    }
  }
}
// Lead-directing double of their RKCB reply.
entries.push(...SUITS4.map((s) => ({
  tail: true, after: ['(4N)', 'P', `(5${s})`], call: 'X', notes: 'lead-directing-doubles', meaning: `Lead-directing: lead ${nm(s)}.`, shows: { len: { [s]: [4, 13] } },
})));

// ---------- Maximal double (proposed): we agreed a suit and they bid the suit just below ours at the 3-level ----------
const BELOW = { S: 'H', H: 'D', D: 'C' };
for (const [o, them] of [['H', 'D'], ['S', 'H'], ['H', 'C'], ['S', 'C'], ['S', 'D']]) {
  for (const k of [[`1${o}`, `(2${them})`, `2${o}`, `(3${them})`], [`1${o}`, `2${o}`, `(3${them})`]]) {
    const maximal = BELOW[o] === them;
    def(k, 'X', maximal ? `Maximal double: a game try in ${nm(o)} (no room for anything else).` : 'Penalty: they have no fit and we have the values.', {}, 'competing-at-the-3-level');
    def(k, `3${o}`, maximal ? 'Competitive only: not a game try.' : 'Competing (or a mild invitation).', {}, 'competing-at-the-3-level');
    def(k, `4${o}`, 'Game.', {}, 'competing-at-the-3-level');
    def(k, 'P', 'Pass: content to defend.', {}, 'competing-at-the-3-level');
  }
}

// ---------- Lightner double (proposed): their freely bid slam; asks for an unusual lead (usually to get a ruff) ----------
export function lightner(e, x, st = null) {
  if (!leading(st)) return R('P', ['pass']);
  const voids = SUITS4.filter((s) => s !== x && e.len[s] === 0);
  const aces = SUITS4.filter((s) => e.hand[s].includes('A')).length;
  return voids.length && aces >= 1 ? R('X', [`void in ${nm(voids[0])} and an ace: ask for an unusual lead`]) : R('P', ['no Lightner double: pass']);
}
for (const lv of [6, 7]) {
  for (const x of SUITS4) {
    for (const after of [[`(${lv}${x})`], [`(${lv}${x})`, 'P']]) {
      for (const call of ['X', 'P']) {
        entries.push({
          tail: true, after, call, variant: `${lv}${x}`, notes: 'lightner-double', shows: {}, priority: 10, ...(call === 'P' ? { opt: null } : {}),
          meaning: call === 'X' ? 'Lightner double: do not lead our suit; make an unusual lead (often dummy\'s first suit). (Proposed.)' : 'Pass.',
          when: (key) => key.some((t) => t.startsWith('(')) && !key.some((t) => !t.startsWith('(') && /^[67]/.test(t)),
          pick: (e, st) => lightner(e, x, st).call === call,
          why: (e, st) => lightner(e, x, st).why,
        });
      }
    }
  }
}
