// Plain-text reports of a board or an Advisor suggestion, to paste into a chat for review.
// The last line ("Data: …") holds everything needed to replay the situation exactly.
import { formatHand } from './cards.js';
import { callLabel } from './format.js';
import { SEATS } from './auction.js';
import { auctionOf, handOf, packHand } from './table/model.js';
import { reviewRows, systemAuction, contract } from './table/review.js';
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

const dataLine = (a, hands) => `Data: dealer=${a.dealer} vul=${a.vul ?? 'none'} calls=${a.calls.join(' ') || '-'} ${Object.entries(hands).map(([s, h]) => `${s}=${packHand(h)}`).join(' ')}`;

export function boardReport(t, me) {
  const b = t.board;
  const a = auctionOf(b);
  const who = (s) => {
    const st = t.seats[s];
    const name = st.kind === 'human' ? st.name || 'Player' : st.kind === 'robot' ? 'Robot' : st.kind === 'pass' ? 'Always passes' : 'Empty';
    return `${COMPASS[s]} (${name}${s === me ? ', me' : ''})`;
  };
  const hands = Object.fromEntries(SEATS.map((s) => [s, handOf(b, s)]));
  const rows = reviewRows(b, t.seats).filter((r) => r.differs);
  const sys = systemAuction(b, t.seats);
  return [
    'Bridge Coach: board for review',
    `Table ${t.code} · Board ${b.n} · Dealer ${COMPASS[b.dealer]} · ${VUL[b.vul]}`,
    '',
    ...SEATS.map((s) => `${who(s)}: ${formatHand(hands[s])}`),
    '',
    'Auction:',
    ...rounds(a),
    `Contract: ${kText(contract(a))}`,
    `The Advisor would bid: ${calls(sys.calls)} → ${kText(contract(sys))}`,
    '',
    rows.length ? 'Where the Advisor differs (each player\'s first difference only):' : 'Every player\'s call matched the Advisor.',
    ...rows.map((r) => `- ${COMPASS[r.seat]} bid ${callLabel(r.call)}; Advisor: ${callLabel(r.advisor.call)}${r.advisor.conf ? ` [${r.advisor.conf.label}]` : ''} (${r.advisor.meaning}${r.advisor.reasons?.length ? `; ${r.advisor.reasons.join('; ')}` : ''})${r.advisor.close ? ` Close call: ${r.advisor.close}` : ''}${r.misfit?.length ? ` [Why ${callLabel(r.call)} does not fit the hand: ${r.misfit.join('; ')}]` : ''}`),
    '',
    'My question:',
    '',
    dataLine(a, hands),
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
