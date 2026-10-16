// Runs the double-dummy robot (DDS, WebAssembly) off the main thread, so the screen stays responsive.
// Message in: { id, hands, contract, play, constraints }. Message out: { id, card } (card null if it failed).
import { loadDds, Dds } from '../vendor/dds/api.js';
import { playState } from './play.js';
import { ddChoose } from './dd.js';

let ddsReady = null;
self.onmessage = async (e) => {
  const { id, hands, contract, play, constraints } = e.data;
  try {
    ddsReady ??= loadDds().then((m) => new Dds(m));
    const dds = await ddsReady;
    const st = playState(hands, contract, play);
    const r = st && st.next ? ddChoose(dds, st, st.next, { constraints, timeMs: 1500 }) : null;
    self.postMessage({ id, card: r?.card ?? null });
  } catch (err) {
    self.postMessage({ id, card: null, error: String(err?.message ?? err) });
  }
};
