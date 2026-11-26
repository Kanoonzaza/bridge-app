import { test } from 'node:test';
import assert from 'node:assert/strict';
import ALL from '../js/system/index.js';
import { newTable, setCard, sit, nextBoard, normalize, cardPending, setOpponents, playedCards, rebid, PROTO } from '../js/table/model.js';
import { normalizeCard, pack, pick, sideCards, HOUSE_CARD } from '../js/pool/card.js';
import { bookOfBoard, bookOfCards, rulesFor } from '../js/pool/system.js';
import { systemAuction, reviewRows } from '../js/table/review.js';
import { mulberry32 } from './helpers.js';

const rand = mulberry32(3);
const ours = pack(normalizeCard({ base: '2/1', name: 'Noon & Pim', discuss: ['keycard'] }));
const theirs = pack(normalizeCard({ base: 'sayc', name: 'Visitors' }));
const fresh = (opponents = 'robot') => newTable({ code: 'ABC234', uid: 'me', name: 'Kan', opponents, rand });

test('protocol 5: tables carry convention cards', () => assert.equal(PROTO, 5));

test('a new table plays the house card on both sides', () => {
  const t = fresh();
  assert.equal(t.cards, undefined);
  assert.equal(t.board.cards, undefined);
  assert.equal(bookOfBoard(t.board), ALL);
});

test('a card chosen before the first call applies now; the robot side copies it', () => {
  const t = setCard(fresh('robot'), 'me', ours);
  assert.deepEqual(t.cards, { NS: ours });
  assert.deepEqual(t.board.cards, { NS: ours, EW: ours }, 'East-West are robots: they play the humans\' card');
  assert.equal(setCard(fresh(), 'stranger', ours), undefined, 'only a seated player chooses');
  assert.equal(setCard(fresh(), 'me', { b: 'nope' }), undefined, 'a card with an unknown system is refused');
});

test('after the first call a change waits for the next board', () => {
  let t = { ...fresh(), board: { ...fresh().board, calls: 'P' } };
  t = setCard(t, 'me', ours);
  assert.equal(t.board.cards, undefined, 'this board keeps the house card');
  assert.equal(cardPending(t, 'NS'), true);
  const done = { ...t, board: { ...t.board, calls: 'P P P P' } };
  const next = nextBoard(done, rand);
  assert.deepEqual(next.board.cards, { NS: ours, EW: ours });
  assert.equal(next.history[t.board.n].cards, undefined, 'the played board keeps the card it was played with');
  assert.equal(cardPending(next, 'NS'), false);
});

test('two pairs on different cards', () => {
  let t = fresh('players');
  t = sit(t, 'E', 'opp1', 'Ann');
  t = setCard(t, 'me', ours);
  t = setCard(t, 'opp1', theirs);
  assert.deepEqual(t.board.cards, { NS: ours, EW: theirs });
  const cards = sideCards(t.board.cards);
  assert.equal(cards.NS.name, 'Noon & Pim');
  assert.equal(cards.EW.base, 'sayc');
  // Back to robots: East-West copy North-South again.
  t = setOpponents(t, 'robot');
  assert.deepEqual(playedCards(t), { NS: ours, EW: ours });
  assert.deepEqual(t.board.cards, { NS: ours, EW: ours });
  // Choosing the house card again.
  t = setCard(t, 'me', null);
  assert.deepEqual(t.cards, { EW: theirs }, 'East-West\'s choice is kept for when they sit again');
  assert.equal(t.board.cards, undefined, 'robots copy the house card now');
});

test('restarting the bidding picks up a waiting change', () => {
  let t = { ...fresh(), board: { ...fresh().board, calls: 'P' } };
  t = setCard(t, 'me', ours);
  assert.equal(t.board.cards, undefined);
  t = rebid(t);
  assert.deepEqual(t.board.cards, { NS: ours, EW: ours });
});

test('normalize keeps good cards, drops bad ones, and an old table plays the house card', () => {
  const t = setCard(fresh(), 'me', ours);
  const back = normalize(JSON.parse(JSON.stringify({ ...t, history: { 1: { ...t.board, cards: { NS: theirs, EW: 'junk' } } } })));
  assert.deepEqual(back.cards, { NS: ours });
  assert.deepEqual(back.board.cards, { NS: ours, EW: ours });
  assert.deepEqual(back.history[1].cards, { NS: theirs });
  const junk = normalize({ ...t, cards: { NS: 7, EW: { b: 5 } }, board: { ...t.board, cards: 'x' } });
  assert.equal(junk.cards, undefined);
  assert.equal(junk.board.cards, undefined);
  const { cards: _c, ...old } = t;
  assert.equal(bookOfBoard(normalize({ ...old, board: { ...t.board, cards: undefined } }).board), ALL);
});

test('the review reads each side with the card the board was played with', () => {
  // E-W play a card without DONT (an option with no rules yet), exactly as written, through a hand-made book.
  const noDont = pick(normalizeCard({ base: '2/1', name: 'No DONT' }), 'nt-defence', 'natural');
  const b = { n: 1, dealer: 'S', vul: 'none', calls: '1N 2H P P P', play: '', hands: { N: 'AK2.Q32.K32.5432', E: '543.AKJ98.Q4.876', S: 'QJ8.K54.AJ65.AKJ', W: 'T976.T76.T987.Q9' } };
  const seats = { N: { kind: 'robot' }, E: { kind: 'robot' }, S: { kind: 'human', uid: 'me' }, W: { kind: 'robot' } };
  const house = reviewRows(b, seats);
  assert.match(house[1].meaning, /DONT/);
  const book = { NS: ALL, EW: rulesFor(noDont) };
  const other = reviewRows(b, seats, book);
  assert.doesNotMatch(other[1].meaning ?? '', /DONT/);
  assert.ok(systemAuction(b, seats, book).calls.length >= 4);
  assert.equal(bookOfCards(null), ALL);
});
