import { SYMBOL, SUITS, evaluate } from './cards.js';
import { legalCalls, seatAt, situationAt, partnerOf, isComplete, sideOf } from './auction.js';
import ALL from './system/index.js';

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

export function candidates(situation, entries = ALL, onlyPickable = false) {
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

export function explain(auction, entries = ALL) {
  return auction.calls.map((call, i) => {
    const c = candidates(situationAt(auction, i), entries).find((x) => x.call === call);
    return {
      i,
      seat: seatAt(auction, i),
      call,
      meaning: c ? fill(c.entry.meaning, c.env) : null,
      shows: c ? resolveShows(c.entry.shows, c.env) : null,
      entry: c ? c.entry : null,
    };
  });
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

export function nextOptions(auction, entries = ALL) {
  if (isComplete(auction)) return [];
  const byCall = new Map(candidates(situationAt(auction, auction.calls.length), entries).map((c) => [c.call, c]));
  return legalCalls(auction)
    .filter((call) => byCall.has(call))
    .map((call) => {
      const c = byCall.get(call);
      return { call, meaning: fill(c.entry.meaning, c.env), notes: c.entry.notes };
    });
}

function prepare(hand, auction, entries) {
  const s = situationAt(auction, auction.calls.length);
  const legal = new Set(legalCalls(auction));
  const rows = explain(auction, entries);
  const base = { ...s, partner: summarize(rows, partnerOf(s.actor)), me: summarize(rows, s.actor) };
  const list = candidates(s, entries, true)
    .filter((c) => legal.has(c.call))
    .sort((a, b) => (a.entry.priority ?? 50) - (b.entry.priority ?? 50));
  return { e: evaluate(hand), base, list };
}

export function advise(hand, auction, entries = ALL) {
  const { e, base, list } = prepare(hand, auction, entries);
  for (const c of list) {
    const st = { ...base, bind: c.env };
    if (!c.entry.pick(e, st)) continue;
    return {
      call: c.call,
      meaning: fill(c.entry.meaning, c.env),
      reasons: c.entry.why ? c.entry.why(e, st) : [],
      plan: c.entry.plan ? c.entry.plan(e, st) : null,
      close: c.entry.close ? c.entry.close(e, st) : null,
      notes: c.entry.notes,
    };
  }
  return fallback(hand, auction, entries) ?? { notCovered: true, options: nextOptions(auction, entries) };
}

// When no rule covers a contested auction:
// - we opened: bid as if the opponents had passed, when that call is still legal;
// - they opened: pass with a modest hand.
const GAME = /^(3N|4[HS]|5[CDHS]|[67][CDHSN])$/;
const pass = (why) => ({ call: 'P', meaning: 'Pass.', reasons: why, plan: null, close: null, notes: 'opening-bids-tier-0', fallback: 'pass' });

function fallback(hand, auction, entries) {
  const n = auction.calls.length;
  const s = situationAt(auction, n);
  const e = evaluate(hand);
  const last = s.key.at(-1) ?? '';
  // Partner placed the contract at game or higher and the opponents passed.
  if (GAME.test(last) && e.hcp <= 19 && legalCalls(auction).includes('P')) return pass(['partner placed the contract: pass']);
  if (!s.ctx.competitive) return null;
  // We opened, partner has only passed, and the opponents compete: rebid a 6-card suit cheaply, or pass.
  const ours = s.key.filter((t) => !t.startsWith('('));
  if (s.ctx.opened === 'us' && s.ctx.role === 'opener' && ours.slice(1).every((t) => t === 'P')) {
    const o = ours[0][1];
    const call = ['C', 'D', 'H', 'S'].includes(o) ? legalCalls(auction).find((c) => c[1] === o && /^[1-7]/.test(c)) : null;
    if (call && e.len[o] >= 6 && Number(call[0]) <= 2 && e.hcp >= 11) {
      return { call, meaning: `6+ ${o === 'S' ? 'spades' : o === 'H' ? 'hearts' : o === 'D' ? 'diamonds' : 'clubs'}: competing for the part-score.`, reasons: [`${e.len[o]}-card suit`, 'partner is weak: compete at the 2-level'], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'compete' };
    }
    if (e.hcp <= 16) return pass([`${e.hcp} HCP and partner passed: let them play`]);
  }
  // We opened, I (responder) have only passed so far, and they compete: raise to the 2-level with support, or pass.
  if (s.ctx.opened === 'us' && s.ctx.role === 'responder' && ours.slice(1).every((t) => t === 'P') && ours.length > 1) {
    const o = ours[0][1];
    const call = ['C', 'D', 'H', 'S'].includes(o) ? legalCalls(auction).find((c) => c[1] === o && /^[1-7]/.test(c)) : null;
    if (call && Number(call[0]) <= 2 && e.len[o] >= (o === 'H' || o === 'S' ? 3 : 4) && e.hcp >= 5) {
      return { call, meaning: 'Competitive raise.', reasons: [`${e.len[o]}-card support`, 'compete for the part-score'], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'compete' };
    }
    if (e.hcp <= 10) return pass([`${e.hcp} HCP: nothing to add`]);
  }
  if (s.ctx.opened === 'us') {
    const side = sideOf(s.actor);
    const calls = auction.calls.map((c, i) => (sideOf(seatAt(auction, i)) !== side && c !== 'P' ? 'P' : c));
    const quiet = { dealer: auction.dealer, calls };
    if (situationAt(quiet, n).ctx.competitive) return null;
    const r = advise(hand, quiet, entries);
    if (r.notCovered || !legalCalls(auction).includes(r.call)) return null;
    return { ...r, reasons: [...r.reasons, "the opponents' bids took none of our room: bid as if they had passed"], fallback: 'quiet' };
  }
  if (s.ctx.opened === 'them' && e.hcp <= 14) return pass([`${e.hcp} HCP and no clear action: pass`]);
  // A strong hand that has already acted (or must act) against their opening: show the long suit, else double again.
  if (s.ctx.opened === 'them' && e.hcp >= 17) {
    const theirs = new Set(s.key.filter((t) => t.startsWith('(') && /\d/.test(t)).map((t) => t[2]));
    const legal = legalCalls(auction);
    const suit = ['S', 'H', 'D', 'C'].filter((x) => !theirs.has(x) && e.len[x] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
    const bid = suit && legal.find((c) => c[1] === suit && /^[1-4]/.test(c));
    if (bid) return { call: bid, meaning: `Natural: 5+ ${({ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' })[suit]}, a strong hand.`, reasons: [`${e.hcp} HCP and ${e.len[suit]} cards: bid again voluntarily (17+)`], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'strong' };
    if (legal.includes('X')) return { call: 'X', meaning: 'Takeout double: a strong hand.', reasons: [`${e.hcp} HCP: double again`], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'strong' };
  }
  return null;
}

export function matchingEntries(hand, auction, entries = ALL) {
  const { e, base, list } = prepare(hand, auction, entries);
  return list.filter((c) => c.entry.pick(e, { ...base, bind: c.env })).map((c) => ({ call: c.call, priority: c.entry.priority }));
}
