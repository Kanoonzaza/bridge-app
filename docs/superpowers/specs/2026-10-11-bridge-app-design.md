# Bridge Coach — Stage 1 Design

Date: 2026-10-11
Status: approved in conversation, awaiting written-spec review

## 1. Purpose

A practice and study app for our partnership's bidding system (2/1 Game Forcing, 1NT 15–17), as written in the convention card and system notes (`../src/card.md`, `../src/guide-*.md`). It is for use **before and after** games, not at the table: electronic aids during play are not allowed in club or tournament bridge.

The full app is built in three stages that share one bidding engine:

| Stage | Delivers |
|---|---|
| **1 (this spec)** | Bidding engine + **Decoder** tab + **Advisor** tab |
| 2 | Practice drills: random deals, user picks a bid, the engine marks it |
| 3 | Robot partner: bid full deals together; needs a trick-count (double-dummy) solver |

Stages 2 and 3 get their own specs later. Nothing in stage 1 may block them: the engine must be usable without the UI.

## 2. Users and platform

- Primary user: the owner (beginner–amateur, relearning after two years). Secondary: their partner, opening the same link in any browser.
- **Installable offline web app (PWA)**, phone-first, English only.
- **No build step**: plain ES modules, HTML, CSS — the same pattern as the owner's Korean app.
- Hosted on **GitHub Pages** from a **public** repository `Kanoonzaza/bridge-app`, served at `https://kanoonzaza.github.io/bridge-app/`.
- Works fully offline after the first visit. No accounts, no server, nothing sent off the device.

## 3. Screens

Two tabs in stage 1: **Advisor** and **Decoder**. (Mockup approved in conversation.)

### 3.1 Advisor

1. **Hand picker**: four rows (♠ ♥ ♦ ♣) of 13 tappable cards (A K Q J 10 9 8 7 6 5 4 3 2). Live counter "n/13 cards · x HCP". Buttons: **Random hand**, **Clear**.
2. **Start**: toggle *I'm opening* / *Partner opened*. Switch **"Someone passed first"** with the choice *I passed* / *Partner passed* (drives Drury and the passed-hand rules).
3. **Auction**: a strip showing our side's calls so far (opponents' passes inserted automatically and shown faintly) and a **bidding box**: levels 1–7 × ♣ ♦ ♥ ♠ NT, plus Pass. Illegal calls (not higher than the last bid) are greyed and cannot be tapped. An **Undo** button removes the last call.
4. **Answer card** (appears when it is the user's turn and the hand has 13 cards):
   - **Suggested bid**, large.
   - **Why**: 1–3 reasons computed from the hand (e.g. "13 HCP, 5 clubs, no spade fit → 2/1 game force").
   - **Tells partner**: the bid's meaning from the rules table.
   - **Plan** (optional): the intended next bid when the rule defines one (e.g. relay then 3♦).
   - **Close call** (optional): shown when the hand is on a boundary, naming the alternative and how to judge.
   - **Read more**: link to the matching section of the published system notes (`https://claude.ai/artifact/NrdCttHcwDpCv83CsLGpfd#<anchor>`; needs internet).
   - If no rule covers the situation: **"Not covered yet"** plus the decoder's list of possible bids.

### 3.2 Decoder

1. **Auction entry** with the same bidding box, but with opponents' calls allowed, including X and XX. The user enters every call in order; a "Who dealt / who opened" control sets which side each call belongs to.
2. **Meaning list**: each call gets a one-line meaning; tap to expand the full text. Calls with no agreement show "No agreement in our system for this bid".
3. **"Partner has shown"** chips: the combined ranges from partner's calls (HCP range, suit lengths, forcing status).
4. **"What can I bid next?"**: every next call that has a table entry, with its meaning.

### 3.3 General

- Last hand, start settings and auctions are remembered in `localStorage` (wrapped in try/catch; the app works without it).
- Visual style follows the published card: green accent, red ♥/♦, light and dark themes.
- Update flow as in the Korean app: a waiting service worker shows "New version ready — tap to update"; it never takes over on its own.

## 4. Architecture

Plain JavaScript ES modules. Everything except `ui/` runs unchanged in Node for tests.

| Module | Responsibility |
|---|---|
| `js/cards.js` | Hand model. Parse/format (`"KJ852 83 Q4 J953"` ⇄ card sets), HCP, suit lengths, shape class (balanced / semi-balanced / unbalanced, 4-4-4-1), dummy points (with the short-honor adjustment from the notes), suit quality ("good" = 2 of top 3 honors), controls (A = 2, K = 1), good-12/bad-12 judgment, Rule of 20 and Rule of 15 |
| `js/auction.js` | Auction model. List of calls with seat; legality (a bid must outrank the last bid; X only over an opponent's bid, XX only over an opponent's X); who opened; roles (opener / responder / overcaller / advancer); passed-hand flags; whether opponents have bid. Produces the **situation key** used to look up the table |
| `js/system/*.js` | The **rules table**, one file per topic, mirroring the notes: `openings`, `resp-major`, `resp-minor`, `rebids`, `reverses`, `notrump`, `strong2c`, `weak2`, `preempts`, `xyz`, `slam`, `competitive` (decoder meanings only in stage 1) |
| `js/engine.js` | `explain(auction)` → meaning for each call, partner summary, list of next calls. `advise(hand, auction)` → `{ call, reasons, meaning, plan, close, notes }` or `{ notCovered: true, options }` |
| `js/ui/hand-picker.js`, `bidding-box.js`, `advisor.js`, `decoder.js`, `app.js` | Screens and wiring. No bridge logic lives here |
| `sw.js`, `manifest.webmanifest`, icons | Offline cache and install |

**Data flow**: tap → `auction.js` validates and stores the call → `engine.js` resolves the situation key → the table entry list for that situation → decoder renders meanings, or advisor evaluates the user's hand against each entry in priority order → UI renders the result.

## 5. The rules table

### 5.1 Situation key

A situation is the auction so far, normalised to:

- `calls`: our side's calls in order, e.g. `['1D', '1S', '2H']` (opener's call first), with opponents' calls written in brackets when they are not passes: `['1H', '(2C)']`.
- `ctx`: `{ openerSeat: 1..4, responderPassed, openerPassed, competitive }`.

Patterns in the table may use placeholders: `M` = either major, `m` = either minor, `x` = any suit; a placeholder binds once per pattern, so `['1M', '2M']` matches 1♥–2♥ but not 1♥–2♠. A more specific pattern wins over a placeholder pattern.

### 5.2 Entry

Each entry describes one call in one situation:

```js
{
  after: ['1M'],                 // situation pattern
  ctx: { responderPassed: false },
  call: '2C',
  meaning: '2/1 game force: 12+ HCP, 3+ clubs (usually 4+).',
  shows: { hcp: [12, 37], len: { C: [3, 13] }, force: 'game' },
  pick: (h, s) => h.respStrength >= 12 && h.len[s.M] < 3 && best21Suit(h, s) === 'C',
  priority: 40,                  // lower = checked first
  plan: null,                    // or (h, s) => 'After 2♦, bid …'
  close: (h) => h.hcp === 12 ? 'Exactly 12: a good 12 bids 2♣, a bad 12 bids 1NT.' : null,
  notes: '21-game-forcing-tier-0',
}
```

- `meaning` and `shows` serve the decoder; `pick`, `priority`, `plan` and `close` serve the advisor.
- An entry with no `pick` is decoder-only (all of `competitive` in stage 1).
- `shows.force` is one of `none`, `round`, `game`.
- Entries are checked in ascending `priority`; the first whose `pick` returns true is the suggestion. This mirrors the decision order in the notes (fit bids before new suits, game-forcing raises before 2/1, 2/1 before 1NT).

### 5.3 Advisor coverage in stage 1 (uncontested auctions only)

| Round | Covered |
|---|---|
| Opening | All openings on the card; Rule of 20 (1st/2nd seat), light 3rd seat, Rule of 15 (4th seat); 1NT with a 5-card major; weak two vs 1-level opening; preempts; Gambling 3NT; 2♣ |
| First response | To 1♣/1♦ (Walsh, inverted minors, 1NT/2NT/3NT, 1♦–2♣ 2/1, weak jump shifts, minor splinters); to 1♥/1♠ (raise ladder, Jacoby 2NT, splinters, 4M, weak jump shifts, 2/1, forcing 1NT, Drury); to 1NT and 2NT (Stayman, transfers, minor puppet, 3m invite, Texas, Gerber, quantitative 4NT); to 2♣; to weak twos (raise, new suit, Ogust 2NT); to preempts and Gambling 3NT |
| Opener's rebid | After every 1-level response (1NT, raises, new suits, reverses, jump rebids, jump shifts, opener splinters); after a 2/1; after a forcing 1NT; Jacoby replies; after an inverted raise; Stayman and transfer replies with super-accept; Ogust replies; 2♣ rebids |
| Responder's 2nd bid | XYZ; after a forcing 1NT; after a reverse (2NT relay); fourth suit forcing; Stayman and transfer follow-ups; Smolen; Texas follow-ups; after Ogust |
| Slam | Replies to RKCB 1430, queen ask, 5NT king ask, Gerber and 5♣ — whenever they occur. Suggest 4NT when a fit is agreed and combined strength (own points + partner's shown minimum) is 33+ |

Anything beyond this (opener's third bid onward, except slam replies) returns **Not covered yet** with the decoder's options. The decoder covers the **whole card**, including competitive auctions.

### 5.4 Close calls flagged in stage 1

Exactly 12 as responder; 15–17 with a 5-card major; borderline Rule of 20 / Rule of 15; 4-4-4-1; limit-raise edges (10 and 12 dummy points); accepting or declining an invitation within one point of the middle of the inviter's range.

## 6. Error handling

| Situation | Behaviour |
|---|---|
| Illegal call | Greyed in the bidding box; cannot be entered |
| Hand not 13 cards | Answer card replaced by "Pick exactly 13 cards (you have n)" |
| Not the user's turn | Answer card hidden; prompt shows whose turn it is |
| Auction outside the table | Decoder: "No agreement in our system for this bid". Advisor: "Not covered yet" + options |
| Two entries both match with equal priority | Never shipped: a consistency test fails the build (see 7.2) |
| `localStorage` unavailable | App works; nothing is remembered |
| Notes link offline | Link still shown; opening it needs internet |

## 7. Testing

All tests run with `node --test` (Node ≥ 18, no dependencies).

### 7.1 Known-answer hands

Every worked example in the system notes becomes a test: `{ hand, auction, ctx, expect }`. Starting set: the examples in the notes' sections on opening bids, 2/1, exactly-12, forcing 1NT, major raises, Jacoby, splinters, game tries, Walsh, reverses, Stayman, transfers, Texas, minor puppet, weak twos/Ogust, inverted minors, XYZ, fourth suit, Drury, Jordan (decoder), Smolen, 2♣ — more than 40 cases. New situations add new cases.

### 7.2 Consistency tests

- Every entry has `meaning`, `shows` and a `notes` anchor listed in `data/notes-anchors.json`. That file is written by the notes build script (`../build.py`) every time the notes are rebuilt, so the repo stays self-contained.
- Every call the advisor can return has an entry (so the decoder can explain it).
- For each situation with advisor entries, a sweep of 5,000 random hands finds no hand matched by two entries of equal priority, and logs (as a warning, not a failure) hands matched by none.
- Legality: the bidding-box legal set equals the auction module's legal set for 1,000 random auctions.

### 7.3 Manual check before each release

Open the app at phone width (375 px) in light and dark mode; enter the mockup auction (1♦–1♠–2♥ with `♠KJ852 ♥83 ♦Q4 ♣J953`) and expect **2NT**; check one decoder auction with an overcall; confirm it loads offline after one visit.

## 8. Release and maintenance

- Repo folder: `C:\Users\HP\Claude work\bridge\bridge-app\`.
- Release: tests pass → bump `CACHE` version in `sw.js` → commit → push to `main` → GitHub Pages serves it.
- Changing an agreement: edit the rules entry **and** the matching notes source (`../src/*.md`), rebuild and republish the notes (which refreshes `data/notes-anchors.json`); the anchor test keeps them linked.

## 9. Out of scope for stage 1

- Advisor suggestions in competitive auctions (decoder meanings only).
- Opener's third bid and later (except slam replies).
- Practice drills, robot partner, trick-count solver (stages 2–3).
- Shared progress, accounts, sync between devices.
- Thai language.
