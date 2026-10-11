export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = 'AKQJT98765432';
export const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣', N: 'NT' };
export const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const HCP = { A: 4, K: 3, Q: 2, J: 1 };

const sortRanks = (s) => [...s].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b)).join('');

export function emptyHand() {
  return { S: '', H: '', D: '', C: '' };
}

export function parseHand(text) {
  const groups = String(text).replace(/10/g, 'T').replace(/[♠♥♦♣]/g, ' ').trim().toUpperCase().split(/\s+/);
  if (groups.length !== 4) throw new Error('A hand needs four suit groups (spades hearts diamonds clubs)');
  const hand = emptyHand();
  const seen = new Set();
  SUITS.forEach((s, i) => {
    const g = groups[i].replace(/[-—–]/g, '');
    for (const r of g) {
      if (!RANKS.includes(r)) throw new Error(`Unknown card "${r}"`);
      if (seen.has(s + r)) throw new Error(`Duplicate card ${SYMBOL[s]}${r}`);
      seen.add(s + r);
    }
    hand[s] = sortRanks(g);
  });
  return hand;
}

export function formatHand(hand) {
  return SUITS.map((s) => SYMBOL[s] + (hand[s] ? hand[s].replace(/T/g, '10') : '—')).join(' ');
}

export function cardCount(hand) {
  return SUITS.reduce((n, s) => n + hand[s].length, 0);
}

export function toggleCard(hand, suit, rank) {
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
