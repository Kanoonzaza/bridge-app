// Accuracy of the trick estimator on deals it has not seen: node tools/nn-eval.mjs <model.bin> <data.jsonl> [max]
import { readFileSync } from 'node:fs';
import { parseModel, predict } from '../js/tricks-nn.js';

const loadModel = (path) => { const b = readFileSync(path); return parseModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , bin, data, max = '5000'] = process.argv;
  const m = loadModel(bin);
  const lines = readFileSync(data, 'utf8').split('\n').filter(Boolean).slice(0, Number(max));
  let err = 0, n = 0, exact = 0;
  const t0 = performance.now();
  for (const line of lines) {
    const [h, t] = JSON.parse(line);
    const p = predict(m, h);
    for (let i = 0; i < 20; i++) { err += Math.abs(p[i] - t[i]); exact += Math.round(p[i]) === t[i]; n++; }
  }
  const ms = performance.now() - t0;
  console.log(`${lines.length} deals: MAE ${(err / n).toFixed(3)} tricks, exact ${(100 * exact / n).toFixed(1)}%, ${(ms / lines.length).toFixed(2)} ms per deal`);
}
