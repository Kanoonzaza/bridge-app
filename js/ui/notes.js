import { el } from './dom.js';

// The Notes tab: the convention card, the full system notes, and the notes' contents.
// The pages live in guide/ (built from notes/ by `npm run stamp`) and open inside the app.
const CARD = 'guide/convention-card.html';
const NOTES = 'guide/system-notes.html';

export function notesView(root) {
  const list = el('div', { class: 'lines toc-list' }, el('p', { class: 'muted' }, 'Loading contents…'));
  root.replaceChildren(el('div', { class: 'stack' },
    el('a', { class: 'panel doc-link', href: CARD, 'data-key': 'open-card' },
      el('div', { class: 'eyebrow' }, 'Convention card'),
      el('div', { class: 'doc-title' }, 'Our system on one page'),
      el('p', { class: 'muted' }, 'Openings, responses, conventions and competitive agreements at a glance.')),
    el('a', { class: 'panel doc-link', href: NOTES, 'data-key': 'open-notes' },
      el('div', { class: 'eyebrow' }, 'System notes'),
      el('div', { class: 'doc-title' }, 'Every agreement, explained'),
      el('p', { class: 'muted' }, 'What each bid means, why, and worked examples. The Advisor and Decoder link here.')),
    el('div', {}, el('div', { class: 'label' }, 'Contents of the system notes'), list)));

  fetch('data/notes-toc.json')
    .then((r) => r.json())
    .then((toc) => list.replaceChildren(...toc.flatMap((s, i) => [
      // A heading for each part of the notes (Opening the bidding, Competitive bidding, ...).
      s.part && s.part !== toc[i - 1]?.part ? el('div', { class: 'toc-part' }, s.part) : null,
      el('a', { class: `toc-row${s.id === 'new-agreements-proposed' ? ' proposed' : ''}`, href: `${NOTES}#${s.id}` },
        el('span', {}, s.title),
        s.id === 'new-agreements-proposed' ? el('span', { class: 'chip warn' }, 'Confirm with partner') : s.tier ? el('span', { class: 'chip' }, s.tier) : null),
    ].filter(Boolean))))
    .catch(() => list.replaceChildren(el('p', { class: 'muted' }, 'The contents could not be loaded. Open the system notes above.')));
}
