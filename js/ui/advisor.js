import { cardCount } from '../cards.js';
import { nextSeat, isComplete, seatAt } from '../auction.js';
import { advise, explain, summarize, describeShown } from '../engine.js';
import { buildAuction, enteredTurn, oppsEnter, isOpp, OPENER_SEAT as OPENER, PARTNER } from '../advisor-model.js';
import { cleanAdvisor, acceptedCalls } from '../state.js';
import { callLabel } from '../format.js';
import { NOTES_URL } from '../config.js';
import { el, segmented, keepFocus } from './dom.js';
import { handPicker } from './hand-picker.js';
import { biddingBox } from './bidding-box.js';
import { copyButton } from './copy.js';
import { advisorReport } from '../report.js';

const WHO = { S: 'You', N: 'Partner', E: 'Right', W: 'Left' };
const OPP_NAME = { E: 'Right opponent', W: 'Left opponent' };
const SEAT_NAMES = ['1st', '2nd', '3rd', '4th'];

export function advisorView(root, store) {
  const state = cleanAdvisor(store.load('advisor', {}));
  const save = () => store.save('advisor', state);
  const top = el('div', { class: 'stack' });
  const live = el('div', { 'aria-live': 'polite' });
  const bottom = el('div');
  const rest = el('div', { class: 'stack' }, top, live, bottom);
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
      return el('span', { class: `call${isOpp(seat) && c === 'P' ? ' opp' : ''}` }, el('small', {}, WHO[seat]), el('span', {}, callLabel(c)));
    });
    if (!isComplete(a)) items.push(el('span', { class: 'call next' }, el('small', {}, WHO[nextSeat(a)]), '?'));
    const shown = describeShown(summarize(explain(a, undefined, { general: true }), PARTNER));
    return el('div', {},
      el('div', { class: 'label' }, oppsEnter(state) ? 'Auction so far' : 'Auction so far (opponents pass)'),
      el('div', { class: 'strip' }, ...items),
      shown.length ? el('div', { class: 'shown' }, el('div', { class: 'label' }, 'Partner has shown'), el('div', { class: 'chips' }, ...shown.map((c) => el('span', { class: 'chip' }, c)))) : null,
      state.ourCalls.length
        ? el('div', { class: 'row-buttons' }, el('button', { type: 'button', 'data-key': 'act-undo', class: 'pill', onclick: () => update({ ourCalls: state.ourCalls.slice(0, -1) }) }, 'Undo'))
        : null);
  }

  function answerCard(a) {
    if (isComplete(a)) return el('div', { class: 'panel muted' }, 'The auction is over. Tap Undo, or change who opens to start again.');
    if (nextSeat(a) === PARTNER) return el('div', { class: 'panel muted' }, "Partner's turn: tap partner's call on the bidding box.");
    if (isOpp(nextSeat(a))) return el('div', { class: 'panel muted' }, `${OPP_NAME[nextSeat(a)]}'s turn: tap their call (Pass if they passed).`);
    const n = cardCount(state.hand);
    if (n !== 13) return el('div', { class: 'panel muted' }, `Pick exactly 13 cards (you have ${n}).`);
    const r = advise(state.hand, a);
    if (r.notCovered) {
      return el('div', { class: 'panel' },
        el('div', { class: 'eyebrow' }, 'Not covered yet'),
        r.options.length
          ? [
              el('p', {}, "The advisor doesn't have rules for this situation yet. These are the bids our system defines here:"),
              el('ul', { class: 'opts' }, ...r.options.map((o) => el('li', {}, el('b', {}, callLabel(o.call)), ' ', o.meaning))),
            ]
          : el('p', {}, "The advisor doesn't cover this situation yet. More situations are coming in the next update."));
    }
    return el('div', { class: 'panel answer' },
      el('div', { class: 'eyebrow' }, r.fallback ? 'Suggested bid (general rule)' : 'Suggested bid'),
      el('div', { class: 'big' }, callLabel(r.call)),
      r.reasons.length ? el('p', {}, el('b', {}, 'Why: '), `${r.reasons.join('; ')}.`) : null,
      el('p', {}, el('b', {}, 'Tells partner: '), r.meaning),
      r.plan ? el('p', {}, el('b', {}, 'Plan: '), r.plan) : null,
      r.close ? el('p', { class: 'close' }, el('b', {}, 'Close call: '), r.close) : null,
      el('a', { href: `${NOTES_URL}#${r.notes}`, target: '_blank', rel: 'noopener' }, 'Read more in the system notes'),
      copyButton('Copy for review', () => advisorReport(state.hand, a, r), 'copy-advice'));
  }

  function render() {
    // Drop saved calls the built auction did not use, so Undo always removes a visible call.
    const kept = acceptedCalls(state);
    if (kept.length !== state.ourCalls.length) {
      state.ourCalls = kept;
      save();
    }
    const a = buildAuction(state);
    const ourTurn = !isComplete(a) && enteredTurn(state, a);
    keepFocus(rest, () => {
      top.replaceChildren(
        segmented('Who opens?', [['me', "I'm opening"], ['partner', 'Partner'], ['lho', 'Left opp'], ['rho', 'Right opp']], state.opener, (v) => update({ opener: v, ourCalls: [] })),
        isOpp(OPENER[state.opener]) ? null : segmented('Opponents', [[false, 'Always pass'], [true, 'Enter their calls']], state.compete, (v) => update({ compete: v, ourCalls: [] })),
        segmented('Seat of the opening bid', SEAT_NAMES.map((t, i) => [i + 1, t]), state.seat, (v) => update({ seat: v, ourCalls: [] })),
        segmented('Vulnerable', [['none', 'None'], ['we', 'We are'], ['they', 'They are'], ['both', 'Both']], state.vul, (v) => update({ vul: v })),
        auctionStrip(a));
      live.replaceChildren(answerCard(a));
      bottom.replaceChildren(...(ourTurn ? [biddingBox(a, { onCall: (c) => update({ ourCalls: [...state.ourCalls, c] }), doubles: oppsEnter(state) })] : []));
    });
  }

  render();
}
