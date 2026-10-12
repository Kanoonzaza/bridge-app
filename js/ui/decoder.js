import { nextSeat, isComplete, sideOf } from '../auction.js';
import { explain, summarize, describeShown, nextOptions, generalOptions } from '../engine.js';
import { callLabel } from '../format.js';
import { NOTES_URL } from '../config.js';
import { el, segmented, keepFocus } from './dom.js';
import { biddingBox } from './bidding-box.js';
import { cleanDecoder } from '../state.js';

const WHO = { S: 'You', N: 'Partner', E: 'Right opp', W: 'Left opp' };

const more = (notes) => el('a', { href: `${NOTES_URL}#${notes}`, target: '_blank', rel: 'noopener' }, 'Read more in the system notes');

function rowView(r) {
  const opp = sideOf(r.seat) === 'EW';
  const cells = (text) => [el('span', { class: 'who' }, WHO[r.seat]), el('span', { class: 'bid-l' }, callLabel(r.call)), el('span', {}, text)];
  if (opp) {
    if (r.call === 'P' || !r.meaning) {
      return el('div', { class: 'line opp' },
        el('div', { class: 'row' }, ...cells(r.call === 'P' ? 'Pass' : "Opponents' call (their own system)")));
    }
    return el('details', { class: 'line opp' },
      el('summary', {}, ...cells(`Probably: ${r.meaning}`)),
      el('p', { class: 'muted' }, 'What this call would mean in a standard system like ours. Their agreements may differ: ask them when it matters.'));
  }
  if (r.call === 'P' && !r.entry) {
    return el('div', { class: 'line' }, el('div', { class: 'row' }, ...cells('Pass (no special agreement)')));
  }
  if (r.general) {
    return el('details', { class: 'line' },
      el('summary', {}, ...cells(r.meaning)),
      el('p', { class: 'muted' }, 'No specific agreement covers this sequence: this is the general rule from the notes.'),
      more(r.notes));
  }
  if (!r.entry) {
    return el('div', { class: 'line' }, el('div', { class: 'row' }, ...cells('No agreement in our system for this bid.')));
  }
  return el('details', { class: 'line' },
    el('summary', {}, ...cells(r.meaning ?? 'No agreement in our system for this bid.')),
    more(r.entry.notes));
}

export function decoderView(root, store) {
  const state = cleanDecoder(store.load('decoder', {}));

  function update(patch) {
    Object.assign(state, patch);
    store.save('decoder', state);
    render();
  }

  function nextSection(a) {
    if (isComplete(a)) return el('p', { class: 'muted' }, 'The auction is over.');
    const turn = nextSeat(a);
    if (sideOf(turn) === 'EW') return el('p', { class: 'muted' }, `${WHO[turn]} to call: enter their call on the bidding box.`);
    const opts = nextOptions(a);
    const generic = opts.length ? [] : generalOptions(a);
    const list = (os) => el('div', { class: 'lines' }, ...os.map((o) => el('div', { class: 'line' },
      el('div', { class: 'opt' }, el('span', { class: 'bid-l' }, callLabel(o.call)), el('span', {}, o.meaning)))));
    return el('div', {},
      el('div', { class: 'label' }, turn === 'S' ? 'What can I bid next?' : 'What can partner bid next?'),
      opts.length
        ? list(opts)
        : generic.length
          ? [el('p', { class: 'muted' }, 'No specific agreements here. By the general rules:'), list(generic)]
          : el('p', { class: 'muted' }, 'No agreements entered for this situation yet.'));
  }

  function render() {
    const a = { dealer: state.dealer, calls: state.calls };
    const rows = explain(a, undefined, { general: true });
    const chips = describeShown(summarize(rows, 'N'));
    keepFocus(root, () => root.replaceChildren(el('div', { class: 'stack' },
      segmented('Dealer', [['S', 'You'], ['W', 'Left opp'], ['N', 'Partner'], ['E', 'Right opp']], state.dealer, (v) => update({ dealer: v, calls: [] })),
      el('div', {},
        el('div', { class: 'label' }, 'Auction'),
        rows.length ? el('div', { class: 'lines' }, ...rows.map(rowView)) : el('p', { class: 'muted' }, 'Enter the first call with the bidding box below.'),
        state.calls.length
          ? el('div', { class: 'row-buttons' },
              el('button', { type: 'button', 'data-key': 'act-undo', class: 'pill', onclick: () => update({ calls: state.calls.slice(0, -1) }) }, 'Undo'),
              el('button', { type: 'button', 'data-key': 'act-clear', class: 'pill', onclick: () => update({ calls: [] }) }, 'Clear'))
          : null),
      chips.length ? el('div', {}, el('div', { class: 'label' }, 'Partner has shown'), el('div', { class: 'chips' }, ...chips.map((c) => el('span', { class: 'chip' }, c)))) : null,
      nextSection(a),
      isComplete(a) ? null : biddingBox(a, { onCall: (c) => update({ calls: [...state.calls, c] }), doubles: true }))));
  }

  render();
}
