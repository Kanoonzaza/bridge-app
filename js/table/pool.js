// A pool of double-dummy workers: one solver per processor core (up to four, one core left for the screen),
// so a decision's sampled deals are solved in parallel. Each worker has its own copy of the solver (about 15 MB).
import { playState, legalCards } from './play.js';
import { mergeScores, pickCard } from './dd.js';

export const poolSize = (cores = globalThis.navigator?.hardwareConcurrency ?? 2) => Math.max(1, Math.min(4, cores - 1));

export function createPool(url, size = poolSize()) {
  const workers = [];
  const pending = new Map();
  let seq = 0;
  const fail = (w) => {
    for (const [id, p] of pending) if (p.worker === w) { pending.delete(id); p.resolve(null); }
    const i = workers.indexOf(w);
    if (i >= 0) workers.splice(i, 1);
  };
  const spawn = () => {
    const w = new Worker(url, { type: 'module' });
    w.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p.resolve(e.data.part ?? null); } };
    w.onerror = () => fail(w);
    return w;
  };
  return {
    size,
    // Send one message to each worker (each gets its share) and collect the answers; a worker that fails or is
    // too slow answers null.
    run(makeMessage, timeoutMs = 12000) {
      try {
        while (workers.length < size) workers.push(spawn());
      } catch {
        return Promise.resolve([]);
      }
      return Promise.all(workers.map((w, k) => new Promise((resolve) => {
        const id = ++seq;
        pending.set(id, { worker: w, resolve });
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, timeoutMs);
        w.postMessage({ id, ...makeMessage(k, workers.length) });
      })));
    },
    close() { for (const w of workers.splice(0)) w.terminate(); },
  };
}

// Choose a robot's card with the pool: the samples are split across the workers and their totals added.
// total: samples over all workers (more samples, steadier answer); timeMs: time each worker may spend.
export async function poolChoose(pool, { hands, contract, play, constraints, total = 48, timeMs = 1500 }) {
  const st = playState(hands, contract, play);
  if (!st || !st.next) return null;
  const legal = legalCards(st, st.next);
  if (legal.length === 1) return { card: legal[0], samples: 0 };
  const parts = await pool.run((k, n) => ({
    hands, contract, play, constraints,
    samples: Math.ceil(total / n), minSamples: Math.max(2, Math.ceil(6 / n)), timeMs,
  }));
  return pickCard(st, st.next, mergeScores(parts));
}
