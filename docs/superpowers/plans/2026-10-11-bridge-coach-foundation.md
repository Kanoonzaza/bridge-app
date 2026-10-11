# Bridge Coach — Plan 1: Foundation and Opening Bids

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, installable offline Bridge Coach on GitHub Pages whose Advisor recommends opening bids and whose Decoder explains openings, built on the shared rules-table engine that later plans extend.

**Architecture:** Plain ES modules, no build step. Pure logic (`js/cards.js`, `js/auction.js`, `js/engine.js`, `js/advisor-model.js`, `js/system/*`) is tested with `node --test`; UI modules in `js/ui/` render with a tiny DOM helper. One rules table (`js/system/*.js`) feeds both the Decoder (meanings) and the Advisor (pick functions in priority order). A cache-first service worker makes it work offline; a gated update bar handles new versions.

**Tech Stack:** HTML, CSS, vanilla JavaScript (ES2022 modules), Node 24 built-in test runner, Python 3 + Pillow (icons only), GitHub Pages via `gh`.

**Spec:** `docs/superpowers/specs/2026-10-11-bridge-app-design.md`

**Later plans (not this one):** Plan 2 responses to 1-level openings; Plan 3 opener's rebids, reverses, XYZ, fourth suit; Plan 4 notrump, 2♣, weak twos, preempts, slam; Plan 5 competitive decoder meanings. Each adds entries to `js/system/` plus known-answer tests; no engine changes expected.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` | Marks the repo as ES modules; `npm test` → `node --test` |
| `js/config.js` | Constants: published notes URL |
| `js/cards.js` | Hand parse/format/toggle/random; evaluation (HCP, lengths, shape, LTC, Rule of 20/15, dummy points, hand quality) |
| `js/format.js` | Display labels for calls and ranks |
| `js/auction.js` | Calls, legality, completion, seats, `situationAt()` (situation key + context) |
| `js/engine.js` | Pattern matching, `candidates`, `explain`, `summarize`, `describeShown`, `nextOptions`, `advise`, `matchingEntries` |
| `js/advisor-model.js` | Builds the full auction for the Advisor from (opener, seat, our calls) |
| `js/system/index.js` | Concatenates all topic rule files |
| `js/system/openings.js` | Opening-bid entries and helpers |
| `js/store.js` | Safe `localStorage` wrapper |
| `js/ui/dom.js` | `el()`, red-suit text, `segmented()` |
| `js/ui/hand-picker.js` | 4×13 card picker |
| `js/ui/bidding-box.js` | Bidding box |
| `js/ui/advisor.js` | Advisor tab |
| `js/ui/decoder.js` | Decoder tab |
| `js/ui/update.js` | Service-worker registration + update bar |
| `js/ui/app.js` | Tabs and start-up |
| `index.html`, `css/app.css`, `manifest.webmanifest`, `sw.js`, `icons/` | Shell, style, install, offline |
| `data/notes-anchors.json` | Section ids of the published notes (written by `../build.py`) |
| `tools/make_icons.py` | Generates PNG icons |
| `tests/*.test.js`, `tests/helpers.js` | Unit, known-answer and consistency tests |

All commands run from `C:\Users\HP\Claude work\bridge\bridge-app` in Git Bash.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`, `js/config.js`, `js/system/index.js`, `tests/smoke.test.js`

- [ ] **Step 1: Create the files**

`package.json`
```json
{
  "name": "bridge-coach",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
```

`.gitignore`
```
node_modules/
.claude/
```

`README.md`
```markdown
# Bridge Coach

Practice app for our 2/1 Game Forcing partnership system: an Advisor that suggests a bid for your hand and a Decoder that explains any auction.

Live: https://kanoonzaza.github.io/bridge-app/

- Tests: `npm test` (Node 20+)
- Rules live in `js/system/`; every entry links to a section of the published system notes.
- For practice and study only; electronic aids are not allowed at the table.
```

`js/config.js`
```js
export const NOTES_URL = 'https://claude.ai/artifact/NrdCttHcwDpCv83CsLGpfd';
```

`js/system/index.js`
```js
const ALL = [];
export default ALL;
```

`tests/smoke.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ALL from '../js/system/index.js';

test('rules table loads as an array', () => {
  assert.ok(Array.isArray(ALL));
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: `# pass 1`, `# fail 0`

- [ ] **Step 3: Commit**

```bash
git add package.json .gitignore README.md js tests
git commit -m "chore: scaffold Bridge Coach"
```

---

### Task 2: Hand model — parse, format, toggle, random

**Files:**
- Create: `js/cards.js`, `tests/helpers.js`, `tests/cards.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/helpers.js`
```js
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`tests/cards.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, formatHand, cardCount, toggleCard, randomHand, emptyHand } from '../js/cards.js';
import { mulberry32 } from './helpers.js';

test('parses plain and symbol forms, with 10 and voids', () => {
  assert.deepEqual(parseHand('KJ852 83 Q4 J953'), { S: 'KJ852', H: '83', D: 'Q4', C: 'J953' });
  assert.deepEqual(parseHand('♠AK ♥KJ862 ♦Q74 ♣K93'), { S: 'AK', H: 'KJ862', D: 'Q74', C: 'K93' });
  assert.equal(parseHand('♠KQ1083 ♥AJ974 ♦5 ♣84').S, 'KQT83');
  assert.equal(parseHand('♠J863 ♥Q752 ♦97632 ♣—').C, '');
  assert.equal(parseHand('J863 Q752 97632 -').C, '');
});

test('sorts ranks high to low', () => {
  assert.equal(parseHand('25KJ8 38 4Q 395J').S, 'KJ852');
});

test('rejects bad input', () => {
  assert.throws(() => parseHand('KJ852 83 Q4'), /four suit groups/);
  assert.throws(() => parseHand('KJ85Z 83 Q4 J953'), /Unknown card/);
  assert.throws(() => parseHand('KK852 83 Q4 J953'), /Duplicate/);
});

test('formats with symbols, 10 and a dash for voids', () => {
  assert.equal(formatHand(parseHand('KQ1083 AJ974 5 84')), '♠KQ1083 ♥AJ974 ♦5 ♣84');
  assert.equal(formatHand(parseHand('J863 Q752 97632 -')), '♠J863 ♥Q752 ♦97632 ♣—');
});

test('counts and toggles cards', () => {
  let h = emptyHand();
  assert.equal(cardCount(h), 0);
  h = toggleCard(h, 'S', '5');
  h = toggleCard(h, 'S', 'A');
  assert.equal(h.S, 'A5');
  h = toggleCard(h, 'S', 'A');
  assert.equal(h.S, '5');
  assert.equal(cardCount(h), 1);
});

test('random hands have 13 distinct cards', () => {
  const rng = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const h = randomHand(rng);
    assert.equal(cardCount(h), 13);
    const all = ['S', 'H', 'D', 'C'].flatMap((s) => [...h[s]].map((r) => s + r));
    assert.equal(new Set(all).size, 13);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/cards.test.js`
Expected: FAIL — `Cannot find module` for `js/cards.js`

- [ ] **Step 3: Implement**

`js/cards.js`
```js
export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = 'AKQJT98765432';
export const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣', N: 'NT' };
export const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const HCP = { A: 4, K: 3, Q: 2, J: 1 };

const sortRanks = (s) => [...s].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b)).join('');

export function emptyHand() {
  return { S: '', H: '', D: '', C: '' };
}

export function parseHand(text) {
  const groups = String(text).replace(/10/g, 'T').replace(/[♠♥♦♣]/g, ' ').trim().toUpperCase().split(/\s+/);
  if (groups.length !== 4) throw new Error('A hand needs four suit groups (spades hearts diamonds clubs)');
  const hand = emptyHand();
  const seen = new Set();
  SUITS.forEach((s, i) => {
    const g = groups[i].replace(/[-—–]/g, '');
    for (const r of g) {
      if (!RANKS.includes(r)) throw new Error(`Unknown card "${r}"`);
      if (seen.has(s + r)) throw new Error(`Duplicate card ${SYMBOL[s]}${r}`);
      seen.add(s + r);
    }
    hand[s] = sortRanks(g);
  });
  return hand;
}

export function formatHand(hand) {
  return SUITS.map((s) => SYMBOL[s] + (hand[s] ? hand[s].replace(/T/g, '10') : '—')).join(' ');
}

export function cardCount(hand) {
  return SUITS.reduce((n, s) => n + hand[s].length, 0);
}

export function toggleCard(hand, suit, rank) {
  const next = { ...hand };
  next[suit] = hand[suit].includes(rank) ? hand[suit].replace(rank, '') : sortRanks(hand[suit] + rank);
  return next;
}

export function randomHand(rng = Math.random) {
  const deck = SUITS.flatMap((s) => [...RANKS].map((r) => [s, r]));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hand = emptyHand();
  for (const [s, r] of deck.slice(0, 13)) hand[s] += r;
  for (const s of SUITS) hand[s] = sortRanks(hand[s]);
  return hand;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/cards.test.js`
Expected: all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add js/cards.js tests/helpers.js tests/cards.test.js
git commit -m "feat: hand parsing, formatting and random deals"
```

---

### Task 3: Hand evaluation

**Files:**
- Modify: `js/cards.js` (append)
- Create: `tests/evaluate.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/evaluate.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand, evaluate, losingTricks, ruleOf20, ruleOf15, adjustedHcp, dummyPoints, quality } from '../js/cards.js';

const ev = (t) => evaluate(parseHand(t));

test('HCP, lengths, pattern and shape', () => {
  const e = ev('KJ852 83 Q4 J953');
  assert.equal(e.hcp, 7);
  assert.deepEqual(e.len, { S: 5, H: 2, D: 2, C: 4 });
  assert.deepEqual(e.pattern, [5, 4, 2, 2]);
  assert.equal(e.shape, 'semi');
  assert.equal(ev('K5 AJ73 KQ84 J62').shape, 'balanced');
  assert.equal(ev('AK KJ862 Q74 K93').balanced, true);
  assert.equal(ev('5 AQ74 AKJ83 K62').shape, 'unbalanced');
});

test('good suit means 2 of the top 3 honors', () => {
  const e = ev('KQJ953 74 K82 63');
  assert.equal(e.good.S, true);
  assert.equal(e.good.D, false);
});

test('losing trick count', () => {
  assert.equal(losingTricks(parseHand('AKQT73 AK4 A5 K2')), 3);
  assert.equal(losingTricks(parseHand('AK5 KQ4 AJ73 K82')), 6);
});

test('Rule of 20 and Rule of 15', () => {
  assert.equal(ruleOf20(ev('KQT83 AJ974 5 84')), 20);
  assert.equal(ruleOf15(ev('KQ94 A82 Q73 952')), 15);
});

test('short honors lose value', () => {
  assert.equal(adjustedHcp(ev('KT63 Q A8752 J94')), 8);
  assert.equal(adjustedHcp(ev('QT63 K A8752 J94')), 9);
  assert.equal(adjustedHcp(ev('KT63 A Q8752 J94')), 10);
  assert.equal(adjustedHcp(ev('Q4 QJ5 QJ73 KJ62')), 11);
});

test('dummy points add shortness outside trumps', () => {
  assert.equal(dummyPoints(ev('5 KT74 A9653 Q72'), 'H'), 12);
  assert.equal(dummyPoints(ev('K83 QT7 A965 742'), 'H'), 9);
  assert.equal(dummyPoints(ev('KT63 Q A8752 J94'), 'S'), 11);
  assert.equal(dummyPoints(ev('QT63 K A8752 J94'), 'S'), 12);
  assert.equal(dummyPoints(ev('KT63 A Q8752 J94'), 'S'), 13);
});

test('hand quality: good 12 versus bad 12', () => {
  assert.equal(quality(ev('Q4 A5 KQJT63 974')).good, true);
  assert.equal(quality(ev('Q4 QJ5 QJ73 KJ62')).good, false);
  assert.equal(quality(ev('K73 A84 A962 J74'), { fit: true }).good, true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/evaluate.test.js`
Expected: FAIL — `evaluate` is not exported

- [ ] **Step 3: Implement (append to `js/cards.js`)**

```js
export function losingTricks(hand) {
  let n = 0;
  for (const s of SUITS) {
    const top = hand[s].slice(0, Math.min(3, hand[s].length));
    n += ['A', 'K', 'Q'].slice(0, top.length).filter((r) => !top.includes(r)).length;
  }
  return n;
}

export function evaluate(hand) {
  const len = {};
  const hcpBy = {};
  for (const s of SUITS) {
    len[s] = hand[s].length;
    hcpBy[s] = [...hand[s]].reduce((n, r) => n + (HCP[r] || 0), 0);
  }
  const hcp = SUITS.reduce((n, s) => n + hcpBy[s], 0);
  const pattern = SUITS.map((s) => len[s]).sort((a, b) => b - a);
  const p = pattern.join('');
  const shape = ['4333', '4432', '5332'].includes(p) ? 'balanced' : ['5422', '6322'].includes(p) ? 'semi' : 'unbalanced';
  const good = {};
  for (const s of SUITS) good[s] = ['A', 'K', 'Q'].filter((r) => hand[s].includes(r)).length >= 2;
  const controls = SUITS.reduce((n, s) => n + (hand[s].includes('A') ? 2 : 0) + (hand[s].includes('K') ? 1 : 0), 0);
  return { hand, hcp, hcpBy, len, pattern, shape, balanced: shape === 'balanced', good, controls, ltc: losingTricks(hand) };
}

export const ruleOf20 = (e) => e.hcp + e.pattern[0] + e.pattern[1];
export const ruleOf15 = (e) => e.hcp + e.len.S;

export function adjustedHcp(e) {
  let n = e.hcp;
  for (const s of SUITS) {
    const c = e.hand[s];
    if (c.length === 1) n -= { K: 1, Q: 2, J: 1 }[c] || 0;
    if (c.length === 2 && (c[0] === 'Q' || c[0] === 'J')) n -= 1;
  }
  return n;
}

export function dummyPoints(e, trump) {
  const bonus = e.len[trump] >= 4 ? { 0: 5, 1: 3, 2: 1 } : { 0: 3, 1: 2, 2: 1 };
  let n = adjustedHcp(e);
  for (const s of SUITS) if (s !== trump) n += bonus[e.len[s]] || 0;
  return n;
}

export function quality(e, { fit = false } = {}) {
  let score = 0;
  const reasons = [];
  if (SUITS.some((s) => e.len[s] >= 5 && e.good[s])) { score += 2; reasons.push('a good 5+ card suit'); }
  const aceKing = SUITS.reduce((n, s) => n + (e.hand[s].includes('A') ? 4 : 0) + (e.hand[s].includes('K') ? 3 : 0), 0);
  if (e.hcp && aceKing / e.hcp >= 0.75) { score += 1; reasons.push('points in aces and kings'); }
  if (e.hcp && (e.hcp - aceKing) / e.hcp >= 0.5) { score -= 1; reasons.push('mostly queens and jacks'); }
  if (e.pattern.join('') === '4333') { score -= 1; reasons.push('flat 4-3-3-3 shape'); }
  if (e.pattern[0] >= 5 && e.pattern[1] >= 4) { score += 1; reasons.push('two-suited shape'); }
  if (adjustedHcp(e) < e.hcp) { score -= 1; reasons.push('honors in short suits'); }
  if (fit) { score += 1; reasons.push('a fit for partner'); }
  return { score, good: score > 0, reasons };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/evaluate.test.js`
Expected: all 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add js/cards.js tests/evaluate.test.js
git commit -m "feat: hand evaluation (HCP, shape, LTC, dummy points, quality)"
```

---

### Task 4: Display labels

**Files:**
- Create: `js/format.js`, `tests/format.test.js`

- [ ] **Step 1: Write the failing test**

`tests/format.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callLabel, rankLabel } from '../js/format.js';

test('call labels', () => {
  assert.equal(callLabel('1S'), '1♠');
  assert.equal(callLabel('2D'), '2♦');
  assert.equal(callLabel('3N'), '3NT');
  assert.equal(callLabel('P'), 'Pass');
  assert.equal(callLabel('X'), 'Dbl');
  assert.equal(callLabel('XX'), 'Rdbl');
});

test('rank labels', () => {
  assert.equal(rankLabel('T'), '10');
  assert.equal(rankLabel('A'), 'A');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/format.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`js/format.js`
```js
import { SYMBOL } from './cards.js';

export function callLabel(call) {
  if (call === 'P') return 'Pass';
  if (call === 'X') return 'Dbl';
  if (call === 'XX') return 'Rdbl';
  return call[0] + SYMBOL[call[1]];
}

export const rankLabel = (r) => (r === 'T' ? '10' : r);
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/format.test.js`
Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add js/format.js tests/format.test.js
git commit -m "feat: call and rank labels"
```

---

### Task 5: Auction model and situations

**Files:**
- Create: `js/auction.js`, `tests/auction.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/auction.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bidRank, legalCalls, isComplete, addCall, undo, nextSeat, seatAt, situationAt } from '../js/auction.js';

test('bid ranks order clubs < diamonds < hearts < spades < NT', () => {
  assert.ok(bidRank('1C') < bidRank('1D'));
  assert.ok(bidRank('1S') < bidRank('1N'));
  assert.ok(bidRank('1N') < bidRank('2C'));
  assert.equal(bidRank('7N'), 34);
});

test('opening legal calls: pass and all 35 bids, no doubles', () => {
  const legal = legalCalls({ dealer: 'N', calls: [] });
  assert.equal(legal.length, 36);
  assert.ok(!legal.includes('X'));
});

test('bids must be higher; doubles only of opponents', () => {
  const a = { dealer: 'N', calls: ['1S'] };
  const legal = legalCalls(a);
  assert.ok(!legal.includes('1H'));
  assert.ok(!legal.includes('1S'));
  assert.ok(legal.includes('1N'));
  assert.ok(legal.includes('X'));
  assert.ok(!legal.includes('XX'));
  const b = { dealer: 'N', calls: ['1S', 'X'] };
  assert.ok(legalCalls(b).includes('XX'));
  assert.ok(!legalCalls(b).includes('X'));
  const c = { dealer: 'N', calls: ['1S', 'P'] };
  assert.ok(!legalCalls(c).includes('X'));
  const d = { dealer: 'N', calls: ['1S', 'P', 'P'] };
  assert.ok(legalCalls(d).includes('X'));
});

test('completion', () => {
  assert.equal(isComplete({ dealer: 'N', calls: ['P', 'P', 'P'] }), false);
  assert.equal(isComplete({ dealer: 'N', calls: ['P', 'P', 'P', 'P'] }), true);
  assert.equal(isComplete({ dealer: 'N', calls: ['1S', 'P', 'P', 'P'] }), true);
  assert.equal(isComplete({ dealer: 'N', calls: ['P', '1S', 'P', 'P'] }), false);
  assert.deepEqual(legalCalls({ dealer: 'N', calls: ['1S', 'P', 'P', 'P'] }), []);
});

test('addCall rejects illegal calls; undo removes the last', () => {
  const a = addCall({ dealer: 'N', calls: [] }, '1H');
  assert.throws(() => addCall(a, '1D'), /Illegal/);
  assert.deepEqual(undo(a).calls, []);
});

test('seats rotate from the dealer', () => {
  const a = { dealer: 'E', calls: ['P'] };
  assert.equal(seatAt(a, 0), 'E');
  assert.equal(nextSeat(a), 'S');
});

test('situation for the opener after a raise', () => {
  const s = situationAt({ dealer: 'N', calls: ['1S', 'P', '2S', 'P'] }, 4);
  assert.deepEqual(s.key, ['1S', '2S']);
  assert.equal(s.actor, 'N');
  assert.equal(s.ctx.role, 'opener');
  assert.equal(s.ctx.responderPassed, false);
  assert.equal(s.ctx.competitive, false);
});

test('situation for a passed-hand responder in 3rd seat', () => {
  const s = situationAt({ dealer: 'S', calls: ['P', 'P', '1H', 'P'] }, 4);
  assert.deepEqual(s.key, ['1H']);
  assert.equal(s.ctx.role, 'responder');
  assert.equal(s.ctx.responderPassed, true);
  assert.equal(s.ctx.seat, 3);
});

test('situation with an overcall puts the opponent bid in brackets', () => {
  const s = situationAt({ dealer: 'N', calls: ['1S', '2C'] }, 2);
  assert.deepEqual(s.key, ['1S', '(2C)']);
  assert.equal(s.ctx.competitive, true);
});

test('opening situation and defender situation', () => {
  const open = situationAt({ dealer: 'E', calls: ['P'] }, 1);
  assert.deepEqual(open.key, []);
  assert.equal(open.ctx.role, 'opening');
  assert.equal(open.ctx.seat, 2);
  const def = situationAt({ dealer: 'E', calls: ['1H'] }, 1);
  assert.deepEqual(def.key, ['(1H)']);
  assert.equal(def.ctx.role, 'defender');
  assert.equal(def.ctx.opened, 'them');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/auction.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`js/auction.js`
```js
export const SEATS = ['N', 'E', 'S', 'W'];
export const STRAINS = ['C', 'D', 'H', 'S', 'N'];

export const isBid = (c) => /^[1-7][CDHSN]$/.test(c);
export const level = (c) => Number(c[0]);
export const strain = (c) => c[1];
export const bidRank = (c) => (level(c) - 1) * 5 + STRAINS.indexOf(strain(c));
export const sideOf = (seat) => (seat === 'N' || seat === 'S' ? 'NS' : 'EW');
export const partnerOf = (seat) => SEATS[(SEATS.indexOf(seat) + 2) % 4];

export function seatAt(auction, i) {
  return SEATS[(SEATS.indexOf(auction.dealer) + i) % 4];
}

export function nextSeat(auction) {
  return seatAt(auction, auction.calls.length);
}

export function lastBidIndex(calls) {
  for (let i = calls.length - 1; i >= 0; i--) if (isBid(calls[i])) return i;
  return -1;
}

export function isComplete({ calls }) {
  if (calls.length === 4 && calls.every((c) => c === 'P')) return true;
  return lastBidIndex(calls) >= 0 && calls.length >= 4 && calls.slice(-3).every((c) => c === 'P');
}

export function legalCalls(auction) {
  if (isComplete(auction)) return [];
  const { calls } = auction;
  const li = lastBidIndex(calls);
  const out = ['P'];
  for (let r = li < 0 ? 0 : bidRank(calls[li]) + 1; r < 35; r++) out.push(`${Math.floor(r / 5) + 1}${STRAINS[r % 5]}`);
  let last = calls.length - 1;
  while (last >= 0 && calls[last] === 'P') last--;
  if (last >= 0 && sideOf(seatAt(auction, last)) !== sideOf(nextSeat(auction))) {
    if (isBid(calls[last])) out.push('X');
    if (calls[last] === 'X') out.push('XX');
  }
  return out;
}

export function addCall(auction, call) {
  if (!legalCalls(auction).includes(call)) throw new Error(`Illegal call ${call}`);
  return { ...auction, calls: [...auction.calls, call] };
}

export function undo(auction) {
  return { ...auction, calls: auction.calls.slice(0, -1) };
}

// The situation facing the player about to make call number n, seen from that player's side.
// key: calls from the opening bid onward; own side plain, opponents' non-pass calls in brackets.
export function situationAt(auction, n) {
  const calls = auction.calls.slice(0, n);
  const actor = seatAt(auction, n);
  const side = sideOf(actor);
  const first = calls.findIndex(isBid);
  const key = [];
  if (first >= 0) {
    for (let i = first; i < calls.length; i++) {
      if (sideOf(seatAt(auction, i)) === side) key.push(calls[i]);
      else if (calls[i] !== 'P') key.push(`(${calls[i]})`);
    }
  }
  const openerSeat = first >= 0 ? seatAt(auction, first) : null;
  let role = 'opening';
  if (openerSeat) role = openerSeat === actor ? 'opener' : partnerOf(openerSeat) === actor ? 'responder' : 'defender';
  const ctx = {
    seat: first >= 0 ? first + 1 : n + 1,
    opened: openerSeat ? (sideOf(openerSeat) === side ? 'us' : 'them') : null,
    role,
    responderPassed: first >= 0 && calls.slice(0, first).some((_, i) => seatAt(auction, i) === partnerOf(openerSeat)),
    competitive: calls.some((c, i) => c !== 'P' && sideOf(seatAt(auction, i)) !== side),
  };
  return { key, ctx, actor };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/auction.test.js`
Expected: all 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add js/auction.js tests/auction.test.js
git commit -m "feat: auction legality, completion and situations"
```

---

### Task 6: Engine — pattern matching and candidates

**Files:**
- Create: `js/engine.js`, `tests/engine-match.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/engine-match.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPattern, resolveCall, fill, candidates } from '../js/engine.js';

test('exact pattern matches only the same key', () => {
  assert.deepEqual(matchPattern(['1S', '2C'], ['1S', '2C']), {});
  assert.equal(matchPattern(['1S', '2C'], ['1S', '2D']), null);
  assert.equal(matchPattern(['1S'], ['1S', '2C']), null);
  assert.deepEqual(matchPattern([], []), {});
});

test('M binds once to a major', () => {
  assert.deepEqual(matchPattern(['1M', '2M'], ['1H', '2H']), { M: 'H' });
  assert.equal(matchPattern(['1M', '2M'], ['1H', '2S']), null);
  assert.equal(matchPattern(['1M'], ['1D']), null);
});

test('O is the other major, n the other minor', () => {
  assert.deepEqual(matchPattern(['1M', '2O'], ['1H', '2S']), { M: 'H' });
  assert.equal(matchPattern(['1M', '2O'], ['1H', '2H']), null);
  assert.deepEqual(matchPattern(['1m', '1n'], ['1C', '1D']), { m: 'C' });
});

test('bracketed tokens only match opponents calls', () => {
  assert.deepEqual(matchPattern(['1M', '(2x)'], ['1S', '(2C)']), { M: 'S', x: 'C' });
  assert.equal(matchPattern(['1M', '(2x)'], ['1S', '2C']), null);
  assert.deepEqual(matchPattern(['1S', '(X)'], ['1S', '(X)']), {});
});

test('resolveCall and fill substitute bound suits', () => {
  assert.equal(resolveCall('2M', { M: 'S' }), '2S');
  assert.equal(resolveCall('2O', { M: 'S' }), '2H');
  assert.equal(resolveCall('3n', { m: 'D' }), '3C');
  assert.equal(resolveCall('P', {}), 'P');
  assert.equal(fill('Raise of {M}, other major {O}', { M: 'H' }), 'Raise of ♥, other major ♠');
});

test('candidates keeps the most specific entry per call and checks ctx', () => {
  const entries = [
    { after: ['1M'], call: '2M', meaning: 'generic raise' },
    { after: ['1S'], call: '2S', meaning: 'spade raise' },
    { after: ['1M'], call: '2N', meaning: 'Jacoby', ctx: { responderPassed: false } },
  ];
  const sit = { key: ['1S'], ctx: { responderPassed: true } };
  assert.deepEqual(candidates(sit, entries).map((c) => [c.call, c.entry.meaning]), [['2S', 'spade raise']]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/engine-match.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`js/engine.js`
```js
import { SYMBOL } from './cards.js';
import ALL from './system/index.js';

const PLACE = { M: ['H', 'S'], m: ['C', 'D'], x: ['C', 'D', 'H', 'S'] };

function bindStrain(ph, s, env) {
  if (ph === s) return env;
  if (PLACE[ph]) {
    if (!PLACE[ph].includes(s)) return null;
    if (env[ph]) return env[ph] === s ? env : null;
    return { ...env, [ph]: s };
  }
  if (ph === 'O') return env.M && s !== env.M && PLACE.M.includes(s) ? env : null;
  if (ph === 'n') return env.m && s !== env.m && PLACE.m.includes(s) ? env : null;
  return null;
}

function matchToken(pat, tok, env) {
  const po = pat.startsWith('(');
  if (po !== tok.startsWith('(')) return null;
  const p = po ? pat.slice(1, -1) : pat;
  const t = po ? tok.slice(1, -1) : tok;
  if (p === t) return env;
  if (p.length !== 2 || t.length !== 2 || p[0] !== t[0]) return null;
  return bindStrain(p[1], t[1], env);
}

export function matchPattern(pattern, key) {
  if (pattern.length !== key.length) return null;
  let env = {};
  for (let i = 0; i < pattern.length; i++) {
    env = matchToken(pattern[i], key[i], env);
    if (!env) return null;
  }
  return env;
}

function strainFor(ch, env) {
  if (ch === 'O') return env.M === 'H' ? 'S' : 'H';
  if (ch === 'n') return env.m === 'C' ? 'D' : 'C';
  return env[ch] ?? ch;
}

export function resolveCall(call, env) {
  return /^[1-7]/.test(call) ? call[0] + strainFor(call[1], env) : call;
}

export function fill(text, env) {
  return text.replace(/\{([MmxOn])\}/g, (_, ch) => SYMBOL[strainFor(ch, env)] ?? '');
}

export function resolveShows(shows = {}, env = {}) {
  const out = { ...shows };
  if (shows.len) {
    out.len = {};
    for (const [k, v] of Object.entries(shows.len)) out.len[strainFor(k, env)] = v;
  }
  return out;
}

const placeholderCount = (after) => after.filter((t) => /[MmxOn]\)?$/.test(t)).length;

export function candidates(situation, entries = ALL) {
  const best = new Map();
  for (const entry of entries) {
    const env = matchPattern(entry.after, situation.key);
    if (!env) continue;
    if (entry.ctx && !Object.entries(entry.ctx).every(([k, v]) => situation.ctx[k] === v)) continue;
    const call = resolveCall(entry.call, env);
    const spec = placeholderCount(entry.after);
    const prev = best.get(call);
    if (!prev || spec < prev.spec) best.set(call, { call, entry, env, spec });
  }
  return [...best.values()];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/engine-match.test.js`
Expected: all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add js/engine.js tests/engine-match.test.js
git commit -m "feat: rules-table pattern matching"
```

---

### Task 7: Engine — explain, summarize, next options, advise

**Files:**
- Modify: `js/engine.js` (append; also extend the import lines at the top)
- Create: `tests/engine-advise.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/engine-advise.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../js/cards.js';
import { explain, summarize, describeShown, nextOptions, advise, matchingEntries } from '../js/engine.js';

const FIX = [
  { after: [], ctx: { role: 'opening' }, call: '1S', meaning: '5+ spades', shows: { hcp: [12, 21], len: { S: [5, 13] } },
    pick: (e) => e.hcp >= 12 && e.len.S >= 5, why: (e) => [`${e.hcp} HCP`], priority: 20, notes: 'a' },
  { after: [], ctx: { role: 'opening' }, call: 'P', meaning: 'No opening', shows: { hcp: [0, 11] },
    pick: () => true, priority: 99, notes: 'a' },
  { after: ['1M'], call: '2M', meaning: 'Raise of {M}', shows: { hcp: [6, 10], len: { M: [3, 13] }, force: 'none' },
    pick: (e, st) => e.len[st.bind.M] >= 3, priority: 10, notes: 'b' },
];

test('explain gives each call its meaning, with suits filled in', () => {
  const rows = explain({ dealer: 'N', calls: ['1S', 'P', '2S', 'P'] }, FIX);
  assert.equal(rows[0].seat, 'N');
  assert.equal(rows[0].meaning, '5+ spades');
  assert.equal(rows[2].meaning, 'Raise of ♠');
  assert.deepEqual(rows[2].shows.len, { S: [3, 13] });
  assert.equal(rows[1].meaning, null);
});

test('summarize intersects what a player has shown', () => {
  const rows = explain({ dealer: 'N', calls: ['1S', 'P', '2S', 'P'] }, FIX);
  const acc = summarize(rows, 'N');
  assert.deepEqual(acc.hcp, [12, 21]);
  assert.deepEqual(acc.len.S, [5, 13]);
  assert.deepEqual(describeShown(acc), ['12–21 HCP', '5+♠']);
  assert.deepEqual(describeShown(summarize(rows, 'E')), []);
});

test('describeShown wording', () => {
  const acc = { known: true, hcp: [22, 37], len: { S: [0, 13], H: [4, 4], D: [5, 13], C: [0, 13] }, balanced: true, force: 'game' };
  assert.deepEqual(describeShown(acc), ['22+ HCP', '4♥', '5+♦', 'Balanced', 'Game forcing']);
});

test('nextOptions lists defined calls in bidding order', () => {
  const opts = nextOptions({ dealer: 'S', calls: [] }, FIX);
  assert.deepEqual(opts.map((o) => o.call), ['P', '1S']);
  assert.equal(opts[1].meaning, '5+ spades');
});

test('advise picks the first matching entry by priority', () => {
  const hand = parseHand('K83 Q742 J5 9863');
  const r = advise(hand, { dealer: 'N', calls: ['1S', 'P'] }, FIX);
  assert.equal(r.call, '2S');
  assert.equal(r.meaning, 'Raise of ♠');
  assert.equal(r.notes, 'b');
  const o = advise(parseHand('AKJ74 K5 AJ3 Q62'), { dealer: 'S', calls: [] }, FIX);
  assert.equal(o.call, '1S');
  assert.deepEqual(o.reasons, ['18 HCP']);
});

test('advise reports situations it does not cover', () => {
  const r = advise(parseHand('K83 Q742 J5 9863'), { dealer: 'N', calls: ['1D', 'P'] }, FIX);
  assert.equal(r.notCovered, true);
  assert.deepEqual(r.options, []);
});

test('matchingEntries lists every entry whose pick accepts the hand', () => {
  const m = matchingEntries(parseHand('AKJ74 K5 AJ3 Q62'), { dealer: 'S', calls: [] }, FIX);
  assert.deepEqual(m.map((x) => x.call).sort(), ['1S', 'P']);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/engine-advise.test.js`
Expected: FAIL — `explain` is not exported

- [ ] **Step 3: Implement**

Replace the first line of `js/engine.js` (`import { SYMBOL } from './cards.js';`) with:
```js
import { SYMBOL, SUITS, evaluate } from './cards.js';
import { legalCalls, seatAt, situationAt, partnerOf, isComplete } from './auction.js';
```

Append to `js/engine.js`:
```js
export function explain(auction, entries = ALL) {
  return auction.calls.map((call, i) => {
    const c = candidates(situationAt(auction, i), entries).find((x) => x.call === call);
    return {
      i,
      seat: seatAt(auction, i),
      call,
      meaning: c ? fill(c.entry.meaning, c.env) : null,
      shows: c ? resolveShows(c.entry.shows, c.env) : null,
      entry: c ? c.entry : null,
    };
  });
}

export function summarize(rows, seat) {
  const acc = { known: false, hcp: [0, 37], len: { S: [0, 13], H: [0, 13], D: [0, 13], C: [0, 13] }, balanced: false, force: 'none' };
  for (const r of rows) {
    if (r.seat !== seat || !r.shows) continue;
    acc.known = true;
    if (r.shows.hcp) acc.hcp = [Math.max(acc.hcp[0], r.shows.hcp[0]), Math.min(acc.hcp[1], r.shows.hcp[1])];
    for (const [s, [lo, hi]] of Object.entries(r.shows.len || {})) {
      acc.len[s] = [Math.max(acc.len[s][0], lo), Math.min(acc.len[s][1], hi)];
    }
    if (r.shows.balanced) acc.balanced = true;
    acc.force = r.shows.force || 'none';
  }
  return acc;
}

export function describeShown(acc) {
  if (!acc.known) return [];
  const out = [];
  const [lo, hi] = acc.hcp;
  out.push(hi >= 37 ? `${lo}+ HCP` : lo === hi ? `${lo} HCP` : `${lo}–${hi} HCP`);
  for (const s of SUITS) {
    const [a, b] = acc.len[s];
    if (a === 0 && b === 13) continue;
    out.push(b === 13 ? `${a}+${SYMBOL[s]}` : a === b ? `${a}${SYMBOL[s]}` : `${a}–${b}${SYMBOL[s]}`);
  }
  if (acc.balanced) out.push('Balanced');
  if (acc.force === 'round') out.push('Forcing one round');
  if (acc.force === 'game') out.push('Game forcing');
  return out;
}

export function nextOptions(auction, entries = ALL) {
  if (isComplete(auction)) return [];
  const byCall = new Map(candidates(situationAt(auction, auction.calls.length), entries).map((c) => [c.call, c]));
  return legalCalls(auction)
    .filter((call) => byCall.has(call))
    .map((call) => {
      const c = byCall.get(call);
      return { call, meaning: fill(c.entry.meaning, c.env), notes: c.entry.notes };
    });
}

function prepare(hand, auction, entries) {
  const s = situationAt(auction, auction.calls.length);
  const legal = new Set(legalCalls(auction));
  const rows = explain(auction, entries);
  const base = { ...s, partner: summarize(rows, partnerOf(s.actor)), me: summarize(rows, s.actor) };
  const list = candidates(s, entries)
    .filter((c) => c.entry.pick && legal.has(c.call))
    .sort((a, b) => a.entry.priority - b.entry.priority);
  return { e: evaluate(hand), base, list };
}

export function advise(hand, auction, entries = ALL) {
  const { e, base, list } = prepare(hand, auction, entries);
  for (const c of list) {
    const st = { ...base, bind: c.env };
    if (!c.entry.pick(e, st)) continue;
    return {
      call: c.call,
      meaning: fill(c.entry.meaning, c.env),
      reasons: c.entry.why ? c.entry.why(e, st) : [],
      plan: c.entry.plan ? c.entry.plan(e, st) : null,
      close: c.entry.close ? c.entry.close(e, st) : null,
      notes: c.entry.notes,
    };
  }
  return { notCovered: true, options: nextOptions(auction, entries) };
}

export function matchingEntries(hand, auction, entries = ALL) {
  const { e, base, list } = prepare(hand, auction, entries);
  return list.filter((c) => c.entry.pick(e, { ...base, bind: c.env })).map((c) => ({ call: c.call, priority: c.entry.priority }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all tests in all files pass

- [ ] **Step 5: Commit**

```bash
git add js/engine.js tests/engine-advise.test.js
git commit -m "feat: explain, summarize, next options and advise"
```

---

### Task 8: Advisor auction builder

**Files:**
- Create: `js/advisor-model.js`, `tests/advisor-model.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/advisor-model.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealerFor, buildAuction } from '../js/advisor-model.js';
import { nextSeat, situationAt } from '../js/auction.js';

test('dealer puts the opener in the chosen seat', () => {
  assert.equal(dealerFor('me', 1), 'S');
  assert.equal(dealerFor('me', 2), 'E');
  assert.equal(dealerFor('me', 3), 'N');
  assert.equal(dealerFor('me', 4), 'W');
  assert.equal(dealerFor('partner', 1), 'N');
  assert.equal(dealerFor('partner', 3), 'S');
});

test('I open in 1st seat: waits for my opening, then for partner', () => {
  assert.deepEqual(buildAuction({ opener: 'me', seat: 1, ourCalls: [] }).calls, []);
  const a = buildAuction({ opener: 'me', seat: 1, ourCalls: ['1S'] });
  assert.deepEqual(a.calls, ['1S', 'P']);
  assert.equal(nextSeat(a), 'N');
});

test('partner opens in 3rd seat after I passed', () => {
  const a = buildAuction({ opener: 'partner', seat: 3, ourCalls: ['1H'] });
  assert.deepEqual(a.calls, ['P', 'P', '1H', 'P']);
  assert.equal(nextSeat(a), 'S');
  assert.equal(situationAt(a, a.calls.length).ctx.responderPassed, true);
});

test('I open in 4th seat after three passes', () => {
  const a = buildAuction({ opener: 'me', seat: 4, ourCalls: [] });
  assert.deepEqual(a.calls, ['P', 'P', 'P']);
  assert.equal(situationAt(a, 3).ctx.seat, 4);
});

test('stops at an illegal call and when the auction ends', () => {
  assert.deepEqual(buildAuction({ opener: 'me', seat: 1, ourCalls: ['1S', '1H'] }).calls, ['1S', 'P']);
  assert.deepEqual(buildAuction({ opener: 'me', seat: 1, ourCalls: ['1S', 'P'] }).calls, ['1S', 'P', 'P', 'P']);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/advisor-model.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`js/advisor-model.js`
```js
import { SEATS, addCall, nextSeat, isComplete, isBid } from './auction.js';

export const ME = 'S';
export const PARTNER = 'N';

export function dealerFor(opener, seat) {
  const pos = SEATS.indexOf(opener === 'me' ? ME : PARTNER);
  return SEATS[(pos - (seat - 1) + 8) % 4];
}

// Opponents always pass; before the opening our non-opener passes too.
export function buildAuction({ opener, seat, ourCalls }) {
  const openerSeat = opener === 'me' ? ME : PARTNER;
  let a = { dealer: dealerFor(opener, seat), calls: [] };
  const queue = [...ourCalls];
  for (let guard = 0; guard < 200 && !isComplete(a); guard++) {
    const s = nextSeat(a);
    const ours = s === ME || s === PARTNER;
    if (!ours) {
      a = addCall(a, 'P');
    } else if (!a.calls.some(isBid) && s !== openerSeat) {
      a = addCall(a, 'P');
    } else if (queue.length) {
      try {
        a = addCall(a, queue.shift());
      } catch {
        break;
      }
    } else {
      break;
    }
  }
  return a;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/advisor-model.test.js`
Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add js/advisor-model.js tests/advisor-model.test.js
git commit -m "feat: build the advisor auction from opener, seat and our calls"
```

---

### Task 9: Opening-bid rules

**Files:**
- Create: `js/system/openings.js`, `tests/openings.test.js`
- Modify: `js/system/index.js`

- [ ] **Step 1: Write the failing known-answer tests**

`tests/openings.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../js/cards.js';
import { advise, explain, nextOptions } from '../js/engine.js';
import { buildAuction } from '../js/advisor-model.js';

const ask = (hand, seat = 1) => advise(parseHand(hand), buildAuction({ opener: 'me', seat, ourCalls: [] }));

const CASES = [
  ['AQ852 K73 Q4 J62', 1, '1S', '12 HCP, 5 spades'],
  ['KQT83 AJ974 5 84', 1, '1S', 'Rule of 20, 5-5 opens the higher'],
  ['KJ4 Q83 AT52 Q73', 1, '1D', '4 diamonds, no 5-card major'],
  ['KJ4 Q83 AT Q7532', 1, '1C', 'longest suit clubs'],
  ['AQ74 KJ83 Q72 J4', 1, '1D', '4-4-3-2 exception opens 1D with three'],
  ['KQT74 5 AQ8742 3', 1, '1D', '6-5: open the longer suit'],
  ['AK KJ862 Q74 K93', 1, '1N', '16 balanced with a 5-card major'],
  ['AK5 KQ4 AJ73 K82', 1, '2N', '20 balanced'],
  ['AKQT73 AK4 A5 K2', 1, '2C', '23 HCP'],
  ['84 73 52 AKQJ852', 1, '3N', 'gambling: solid 7-card minor'],
  ['KQJ953 74 K82 63', 1, '2S', 'weak two'],
  ['5 KQJ9852 83 742', 1, '3H', '7-card preempt'],
  ['KQJ98762 5 832 4', 1, '4S', '8-card preempt'],
  ['J83 Q74 K852 963', 1, 'P', '6 HCP'],
  ['Q842 KQT953 J4 7', 1, 'P', 'weak two blocked by a 4-card side major'],
  ['Q842 KQT953 J4 7', 3, '2H', '3rd seat allows the side major'],
  ['KQ94 A82 Q73 952', 4, '1C', 'Rule of 15 = 15'],
  ['K94 A82 Q73 Q952', 4, 'P', 'Rule of 15 = 14'],
  ['KQJ953 74 K82 63', 4, 'P', 'never preempt in 4th seat'],
];

for (const [hand, seat, want, why] of CASES) {
  test(`${hand} in seat ${seat} opens ${want} (${why})`, () => {
    assert.equal(ask(hand, seat).call, want);
  });
}

test('1NT with a 5-card major carries a close-call note', () => {
  assert.match(ask('AK KJ862 Q74 K93').close, /5-card major/);
});

test('exactly 20 on the Rule of 20 is flagged as light', () => {
  assert.match(ask('KQT83 AJ974 5 84').close, /Rule of 20/);
});

test('Rule of 15 pass explains itself', () => {
  const r = ask('K94 A82 Q73 Q952', 4);
  assert.match(r.reasons.join(' '), /Rule of 15/);
  assert.match(r.close, /Rule of 15/);
});

test('reasons mention the HCP and the suit', () => {
  const r = ask('AQ852 K73 Q4 J62');
  assert.ok(r.reasons.includes('12 HCP'));
  assert.ok(r.reasons.some((x) => /5-card spades/.test(x)));
  assert.equal(r.notes, 'opening-bids-tier-0');
});

test('decoder explains openings', () => {
  const rows = explain({ dealer: 'N', calls: ['1N'] });
  assert.match(rows[0].meaning, /15–17/);
  const opts = nextOptions({ dealer: 'S', calls: [] }).map((o) => o.call);
  assert.ok(opts.includes('P') && opts.includes('2C') && opts.includes('3N') && opts.includes('4S'));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/openings.test.js`
Expected: FAIL — every case reports `undefined` (no entries yet; `advise` returns `notCovered`)

- [ ] **Step 3: Implement**

`js/system/openings.js`
```js
import { SUITS, NAME, ruleOf20, ruleOf15 } from '../cards.js';

const NOTES = 'opening-bids-tier-0';
const OPEN = { after: [], ctx: { role: 'opening' } };
const honorsIn = (e, s) => [...e.hand[s]].filter((r) => 'AKQJT'.includes(r)).length;

export function openingSuit(e) {
  const max = e.pattern[0];
  if (max >= 5) return SUITS.find((s) => e.len[s] === max); // SUITS run S,H,D,C: first hit is the higher suit
  if (e.len.D >= 4) return 'D';
  if (e.len.S === 4 && e.len.H === 4 && e.len.D === 3) return 'D';
  return 'C';
}

export function openable(e, seat) {
  if (e.hcp > 21 || e.hcp < 10) return false;
  if (seat === 4) return ruleOf15(e) >= 15;
  if (e.hcp >= 12) return true;
  if (seat === 3 && SUITS.some((s) => e.len[s] >= 5 && e.good[s])) return true;
  return ruleOf20(e) >= 20;
}

export const isStrong = (e) => e.hcp >= 22 || (e.ltc <= 3 && e.hcp >= 17);

export function gamblingSuit(e) {
  for (const s of ['C', 'D']) {
    if (e.len[s] >= 7 && e.hand[s].startsWith('AKQ') && !SUITS.some((t) => t !== s && /[AK]/.test(e.hand[t]))) return s;
  }
  return null;
}

export function weakTwoSuit(e, seat) {
  if (seat === 4 || e.hcp < 5 || e.hcp > 10) return null;
  const s = ['S', 'H', 'D'].find((t) => e.len[t] === 6);
  if (!s || honorsIn(e, s) < 2) return null;
  if (seat <= 2 && (['S', 'H'].some((m) => m !== s && e.len[m] >= 4) || e.pattern[3] === 0)) return null;
  return s;
}

export function preemptCall(e, seat) {
  if (seat === 4 || e.hcp > 9) return null;
  const s = SUITS.find((t) => e.len[t] >= 7);
  if (!s || honorsIn(e, s) < 2) return null;
  return `${e.len[s] >= 8 ? 4 : 3}${s}`;
}

function oneLevelWhy(e, seat, s) {
  const r = [`${e.hcp} HCP`];
  const tied = SUITS.filter((t) => e.len[t] === e.pattern[0]).length > 1;
  if (e.len[s] >= 5) r.push(`${e.len[s]}-card ${NAME[s]}${tied ? ' (equal long suits: open the higher)' : ''}`);
  else if (s === 'D' && e.len.D === 3) r.push('4♠ 4♥ 3♦ 2♣: the one hand that opens 1♦ with three');
  else r.push(`no 5-card suit: open the ${s === 'D' ? 'diamonds (4+)' : 'clubs (3+)'}`);
  if (seat === 4) r.push(`Rule of 15: ${e.hcp} + ${e.len.S} spades = ${ruleOf15(e)}`);
  else if (e.hcp < 12 && ruleOf20(e) >= 20) r.push(`Rule of 20: ${e.hcp} + ${e.pattern[0]} + ${e.pattern[1]} = ${ruleOf20(e)}`);
  else if (e.hcp < 12) r.push('light 3rd-seat opening with a good suit');
  return r;
}

function oneLevelClose(e, seat) {
  if (e.pattern.join('') === '4441') return 'Three 4-card suits: open 1♦, or 1♣ when the singleton is a diamond.';
  if (seat <= 2 && e.hcp < 12 && ruleOf20(e) === 20) return 'Exactly 20 on the Rule of 20: open, but treat it as a light opening.';
  return null;
}

function passWhy(e, seat) {
  if (seat === 4 && e.hcp >= 10) {
    return [`Rule of 15: ${e.hcp} + ${e.len.S} spades = ${ruleOf15(e)}, short of 15`, 'in 4th seat, passing scores 0 instead of letting the opponents win the part-score'];
  }
  if (seat === 4) return [`${e.hcp} HCP: not enough to open`, 'never preempt in 4th seat'];
  return [`${e.hcp} HCP${e.hcp >= 10 ? `, Rule of 20 total ${ruleOf20(e)}` : ''}`, 'not enough to open, and no long suit for a weak two or preempt'];
}

function passClose(e, seat) {
  if (seat <= 2 && e.hcp >= 10 && ruleOf20(e) === 19) return 'One short of the Rule of 20 (19): pass.';
  if (seat === 4 && ruleOf15(e) === 14) return 'One short of the Rule of 15 (14): pass.';
  return null;
}

const ONE_MEANING = {
  S: '5+ spades, 12–21.',
  H: '5+ hearts, 12–21.',
  D: '4+ diamonds (3 only with exactly 4♠ 4♥ 3♦ 2♣), 12–21.',
  C: '3+ clubs, 12–21.',
};

const entries = [
  {
    ...OPEN, call: '2N', priority: 5, notes: NOTES,
    meaning: '20–21 balanced.',
    shows: { hcp: [20, 21], balanced: true },
    pick: (e) => e.balanced && e.hcp >= 20 && e.hcp <= 21,
    why: (e) => [`${e.hcp} HCP, balanced`],
  },
  {
    ...OPEN, call: '2C', priority: 6, notes: NOTES,
    meaning: 'Strong and artificial: 22+ HCP, or about 9 playing tricks. Says nothing about clubs.',
    shows: { hcp: [22, 37], force: 'game' },
    pick: (e) => isStrong(e),
    why: (e) => (e.hcp >= 22 ? [`${e.hcp} HCP`] : [`${e.hcp} HCP with only ${e.ltc} losers: about 9 playing tricks`]),
  },
  {
    ...OPEN, call: '3N', priority: 8, notes: NOTES,
    meaning: 'Gambling: a solid 7+ card minor (AKQxxxx) and no ace or king outside.',
    shows: { hcp: [9, 14] },
    pick: (e) => gamblingSuit(e) !== null,
    why: (e) => {
      const s = gamblingSuit(e);
      return [`solid ${e.len[s]}-card ${NAME[s]}`, 'no ace or king outside'];
    },
  },
  {
    ...OPEN, call: '1N', priority: 10, notes: NOTES,
    meaning: '15–17 balanced. May contain a 5-card major.',
    shows: { hcp: [15, 17], balanced: true },
    pick: (e) => e.balanced && e.hcp >= 15 && e.hcp <= 17,
    why: (e) => [`${e.hcp} HCP, balanced`],
    close: (e) => (e.len.S === 5 || e.len.H === 5 ? 'Balanced 15–17 with a 5-card major: we open 1NT. 1♥/1♠ is also fine with a very strong suit.' : null),
  },
  ...SUITS.map((s) => ({
    ...OPEN, call: `1${s}`, priority: 20, notes: NOTES,
    meaning: ONE_MEANING[s],
    shows: { hcp: [12, 21], len: { [s]: [s === 'S' || s === 'H' ? 5 : 3, 13] } },
    pick: (e, st) => openable(e, st.ctx.seat) && openingSuit(e) === s,
    why: (e, st) => oneLevelWhy(e, st.ctx.seat, s),
    close: (e, st) => oneLevelClose(e, st.ctx.seat),
  })),
  ...['S', 'H', 'D'].map((s) => ({
    ...OPEN, call: `2${s}`, priority: 30, notes: NOTES,
    meaning: `Weak two: 6 ${NAME[s]}, 5–10 HCP.`,
    shows: { hcp: [5, 10], len: { [s]: [6, 6] } },
    pick: (e, st) => weakTwoSuit(e, st.ctx.seat) === s,
    why: (e) => [`6-card ${NAME[s]}`, `${e.hcp} HCP: too weak for a 1-level opening`],
  })),
  ...SUITS.flatMap((s) => [3, 4].map((lv) => ({
    ...OPEN, call: `${lv}${s}`, priority: 40, notes: NOTES,
    meaning: `Preempt: about ${lv + 4} ${NAME[s]}, weak.`,
    shows: { hcp: [0, 9], len: { [s]: [lv + 4, 13] } },
    pick: (e, st) => preemptCall(e, st.ctx.seat) === `${lv}${s}`,
    why: (e) => [`${e.len[s]}-card ${NAME[s]}`, `${e.hcp} HCP: weak, so jump to make the opponents' bidding harder`],
  }))),
  {
    ...OPEN, call: 'P', priority: 99, notes: NOTES,
    meaning: 'No opening: usually under 12 HCP.',
    shows: { hcp: [0, 11] },
    pick: () => true,
    why: (e, st) => passWhy(e, st.ctx.seat),
    close: (e, st) => passClose(e, st.ctx.seat),
  },
];

export default entries;
```

Replace `js/system/index.js` with:
```js
import openings from './openings.js';

const ALL = [...openings];
export default ALL;
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all tests pass, including 19 opening cases

- [ ] **Step 5: Commit**

```bash
git add js/system tests/openings.test.js
git commit -m "feat: opening-bid rules with reasons and close calls"
```

---

### Task 10: Notes anchors and consistency tests

**Files:**
- Modify: `../build.py` (the notes builder, one level up from the repo)
- Create: `data/notes-anchors.json` (generated), `tests/system.test.js`

- [ ] **Step 1: Make the notes build write the anchor list**

In `C:\Users\HP\Claude work\bridge\build.py`, add `import json` below `import re`, then in `build_notes` insert these lines directly after `html, toc = convert(text)`:
```python
    anchors = re.findall(r'<h2 id="([^"]+)"', html)
    data_dir = ROOT / "bridge-app" / "data"
    if data_dir.parent.exists():
        data_dir.mkdir(exist_ok=True)
        (data_dir / "notes-anchors.json").write_text(json.dumps(anchors, indent=1), encoding="utf-8")
```

- [ ] **Step 2: Regenerate**

Run: `cd .. && python build.py "https://claude.ai/artifact/NrdCttHcwDpCv83CsLGpfd" "https://claude.ai/artifact/E899gpbkkmxzkihMgyTzC5" && cd bridge-app && grep -c tier data/notes-anchors.json`
Expected: `built`, then a count of about 26 (one per notes section)

- [ ] **Step 3: Write the consistency tests**

`tests/system.test.js`
```js
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
    const k = JSON.stringify([e.after, e.ctx ?? {}, e.call]);
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
```

- [ ] **Step 4: Run**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add data/notes-anchors.json tests/system.test.js
git commit -m "test: rules-table consistency and opening sweep"
```

(`../build.py` is outside the repo; it is saved on disk but not committed.)

---

### Task 11: Shell, storage, DOM helper and styles

**Files:**
- Create: `index.html`, `css/app.css`, `js/store.js`, `js/ui/dom.js`

- [ ] **Step 1: Create the files**

`index.html`
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1d6a49">
<title>Bridge Coach</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="stylesheet" href="css/app.css">
</head>
<body>
<header class="top">
  <h1>Bridge Coach</h1>
  <nav class="tabs" role="tablist">
    <button role="tab" data-tab="advisor" aria-selected="true">Advisor</button>
    <button role="tab" data-tab="decoder" aria-selected="false">Decoder</button>
  </nav>
</header>
<main>
  <section id="advisor"></section>
  <section id="decoder" hidden></section>
</main>
<div id="update-bar" class="update" hidden>
  <span>New version ready</span>
  <button id="update-btn" type="button">Tap to update</button>
</div>
<script type="module" src="js/ui/app.js"></script>
</body>
</html>
```

`css/app.css`
```css
:root{
  --bg:#eef2ef; --surface:#ffffff; --ink:#18221d; --muted:#56655d; --rule:#d3ddd7;
  --accent:#1d6a49; --accent-ink:#ffffff; --accent-soft:#dcebe3; --red:#b3212e;
  --warn-soft:#f6ecd9; --warn-ink:#7a4d08;
  --font:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme: dark){:root{
  --bg:#0e1512; --surface:#151f1a; --ink:#e3ebe6; --muted:#97a79e; --rule:#2a3a32;
  --accent:#62c493; --accent-ink:#0e1512; --accent-soft:#1f3a2d; --red:#f2737c;
  --warn-soft:#3a2c12; --warn-ink:#f0c47a; color-scheme:dark}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:15px/1.5 var(--font);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 24px)}
button{cursor:pointer;font:inherit}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
a{color:var(--accent)}
[hidden]{display:none!important}
.top{position:sticky;top:0;z-index:5;background:var(--bg);padding:calc(env(safe-area-inset-top,0px) + 12px) 16px 8px;border-bottom:1px solid var(--rule)}
.top h1{font-size:1.15rem;margin:0 0 8px}
.tabs{display:flex;gap:8px;max-width:560px}
.tabs button{flex:1;padding:8px;border-radius:8px;border:1px solid var(--rule);background:var(--surface);color:var(--muted)}
.tabs button[aria-selected="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
main{max-width:560px;margin:0 auto;padding:12px 16px}
.stack{display:grid;gap:14px;margin-top:14px}
.label{font-size:.8rem;color:var(--muted);margin-bottom:6px}
.muted{color:var(--muted)}
.red{color:var(--red)}
.picker,.panel,.bbox{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:12px}
.suit-row{display:grid;grid-template-columns:20px repeat(13,minmax(0,1fr));gap:3px;margin:3px 0;align-items:center}
.suit{font-size:1.1rem;text-align:center}
.rk{padding:6px 0;font-weight:600;font-size:.8rem;border-radius:5px;border:1px solid var(--rule);background:var(--bg);color:var(--ink)}
.rk.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.rk:disabled{opacity:.35}
.row-buttons,.seg{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.pill{padding:7px 12px;border-radius:999px;border:1px solid var(--rule);background:var(--surface);color:var(--ink);font-size:.88rem}
.pill.on{background:var(--accent-soft);border-color:var(--accent);font-weight:600}
.strip{display:flex;flex-wrap:wrap;gap:6px}
.call{display:inline-flex;flex-direction:column;align-items:center;min-width:52px;padding:4px 8px;border-radius:8px;background:var(--surface);border:1px solid var(--rule);font-weight:600}
.call small{font-weight:400;font-size:.7rem;color:var(--muted)}
.call.opp{opacity:.55}
.call.next{border-style:dashed}
.bbox{display:grid;gap:4px;padding:10px}
.bb-row,.bb-extras{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}
.bb-extras{grid-template-columns:repeat(3,minmax(0,1fr))}
.bid{padding:9px 0;border-radius:6px;border:1px solid var(--rule);background:var(--bg);color:var(--ink);font-weight:600}
.bid:disabled{opacity:.3}
.bid.pass{background:var(--accent-soft)}
.panel.muted{color:var(--muted)}
.answer{border:2px solid var(--accent)}
.answer p{margin:6px 0}
.eyebrow{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);font-weight:600}
.big{font-size:2.2rem;font-weight:700;line-height:1.1;margin:4px 0 8px}
.close{background:var(--warn-soft);color:var(--warn-ink);padding:8px 10px;border-radius:8px}
.lines{display:grid;border-top:1px solid var(--rule)}
.line{border-bottom:1px solid var(--rule)}
.line summary{display:grid;grid-template-columns:72px 48px minmax(0,1fr);gap:8px;padding:8px 2px;cursor:pointer;list-style:none}
.line summary::-webkit-details-marker{display:none}
.line .who{color:var(--muted);font-size:.85rem}
.line .bid-l{font-weight:700}
.line.opp{color:var(--muted)}
.line > :not(summary){margin:0;padding:0 2px 10px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{padding:4px 10px;border-radius:999px;background:var(--accent-soft);font-size:.85rem;font-weight:600}
.opts{margin:6px 0 0;padding-left:18px}
.update{position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--ink);color:var(--bg);padding:10px 14px;border-radius:12px;z-index:10}
.update button{background:var(--accent);color:var(--accent-ink);border:0;border-radius:8px;padding:8px 12px;font-weight:600}
```

`js/store.js`
```js
const PREFIX = 'bc:';

export const store = {
  load(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v ? { ...fallback, ...JSON.parse(v) } : fallback;
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage blocked: the app still works without remembering */
    }
  },
};
```

`js/ui/dom.js`
```js
// Text with ♥ and ♦ wrapped in red spans.
export function suitText(s) {
  const frag = document.createDocumentFragment();
  for (const part of String(s).split(/([♥♦])/)) {
    if (!part) continue;
    if (part === '♥' || part === '♦') {
      const sp = document.createElement('span');
      sp.className = 'red';
      sp.textContent = part;
      frag.append(sp);
    } else {
      frag.append(document.createTextNode(part));
    }
  }
  return frag;
}

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : suitText(kid));
  }
  return n;
}

export function segmented(label, options, value, onPick) {
  return el('div', {},
    el('div', { class: 'label' }, label),
    el('div', { class: 'seg', role: 'group', 'aria-label': label },
      ...options.map(([v, text]) => el('button', {
        type: 'button',
        class: `pill${v === value ? ' on' : ''}`,
        'aria-pressed': String(v === value),
        onclick: () => onPick(v),
      }, text))));
}
```

- [ ] **Step 2: Commit**

```bash
git add index.html css js/store.js js/ui/dom.js
git commit -m "feat: app shell, styles, storage and DOM helper"
```

---

### Task 12: Hand picker and bidding box

**Files:**
- Create: `js/ui/hand-picker.js`, `js/ui/bidding-box.js`

- [ ] **Step 1: Create the files**

`js/ui/hand-picker.js`
```js
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
```

`js/ui/bidding-box.js`
```js
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
```

- [ ] **Step 2: Commit**

```bash
git add js/ui/hand-picker.js js/ui/bidding-box.js
git commit -m "feat: hand picker and bidding box"
```

---

### Task 13: Advisor tab

**Files:**
- Create: `js/ui/advisor.js`

- [ ] **Step 1: Create the file**

`js/ui/advisor.js`
```js
import { emptyHand, cardCount } from '../cards.js';
import { nextSeat, isComplete, seatAt } from '../auction.js';
import { advise } from '../engine.js';
import { buildAuction, ME, PARTNER } from '../advisor-model.js';
import { callLabel } from '../format.js';
import { NOTES_URL } from '../config.js';
import { el, segmented } from './dom.js';
import { handPicker } from './hand-picker.js';
import { biddingBox } from './bidding-box.js';

const WHO = { S: 'You', N: 'Partner', E: 'Opp', W: 'Opp' };
const SEAT_NAMES = ['1st', '2nd', '3rd', '4th'];

export function advisorView(root, store) {
  const state = store.load('advisor', { hand: emptyHand(), opener: 'me', seat: 1, ourCalls: [] });
  const save = () => store.save('advisor', state);
  const rest = el('div', { class: 'stack' });
  const picker = handPicker({ hand: state.hand, onChange: (h) => { state.hand = h; save(); render(); } });
  root.replaceChildren(picker.root, rest);

  function update(patch) {
    Object.assign(state, patch);
    save();
    render();
  }

  function auctionStrip(a) {
    const items = a.calls.map((c, i) => {
      const seat = seatAt(a, i);
      return el('span', { class: `call${seat === 'E' || seat === 'W' ? ' opp' : ''}` }, el('small', {}, WHO[seat]), callLabel(c));
    });
    if (!isComplete(a)) items.push(el('span', { class: 'call next' }, el('small', {}, WHO[nextSeat(a)]), '?'));
    return el('div', {},
      el('div', { class: 'label' }, 'Auction so far (opponents pass)'),
      el('div', { class: 'strip' }, ...items),
      state.ourCalls.length
        ? el('div', { class: 'row-buttons' }, el('button', { type: 'button', class: 'pill', onclick: () => update({ ourCalls: state.ourCalls.slice(0, -1) }) }, 'Undo'))
        : null);
  }

  function answerCard(a) {
    if (isComplete(a)) return el('div', { class: 'panel muted' }, 'The auction is over. Tap Undo, or change who opens to start again.');
    if (nextSeat(a) === PARTNER) return el('div', { class: 'panel muted' }, "Partner's turn: tap partner's call on the bidding box.");
    const n = cardCount(state.hand);
    if (n !== 13) return el('div', { class: 'panel muted' }, `Pick exactly 13 cards (you have ${n}).`);
    const r = advise(state.hand, a);
    if (r.notCovered) {
      return el('div', { class: 'panel' },
        el('div', { class: 'eyebrow' }, 'Not covered yet'),
        el('p', {}, "The advisor doesn't have rules for this situation yet. These are the bids our system defines here:"),
        r.options.length
          ? el('ul', { class: 'opts' }, ...r.options.map((o) => el('li', {}, el('b', {}, callLabel(o.call)), ' ', o.meaning)))
          : el('p', { class: 'muted' }, 'No agreements entered for this situation yet.'));
    }
    return el('div', { class: 'panel answer', 'aria-live': 'polite' },
      el('div', { class: 'eyebrow' }, 'Suggested bid'),
      el('div', { class: 'big' }, callLabel(r.call)),
      r.reasons.length ? el('p', {}, el('b', {}, 'Why: '), `${r.reasons.join('; ')}.`) : null,
      el('p', {}, el('b', {}, 'Tells partner: '), r.meaning),
      r.plan ? el('p', {}, el('b', {}, 'Plan: '), r.plan) : null,
      r.close ? el('p', { class: 'close' }, el('b', {}, 'Close call: '), r.close) : null,
      el('a', { href: `${NOTES_URL}#${r.notes}`, target: '_blank', rel: 'noopener' }, 'Read more in the system notes'));
  }

  function render() {
    const a = buildAuction(state);
    const ourTurn = !isComplete(a) && [ME, PARTNER].includes(nextSeat(a));
    rest.replaceChildren(
      segmented('Who opens?', [['me', "I'm opening"], ['partner', 'Partner opened']], state.opener, (v) => update({ opener: v, ourCalls: [] })),
      segmented('Seat of the opening bid', SEAT_NAMES.map((t, i) => [i + 1, t]), state.seat, (v) => update({ seat: v, ourCalls: [] })),
      auctionStrip(a),
      answerCard(a),
      ourTurn ? biddingBox(a, { onCall: (c) => update({ ourCalls: [...state.ourCalls, c] }) }) : null);
  }

  render();
}
```

- [ ] **Step 2: Commit**

```bash
git add js/ui/advisor.js
git commit -m "feat: advisor tab"
```

---

### Task 14: Decoder tab

**Files:**
- Create: `js/ui/decoder.js`

- [ ] **Step 1: Create the file**

`js/ui/decoder.js`
```js
import { nextSeat, isComplete, sideOf } from '../auction.js';
import { explain, summarize, describeShown, nextOptions } from '../engine.js';
import { callLabel } from '../format.js';
import { NOTES_URL } from '../config.js';
import { el, segmented } from './dom.js';
import { biddingBox } from './bidding-box.js';

const WHO = { S: 'You', N: 'Partner', E: 'Right opp', W: 'Left opp' };

function rowView(r) {
  const opp = sideOf(r.seat) === 'EW';
  const text = opp
    ? (r.call === 'P' ? 'Pass' : "Opponents' call (their own system)")
    : r.meaning ?? 'No agreement in our system for this bid.';
  return el('details', { class: `line${opp ? ' opp' : ''}` },
    el('summary', {}, el('span', { class: 'who' }, WHO[r.seat]), el('span', { class: 'bid-l' }, callLabel(r.call)), el('span', {}, text)),
    !opp && r.entry
      ? el('a', { href: `${NOTES_URL}#${r.entry.notes}`, target: '_blank', rel: 'noopener' }, 'Read more in the system notes')
      : el('p', { class: 'muted' }, 'No further detail.'));
}

export function decoderView(root, store) {
  const state = store.load('decoder', { dealer: 'S', calls: [] });

  function update(patch) {
    Object.assign(state, patch);
    store.save('decoder', state);
    render();
  }

  function nextSection(a) {
    if (isComplete(a)) return el('p', { class: 'muted' }, 'The auction is over.');
    const turn = nextSeat(a);
    if (sideOf(turn) === 'EW') return el('p', { class: 'muted' }, `${WHO[turn]} to call: enter their call on the bidding box.`);
    const opts = nextOptions(a);
    return el('div', {},
      el('div', { class: 'label' }, turn === 'S' ? 'What can I bid next?' : 'What can partner bid next?'),
      opts.length
        ? el('div', { class: 'lines' }, ...opts.map((o) => el('div', { class: 'line' },
            el('summary', {}, el('span', { class: 'who' }, ''), el('span', { class: 'bid-l' }, callLabel(o.call)), el('span', {}, o.meaning)))))
        : el('p', { class: 'muted' }, 'No agreements entered for this situation yet.'));
  }

  function render() {
    const a = { dealer: state.dealer, calls: state.calls };
    const rows = explain(a);
    const chips = describeShown(summarize(rows, 'N'));
    root.replaceChildren(el('div', { class: 'stack' },
      segmented('Dealer', [['S', 'You'], ['W', 'Left opp'], ['N', 'Partner'], ['E', 'Right opp']], state.dealer, (v) => update({ dealer: v, calls: [] })),
      el('div', {},
        el('div', { class: 'label' }, 'Auction'),
        rows.length ? el('div', { class: 'lines' }, ...rows.map(rowView)) : el('p', { class: 'muted' }, 'Enter the first call with the bidding box below.'),
        state.calls.length
          ? el('div', { class: 'row-buttons' },
              el('button', { type: 'button', class: 'pill', onclick: () => update({ calls: state.calls.slice(0, -1) }) }, 'Undo'),
              el('button', { type: 'button', class: 'pill', onclick: () => update({ calls: [] }) }, 'Clear'))
          : null),
      chips.length ? el('div', {}, el('div', { class: 'label' }, 'Partner has shown'), el('div', { class: 'chips' }, ...chips.map((c) => el('span', { class: 'chip' }, c)))) : null,
      nextSection(a),
      isComplete(a) ? null : biddingBox(a, { onCall: (c) => update({ calls: [...state.calls, c] }), doubles: true })));
  }

  render();
}
```

- [ ] **Step 2: Commit**

```bash
git add js/ui/decoder.js
git commit -m "feat: decoder tab"
```

---

### Task 15: App start-up, offline cache, install, icons

**Files:**
- Create: `js/ui/app.js`, `js/ui/update.js`, `sw.js`, `manifest.webmanifest`, `tools/make_icons.py`, `icons/icon-192.png`, `icons/icon-512.png`, `tests/sw.test.js`

- [ ] **Step 1: Write the failing cache-list test**

`tests/sw.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const listed = [...sw.matchAll(/'([^']+\.(?:js|css|html|json|png|webmanifest))'/g)].map((m) => m[1]);

function jsFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? jsFiles(`${dir}/${d.name}`) : d.name.endsWith('.js') ? [`${dir}/${d.name}`] : []);
}

test('service worker caches every app module', () => {
  for (const f of jsFiles('js')) assert.ok(listed.includes(f), `sw.js is missing ${f}`);
});

test('every cached file exists', () => {
  for (const f of listed) assert.ok(existsSync(join(root, f)), `missing file ${f}`);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/sw.test.js`
Expected: FAIL — `ENOENT` for `sw.js`

- [ ] **Step 3: Create the files**

`sw.js`
```js
const CACHE = 'bc-v1';
const FILES = [
  './',
  'index.html',
  'css/app.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'data/notes-anchors.json',
  'js/config.js',
  'js/cards.js',
  'js/format.js',
  'js/auction.js',
  'js/engine.js',
  'js/advisor-model.js',
  'js/store.js',
  'js/system/index.js',
  'js/system/openings.js',
  'js/ui/dom.js',
  'js/ui/hand-picker.js',
  'js/ui/bidding-box.js',
  'js/ui/advisor.js',
  'js/ui/decoder.js',
  'js/ui/update.js',
  'js/ui/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)));
});
```

`manifest.webmanifest`
```json
{
  "name": "Bridge Coach",
  "short_name": "Bridge Coach",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#eef2ef",
  "theme_color": "#1d6a49",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

`js/ui/update.js`
```js
export function registerUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const bar = document.getElementById('update-bar');
  const btn = document.getElementById('update-btn');
  let waiting = null;
  const offer = (worker) => {
    waiting = worker;
    bar.hidden = false;
  };
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch(() => {});
  btn.addEventListener('click', () => waiting?.postMessage('skip'));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (waiting && !reloaded) {
      reloaded = true;
      location.reload();
    }
  });
}
```

`js/ui/app.js`
```js
import { store } from '../store.js';
import { advisorView } from './advisor.js';
import { decoderView } from './decoder.js';
import { registerUpdates } from './update.js';

const views = { advisor: document.getElementById('advisor'), decoder: document.getElementById('decoder') };
advisorView(views.advisor, store);
decoderView(views.decoder, store);

function show(tab) {
  for (const [name, node] of Object.entries(views)) node.hidden = name !== tab;
  for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  store.save('tab', { tab });
}

for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => show(b.dataset.tab));
show(store.load('tab', { tab: 'advisor' }).tab);
registerUpdates();
```

`tools/make_icons.py`
```python
"""Generate the app icons: a white spade on the accent green."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)
for size in (192, 512):
    img = Image.new("RGB", (size, size), "#1d6a49")
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("C:/Windows/Fonts/seguisym.ttf", int(size * 0.62))
    draw.text((size / 2, size / 2), "\u2660", font=font, fill="#ffffff", anchor="mm")
    img.save(OUT / f"icon-{size}.png")
print("icons written")
```

- [ ] **Step 4: Generate icons and run tests**

Run: `python tools/make_icons.py && npm test`
Expected: `icons written`, then all tests pass (including both sw tests)

- [ ] **Step 5: Commit**

```bash
git add sw.js manifest.webmanifest js/ui/app.js js/ui/update.js tools icons tests/sw.test.js
git commit -m "feat: offline cache, install manifest, update bar and icons"
```

---

### Task 16: Check it in the browser

**Files:**
- Create: `.claude/launch.json` (ignored by git)

- [ ] **Step 1: Add the preview server config**

`.claude/launch.json`
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "bridge-app", "runtimeExecutable": "python", "runtimeArgs": ["-m", "http.server", "8765"], "port": 8765 }
  ]
}
```

- [ ] **Step 2: Start the preview and check the Advisor**

Start with `preview_start {name: "bridge-app"}`, resize to the mobile preset, reload.
- Read the console: expect no errors.
- Tap ♠A Q 8 5 2, ♥K 7 3, ♦Q 4, ♣J 6 2 (13 cards). Expect the answer card **1♠** with "12 HCP" and "5-card spades".
- Choose Seat 4th with ♠K 9 4 ♥A 8 2 ♦Q 7 3 ♣Q 9 5 2. Expect **Pass** with a Rule of 15 close call.
- Tap Pass on the bidding box; expect "Partner's turn".

- [ ] **Step 3: Check the Decoder**

Switch to Decoder, dealer Partner, tap 1NT. Expect "15–17 balanced" and chips "15–17 HCP · Balanced". Tap Undo; tap 1♠ then Dbl (right opp); expect the double row labelled as the opponents' call.

- [ ] **Step 4: Check dark mode and offline**

Resize with `colorScheme: dark`; confirm text is readable. In the console run `navigator.serviceWorker.controller !== null` after one reload; expect `true`.

- [ ] **Step 5: Fix anything found, re-run `npm test`, commit fixes**

```bash
git add -A
git commit -m "fix: issues found in browser check"
```
(Skip the commit if nothing changed.)

---

### Task 17: Publish to GitHub Pages

- [ ] **Step 1: Create the public repository and push**

```bash
gh repo create Kanoonzaza/bridge-app --public --source . --remote origin --push --description "Bridge Coach: bidding advisor and decoder for our 2/1 partnership system"
```
Expected: `✓ Created repository Kanoonzaza/bridge-app` and the push succeeds

- [ ] **Step 2: Turn on Pages from `main`**

```bash
gh api -X POST repos/Kanoonzaza/bridge-app/pages -f "source[branch]=main" -f "source[path]=/"
```
Expected: JSON containing `"html_url": "https://kanoonzaza.github.io/bridge-app/"`

- [ ] **Step 3: Wait for the first deploy**

Run (repeat about once a minute until 200): `curl -s -o /dev/null -w "%{http_code}" https://kanoonzaza.github.io/bridge-app/`
Expected: `200` within a few minutes

- [ ] **Step 4: Verify the live site**

Navigate the browser pane to `https://kanoonzaza.github.io/bridge-app/` at mobile size, enter the 1♠ hand from Task 16, expect **1♠**; confirm `sw.js` loads (network list shows it with status 200).

- [ ] **Step 5: Record and report**

Update the memory file `project_bridge_convention_app.md` with the live URL and "Plan 1 shipped", and give the user the link plus the Add to Home Screen steps.

---

## Self-review notes

- **Spec coverage:** screens (Tasks 12–14, 16), architecture modules (Tasks 2–9, 11–15), rules-table entry format incl. `why` (Tasks 6, 7, 9), opening coverage (Task 9), close calls for 1NT-with-major / Rule of 20 / Rule of 15 / 4-4-4-1 (Task 9), error handling — illegal calls, ≠13 cards, not covered, storage blocked (Tasks 5, 11–14), tests — known answers, anchors, duplicates, priority sweep (Tasks 9–10), offline + update bar (Task 15), release (Task 17). Advisor coverage beyond openings and the remaining close calls are explicitly deferred to Plans 2–4, as is the 1,000-auction legality sweep (bidding box reads `legalCalls` directly, which Task 5 tests).
- **Entry field `why`** is an addition to the spec's entry example; it produces the "Why" reasons the spec requires.
- **Names used across tasks:** `evaluate`, `situationAt`, `candidates`, `explain`, `summarize`, `describeShown`, `nextOptions`, `advise`, `matchingEntries`, `buildAuction`, `dealerFor`, `ME`, `PARTNER`, `segmented`, `el` — each defined once and used with the same signature.
