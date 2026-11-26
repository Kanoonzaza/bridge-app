// The Card tab: a pair's convention cards. Three screens:
//   list    the cards on this phone, the house card (our own system) last; which one is in use
//   edit    pick a base system, then one answer per question of the pool; free text per panel
//   view    the card as one page (print, copy as text, share with the partner)
//   join    open a shared card by code or link (?card=CODE): join it as the partner, or copy it
// Cards live in bc:cards (js/pool/cards-store.js); the screen and an unsaved draft in bc:cardui.
// Shared cards live at cards/{code} (js/pool/sync.js): two partners at most, the newest copy wins.
import { el, keepFocus, segmented } from './dom.js';
import { copyButton } from './copy.js';
import { NOTES_URL, FIREBASE } from '../config.js';
import { CODE, newCode } from '../table/model.js';
import { firebaseCards, localCards, isMember, isFull } from '../pool/sync.js';
import { describeCard } from '../pool/view.js';
import { GROUPS, SLOTS, option } from '../pool/catalog.js';
import { HOUSE_CARD, BASES, NAME_MAX, TEXT_MAX, normalizeCard, pick, rebase, unready, resolve } from '../pool/card.js';
import { loadCards, saveCard, removeCard, setActive, MAX_CARDS } from '../pool/cards-store.js';
import { cardPanels, cardText } from '../pool/view.js';

const BASE_NAME = { sayc: 'Standard American (SAYC)', '2/1': '2/1 Game Forcing' };
const HOUSE = 'house';

// A code typed, or pasted inside an invite link.
export function cardCode(text) {
  const t = String(text ?? '').toUpperCase();
  const m = /CARD=([A-Z2-9]{6})/.exec(t) ?? /\b([A-Z2-9]{6})\b/.exec(t);
  return m && CODE.test(m[1]) ? m[1] : null;
}

export function cardView(root, store) {
  const saved = store.load('cardui', {});
  const params = new URLSearchParams(location.search);
  const mode = params.get('sync') === 'local' ? 'local' : FIREBASE ? 'firebase' : 'none';
  // The database: loaded on first use (sharing, joining, or refreshing a shared card).
  let syncing = null;
  const connect = () => {
    syncing ??= (async () => {
      if (mode === 'none') throw new Error('sharing is not set up');
      if (mode === 'local') return localCards();
      let timer;
      const late = new Promise((_, no) => { timer = setTimeout(() => no(new Error('no answer from the server')), 20000); });
      try { return await Promise.race([firebaseCards(FIREBASE), late]); } finally { clearTimeout(timer); }
    })().catch((err) => { syncing = null; throw err; });
    return syncing;
  };
  const linkFor = (code) => `${location.origin}${location.pathname}?card=${code}${mode === 'local' ? '&sync=local' : ''}`;
  // which: an index into the list, or 'house'.
  const ui = {
    screen: ['list', 'edit', 'view', 'join'].includes(saved.screen) ? saved.screen : 'list',
    which: saved.which ?? null,
    draft: saved.draft ? normalizeCard(saved.draft) : null,
    confirm: null,
    msg: '',
    busy: false,
    join: { text: '', code: null, shared: null, error: '' },
  };
  const remember = () => store.save('cardui', { screen: ui.screen, which: ui.which, draft: ui.draft });
  const cards = () => loadCards(store);
  const cardAt = (which) => (which === HOUSE ? HOUSE_CARD : cards().list[which] ?? null);
  // A saved state that points at a card that is gone: back to the list.
  if ((ui.screen === 'view' && !cardAt(ui.which)) || (ui.screen === 'edit' && !ui.draft) || ui.screen === 'join') ui.screen = 'list';

  const go = (screen, which = ui.which, draft = null) => {
    Object.assign(ui, { screen, which, draft, confirm: null, msg: '' });
    remember();
    render();
    root.scrollIntoView?.({ block: 'start' });
  };

  function render() {
    keepFocus(root, () => root.replaceChildren(ui.screen === 'edit' ? editor() : ui.screen === 'view' ? viewer() : ui.screen === 'join' ? joiner() : list()));
  }

  // ---------- List ----------
  function summary(card) {
    const n = Object.keys(card.picks).length;
    return `${BASE_NAME[card.base]}${n ? ` · ${n} change${n === 1 ? '' : 's'} from the standard` : ''}`;
  }

  function item(card, which, inUse) {
    const own = which !== HOUSE;
    const confirming = ui.confirm === which;
    return el('div', { class: `panel card-item${inUse ? ' in-use' : ''}` },
      el('div', { class: 'card-item-head' },
        el('div', { class: 'doc-title' }, card.name || 'Untitled convention card'),
        inUse ? el('span', { class: 'chip' }, 'In use') : null),
      el('p', { class: 'muted' }, own ? summary(card) : '2/1 Game Forcing · the system in the notes', own && card.code ? el('span', { class: 'chip' }, 'Shared') : null),
      confirming
        ? el('div', { class: 'row-buttons', role: 'group', 'aria-label': 'Confirm delete' },
          el('span', {}, `Delete “${card.name || 'Untitled convention card'}”?`),
          el('button', { type: 'button', class: 'pill danger', 'data-key': `del-yes-${which}`, onclick: () => { removeCard(store, which); ui.confirm = null; render(); } }, 'Delete'),
          el('button', { type: 'button', class: 'pill', 'data-key': `del-no-${which}`, onclick: () => { ui.confirm = null; render(); } }, 'Keep'))
        : el('div', { class: 'row-buttons' },
          inUse ? null : el('button', { type: 'button', class: 'pill on', 'data-key': `use-${which}`, onclick: () => { setActive(store, own ? which : null); render(); } }, 'Use'),
          el('button', { type: 'button', class: 'pill', 'data-key': `view-${which}`, onclick: () => go('view', which) }, 'View'),
          own ? el('button', { type: 'button', class: 'pill', 'data-key': `edit-${which}`, onclick: () => go('edit', which, card) }, 'Edit') : null,
          own ? el('button', { type: 'button', class: 'pill', 'data-key': `del-${which}`, onclick: () => { ui.confirm = which; render(); } }, 'Delete') : null));
  }

  function list() {
    const { list: all, active } = cards();
    const full = all.length >= MAX_CARDS;
    return el('div', { class: 'stack' },
      el('div', {},
        el('div', { class: 'eyebrow' }, 'Convention cards'),
        el('p', { class: 'muted intro' }, 'Write down what you play with a partner: pick a system, then choose an answer to each question. The convention card in use is the one your partnership plays.')),
      el('div', { class: 'row-buttons' },
        el('button', { type: 'button', class: 'pill on', 'data-key': 'new-card', disabled: full, onclick: () => go('edit', null, normalizeCard({ base: 'sayc' })) }, 'New convention card'),
        el('button', { type: 'button', class: 'pill', 'data-key': 'have-code', onclick: () => { ui.join = { text: '', code: null, shared: null, error: '' }; go('join'); } }, 'I have a code'),
        full ? el('span', { class: 'muted' }, `${MAX_CARDS} convention cards is the most a phone keeps: delete one first.`) : null),
      ...all.map((c, i) => item(c, i, active === i)),
      item(HOUSE_CARD, HOUSE, active === null));
  }

  // ---------- Editor ----------
  const set = (fn) => {
    ui.draft = fn(ui.draft);
    remember();
    render();
  };

  function slotRow(s) {
    const d = ui.draft;
    const value = resolve(d)[s.id];
    const chosen = option(s.id, value);
    const discussing = d.discuss.includes(s.id);
    return el('div', { class: 'slot' },
      segmented(s.title, s.options.map((o) => [o.id, o.title]), value, (v) => set((x) => pick(x, s.id, v))),
      el('p', { class: 'slot-line' },
        el('span', {}, chosen.line),
        chosen.ready ? null : el('span', { class: 'chip warn' }, 'Robots: not yet'),
        chosen.notes ? el('a', { href: `${NOTES_URL}#${chosen.notes}`, class: 'slot-more' }, 'Read more') : null),
      s.id === 'base' ? null : el('label', { class: 'toggle muted' },
        el('input', { type: 'checkbox', 'data-key': `discuss-${s.id}`, checked: discussing, onchange: (e) => set((x) => ({ ...x, discuss: e.target.checked ? [...x.discuss, s.id] : x.discuss.filter((k) => k !== s.id) })) }),
        'To discuss with partner'));
  }

  function editor() {
    const d = ui.draft;
    const isNew = ui.which === null;
    const missing = unready(d);
    // The draft as it is now: typing in the fields updates ui.draft without a re-render.
    const save = async () => {
      const card = { ...ui.draft, ...(ui.draft.code ? { updated: Date.now() } : {}) };
      const i = saveCard(store, card, isNew ? null : ui.which);
      if (i === null) { ui.msg = `This phone already keeps ${MAX_CARDS} convention cards: delete one first.`; render(); return; }
      setActive(store, i);
      go('view', i);
      if (!card.code) return;
      // A shared card: the partner sees the change too.
      try {
        const ok = await (await connect()).save(card.code, card);
        if (!ok) ui.msg = 'Saved on this phone, but the shared copy was not changed: only its two partners can change it.';
      } catch {
        ui.msg = 'Saved on this phone. The shared copy will be updated when you save again with a connection.';
      }
      if (ui.msg) render();
    };
    return el('div', { class: 'stack' },
      el('div', {},
        el('div', { class: 'eyebrow' }, isNew ? 'New convention card' : 'Edit convention card'),
        el('label', { class: 'label', for: 'card-name' }, 'Convention card name'),
        el('input', { id: 'card-name', 'data-key': 'card-name', class: 'field', value: d.name, maxlength: NAME_MAX, placeholder: 'For example: Noon & Pim', autocomplete: 'off',
          oninput: (e) => { ui.draft = { ...ui.draft, name: e.target.value }; remember(); } })),
      ui.msg ? el('p', { class: 'notice', role: 'alert' }, ui.msg) : null,
      missing.length ? el('p', { class: 'close' }, robotsNote(d, missing)) : null,
      ...GROUPS.map(([g, title]) => {
        const slots = SLOTS.filter((s) => s.group === g);
        const panel = cardPanels(d).find((p) => p.group === g);
        return el('section', { class: 'panel card-panel', 'aria-label': title },
          el('h2', { class: 'card-h' }, title),
          g === 'base'
            ? baseRow()
            : slots.map(slotRow),
          panel.lines.length && g !== 'base' ? el('p', { class: 'muted core-line' }, `Also on every convention card: ${panel.lines.join(' · ')}`) : null,
          el('label', { class: 'label', for: `card-text-${g}` }, 'Anything else you agreed here'),
          el('textarea', { id: `card-text-${g}`, 'data-key': `card-text-${g}`, class: 'field', rows: 2, maxlength: TEXT_MAX,
            oninput: (e) => { ui.draft = { ...ui.draft, text: { ...ui.draft.text, [g]: e.target.value } }; remember(); } }, d.text[g] ?? ''));
      }),
      el('div', { class: 'row-buttons card-actions' },
        el('button', { type: 'button', class: 'pill on', 'data-key': 'card-save', onclick: save }, isNew ? 'Save and use' : 'Save'),
        el('button', { type: 'button', class: 'pill', 'data-key': 'card-cancel', onclick: () => go(isNew ? 'list' : 'view') }, 'Cancel')));
  }

  function baseRow() {
    const d = ui.draft;
    return el('div', { class: 'slot' },
      segmented('Base system', BASES.map((b) => [b, BASE_NAME[b]]), d.base, (b) => set((x) => rebase(x, b))),
      el('p', { class: 'slot-line' }, el('span', {}, cardPanels(d)[0].lines.join(' · '))),
      el('p', { class: 'muted base-help' }, 'Changing the system keeps every answer you chose yourself; the others follow the new system.'));
  }

  // ---------- View ----------
  function viewer() {
    const card = cardAt(ui.which);
    const own = ui.which !== HOUSE;
    const { active } = cards();
    const inUse = own ? active === ui.which : active === null;
    const missing = unready(card);
    return el('div', { class: 'stack card-page' },
      el('div', { class: 'row-buttons card-actions' },
        el('button', { type: 'button', class: 'pill', 'data-key': 'card-back', onclick: () => go('list') }, '← All convention cards')),
      el('header', {},
        el('div', { class: 'eyebrow' }, 'Convention card'),
        el('h2', { class: 'card-name' }, card.name || 'Untitled convention card'),
        el('p', { class: 'muted' }, BASE_NAME[card.base], inUse ? el('span', { class: 'chip' }, 'In use') : null)),
      missing.length ? el('p', { class: 'close' }, robotsNote(card, missing)) : null,
      ui.msg ? el('p', { class: 'notice', role: 'status' }, ui.msg) : null,
      ...cardPanels(card).map((p) => el('section', { class: 'panel card-panel', 'aria-label': p.title },
        el('h2', { class: 'card-h' }, p.title),
        p.lines.length ? el('ul', { class: 'core-list' }, ...p.lines.map((l) => el('li', {}, l))) : null,
        el('dl', { class: 'cc' }, ...p.rows.filter((r) => r.slot !== 'base').flatMap((r) => [
          el('dt', {}, r.title),
          el('dd', {},
            el('b', {}, r.optionTitle),
            r.discuss ? el('span', { class: 'chip warn' }, 'To discuss') : null,
            r.ready ? null : el('span', { class: 'chip warn' }, 'Robots: not yet'),
            el('div', { class: 'muted' }, r.line)),
        ])),
        p.text ? el('p', { class: 'card-text' }, el('b', {}, 'Also agreed: '), p.text) : null)),
      el('div', { class: 'row-buttons card-actions' },
        inUse ? null : el('button', { type: 'button', class: 'pill on', 'data-key': 'card-use', onclick: () => { setActive(store, own ? ui.which : null); render(); } }, 'Use this convention card'),
        own ? el('button', { type: 'button', class: 'pill', 'data-key': 'card-edit', onclick: () => go('edit', ui.which, card) }, 'Edit') : null,
        el('button', { type: 'button', class: 'pill', 'data-key': 'card-print', onclick: printCard }, 'Print')),
      own ? shareBlock(card) : null,
      el('div', { class: 'card-actions' }, copyButton('Copy as text', () => cardText(card), 'card-copy', 'Copied. Paste it wherever you keep your notes.', 'Convention card')),
      own ? null : el('p', { class: 'card-actions' }, el('a', { href: 'guide/convention-card.html' }, 'The full house convention card, with every agreement explained →')));
  }

  // ---------- Sharing ----------
  function sendLink(code, name) {
    const url = linkFor(code);
    const text = `Our convention card on Bridge Coach${name ? `: ${name}` : ''} (code ${code})`;
    if (navigator.share) navigator.share({ title: 'Bridge Coach convention card', text, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => { ui.msg = 'Link copied.'; render(); }, () => {});
  }

  async function share(card) {
    ui.busy = true;
    ui.msg = '';
    render();
    try {
      const sync = await connect();
      for (let tries = 0; tries < 5; tries++) {
        const code = newCode(Math.random);
        if (await sync.create(code, card)) {
          saveCard(store, { ...card, code, updated: Date.now() }, ui.which);
          ui.busy = false;
          render();
          sendLink(code, card.name);
          return;
        }
      }
      ui.msg = 'Could not make a code. Try again.';
    } catch (err) {
      ui.msg = `Could not connect. Check the internet connection and try again. (${err.message ?? err})`;
    }
    ui.busy = false;
    render();
  }

  function shareBlock(card) {
    if (mode === 'none') return null;
    if (card.code) {
      return el('div', { class: 'panel share-panel' },
        el('div', { class: 'eyebrow' }, 'Shared with your partner'),
        el('div', { class: 'code-big' }, card.code),
        el('p', { class: 'muted' }, 'Your partner opens the link, or types the code under “I have a code”. Changes either of you saves reach the other.'),
        el('div', { class: 'row-buttons' },
          el('button', { type: 'button', class: 'pill', 'data-key': 'card-send', onclick: () => sendLink(card.code, card.name) }, 'Send the link')));
    }
    return el('div', { class: 'row-buttons card-actions' },
      el('button', { type: 'button', class: 'pill', 'data-key': 'card-share', disabled: ui.busy, onclick: () => share(card) }, ui.busy ? 'Making a code…' : 'Share with your partner'));
  }

  // ---------- Join ----------
  async function openCode(text) {
    const code = cardCode(text);
    ui.join = { ...ui.join, text, code, shared: null, error: '' };
    if (!code) { ui.join.error = 'A code has 6 letters and digits (no 0, 1, I or O). You can also paste the link.'; render(); return; }
    ui.busy = true;
    render();
    try {
      const sync = await connect();
      const shared = await sync.load(code);
      ui.join = { ...ui.join, shared, uid: sync.uid, error: shared ? '' : `No convention card has the code ${code}. Check it with your partner.` };
    } catch (err) {
      ui.join.error = `Could not connect. Check the internet connection and try again. (${err.message ?? err})`;
    }
    ui.busy = false;
    render();
  }

  // Keep a shared card on this phone (replacing the copy already here, if any) and use it.
  function keep(card) {
    const i0 = cards().list.findIndex((c) => c.code && c.code === card.code);
    const i = saveCard(store, card, i0 >= 0 ? i0 : null);
    if (i === null) { ui.join.error = `This phone already keeps ${MAX_CARDS} convention cards: delete one first.`; render(); return; }
    setActive(store, i);
    go('view', i);
  }

  async function joinAsPartner() {
    const { code, shared } = ui.join;
    ui.busy = true;
    render();
    try {
      const ok = await (await connect()).join(code);
      ui.busy = false;
      if (!ok) { ui.join.error = 'Could not join: this convention card already has two partners. You can still copy it as your own.'; render(); return; }
      keep({ ...shared.card, code });
    } catch (err) {
      ui.busy = false;
      ui.join.error = `Could not connect. (${err.message ?? err})`;
      render();
    }
  }

  function joiner() {
    const j = ui.join;
    const s = j.shared;
    const member = s && isMember(s, j.uid);
    return el('div', { class: 'stack' },
      el('div', { class: 'row-buttons card-actions' },
        el('button', { type: 'button', class: 'pill', 'data-key': 'join-back', onclick: () => go('list') }, '← All convention cards')),
      el('div', {},
        el('div', { class: 'eyebrow' }, 'Open a shared convention card'),
        el('div', { class: 'join' },
          el('input', { 'data-key': 'card-code', class: 'field code', value: j.text, maxlength: 200, placeholder: 'CODE or link', autocapitalize: 'characters', 'aria-label': 'Convention card code', oninput: (e) => { ui.join.text = e.target.value; } }),
          el('button', { type: 'button', class: 'pill on', 'data-key': 'card-open', disabled: ui.busy, onclick: () => openCode(ui.join.text) }, 'Open'))),
      j.error ? el('p', { class: 'notice', role: 'alert' }, j.error) : null,
      s ? el('div', { class: 'panel card-item' },
        el('div', { class: 'doc-title' }, s.card.name || 'Untitled convention card'),
        el('p', {}, `${describeCard(s.card)}.`),
        member
          ? el('div', { class: 'row-buttons' }, el('button', { type: 'button', class: 'pill on', 'data-key': 'join-use', onclick: () => keep({ ...s.card, code: j.code }) }, 'Use this convention card'))
          : el('div', { class: 'row-buttons' },
            isFull(s) ? el('span', { class: 'muted' }, 'This convention card already has two partners.') : el('button', { type: 'button', class: 'pill on', 'data-key': 'join-partner', disabled: ui.busy, onclick: joinAsPartner }, 'I am the partner'),
            el('button', { type: 'button', class: 'pill', 'data-key': 'join-copy', onclick: () => keep(normalizeCard({ ...s.card, code: undefined, name: s.card.name })) }, 'Copy as my own convention card'))) : null);
  }

  // A shared card on this phone: keep the newest copy (the partner may have changed it).
  async function refresh() {
    const shared = cards().list.map((c, i) => [c, i]).filter(([c]) => c.code);
    if (!shared.length || mode === 'none') return;
    try {
      const sync = await connect();
      let changed = false;
      for (const [c, i] of shared) {
        const s = await sync.load(c.code);
        if (s && s.card.updated > (c.updated ?? 0)) { saveCard(store, { ...s.card, code: c.code }, i); changed = true; }
      }
      if (changed && ui.screen !== 'edit') render();
    } catch { /* offline: the copies on this phone stay */ }
  }

  // Opened from the Notes tab: show the card in use.
  window.addEventListener('bc:show-card', () => {
    const { active } = cards();
    go('view', active === null ? HOUSE : active);
  });

  // A link with ?card=CODE opens that card.
  const linked = cardCode(params.get('card'));
  if (linked) {
    ui.screen = 'join';
    ui.join = { text: linked, code: linked, shared: null, error: '' };
    openCode(linked);
  }
  render();
  refresh();
}

// Print only the card: the other tabs and the buttons are hidden while printing (css: body.print-card).
function printCard() {
  document.body.classList.add('print-card');
  window.addEventListener('afterprint', () => document.body.classList.remove('print-card'), { once: true });
  window.print();
}

// Which parts of the card the app cannot bid yet (they are bid as on the house card).
function robotsNote(card, missing) {
  if (missing.some((m) => m.slot === 'base')) {
    return `The robots do not know ${BASE_NAME[card.base]} yet: until they do, they bid this convention card as our 2/1 house convention card. The convention card itself shows what you play.`;
  }
  const names = missing.map((m) => option(m.slot, m.option).title);
  return `${names.length === 1 ? 'One choice is' : `${names.length} choices are`} not in the robots' rules yet (${names.join(', ')}): they bid ${names.length === 1 ? 'it' : 'those'} as on the house convention card. The convention card itself shows what you play.`;
}
