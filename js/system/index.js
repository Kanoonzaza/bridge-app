// Every rule of the system, grouped like the system notes. Each entry is one call in one situation:
//   { after, call, meaning, shows, notes, pick, why, plan, close, priority, ctx }
// `after` is the auction so far (opponents' calls in brackets); `pick(e, st)` says whether the Advisor
// chooses this call for hand e; `notes` is the notes heading its "Read more" link opens.
// See docs/how-the-advisor-works.md.
import openings from './opening/openings.js';         // Part 2: opening bids
import notrump from './opening/notrump.js';           //         1NT / 2NT and the responses, Smolen
import twos from './opening/twos.js';                 //         strong 2♣, weak twos, preempts
import respMajor from './responding/major.js';        // Part 3: responding to 1♥ / 1♠
import respMinor from './responding/minor.js';        //         responding to 1♣ / 1♦
import opener from './rebids/opener.js';              // Part 4: opener's rebid
import responder from './rebids/responder.js';        //         responder's rebid (XYZ, fourth suit, after a reverse)
import thirdRound from './rebids/third-round.js';     //         the third round and later
import slam from './rebids/slam.js';                  //         RKCB, Gerber, control bids
import competitive from './competitive/index.js';     // Part 5: contested auctions
import { tagAll } from '../pool/tags.js';             // which option of the convention pool each rule belongs to

const ALL = [...openings, ...respMajor, ...respMinor, ...opener, ...responder, ...notrump, ...twos, ...slam, ...thirdRound, ...competitive];
// Every rule gets `opt`: the pool option it belongs to ('passed-2c:drury', 'base:2/1', ...), or null for core.
export const TAG_REPORT = tagAll(ALL);
export default ALL;
