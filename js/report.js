// Plain-text reports of a board or an Advisor suggestion, to paste into a chat for review.
// The last line ("Data: …") holds everything needed to replay the situation exactly.
import { formatHand } from './cards.js';
import { callLabel } from './format.js';
import { SEATS } from './auction.js';
import { auctionOf, handOf, packHand, playOf, seatsAtBidding } from './table/model.js';
import { score } from './table/play.js';
import { reviewRows, robotDepartures, systemAuction, contract } from './table/review.js';
import { parLine, tableRows } from './table/ddtext.js';
import { confidence } from './confidence.js';

const COMPASS = { N: 'North', E: 'East', S: 'South', W: 'West' };
const VUL = { none: 'None vulnerable', NS: 'N-S vulnerable', EW: 'E-W vulnerable', both: 'Both vulnerable' };
const calls = (list) => (list.length ? list.map(callLabel).join(' ') : '(none)');
const kText = (k) => (k ? `${callLabel(k.bid)}${k.doubled ? ` ${k.doubled === 'XX' ? 'redoubled' : 'doubled'}` : ''} by ${COMPASS[k.declarer]}` : 'Passed out');

// Auction laid out in rounds, starting from the dealer: "W: 1♥  N: 2♦  E: 2♠  S: Pass".
function rounds(a) {
  const start = SEATS.indexOf(a.dealer);
  const out = [];
  for (let i = 0; i < a.calls.length; i += 4) {
    out.push(a.calls.slice(i, i + 4).map((c, k) => `${SEATS[(start + i + k) % 4]}: ${callLabel(c)}`).join('  '));
  }
  return out.length ? out : ['(no calls yet)'];
}

const dataLine = (a, hands, play = '') => `Data: dealer=${a.dealer} vul=${a.vul ?? 'none'} calls=${a.calls.join(' ') || '-'} ${Object.entries(hands).map(([s, h]) => `${s}=${packHand(h)}`).join(' ')}${play ? ` play=${play.replace(/ /g, ',')}` : ''}`;

// How the play went: "10 tricks: made 4♥ with an overtrick, +650 for N-S". name(seat) labels a seat.
export function resultText(b, name = (s) => COMPASS[s]) {
  const st = playOf(b);
  if (!st) return 'Passed out.';
  const k = st.contract;
  const need = Number(k.bid[0]) + 6;
  const side = st.declarer === 'N' || st.declarer === 'S' ? 'N-S' : 'E-W';
  if (Number.isInteger(b.claim) && !st.complete) {
    const total = st.declarerTricks + b.claim;
    const left = 13 - st.tricks.length;
    const ok = total >= need;
    const sc = score(k, b.vul, total);
    return `${name(st.declarer)} claimed ${b.claim === left ? 'all' : b.claim} of the last ${left} trick${left === 1 ? '' : 's'}: ${total} tricks in ${callLabel(k.bid)}${k.doubled ? (k.doubled === 'XX' ? ' redoubled' : ' doubled') : ''}, ${ok ? `made${total > need ? ` with ${total - need} overtrick${total - need === 1 ? '' : 's'}` : ''}` : `down ${need - total}`}, ${sc > 0 ? '+' : ''}${sc} for ${side}.`;
  }
  if (!st.complete) return b.skip ? `Play skipped after ${st.tricks.length} trick${st.tricks.length === 1 ? '' : 's'} (declarer ${st.declarerTricks}, defence ${st.defenderTricks}).` : `In play: declarer ${st.declarerTricks}, defence ${st.defenderTricks}.`;
  const got = st.declarerTricks;
  const sc = score(k, b.vul, got);
  const how = got >= need ? `made${got > need ? ` with ${got - need} overtrick${got - need === 1 ? '' : 's'}` : ''}` : `down ${need - got}`;
  return `${name(st.declarer)} took ${got} tricks in ${callLabel(k.bid)}${k.doubled ? (k.doubled === 'XX' ? ' redoubled' : ' doubled') : ''}: ${how}, ${sc > 0 ? '+' : ''}${sc} for ${side}.`;
}

export function boardReport(t, me, dd = null) {
  const b = t.board;
  const a = auctionOf(b);
  const who = (s) => {
    const st = seatsAtBidding(t)[s];
    const name = st.kind === 'human' ? st.name || 'Player' : st.kind === 'robot' ? 'Robot' : st.kind === 'pass' ? 'Always passes' : 'Empty';
    return `${COMPASS[s]} (${name}${s === (b.swap ? b.swap[0] : me) ? ', me' : ''})`;
  };
  const hands = Object.fromEntries(SEATS.map((s) => [s, handOf(b, s)]));
  const bid = seatsAtBidding(t); // who was where while bidding (a swap to play a robot partner's contract comes after)
  const rows = reviewRows(b, bid).filter((r) => r.differs);
  const robots = robotDepartures(b, bid);
  const sys = systemAuction(b, bid);
  return [
    'Bridge Coach: board for review',
    `Table ${t.code} · Board ${b.n} · Dealer ${COMPASS[b.dealer]} · ${VUL[b.vul]}`,
    '',
    ...SEATS.map((s) => `${who(s)}: ${formatHand(hands[s])}`),
    '',
    'Auction:',
    ...rounds(a),
    `Contract: ${kText(contract(a))}${b.swap ? ' (declarer was my robot partner: I took over that seat for the play)' : ''}`,
    ...(contract(a) ? [`Result: ${resultText(b)}`] : []),
    `The Advisor would bid: ${calls(sys.calls)} → ${kText(contract(sys))}`,
    ...(dd ? ['', `Double dummy (tricks as declarer, N E S W): ${tableRows(dd.table).map((r) => `${r.strain} ${r.N} ${r.E} ${r.S} ${r.W}`).join(' · ')}`, ...(parLine(dd, { name: (x) => COMPASS[x] }) ? [parLine(dd, { name: (x) => COMPASS[x] })] : [])] : []),
    '',
    rows.length ? 'Where the Advisor differs (each player\'s first difference only):' : t.seats && Object.values(t.seats).some((x) => x.kind === 'human') ? 'Every human player\'s call matched the Advisor.' : 'No human calls to compare.',
    ...rows.map((r) => `- ${COMPASS[r.seat]} bid ${callLabel(r.call)}; Advisor: ${callLabel(r.advisor.call)}${r.advisor.conf ? ` [${r.advisor.conf.label}]` : ''} (${r.advisor.meaning}${r.advisor.reasons?.length ? `; ${r.advisor.reasons.join('; ')}` : ''})${r.advisor.close ? ` Close call: ${r.advisor.close}` : ''}${r.misfit?.length ? ` [Why ${callLabel(r.call)} does not fit the hand: ${r.misfit.join('; ')}]` : ''}`),
    ...(robots.length ? ['', 'Robots that chose differently from the Advisor (their first difference; the table\'s simulation picks these):', ...robots.map((r) => `- ${COMPASS[r.seat]} bid ${callLabel(r.call)}; Advisor: ${callLabel(r.advisor.call)}${r.advisor.reasons?.length ? ` (${r.advisor.reasons.join('; ')})` : ''}`)] : []),
    '',
    'My question:',
    '',
    dataLine(a, hands, b.play),
  ].join('\n');
}

// The Advisor tab: my hand (South), the auction so far and the suggestion.
export function advisorReport(hand, a, r) {
  return [
    'Bridge Coach: Advisor suggestion for review',
    `Dealer ${COMPASS[a.dealer]} · ${VUL[a.vul ?? 'none']} · I am South`,
    `My hand: ${formatHand(hand)}`,
    '',
    'Auction so far:',
    ...rounds(a),
    '',
    r.notCovered
      ? 'The Advisor had no suggestion.'
      : `Suggested: ${callLabel(r.call)} [${confidence(r).label}]. Meaning: ${r.meaning}`,
    ...(r.reasons?.length ? [`Why: ${r.reasons.join('; ')}`] : []),
    '',
    'My question:',
    '',
    dataLine(a, { S: hand }),
  ].join('\n');
}
