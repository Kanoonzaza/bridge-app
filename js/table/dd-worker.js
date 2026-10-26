// A double-dummy worker (DDS, WebAssembly), one of a pool that scores sampled deals in parallel off the main thread.
// Messages in (kind 'play', the default): { id, hands, contract, play, constraints, samples, minSamples, timeMs }
//   -> { id, part: { n, total } }: scores of the legal cards on sampled deals.
// Messages in (kind 'bid'): { id, kind: 'bid', hand, auction, baseCall, samples, minSamples, timeMs }
//   -> { id, part: { n, sums } }: IMPs gained by each candidate call on sampled deals.
// Messages in (kind 'review'): { id, kind: 'review', hands, dealer, vul }
//   -> { id, part }: the double-dummy table and par of a finished board (see ddreview.js).
// Messages in (kind 'cards'): { id, kind: 'cards', hands, contract, play }
//   -> { id, part: { [step]: { [card]: declarer's tricks } } }: every playable card scored at every point of the play (see ddplay.js).
// Kind 'warm' loads the solver (and the bidding rules) ahead of time. part is null if a job failed.
import { loadDds, Dds } from '../vendor/dds/api.js';
import { playState } from './play.js';
import { ddScores } from './dd.js';

let ddsReady = null;
self.onmessage = async (e) => {
  const { id, kind, hands, contract, play, constraints, samples, minSamples, timeMs } = e.data;
  try {
    ddsReady ??= loadDds().then((m) => new Dds(m));
    const dds = await ddsReady;
    if (kind === 'warm') {
      await import('../sim-bid.js');
      self.postMessage({ id, part: null });
      return;
    }
    if (kind === 'review') {
      const { ddReview } = await import('./ddreview.js');
      self.postMessage({ id, part: ddReview(dds, { hands, dealer: e.data.dealer, vul: e.data.vul }) });
      return;
    }
    if (kind === 'cards') {
      const { ddShare } = await import('./ddplay.js');
      self.postMessage({ id, part: ddShare(dds, { hands, contract, play }) });
      return;
    }
    if (kind === 'claim') {
      // The most tricks the declarer's side takes from here with every card visible (for the defenders to judge a claim).
      const { solve } = await import('./dd.js');
      const st = playState(hands, contract, play);
      const sc = Object.values(solve(dds, st, st.remaining));
      const left = st.remaining[st.declarer].length;
      const best = Math.max(...sc);
      const sameSide = (a, b) => (a === 'N' || a === 'S') === (b === 'N' || b === 'S');
      self.postMessage({ id, part: { dd: sameSide(st.next, st.declarer) ? best : left - best, left } });
      return;
    }
    if (kind === 'bid') {
      const { simulateParts } = await import('../sim-bid.js');
      const { hand, auction, baseCall } = e.data;
      self.postMessage({ id, part: simulateParts({ hand, auction, baseCall, dds, samples, minSamples, timeMs }) });
      return;
    }
    const st = playState(hands, contract, play);
    const part = st && st.next ? ddScores(dds, st, st.next, { constraints, maxSamples: samples, minSamples, timeMs }) : null;
    self.postMessage({ id, part });
  } catch (err) {
    self.postMessage({ id, part: null, error: String(err?.message ?? err) });
  }
};
