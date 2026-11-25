// How firm a suggestion is: an agreed rule of our system, a proposed agreement, or general judgment.
import { PROPOSED } from './proposed.js';

// sys: the card the call was bid by (js/pool/system.js). An answer the pair marked "to discuss" reads as proposed.
export function confidence(r, sys = null) {
  if (!r || r.notCovered) return null;
  if (r.sim) {
    return { level: 'judgment', label: 'Simulation', note: r.sim.changed
      ? `No agreement covers this sequence. The call was chosen by simulating ${r.sim.n} likely deals, not by our system: a suggestion to discuss with partner.`
      : `No agreement covers this sequence. The general-judgment call held up when simulated on ${r.sim.n} likely deals.` };
  }
  if (r.fallback && r.fallback !== 'quiet') {
    return { level: 'judgment', label: 'General judgment', note: 'No agreement covers this sequence: the Advisor uses general principles (points, fit, the Law of Total Tricks). A suggestion to discuss with partner, not a system bid.' };
  }
  const slotOfOpt = typeof r.opt === 'string' && !r.opt.startsWith('base:') ? r.opt.slice(0, r.opt.indexOf(':')) : null;
  if (PROPOSED.has(r.notes) || /\(Proposed\.\)/.test(r.meaning ?? '') || (slotOfOpt && sys?.discuss(slotOfOpt))) {
    return { level: 'proposed', label: 'Proposed agreement', note: 'Follows an agreement proposed in the notes but not yet confirmed with partner.' };
  }
  // A pair's own card (not the house card): the agreement is theirs.
  const own = sys && !sys.house;
  const label = own ? 'On your card' : 'Agreed system';
  if (r.fallback === 'quiet') return { level: 'agreed', label, note: own ? 'Their bids took none of your room, so your agreement applies as if they had passed.' : 'Their bids took none of our room, so our agreement applies as if they had passed.' };
  return { level: 'agreed', label, note: own ? `Your card${sys.name ? ` (${sys.name})` : ''} covers this exact sequence.` : 'Our notes cover this exact sequence.' };
}
