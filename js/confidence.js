// How firm a suggestion is: an agreed rule of our system, a proposed agreement, or general judgment.
import { PROPOSED } from './proposed.js';

export function confidence(r) {
  if (!r || r.notCovered) return null;
  if (r.sim) {
    return { level: 'judgment', label: 'Simulation', note: r.sim.changed
      ? `No agreement covers this sequence. The call was chosen by simulating ${r.sim.n} likely deals, not by our system: a suggestion to discuss with partner.`
      : `No agreement covers this sequence. The general-judgment call held up when simulated on ${r.sim.n} likely deals.` };
  }
  if (r.fallback && r.fallback !== 'quiet') {
    return { level: 'judgment', label: 'General judgment', note: 'No agreement covers this sequence: the Advisor uses general principles (points, fit, the Law of Total Tricks). A suggestion to discuss with partner, not a system bid.' };
  }
  if (PROPOSED.has(r.notes) || /\(Proposed\.\)/.test(r.meaning ?? '')) {
    return { level: 'proposed', label: 'Proposed agreement', note: 'Follows an agreement proposed in the notes but not yet confirmed with partner.' };
  }
  if (r.fallback === 'quiet') return { level: 'agreed', label: 'Agreed system', note: 'Their bids took none of our room, so our agreement applies as if they had passed.' };
  return { level: 'agreed', label: 'Agreed system', note: 'Our notes cover this exact sequence.' };
}
