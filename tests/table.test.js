import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advise } from '../js/engine.js';
import { cardCount } from '../js/cards.js';
import {
  newCode, CODE, dealHands, unpackHand, packHand, newTable, normalize, sit, leave, setOpponents, setSeatKind,
  call, turn, isDone, playRobot, robotCall, nextBoard, rebid, boardDealer, boardVul, mySeat, auctionOf, undo, lastOwnCall,
  phase, playOf, playCard, skipPlay, actor, undoCard, lastOwnCard,
} from '../js/table/model.js';
import { score, legalCards, trickWinner } from '../js/table/play.js';
import { reviewRows, systemAuction, contract } from '../js/table/review.js';
import { memoryHub } from '../js/table/sync.js';
import { boardReport } from '../js/report.js';
import { mulberry32 } from './helpers.js';

const rand = mulberry32(7);
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

test('undo takes back my last call and the robot replies after it, not other players\' calls', () => {
  let t = sit(fresh('robot'), 'N', 'pard', 'Ploy');
  t = { ...t, board: { ...t.board, dealer: 'S', calls: '' } };
  assert.equal(undo(t, 'me'), undefined, 'nothing to undo yet');
  t = call(t, 'S', '1H', 'me');
  t = playRobot(t, advise); // West
  assert.equal(lastOwnCall(t, 'me'), 0);
  assert.equal(undo(t, 'me').board.calls, '', 'my 1♥ and the robot reply are gone');
  t = call(t, 'N', '2H', 'pard');
  assert.equal(undo(t, 'me'), undefined, 'partner has called since');
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
  assert.equal(robotCard(st, 'W', { calls: [] }), 'S8', 'West has no card above the queen');
  hands = H({ N: '432.AK2.AK2.5432', E: 'A54.QJT.QJT.QJT9', S: 'Q76.987.987.AK87', W: 'KJT9.6543.6543.6' });
  st = { ...playState(hands, k, ''), started: true, current: [{ seat: 'S', card: 'SQ' }], next: 'W' };
  assert.equal(robotCard(st, 'W', { calls: [] }), 'SK', 'cover the queen with the king');
});
