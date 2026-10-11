import { SUITS, RANKS, SYMBOL, cardCount, evaluate, toggleCard, randomHand, emptyHand } from '../cards.js';
import { rankLabel } from '../format.js';
import { el } from './dom.js';

export function handPicker({ hand, onChange }) {
  const root = el('div', { class: 'picker' });
  let current = hand;

  function set(next) {
    current = next;
    render();
    onChange(current);
  }

  function render() {
    const n = cardCount(current);
    root.replaceChildren(
      el('div', { class: 'label' }, `Your hand — ${n}/13 cards · ${evaluate(current).hcp} HCP`),
      ...SUITS.map((s) => el('div', { class: 'suit-row' },
        el('span', { class: 'suit', 'aria-hidden': 'true' }, SYMBOL[s]),
        ...[...RANKS].map((r) => {
          const on = current[s].includes(r);
          return el('button', {
            type: 'button',
            class: `rk${on ? ' on' : ''}`,
            'aria-pressed': String(on),
            'aria-label': `${SYMBOL[s]} ${rankLabel(r)}`,
            disabled: !on && n >= 13,
            onclick: () => set(toggleCard(current, s, r)),
          }, rankLabel(r));
        }))),
      el('div', { class: 'row-buttons' },
        el('button', { type: 'button', class: 'pill', onclick: () => set(randomHand()) }, 'Random hand'),
        el('button', { type: 'button', class: 'pill', onclick: () => set(emptyHand()) }, 'Clear')));
  }

  render();
  return { root };
}
