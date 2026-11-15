import { el } from './dom.js';
import { activeCard } from '../pool/cards-store.js';
import { HOUSE_CARD, optActive } from '../pool/card.js';

// The Notes tab: the convention card, the full system notes, the bridge fundamentals, and the notes' contents.
// The pages live in guide/ (built from notes/ by `npm run stamp`) and open inside the app.
// With a card of the pair's own in use (Card tab), the contents leave out the conventions it does not play,
// and "Convention card" opens that card. The tab redraws when the card in use changes (event bc:cards).
const CARD = 'guide/convention-card.html';
const NOTES = 'guide/system-notes.html';
const BASICS = 'guide/fundamentals.html';

export function notesView(root, store) {
  let toc = null;
  const card = () => (store ? activeCard(store) : HOUSE_CARD);

  const openOwnCard = (e) => {
    if (card() === HOUSE_CARD) return;
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('bc:tab', { detail: 'card' }));
    window.dispatchEvent(new CustomEvent('bc:show-card'));
  };

  function rows(list) {
    const c = card();
    const shown = list.filter((s) => !s.opt || optActive(c, s.opt));
    return shown.flatMap((s, i) => [
      // A heading for each part of the notes (Opening the bidding, Competitive bidding, ...).
      s.part && s.part !== shown[i - 1]?.part ? el('div', { class: 'toc-part' }, s.part) : null,
      el('a', { class: `toc-row${s.id === 'new-agreements-proposed' ? ' proposed' : ''}`, href: `${NOTES}#${s.id}` },
        el('span', {}, s.title),
        s.id === 'new-agreements-proposed' ? el('span', { class: 'chip warn' }, 'Confirm with partner') : s.tier ? el('span', { class: 'chip' }, s.tier) : null),
    ].filter(Boolean));
  }

  function render() {
    const c = card();
    const own = c !== HOUSE_CARD;
    const list = el('div', { class: 'lines toc-list' }, toc ? rows(toc) : el('p', { class: 'muted' }, 'Loading contents…'));
    root.replaceChildren(el('div', { class: 'stack' },
      el('a', { class: 'panel doc-link', href: CARD, 'data-key': 'open-card', onclick: openOwnCard },
        el('div', { class: 'eyebrow' }, 'Convention card'),
        el('div', { class: 'doc-title' }, own ? (c.name || 'Your card') : 'Our system on one page'),
        el('p', { class: 'muted' }, own ? 'The card in use, from the Card tab.' : 'Openings, responses, conventions and competitive agreements at a glance.')),
      el('a', { class: 'panel doc-link', href: NOTES, 'data-key': 'open-notes' },
        el('div', { class: 'eyebrow' }, 'System notes'),
        el('div', { class: 'doc-title' }, 'Every agreement, explained'),
        el('p', { class: 'muted' }, own ? 'What each bid means, why, and worked examples, for the conventions on your card.' : 'What each bid means, why, and worked examples. The Advisor and Decoder link here.')),
      el('a', { class: 'panel doc-link', href: BASICS, 'data-key': 'open-basics' },
        el('div', { class: 'eyebrow' }, 'Bridge fundamentals'),
        el('div', { class: 'doc-title' }, 'What every player uses'),
        el('p', { class: 'muted' }, 'Points, losers, total tricks, game and slam targets, planning the play, leads and signals.')),
      el('div', {}, el('div', { class: 'label' }, own ? `Contents of the system notes, for ${c.name || 'your card'}` : 'Contents of the system notes'), list)));
  }

  render();
  fetch('data/notes-toc.json')
    .then((r) => r.json())
    .then((list) => { toc = list; render(); })
    .catch(() => root.querySelector('.toc-list')?.replaceChildren(el('p', { class: 'muted' }, 'The contents could not be loaded. Open the system notes above.')));
  window.addEventListener('bc:cards', render);
}
