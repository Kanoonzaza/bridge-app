// The Advisor's suggestion, checked by simulation when no agreement covers the hand (a "general judgment").
// simulatedAdvice runs in the background; the screen shows the rule-based suggestion at once and swaps in the
// result when it arrives.
import { explain } from './engine.js';
import { callLabel } from './format.js';
import { sharedPool, poolSimulate } from './table/pool.js';
import { bookOfCards } from './pool/system.js';

// r: the plain Advisor result for (hand, auction). Resolves to a new result (same shape, plus r.sim) or null
// when the call is not a judgment call or the simulation could not run.
// cards: the packed convention cards each side plays ({ NS?, EW? }, as on a board; none = the house card).
export async function simulatedAdvice(hand, auction, r, cards = null) {
  if (!r || r.notCovered || r.fallback !== 'judgment') return null;
  try {
    const pool = sharedPool();
    const sim = await poolSimulate(pool, { hand, auction, baseCall: r.call, cards, total: 16 * pool.size });
    if (!sim) return null;
    const pct = (x) => `${Math.round(100 * x)}%`;
    if (!sim.changed) {
      return { ...r, sim, reasons: [...r.reasons, `simulated on ${sim.n} likely deals: no other call gains enough to change it`] };
    }
    const t = sim.table[sim.call];
    const row = explain({ ...auction, calls: [...auction.calls, sim.call] }, bookOfCards(cards), { general: true }).at(-1);
    return {
      ...r,
      call: sim.call,
      meaning: row?.meaning ?? 'No specific agreement.',
      notes: row?.notes ?? r.notes,
      reasons: [`simulated on ${sim.n} likely deals: ${callLabel(sim.call)} gains ${t.gain.toFixed(1)} IMPs per deal over ${callLabel(r.call)} (better on ${pct(t.win)} of the deals)`],
      close: `The rule-based call was ${callLabel(r.call)}; the simulation prefers ${callLabel(sim.call)}.`,
      plan: null,
      sim,
      ruleCall: r.call,
    };
  } catch {
    return null;
  }
}
