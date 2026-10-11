import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ALL from '../js/system/index.js';
import { randomHand } from '../js/cards.js';
import { advise, matchingEntries } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';
import { mulberry32 } from './helpers.js';

const anchors = JSON.parse(readFileSync(new URL('../data/notes-anchors.json', import.meta.url), 'utf8'));

test('every entry is complete and links to a notes section', () => {
  for (const e of ALL) {
    const id = `${JSON.stringify(e.after)} ${e.call}`;
    assert.ok(Array.isArray(e.after), `after: ${id}`);
    assert.equal(typeof e.call, 'string', `call: ${id}`);
    assert.ok(e.meaning && e.meaning.length > 3, `meaning: ${id}`);
    assert.equal(typeof e.shows, 'object', `shows: ${id}`);
    assert.ok(anchors.includes(e.notes), `notes anchor "${e.notes}": ${id}`);
    if (e.pick) assert.equal(typeof e.priority, 'number', `priority: ${id}`);
  }
});

test('no two entries define the same call in the same situation', () => {
  const seen = new Set();
  for (const e of ALL) {
    const k = JSON.stringify([e.tail ?? false, e.after, e.ctx ?? {}, e.variant ?? null, e.call]);
    assert.ok(!seen.has(k), `duplicate ${k}`);
    seen.add(k);
  }
});

test('opening sweep: one answer per priority level, never "not covered"', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 5000; i++) {
    const hand = randomHand(rng);
    const seat = (i % 4) + 1;
    const auction = buildAuction({ opener: 'me', seat, ourCalls: [] });
    const byPriority = new Map();
    for (const m of matchingEntries(hand, auction)) byPriority.set(m.priority, [...(byPriority.get(m.priority) ?? []), m.call]);
    for (const [p, calls] of byPriority) assert.ok(calls.length === 1, `priority ${p} matched ${calls} for ${JSON.stringify(hand)} seat ${seat}`);
    assert.ok(!advise(hand, auction).notCovered);
  }
});

test('entries only use placeholders bound by their pattern, known ctx keys and valid calls', () => {
  const CTX_KEYS = ['seat', 'opened', 'role', 'responderPassed', 'competitive'];
  const BINDER = { M: 'M', m: 'm', x: 'x', O: 'M', n: 'm' }; // placeholder -> strain letter that must appear in `after`
  for (const e of ALL) {
    const id = `${JSON.stringify(e.after)} ${e.call}`;
    const bound = new Set();
    for (const tok of e.after) {
      const t = tok.startsWith('(') ? tok.slice(1, -1) : tok;
      if (t.length === 2) bound.add(t[1]);
    }
    const used = new Set();
    if (/^[1-7]/.test(e.call)) used.add(e.call[1]);
    for (const m of (e.meaning ?? '').matchAll(/\{([^}]*)\}/g)) {
      assert.ok(/^[MmxOn]$/.test(m[1]), `unknown placeholder {${m[1]}} in meaning: ${id}`);
      used.add(m[1]);
    }
    for (const k of Object.keys(e.shows?.len ?? {})) used.add(k);
    for (const ph of used) {
      if (!(ph in BINDER)) continue; // literal suit or notrump
      assert.ok(bound.has(BINDER[ph]), `placeholder "${ph}" is not bound by after ${JSON.stringify(e.after)}: ${id}`);
    }
    for (const k of Object.keys(e.ctx ?? {})) assert.ok(CTX_KEYS.includes(k), `unknown ctx key "${k}": ${id}`);
    assert.ok(e.call === 'P' || e.call === 'X' || e.call === 'XX' || /^[1-7][CDHSNMmxOn]$/.test(e.call), `invalid call "${e.call}": ${id}`);
  }
});
