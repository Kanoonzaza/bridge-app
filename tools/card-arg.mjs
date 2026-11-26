// A card named on the command line, for the tools that take --card:
//   sayc | 2/1 | house                      a preset (house = 2/1, our own system)
//   2/1+passed-2c=natural+keycard=blackwood a preset with changes
//   path/to/card.json                       a saved card
import { readFileSync } from 'node:fs';
import { normalizeCard, pick, HOUSE_CARD } from '../js/pool/card.js';
import { slot, option } from '../js/pool/catalog.js';

export function cardFromArg(text) {
  if (!text || text === 'house') return HOUSE_CARD;
  if (text.endsWith('.json')) return normalizeCard(JSON.parse(readFileSync(text, 'utf8')));
  const [base, ...changes] = text.split('+');
  if (base !== 'sayc' && base !== '2/1') throw new Error(`unknown base "${base}": use sayc or 2/1`);
  let card = normalizeCard({ base, name: text });
  for (const ch of changes) {
    const [s, o] = ch.split('=');
    if (!slot(s)) throw new Error(`unknown slot "${s}"`);
    if (!option(s, o)) throw new Error(`unknown option "${o}" for ${s}`);
    card = pick(card, s, o);
  }
  return card;
}

// Takes `--name value` out of argv; returns the value or null.
export function takeFlag(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const [, v] = argv.splice(i, 2);
  return v ?? null;
}
