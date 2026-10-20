import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advise } from '../js/engine.js';
import { cardCount } from '../js/cards.js';
import {
  newCode, CODE, dealHands, unpackHand, packHand, newTable, normalize, sit, leave, setOpponents, setSeatKind,
  call, turn, isDone, playRobot, robotCall, nextBoard, rebid, boardDealer, boardVul, mySeat, auctionOf, undo, lastOwnCall,
  PROTO, prank, takeOver, giveBack, keepRobot, choicePending, hostOf, kick, allowBack, moveSeat, autoDeclare, unswap, seatsAtBidding, parseCode, say, restoreChat, chatKey, claimChance, pendingClaim, requestClaim, answerClaim, cancelClaim, phase, playOf, playCard, skipPlay, actor, undoCard, lastOwnCard, requestUndo, answerUndo, cancelUndo, pendingUndo,
} from '../js/table/model.js';
import { score, legalCards, trickWinner } from '../js/table/play.js';
import { reviewRows, systemAuction, contract } from '../js/table/review.js';
import { memoryHub } from '../js/table/sync.js';
import { boardReport } from '../js/report.js';
import { mulberry32 } from './helpers.js';

const rand = mulberry32(7);
const SEATS_ALL = ['N', 'E', 'S', 'W'];
const fresh = (opponents = 'robot') => newTable({ code: 'ABC234', uid: 'me', name: 'Kan', opponents, rand });
// North and South played by robots: the creator stands up first.
const robotsNS = (t) => setSeatKind(setSeatKind(leave(t, 'me'), 'S', 'robot'), 'N', 'robot');

test('codes and deals are well formed', () => {
  assert.match(newCode(rand), CODE);
  const hands = dealHands(rand);
  const all = Object.values(hands).map(unpackHand);
  assert.ok(all.every((h) => cardCount(h) === 13));
  assert.equal(new Set(Object.values(hands).join('').replace(/\./g, '')).size > 0, true);
  const counts = {};
  for (const h of all) for (const [s, r] of Object.entries(h)) for (const c of r) counts[s + c] = (counts[s + c] ?? 0) + 1;
  assert.equal(Object.keys(counts).length, 52);
  assert.equal(packHand(unpackHand('AKQ.J.T98765.432')), 'AKQ.J.T98765.432');
});

test('board rotation follows duplicate boards', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(boardDealer), ['N', 'E', 'S', 'W', 'N']);
  assert.deepEqual([1, 2, 3, 4, 5, 9, 16].map(boardVul), ['none', 'NS', 'EW', 'both', 'NS', 'EW', 'EW']);
});

test('a new table seats its creator South with robot opponents', () => {
  const t = fresh();
  assert.equal(mySeat(t, 'me'), 'S');
  assert.equal(t.seats.N.kind, 'open');
  assert.equal(t.seats.E.kind, 'robot');
  assert.equal(t.seats.W.kind, 'robot');
});

test('seats: partner joins, the other pair can join when opponents are players', () => {
  let t = sit(fresh(), 'N', 'pard', 'Ploy');
  assert.equal(mySeat(t, 'pard'), 'N');
  assert.equal(sit(t, 'N', 'someone', 'X'), undefined, 'a taken seat stays taken');
  t = setOpponents(t, 'players');
  assert.equal(t.seats.E.kind, 'open');
  t = sit(t, 'E', 'opp1', 'A');
  t = setOpponents(t, 'pass');
  assert.equal(t.seats.E.kind, 'pass', 'switching back replaces the opponents');
  t = setOpponents(t, 'players');
  t = sit(t, 'W', 'opp2', 'B');
  assert.equal(setOpponents(t, 'players').seats.W.uid, 'opp2', 'players already seated stay');
  assert.equal(mySeat(leave(t, 'opp2'), 'opp2'), null);
  assert.equal(setSeatKind(t, 'S', 'robot'), undefined, 'a human seat cannot be given to a robot');
  const r = setOpponents(t, 'robot');
  assert.equal(r.seats.N.uid, 'pard', 'the opponents setting never touches North-South');
  assert.equal(r.seats.E.kind, 'robot');
});

test('host: the creator removes or moves players; nobody else can', () => {
  let t = setOpponents(sit(fresh(), 'N', 'pard', 'Ploy'), 'players');
  t = sit(sit(t, 'E', 'opp1', 'A'), 'W', 'opp2', 'B');
  assert.equal(hostOf(t), 'me');
  assert.equal(kick(t, 'pard', 'E'), undefined, 'a player is not the host');
  assert.equal(kick(t, 'me', 'S'), undefined, 'the host cannot remove themselves');
  assert.equal(kick(t, 'me', 'N').seats.N.kind, 'open');
  const k = kick(t, 'me', 'E');
  assert.equal(k.seats.E.kind, 'open');
  assert.equal(sit(k, 'E', 'opp1', 'A'), undefined, 'a removed player cannot sit again');
  assert.equal(sit(k, 'E', 'opp3', 'C').seats.E.uid, 'opp3', 'someone else can');
  const back = allowBack(k, 'me', 'opp1');
  assert.equal(back.kicked, undefined);
  assert.equal(sit(back, 'E', 'opp1', 'A').seats.E.uid, 'opp1');
  assert.equal(allowBack(k, 'pard', 'opp1'), undefined);
  // The removal survives a round trip through the database.
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(k))).kicked, { opp1: 'A' });
  // Moving: to an empty seat, or swapping two players.
  const m = moveSeat(k, 'me', 'W', 'E');
  assert.equal(m.seats.E.uid, 'opp2');
  assert.equal(m.seats.W.kind, 'open');
  const sw = moveSeat(t, 'me', 'E', 'W');
  assert.equal(sw.seats.E.uid, 'opp2');
  assert.equal(sw.seats.W.uid, 'opp1');
  assert.equal(moveSeat(t, 'pard', 'E', 'W'), undefined);
  assert.equal(moveSeat(setOpponents(t, 'robot'), 'me', 'S', 'E'), undefined, 'not onto a robot seat');
  assert.equal(moveSeat(fresh(), 'me', 'N', 'E'), undefined, 'nobody sits at N');
  // Without a recorded host (an older table) the first player in the order S, N, E, W is the host.
  const { host: _h, ...old } = t;
  assert.equal(hostOf(old), 'me');
  assert.equal(hostOf(leave(old, 'me')), 'pard');
  // The host's own seat does not matter: they stay host after standing up and sitting elsewhere.
  assert.equal(hostOf(sit(leave(t, 'pard'), 'N', 'me', 'Kan')), 'me');
});

test('only the player whose turn it is can call, and only legal calls', () => {
  let t = sit(fresh('pass'), 'N', 'pard', 'Ploy');
  const first = turn(t);
  assert.equal(first, t.board.dealer);
  const owner = first === 'S' ? 'me' : first === 'N' ? 'pard' : null;
  if (owner) {
    assert.equal(call(t, first, '1C', 'intruder'), undefined);
    assert.equal(call(t, first, 'X', owner), undefined, 'no double without a bid');
    t = call(t, first, '1C', owner);
    assert.equal(auctionOf(t.board).calls[0], '1C');
  } else {
    t = playRobot(t, advise);
    assert.equal(auctionOf(t.board).calls[0], 'P', 'an always-pass seat passes');
  }
});

test('robots bid with the engine and the auction completes', () => {
  let t = robotsNS(fresh('robot'));
  for (let g = 0; g < 60 && !isDone(t); g++) t = playRobot(t, advise);
  assert.ok(isDone(t));
  assert.equal(robotCall(t, advise), undefined);
  const sys = systemAuction(t.board, t.seats);
  assert.deepEqual(sys.calls, auctionOf(t.board).calls, 'all robots: the table auction is the Advisor auction');
});

test('next board keeps history; bid it again keeps the cards', () => {
  let t = robotsNS(fresh('pass'));
  for (let g = 0; g < 60 && !isDone(t); g++) t = playRobot(t, advise);
  const hands = t.board.hands;
  // A contract is played out (or skipped) before the next board.
  if (phase(t) === 'play') {
    assert.equal(nextBoard(t, rand), undefined, 'not during the play');
    t = skipPlay(t);
  }
  assert.deepEqual(rebid(t).board.hands, hands);
  assert.equal(rebid(t).board.calls, '');
  const n2 = nextBoard(t, rand);
  assert.equal(n2.board.n, 2);
  assert.equal(n2.board.dealer, 'E');
  assert.ok(n2.history[1]);
  assert.equal(nextBoard(n2, rand), undefined, 'not before the auction ends');
});

test('normalize repairs what a database returns', () => {
  assert.equal(normalize(null), null);
  const t = normalize({ board: { n: 2, hands: {}, }, seats: { N: { kind: 'bogus' }, S: { kind: 'human', uid: 'u', name: 'n' } } });
  assert.equal(t.seats.N.kind, 'open');
  assert.equal(t.board.calls, '');
  assert.equal(t.board.dealer, 'E');
});

test('review compares human calls with the Advisor', () => {
  let t = sit(fresh('pass'), 'N', 'pard', 'Ploy');
  t = { ...t, board: { ...t.board, dealer: 'S', hands: { ...t.board.hands, S: 'AKQ85.J7.Q84.QT5' } } };
  t = call(t, 'S', '7N', 'me');
  for (let g = 0; g < 4 && !isDone(t); g++) t = playRobot(t, advise) ?? call(t, turn(t), 'P', turn(t) === 'N' ? 'pard' : 'me');
  const rows = reviewRows(t.board, t.seats);
  assert.equal(rows[0].call, '7N');
  assert.equal(rows[0].differs, true);
  assert.equal(rows[0].advisor.call, '1S');
  assert.deepEqual(contract(auctionOf(t.board)), { bid: '7N', declarer: 'S', doubled: '' });
});

test('two phones racing to make the robot call: only one call goes through', async () => {
  const hub = memoryHub();
  const a = hub('me');
  const b = hub('pard');
  await a.change('ABC234', () => fresh('robot'));
  await b.change('ABC234', (t) => sit(t, 'N', 'pard', 'Ploy'));
  // Make East the dealer's turn: board 2.
  await a.change('ABC234', (t) => ({ ...t, board: { ...t.board, n: 2, dealer: 'E', vul: 'NS', calls: '' } }));
  const both = await Promise.all([a, b].map((s) => s.change('ABC234', (t) => (t.board.calls === '' ? playRobot(t, advise) : undefined))));
  assert.equal(both.filter(Boolean).length, 1);
  let seen = null;
  a.watch('ABC234', (t) => { seen = t; });
  assert.equal(auctionOf(seen.board).calls.length, 1);
});

test('undo takes back my last call and everything after it, for every player', () => {
  let t = sit(fresh('robot'), 'N', 'pard', 'Ploy');
  t = { ...t, board: { ...t.board, dealer: 'S', calls: '' } };
  assert.equal(undo(t, 'me'), undefined, 'nothing to undo yet');
  t = call(t, 'S', '1H', 'me');
  t = playRobot(t, advise); // West
  assert.equal(lastOwnCall(t, 'me'), 0);
  assert.equal(undo(t, 'me').board.calls, '', 'my 1♥ and the robot reply are gone');
  t = call(t, 'N', '2H', 'pard');
  assert.equal(undo(t, 'me').board.calls, '', 'I can take back my 1♥ even after partner has called (their call goes too)');
  assert.equal(undo(t, 'pard').board.calls.split(' ').length, 2, 'partner can take back 2♥');
  assert.equal(undo(t, 'stranger'), undefined);
});

test('the board report has the hands, the auction, the differences and a replayable data line', async () => {
  const { boardReport, advisorReport } = await import('../js/report.js');
  let t = sit(fresh('pass'), 'N', 'pard', 'Ploy');
  t = { ...t, board: { ...t.board, dealer: 'S', vul: 'both', hands: { ...t.board.hands, S: 'AKQ85.J7.Q84.QT5' } } };
  t = call(t, 'S', '7N', 'me');
  for (let g = 0; g < 4 && !isDone(t); g++) t = playRobot(t, advise) ?? call(t, turn(t), 'P', turn(t) === 'N' ? 'pard' : 'me');
  const text = boardReport(t, 'S');
  assert.match(text, /Board 1 · Dealer South · Both vulnerable/);
  assert.match(text, /South \(Kan, me\): ♠AKQ85 ♥J7 ♦Q84 ♣Q105/);
  assert.match(text, /S: 7NT/);
  assert.match(text, /South bid 7NT; Advisor: 1♠/);
  assert.match(text, /Data: dealer=S vul=both calls=7N P P P .*S=AKQ85\.J7\.Q84\.QT5/);
  const adv = advisorReport(unpackHand('AKQ85.J7.Q84.QT5'), { dealer: 'S', vul: 'none', calls: [] }, advise(unpackHand('AKQ85.J7.Q84.QT5'), { dealer: 'S', vul: 'none', calls: [] }));
  assert.match(adv, /Suggested: 1♠/);
  assert.match(adv, /Data: dealer=S vul=none calls=- S=AKQ85\.J7\.Q84\.QT5/);
});

test('the review compares only a player\'s first difference', () => {
  let t = sit(fresh('pass'), 'N', 'pard', 'Ploy');
  t = { ...t, board: { ...t.board, dealer: 'S', hands: { ...t.board.hands, S: 'AKQ85.J7.Q84.QT5' } } };
  t = call(t, 'S', '2S', 'me');   // the Advisor opens 1♠
  t = playRobot(t, advise);       // West passes
  t = call(t, 'N', '3S', 'pard');
  t = playRobot(t, advise);       // East passes
  t = call(t, 'S', 'P', 'me');
  const rows = reviewRows(t.board, t.seats).filter((r) => r.human && r.seat === 'S');
  assert.equal(rows[0].differs, true);
  assert.equal(rows[1].skipped, true);
  assert.equal(rows[1].differs, false);
  assert.match(boardReport(t, 'S'), /first difference only/);
});

test('the review says why the player\'s own call does not fit their hand (board 21)', async () => {
  const { misfit } = await import('../js/table/review.js');
  const { explain } = await import('../js/engine.js');
  const hand = unpackHand('AK843.J8.862.543');
  const rows = explain({ dealer: 'N', vul: 'NS', calls: ['1C', '1D', '1S', '2D', 'P', 'P', '2N'] }, undefined, { general: true });
  const why = misfit(hand, rows.at(-1));
  assert.deepEqual(why, ['it claims a ♦ stopper; you hold 862 in diamonds']);
  // A call that fits says nothing.
  assert.deepEqual(misfit(hand, rows[2]), []);
  // Strength: a 2/1 forcing response with 8 HCP.
  const gf = explain({ dealer: 'N', calls: ['1S', 'P', '2C'] }).at(-1);
  assert.match(misfit(unpackHand('KJ4.J8.862.A5432'), gf).join(' '), /shows 12\+ HCP; you have 9/);
});

test('the play: follow suit, tricks, declarer plays dummy, robots finish the board, and the score', () => {
  // South declares 1NT; West leads. South (human) plays dummy's (North's) cards too.
  let t = { ...fresh('robot'), board: { n: 1, dealer: 'S', vul: 'none', hands: { N: 'AK2.AK2.AK2.5432', E: 'QJT.QJT.QJT.QJT9', S: '987.987.987.AK87', W: '6543.6543.6543.6' }, calls: '1N P P P', play: '', skip: false } };
  t = { ...t, seats: { ...t.seats, N: { kind: 'robot' } } };
  assert.equal(phase(t), 'play');
  assert.equal(playOf(t.board).next, 'W', 'the opening lead is from declarer\'s left');
  assert.equal(actor(t), 'W');
  t = playRobot(t, advise);
  const st = playOf(t.board);
  assert.equal(st.next, 'N');
  assert.equal(actor(t), 'S', 'declarer chooses dummy\'s card');
  assert.equal(playRobot(t, advise), undefined, 'robots do not play for a human declarer');
  const led = st.current[0].card[0];
  const bad = st.remaining.N.find((c) => c[0] !== led);
  assert.equal(playCard(t, 'N', bad, 'me'), undefined, 'must follow suit');
  const good = legalCards(st, 'N')[0];
  t = playCard(t, 'N', good, 'me');
  assert.equal(lastOwnCard(t, 'me') >= 0, true);
  assert.equal(undoCard(t, 'me').board.play.split(' ').length, 1);
  // Let the robots play everything, with South's cards chosen as a robot would.
  for (let g = 0; g < 60 && phase(t) === 'play'; g++) t = playRobot({ ...t, seats: { ...t.seats, S: { kind: 'robot' } } }, advise);
  assert.equal(phase(t), 'over');
  const end = playOf(t.board);
  assert.equal(end.tricks.length, 13);
  assert.equal(end.declarerTricks + end.defenderTricks, 13);
  assert.ok(nextBoard(t, rand));
});

test('trick winner and duplicate scores', () => {
  assert.equal(trickWinner([{ seat: 'N', card: 'HA' }, { seat: 'E', card: 'S2' }, { seat: 'S', card: 'HK' }, { seat: 'W', card: 'S3' }], 'S'), 'W');
  assert.equal(trickWinner([{ seat: 'N', card: 'H5' }, { seat: 'E', card: 'D2' }, { seat: 'S', card: 'HK' }, { seat: 'W', card: 'H3' }], null), 'S');
  assert.equal(score({ bid: '4S', declarer: 'N', doubled: '' }, 'NS', 10), 620);
  assert.equal(score({ bid: '3N', declarer: 'E', doubled: '' }, 'none', 10), 430);
  assert.equal(score({ bid: '2D', declarer: 'S', doubled: 'X' }, 'none', 8), 180);
  assert.equal(score({ bid: '4H', declarer: 'S', doubled: 'X' }, 'NS', 7), -800);
  assert.equal(score({ bid: '4H', declarer: 'S', doubled: 'X' }, 'none', 6), -800);
  assert.equal(score({ bid: '6S', declarer: 'N', doubled: '' }, 'none', 12), 980);
  assert.equal(score({ bid: '1N', declarer: 'W', doubled: '' }, 'NS', 6), -50);
});

test('robot card play: finesse, play for the drop, cover an honour', async () => {
  const { playState, robotCard } = await import('../js/table/play.js');
  const H = (o) => Object.fromEntries(Object.entries(o).map(([s, h]) => [s, unpackHand(h)]));
  const k = { bid: '3N', declarer: 'S', doubled: '' };
  // South leads a small spade towards North's AQ; West plays low: North finesses the queen.
  let hands = H({ N: 'AQ3.AK2.AK2.5432', E: 'K54.QJT.QJT.QJT9', S: '762.987.987.AK87', W: 'JT98.6543.6543.6' });
  let st = playState(hands, k, '');
  st = { ...st, started: true, current: [{ seat: 'S', card: 'S2' }, { seat: 'W', card: 'S8' }], next: 'N' };
  assert.equal(robotCard(st, 'N', { calls: [] }), 'SQ');
  // Nine cards missing the queen: play for the drop (the ace), not the finesse.
  hands = H({ N: 'AJ32.AK2.AK2.543', E: 'Q8.QJT5.QJT5.QJT', S: 'K7654.987.987.AK', W: 'T9.643.643.98762' });
  st = { ...playState(hands, k, ''), started: true, current: [{ seat: 'S', card: 'S4' }, { seat: 'W', card: 'S8' }], next: 'N' };
  assert.equal(robotCard(st, 'N', { calls: [] }), 'SA');
  // Declarer leads the queen from Q-x: second hand covers with the king.
  hands = H({ N: 'A32.AK2.AK2.5432', E: 'K54.QJT.QJT.QJT9', S: 'Q76.987.987.AK87', W: 'JT98.6543.6543.6' });
  st = { ...playState(hands, k, ''), started: true, current: [{ seat: 'S', card: 'SQ' }], next: 'W' };
  assert.equal(robotCard(st, 'W', { calls: [] }), 'S9', 'no card above the queen: West gives count, high with four');
  hands = H({ N: '432.AK2.AK2.5432', E: 'A54.QJT.QJT.QJT9', S: 'Q76.987.987.AK87', W: 'KJT9.6543.6543.6' });
  st = { ...playState(hands, k, ''), started: true, current: [{ seat: 'S', card: 'SQ' }], next: 'W' };
  assert.equal(robotCard(st, 'W', { calls: [] }), 'SK', 'cover the queen with the king');
});

test('double-dummy robot: sampled layouts keep known cards and voids; it finds the winning card', async () => {
  const { playState } = await import('../js/table/play.js');
  const { ddChoose, sampleLayout } = await import('../js/table/dd.js');
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const H = (o) => Object.fromEntries(Object.entries(o).map(([s, h]) => [s, unpackHand(h)]));
  const hands = H({ N: 'AK2.AK2.AK2.5432', E: 'QJT.QJT.QJT.QJT9', S: '987.987.987.AK87', W: '6543.6543.6543.6' });
  const k = { bid: '3N', declarer: 'S', doubled: '' };
  let st = playState(hands, k, 'D3');
  const layout = sampleLayout(st, 'N', null, Math.random);
  // North (dummy, played by declarer) sees South's cards: only East and West are dealt at random.
  assert.deepEqual(Object.keys(layout).sort(), ['E', 'W']);
  assert.equal(layout.E.length, 13);
  assert.equal(layout.W.length, 12);
  const r = ddChoose(dds, st, 'N', { maxSamples: 4, minSamples: 4, timeMs: 1e9 });
  assert.ok(['DA', 'DK', 'D2'].includes(r.card));
  // A short ending (three cards each) is solved too.
  const end = H({ N: '.A.K.Q', E: '.KQ.J.', S: 'A.2.2.', W: '.J.Q.J' });
  st = { ...playState(end, { bid: '4S', declarer: 'S', doubled: '' }, ''), started: true, next: 'S' };
  const best = ddChoose(dds, st, 'S', { maxSamples: 3, minSamples: 3, timeMs: 1e9 });
  assert.ok(best.card, 'a card is chosen');
});

test('signals: attitude on partner\'s lead, and partner reads it when placing the cards', async () => {
  const { playState, robotCard } = await import('../js/table/play.js');
  const { sampleLayout } = await import('../js/table/dd.js');
  const H = (o) => Object.fromEntries(Object.entries(o).map(([s, h]) => [s, unpackHand(h)]));
  // South declares 4♠; West leads the ♦A. East holds ♦K82: encourages with the 8 (from K-8-2).
  const hands = H({ N: 'K54.A32.763.AQ32', E: '32.J987.K82.J987', S: 'AQJT98.KQ4.54.K4', W: '76.T65.AQJT9.T65' });
  const k = { bid: '4S', declarer: 'S', doubled: '' };
  let st = playState(hands, k, 'DA D3');
  assert.equal(robotCard(st, 'E', { calls: [] }), 'D8', 'encourage with the king');
  // West sees East's 8 and dummy's cards: in every layout West samples, East holds the ♦K
  // (or the 8 was a singleton, which signals nothing). Without the signal, East would often lack the king.
  st = playState(hands, k, 'DA D3 D8 D4');
  for (let i = 0; i < 30; i++) {
    const layout = sampleLayout(st, 'W', null, Math.random);
    assert.ok(layout.E.includes('DK') || !layout.E.some((c) => c[0] === 'D'), 'East encouraged: the king, or a singleton 8');
  }
});

test('signals: first discard and suit preference when giving a ruff', async () => {
  const { playState, discardSignal, suitPreferenceLead } = await import('../js/table/play.js');
  const H = (o) => Object.fromEntries(Object.entries(o).map(([s, h]) => [s, unpackHand(h)]));
  const k = { bid: '4S', declarer: 'S', doubled: '' };
  // East, out of clubs, discards: the ♥8 (high spot) asks for hearts, where East holds the A-Q.
  let hands = H({ N: 'K54.32.7632.AQ32', E: '32.AQ82.KJT98.', S: 'AQJT98.KJ4.54.K4', W: '76.T765.AQ.JT9876' });
  let st = { ...playState(hands, k, ''), started: true, current: [{ seat: 'S', card: 'CK' }], next: 'W' };
  st = { ...st, current: [{ seat: 'S', card: 'CK' }, { seat: 'W', card: 'C6' }, { seat: 'N', card: 'C2' }], next: 'E' };
  assert.equal(discardSignal(st, 'E', st.remaining.E.filter((c) => c[0] !== 'S')), 'H8');
  // With nothing worth asking for, the lowest card of a suit we do not want.
  hands = H({ N: 'K54.32.7632.AQ32', E: '32.T982.JT987.Q', S: 'AQJT98.KJ4.54.K4', W: '76.AQ765.AKQ.JT9' });
  st = { ...playState(hands, k, 'CJ C2 CQ CK'), started: true };
  st = { ...st, current: [{ seat: 'S', card: 'C4' }, { seat: 'W', card: 'C9' }, { seat: 'N', card: 'C3' }], next: 'E' };
  assert.equal(discardSignal(st, 'E', st.remaining.E.filter((c) => c[0] !== 'S')), 'D7');
  // East ruffed West's club lead. West leads another club for a second ruff; West's entry is the ♦A
  // (the lower of hearts and diamonds), so West leads its lowest club.
  hands = H({ N: 'K54.K32.7632.AQ2', E: '32.QJ9875.KJT98.', S: 'AQJT98.A4.54.K54', W: '76.T6.AQ.JT98763' });
  st = { ...playState(hands, k, 'C6 C2 S2 C4'), next: 'W' };
  assert.equal(suitPreferenceLead(st, 'W', st.remaining.W.filter((c) => c[0] === 'C')), 'C3');
  // With the entry in hearts (the higher suit) instead, the highest club.
  st = { ...st, remaining: { ...st.remaining, W: ['S7', 'S6', 'HA', 'H6', 'D3', 'D2', 'CJ', 'CT', 'C9', 'C8', 'C7', 'C3'] } };
  assert.equal(suitPreferenceLead(st, 'W', ['CJ', 'CT', 'C9', 'C8', 'C7', 'C3']), 'CJ');
});

test('parallel scoring: shares from several workers add up like one run, and the card is picked from the sum', async () => {
  const { playState, legalCards } = await import('../js/table/play.js');
  const { ddScores, mergeScores, pickCard, ddChoose } = await import('../js/table/dd.js');
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const H = (o) => Object.fromEntries(Object.entries(o).map(([s, h]) => [s, unpackHand(h)]));
  const hands = H({ N: 'AK2.AK2.AK2.5432', E: 'QJT.QJT.QJT.QJT9', S: '987.987.987.AK87', W: '6543.6543.6543.6' });
  const st = playState(hands, { bid: '3N', declarer: 'S', doubled: '' }, 'D3');
  const a = ddScores(dds, st, 'N', { maxSamples: 3, minSamples: 3, timeMs: 1e9 });
  const b = ddScores(dds, st, 'N', { maxSamples: 5, minSamples: 5, timeMs: 1e9 });
  const m = mergeScores([a, null, b]);
  assert.equal(m.n, 8);
  for (const c of legalCards(st, 'N')) assert.equal(m.total[c], a.total[c] + b.total[c]);
  assert.deepEqual(mergeScores([null, { n: 0, total: {} }]), { n: 0, total: {} });
  assert.equal(pickCard(st, 'N', { n: 0, total: {} }), null);
  const pick = pickCard(st, 'N', m);
  assert.ok(legalCards(st, 'N').includes(pick.card));
  assert.equal(pick.samples, 8);
  assert.ok(ddChoose(dds, st, 'N', { maxSamples: 2, minSamples: 2, timeMs: 1e9 }).card);
});

test('four humans at one table: each plays only their own seat, a whole board and the next one, no robots involved', async () => {
  const hub = memoryHub();
  const uids = { S: 'me', N: 'pard', E: 'opp1', W: 'opp2' };
  const sync = Object.fromEntries(Object.values(uids).map((u) => [u, hub(u)]));
  await sync.me.change('ABC234', () => fresh('players'));
  for (const s of ['N', 'E', 'W']) await sync[uids[s]].change('ABC234', (t) => sit(t, s, uids[s], s));
  let seen = null;
  sync.me.watch('ABC234', (t) => { seen = t; });
  assert.ok(SEATS_ALL.every((s) => seen.seats[s].kind === 'human'), 'all four seats are people');

  // Bidding: the Advisor stands in for what each person would choose; only the owner of the seat can make the call.
  for (let g = 0; g < 60 && !isDone(seen); g++) {
    const s = turn(seen);
    const r = advise(unpackHand(seen.board.hands[s]), auctionOf(seen.board));
    const c = r.notCovered ? 'P' : r.call;
    const other = uids[SEATS_ALL[(SEATS_ALL.indexOf(s) + 1) % 4]];
    assert.ok(!(await sync[other].change('ABC234', (t) => call(t, s, c, other))), 'nobody can call for another seat');
    assert.equal(playRobot(seen, advise), undefined, 'no robot acts at a table of people');
    await sync[uids[s]].change('ABC234', (t) => call(t, s, c, uids[s]));
  }
  assert.ok(isDone(seen));
  if (phase(seen) === 'play') {
    for (let g = 0; g < 60 && phase(seen) === 'play'; g++) {
      const st = playOf(seen.board);
      const who = actor(seen);
      const card = legalCards(st, st.next)[0];
      const stranger = uids[SEATS_ALL.find((x) => x !== who && x !== st.next)];
      assert.ok(!(await sync[stranger].change('ABC234', (t) => playCard(t, st.next, card, stranger))), 'nobody plays another player\'s card');
      assert.equal(playRobot(seen, advise), undefined);
      await sync[uids[who]].change('ABC234', (t) => playCard(t, st.next, card, uids[who]));
    }
  }
  assert.equal(phase(seen), 'over');
  await sync.opp2.change('ABC234', (t) => nextBoard(t, rand));
  assert.equal(seen.board.n, 2);
  assert.ok(seen.history[1], 'the finished board is kept for the review');
});

test('a take-back needs the OK of every human who called after it, like on BBO', () => {
  let t = fresh('robot');
  t = sit(t, 'N', 'pard', 'Ploy');
  t = { ...t, board: { ...t.board, dealer: 'S', calls: '' } };
  t = call(t, 'S', '1H', 'me');
  t = playRobot(t, advise); // West
  assert.equal(requestUndo(t, 'me').board.calls, '', 'only a robot called after it: taken back at once');
  t = call(t, 'N', '2H', 'pard');
  const asked = requestUndo(t, 'me');
  assert.equal(asked.board.calls, t.board.calls, 'partner called after my 1♥: nothing changes yet');
  assert.deepEqual(pendingUndo(asked).need, ['pard']);
  assert.equal(requestUndo(asked, 'me'), undefined, 'one request at a time');
  assert.equal(answerUndo(asked, 'me', true), undefined, 'I cannot allow my own request');
  assert.equal(answerUndo(asked, 'stranger', true), undefined);
  const no = answerUndo(asked, 'pard', false);
  assert.equal(pendingUndo(no), null, 'denied: the request is gone');
  assert.equal(no.board.calls, t.board.calls);
  const yes = answerUndo(asked, 'pard', true);
  assert.equal(yes.board.calls, '', 'allowed: my call and partner\'s call are taken back');
  assert.equal(pendingUndo(yes), null);
  assert.equal(pendingUndo(cancelUndo(asked, 'me')), null, 'the asker can withdraw');
  // A request goes stale as soon as anything is called after it was made.
  const moved = call(asked, 'E', 'P', 'rob');
  assert.equal(pendingUndo(moved), null);
});

test('a table code is found in whatever was typed or pasted', () => {
  assert.equal(parseCode('abc234'), 'ABC234');
  assert.equal(parseCode(' ABC 234 '), 'ABC234');
  assert.equal(parseCode('https://kanoonzaza.github.io/bridge-app/?table=abc234&sync=local'), 'ABC234');
  assert.equal(parseCode('Join my table: ABC234 :)'), 'ABC234');
  assert.equal(parseCode('ABC1O0'), '', 'no 0, 1, I or O in a code');
  assert.equal(parseCode('ABC23'), '');
  assert.equal(parseCode(null), '');
});

test('chat: seated players talk to the table, messages are trimmed and capped', () => {
  let t = fresh('robot');
  assert.equal(say(t, 'me', '   ', 5), undefined, 'empty message');
  assert.equal(say(t, 'stranger', 'hello', 5), undefined, 'not seated');
  t = say(t, 'me', '  Nice  bid!  ', 5);
  assert.equal(t.chat.length, 1);
  assert.deepEqual({ ...t.chat[0] }, { id: 1, uid: 'me', name: 'Kan', seat: 'S', text: 'Nice bid!', at: 5 });
  t = sit(t, 'N', 'pard', 'Ploy');
  t = say(t, 'pard', 'x'.repeat(500), 6);
  assert.equal(t.chat[1].text.length, 200);
  assert.equal(t.chat[1].id, 2);
  for (let i = 0; i < 70; i++) t = say(t, 'me', `m${i}`, 7);
  assert.equal(t.chat.length, 72, 'every message is kept (up to the last 200)');
  for (let i = 0; i < 300; i++) t = say(t, 'me', `n${i}`, 8);
  assert.equal(t.chat.length, 200, 'only the last 200 are kept');
  assert.equal(t.chat.at(-1).text, 'n299');
  // The database may hand the list back as an object.
  const back = normalize(JSON.parse(JSON.stringify({ ...t, chat: { ...t.chat } })));
  assert.equal(back.chat.length, 200);
  assert.equal(back.chat.at(-1).text, 'n299');
  assert.deepEqual(normalize({ ...t, chat: undefined }).chat, []);
});

test('claiming: robot defenders accept a claim that is right double dummy, human defenders decide', () => {
  // South declares 7NT; West holds every club and leads the ace, so after one trick it is West's lead again.
  const hands = { N: '.AKQJT98765432..', E: '..AKQJT98765432.', S: 'AKQJT98765432...', W: '...AKQJT98765432' };
  let t = fresh('robot');
  t = setSeatKind(t, 'N', 'robot');
  t = { ...t, board: { ...t.board, dealer: 'S', vul: 'none', hands, calls: '7N P P P', play: 'CA H2 D2 S2' } };
  assert.equal(phase(t), 'play');
  assert.equal(claimChance(t, 'me').left, 12);
  assert.equal(claimChance(t, 'stranger'), null);
  assert.equal(requestClaim(t, 'me', 12, 0), undefined, 'the solver says the defenders take everything: robots reject');
  const done = requestClaim(t, 'me', 0, 0);
  assert.equal(done.board.claim, 0, 'conceding every trick is always accepted');
  assert.equal(phase(done), 'over');
  // With a human East the claim waits for East's answer.
  let h = sit(setSeatKind(t, 'E', 'open'), 'E', 'east', 'Eve');
  const asked = requestClaim(h, 'me', 0, 0);
  assert.equal(asked.board.claim, undefined);
  assert.deepEqual(pendingClaim(asked).need, ['east']);
  assert.equal(answerClaim(asked, 'me', true), undefined, 'declarer cannot answer');
  assert.equal(pendingClaim(answerClaim(asked, 'east', false)), null, 'rejected: play on');
  assert.equal(answerClaim(asked, 'east', true).board.claim, 0);
  assert.equal(pendingClaim(cancelClaim(asked, 'me')), null);
  // The robot defender West still checks the number: 5 of 12 is not right.
  assert.equal(requestClaim(h, 'me', 5, 3), undefined);
  assert.equal(pendingClaim(requestClaim(h, 'me', 3, 3)).tricks, 3);
  // Only between tricks, and only the declarer.
  assert.equal(claimChance({ ...t, board: { ...t.board, play: 'CA H2' } }, 'me'), null);
  assert.equal(claimChance(t, 'pard'), null);
});

test('chat: messages an older app version dropped are put back, and unknown table fields pass through', () => {
  let t = fresh('robot');
  t = say(t, 'me', 'first', 100);
  t = say(t, 'me', 'second', 200);
  const kept = t.chat.map(({ uid, name, seat, text, at }) => ({ uid, name, seat, text, at }));
  const wiped = { ...t, chat: [] };
  const back = restoreChat(wiped, kept);
  assert.deepEqual(back.chat.map((m) => m.text), ['first', 'second']);
  assert.deepEqual(back.chat.map((m) => m.id), [1, 2]);
  assert.equal(restoreChat(back, kept), undefined, 'nothing missing: no change');
  // One message missing in the middle of what others have said since: merged by time.
  const other = { ...say(sit(wiped, 'N', 'pard', 'Ploy'), 'pard', 'third', 300) };
  assert.deepEqual(restoreChat(other, kept).chat.map((m) => m.text), ['first', 'second', 'third']);
  assert.equal(new Set(back.chat.map(chatKey)).size, 2);
  // A field added by a newer version survives a rewrite by this one.
  assert.equal(normalize({ ...t, futureThing: { a: 1 } }).futureThing.a, 1);
});

test('alone with a robot partner and robot opponents, the human takes over partner\'s contract', () => {
  let t = fresh('robot');
  t = setSeatKind(t, 'N', 'robot');
  // Dealer North: North opens 1♠ and everyone passes, so North (the robot) declares.
  assert.equal(t.board.swap, undefined);
  t = { ...t, board: { ...t.board, calls: '1S P P P' } };
  t = autoDeclare(t);
  assert.equal(t.board.swap, 'S>N', 'I moved from South to North');
  assert.equal(t.seats.N.kind, 'human');
  assert.equal(t.seats.N.uid, 'me');
  assert.equal(t.seats.S.kind, 'robot');
  assert.equal(mySeat(t, 'me'), 'N');
  assert.equal(autoDeclare(t), t, 'only once');
  assert.equal(seatsAtBidding(t).S.uid, 'me', 'the review still sees me as South');
  assert.equal(seatsAtBidding(t).N.kind, 'robot');
  // Taking my last call back rewinds the swap; the call is found at my bidding seat.
  assert.equal(lastOwnCall(t, 'me'), 2, 'my pass is call 2, found at my bidding seat');
  const back = unswap(t);
  assert.equal(back.board.swap, undefined);
  assert.equal(back.seats.S.uid, 'me');
  assert.equal(back.seats.N.kind, 'robot');
  // Not when I would declare myself, when the opponents are people, or when another human is seated.
  const mine = { ...fresh('robot'), board: { ...fresh('robot').board, dealer: 'S', calls: '1S P P P' } };
  assert.equal(autoDeclare(setSeatKind(mine, 'N', 'robot')).board.swap, undefined);
  const withPlayers = { ...setSeatKind(fresh('players'), 'N', 'robot'), board: { ...fresh('robot').board, dealer: 'N', calls: '1S P P P' } };
  assert.equal(autoDeclare(withPlayers).board.swap, undefined);
});

test('the choice: take over a robot partner\'s contract at any table, or hand it back', () => {
  const base = { ...setSeatKind(fresh('players'), 'N', 'robot') };
  const withPlayers = { ...base, board: { ...base.board, dealer: 'N', calls: '1S P P P' } };
  assert.equal(withPlayers.board.swap, undefined, 'people at the table: nothing happens by itself');
  const took = takeOver(withPlayers, 'me');
  assert.equal(took.board.swap, 'S>N');
  assert.equal(mySeat(took, 'me'), 'N');
  assert.equal(took.seats.S.kind, 'robot');
  assert.equal(takeOver(took, 'me'), undefined, 'only once');
  assert.equal(takeOver(withPlayers, 'someone'), undefined, 'only a seated player');
  const gave = giveBack(took, 'me');
  assert.equal(gave.board.swap, undefined);
  assert.equal(mySeat(gave, 'me'), 'S');
  assert.equal(gave.seats.N.kind, 'robot');
  assert.equal(giveBack(took, 'other'), undefined);
  // The automatic move can also be handed back.
  const alone = autoDeclare({ ...setSeatKind(fresh('robot'), 'N', 'robot'), board: { ...fresh('robot').board, dealer: 'N', calls: '1S P P P' } });
  assert.equal(giveBack(alone, 'me').seats.S.uid, 'me');
  // The robots wait while the partner chooses; leaving it with the robot (or taking over) ends the wait.
  assert.equal(choicePending(withPlayers), true);
  assert.equal(choicePending(took), false);
  const kept = keepRobot(withPlayers, 'me');
  assert.equal(kept.board.keep, '1S P P P');
  assert.equal(choicePending(kept), false);
  assert.equal(keepRobot(withPlayers, 'someone'), undefined);
  assert.equal(choicePending(gave), false, 'handing it back is a choice too');
  assert.equal(normalize(JSON.parse(JSON.stringify(kept))).board.keep, '1S P P P');
  assert.equal(choicePending({ ...kept, board: { ...kept.board, calls: '1S P P P' } }), false);
  // Not once a card is played, and not when I am the declarer.
  const played = { ...took, board: { ...took.board, play: 'HA' } };
  assert.equal(giveBack(played, 'me'), undefined);
  assert.equal(takeOver({ ...withPlayers, board: { ...withPlayers.board, play: 'HA' } }, 'me'), undefined);
  const mine = { ...base, board: { ...base.board, dealer: 'S', calls: '1S P P P' } };
  assert.equal(takeOver(mine, 'me'), undefined);
});

test('the version stamp survives the database and is dropped by a version that does not know it', () => {
  const t = { ...fresh('robot'), proto: PROTO };
  assert.equal(normalize(JSON.parse(JSON.stringify(t))).proto, PROTO);
  assert.equal(normalize(JSON.parse(JSON.stringify(fresh('robot')))).proto, undefined);
});

test('surprises: a seated player sends one to another human; each is numbered', () => {
  const t = sit(setOpponents(fresh('players'), 'players'), 'N', 'pard', 'Ploy');
  const a = prank(t, 'me', 'N', 2);
  assert.deepEqual({ ...a.fx }, { n: 1, from: 'me', name: 'Kan', to: 'pard', kind: 2 });
  assert.equal(prank(a, 'pard', 'S', 0).fx.n, 2);
  assert.equal(prank(t, 'me', 'S', 0), undefined, 'not to myself');
  assert.equal(prank(t, 'me', 'E', 0), undefined, 'not to an empty seat');
  assert.equal(prank(setSeatKind(leave(t, 'pard'), 'N', 'robot'), 'me', 'N', 0), undefined, 'not to a robot');
  assert.equal(prank(t, 'stranger', 'N', 0), undefined, 'only a seated player');
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(a))).fx, a.fx, 'survives the database');
  assert.equal(normalize({ ...JSON.parse(JSON.stringify(t)), fx: { junk: 1 } }).fx, undefined);
});

test('history keeps the last 100 boards', () => {
  let t = fresh('robot');
  for (let i = 0; i < 130; i++) t = nextBoard({ ...t, board: { ...t.board, calls: 'P P P P' } }, rand);
  assert.equal(Object.keys(t.history).length, 100);
  assert.equal(t.board.n, 131);
  assert.ok(t.history[130] && !t.history[30]);
});
