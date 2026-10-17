import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ddReview } from '../js/table/ddreview.js';
import { parLine, parContractText, tableRows } from '../js/table/ddtext.js';
import { dealHands, unpackHand, newTable } from '../js/table/model.js';
import { boardReport } from '../js/report.js';
import { mulberry32 } from './helpers.js';

const name = (s) => ({ N: 'North', E: 'East', S: 'South', W: 'West' })[s];

test('par contracts read as words', () => {
  assert.equal(parContractText('4S-EW+1', name), '4♠ by East or West, making +1');
  assert.equal(parContractText('2S*-NS-1', name), '2♠ doubled by North or South, down 1');
  assert.equal(parContractText('3N-W', name), '3NT by West, making');
});

test('double-dummy table and par of a deal', async () => {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const hands = Object.fromEntries(Object.entries(dealHands(mulberry32(5))).map(([s, h]) => [s, unpackHand(h)]));
  const rv = ddReview(dds, { hands, dealer: 'N', vul: 'none' });
  assert.equal(rv.table.length, 5);
  assert.ok(rv.table.every((row) => row.length === 4 && row.every((n) => n >= 0 && n <= 13)));
  assert.ok(Number.isInteger(rv.par.score));
  assert.match(parLine(rv, { name }), /^Par: (N-S|E-W) \+\d+ \(|^Par: no score/);
  assert.deepEqual(Object.keys(tableRows(rv.table)[0]), ['strain', 'N', 'E', 'S', 'W']);
});

test('the copied board report carries the double-dummy table and par when they are known', () => {
  let t = newTable({ code: 'ABC234', uid: 'me', name: 'Kan', opponents: 'robot', rand: mulberry32(3) });
  t = { ...t, board: { ...t.board, calls: 'P P P P' } };
  const dd = { table: [[7, 6, 7, 6], [6, 7, 6, 7], [7, 6, 7, 6], [6, 7, 6, 7], [7, 6, 7, 6]], par: { score: 0, contracts: [] } };
  assert.match(boardReport(t, 'S', dd), /Double dummy \(tricks as declarer, N E S W\): ♠ 7 6 7 6 · ♥ 6 7 6 7/);
  assert.match(boardReport(t, 'S', dd), /\nPar: no score\n/);
  assert.doesNotMatch(boardReport(t, 'S'), /Double dummy/);
});
