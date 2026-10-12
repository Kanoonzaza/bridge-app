import { SYMBOL, SUITS, evaluate } from './cards.js';
import { legalCalls, seatAt, situationAt, partnerOf, isComplete, sideOf } from './auction.js';
import ALL from './system/index.js';
import { judge } from './judgment.js';
import { describeCall } from './general.js';

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
export function explain(auction, entries = ALL, { general = false } = {}) {
  const rows = [];
  auction.calls.forEach((call, i) => {
    const c = candidates(situationAt(auction, i), entries).find((x) => x.call === call);
    const row = {
      i,
      seat: seatAt(auction, i),
      call,
      meaning: c ? fill(c.entry.meaning, c.env) : null,
      shows: c ? resolveShows(c.entry.shows, c.env) : null,
      entry: c ? c.entry : null,
    };
    const g = !c && general ? describeCall(auction, i, rows) : null;
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

// With no rule for the next call: the general meaning of the natural candidates
// (double, our suits, their suit, notrump, game), cheapest first.
export function generalOptions(auction, entries = ALL) {
  if (isComplete(auction)) return [];
  const legal = legalCalls(auction).filter((c) => c !== 'P');
  const rows = explain(auction, entries, { general: true });
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
    const row = explain({ ...auction, calls: [...auction.calls, call] }, entries, { general: true }).at(-1);
    return { call, meaning: row.meaning, notes: row.entry?.notes ?? row.notes, general: !row.entry };
  }).filter((o) => o.meaning);
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
  return (entries === ALL ? fallback(hand, auction, entries) : null) ?? { notCovered: true, options: nextOptions(auction, entries) };
}

// When no rule covers a contested auction:
// - we opened: bid as if the opponents had passed, when that call is still legal;
// - they opened: pass with a modest hand.
const GAME = /^(3N|4[HS]|5[CDHS]|[67][CDHSN])$/;
const pass = (why) => ({ call: 'P', meaning: 'Pass.', reasons: why, plan: null, close: null, notes: 'opening-bids-tier-0', fallback: 'pass' });

// Two meanings agree when they show the same suits at about the same length and strength.
function sameShape(a, b) {
  if (!a) return true; // no agreement in competition: assume the natural meaning
  if (!b) return false;
  const la = a.len ?? {};
  const lb = b.len ?? {};
  const keys = new Set([...Object.keys(la), ...Object.keys(lb)]);
  for (const k of keys) if (!la[k] || !lb[k] || Math.abs(la[k][0] - lb[k][0]) > 1) return false;
  if ((a.force ?? 'none') !== (b.force ?? 'none')) return false;
  return Math.abs((a.hcp?.[0] ?? 6) - (b.hcp?.[0] ?? 6)) <= 4;
}

// What a call will tell partner: the rule partner will read it by, or else its general meaning.
function tells(auction, call, entries) {
  const row = explain({ ...auction, calls: [...auction.calls, call] }, entries, { general: true }).at(-1);
  return row.meaning ? { meaning: row.meaning, notes: row.entry?.notes ?? row.notes } : null;
}

const told = (auction, call, entries) => {
  const t = tells(auction, call, entries);
  return { meaning: t?.meaning ?? 'Natural.', notes: t?.notes ?? 'competitive-bidding-tier-0' };
};

// Does the hand fit what a call showed (about 1 HCP of slack; suit lengths exactly)?
function fitsHand(e, shows) {
  if (!shows) return true;
  if (shows.hcp && (e.hcp < shows.hcp[0] - 1 || e.hcp > shows.hcp[1] + 1)) return false;
  return Object.entries(shows.len ?? {}).every(([suit, [lo, hi]]) => e.len[suit] >= lo && e.len[suit] <= hi);
}

function fallback(hand, auction, entries) {
  const n = auction.calls.length;
  const s = situationAt(auction, n);
  const e = evaluate(hand);
  const last = s.key.at(-1) ?? '';
  // Partner placed the contract at game or higher and the opponents passed.
  const cueOfTheirs = s.key.some((t) => t.startsWith('(') && t[2] === last[1]);
  if (GAME.test(last) && !cueOfTheirs && e.hcp <= 19 && legalCalls(auction).includes('P')) return pass(['partner placed the contract: pass']);
  const judged = () => {
    const rows = explain(auction, entries);
    const j = judge(e, auction, rows, (seat) => summarize(rows, seat), s.key);
    if (!j) return null;
    const told = j.call === 'P' ? null : tells(auction, j.call, entries);
    return { call: j.call, meaning: told?.meaning ?? 'Pass.', reasons: j.why, plan: null, close: null, notes: told?.notes ?? (s.ctx.competitive ? 'competitive-bidding-tier-0' : '21-game-forcing-tier-0'), fallback: 'judgment' };
  };
  if (!s.ctx.competitive) return judged();
  // We opened, partner has only passed, and the opponents compete: rebid a 6-card suit cheaply, or pass.
  const ours = s.key.filter((t) => !t.startsWith('('));
  if (s.ctx.opened === 'us' && s.ctx.role === 'opener' && ours.slice(1).every((t) => t === 'P')) {
    const o = ours[0][1];
    const call = ['C', 'D', 'H', 'S'].includes(o) ? legalCalls(auction).find((c) => c[1] === o && /^[1-7]/.test(c)) : null;
    if (call && e.len[o] >= 6 && Number(call[0]) <= 2 && e.hcp >= 11) {
      return { call, meaning: `6+ ${o === 'S' ? 'spades' : o === 'H' ? 'hearts' : o === 'D' ? 'diamonds' : 'clubs'}: competing for the part-score.`, reasons: [`${e.len[o]}-card suit`, 'partner is weak: compete at the 2-level'], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'compete' };
    }
    // A second 5-card suit at the 2-level, or a takeout double when short in the suit they just bid.
    const theirBids = s.key.filter((t) => /^\(\d[CDHS]\)$/.test(t)).map((t) => t.slice(1, -1));
    const theirSuits = new Set(theirBids.map((c) => c[1]));
    const lastTheirs = theirBids.at(-1);
    const legal = legalCalls(auction);
    const second = ['S', 'H', 'D', 'C'].filter((x) => x !== o && !theirSuits.has(x) && e.len[x] >= 5 && e.len[o] >= 5)
      .map((x) => legal.find((c) => c[1] === x && /^[1-7]/.test(c))).find((c) => c && Number(c[0]) <= 2);
    if (second && e.hcp >= 11) return { call: second, ...told(auction, second, entries), reasons: [`5-5: show the second suit`, 'partner is weak: compete at the 2-level'], plan: null, close: null, fallback: 'compete' };
    if (lastTheirs && Number(lastTheirs[0]) <= 2 && e.len[lastTheirs[1]] <= 1 && e.hcp >= 13 && legal.includes('X')) {
      return { call: 'X', ...told(auction, 'X', entries), reasons: [`${e.len[lastTheirs[1]]} card${e.len[lastTheirs[1]] === 1 ? '' : 's'} in their suit, ${e.hcp} HCP`, 'takeout double: partner chooses'], plan: null, close: null, fallback: 'compete' };
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
    const r = situationAt(quiet, n).ctx.competitive ? null : advise(hand, quiet, entries);
    // Only when every call our side made means the same without their interference.
    const real = explain(auction, entries);
    const calm = explain(quiet, entries);
    const same = real.every((row, i) => sideOf(row.seat) !== side || row.call === 'P' || sameShape(row.shows, calm[i].shows));
    // My own earlier calls must also describe this hand: if I bid 2NT (18-19) with 12 HCP, the quiet auction's
    // advice would follow from a hand I do not hold.
    const honest = real.every((row, i) => row.seat !== s.actor || row.call === 'P' || fitsHand(e, calm[i].shows));
    const lastBid = auction.calls.map((c, i) => [c, i]).filter(([c]) => /^[1-7]/.test(c)).at(-1);
    const theyOutbid = lastBid && sideOf(seatAt(auction, lastBid[1])) !== side;
    if (same && honest && r && !r.notCovered && !r.fallback && !theyOutbid && legalCalls(auction).includes(r.call)) {
      return { ...r, reasons: [...r.reasons, "the opponents' bids took none of our room: bid as if they had passed"], fallback: 'quiet' };
    }
  }
  const j = judged();
  if (j) return j;
  if (s.ctx.opened === 'them' && e.hcp <= 14) return pass([`${e.hcp} HCP and no clear action: pass`]);
  // Last resort in a contested auction: a strong hand shows a 5-card suit or doubles; otherwise pass.
  const iBid = auction.calls.some((c, i) => seatAt(auction, i) === s.actor && /^[1-7]/.test(c) && i >= auction.calls.findIndex((x) => /^[1-7]/.test(x)) && sideOf(seatAt(auction, auction.calls.findIndex((x) => /^[1-7]/.test(x)))) !== sideOf(s.actor));
  if (e.hcp >= 15 && !iBid && s.ctx.opened === 'them') {
    const theirs = new Set(s.key.filter((t) => t.startsWith('(') && /\d/.test(t)).map((t) => t[2]));
    const legal = legalCalls(auction);
    const suit = ['S', 'H', 'D', 'C'].filter((x) => !theirs.has(x) && e.len[x] >= 5).sort((a, b) => e.len[b] - e.len[a])[0];
    const bid = suit && legal.find((c) => c[1] === suit && /^[1-4]/.test(c));
    if (bid) return { call: bid, meaning: `Natural: 5+ ${({ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' })[suit]}, a strong hand.`, reasons: [`${e.hcp} HCP and ${e.len[suit]} cards: bid again voluntarily (17+)`], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'strong' };
    // Double only when short in their suit (partner will take it out); with length and a stopper, notrump.
    const their = [...s.key].reverse().find((t) => /^\(\d[CDHS]\)$/.test(t))?.[2];
    const stop = their && (/A/.test(e.hand[their]) || (/K/.test(e.hand[their]) && e.len[their] >= 2) || (/Q/.test(e.hand[their]) && e.len[their] >= 3));
    const nt = legal.find((c) => c[1] === 'N' && /^[1-3]/.test(c));
    if (their && e.len[their] >= 3 && stop && nt) return { call: nt, ...told(auction, nt, entries), reasons: [`${e.hcp} HCP with ${e.len[their]} cards and a stopper in their suit: notrump, not a takeout double`], plan: null, close: null, fallback: 'strong' };
    if (legal.includes('X') && e.hcp >= 17 && (!their || e.len[their] <= 2)) return { call: 'X', meaning: 'Double: a strong hand.', reasons: [`${e.hcp} HCP: double to show strength`], plan: null, close: null, notes: 'competitive-bidding-tier-0', fallback: 'strong' };
  }
  return pass([`${e.hcp} HCP: no clear action, so pass`]);
}

export function matchingEntries(hand, auction, entries = ALL) {
  const { e, base, list } = prepare(hand, auction, entries);
  return list.filter((c) => c.entry.pick(e, { ...base, bind: c.env })).map((c) => ({ call: c.call, priority: c.entry.priority }));
}
