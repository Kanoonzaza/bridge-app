import { SYMBOL, SUITS, evaluate } from './cards.js';
import { legalCalls, seatAt, situationAt, partnerOf, isComplete } from './auction.js';
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

export function candidates(situation, entries = ALL, onlyPickable = false) {
  const best = new Map();
  for (const entry of entries) {
    if (onlyPickable && !entry.pick) continue;
    const env = matchPattern(entry.after, situation.key);
    if (!env) continue;
    if (entry.ctx && !Object.entries(entry.ctx).every(([k, v]) => situation.ctx[k] === v)) continue;
    const call = resolveCall(entry.call, env);
    const cand = { call, entry, env, spec: specificity(entry.after), ctxN: ctxSize(entry) };
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
  return { notCovered: true, options: nextOptions(auction, entries) };
}

export function matchingEntries(hand, auction, entries = ALL) {
  const { e, base, list } = prepare(hand, auction, entries);
  return list.filter((c) => c.entry.pick(e, { ...base, bind: c.env })).map((c) => ({ call: c.call, priority: c.entry.priority }));
}
