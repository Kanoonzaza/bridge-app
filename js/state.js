// Pure helpers that turn whatever was saved in storage into a fully valid view state.
import { SUITS, RANKS, emptyHand, cardCount } from './cards.js';
import { buildAuction } from './advisor-model.js';
import { SEATS } from './auction.js';

const CALL = /^(P|X|XX|[1-7][CDHSN])$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function cleanHand(raw) {
  if (!isObj(raw)) return emptyHand();
  const hand = emptyHand();
  for (const s of SUITS) {
    const seen = new Set(typeof raw[s] === 'string' ? [...raw[s]].filter((r) => RANKS.includes(r)) : []);
    hand[s] = [...RANKS].filter((r) => seen.has(r)).join('');
  }
  return cardCount(hand) <= 13 ? hand : emptyHand();
}

function cleanCalls(raw) {
  return Array.isArray(raw) ? raw.filter((c) => typeof c === 'string' && CALL.test(c)) : [];
}

export function cleanAdvisor(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    hand: cleanHand(r.hand),
    opener: ['partner', 'lho', 'rho'].includes(r.opener) ? r.opener : 'me',
    seat: Number.isInteger(r.seat) && r.seat >= 1 && r.seat <= 4 ? r.seat : 1,
    ourCalls: cleanCalls(r.ourCalls),
    compete: r.compete === true,
    vul: ['we', 'they', 'both'].includes(r.vul) ? r.vul : 'none',
  };
}

export function cleanDecoder(raw) {
  const r = isObj(raw) ? raw : {};
  return {
    dealer: SEATS.includes(r.dealer) ? r.dealer : 'S',
    calls: cleanCalls(r.calls),
  };
}

export function cleanTab(raw, tabs) {
  const tab = isObj(raw) ? raw.tab : raw;
  return tabs.includes(tab) ? tab : tabs[0];
}

// The longest prefix of our saved calls that the built auction actually used.
// buildAuction stops at the first illegal call (or at the end of the auction) and ignores the rest.
// ourCalls holds every entered call: ours, and the opponents' when they compete.
export function acceptedCalls(state) {
  const { ourCalls } = state;
  let built = buildAuction({ ...state, ourCalls: [] });
  for (let k = 1; k <= ourCalls.length; k++) {
    const next = buildAuction({ ...state, ourCalls: ourCalls.slice(0, k) });
    const n = built.calls.length;
    const used = next.calls.length > n
      && built.calls.every((c, i) => next.calls[i] === c)
      && next.calls[n] === ourCalls[k - 1];
    if (!used) return ourCalls.slice(0, k - 1);
    built = next;
  }
  return [...ourCalls];
}
