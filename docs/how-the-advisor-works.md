# How the Advisor and the Decoder work

The two tabs read **one set of rules**. The Decoder asks "what does this call mean?", the Advisor asks "which call fits this hand?". Both answers come from the same entry, so the explanation you read is always the reason the Advisor chose the call.

```
auction ──► situation (key + context) ──► matching rules ──► Decoder: their meanings
                                                       └──► Advisor: the first rule whose pick() accepts the hand
                                                                     └─ none? ──► fallback steps (judgment)
```

## 1. The situation

`situationAt(auction, n)` (`js/auction.js`) turns the auction into what the rules match on:

- **key**: our side's calls from the opening on, with the opponents' calls in brackets.
  For example, partner opened 1♥, they bid 2♣ and it is my turn: `['1H', '(2C)']`.
- **ctx**:
  - `opened`: `us` or `them`.
  - `role`: `opening`, `opener`, `responder` or `defender`.
  - `seat`: the seat of the opening bid.
  - `responderPassed`: the responder passed before the opening (a passed hand).
  - `competitive`: the opponents have done something other than pass.
  - `vul`: the vulnerability, from our side's point of view.

## 2. A rule (entry)

Every rule is one call in one situation:

```js
{
  after: ['1M'],                 // the key it matches; M = any major, m = a minor, x = any suit,
                                 // O = the other major, n = the other minor; (..) = an opponent's call
  call: '3M',
  meaning: 'Limit raise: 4+ {M}, 10–12 dummy points. Invites game.',   // what the Decoder shows
  shows: { hcp: [7, 12], len: { M: [4, 13] } },   // what partner may assume (HCP; shortness adds the rest)
  notes: 'raising-partners-major-tier-0',   // the notes heading "Read more" opens
  priority: 14,                             // lower is tried first
  pick: (e, st) => …,            // Advisor: does hand e make this call? (e = evaluate(hand))
  why: (e, st) => [...],         // the reasons shown under the suggestion
  plan, close,                   // optional: the next step, and a close-call note
}
```

An entry may also carry `ctx` (only in that context, e.g. `{ responderPassed: true }` for Drury) or `when` (an extra test on the auction). `shows` uses HCP unless `pts` is set. With `pts`, the range counts points with the fit: shortness for the supporting hand, length for the trump hand. `light: true` means the minimum may be lower after a Rule-of-20 opening.

Most situations are written as **one decision function plus a table of meanings**. For example, `respondToMajor(e, M, passed)` returns the call, and each entry's `pick` is "the decision function returned me". This keeps the reasons in one readable place per situation.

### Matching

`candidates(situation)` (`js/engine.js`) collects the entries whose `after` pattern matches the key and whose `ctx` agrees.

- When two entries give the same call, the more specific pattern wins: a literal call beats M/m, and M/m beat x.
- A `tail` entry matches the end of any auction, e.g. answers to 4NT once a suit is agreed.
- Partner's direct 1NT overcall is read as our 1NT opening ("systems on").

## 3. The Decoder

- `explain(auction)` finds, for each call, the matching entry and fills in its meaning.
- With `{ general: true }`, a call no rule covers gets a general meaning from `js/general.js`. These are built from the notes' general rules: penalty or takeout, the Law of Total Tricks, free bids, cue-bids of their suit, control bids. The Decoder marks these "no specific agreement".
- `nextOptions` lists what the next call could mean.
- `generalOptions` does the same where no rule exists.
- `summarize(rows, seat)` adds up what a player has shown. This is the "Partner has shown" chips, and what the judgment uses.

## 4. The Advisor

`advise(hand, auction)` tries the matching entries, ordered by priority. The first whose `pick` accepts the hand is the suggestion. It comes with the entry's meaning, reasons, plan, close-call note and notes link.

When no rule accepts the hand, `js/fallback.js` runs its steps in order. The first step that answers decides:

1. Partner placed the contract (game or higher) and the opponents passed: pass.
2. Uncontested auction: general judgment.
3. We opened, partner only passed, and they compete: the opener competes or passes.
4. We opened, I only passed, and they compete: raise with support, or pass.
5. Their bids took none of our room: bid as if they had passed (reuses the real rule).
6. General judgment.
7. They opened and I hold 14 or less: pass.
8. They opened and I hold 15+: show a suit, bid notrump with a stopper, or double.
9. Pass.

**General judgment** (`js/judgment.js`) first reads the situation once (`readSituation`):

- partner's minimum strength;
- our best fit and the combined points;
- who bid last;
- whether the auction is forcing.

It then tries named steps in order:

1. Answer partner's takeout double.
2. Slam.
3. Penalty doubles.
4. Game.
5. Compete by the Law of Total Tricks.
6. Keep a forcing auction going.
7. Free bids.
8. Misfits.
9. Invitation.

If none applies, it passes and says why.

**Simulation** (`js/sim-bid.js`, `js/sim-advice.js`). A general-judgment call is then checked by simulation, in the background:

1. Deal the hidden hands 48 ways that fit the auction: the point and length ranges the Decoder reads from each call, then checked by asking the Advisor whether each hidden player would really have made the calls they made.
2. For each candidate call (the Advisor's call, pass, double, bids in the suits we or partner hold, notrump, the games), finish the auction with the Advisor and score the final contract double dummy with DDS.
3. Total the results in IMPs against the Advisor's call. A different call replaces it only when it gains at least 0.75 IMPs per deal and does better on more than 52% of the deals.

The work is split across a pool of web workers, one per processor core (`js/table/pool.js`, `js/table/dd-worker.js`). A contract at the 5-level or higher bid over the opponents' calls is scored doubled when it fails, because the Advisor defending would not double it as boldly as people do. At the 5-level or higher the simulation may bid only a suit in which our side has a known 8-card fit (no phantom sacrifices in a suit nobody has shown). A candidate call is also dropped if the meaning the Decoder would give it does not fit the hand (a stopper in a suit the hand does not stop, a length or strength it lacks), so the simulation never picks a call that claims something false. The screen shows the rule-based call at once and swaps in the simulated one when it arrives; table robots use the same check for their own judgment calls. The tag then reads **Simulation**. `tools/ddcheck.mjs` (rule checker) and `tools/simcheck.mjs` (does simulation help?) measure all of this offline. To test a rule change, check out `main` next to the working copy and run `node tools/match.mjs ../that-checkout`: the same deals are bid by both versions at both tables and scored double dummy, so the result is the change in IMPs per board with the luck of the deal removed. `tools/ddsituation.mjs` studies one auction, listing what every alternative call would score for each type of hand.

Every suggestion carries a **confidence tag** (`js/confidence.js`):

- **Agreed system**: a rule answered.
- **Proposed agreement**: the rule links to a notes subsection marked Proposed (the list is in `js/proposed.js`).
- **General judgment**: the fallback answered.
- **Simulation**: the fallback answered and a simulation of likely deals checked it (or changed it).

## 5. Where each rule lives

The folders follow the parts of the system notes.

| Notes | File |
|---|---|
| Part 2 · Opening bids | `js/system/opening/openings.js` |
| Part 2 · 1NT and 2NT, Smolen | `js/system/opening/notrump.js` |
| Part 2 · Strong 2♣, weak twos, preempts | `js/system/opening/twos.js` |
| Part 3 · Responding to 1♥/1♠ (raises, Drury, 2/1, forcing 1NT) | `js/system/responding/major.js` |
| Part 3 · Responding to 1♣/1♦ (inverted minors) | `js/system/responding/minor.js` |
| Part 4 · Opener's rebids (also after raises, 2/1, Drury) | `js/system/rebids/opener.js` |
| Part 4 · Responder's rebids (XYZ, fourth suit, after a reverse, after 1M–1NT) | `js/system/rebids/responder.js` |
| Part 4 · Third round and later | `js/system/rebids/third-round.js` |
| Part 4 · RKCB, Gerber | `js/system/rebids/slam.js` |
| Part 5 · Competitive bidding: when they open | `js/system/competitive/when-they-open.js` |
| Part 5 · DONT | `js/system/competitive/dont.js` |
| Part 5 · When we open and they compete (negative and support doubles, Jordan) | `js/system/competitive/when-we-open.js` |
| Part 5 · Interference over our 1NT (Lebensohl), 2♣, 4NT | `js/system/competitive/over-our-conventions.js` |
| Part 5 · Lead-directing, maximal and Lightner doubles | `js/system/competitive/penalty-and-lead-doubles.js` |
| No rule | `js/fallback.js`, `js/judgment.js` (Advisor); `js/general.js` (Decoder) |

`js/system/index.js` gathers them all.

### Contested-auction files

The files in `js/system/competitive/` share `shared.js`, which provides:

- `def(after, call, meaning, shows, notes)`: what a call means. The first definition of a call in a situation wins.
- `advise(after, decide, samples)`: attaches the Advisor's decision to the calls already defined for that situation. `decide(e, st)` returns `R(call, reasons, { plan, close })`.

Each file has the meanings first, then the decisions.

## 6. Adding or changing a rule

1. Write it in the file for its notes section, with `notes` pointing at the heading that explains it. Any `id` of a notes `h2` or `h3` works.
2. If it is a proposed agreement, mark its notes heading **Proposed** and add the id to `js/proposed.js`. A test keeps the two in step.
3. If you add a file, list it in `sw.js`.
4. Run `npm test` and `npm run stamp`. The stamp rebuilds the in-app notes and the cache name.
5. Check the effect:
   - `node tools/selfcheck.mjs`: calls that contradict their own explanation. The test ceiling may only go down.
   - `node tools/quality.mjs`: final contracts graded on random deals.
   - `node tools/coverage.mjs`: situations no rule covers.
