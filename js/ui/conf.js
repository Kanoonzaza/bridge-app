import { el } from './dom.js';

// The confidence tag under a suggestion: agreed system, proposed agreement, or general judgment.
export const confRow = (c) => (c
  ? el('div', { class: 'conf' }, el('span', { class: `chip${c.level === 'agreed' ? '' : ' warn'}` }, c.label), el('span', { class: 'muted' }, c.note))
  : null);
