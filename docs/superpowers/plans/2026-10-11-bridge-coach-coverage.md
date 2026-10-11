# Bridge Coach — Plan 7: Closing coverage gaps

`npm run coverage [deals] [seed] [rows]` bids random deals with all four players using the Advisor and lists the situations it cannot answer. Uncovered deals: 96% → 23.5% (3,000 deals, seed 1).

## Engine

- Rules are indexed by pattern length (one lookup ≈ 0.5 ms).
- Fallbacks when no rule matches, labelled "general rule" in the Advisor:
  - partner placed a game or slam → pass (up to 19 HCP);
  - we opened and the opponents compete: bid as if they had passed when that call is still legal;
  - we opened and partner has only passed: opener rebids a 6-card suit at the 2-level or passes; responder raises to the 2-level with support or passes;
  - they opened: pass with 14 HCP or less; with 17+ bid a 5-card unbid suit or double again.

## New rules

- `round3.js`: responder after opener raises, rebids the suit, bids 2NT/3x/3NT; inverted-minor continuations; game-try answers; Jacoby continuations; 2/1 third round; opener after 1M–1NT–x invitations; opener after notrump sequences (transfers, Stayman, Smolen); XYZ relays, game-force answers, invitations and their answers; FSF answers and responder's game choice; 1m–1NT continuations.
- `compete-advice.js`: responder after opener answers a negative double (accepts a jump with 9+); answers to their Michaels, Unusual 2NT and 1NT overcall; our first action after they open and respond; responder after a support double.
