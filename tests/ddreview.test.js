import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ddReview } from '../js/table/ddreview.js';
import { ddLines, parContractText, cardText, tableRows } from '../js/table/ddtext.js';
import { playState, robotCard } from '../js/table/play.js';
import { dealHands, unpackHand } from '../js/table/model.js';
import { boardReport } from '../js/report.js';
import { newTable } from '../js/table/model.js';
import { mulberry32 } from './helpers.js';

const name = (s) => ({ N: 'North', E: 'East', S: 'South', W: 'West' })[s];

test('par contracts read as words', () => {
  assert.equal(parContractText('4S-EW+1', name), '4♠ by East or West, making +1');
  assert.equal(parContractText('2S*-NS-1', name), '2♠ doubled by North or South, down 1');
  assert.equal(parContractText('3N-W', name), '3NT by West, making');
  assert.equal(cardText('HT'), '♥10');
});

test('double-dummy review of a played board: table, par, and the cards that gave away tricks', async () => {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const hands = Object.fromEntries(Object.entries(dealHands(mulberry32(5))).map(([s, h]) => [s, unpackHand(h)]));
  const k = { bid: '4S', declarer: 'E', doubled: '' };
  const cards = [];
  let st = playState(hands, k, '');
  while (!st.complete) {
    cards.push(robotCard(st, st.next, { dealer: 'N', vul: 'none', calls: [] }));
    st = playState(hands, k, cards.join(' '));
  }
  const rv = ddReview(dds, { hands, k, play: cards.join(' '), dealer: 'N', vul: 'none' });
  assert.equal(rv.table.length, 5);
  assert.ok(rv.table.every((row) => row.length === 4 && row.every((n) => n >= 0 && n <= 13)));
  // North-South and East-West take 13 tricks between them when the same suit is trump and the same side declares.
  for (const row of rv.table) assert.equal(row[0] + row[1] > 0, true);
  assert.equal(rv.contract.tricks, rv.table[0][1], 'the contract is read from spades, East');
  assert.ok(Number.isInteger(rv.par.score));
  for (const m of rv.mistakes) {
    assert.ok(m.lost >= 1 && m.best.length >= 1 && !m.best.includes(m.card));
    assert.ok(m.trick >= 1 && m.trick <= 12);
  }
  const lines = ddLines(rv, { k, took: st.declarerTricks, name });
  assert.match(lines[0], /^With every card visible, 4♠ by East takes \d+ tricks?/);
  assert.ok(lines.some((l) => l.startsWith('Par:')));
  assert.equal(tableRows(rv.table).length, 5);
});

test('perfect play from the solver itself loses no tricks', async () => {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const { solve } = await import('../js/table/dd.js');
  const { legalCards } = await import('../js/table/play.js');
  const dds = new Dds(await loadDds());
  const hands = Object.fromEntries(Object.entries(dealHands(mulberry32(11))).map(([s, h]) => [s, unpackHand(h)]));
  const k = { bid: '3N', declarer: 'S', doubled: '' };
  const cards = [];
  let st = playState(hands, k, '');
  while (!st.complete) {
    const legal = legalCards(st, st.next);
    const sc = solve(dds, st, st.remaining);
    cards.push(legal.reduce((a, c) => ((sc[c] ?? 0) > (sc[a] ?? 0) ? c : a)));
    st = playState(hands, k, cards.join(' '));
  }
  const rv = ddReview(dds, { hands, k, play: cards.join(' '), dealer: 'S', vul: 'both' });
  assert.equal(rv.mistakes.length, 0);
  assert.equal(st.declarerTricks, rv.contract.tricks, 'both sides played perfectly, so declarer takes the double-dummy tricks');
});

test('the copied board report carries the double-dummy lines when they are known', () => {
  let t = newTable({ code: 'ABC234', uid: 'me', name: 'Kan', opponents: 'robot', rand: mulberry32(3) });
  t = { ...t, board: { ...t.board, calls: 'P P P P' } };
  const dd = { table: [[7, 6, 7, 6], [6, 7, 6, 7], [7, 6, 7, 6], [6, 7, 6, 7], [7, 6, 7, 6]], par: { score: 0, contracts: [] }, contract: null, mistakes: [] };
  assert.match(boardReport(t, 'S', dd), /Double dummy:\n- Par: no score\.\n- Tricks as declarer \(N E S W\): ♠ 7 6 7 6/);
  assert.doesNotMatch(boardReport(t, 'S'), /Double dummy/);
});
