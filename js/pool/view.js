// A card as a page: one panel per group, in the order of a paper convention card. Pure data (no DOM),
// shared by the Card tab, the printed card and "Copy as text".
import { GROUPS, SLOTS, option } from './catalog.js';
import { resolve, PRESETS } from './card.js';

// What each base system plays that is not a choice on the card.
const BASE_LINES = {
  sayc: ['5-card majors · 1NT 15–17', '2-over-1 response: 10+, forcing one round, promises a rebid', '1NT response to 1♥ / 1♠: 6–10, not forcing'],
  '2/1': ['5-card majors · 1NT 15–17', '2-over-1 response: game forcing, 12+', '1NT response to 1♥ / 1♠: forcing, 6–12'],
};
// Played on every card (the core rules).
const CORE_LINES = {
  majors: ['Jacoby 2NT: 4+ support, 12+, game forcing'],
  notrump: ['Stayman · Jacoby transfers · Gerber directly over 1NT / 2NT'],
  twos: ['Strong 2♣ (2♦ waiting) · weak twos, 5–10 · 3- and 4-level preempts'],
  competitive: ['Michaels cue-bid · Unusual 2NT · Jordan 2NT over their double · negative doubles'],
};

// [{ group, title, lines: [text], rows: [{ slot, title, option, optionTitle, line, notes, ready, discuss }], text }]
export function cardPanels(card) {
  const picks = resolve(card);
  const discuss = new Set(card.discuss ?? []);
  return GROUPS.map(([group, title]) => {
    const rows = SLOTS.filter((s) => s.group === group).map((s) => {
      const o = option(s.id, picks[s.id]) ?? s.options[0];
      return { slot: s.id, title: s.title, option: o.id, optionTitle: o.title, line: o.line, notes: o.notes ?? null, ready: o.ready, discuss: discuss.has(s.id) };
    });
    const lines = group === 'base' ? BASE_LINES[card.base] : CORE_LINES[group] ?? [];
    return { group, title, lines, rows, text: card.text?.[group] ?? '' };
  });
}

// The card as plain text, for pasting into a chat or an email.
export function cardText(card) {
  const out = [`${card.name || 'Convention card'} (${card.base === 'sayc' ? 'Standard American' : '2/1 Game Forcing'})`, ''];
  for (const p of cardPanels(card)) {
    out.push(p.title.toUpperCase());
    for (const l of p.lines) out.push(`  ${l}`);
    for (const r of p.rows) {
      if (r.slot === 'base') continue;
      out.push(`  ${r.title}: ${r.optionTitle}${r.discuss ? ' [to discuss]' : ''}`);
      out.push(`    ${r.line}`);
    }
    if (p.text) out.push(`  Also: ${p.text}`);
    out.push('');
  }
  return out.join('\n').trimEnd();
}

// The answers on a card that differ from the house card (our 2/1 system): what opponents most need to know.
// [{ slot, title, optionTitle }]; the base system counts as one answer.
export function differences(card) {
  const r = resolve(card);
  return SLOTS.filter((s) => !s.text && r[s.id] !== PRESETS['2/1'][s.id])
    .map((s) => ({ slot: s.id, title: s.title, optionTitle: option(s.id, r[s.id]).title }));
}

// A card in one line, for a partner or the other pair: its system, then the answers that differ from that
// system's own standard, each with its question ("Standard American (SAYC); 4NT: RKCB 1430").
export function describeCard(card) {
  const system = card.base === 'sayc' ? 'Standard American (SAYC)' : '2/1 Game Forcing';
  const changes = SLOTS.filter((s) => !s.text && s.id !== 'base' && card.picks?.[s.id] && card.picks[s.id] !== PRESETS[card.base][s.id])
    .map((s) => `${s.title}: ${option(s.id, card.picks[s.id]).title}`);
  return changes.length ? `${system}; ${changes.join('; ')}` : system;
}
