// Double dummy card by card, for looking back at a played board the way Bridge Base Online does: at each point of the
// play, every card the player to move may play is scored with the tricks declarer ends up with if that card is played
// (all hands visible, perfect play from then on).
import { sideOf } from '../auction.js';
import { playState, legalCards, splitPlay } from './play.js';
import { solve } from './dd.js';

// The position after the first `step` cards of the play: { [card]: declarer's total tricks }, or null when nobody is to
// play (the end of the play, or a play that does not fit the hands).
export function ddStep(dds, hands, k, play, step) {
  const st = playState(hands, k, splitPlay(play).slice(0, step).join(' '));
  if (!st?.ok || !st.next) return null;
  const sc = solve(dds, st, st.remaining);
  const left = 13 - st.tricks.length;
  const same = sideOf(st.next) === sideOf(st.declarer);
  return Object.fromEntries(legalCards(st, st.next).map((c) => [c, st.declarerTricks + (same ? sc[c] : left - sc[c])]));
}

// The steps a viewer can show: 0 (before the opening lead) to the number of cards played.
export const stepCount = (play) => splitPlay(play).length + 1;

// One worker's share of the steps (every n-th, starting at k): { [step]: scores }.
export function ddShare(dds, { hands, contract, play, k = 0, n = 1 }) {
  const out = {};
  for (let i = k; i < stepCount(play); i += n) out[i] = ddStep(dds, hands, contract, play, i);
  return out;
}

// What the card actually played at a step did: { best, got, lost } in declarer's tricks, lost > 0 when it gave tricks
// away (for the side that played it).
export function stepVerdict(st, scores, card) {
  if (!scores || !card || !(card in scores)) return null;
  const vals = Object.values(scores);
  const forDeclarer = sideOf(st.next) === sideOf(st.declarer);
  const best = forDeclarer ? Math.max(...vals) : Math.min(...vals);
  const got = scores[card];
  return { best, got, lost: forDeclarer ? best - got : got - best };
}
