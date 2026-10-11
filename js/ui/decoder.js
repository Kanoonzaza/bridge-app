import { nextSeat, isComplete, sideOf } from '../auction.js';
import { explain, summarize, describeShown, nextOptions } from '../engine.js';
import { callLabel } from '../format.js';
import { NOTES_URL } from '../config.js';
import { el, segmented } from './dom.js';
import { biddingBox } from './bidding-box.js';

const WHO = { S: 'You', N: 'Partner', E: 'Right opp', W: 'Left opp' };

function rowView(r) {
  const opp = sideOf(r.seat) === 'EW';
  const text = opp
    ? (r.call === 'P' ? 'Pass' : "Opponents' call (their own system)")
    : r.meaning ?? 'No agreement in our system for this bid.';
  return el('details', { class: `line${opp ? ' opp' : ''}` },
    el('summary', {}, el('span', { class: 'who' }, WHO[r.seat]), el('span', { class: 'bid-l' }, callLabel(r.call)), el('span', {}, text)),
    !opp && r.entry
      ? el('a', { href: `${NOTES_URL}#${r.entry.notes}`, target: '_blank', rel: 'noopener' }, 'Read more in the system notes')
      : el('p', { class: 'muted' }, 'No further detail.'));
}

export function decoderView(root, store) {
  const state = store.load('decoder', { dealer: 'S', calls: [] });

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
    return el('div', {},
      el('div', { class: 'label' }, turn === 'S' ? 'What can I bid next?' : 'What can partner bid next?'),
      opts.length
        ? el('div', { class: 'lines' }, ...opts.map((o) => el('div', { class: 'line' },
            el('summary', {}, el('span', { class: 'who' }, ''), el('span', { class: 'bid-l' }, callLabel(o.call)), el('span', {}, o.meaning)))))
        : el('p', { class: 'muted' }, 'No agreements entered for this situation yet.'));
  }

  function render() {
    const a = { dealer: state.dealer, calls: state.calls };
    const rows = explain(a);
    const chips = describeShown(summarize(rows, 'N'));
    root.replaceChildren(el('div', { class: 'stack' },
      segmented('Dealer', [['S', 'You'], ['W', 'Left opp'], ['N', 'Partner'], ['E', 'Right opp']], state.dealer, (v) => update({ dealer: v, calls: [] })),
      el('div', {},
        el('div', { class: 'label' }, 'Auction'),
        rows.length ? el('div', { class: 'lines' }, ...rows.map(rowView)) : el('p', { class: 'muted' }, 'Enter the first call with the bidding box below.'),
        state.calls.length
          ? el('div', { class: 'row-buttons' },
              el('button', { type: 'button', class: 'pill', onclick: () => update({ calls: state.calls.slice(0, -1) }) }, 'Undo'),
              el('button', { type: 'button', class: 'pill', onclick: () => update({ calls: [] }) }, 'Clear'))
          : null),
      chips.length ? el('div', {}, el('div', { class: 'label' }, 'Partner has shown'), el('div', { class: 'chips' }, ...chips.map((c) => el('span', { class: 'chip' }, c)))) : null,
      nextSection(a),
      isComplete(a) ? null : biddingBox(a, { onCall: (c) => update({ calls: [...state.calls, c] }), doubles: true })));
  }

  render();
}
