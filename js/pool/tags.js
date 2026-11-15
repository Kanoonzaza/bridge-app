// Which option of the pool each rule that existed before the pool belongs to. Rules written since set `opt`
// themselves. A rule with no tag is core: every card plays it.
//
// Tags come from three places, strongest first:
//   1. the rule's own `opt`;
//   2. roots: rules that make a conventional call (a 2/1 response, a splinter, a Texas transfer, ...) and every
//      later rule of the same auction (its descendants), because their meaning depends on that call;
//      a 2/1 root beats every other root: the whole auction after it is part of the 2/1 base;
//   3. the notes section of the rule (for sections that hold one convention only).
// `tools/tags.mjs` prints the result for review; tests/pool-tags.test.js freezes the counts.
import { option, splitOpt } from './catalog.js';

const RANK = { C: 0, D: 1, H: 2, S: 3, N: 4 };
const SETS = { M: ['H', 'S'], m: ['C', 'D'], x: ['C', 'D', 'H', 'S'], O: ['H', 'S'], n: ['C', 'D'] };
const strains = (ch) => SETS[ch] ?? [ch];
const ours = (t) => !t.startsWith('(');
const isSuitBid = (t) => /^[1-7][CDHSMmxOn]$/.test(t);

// Sections that hold one option only.
export const SECTIONS = {
  'drury-tier-1': 'passed-2c:drury',
  'passed-hand-jump-shifts': 'passed-jump:fit',
  'inverted-minor-raises-tier-1': 'minor-raise:inverted',
  'smolen-tier-2': 'smolen:on',
  'xyz-tier-1': 'checkback:xyz',
  'fourth-suit-forcing-tier-1': 'fourth-suit:gf',
  'dont-against-their-1nt-tier-1': 'nt-defence:dont',
  'lebensohl-tier-2': 'nt-interference:lebensohl',
  'support-doubles-and-redoubles-tier-2': 'support-doubles:on',
  'support-doubles-after-their-overcall': 'support-doubles:on',
  'responsive-doubles': 'responsive:on',
  'leaping-michaels': 'weak-two-defence:leaping',
  'lead-directing-doubles': 'slam-doubles:lead',
  'lightner-double': 'slam-doubles:lead',
};

const SLAM = 'rkcb-1430-and-slam-tools-tier-1';
const unpassed = (e) => e.ctx?.responderPassed === false;
const passed = (e) => e.ctx?.responderPassed === true;
const first = (e) => (e.after.length === 1 && ours(e.after[0]) && /^1[CDHSMmx]$/.test(e.after[0]) ? e.after[0] : null);

// A non-jump new suit at the 2-level, lower than opener's suit, by an unpassed responder.
function twoOverOne(e) {
  const op = first(e);
  if (!op || !unpassed(e) || !/^2[CDHSMmx]$/.test(e.call)) return false;
  return strains(op[1]).every((o) => strains(e.call[1]).every((r) => RANK[r] < RANK[o]));
}
const forcingNT = (e) => Boolean(first(e)) && /^1[HSM]$/.test(first(e)) && e.call === '1N' && unpassed(e);

// Root rules: [opt, test]. The first test that accepts a rule names its root option.
export const ROOTS = [
  ['base:2/1', (e) => twoOverOne(e) || forcingNT(e)],
  ['splinters:on', (e) => /^Splinter/.test(e.meaning)],
  ['jump-shift:weak', (e) => /^Weak jump shift/.test(e.meaning)],
  ['passed-jump:fit', (e) => /^Fit-showing jump/.test(e.meaning) && passed(e)],
  ['texas:on', (e) => /^Texas/.test(e.meaning)],
  ['nt-2s:puppet', (e) => /^Minor puppet/.test(e.meaning)],
  ['weak-two-ask:ogust', (e) => /^Ogust/.test(e.meaning)],
  ['minor-2nt:invite', (e) => e.notes === 'responding-to-1-1-tier-0' && first(e) === '1m' && (e.call === '2N' || e.call === '3N')],
  ['keycard:rkcb-1430', (e) => e.tail && e.notes === SLAM && (e.after[0] === '4N' || (e.after.length === 0 && e.call === '4N'))],
];

// Is token t covered by root token r (every strain t may stand for is one r may stand for)?
function covers(r, t) {
  if (r === t) return true;
  if (ours(r) !== ours(t)) return false;
  const a = ours(r) ? r : r.slice(1, -1);
  const b = ours(t) ? t : t.slice(1, -1);
  if (!isSuitBid(a) || !isSuitBid(b) || a[0] !== b[0]) return false;
  const rs = strains(a[1]);
  return strains(b[1]).every((s) => rs.includes(s));
}
const ctxFits = (root, e) => !(unpassed(root) && passed(e)) && !(passed(root) && unpassed(e));
function descends(root, e) {
  if (e.tail || root.tail) return false;
  const seq = [...root.after, root.call];
  if (e.after.length < seq.length) return false;
  return seq.every((t, i) => covers(t, e.after[i])) && ctxFits(root, e);
}

// Tag every rule that has no `opt` yet. Returns a report: { [opt]: { self, inherited, section } }.
export function tagAll(entries) {
  const report = {};
  const note = (opt, how) => {
    report[opt] ??= { self: 0, inherited: 0, section: 0 };
    report[opt][how]++;
  };
  const roots = [];
  const why = new Map();
  for (const e of entries) {
    if (e.opt !== undefined) continue;
    const hit = ROOTS.find(([, test]) => test(e));
    if (hit) roots.push([hit[0], e]);
  }
  // Section roots too: a call (not a pass) of a one-option section passes its tag on to later rules elsewhere.
  for (const e of entries) {
    if (e.opt !== undefined || e.call === 'P' || !SECTIONS[e.notes] || roots.some(([, r]) => r === e)) continue;
    roots.push([SECTIONS[e.notes], e]);
  }
  const rank = (opt) => (opt === 'base:2/1' ? 0 : 1);
  for (const e of entries) {
    if (e.opt !== undefined) continue;
    let best = null;
    for (const [opt, r] of roots) {
      if (r !== e && !descends(r, e)) continue;
      const own = r === e && ROOTS.some(([o, test]) => o === opt && test(e));
      const cand = { opt, how: own ? 'self' : r === e ? 'section' : 'inherited', root: r };
      if (!best || rank(opt) < rank(best.opt) || (rank(opt) === rank(best.opt) && best.how === 'inherited' && cand.how !== 'inherited')) best = cand;
    }
    if (!best && SECTIONS[e.notes]) best = { opt: SECTIONS[e.notes], how: 'section' };
    e.opt = best ? best.opt : null;
    if (best) {
      note(best.opt, best.how);
      if (best.root && best.root !== e) why.set(e, best.root);
    }
  }
  return { report, why };
}

export const isTag = (opt) => opt === null || opt === 'base:2/1' || opt === 'base:sayc' || (typeof opt === 'string' && Boolean(option(...splitOpt(opt))));
