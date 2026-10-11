export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = 'AKQJT98765432';
export const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣', N: 'NT' };
export const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const HCP = { A: 4, K: 3, Q: 2, J: 1 };

const sortRanks = (s) => [...s].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b)).join('');

export function emptyHand() {
  return { S: '', H: '', D: '', C: '' };
}

const SYMBOL_SUIT = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
const FOUR_GROUPS = 'A hand needs four suit groups (spades hearts diamonds clubs)';
const isDash = (g) => /^[-—–]$/.test(g);

export function parseHand(text) {
  const t = String(text).replace(/\uFE0F/g, '').replace(/10/g, 'T').trim().toUpperCase();
  const raw = {};
  if (/[♠♥♦♣]/.test(t)) {
    const parts = t.split(/([♠♥♦♣])/); // [before, sym, group, sym, group, ...]
    if (parts[0].trim() !== '') throw new Error(FOUR_GROUPS);
    for (let i = 1; i < parts.length; i += 2) {
      const suit = SYMBOL_SUIT[parts[i]];
      if (suit in raw) throw new Error(FOUR_GROUPS);
      raw[suit] = parts[i + 1].replace(/\s+/g, '');
    }
    if (Object.keys(raw).length !== 4) throw new Error(FOUR_GROUPS);
  } else {
    const groups = t.split(/\s+/);
    if (groups.length !== 4) throw new Error(FOUR_GROUPS);
    SUITS.forEach((s, i) => { raw[s] = groups[i]; });
  }
  const hand = emptyHand();
  const seen = new Set();
  for (const s of SUITS) {
    const g = isDash(raw[s]) ? '' : raw[s];
    for (const r of g) {
      if (!RANKS.includes(r)) throw new Error(`Unknown card "${r}"`);
      if (seen.has(s + r)) throw new Error(`Duplicate card ${SYMBOL[s]}${r}`);
      seen.add(s + r);
    }
    hand[s] = sortRanks(g);
  }
  return hand;
}

export function formatHand(hand) {
  return SUITS.map((s) => SYMBOL[s] + (hand[s] ? hand[s].replace(/T/g, '10') : '—')).join(' ');
}

export function cardCount(hand) {
  return SUITS.reduce((n, s) => n + hand[s].length, 0);
}

export function toggleCard(hand, suit, rank) {
  if (!SUITS.includes(suit)) throw new Error(`Unknown suit "${suit}"`);
  if (typeof rank !== "string" || rank.length !== 1 || !RANKS.includes(rank)) throw new Error(`Unknown card "${rank}"`);
  const next = { ...hand };
  next[suit] = hand[suit].includes(rank) ? hand[suit].replace(rank, '') : sortRanks(hand[suit] + rank);
  return next;
}

export function randomHand(rng = Math.random) {
  const deck = SUITS.flatMap((s) => [...RANKS].map((r) => [s, r]));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hand = emptyHand();
  for (const [s, r] of deck.slice(0, 13)) hand[s] += r;
  for (const s of SUITS) hand[s] = sortRanks(hand[s]);
  return hand;
}

export function losingTricks(hand) {
  let n = 0;
  for (const s of SUITS) {
    const top = hand[s].slice(0, Math.min(3, hand[s].length));
    n += ['A', 'K', 'Q'].slice(0, top.length).filter((r) => !top.includes(r)).length;
  }
  return n;
}

export function evaluate(hand) {
  const len = {};
  const hcpBy = {};
  for (const s of SUITS) {
    len[s] = hand[s].length;
    hcpBy[s] = [...hand[s]].reduce((n, r) => n + (HCP[r] || 0), 0);
  }
  const hcp = SUITS.reduce((n, s) => n + hcpBy[s], 0);
  const pattern = SUITS.map((s) => len[s]).sort((a, b) => b - a);
  const p = pattern.join('');
  const shape = ['4333', '4432', '5332'].includes(p) ? 'balanced' : ['5422', '6322'].includes(p) ? 'semi' : 'unbalanced';
  const good = {};
  for (const s of SUITS) good[s] = ['A', 'K', 'Q'].filter((r) => hand[s].includes(r)).length >= 2;
  const controls = SUITS.reduce((n, s) => n + (hand[s].includes('A') ? 2 : 0) + (hand[s].includes('K') ? 1 : 0), 0);
  return { hand, hcp, hcpBy, len, pattern, shape, balanced: shape === 'balanced', good, controls, ltc: losingTricks(hand) };
}

export const ruleOf20 = (e) => e.hcp + e.pattern[0] + e.pattern[1];
export const ruleOf15 = (e) => e.hcp + e.len.S;

export function adjustedHcp(e) {
  let n = e.hcp;
  for (const s of SUITS) {
    const c = e.hand[s];
    if (c.length === 1) n -= { K: 1, Q: 2, J: 1 }[c] || 0;
    if (c.length === 2 && (c[0] === 'Q' || c[0] === 'J')) n -= 1;
  }
  return n;
}

export function dummyPoints(e, trump) {
  const bonus = e.len[trump] >= 4 ? { 0: 5, 1: 3, 2: 1 } : { 0: 3, 1: 2, 2: 1 };
  let n = adjustedHcp(e);
  for (const s of SUITS) if (s !== trump) n += bonus[e.len[s]] || 0;
  return n;
}

export function quality(e, { fit = false } = {}) {
  let score = 0;
  const reasons = [];
  if (SUITS.some((s) => e.len[s] >= 5 && e.good[s])) { score += 2; reasons.push('a good 5+ card suit'); }
  const aceKing = SUITS.reduce((n, s) => n + (e.hand[s].includes('A') ? 4 : 0) + (e.hand[s].includes('K') ? 3 : 0), 0);
  if (e.hcp && aceKing / e.hcp >= 0.75) { score += 1; reasons.push('points in aces and kings'); }
  if (e.hcp && (e.hcp - aceKing) / e.hcp >= 0.5) { score -= 1; reasons.push('mostly queens and jacks'); }
  if (e.pattern.join('') === '4333') { score -= 1; reasons.push('flat 4-3-3-3 shape'); }
  if (e.pattern[0] >= 5 && e.pattern[1] >= 4) { score += 1; reasons.push('two-suited shape'); }
  if (adjustedHcp(e) < e.hcp) { score -= 1; reasons.push('honors in short suits'); }
  if (fit) { score += 1; reasons.push('a fit for partner'); }
  return { score, good: score > 0, reasons };
}
