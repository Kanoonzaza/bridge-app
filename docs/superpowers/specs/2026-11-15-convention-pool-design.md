# Convention pool and pair cards: design

Date: 2026-11-15
Status: draft for review
Plan: `docs/superpowers/plans/2026-11-15-convention-pool.md`

> **Updated the same day, after the plan was written. Where this page and the plan differ, the plan is right.**
>
> - **The Advisor and Decoder tabs are out of scope** (owner's decision: they are rarely used). They stay on the house card. The card drives the Card tab, the Table (robots, call meanings, hint, review) and the notes. Ignore what sections 5 and 7 say about those two tabs.
> - **The pool list in section 3.3 is replaced by section 1 of the plan.** Jacoby 2NT, Gerber, Michaels, Unusual 2NT and Jordan 2NT are in both SAYC and our system, so they are core, not slots. Two slots were added: jump shift responses (strong or weak) and 1m–2NT (13–15 forcing or 11–12 invitational).
> - **Notes (section 8):** the notes stay one file; each block is marked with its option and the page hides the blocks that are not on the active card. No splitting into fragments.
> - **A side with only robots** plays the house card, not the SAYC preset.
> - **Build order (section 9):** foundation, Card tab, Table, standard options, SAYC, sharing, alternatives.

## 1. Purpose

Today the app knows one system: ours (2/1 Game Forcing, as in `notes/` and `js/system/`). A new pair cannot use it unless they play exactly that.

This design adds:

- a **pool**: every base system and convention the app knows, as a catalogue;
- a **pair card**: one pair's ticks from the pool, plus their own free-text notes;
- an engine that bids and explains **by the active card**, in the Advisor, the Decoder, the Table and the robots;
- a convention card and notes pages **generated from the ticks**;
- sharing a card between partners by **code or link**, with no accounts.

Decisions already taken with the owner:

| Question | Decision |
|---|---|
| What a tick changes | Everything: card, notes, Advisor, Decoder, robots |
| What is in the pool | Our conventions, common alternatives, and two base systems: **2/1** and **SAYC** |
| Storage | Share by code or link (Firebase, as tables do today) |
| Agreements outside the pool | Free text on the card only; the Advisor does not know them |

## 2. The three ideas

### 2.1 A slot, not a tick box

A convention cannot simply be switched off: the call it used must still mean something. If a pair does not play Drury, a passed hand's 2♣ over 1♥ is natural, and the Advisor needs rules for that.

So the pool is a list of **slots**. A slot is one question a pair must answer, and each answer is an **option** with its own rules:

```
slot: passed-hand 2♣ over 1M      options: natural | Drury
slot: defence to their 1NT        options: natural | DONT | Cappelletti | Landy
slot: key-card ask (4NT)          options: Blackwood | RKCB 1430 | RKCB 0314
```

In the UI a two-option slot whose first option is "natural" is drawn as a tick box. A slot with more options is drawn as a radio group. The pair sees ticks; the code sees slots.

### 2.2 A base system is a preset plus a skeleton

A base system owns the part that cannot be ticked piece by piece: what a 2-over-1 response promises, whether 1NT over a major is forcing, and opener's rebids after them. Everything else is slots.

| | 2/1 | SAYC |
|---|---|---|
| 2-over-1 response | Game forcing, 12+ | 10+, forcing one round, promises a rebid |
| 1NT over 1M | Forcing, 6–12 | Not forcing, 6–10 |
| Default key-card ask | RKCB 1430 | Blackwood |
| Default weak-two ask | Ogust | 2NT feature ask |
| Default minor raises | Inverted | Standard (limit raise) |
| Default passed-hand 2♣ | Drury | Natural |
| Default fourth suit | Game forcing | Forcing one round |
| Default checkback | XYZ | None |
| Default defence to 1NT | DONT | Natural |

Shared by both bases and always on in version 1: 5-card majors, 1NT 15–17 with Stayman and Jacoby transfers, strong 2♣, weak twos, preempts, takeout doubles, overcalls, negative doubles.

Most of SAYC is therefore the **"natural" option of slots we must write anyway**. The SAYC-only work is the skeleton: 2-over-1 at 10+, non-forcing 1NT, and the rebids that follow.

### 2.3 The card is data, the default card is today's app

A card is a small object. The **house card** is the card that reproduces today's rules exactly. Every existing test, tool and import keeps working because the engine uses the house card when none is given.

## 3. Data

### 3.1 Catalogue (`js/pool/catalog.js`)

```js
{
  id: 'nt-defence',
  group: 'competitive',            // the card panel it belongs to
  title: 'Defence to their 1NT',
  bases: ['2/1', 'sayc'],          // which bases offer this slot
  options: [
    { id: 'natural',     title: 'Natural overcalls',  line: 'X = penalty · 2-level = natural, 6+' },
    { id: 'dont',        title: 'DONT',               line: 'X = one suit · 2♣/2♦ = that suit + higher · 2♥ = majors', notes: 'dont-against-their-1nt-tier-1' },
    { id: 'cappelletti', title: 'Cappelletti',        line: '2♣ = one suit · 2♦ = majors · 2M = M + minor' },
    { id: 'landy',       title: 'Landy',              line: '2♣ = majors · other 2-level = natural' },
  ],
  requires: null,                  // e.g. Smolen requires nothing extra; Lebensohl follow-ups require 'lebensohl'
}
```

- `line` is the text printed on the generated convention card.
- `notes` is the notes section that explains the option ("Read more").
- `requires` hides a slot until another option is chosen. Slots that share a call are one slot, so two conventions can never claim the same bid.

### 3.2 Pair card

```js
{
  v: 1,
  code: 'K7M2QX',                  // same alphabet as table codes
  name: 'Noon & Pim',
  base: 'sayc',
  picks: { 'nt-defence': 'landy', 'keycard': 'rkcb-1430' },   // only the differences from the base preset
  discuss: ['keycard'],            // picks the pair marked "to discuss"
  text: { competitive: 'Over their weak 1NT we double with 14+.' },   // free text, per panel
  members: { '<uid>': true, '<uid>': true },
  updated: 1763200000000,
}
```

Storing only differences keeps cards small and lets a base preset improve without rewriting saved cards.

`discuss` reuses the confidence label the app already has: a suggestion that rests on such a pick is shown as "Proposed agreement" (`js/confidence.js`). `js/proposed.js` becomes the `discuss` list of the house card.

### 3.3 Initial pool

"Exists" means the rules are in `js/system/` today. "New" means rules and notes must be written.

| Group | Slot | Options (first = base default for SAYC) |
|---|---|---|
| Base | Base system | SAYC (new skeleton) · 2/1 (exists) |
| Majors | Game-forcing raise | Jacoby 2NT (exists) · natural 2NT (new) |
| Majors | Splinters | Off (new) · on (exists) |
| Majors | Passed-hand 2♣ | Natural (new) · Drury (exists) |
| Majors | Jump raise | Limit (exists) · Bergen raises (new) |
| Majors | Passed-hand jump shift | Natural (new) · fit-showing (exists) |
| Minors | Raises | Standard (new) · inverted (exists) |
| Notrump | 2♠ over 1NT | Minor puppet to 3♣ (exists) · four-suit transfers (new) |
| Notrump | Smolen | Off (new) · on (exists) |
| Notrump | Texas transfers | On (exists) · off (new) |
| Notrump | Their double or overcall of our 1NT | Systems off, natural (new) · Lebensohl (exists) |
| Twos | Weak-two ask | Feature ask (new) · Ogust (exists) |
| Rebids | Checkback after a 1NT rebid | None (new) · New Minor Forcing (new) · XYZ (exists) |
| Rebids | Fourth suit | Forcing one round (new) · game forcing (exists) |
| Slam | Key-card ask | Blackwood (new) · RKCB 1430 (exists) · RKCB 0314 (new) |
| Slam | Gerber over notrump | On (exists) · off (new) |
| Competitive | Defence to their 1NT | Natural (new) · DONT (exists) · Cappelletti (new) · Landy (new) |
| Competitive | Their double of our 1M | Natural 2NT (new) · Jordan 2NT (exists) |
| Competitive | Support doubles | Off (new) · on (exists) |
| Competitive | Responsive doubles | Off (new) · on (exists) |
| Competitive | Michaels and Unusual 2NT | On (exists) · off (new) |
| Competitive | Over their weak two | Natural (new) · Leaping Michaels (exists) |
| Competitive | Doubles of slams and artificial bids | Penalty (new) · lead-directing and Lightner (exists) |
| Defence | Leads, signals, discards | Text choices; printed on the card only (no bidding rules) |

Not in version 1, and why: **1NT range** (weak or strong) and **other bases** (Acol, Precision). A different 1NT range changes opener's rebids across the whole system, not one slot. The data model allows it later as a base-level parameter.

## 4. Engine changes

### 4.1 Tag every rule

Each of the 6,515 entries gets `opt: '<slot>:<option>'`, or no tag when it belongs to the shared core. The `notes` field already separates most of them (38 sections), so the first pass is a table from notes section to option, checked by a test. Sections that mix several slots (for example "1NT opening and responses" holds Texas, Gerber and the 2♠ puppet) are tagged entry by entry.

Base skeleton entries are tagged `base:2/1` or `base:sayc`.

### 4.2 Bind the engine to a card

`js/engine.js` reads the global list `ALL` today. It becomes:

```js
export function engineFor(card) { … return { advise, explain, nextOptions, summarize, … }; }
export const { advise, explain, … } = engineFor(HOUSE_CARD);   // unchanged for every current caller
```

`engineFor` filters `ALL` once to the entries whose `opt` is active on the card, and caches the result per card.

### 4.3 Decision functions ask the card

Most situations are one decision function that returns a call (`respondToMajor`, `dont`, …). Several conventions are mixed inside one function, so filtering entries is not enough: with Drury off, `respondToMajor` would still return the Drury 2♣.

The state object `st` passed to `pick(e, st)` gains `st.sys`, with one method: `st.sys.is('passed-2c', 'drury')`. Decision functions branch on it:

```js
if (passed && st.sys.is('passed-2c', 'drury') && tr >= 3 && dp >= 10) return '2C';
```

A structurally different option (DONT, Cappelletti, Landy) is its own file with its own decision function, as `dont.js` is today. A small difference (1430 or 0314 replies) is a branch.

### 4.4 Safety net

A test runs for the house card, each base preset, and every single-option change from each preset:

1. the existing self-check (`tools/selfcheck.mjs`): every call the Advisor chooses has a meaning in the Decoder;
2. no decision function returns a call whose entry was filtered out;
3. the house card yields exactly today's 6,515 entries.

`tools/match.mjs` stays the test for rule quality, now with a `--card` argument.

## 5. The Table

Two pairs at one table may play different cards.

- The table stores a **snapshot** of each side's card (`base` + `picks`, a few hundred bytes): `table.cards = { NS, EW }`. A later edit to the card does not change a running table. `PROTO` goes from 4 to 5.
- A call is explained with the card of the side that made it. The review compares each player with their own card.
- A robot partner bids the human's card. A side with two robots bids the SAYC preset.
- Simulation (`js/sim-bid.js`) passes the right card to each side when it finishes an auction.
- The Decoder gains a "their card" choice, so a pair can study an auction against opponents who play something else. Default: the same card.

## 6. Storage and sharing

- Firebase Realtime Database, anonymous sign-in, same pattern as `js/table/sync.js`: `cards/{code}`.
- Link: `…/bridge-app/?card=K7M2QX`. Opening it shows the card and a "Use this card" button.
- `members` holds at most two device ids. The creator is the first; the partner joins by opening the link and tapping "I am the partner". Members may edit; anyone else with the code may read and copy it as a new card.
- Database rules (set in the Firebase console, and kept in the repository as `database.rules.json` from now on): read when signed in; write when the card does not exist, when the writer is a member, or when the write only adds the writer as the second member.
- Each device keeps its cards in `localStorage` (`bc:cards`), so the Advisor and Decoder work offline. Edits need a connection; the newest `updated` wins.
- A device can hold several cards (one per partner). The active card is named in the header, next to the theme menu.

## 7. Screens

A new **Card** tab, after Notes.

1. **First visit**: "Which system do you play?" with three starts: *SAYC*, *2/1 (standard)*, *2/1 (full house card)*. A fourth choice: *I have a code*.
2. **Builder**: one panel per group, in the order of a paper convention card. Each slot is one row: tick or radio, title, the one-line meaning, "Read more". A slot whose `requires` is not met is hidden. Changing the base keeps every pick that the new base also offers and lists the ones it dropped.
3. **Free text**: one text box at the end of each panel.
4. **"To discuss"**: a flag on any row.
5. **Done**: name the card, get the code and link, share.
6. **View**: the finished card as one printable page, generated from `line` texts and free text. This replaces the static `guide/convention-card.html` for pairs; the house card renders the same content it has today.

Advisor and Decoder show the active card's name. "Agreed system" in the confidence note means "on your card".

## 8. Notes pages

`notes/system-notes.html` is split into one fragment per option (`notes/pool/<slot>.<option>.html`), keeping today's heading ids so "Read more" links do not change. `tools/build-notes.mjs` builds the fragments into `guide/`. The Notes tab shows the sections of the active card, in the order of the parts of the notes. New options need new fragments: this is writing work, listed per phase below.

## 9. Build order

Each phase ships on its own and leaves the app working.

| Phase | Delivers | New bridge rules |
|---|---|---|
| 1. Foundation | Catalogue, card object, rule tags, `engineFor(card)`, `st.sys`, safety-net tests. The app looks and bids exactly as today. | None |
| 2. Standard options | The "natural" or "off" option of every existing slot; Card tab (builder, view, free text); notes fragments; card kept on the device. | About 17 small options |
| 3. SAYC | The SAYC skeleton (2-over-1 at 10+, non-forcing 1NT, the rebids after them), Blackwood, feature ask; the SAYC preset. | The largest single piece |
| 4. Sharing | Firebase `cards/{code}`, link, partner joins, several cards per device. | None |
| 5. Table | Card snapshot per side, robots and simulation by card, review by card. | None |
| 6. Alternatives | Cappelletti, Landy, RKCB 0314, New Minor Forcing, Bergen raises, four-suit transfers. | One option at a time |

Phase 3 comes before sharing and the Table because a second base is the hardest test of the design: if SAYC fits the slots, the rest will.

## 10. Risks

- **Combinations.** The number of possible cards is large. The safety net tests presets and single changes, not every combination. Slots are designed so that options do not interact; where they must (Smolen needs Stayman), `requires` says so.
- **Rule quality for new options.** Our 2/1 rules were tuned with `tools/match.mjs` over many rounds. New options start less polished. The confidence note should say "standard treatment" for options that have not been through a match test.
- **Notes writing.** Each new option needs a notes section. This is as much work as the rules.
- **Size.** All options ship in one bundle. If `js/system/` grows past what a phone loads comfortably offline, options can be loaded on demand by slot; the `opt` tag makes that possible.
