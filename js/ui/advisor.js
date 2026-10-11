import { emptyHand, cardCount } from '../cards.js';
import { nextSeat, isComplete, seatAt } from '../auction.js';
import { advise } from '../engine.js';
import { buildAuction, ME, PARTNER } from '../advisor-model.js';
import { callLabel } from '../format.js';
import { NOTES_URL } from '../config.js';
import { el, segmented } from './dom.js';
import { handPicker } from './hand-picker.js';
import { biddingBox } from './bidding-box.js';

const WHO = { S: 'You', N: 'Partner', E: 'Opp', W: 'Opp' };
const SEAT_NAMES = ['1st', '2nd', '3rd', '4th'];

export function advisorView(root, store) {
  const state = store.load('advisor', { hand: emptyHand(), opener: 'me', seat: 1, ourCalls: [] });
  const save = () => store.save('advisor', state);
  const rest = el('div', { class: 'stack' });
  const picker = handPicker({ hand: state.hand, onChange: (h) => { state.hand = h; save(); render(); } });
  root.replaceChildren(picker.root, rest);

  function update(patch) {
    Object.assign(state, patch);
    save();
    render();
  }

  function auctionStrip(a) {
    const items = a.calls.map((c, i) => {
      const seat = seatAt(a, i);
      return el('span', { class: `call${seat === 'E' || seat === 'W' ? ' opp' : ''}` }, el('small', {}, WHO[seat]), callLabel(c));
    });
    if (!isComplete(a)) items.push(el('span', { class: 'call next' }, el('small', {}, WHO[nextSeat(a)]), '?'));
    return el('div', {},
      el('div', { class: 'label' }, 'Auction so far (opponents pass)'),
      el('div', { class: 'strip' }, ...items),
      state.ourCalls.length
        ? el('div', { class: 'row-buttons' }, el('button', { type: 'button', class: 'pill', onclick: () => update({ ourCalls: state.ourCalls.slice(0, -1) }) }, 'Undo'))
        : null);
  }

  function answerCard(a) {
    if (isComplete(a)) return el('div', { class: 'panel muted' }, 'The auction is over. Tap Undo, or change who opens to start again.');
    if (nextSeat(a) === PARTNER) return el('div', { class: 'panel muted' }, "Partner's turn: tap partner's call on the bidding box.");
    const n = cardCount(state.hand);
    if (n !== 13) return el('div', { class: 'panel muted' }, `Pick exactly 13 cards (you have ${n}).`);
    const r = advise(state.hand, a);
    if (r.notCovered) {
      return el('div', { class: 'panel' },
        el('div', { class: 'eyebrow' }, 'Not covered yet'),
        el('p', {}, "The advisor doesn't have rules for this situation yet. These are the bids our system defines here:"),
        r.options.length
          ? el('ul', { class: 'opts' }, ...r.options.map((o) => el('li', {}, el('b', {}, callLabel(o.call)), ' ', o.meaning)))
          : el('p', { class: 'muted' }, 'No agreements entered for this situation yet.'));
    }
    return el('div', { class: 'panel answer', 'aria-live': 'polite' },
      el('div', { class: 'eyebrow' }, 'Suggested bid'),
      el('div', { class: 'big' }, callLabel(r.call)),
      r.reasons.length ? el('p', {}, el('b', {}, 'Why: '), `${r.reasons.join('; ')}.`) : null,
      el('p', {}, el('b', {}, 'Tells partner: '), r.meaning),
      r.plan ? el('p', {}, el('b', {}, 'Plan: '), r.plan) : null,
      r.close ? el('p', { class: 'close' }, el('b', {}, 'Close call: '), r.close) : null,
      el('a', { href: `${NOTES_URL}#${r.notes}`, target: '_blank', rel: 'noopener' }, 'Read more in the system notes'));
  }

  function render() {
    const a = buildAuction(state);
    const ourTurn = !isComplete(a) && [ME, PARTNER].includes(nextSeat(a));
    rest.replaceChildren(
      segmented('Who opens?', [['me', "I'm opening"], ['partner', 'Partner opened']], state.opener, (v) => update({ opener: v, ourCalls: [] })),
      segmented('Seat of the opening bid', SEAT_NAMES.map((t, i) => [i + 1, t]), state.seat, (v) => update({ seat: v, ourCalls: [] })),
      auctionStrip(a),
      answerCard(a),
      ourTurn ? biddingBox(a, { onCall: (c) => update({ ourCalls: [...state.ourCalls, c] }) }) : null);
  }

  render();
}
