// A double-dummy worker (DDS, WebAssembly), one of a pool that scores sampled deals in parallel off the main thread.
// Message in:  { id, hands, contract, play, constraints, samples, minSamples, timeMs }
// Message out: { id, part: { n, total } } (part is null if it failed).
import { loadDds, Dds } from '../vendor/dds/api.js';
import { playState } from './play.js';
import { ddScores } from './dd.js';

let ddsReady = null;
self.onmessage = async (e) => {
  const { id, hands, contract, play, constraints, samples, minSamples, timeMs } = e.data;
  try {
    ddsReady ??= loadDds().then((m) => new Dds(m));
    const dds = await ddsReady;
    const st = playState(hands, contract, play);
    const part = st && st.next ? ddScores(dds, st, st.next, { constraints, maxSamples: samples, minSamples, timeMs }) : null;
    self.postMessage({ id, part });
  } catch (err) {
    self.postMessage({ id, part: null, error: String(err?.message ?? err) });
  }
};
