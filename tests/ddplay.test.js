import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ddShare, ddStep, stepCount, stepVerdict } from '../js/table/ddplay.js';
import { playState, legalCards } from '../js/table/play.js';

const hands = {
  N: { S: 'AK72', H: 'QJ3', D: 'K84', C: 'A65' },
  E: { S: 'QT3', H: 'K942', D: 'QJ7', C: 'J98' },
  S: { S: 'J865', H: 'AT5', D: 'A63', C: 'KQ4' },
  W: { S: '94', H: '876', D: 'T952', C: 'T732' },
};
const k = { bid: '4S', declarer: 'S', doubled: '' };
// Everyone plays their lowest legal card: a poor play, so some cards give tricks away.
const lowPlay = () => {
  const play = [];
  for (;;) {
    const st = playState(hands, k, play.join(' '));
    if (!st.next) return play;
    play.push(legalCards(st, st.next).at(-1));
  }
};

test('double dummy card by card: every legal card scored, each card leads to the score it was given', async () => {
  const { loadDds, Dds } = await import('../js/vendor/dds/api.js');
  const dds = new Dds(await loadDds());
  const play = lowPlay();
  assert.equal(play.length, 52);
  const steps = ddShare(dds, { hands, contract: k, play: play.join(' ') });
  assert.equal(Object.keys(steps).length, stepCount(play.join(' ')));
  // The opening lead: all 13 of West's cards, declarer's tricks with best play from there.
  assert.deepEqual(Object.keys(steps[0]).sort(), legalCards(playState(hands, k, ''), 'W').sort());
  assert.ok(Object.values(steps[0]).every((n) => n === 11));
  assert.equal(steps[52], null);
  for (let i = 0; i < 52; i++) {
    const st = playState(hands, k, play.slice(0, i).join(' '));
    assert.deepEqual(Object.keys(steps[i]).sort(), legalCards(st, st.next).sort(), `step ${i}`);
    // After the card is played, the best result from the new position is what that card was scored.
    if (i < 51) {
      const after = playState(hands, k, play.slice(0, i + 1).join(' '));
      const vals = Object.values(steps[i + 1]);
      const best = (after.next === 'N' || after.next === 'S') ? Math.max(...vals) : Math.min(...vals);
      assert.equal(best, steps[i][play[i]], `step ${i}`);
    }
  }
  // Declarer's final tricks: 11 at the start, moved by every trick given away (by declarer down, by the defence up).
  const end = playState(hands, k, play.join(' '));
  const swing = play.reduce((n, c, i) => {
    const st = playState(hands, k, play.slice(0, i).join(' '));
    const v = stepVerdict(st, steps[i], c);
    return n + ((st.next === 'N' || st.next === 'S') ? -v.lost : v.lost);
  }, 0);
  assert.equal(end.declarerTricks, 11 + swing);
  // Shares split over workers cover the same steps.
  const a = ddShare(dds, { hands, contract: k, play: play.join(' '), k: 0, n: 2 });
  const b = ddShare(dds, { hands, contract: k, play: play.join(' '), k: 1, n: 2 });
  assert.deepEqual({ ...a, ...b }, steps);
  assert.deepEqual(ddStep(dds, hands, k, play.join(' '), 5), steps[5]);
});

test('the verdict on a card: tricks given away by the side that played it', () => {
  const st = playState(hands, k, '');
  // West (a defender) to lead: declarer's tricks are what the defence wants low.
  assert.deepEqual(stepVerdict(st, { S9: 10, H8: 11 }, 'H8'), { best: 10, got: 11, lost: 1 });
  assert.deepEqual(stepVerdict(st, { S9: 10, H8: 11 }, 'S9'), { best: 10, got: 10, lost: 0 });
  const st2 = playState(hands, k, 'S9');
  // North (dummy, declarer's side) to play: declarer wants it high.
  assert.deepEqual(stepVerdict(st2, { S2: 10, SA: 11 }, 'S2'), { best: 11, got: 10, lost: 1 });
  assert.equal(stepVerdict(st2, null, 'S2'), null);
  assert.equal(stepVerdict(st2, { S2: 10 }, 'HQ'), null);
});
