// A small neural network that estimates the double-dummy tricks of a deal in a fraction of a millisecond (the exact
// solver needs 50–300 ms). Trained by tools/nn-train.py on solver tables; used by the bidding simulation to look at
// many more sampled deals. Input: who holds each card, suit lengths and points per seat. Output: expected tricks for
// each strain (S H D C NT) and declarer (N E S W), with the typical error of about half a trick.
import { packHand } from './table/model.js';

const R = 'AKQJT98765432';
const SHAPES = { W1: [228, 1024], b1: [1024], W2: [1024, 512], b2: [512], W3: [512, 20], b3: [20], mu: [20], sd: [20] };
const STRAIN = { S: 0, H: 1, D: 2, C: 3, N: 4 };
const SEAT = { N: 0, E: 1, S: 2, W: 3 };
// Spread of the estimate around the truth, in tricks (mean absolute error 0.48 corresponds to about 0.6).
export const SIGMA = 0.6;

// buffer: the model file (eight float32 arrays in the order of SHAPES).
export function parseModel(buffer) {
  const f = new Float32Array(buffer);
  const m = {};
  let o = 0;
  for (const [k, s] of Object.entries(SHAPES)) { const n = s.reduce((a, b) => a * b, 1); m[k] = f.subarray(o, o + n); o += n; }
  return m;
}

// hands: four packed hands "AKQ.J10.xx.xxx" in seat order N E S W.
export function features(hands) {
  const x = new Float32Array(228);
  const V = [4, 3, 2, 1];
  for (let s = 0; s < 4; s++) {
    let hc = 0;
    hands[s].split('.').forEach((cards, si) => {
      for (const c of cards) { const r = R.indexOf(c); x[s * 52 + si * 13 + r] = 1; if (r < 4) hc += V[r]; }
      x[208 + s * 4 + si] = cards.length / 13;
    });
    x[224 + s] = hc / 10;
  }
  return x;
}

function dense(x, W, b, nIn, nOut, relu) {
  const y = Float32Array.from(b);
  for (let i = 0; i < nIn; i++) {
    const xi = x[i];
    if (xi === 0) continue;
    const row = i * nOut;
    for (let j = 0; j < nOut; j++) y[j] += xi * W[row + j];
  }
  if (relu) for (let j = 0; j < nOut; j++) if (y[j] < 0) y[j] = 0;
  return y;
}

// The 20 expected tricks (strain-major, then seat N E S W) for four packed hands.
export function predict(m, hands) {
  const a1 = dense(features(hands), m.W1, m.b1, 228, 1024, true);
  const a2 = dense(a1, m.W2, m.b2, 1024, 512, true);
  const o = dense(a2, m.W3, m.b3, 512, 20, false);
  return Array.from(o, (v, i) => v * m.sd[i] + m.mu[i]);
}

// Probabilities of 0..13 tricks around an estimate (a discretised normal curve).
export function spread(mean, sigma = SIGMA) {
  const p = new Array(14).fill(0);
  let total = 0;
  for (let t = 0; t <= 13; t++) {
    p[t] = Math.exp(-0.5 * ((t - mean) / sigma) ** 2);
    total += p[t];
  }
  return p.map((v) => v / total);
}

// An estimator for simulateParts: (hands {N,E,S,W: {S,H,D,C}}, contract) -> probabilities of the declarer's tricks.
export function makeEstimator(model) {
  const memo = new WeakMap();
  return (hands, k) => {
    let table = memo.get(hands);
    if (!table) { table = predict(model, SEAT_ORDER.map((s) => packHand(hands[s]))); memo.set(hands, table); }
    return spread(table[STRAIN[k.bid[1]] * 4 + SEAT[k.declarer]]);
  };
}
const SEAT_ORDER = ['N', 'E', 'S', 'W'];
