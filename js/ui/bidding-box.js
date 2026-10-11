import { legalCalls } from '../auction.js';
import { callLabel } from '../format.js';
import { el } from './dom.js';

export function biddingBox(auction, { onCall, doubles = false }) {
  const legal = new Set(legalCalls(auction));
  const button = (c, extra = '') => el('button', {
    type: 'button',
    class: `bid${extra}`,
    disabled: !legal.has(c),
    onclick: () => onCall(c),
  }, callLabel(c));
  const rows = [];
  for (let lv = 1; lv <= 7; lv++) {
    const calls = ['C', 'D', 'H', 'S', 'N'].map((s) => `${lv}${s}`);
    if (calls.some((c) => legal.has(c))) rows.push(el('div', { class: 'bb-row' }, ...calls.map((c) => button(c))));
  }
  const extras = ['P', ...(doubles ? ['X', 'XX'] : [])].map((c) => button(c, c === 'P' ? ' pass' : ''));
  return el('div', { class: 'bbox', 'aria-label': 'Bidding box' }, el('div', { class: 'bb-extras' }, ...extras), ...rows);
}
