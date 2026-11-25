// The rules of the pool's options that the house card does not play (js/pool/catalog.js): one file per question.
// Every rule here sets `opt: '<slot>:<option>'` itself. The house card's own options are the rules in the other
// folders, tagged by js/pool/tags.js.
// Options of the contested auctions add their meanings to the competitive list (js/system/competitive/shared.js),
// so importing them is enough.
import './nt-interference.js';
import './nt-defence.js';
import responses from './responses.js';
import keycard from './keycard.js';

const options = [...responses, ...keycard];
export default options;
