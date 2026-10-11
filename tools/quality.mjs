// Bids random deals (all four players use the Advisor) and grades the final contracts against
// the declaring side's combined HCP and trump fit. Usage: node tools/quality.mjs [deals] [seed] [examples]
import { evaluate, formatHand } from '../js/cards.js';
import { SEATS, sideOf, partnerOf, isBid } from '../js/auction.js';
import { deal, bidDeal } from './coverage.mjs';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAJOR = (s) => s === 'H' || s === 'S';
export function grade(hands, auction) {
  const calls = auction.calls;
  const li = calls.map((c, i) => (isBid(c) ? i : -1)).filter((i) => i >= 0).at(-1);
  const sideHcp = (side) => SEATS.filter((s) => sideOf(s) === side).reduce((n, s) => n + evaluate(hands[s]).hcp, 0);
  const bestFit = (side) => {
    const [a, b] = SEATS.filter((s) => sideOf(s) === side);
    return Math.max(...['S', 'H', 'D', 'C'].map((t) => hands[a][t].length + hands[b][t].length));
  };
  const majorFit = (side) => {
    const [a, b] = SEATS.filter((s) => sideOf(s) === side);
    return Math.max(...['S', 'H'].map((t) => hands[a][t].length + hands[b][t].length));
  };
  const strong = sideHcp('NS') >= sideHcp('EW') ? 'NS' : 'EW';
  const hcp = sideHcp(strong);
  const out = { strong, hcp, contract: null, issues: [] };
  if (li === undefined) {
    if (hcp >= 23) out.issues.push('passed out with 23+');
    return out;
  }
  const declSeat = SEATS[(SEATS.indexOf(auction.dealer) + li) % 4];
  const declSide = sideOf(declSeat);
  const c = calls[li];
  const lvl = Number(c[0]);
  const strain = c[1];
  const doubled = calls.slice(li + 1).includes('X');
  out.contract = `${c}${doubled ? 'X' : ''} by ${declSide}`;
  const game = strain === 'N' ? lvl >= 3 : MAJOR(strain) ? lvl >= 4 : lvl >= 5;
  const slam = lvl >= 6;
  const dh = sideHcp(declSide);
  if (declSide === strong) {
    if (hcp >= 26 && !game && (majorFit(strong) >= 8 || hcp >= 26)) out.issues.push('missed game');
    if (hcp >= 33 && !slam) out.issues.push('missed slam');
    if (slam && hcp < 31) out.issues.push('bad slam');
    if (game && hcp < 22 && bestFit(strong) < 9) out.issues.push('overbid game');
    if (strain !== 'N') {
      const [a, b] = SEATS.filter((s) => sideOf(s) === declSide);
      const trumps = hands[a][strain].length + hands[b][strain].length;
      if (trumps <= 6) out.issues.push('bad trump fit');
      if (MAJOR(strain) === false && game && majorFit(strong) >= 8 && strain !== 'N') out.issues.push('minor game with a major fit');
    }
  } else {
    const [a, b] = SEATS.filter((s) => sideOf(s) === declSide);
    const fit = strain === 'N' ? 0 : hands[a][strain].length + hands[b][strain].length;
    if (lvl >= 3 && dh < 18 && !doubled && fit < 9 && lvl > fit - 6) out.issues.push('weak side too high');
    if (hcp >= 25 && !doubled && game === false && lvl >= 3) out.issues.push('strong side let them play');
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 1000);
  const r = rng(Number(process.argv[3] ?? 7));
  const ex = Number(process.argv[4] ?? 0);
  const tally = new Map();
  const examples = new Map();
  let games = 0;
  let gameChances = 0;
  for (let i = 0; i < n; i++) {
    const hands = deal(r);
    const { auction } = bidDeal(hands, SEATS[i % 4]);
    const g = grade(hands, auction);
    if (g.hcp >= 26) gameChances++;
    if (g.hcp >= 26 && !g.issues.includes('missed game')) games++;
    for (const k of g.issues) {
      tally.set(k, (tally.get(k) ?? 0) + 1);
      if (!examples.has(k)) examples.set(k, []);
      examples.get(k).push({ hands, auction, g });
    }
  }
  console.log(`${n} deals. Strong side with 26+ HCP reaches game in ${games}/${gameChances}.`);
  for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
  for (const [k, list] of examples) {
    for (const { hands, auction, g } of list.slice(0, ex)) {
      console.log(`\n[${k}] dealer ${auction.dealer}: ${auction.calls.join(' ')} → ${g.contract}; strong ${g.strong} ${g.hcp}`);
      for (const s of SEATS) console.log('   ', s, formatHand(hands[s]), evaluate(hands[s]).hcp);
    }
  }
}
