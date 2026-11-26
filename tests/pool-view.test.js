import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, GROUPS } from '../js/pool/catalog.js';
import { normalizeCard, pick, HOUSE_CARD } from '../js/pool/card.js';
import { cardPanels, cardText, differences } from '../js/pool/view.js';

test('every slot is in exactly one panel, panels in card order', () => {
  const panels = cardPanels(normalizeCard({ base: 'sayc' }));
  assert.deepEqual(panels.map((p) => p.group), GROUPS.map(([g]) => g));
  const slots = panels.flatMap((p) => p.rows.map((r) => r.slot));
  assert.deepEqual([...slots].sort(), SLOTS.map((s) => s.id).sort());
});

test('rows show the card\'s answers, discuss marks, readiness and free text', () => {
  let c = normalizeCard({ base: '2/1', discuss: ['keycard'], text: { slam: 'Exclusion when we agree.' } });
  c = pick(c, 'nt-defence', 'landy');
  const panels = cardPanels(c);
  const row = (slot) => panels.flatMap((p) => p.rows).find((r) => r.slot === slot);
  assert.equal(row('nt-defence').optionTitle, 'Landy');
  assert.equal(row('nt-defence').ready, true, 'every answer has rules since phase 7');
  assert.equal(row('passed-2c').optionTitle, 'Drury');
  assert.equal(row('keycard').discuss, true);
  assert.equal(panels.find((p) => p.group === 'slam').text, 'Exclusion when we agree.');
  assert.ok(panels[0].lines.some((l) => /game forcing, 12\+/.test(l)));
});

test('the text copy names the card and every answer', () => {
  const t = cardText({ ...HOUSE_CARD, discuss: ['keycard'] });
  assert.match(t, /^House convention card \(2\/1 Game Forcing\)/);
  assert.match(t, /Drury/);
  assert.match(t, /4NT: RKCB 1430 \[to discuss\]/);
  assert.match(cardText(normalizeCard({ base: 'sayc' })), /Standard American/);
});

test('differences from the house card', () => {
  assert.deepEqual(differences(HOUSE_CARD), []);
  const c = pick(normalizeCard({ base: '2/1' }), 'nt-defence', 'landy');
  assert.deepEqual(differences(c).map((d) => d.optionTitle), ['Landy']);
  const sayc = differences(normalizeCard({ base: 'sayc' }));
  assert.equal(sayc[0].optionTitle, 'Standard American (SAYC)');
  assert.ok(sayc.length > 10);
});

test('describeCard: the system, then the changes from its own standard, with their questions', async () => {
  const { describeCard } = await import('../js/pool/view.js');
  assert.equal(describeCard(normalizeCard({ base: 'sayc' })), 'Standard American (SAYC)');
  assert.equal(describeCard(pick(normalizeCard({ base: 'sayc' }), 'keycard', 'rkcb-1430')), 'Standard American (SAYC); 4NT: RKCB 1430');
  assert.equal(describeCard(pick(normalizeCard({ base: '2/1' }), 'splinters', 'off')), '2/1 Game Forcing; Splinter raises: Off');
});
