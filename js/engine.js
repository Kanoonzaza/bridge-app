// The engine behind the Advisor and the Decoder.
//
// Decoder — explain(auction): for each call, find the rule (entry) whose pattern matches the auction so far
//   (candidates), and read its meaning; with { general: true }, calls no rule covers get a general meaning
//   (general.js). nextOptions / generalOptions list what the next call could mean.
// Advisor — advise(hand, auction): try the matching rules, most specific pattern first and then by priority;
//   the first whose pick(e, st) accepts the hand is the suggestion. When none does, fallback.js decides.
//
// Patterns: an entry's `after` lists the calls so far, opponents' calls in brackets. Placeholders bind to
// strains: M = a major, m = a minor, x = any suit, O = the other major, n = the other minor (e.g. ['1M', '2M']).
// A `tail` entry matches the end of any auction (e.g. answers to 4NT once a suit is agreed).
//
// Books: every function below that takes rules accepts one rule list (default ALL, the house card) or a book
// { NS, EW } with one list per side (js/pool/system.js). Each call is read, and each hand bid, with the rules
// of the side that makes the call.
import { SYMBOL, SUITS, evaluate } from './cards.js';
import { legalCalls, seatAt, situationAt, partnerOf, isComplete, sideOf } from './auction.js';
import ALL, { EVERY } from './system/index.js';
import { describeCall } from './general.js';
import { fallback } from './fallback.js';
import { sysOf, isSystem, forSeat } from './pool/system.js';

const PLACE = { M: ['H', 'S'], m: ['C', 'D'], x: ['C', 'D', 'H', 'S'] };

function bindStrain(ph, s, env) {
  if (ph === s) return env;
  if (PLACE[ph]) {
    if (!PLACE[ph].includes(s)) return null;
    if (env[ph]) return env[ph] === s ? env : null;
    return { ...env, [ph]: s };
  }
  if (ph === 'O') return env.M && s !== env.M && PLACE.M.includes(s) ? env : null;
  if (ph === 'n') return env.m && s !== env.m && PLACE.m.includes(s) ? env : null;
  return null;
}

function matchToken(pat, tok, env) {
  const po = pat.startsWith('(');
  if (po !== tok.startsWith('(')) return null;
  const p = po ? pat.slice(1, -1) : pat;
  const t = po ? tok.slice(1, -1) : tok;
  if (p === t) return env;
  if (p.length !== 2 || t.length !== 2 || p[0] !== t[0]) return null;
  return bindStrain(p[1], t[1], env);
}

export function matchPattern(pattern, key) {
  if (pattern.length !== key.length) return null;
  let env = {};
  for (let i = 0; i < pattern.length; i++) {
    env = matchToken(pattern[i], key[i], env);
    if (!env) return null;
  }
  return env;
}

function strainFor(ch, env) {
  if (ch === 'O') return env.M === 'H' ? 'S' : 'H';
  if (ch === 'n') return env.m === 'C' ? 'D' : 'C';
  return env[ch] ?? ch;
}

export function resolveCall(call, env) {
  return /^[1-7]/.test(call) ? call[0] + strainFor(call[1], env) : call;
}

// Wording that depends on the card: an ask written for RKCB 1430 reads as Blackwood (aces) or RKCB 0314 on a card
// that plays those (pool question 'keycard'); the answers come from that option's own rules.
export function onCard(text, sys) {
  const k = sys?.get?.('keycard');
  if (!text || !k || k === 'rkcb-1430') return text;
  if (k === 'blackwood') return text.replace(/\bRKCB( 1430)?\b/g, 'Blackwood').replace(/\bkey cards\b/g, 'aces');
  return text.replace(/\bRKCB( 1430)?\b/g, 'RKCB 0314');
}

export function fill(text, env) {
  return text.replace(/\{([MmxOn])\}/g, (_, ch) => SYMBOL[strainFor(ch, env)] ?? '');
}

export function resolveShows(shows = {}, env = {}) {
  const out = { ...shows };
  if (shows.len) {
    out.len = {};
    for (const [k, v] of Object.entries(shows.len)) out.len[strainFor(k, env)] = v;
  }
  return out;
}

// Lower = more specific: literal token 0, M/m/O/n 1, x 2.
function specificity(after) {
  let score = 0;
  for (const t of after) {
    const p = t.startsWith('(') ? t.slice(1, -1) : t;
    if (p.length !== 2) continue;
    if (p[1] === 'x') score += 2;
    else if ('MmOn'.includes(p[1])) score += 1;
  }
  return score;
}

const ctxSize = (entry) => (entry.ctx ? Object.keys(entry.ctx).length : 0);

const moreSpecific = (a, b) => a.spec < b.spec || (a.spec === b.spec && a.ctxN > b.ctxN);

// Entries grouped by pattern length (tail entries apart), so a lookup scans only the patterns that can match.
const INDEX = new WeakMap();
function indexOf(entries) {
  let idx = INDEX.get(entries);
  if (!idx) {
    idx = { byLen: new Map(), tails: [] };
    for (const entry of entries) {
      if (entry.tail) idx.tails.push(entry);
      else {
        const n = entry.after.length;
        if (!idx.byLen.has(n)) idx.byLen.set(n, []);
        idx.byLen.get(n).push(entry);
      }
    }
    INDEX.set(entries, idx);
  }
  return idx;
}

// Partner's direct 1NT overcall plays "systems on": from there, read the auction as if we had opened 1NT.
function systemsOn(situation) {
  const k = situation.key;
  if (k.length < 2 || !/^\(1[CDHS]\)$/.test(k[0]) || k[1] !== '1N') return null;
  const rest = k.slice(1);
  const ours = rest.filter((t) => !t.startsWith('('));
  return {
    ...situation,
    key: rest,
    ctx: { ...situation.ctx, opened: 'us', role: ours.length % 2 === 0 ? 'opener' : 'responder', responderPassed: false, competitive: rest.some((t) => t.startsWith('(')) },
  };
}

// The situation as the card reads it. On a SAYC card the 1NT response to 1♥/1♠ is not forcing (6–10), so the
// auction after it reads as after a passed hand's 1NT, whose rules are already written (pool question 'base').
export function asCard(situation, entries) {
  if (sysOf(entries).base !== 'sayc') return situation;
  const k = situation.key;
  if (k.length >= 2 && /^1[HS]$/.test(k[0]) && k[1] === '1N' && situation.ctx.opened === 'us' && !situation.ctx.responderPassed) {
    return { ...situation, ctx: { ...situation.ctx, responderPassed: true } };
  }
  return situation;
}

export function candidates(situation, entries = ALL, onlyPickable = false) {
  const own = candidatesFor(situation, entries, onlyPickable);
  const alias = systemsOn(situation);
  if (!alias) return own;
  const have = new Set(own.map((c) => c.call));
  return [...own, ...candidatesFor(alias, entries, onlyPickable).filter((c) => !have.has(c.call))];
}

function candidatesFor(situation, entries, onlyPickable) {
  const best = new Map();
  const idx = indexOf(entries);
  for (const entry of [...(idx.byLen.get(situation.key.length) ?? []), ...idx.tails]) {
    if (onlyPickable && !entry.pick) continue;
    // A tail entry matches the end of the auction (e.g. any 4NT once a suit is agreed); exact patterns beat it.
    if (entry.tail && situation.key.length < entry.after.length) continue;
    const env = matchPattern(entry.after, entry.tail ? situation.key.slice(situation.key.length - entry.after.length) : situation.key);
    if (!env) continue;
    if (entry.ctx && !Object.entries(entry.ctx).every(([k, v]) => situation.ctx[k] === v)) continue;
    if (entry.when && !entry.when(situation.key)) continue;
    const call = resolveCall(entry.call, env);
    const cand = { call, entry, env, spec: specificity(entry.after) + (entry.tail ? 100 : 0), ctxN: ctxSize(entry) };
    const prev = best.get(call);
    if (!prev || moreSpecific(cand, prev)) best.set(call, cand);
  }
  return [...best.values()];
}

// With { general: true }, calls no rule covers get a general meaning (marked `general`) from the notes' general rules.
export function explain(auction, book = ALL, { general = false } = {}) {
  const rows = [];
  auction.calls.forEach((call, i) => {
    const list = forSeat(book, seatAt(auction, i));
    const c = candidates(asCard(situationAt(auction, i), list), list).find((x) => x.call === call);
    const row = {
      i,
      seat: seatAt(auction, i),
      call,
      meaning: c ? onCard(fill(c.entry.meaning, c.env), sysOf(forSeat(book, seatAt(auction, i)))) : null,
      shows: c ? resolveShows(c.entry.shows, c.env) : null,
      entry: c ? c.entry : null,
    };
    const g = !c && general ? describeCall(auction, i, rows, sysOf(forSeat(book, seatAt(auction, i)))) : null;
    rows.push(g ? { ...row, meaning: g.meaning, shows: g.shows, notes: g.notes, general: true } : row);
  });
  return rows;
}

export function summarize(rows, seat) {
  const acc = { known: false, hcp: [0, 37], len: { S: [0, 13], H: [0, 13], D: [0, 13], C: [0, 13] }, balanced: false, force: 'none' };
  for (const r of rows) {
    if (r.seat !== seat || !r.shows) continue;
    acc.known = true;
    if (r.shows.hcp) acc.hcp = [Math.max(acc.hcp[0], r.shows.hcp[0]), Math.min(acc.hcp[1], r.shows.hcp[1])];
    for (const [s, [lo, hi]] of Object.entries(r.shows.len || {})) {
      acc.len[s] = [Math.max(acc.len[s][0], lo), Math.min(acc.len[s][1], hi)];
    }
    if (r.shows.balanced) acc.balanced = true;
    acc.force = r.shows.force || 'none';
  }
  return acc;
}

export function describeShown(acc) {
  if (!acc.known) return [];
  const out = [];
  const [lo, hi] = acc.hcp;
  if (lo > hi) out.push('Conflicting HCP');
  else if (!(lo === 0 && hi === 37)) out.push(hi >= 37 ? `${lo}+ HCP` : lo === hi ? `${lo} HCP` : `${lo}–${hi} HCP`);
  for (const s of SUITS) {
    const [a, b] = acc.len[s];
    if (a === 0 && b === 13) continue;
    if (a > b) {
      out.push(`Conflicting ${SYMBOL[s]} length`);
      continue;
    }
    out.push(b === 13 ? `${a}+${SYMBOL[s]}` : a === b ? `${a}${SYMBOL[s]}` : `${a}–${b}${SYMBOL[s]}`);
  }
  if (acc.balanced) out.push('Balanced');
  if (acc.force === 'round') out.push('Forcing one round');
  if (acc.force === 'game') out.push('Game forcing');
  return out;
}

export function nextOptions(auction, book = ALL) {
  if (isComplete(auction)) return [];
  const entries = forSeat(book, seatAt(auction, auction.calls.length));
  const byCall = new Map(candidates(asCard(situationAt(auction, auction.calls.length), entries), entries).map((c) => [c.call, c]));
  return legalCalls(auction)
    .filter((call) => byCall.has(call))
    .map((call) => {
      const c = byCall.get(call);
      return { call, meaning: fill(c.entry.meaning, c.env), notes: c.entry.notes };
    });
}

// With no rule for the next call: the general meaning of the natural candidates
// (double, our suits, their suit, notrump, game), cheapest first.
export function generalOptions(auction, book = ALL) {
  if (isComplete(auction)) return [];
  const legal = legalCalls(auction).filter((c) => c !== 'P');
  const rows = explain(auction, book, { general: true });
  const side = sideOf(seatAt(auction, auction.calls.length));
  const strains = new Set(rows.filter((r) => /^[1-7][CDHSN]$/.test(r.call)).map((r) => r.call[1]));
  const picks = new Set(legal.filter((c) => c === 'X' || c === 'XX'));
  for (const st of strains) {
    const c = legal.find((x) => x[1] === st);
    if (c) picks.add(c);
  }
  const ourSuits = new Set(rows.filter((r) => sideOf(r.seat) === side && r.shows?.len).flatMap((r) => Object.keys(r.shows.len).filter((k) => r.shows.len[k][0] >= 3)));
  for (const st of ourSuits) {
    const g = st === 'H' || st === 'S' ? `4${st}` : `5${st}`;
    if (legal.includes(g)) picks.add(g);
  }
  if (legal.includes('3N')) picks.add('3N');
  return legal.filter((c) => picks.has(c)).map((call) => {
    const row = explain({ ...auction, calls: [...auction.calls, call] }, book, { general: true }).at(-1);
    return { call, meaning: row.meaning, notes: row.entry?.notes ?? row.notes, general: !row.entry };
  }).filter((o) => o.meaning);
}

function prepare(hand, auction, book) {
  const raw = situationAt(auction, auction.calls.length);
  const entries = forSeat(book, raw.actor);
  const s = asCard(raw, entries);
  const legal = new Set(legalCalls(auction));
  const rows = explain(auction, book);
  // sys: the card's answers, for decision functions that mix conventions (st.sys.is('passed-2c', 'drury')).
  const base = { ...s, partner: summarize(rows, partnerOf(s.actor)), me: summarize(rows, s.actor), sys: sysOf(entries) };
  const list = candidates(s, entries, true)
    .filter((c) => legal.has(c.call))
    .sort((a, b) => (a.entry.priority ?? 50) - (b.entry.priority ?? 50));
  return { e: evaluate(hand), base, list, entries };
}

export function advise(hand, auction, book = ALL) {
  const { e, base, list, entries } = prepare(hand, auction, book);
  for (const c of list) {
    const st = { ...base, bind: c.env };
    if (!c.entry.pick(e, st)) continue;
    return {
      call: c.call,
      meaning: onCard(fill(c.entry.meaning, c.env), base.sys),
      reasons: c.entry.why ? c.entry.why(e, st) : [],
      plan: c.entry.plan ? c.entry.plan(e, st) : null,
      close: c.entry.close ? c.entry.close(e, st) : null,
      notes: c.entry.notes,
      opt: c.entry.opt ?? null,
    };
  }
  // General judgment only for a card's rules; a hand-made list (in a test) gets none.
  return (isSystem(entries) ? fallback(hand, auction, book) : null) ?? { notCovered: true, options: nextOptions(auction, book) };
}

export function matchingEntries(hand, auction, book = ALL) {
  const { e, base, list } = prepare(hand, auction, book);
  return list.filter((c) => c.entry.pick(e, { ...base, bind: c.env })).map((c) => ({ call: c.call, priority: c.entry.priority }));
}

// For checks (tests/pool-safety.test.js): when no rule on the side's card accepts the hand, the rules outside
// the card that would have. A decision function shared by several options that returns a call the card does
// not play shows up here.
export function leaks(hand, auction, book = ALL) {
  const { e, base, list, entries } = prepare(hand, auction, book);
  if (entries === ALL || list.some((c) => c.entry.pick(e, { ...base, bind: c.env }))) return [];
  const inside = new Set(entries);
  const legal = new Set(legalCalls(auction));
  return candidates(base, EVERY, true)
    .filter((c) => !inside.has(c.entry) && legal.has(c.call) && c.entry.pick(e, { ...base, bind: c.env }))
    .map((c) => ({ call: c.call, opt: c.entry.opt }));
}
