# Bridge Coach: Plan 13, convention pool and pair cards

Spec: `docs/superpowers/specs/2026-11-15-convention-pool-design.md`

**Goal.** A new pair picks a base system (SAYC or 2/1), ticks the conventions they play from a pool, and gets their own convention card. At the Table, robots bid by that card, the calls are explained by it, and the review compares each player with it.

**Scope decision (owner, 2026-11-15).** The **Advisor and Decoder tabs are left out**: no card switcher, no new screens, no changes to `js/ui/advisor.js` or `js/ui/decoder.js`. They keep working on the house card (today's 2/1 system). All work goes to the Card tab, the Table and the notes pages. The engine underneath still becomes card-aware, because the Table's robots, call meanings, hint and review all run on it.

**How to work through this plan.** Phases are in order and each one ships on its own. Inside a phase, tasks are in order. Every task ends with `npm test` green; every phase ends with `npm run stamp`, a commit and a push. Sizes: S = under 100 lines changed, M = 100–400, L = more.

---

## 0. Architecture in one page

```
catalog.js   the pool: slots and their options (data only)
card.js      a pair card: { base, picks, discuss, text, name, code }; presets; normalise; compact form
tags.js      which option each existing rule belongs to
system.js    systemFor(card) -> the rules active on that card (+ sys, the card's answers)
engine.js    advise / explain take a "book": one rule list, or { NS, EW } with one list per side
```

Three mechanisms carry the whole feature.

1. **Filter.** Every rule has `opt`: `'<slot>:<option>'`, `'base:<id>'`, or nothing (shared core). `systemFor(card)` keeps the core plus the rules whose option the card picked.
2. **Ask.** A decision function that mixes several conventions asks the card: `sys.is('passed-2c', 'drury')`. `sys` travels in `st.sys` (the state `pick(e, st)` already receives) and as a last parameter, defaulting to the house card, for functions that do not take `st`.
3. **Book.** Engine functions already take `entries` as an argument (default `ALL`). That argument may now also be `{ NS, EW }`. Each call is read with the rules of the side that made it.

The **house card** is the card whose `systemFor` result is `ALL` itself. Every current caller, test and tool passes nothing and gets exactly today's behaviour.

### Files

| New | Purpose |
|---|---|
| `js/pool/catalog.js` | Slots, options, groups, card lines |
| `js/pool/card.js` | Presets, `normalizeCard`, `resolve`, `pack` / `unpack`, `cardKey` |
| `js/pool/tags.js` | `tagFor(entry)` for the rules that exist today |
| `js/pool/system.js` | `systemFor`, `sysOf`, `isSystem`, `HOUSE`, `bookFor` |
| `js/pool/view.js` | Card to printable panels (pure data, no DOM) |
| `js/pool/cards-store.js` | The cards kept on this device, the active card |
| `js/pool/sync.js` | Firebase `cards/{code}` (phase 6) |
| `js/ui/card.js` | The Card tab |
| `js/system/options/*.js` | New options, one file per slot |
| `js/system/sayc/*.js` | The SAYC skeleton |
| `tools/tags.mjs` | Audit: rules per option, untagged rules |
| `tests/pool-*.test.js` | Tests per phase |
| `database.rules.json` | Firebase rules, kept in the repository from now on |

| Changed | What |
|---|---|
| `js/system/index.js` | Applies tags; adds the new option files |
| `js/engine.js` | Book argument, `st.sys`, fallback for any card |
| `js/fallback.js`, `js/judgment.js`, `js/general.js` | Take `sys`; the hard-coded RKCB 1430 text becomes a branch |
| `js/confidence.js`, `js/proposed.js` | "Proposed" comes from the card's `discuss` list |
| `js/table/model.js` | `cards`, `cardsNext`, per-board snapshot, `PROTO` 5 |
| `js/table/review.js`, `js/sim-bid.js`, `js/sim-advice.js`, `js/table/dd-worker.js`, `js/table/pool.js` | Pass the book |
| `js/ui/table.js` | Card line per side, card picker, book in every engine call |
| `js/ui/app.js`, `index.html`, `css/app.css`, `sw.js` | Card tab |
| `tools/build-notes.mjs`, `notes/*.html`, `js/ui/notes.js` | Notes by card |
| `tools/match.mjs`, `tools/selfcheck.mjs` | `--card` argument |

Not touched: `js/ui/advisor.js`, `js/ui/decoder.js`, `js/advisor-model.js`.

---

## 1. The pool (version 1)

"Exists" = the rules are in `js/system/` today. "New" = written in the phase shown. The first option of each slot is the SAYC default; **bold** is the 2/1 house default.

| Slot id | Question | Options | Phase |
|---|---|---|---|
| `base` | Base system | `sayc` (new) · **`2/1`** (exists) | 5 |
| `jump-shift` | Jump shift response | `strong` (new) · **`weak`** (exists) | 4 |
| `splinters` | Splinter raises | `off` (new) · **`on`** (exists) | 4 |
| `passed-2c` | Passed hand's 2♣ over 1M | `natural` (new) · **`drury`** (exists) | 4 |
| `passed-jump` | Passed hand's jump shift | `none` (new) · **`fit`** (exists) | 4 |
| `major-raise` | Jump raise of 1M | **`limit`** (exists) · `bergen` (new) | 7 |
| `minor-raise` | Raises of 1m | `standard` (new) · **`inverted`** (exists) | 4 |
| `minor-2nt` | 1m–2NT | `forcing` 13–15 (new) · **`invite`** 11–12 (exists) | 4 |
| `smolen` | Smolen | `off` (new) · **`on`** (exists) | 4 |
| `texas` | Texas transfers | `off` (new) · **`on`** (exists) | 4 |
| `nt-2s` | 1NT–2♠ | **`puppet`** to 3♣ (exists) · `four-suit` transfers (new) | 7 |
| `nt-interference` | They bid over our 1NT | `natural` (new) · **`lebensohl`** (exists) | 4 |
| `weak-two-ask` | 2NT over our weak two | `feature` (new) · **`ogust`** (exists) | 4 |
| `checkback` | Responder's ask after a 1NT rebid | `none` (new) · `nmf` (new) · **`xyz`** (exists) | 4, 7 |
| `fourth-suit` | Fourth suit | `round` (new) · **`gf`** (exists) | 4 |
| `keycard` | 4NT | `blackwood` (new) · **`rkcb-1430`** (exists) · `rkcb-0314` (new) | 4, 7 |
| `nt-defence` | Defence to their 1NT | `natural` (new) · **`dont`** (exists) · `cappelletti` (new) · `landy` (new) | 4, 7 |
| `support-doubles` | Support doubles and redoubles | `off` (new) · **`on`** (exists) | 4 |
| `responsive` | Responsive doubles | `off` (new) · **`on`** (exists) | 4 |
| `weak-two-defence` | Jump to 4m over their weak two | `natural` (new) · **`leaping`** Michaels (exists) | 4 |
| `slam-doubles` | Doubles of slams and artificial bids | `penalty` (new) · **`lead`** directing, Lightner (exists) | 4 |
| `leads`, `signals`, `discards` | Defence | Text choices; printed on the card, no bidding rules | 2 |

**Core, always on** (in both SAYC and the house system): 5-card majors, 1NT 15–17 with Stayman and Jacoby transfers, Gerber over notrump, strong 2♣, weak twos, preempts, Jacoby 2NT, limit raises, 1M–3NT (15–17, two cards), Michaels and Unusual 2NT, Jordan 2NT, takeout and negative doubles, overcalls, and the general competitive sections of the notes.

Changes from the first draft of the spec, after checking the SAYC booklet: Jacoby 2NT, Gerber, Michaels, Unusual 2NT and Jordan are in both systems, so they are core and not slots. Two slots were missing and are added: `jump-shift` (SAYC plays strong, we play weak) and `minor-2nt` (SAYC plays 13–15 forcing, we play 11–12).

---

## Phase 1. Foundation (nothing visible changes)

Result: the engine can bid any card. The only card that exists is the house card, and it is `ALL`.

### Task 1.1: Catalogue. S

Create `js/pool/catalog.js`.

```js
// The pool: every question a pair answers when they build their card. Data only.
// A slot's options are listed SAYC default first. `ready` is false until the option's rules are written.
export const GROUPS = [
  ['base', 'System'], ['majors', 'Major openings'], ['minors', 'Minor openings'], ['notrump', 'Notrump'],
  ['twos', 'Two-level openings'], ['rebids', 'Later rounds'], ['slam', 'Slam bidding'],
  ['competitive', 'Competitive bidding'], ['defence', 'Leads and signals'],
];

export const SLOTS = [
  { id: 'passed-2c', group: 'majors', title: 'Passed hand: 2♣ over partner\'s 1♥ / 1♠', options: [
    { id: 'natural', title: 'Natural', line: '2♣ = clubs, 10–11, not forcing', ready: false },
    { id: 'drury', title: 'Drury', line: '2♣ = 3+ support, 10–11 (limit raise); 2♦ by opener = full opening', notes: 'drury-tier-1', ready: true },
  ] },
  // … one object per slot of section 1
];

export const slot = (id) => SLOTS.find((s) => s.id === id);
export const option = (slotId, optId) => slot(slotId)?.options.find((o) => o.id === optId);
```

Text-only slots (`leads`, `signals`, `discards`) carry `text: true` and options with `line` only.

Test `tests/pool-catalog.test.js`: ids are unique; every slot has two or more options; every `notes` value is in `data/notes-anchors.json`; every slot's group is in `GROUPS`.

### Task 1.2: Card. S

Create `js/pool/card.js`.

```js
import { SLOTS, slot, option } from './catalog.js';

export const BASES = ['sayc', '2/1'];
// What each base ticks before the pair changes anything.
export const PRESETS = {
  sayc: Object.fromEntries(SLOTS.map((s) => [s.id, s.options[0].id])),
  '2/1': { 'jump-shift': 'weak', splinters: 'on', 'passed-2c': 'drury', /* … the bold column of section 1 */ },
};
export const HOUSE_CARD = { v: 1, name: 'House card', base: '2/1', picks: {}, discuss: [], text: {} };

// Whatever storage or a link returns becomes a well-formed card (unknown slots and options are dropped).
export function normalizeCard(raw) { … }
// Every slot answered: the base preset, then the card's own picks.
export const resolve = (card) => ({ ...PRESETS[card.base], ...card.picks });
// Equal cards (for bidding purposes) have equal keys. Name, text and discuss do not count.
export const cardKey = (card) => `${card.base}|${SLOTS.filter((s) => !s.text).map((s) => resolve(card)[s.id]).join(',')}`;
// Small form for the table: { b: 'sayc', p: { 'nt-defence': 'dont' }, n: 'Noon & Pim', d: ['keycard'] }.
export const pack = (card) => ({ b: card.base, p: card.picks, n: card.name, ...(card.discuss.length ? { d: card.discuss } : {}) });
export const unpack = (x) => normalizeCard({ base: x?.b, picks: x?.p, name: x?.n, discuss: x?.d });
// Set one answer; an answer equal to the preset is removed, so `picks` holds only differences.
export function pick(card, slotId, optId) { … }
// Change the base: keep the picks the pair made themselves, report nothing lost (every slot exists in both bases).
export function rebase(card, base) { … }
```

Tests `tests/pool-card.test.js`: `normalizeCard(garbage)` is the SAYC preset with a blank name; `pick` to the preset value deletes the key; `unpack(pack(c))` has the same `cardKey`; `cardKey(HOUSE_CARD)` equals `cardKey` of a card with every house pick spelled out.

### Task 1.3: Tag the existing rules. M

Create `js/pool/tags.js`: `tagFor(entry)` returns the option of a rule that exists today, or `null` for core. Rules written from now on set `opt` themselves.

By notes section:

| `notes` | Tag |
|---|---|
| `drury-tier-1` | `passed-2c:drury` |
| `inverted-minor-raises-tier-1` | `minor-raise:inverted` |
| `smolen-tier-2` | `smolen:on` |
| `xyz-tier-1` | `checkback:xyz` |
| `fourth-suit-forcing-tier-1` | `fourth-suit:gf` |
| `dont-against-their-1nt-tier-1` | `nt-defence:dont` |
| `lebensohl-tier-2` | `nt-interference:lebensohl` |
| `support-doubles-and-redoubles-tier-2`, `support-doubles-after-their-overcall` | `support-doubles:on` |
| `responsive-doubles` | `responsive:on` |
| `leaping-michaels` | `weak-two-defence:leaping` |
| `lead-directing-doubles`, `lightner-double` | `slam-doubles:lead` |

By sequence (`seq = [...after, call]`), where a section mixes slots:

| Rule | Tag |
|---|---|
| `rkcb-…` tail rules whose `after` starts with `4N`, and the 4NT ask itself | `keycard:rkcb-1430` |
| `rkcb-…` rules whose sequence contains Gerber's `4C` | core |
| `weak-twos-and-ogust-tier-0`, `seq` starts `[2x, 2N]` | `weak-two-ask:ogust` |
| `1nt-…`, `seq` starts `[1N or 2N, 4D or 4H]` | `texas:on` |
| `raising-partners-major-tier-0`, the splinter calls and everything after them | `splinters:on` |
| `responding-to-1-1-tier-0`, `seq` starts `[1m, 2N]` | `minor-2nt:invite` |
| Weak jump shifts over `1M` and `1m`, unpassed, and everything after them | `jump-shift:weak` |
| Passed-hand fit jumps and everything after them | `passed-jump:fit` |
| `seq` starts with a two-over-one response by an unpassed hand, or `[1M, 1N]` by an unpassed hand, in any section | `base:2/1` |

"Two-over-one response" is one helper: the second token of our side is a non-jump new suit at the two level, lower than opener's suit.

Everything else is core, including the sections `1m3nt`, `jordan-2nt-tier-1`, `their-two-suiters`, `against-their-strong-2`, `competing-at-the-3-level`, `advancing-after-their-response`, `overcaller-after-the-cue-bid-raise`, `opener-reopening-double`, `opener-after-…`, `doubling-their-4-level-preempts`.

In `js/system/index.js`, after building `ALL`:

```js
for (const e of ALL) if (e.opt === undefined) e.opt = tagFor(e);
```

Create `tools/tags.mjs`: prints the number of rules per tag, and for each mixed section the rules that stayed core, so the owner can read the borderline ones.

Tests `tests/pool-tags.test.js`:
- every tag names a real slot and option, or `base:2/1`;
- a count per tag, written down once from `tools/tags.mjs` after the owner has read its output (a later accidental change of tagging fails the test);
- spot checks: `['1M'] 2C` with `responderPassed: true` is `passed-2c:drury`; `['(1N)'] 2H` is `nt-defence:dont`; `['1M'] 2C` unpassed is `base:2/1`; `['1N'] 2C` is core.

This task is where mistakes hide. Read the audit output before fixing the counts.

### Task 1.4: `systemFor`. S

Create `js/pool/system.js`.

```js
import ALL from '../system/index.js';
import { resolve, cardKey, HOUSE_CARD } from './card.js';

const SYS = new WeakMap();   // rule list -> sys
const BY_KEY = new Map();    // cardKey -> rule list

function makeSys(card) {
  const picks = resolve(card);
  const discuss = new Set(card.discuss ?? []);
  return {
    base: card.base,
    is: (slotId, optId) => picks[slotId] === optId,
    get: (slotId) => picks[slotId],
    discuss: (slotId) => discuss.has(slotId),
    active: (opt) => !opt || (opt.startsWith('base:') ? opt === `base:${card.base}` : picks[opt.slice(0, opt.indexOf(':'))] === opt.slice(opt.indexOf(':') + 1)),
  };
}

export const HOUSE = makeSys(HOUSE_CARD);
SYS.set(ALL, HOUSE);
BY_KEY.set(cardKey(HOUSE_CARD), ALL);

// The rules a card plays. The same card always returns the same array, so the engine's index is built once.
export function systemFor(card) {
  const key = cardKey(card);
  let list = BY_KEY.get(key);
  if (!list) {
    const sys = makeSys(card);
    list = ALL.filter((e) => sys.active(e.opt));
    BY_KEY.set(key, list);
  }
  // discuss differs between cards with one key: keep the latest sys for this list.
  if (list !== ALL) SYS.set(list, makeSys(card));
  return list;
}
export const sysOf = (entries) => SYS.get(entries) ?? HOUSE;
export const isSystem = (entries) => SYS.has(entries);
// One list, or one per side.
export const forSeat = (book, seat) => (Array.isArray(book) ? book : book[seat === 'N' || seat === 'S' ? 'NS' : 'EW']);
export const bookFor = (cards) => ({ NS: systemFor(cards?.NS ?? HOUSE_CARD), EW: systemFor(cards?.EW ?? HOUSE_CARD) });
```

`discuss` must not leak between two cards with the same picks. If the simple "latest wins" above proves fragile in phase 3 (two sides, same picks, different `discuss`), key the cache on `cardKey + discuss`.

Tests `tests/pool-system.test.js`: `systemFor(HOUSE_CARD) === ALL`; `systemFor` twice returns the same array; a card with `passed-2c: natural` has no rule tagged `passed-2c:drury` and has every core rule; the house list has 6,515 rules.

### Task 1.5: Engine reads a book. M

In `js/engine.js`:

1. Import `sysOf`, `isSystem`, `forSeat` from `./pool/system.js`. (`system.js` imports `system/index.js`, as the engine does today; no cycle.)
2. `explain(auction, book = ALL, opts)`: inside the loop, `const entries = forSeat(book, seatAt(auction, i))`.
3. `nextOptions`, `generalOptions`: `forSeat(book, seatAt(auction, auction.calls.length))` for the matching step; pass `book` on to `explain`.
4. `prepare(hand, auction, book)`: `const entries = forSeat(book, s.actor)`; `explain(auction, book)`; add `sys: sysOf(entries)` to `base`.
5. `advise`: replace `entries === ALL ? fallback(…)` with `isSystem(entries) ? fallback(hand, auction, book) : null`. A plain array passed by a test still gets no fallback, as today.
6. `candidates(situation, entries = ALL, …)` stays as it is: it always receives one list.

In `js/fallback.js`: `ctx.entries` becomes the book; where it calls `advise`, `explain` or `tells`, it passes the book; add `ctx.sys = sysOf(forSeat(book, s.actor))`.

Tests `tests/pool-engine.test.js`:
- `explain(a)` and `explain(a, { NS: ALL, EW: ALL })` are deeply equal over 200 random auctions built with the existing helpers;
- `advise(hand, a)` and `advise(hand, a, bookFor({}))` agree on 2,000 random deals (four seats, auction bid to the end);
- with a hand-made two-rule list for EW and `ALL` for NS, an EW call is explained by the EW list and an NS call by `ALL`.

All existing tests must pass unchanged. That is the proof that nothing moved.

### Task 1.6: `sys` reaches the judgment code. M

- `js/judgment.js`: `judge(e, auction, rows, summary, key, sys = HOUSE)`. The key-card ask (line 182 on) reads `sys.get('keycard')`.
- `js/general.js`: `describeCall(auction, i, rows, sys = HOUSE)`. The RKCB replies at line 91 become a table per `keycard` option; phase 1 has only `rkcb-1430`.
- `js/engine.js` passes `sysOf(forSeat(book, seat))` to `describeCall`.
- `js/confidence.js`: `confidence(r, sys = HOUSE)`. "Proposed" = `PROPOSED.has(r.notes)` (house card only, as today) **or** `sys.discuss(slotOf(r.opt))`. `advise` returns `opt: c.entry.opt` next to `notes`.

No behaviour change yet. Tests: existing ones.

### Task 1.7: Safety net. M

Create `tests/pool-safety.test.js` and extend `tools/selfcheck.mjs` with a `book` parameter.

For a card, the check bids 300 random deals at all four seats with `advise(…, book)` and fails when:
1. `selfcheck` reports an issue that the house card does not also report on the same deals;
2. a decision function returned a call that has no active rule. Detect it in `advise`: when no rule's `pick` accepts and the list had pickable candidates, record `lastMiss`; the test asserts the rate of misses is not higher than the house card's. (A decision function that returns a filtered-out call shows up as exactly this.)

The test runs for: the house card, each preset, and each single change from each preset **among options with `ready: true`**. In phase 1 that is the house card only; each later task adds cards without touching the test.

`tools/match.mjs` and `tools/selfcheck.mjs` take `--card <file.json | sayc | 2/1>`.

### Task 1.8: Ship phase 1. S

`sw.js`: add `js/pool/*.js` (the service-worker test fails otherwise). `npm test`, `npm run stamp`, commit, push. Open the app: every tab behaves as before.

### Phase 1: as built (2026-11-15)

- **Tagging** works in two steps (`js/pool/tags.js`). A *root* is the rule that makes a conventional call (a 2/1 response, a splinter, Texas, Ogust, the minor puppet, 1m–2NT/3NT, the RKCB replies), plus every non-pass call of a one-convention notes section. Every later rule of the same auction (a *descendant*: its `after` starts with the root's calls, with a compatible passed-hand context) takes the root's tag. A 2/1 root beats every other root. This tagged 2,083 rules; 4,432 are core. Counts are frozen in `tests/pool-tags.test.js`.
- Added to the tag table: `nt-2s:puppet` (1NT–2♠ and what follows).
- **Not tagged yet, on purpose:** the limit raise `1M–3M` (both bases; SAYC gets its own in task 5.1) and the non-tail "RKCB: slam interest" asks inside specific auctions (task 4.13 must give Blackwood cards their own wording for these).
- Lebensohl's tag covers advancer's replies after partner doubles their weak two (37 rules); the double itself is core. Task 4.9 must write the natural replies.
- **Safety net:** `leaks(hand, auction, book)` in `js/engine.js` lists the rules outside a card that would have accepted a hand no rule on the card accepts. A trial card with Drury and DONT off reported 29 and 264 leaks on 1,500 deals, as expected: those options have no replacement rules yet.
- **Tools:** `--card` for `tools/selfcheck.mjs` and `tools/match.mjs` (plus `--base-card`), in the forms of `tools/card-arg.mjs`: `sayc`, `2/1`, `2/1+passed-2c=natural`, or a `.json` file.

---

## Phase 2. The Card tab (cards on this device)

Result: a pair can build a card and see it as a page. Options without rules yet are shown and marked "coming soon"; they cannot be ticked.

### Task 2.1: Cards on the device. S

Create `js/pool/cards-store.js` on top of `js/store.js`, key `bc:cards`: `{ list: [card, …], active: index | null }`.

`loadCards(store)`, `saveCard(store, card)`, `removeCard(store, i)`, `setActive(store, i)`, `activeCard(store)` (returns `HOUSE_CARD` when none). Every card passes `normalizeCard` on load. Limit: 12 cards.

Tests: bad JSON gives an empty list; removing the active card clears `active`.

### Task 2.2: Card to page. S

Create `js/pool/view.js`: `cardPanels(card)` returns, per group, `{ title, rows: [{ slot, title, line, discuss }], text }`, with the base's own lines first in the System panel (for SAYC: "5-card majors · 1NT 15–17 · 2-over-1 = 10+, forcing one round · 1NT response 6–10, not forcing · strong 2♣ · weak twos"). Pure data.

Tests: the SAYC preset has every non-text slot in exactly one panel; free text appears in its panel; a `discuss` row is flagged.

### Task 2.3: The tab. L

- `index.html`: a fifth tab button `Card` and `<section id="card">`, after Notes.
- `js/ui/app.js`: add `card` to `TABS` and `views`; `start('card', views.card, cardView)`; `?card=CODE` opens the tab (used in phase 6; harmless now).
- `js/ui/card.js`, `cardView(root, store)`, three screens held in `ui.screen`:

**List** (default when the device has cards): each card as a row with name, base, "Active" chip; buttons *Use*, *Edit*, *View*, *Delete* (with a confirm). Buttons *New card* and, from phase 6, *I have a code*. The house card is always the last row and cannot be edited or deleted.

**Builder**:
1. Name field.
2. Base: `segmented` control, SAYC or 2/1. Changing it calls `rebase` and shows one line: "Your own ticks were kept."
3. One panel per group in `GROUPS` order. One row per slot:
   - two options, first is the plain one: a checkbox labelled with the second option's title;
   - otherwise: a radio group;
   - under it, the chosen option's `line`, a "Read more" link when the option has `notes`, and a small "To discuss" toggle;
   - an option with `ready: false` is disabled and carries the chip "Coming soon".
4. A text area at the end of each panel: "Anything else you agreed here" (500 characters).
5. *Save*: stores the card, makes it active, goes to View.

**View**: the panels of `cardPanels`, laid out like `guide/convention-card.html` (reuse its panel and `tier` chip styles where they exist in `css/app.css`; otherwise add `.card-panel`, `.card-row`). Buttons: *Edit*, *Print* (`window.print()`, with a print stylesheet that hides the header and tabs), *Copy as text*.

Use the helpers in `js/ui/dom.js` (`el`, `segmented`, `keepFocus`) and `data-key` attributes as the other views do. Phone first: one column; rows at least 44 px high.

Tests `tests/pool-view.test.js` cover `view.js`. The DOM is checked by hand in the browser at 390 px and 1280 px, light and dark, all four styles.

### Task 2.4: Notes by card. M

One notes file stays the source. No splitting.

- `notes/system-notes.html`: each `<section>` or `<h2>` block that belongs to one option gets `data-opt="<slot>:<option>"` (same values as `tags.js`). Blocks without it are core.
- `tools/build-notes.mjs`: adds to `guide/system-notes.html` a short inline script that reads the active card from `localStorage` (`bc:cards`), computes its picks with a copy of the presets written into the page at build time, and hides blocks whose `data-opt` is not active. With no card, or the house card, nothing is hidden. A line at the top: "Showing the notes for: *card name*. Show everything."
- `data/notes-toc.json` gains `opt` per section; `js/ui/notes.js` filters the contents list the same way.
- The first tile of the Notes tab ("Convention card") opens the Card tab's View when the active card is not the house card.
- Test in `tests/notes.test.js`: every `data-opt` in the notes is a real option; the build is fresh.

### Task 2.5: Ship phase 2. S

`sw.js` files, `npm run stamp`, commit, push.

### Phase 2: as built (2026-11-15)

- **Changed from the plan: options without rules can be chosen.** The plan said they could not be ticked; that would have left a new pair only the 2/1 preset until phase 5. Now a pair writes down what they really play. `playable(card)` (`js/pool/card.js`) bids every answer whose rules are not written yet as on the house card (an unready base as 2/1); `systemFor` uses it. The card says so in one line ("Robots: not yet" on the row, a note at the top). `rulesFor(card)` is the exact filter, for tests and the tools (`--card` bids a card exactly as written, so an option can be tested while it is being built).
- **Every question is a row of pills**, also the two-answer ones (the plan had checkboxes for those): one control to learn, and the answer names are always visible.
- **Notes stay one file.** Headings carry `data-opt`; the in-app notes page hides a marked heading and the text under it, up to the next heading of its level, when the card in use does not play it. A marked subsection inside a hidden section is decided on its own. `?all`, or a link into a hidden section, shows everything. The Notes tab's contents follow the card too; both redraw when the card in use changes (event `bc:cards`).
- The Card tab remembers its screen and an unsaved draft (`bc:cardui`).
- Five tabs: the tab row was tightened so every style fits down to 320px wide.

---

## Phase 3. The Table plays the card

Result: at the Table each side has a card. Robots, call meanings, the hint and the review follow it. Until phase 4 adds options, the only difference between cards is which existing conventions are switched to "coming soon", so this phase is tested with a hand-made test option.

### Task 3.1: Cards in the table model. M

`js/table/model.js`:

```js
export const PROTO = 5;
// t.cards     = { NS: packedCard, EW: packedCard }   what this board is played with (a robot side copies the human side; none at all = house card)
// t.cardsNext = { NS?: packedCard, EW?: packedCard } a change that starts with the next board
// history[n].cards = the cards board n was played with
```

- `normalize`: add `cards` and `cardsNext` to `known`; pass each through `unpack` then `pack`; drop bad ones.
- `setCard(t, uid, packed)`: the player must sit on a side (`mySeat`). If no call has been made on this board (`t.board.calls === ''`), write `t.cards[side]`; otherwise write `t.cardsNext[side]`. Returns `undefined` when the player is not seated.
- `nextBoard`: copy `t.cards` into the history entry; then apply and clear `cardsNext`.
- `sit`: when a human sits on a side with no card and no other human, nothing changes; the UI offers their active card (task 3.3).
- `cardsOf(t, n?)`: the cards of the current board, or of history board `n`.

A table created by an older phone has no `cards`: both sides play the house card, as today.

Tests in `tests/table.test.js`: `setCard` before the first call applies now; after a call it waits for `nextBoard`; an unseated player cannot set; history keeps the old cards after a change; `normalize` survives garbage in `cards`.

### Task 3.2: The book everywhere the Table calls the engine. M

`js/ui/table.js`: one helper, `const book = (t, n) => bookFor(unpackBoth(cardsOf(t, n)))`, used at every engine call:

| Line today | Call | Change |
|---|---|---|
| 207 | `explain` for play constraints | `explain(a, book(t), …)` |
| 227 | `advise` before simulation | `advise(hand, a, book(t))` |
| 702 | "What the calls mean" | `explain(a, book(t), …)` |
| 733 | hint | `advise(hand, a, book(t))` |
| 786 | own calls against the Advisor | `advise(hand, …, book(t, n))` |
| 1031 | `reviewRows` | pass the book of that board |
| robot call (around 241) | rule-based robot | `advise(…, book(t))` |

`js/table/review.js`: `systemAuction(b, seats, book)` and `reviewRows(b, seats, book)`.

`js/sim-bid.js`: `shownRanges`, `consistent`, `finish`, `honest`, `sensible`, `simulateParts`, `simulateBid` take `book` and pass it to every `advise` and `explain`. Default `ALL`.

`js/sim-advice.js`: `simulatedAdvice(hand, auction, r, cards)`; sends `cards` (packed) to the pool; `explain(…, bookFor(cards), …)`.

`js/table/pool.js`: `poolSimulate` forwards `cards`. `js/table/dd-worker.js`, kind `bid`: `const { bookFor } = await import('../pool/system.js'); … simulateParts({ …, book: bookFor(unpackBoth(e.data.cards)) })`. Workers keep their own cache of rule lists, so the filter runs once per worker per card.

In "What the calls mean", an opponent's call is still prefixed "Probably:", but now read from **their** card.

Tests: `tests/sim.test.js` and `tests/table.test.js` pass unchanged with the default; a new test in `tests/pool-engine.test.js` runs `systemAuction` with a book whose EW side is a two-rule list and checks EW's calls come from it.

### Task 3.3: Card line and picker at the Table. M

`js/ui/table.js`:

- In the seating screen and above the auction: one line per side, "N–S play: *Noon & Pim (SAYC)*" and "E–W play: *House card (2/1)*". Tapping a name opens that card's View (read-only, built from the packed card with `cardPanels`).
- A seated player sees *Change* on their own side: a list of the cards on this device plus the two presets. Choosing calls `setCard`. If the board has started, a toast: "Starts with the next board."
- When a player sits on a side that has no card yet and their active card is not the house card, the side takes their active card in the same transaction as `sit`.
- A side with no human copies the card of the human side (owner left the choice open; chosen so that a pair meets opponents who bid the system they know, and "Probably: …" under the opponents' calls reads as they expect). `cardsOf` does this, so nothing is stored for a robot side. The line reads "E–W (robots) play the same card". A table with no humans plays the house card.
- The review header names the card each side played on that board.
- `confRow` receives `sysOf(…)` so "Agreed system" reads "On your card", and a `discuss` pick shows "To discuss".

Check by hand: two browser windows at one table, each side on a different card; change a card mid-board; open an old board's review after the change.

### Task 3.4: Ship phase 3. S

`PROTO` 5 means older installed copies are told to update, as on earlier protocol changes; confirm that message appears with an old cached copy. Stamp, commit, push.

### Phase 3: as built (2026-11-25)

- **One field per level instead of `cardsNext`.** `t.cards` is the card each side wants; `board.cards` is what the board is played with, worked out while no call has been made (from `t.cards` and who sits where) and then fixed. History keeps it with the board. A change after the first call shows "starts with the next board"; restarting the bidding or taking back the first call picks it up. A side's choice stays on the table while robots sit there, and comes back when those players sit again.
- **The model holds no rules.** `js/table/model.js` stores packed cards only; the screen gives robots an engine bound to the board (`bookOfBoard`), and `review.js` reads the board's cards by default, so `report.js` and the saved-board review needed no change of call.
- Workers get the packed cards in the `bid` message and build the book themselves (`bookOfCards`).
- **Screen:** a "Systems" panel (outside the play) names each side's card and how it differs from the house card; a seated player picks their side's card from the cards on the phone. Starting or joining a table, or sitting down, brings the card in use when the side has none yet. The review and "Copy this board" name the cards. The confidence label reads "On your card" for a pair's own card.
- Until phase 4 writes options, every card bids as the house card (the unready parts are played as on the house card, and the Systems panel says so); the mechanics are proven with exact rule lists in `tests/pool-table.test.js`.

---

## Phase 4. Standard options

Each task adds one option: its rules in `js/system/options/<slot>.js` with `opt` set on every rule, the branch in the decision function, `ready: true` in the catalogue, a notes block with `data-opt`, and tests. The safety-net test picks the new card up by itself.

Pattern for every task:

1. Write the meanings table (what the Table shows under "What the calls mean").
2. Write or branch the decision (what the robot bids).
3. Tests: three to six hands with the expected call; `explain` of one full auction; the safety net.
4. `node tools/match.mjs --card <card with this option>` against the house card on 500 boards. The new option does not have to win; it must not lose by more than the convention is worth. Write the result in the commit message.

Meanings below are the specification. Ranges are HCP unless noted.

### 4.1 `passed-2c:natural`. S
After `['1M']`, passed hand:
- `2C` = 5+ clubs, 10–11, not forcing.
- With 3+ trumps and 10–11 dummy points the passed hand bids `3M` (limit raise; 3 trumps allowed for a passed hand).
- Opener after `2C`: `P` minimum with club tolerance; `2M` 6+ cards, minimum; `2D`/`2H` 4+ cards, not forcing; `2N` 14–15; `3C` 4+ clubs; game bids to play.

Branch in `respondToMajor`: the Drury test becomes `sys.is('passed-2c', 'drury')`; Drury's follow-up decision functions are reached only through Drury rules, so they need no branch.

### 4.2 `passed-jump:none`. S
No rules. `respondToMajor`: skip `fitJump` unless `sys.is('passed-jump', 'fit')`. A passed hand's jump shift is then read by the general meanings.

### 4.3 `jump-shift:strong`. M
After `['1x']`, unpassed, a single jump in a new suit:
- 17+ with a good 5+ suit, or 4+ support for opener and a good side suit. Game forcing, slam interest.
- Opener: raise with 3+; rebid own suit with 6; `2N`/`3N` balanced minimum; new suit natural.
- Responder next: support for opener = the fit type; rebid own suit = self-supporting suit; notrump = balanced 17–18.

Decision: the robot jump shifts only with 19+ and a suit of 6 with two top honours, or 17+ with 4-card support and a 5-card side suit headed by two honours. Otherwise it responds at the one or two level, as today. `weakJump` runs only when `sys.is('jump-shift', 'weak')`.

### 4.4 `splinters:off`. S
No rules. Decision functions return the splinter only when `sys.is('splinters', 'on')`; the hand goes to Jacoby 2NT (12+) or the limit raise.

### 4.5 `minor-raise:standard`. M
After `['1m']`:
- `2m` = 6–10, 4+ support (5+ for clubs), no 4-card major. Not forcing.
- `3m` = 10–12, 5+ support, no 4-card major. Invitational.
- Game-forcing hands with support bid a new suit or notrump first.
- Opener after `2m`: `P`; `3m` competitive, 5+ cards; `2N` 18–19; new suit = game try, forcing one round; `3N` to play.
- Opener after `3m`: `P` minimum; `3N` 14+ with stoppers; new suit = stopper for 3NT; `5m` shape.

The 17 competitive rules that mention inverted raises: read each; tag the ones that only make sense with inverted raises.

### 4.6 `minor-2nt:forcing`. S
After `['1m']`: `2N` = 13–15 balanced, no 4-card major, game forcing. `3N` = 16–18 balanced.
Opener after `2N`: `3N` minimum balanced; `3m` 6+ cards; new suit natural, unbalanced; `4N` 18–19 quantitative.
`respondToMinor` reads the ranges from `sys`. With `invite`, 13–15 keeps bidding `3N` as today.

### 4.7 `smolen:off`. S
After `['1N','2C','2D']`: `3H` / `3S` = 5+ cards in that major, game forcing (opener raises with 3, else `3N`). With 5-4 in the majors responder bids the 5-card suit. Same one level up after `2N`, if Smolen is coded there.

### 4.8 `texas:off`. S
After `['1N']`: `4H` / `4S` = to play, 6+ cards. `4D` is not used. Decision: a game-only hand with a 6-card major transfers at the two level and raises to four.

### 4.9 `nt-interference:natural`. M
After `['1N','(2x)']` (and their double, where Lebensohl rules exist today):
- Two-level suit = to play, 5+ cards.
- Three-level suit = 5+ cards, game forcing.
- `2N` = natural, invitational, with a stopper.
- Cue-bid of their suit = Stayman, game values.
- `X` = penalty.
- `3N` = to play, with a stopper.

List the sequences `lebensohl-tier-2` covers first (153 rules); the natural option must cover the same starts, including Lebensohl after partner's takeout double of a weak two if it is there (natural version: suit at the three level = 0–10, jump or cue = values).

### 4.10 `weak-two-ask:feature`. S
After `['2x','2N']` (x = ♦ ♥ ♠): `2N` asks, forcing.
- Rebid of the suit = minimum (5–8).
- New suit = maximum with an ace or king there.
- `3N` = maximum, no outside ace or king.
Responder then places the contract: same decision as after Ogust, fed with "minimum / maximum" in place of Ogust's four answers.

### 4.11 `fourth-suit:round`. M
The fourth suit at the lowest level: artificial, forcing one round, 11+.
- Opener: describes as with `gf`, but jumps or bids game with 14+ (a minimum bid can be passed).
- Responder's next bid below game in an old suit or `2N` = invitational, not forcing. A new call of the fourth suit or a jump = game forcing.

Reuse the `gf` tables with `force: 'round'` and thresholds from `sys`; the 131 `gf` rules are the checklist of sequences to cover.

### 4.12 `checkback:none`. L
After `['1x','1y','1N']`:
- `2x` (opener's minor), `2y` (own suit) = to play.
- New suit lower than `y` at the two level = 4+ cards, to play in one of the two suits.
- `2N` = 11–12, invitational. `3N` to play.
- `3y` = 6 cards, invitational. `3x` = invitational with support.
- A reverse by responder (a higher new suit) and a jump in a new suit = forcing to game.

After three one-level suit bids (`['1x','1y','1z']`), the same without XYZ: preference to play, `1N`/`2N` natural, raises invitational, the fourth suit by the `fourth-suit` slot.

The 453 XYZ rules are the checklist of starts. Expect about 80 rules and one decision function, `responderNatural(e, st)`. Largest task of the phase.

### 4.13 `keycard:blackwood`. M
Tail rules, as RKCB has:
- `4N` = asks for aces. Replies: `5C` 0 or 4 · `5D` 1 · `5H` 2 · `5S` 3.
- `5N` by the asker = all four aces held; asks for kings: `6C` 0 or 4 · `6D` 1 · `6H` 2 · `6S` 3.
- Asker: two aces missing = five of the suit; one missing = six; none missing and 37+ points or a source of tricks = `5N`.
- They bid over 4NT: DOPI. `X` = 0 aces, `P` = 1, next step = 2. (Confirmed by the owner.)

`js/general.js` and `js/judgment.js` read the reply table from the `keycard` option (prepared in task 1.6).

### 4.14 `nt-defence:natural`. S
After `['(1N)']`, direct and balancing:
- `X` = penalty, 15+ (balancing: 12+).
- Two-level suit = 6+ cards (or a good 5), 8–14.
- `2N` = both minors, 5-5.
- Advancer: passes the double unless weak with a 5+ suit; raises with 3+ and 8+.

### 4.15 `support-doubles:off`. M
After `['1x','1M','(2y)']` and the redouble starts that `support-doubles:on` covers:
- Raise to `2M` / `3M` = 4 cards (3 good ones allowed for `2M`), by strength.
- `X` = extra values (15+), no clear bid; partner takes it out or passes with length in their suit.
- `P` = minimum without 4-card support.

The 472 support-double rules list the starts. Follow-ups after a natural raise reuse the uncontested raise logic.

### 4.16 `responsive:off`. S
After partner's takeout double or overcall and their raise: `X` = penalty. One rule per start; the robot doubles only with trump tricks (4+ cards, two honours) and 10+.

### 4.17 `weak-two-defence:natural` and 4.18 `slam-doubles:penalty`. S
No rules. Branch the two decision functions (`leapingMichaels`, the lead-directing and Lightner picks) on `sys`. The general meanings describe the calls.

### 4.19 Ship phase 4. S
Every option above has `ready: true`. The safety net now covers 2 presets and about 40 single changes: keep it under a minute by lowering deals per card if needed. Stamp, commit, push.

After this phase a 2/1 pair can describe almost any ordinary card. SAYC is still "coming soon".

### Phase 4: as built (2026-11-25)

All eighteen options of this phase are written and marked ready. Each one: zero leaks over 2,000–4,000 random deals (`leaks()`), a test hand that bids differently from the house card (`tests/pool-options.test.js`), a notes subsection marked with its `data-opt` ("Other answers on a convention card", Part 7), and a duplicate match against the house card (table below).

**Machinery**
- `js/system/index.js` exports `EVERY` (every rule of every option); its default export is the house card's selection, so every existing caller and tool is unchanged. `rulesFor` filters `EVERY`.
- `plays(sys, slot, option)` (`js/pool/answers.js`) for decision functions; no sys reads as the house card. Decision functions take `sys` as a last argument; the rule builders pass `st.sys`.
- A meaning can belong to one option: tables key it `call|option`, and competitive `def(…, { opt })` / `advise(…, opt)` keep options apart.
- `onCard()` in the engine words the RKCB asks inside particular auctions for the card (Blackwood: "asks for aces"); the answers come from the option's own tail rules.

**Tagging changed, house card unchanged.** Sections that mixed a convention with natural calls are now tagged by their conventional calls only: XYZ's relay, 2♦, 2NT puppet and its game-forcing jump (and what follows them); the support double and redouble (and responder's answers); the fourth-suit bid itself (its answers are core: the same whether game forcing or one round). The plain passes of the lead-directing and Lightner sections are core. A house option written with its own `opt` passes it to the calls after it; another option's rules never tag a house rule. A 1,500-board match of the house card against the previous commit differed on no board.

**Matches against the house card** (`node tools/match.mjs . 800 5 4 --card 2/1+<slot>=<option>`, 800 boards, double dummy; IMPs per board for the option's side):

| Option | Boards that differ | IMPs per board |
|---|---|---|
| passed-jump:none | 0 | 0.000 |
| splinters:off | 5 | 0.000 |
| weak-two-defence:natural | 2 | +0.014 |
| slam-doubles:penalty | 4 | +0.015 |
| responsive:off | 7 | −0.018 |
| texas:off | 2 | 0.000 |
| smolen:off | 2 | 0.000 |
| nt-interference:natural | 6 | −0.006 |
| passed-2c:natural | 17 | −0.055 (Drury is the better tool) |
| minor-raise:standard | 6 | −0.007 |
| minor-2nt:forcing | 11 | +0.005 |
| jump-shift:strong | 6 | −0.025 |
| weak-two-ask:feature | 5 | 0.000 |
| keycard:blackwood | 3 | +0.016 |
| nt-defence:natural | 24 | −0.018 |
| checkback:none | 26 | +0.005 |
| fourth-suit:round | 0 | 0.000 |
| support-doubles:off | 6 | +0.006 |

No option loses more than the convention is worth; none needs another pass before SAYC.

**Simplifications, to revisit with SAYC (phase 5)**
- Fourth suit forcing one round bids exactly as game forcing (the robots use it with 13+, inside "11+"); only the meaning differs.
- Standard minor raises: a 13+ hand with support and no major bids notrump or a new suit; there is no inverted-style strong raise.
- Strong jump shifts: opener's rebid is written; responder's later bids fall to general judgment (the auction is marked game forcing).
- Natural defence to 1NT: advancer runs from the double only with 0–5 and a 5-card suit, and does not escape after their double of an overcall.

---

## Phase 5. SAYC

Result: `base: 'sayc'` is selectable. Files in `js/system/sayc/`, every rule tagged `base:sayc`.

Source of truth: the ACBL SAYC booklet. Where the booklet is silent, the rule says so in its meaning ("Standard treatment").

### Task 5.1: Responding to 1♥ / 1♠. L
`js/system/sayc/major.js`, `respondToMajorSayc(e, M, passed, sys)`. The simple raise, Jacoby 2NT, `3N`, `4M` and passed-hand calls are core and are reused. New:

- `3M` = limit raise as the booklet defines it (owner's decision: follow the booklet). Read the booklet's wording when writing the rule; from memory it is 10–11 dummy points with three or more trumps, where the house rule needs four and 10–12. The house `3M` rule is tagged `base:2/1` and the SAYC rule `base:sayc`; opener's replies are shared. With three trumps opener should expect a 4-3 or 5-3 fit, so the game decision counts one trump fewer.

- `1N` = 6–10, not forcing; denies 3-card support worth a raise and (over 1♥) 4 spades.
- `2x` lower suit = 10+ (11+, or a good 10), 4+ cards (`2H` over `1S` = 5+). Forcing one round; promises another bid unless opener bids game.
- Hands of 10–11 with 3-card support: two-over-one, then support. 12+ with 3-card support: two-over-one, then game.

### Task 5.2: Opener after `1M–1N` (not forcing). M
`P` = balanced minimum (5-3-3-2, 12–14) · `2x` lower suit = 4+ cards · `2M` = 6 cards, 12–15 · `2N` = 17–18 · `3x` jump shift = 19+, game forcing · `3M` = 6 cards, 16–18 · `3N` = 19, balanced · reverse (`2S` over 1♥) = 17+.
Responder's second bid: pass, preference (`2M` with two cards), `2N` = 10 maximum, raise of the second suit = 4+ cards and a maximum, own suit = 6+ cards, to play.

The 133 forcing-1NT rules are the checklist; most meanings carry over with "opener may pass".

### Task 5.3: Opener after a two-over-one (10+). L
- `2M` = 6+ cards or no better bid, 12–14. Forcing (responder promised a rebid).
- `2N` = 12–14 balanced. `3N` = 18–19 balanced.
- New suit below `2M` = 4+ cards, 12+, forcing.
- Reverse or new suit at the three level = 15+, game forcing.
- Raise to `3x` = 4-card support (3 with an honour), 12–14. Jump raise or a splinter-free jump to game = extras.
- `3M` jump = 6+ good cards, 15–17.

### Task 5.4: Responder's second bid after a two-over-one. L
- `2M` = 10–11, two-card preference, not forcing. `3M` = 10–11, three cards, invitational.
- `2N` = 10–11, invitational. Own suit at the three level = 10–11, 6+ cards, invitational.
- New suit = forcing (fourth suit by the slot).
- Game bids = 12+, to play. `4N` by the `keycard` slot.

Third-round rules: only what the robots meet often. Run `tools/gaps.mjs --card sayc` and cover the most frequent uncovered situations until 95% of uncontested SAYC auctions finish on rules (the fallback handles the rest).

### Task 5.5: Minors and the rest. M
- `1D–2C` = 10+, forcing one round (the house version is game forcing and is tagged `base:2/1`); opener's and responder's next bids as in 5.3 and 5.4.
- `minor-raise`, `minor-2nt`, `jump-shift`, `checkback`, `fourth-suit`, `keycard`, `weak-two-ask` come from phase 4.
- After our 1NT is doubled, conventions stay on; after an overcall they are off except the cue-bid as Stayman (that is `nt-interference:natural`, already written).
- Read the opener's-rebid rules (308, core): any rule whose meaning mentions a game force created by a two-over-one must be tagged `base:2/1` and get a SAYC twin.

### Task 5.6: Competitive rules that assume 2/1. M
The competitive rules are shared: about 3,500 of the 4,300 contested rules are core and serve SAYC unchanged, with all the tuning they carry (the other 800 belong to competitive slots such as DONT, Lebensohl and support doubles). SAYC therefore starts tuned wherever the opponents bid.

What is left to check is the small set that depends on what an uncontested bid showed:
- `when-we-open-and-they-compete` (1,106 rules): search meanings and decisions for "game forc" and "2/1". A free two-level bid over their overcall is 10+ in both systems, so few should change.
- Auctions where they come in **after** our two-over-one or our 1NT response: in 2/1 we are in a game force (passes are forcing, doubles are penalty); in SAYC we are not. Tag those rules `base:2/1` and write the SAYC twins.
- The fallback step "as if they had passed" (`js/fallback.js`) reaches the uncontested rules of the side's own card through the book; confirm with one SAYC test.

List what was found in the commit message.

### Task 5.7: SAYC notes and card. M
A notes part "Standard American (SAYC)" with `data-opt="base:sayc"`: two-over-one at 10+, non-forcing 1NT, opener's rebids, with two worked auctions each. The existing "2/1 Game Forcing" and "Forcing 1NT response" blocks get `data-opt="base:2/1"`. Card lines in `view.js`.

### Task 5.8: Prove it. M
- `tests/pool-sayc.test.js`: 30 hands with the booklet's answer (`1S–1N` on a balanced 8; `1H–2C` on 11 with five clubs; opener passes `1N` with 5-3-3-2 13; opener's `2N` rebid; responder's invitational `3M`; and so on).
- Safety net on the SAYC preset and its single changes.
- `node tools/match.mjs --card sayc` against the house card, 1,000 boards. SAYC will lose some IMPs to a tuned 2/1; a loss above 1 IMP per board means bugs, not system. Read the 20 worst boards.
- `node tools/selfcheck.mjs --card sayc 3000`: no more issues per 1,000 calls than the house card.
- At the Table by hand: one human and three robots on SAYC for ten boards.

Set `base` option `sayc` to `ready: true`. Stamp, commit, push.

### Phase 5: as built (2026-11-26)

- **Source.** The ACBL booklet pages could not be opened from the build machine (network policy); the rules follow the 2006 booklet text as quoted in search results and forums: 1M–1NT 6–10 not forcing; 2-over-1 10+ (2♥ over 1♠ 5+), forcing one round, responder bids again; limit raise 10–11 dummy points with 3+ trumps (owner's decision: follow the booklet); 1m–2NT 13–15 forcing, 3NT 16–18; standard minor raises. Where sources disagree (1NT response 6–9 or 6–10) the plan's 6–10 is used.
- **1M–1NT reuses the passed-hand rules.** The engine reads a SAYC card's 1M–1NT as a passed hand's non-forcing 1NT (`asCard` in `js/engine.js`), so opener's rebids, responder's rebids and the competitive follow-ups already written for the passed hand serve SAYC. The 190 rules after 1M–1NT with no passed-hand condition were re-tagged core (they always served the passed hand too); a 600-board match showed the house card unchanged.
- **Written for SAYC** (`js/system/options/sayc.js`): the 1NT, 2-over-1 and 3-card limit raise meanings; opener's rebid after a 2-over-1; responder's second bid (12+ bids game, 10–11 invites or stops). Later rounds fall to general judgment. `respondToMajor` / `respondToMinor` ask `plays(sys, 'base', 'sayc')`.
- **11–12 balanced, no major, over 1♣/1♦ (2NT forcing):** SAYC bids the other minor (1♦, or 2♣ over 1♦) instead of an overstated 1NT.
- **Checks.** 8 booklet tests (`tests/pool-sayc.test.js`); zero leaks on 3,000 deals; self-check 2.6% of deals with an inconsistency (house card 2.5%); SAYC against the house card over 1,000 boards: −0.003 IMPs per board (± 0.074), differing on 23% of boards. The safety net now runs the SAYC preset and each single change from it.
- **Notes.** "Standard American (SAYC)" in Part 3, marked `base:sayc`.

---

## Phase 6. Sharing a card by code

### Task 6.1: Sync. M
Create `js/pool/sync.js`, built like `js/table/sync.js` (same Firebase app and anonymous sign-in; share the initialisation through a small `js/firebase.js` so both use one app):

```js
// cardSync(config) -> { uid, load(code), watch(code, onCard), save(code, fn) }   path: cards/{code}
// memoryCards() for tests.
```
Stored value: the card of section 3.2 of the spec, plus `members: { uid: true }` (at most two) and `updated`.

`database.rules.json` (and the same text pasted in the Firebase console; the owner does this step):

```json
{ "rules": {
  "tables": { "…": "as today; copy the live rules here first" },
  "cards": { "$code": {
    ".read": "auth != null",
    ".write": "auth != null && (!data.exists() || data.child('members').child(auth.uid).exists() || (!data.child('members').child(auth.uid).exists() && data.child('members').numChildren() < 2 && newData.child('members').numChildren() === data.child('members').numChildren() + 1 && newData.child('base').val() === data.child('base').val()))",
    ".validate": "newData.hasChildren(['v', 'base', 'members', 'updated'])"
  } }
} }
```

The join rule lets a non-member write only when the write adds one member. Test the rules in the Firebase rules playground with four cases: create, member edit, partner joins, stranger edits (refused).

### Task 6.2: Share and join in the Card tab. M
- View screen: *Share*. First use creates the code (same `newCode` as tables), writes the card with the device as first member, and shows the code and the link `…/bridge-app/?card=CODE` with *Copy* and the system share sheet (`navigator.share` when present).
- List screen: *I have a code*; and opening the link lands there with the code filled in. The card is shown read-only with two buttons: *I am the partner* (joins as second member; the card is saved on the device and made active) and *Copy as my own card* (new local card, no code).
- A card with a code shows "Shared with your partner" and refreshes from the server when the tab opens. Saving an edit writes to the server; offline, the save is refused with "Connect to save a shared card" (the local copy is unchanged).
- A third device sees "This card already has two partners" and only *Copy as my own card*.

Tests with `memoryCards`: create, join, edit by each member, stranger cannot join a full card, newest `updated` wins on refresh.

### Task 6.3: Ship. S
The owner pastes the rules in the console **before** the push. Stamp, commit, push. Check with two phones.

### Phase 6: as built (2026-11-26)

- **Storage in parts, so the rules can protect it.** `cards/{code}` = `{ card, members: { uid: true }, created }`. Creating writes the whole record (only when the code is free); joining writes `members/{own uid}` (only while there are fewer than two); saving writes `card` (members only). `database.rules.cards.json` holds these rules: the owner adds its `cards` block next to `tables` in the Firebase console (README). The memory and browser-tab stores enforce the same rules, and `tests/pool-share.test.js` checks them.
- One Firebase app per page, shared by tables and cards (`firebaseApp` in `js/table/sync.js`).
- **Card tab.** View: "Share with your partner" makes a code and sends the link (system share sheet, or copied); a shared card shows its code. List: "I have a code"; a `?card=CODE` link opens the same screen. A shared card can be joined as the partner (two at most), used again by a member, or copied as one's own. Saving a shared card also saves the shared copy; on opening the tab, a newer shared copy replaces the one on the phone. Offline, saving keeps the phone's copy and says the shared copy was not updated.
- **Changed from the plan:** an offline save is kept on the phone (the plan refused it); the next save with a connection updates the shared copy.
- `describeCard` describes a card as its system plus the changes from that system's standard, each with its question; used in the join preview, the Table's Convention cards panel and Copy this board.

---

## Phase 7. Alternatives

One task per option, same pattern as phase 4, in this order (most asked for first). Each can ship alone.

| Option | Specification in one line | Size |
|---|---|---|
| `nt-defence:cappelletti` | `X` penalty · `2C` one suit (partner bids `2D`) · `2D` majors · `2H`/`2S` that major + a minor (`2N` asks) · `2N` minors | M |
| `nt-defence:landy` | `2C` majors (advancer: `2D` asks for the longer, `2H`/`2S` preference, `2N` invitational ask) · others natural | S |
| `keycard:rkcb-0314` | As 1430 with `5C` = 0 or 3, `5D` = 1 or 4; queen ask moves with it | S |
| `checkback:nmf` | After `1x–1M–1N`: the unbid minor = artificial, 11+, forcing; opener shows 3-card support, the other major, or a minimum/maximum notrump | M |
| `major-raise:bergen` | `3C` = 7–9 with four trumps · `3D` = 10–12 with four · `3M` = 0–6 with four, preemptive; off in competition and by a passed hand | M |
| `nt-2s:four-suit` | `2S` = clubs, `2N` = diamonds (opener bids the step between with a fit, else the suit); the invitational balanced hand goes through Stayman | M |

Later, not planned here: weak 1NT, Acol, Precision (see spec, section 3.3).

---

## Risks and how the plan answers them

| Risk | Answer |
|---|---|
| Tagging 6,515 rules wrongly | Audit tool read by the owner; counts frozen in a test; the house card must still equal `ALL` |
| A decision function returns a call the card does not play | Safety net, check 2, on every preset and single change |
| Options interact | Slots that share a call are one slot; the safety net tests single changes; pairs of changes are sampled at random (50 cards per run) |
| New rules weaker than the tuned 2/1 | Most of the tuning is in the competitive rules, which are core and shared by every card. The untuned part is the uncontested SAYC skeleton and the new options: `tools/match.mjs --card` per option; the review says "Standard treatment" for options not yet match-tested |
| Old phones at a `PROTO` 5 table | Existing update prompt; a table without `cards` plays the house card |
| Advisor and Decoder tabs confuse a SAYC pair | Out of scope by decision. Cheapest later fix: one line under each tab title, "Uses the house card (2/1)" |
| Bundle size | Measure `js/system/` after phase 5; load option files on demand by slot only if the first load passes 1.5 MB |

## Decisions (owner, 2026-11-15)

1. Blackwood when they bid over 4NT: DOPI.
2. SAYC limit raise: follow the booklet (three trumps allowed), not the house rule.
3. A side with only robots: owner left it open; it copies the human side's card (task 3.3).
