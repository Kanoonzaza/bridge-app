import { NAME, dummyPoints } from '../../cards.js';

// Shared by every contested-auction file: the list the meanings go into (def), the way a decision
// is attached to them (advise), and small helpers.
//
// How a contested situation is written:
//   1. def(after, call, meaning, shows, notes) — what each call means there (the Decoder reads these).
//   2. advise(after, decide, samples) — the Advisor's decision for the same situation: decide(e, st)
//      returns R(call, reasons, { plan, close }) and must return one of the calls defined in step 1.
// `after` is the auction so far with the opponents' calls in brackets, e.g. ['1H', '(2C)'] = we opened 1♥, they bid 2♣.

// Notes sections the rules link to.
export const COMP = 'competitive-bidding-tier-0';
export const OURS = 'when-we-open-and-they-compete';
export const DONT = 'dont-against-their-1nt-tier-1';
export const JORDAN = 'jordan-2nt-tier-1';
export const SUPPORT = 'support-doubles-and-redoubles-tier-2';
export const LEB = 'lebensohl-tier-2';
export const SLAM = 'rkcb-1430-and-slam-tools-tier-1';
export const STRONG = 'strong-2-opening-tier-2';
export const DRURY = 'drury-tier-1';

export const SUITS4 = ['C', 'D', 'H', 'S'];
export const RANK = { C: 0, D: 1, H: 2, S: 3, N: 4 };
export const MAJORS = ['H', 'S'];
export const isMajor = (s) => s === 'H' || s === 'S';
export const cap = (t) => t[0].toUpperCase() + t.slice(1);
export const nm = (s) => NAME[s];
// Cheapest level at which suit s can be bid over the bid `last` (e.g. '1H').
export const cheapest = (last, s) => Number(last[0]) + (RANK[s] > RANK[last[1]] ? 0 : 1);
export const above = (a, b) => (Number(a[0]) - Number(b[0])) * 5 + RANK[a[1]] - RANK[b[1]] > 0;
export const lvOf = (c) => Number(c[0]);

// Hand helpers.
export const top3 = (e, s) => ['A', 'K', 'Q'].filter((r) => e.hand[s].includes(r)).length;
export const stopper = (e, s) => /A/.test(e.hand[s]) || (/K/.test(e.hand[s]) && e.len[s] >= 2) || (/Q/.test(e.hand[s]) && e.len[s] >= 3) || (/J/.test(e.hand[s]) && e.len[s] >= 4);
export const stops = (e, suits) => suits.every((y) => stopper(e, y));
export const shortness = (e, trump) => SUITS4.some((s) => s !== trump && e.len[s] <= 1);
export const longestOf = (e, list) => [...list].sort((a, b) => e.len[b] - e.len[a] || RANK[b] - RANK[a])[0];
export const hcpIn = (e, s) => e.hcpBy?.[s] ?? 0;
// A suit worth asking partner to lead: 5+ with two of the top three honors, or AKQx.
export const goodSuit = (e, s) => e.len[s] >= 5 && top3(e, s) >= 2 || (e.len[s] >= 4 && top3(e, s) === 3);
export const R = (call, why, extra = {}) => ({ call, why, ...extra });

// A raise that has to go to the 3-level needs real values: 4 trumps and 6+ (7+ vulnerable),
// or 3 trumps and 8+ dummy points with 7+ HCP (9+ / 8+ vulnerable).
export function raiseAtThree(e, y, vul) {
  const weVul = vul === 'we' || vul === 'both';
  const dp = dummyPoints(e, y);
  return e.len[y] >= 4 ? dp >= (weVul ? 7 : 6) : e.hcp >= (weVul ? 8 : 7) && dp >= (weVul ? 9 : 8);
}

// Every contested-auction entry. The first meaning defined for a call in a situation wins.
export const entries = [];
export const def = (after, call, meaning, shows = {}, notes = /^1[CDHS]$/.test(after[0]) ? OURS : COMP, extra = {}) => {
  if (entries.some((e) => !e.tail && JSON.stringify(e.after) === JSON.stringify(after) && e.call === call && JSON.stringify(e.ctx ?? {}) === JSON.stringify(extra.ctx ?? {}))) return;
  entries.push({ after, call, meaning, shows, notes, ...extra });
};

// Attach the Advisor's decision to the calls already defined for `after`. Samples are auctions the tests replay.
export const SAMPLES = [];
export function advise(after, decide, samples) {
  const k = JSON.stringify(after);
  for (const en of entries) {
    if (en.tail || JSON.stringify(en.after) !== k) continue;
    en.priority = 10;
    en.pick = (e, st) => decide(e, st).call === en.call;
    en.why = (e, st) => decide(e, st).why;
    en.plan = (e, st) => decide(e, st).plan ?? null;
    en.close = (e, st) => decide(e, st).close ?? null;
  }
  for (const s of samples) SAMPLES.push({ after, ...s });
}
