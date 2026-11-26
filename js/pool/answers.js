// Does a card play this answer? For decision functions that mix several conventions:
//   plays(st.sys, 'passed-2c', 'drury')
// No sys (a caller outside the engine, or an old test) reads as the house card.
// Kept apart from js/pool/system.js so the rule files can import it without an import cycle.
import { PRESETS } from './card.js';

export const plays = (sys, slot, opt) => (sys ? sys.is(slot, opt) : PRESETS['2/1'][slot] === opt);
