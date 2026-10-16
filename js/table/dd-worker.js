// A double-dummy worker (DDS, WebAssembly), one of a pool that scores sampled deals in parallel off the main thread.
// Messages in (kind 'play', the default): { id, hands, contract, play, constraints, samples, minSamples, timeMs }
//   -> { id, part: { n, total } }: scores of the legal cards on sampled deals.
// Messages in (kind 'bid'): { id, kind: 'bid', hand, auction, baseCall, samples, minSamples, timeMs }
//   -> { id, part: { n, sums } }: IMPs gained by each candidate call on sampled deals.
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
