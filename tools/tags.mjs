// Audit of the pool tags: how many rules each option holds, and the rules that took a tag from an earlier
// call of their auction (descendants), grouped by root, so the borderline ones can be read.
// Usage: node tools/tags.mjs [--detail <opt>]
import { EVERY as ALL, TAG_REPORT } from '../js/system/index.js';

const detail = process.argv.includes('--detail') ? process.argv[process.argv.indexOf('--detail') + 1] : null;
const { report, why } = TAG_REPORT;
const count = {};
for (const e of ALL) count[e.opt ?? 'core'] = (count[e.opt ?? 'core'] ?? 0) + 1;
console.log('rules', ALL.length);
for (const [k, n] of Object.entries(count).sort()) {
  const r = report[k];
  console.log(`${String(n).padStart(5)}  ${k}${r ? `   (root ${r.self}, section ${r.section}, inherited ${r.inherited})` : ''}`);
}
// Descendants that came from a different notes section than their root: the ones worth reading.
const cross = new Map();
for (const [e, root] of why) {
  if (e.notes === root.notes) continue;
  const k = `${e.opt}  <-  ${[...root.after, root.call].join(' ')}  [${e.notes}]`;
  cross.set(k, (cross.get(k) ?? 0) + 1);
}
console.log('\nInherited across notes sections (tag <- root [rule\'s own section]):');
for (const [k, n] of [...cross].sort()) console.log(`${String(n).padStart(5)}  ${k}`);
if (detail) {
  console.log(`\nRules tagged ${detail}:`);
  for (const e of ALL) if ((e.opt ?? 'core') === detail) console.log(`  ${e.tail ? 'TAIL ' : ''}${e.after.join(' ')} → ${e.call}  ${JSON.stringify(e.ctx ?? {})}  ${e.meaning.slice(0, 70)}`);
}
