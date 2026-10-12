# Bridge Coach — gaps in contested later rounds (proposed agreements, batch 3)

**Trigger:** 1♠–P–1NT–(2♦): the Advisor's Pass was right, but by general judgment with a thin reason, and strong or
short hands also passed. A review of every call the Advisor makes from a fallback (`tools/fallbacks.mjs`) found
more of the same.

## Added (proposed — confirm with partner; notes section "New agreements (proposed)")

1. Opener after 1M–1NT–(overcall): Pass = minimum; 2M = 6+; jump 3M = 6+, 16–18; X = takeout (short in their suit
   with extras, or 18+); new suit = natural, not forcing; 2NT/3NT = 18–19/20–21 with a stopper. Responder after
   opener's X: penalty pass with their suit, else notrump / preference / best suit.
2. Opener's reopening double after 1x–(overcall)–P–(P) (already in the notes as a principle): X when short in their
   suit; rebid a 6-card suit; show a 5-5; notrump = 18–19. Responder: penalty pass or answer like a takeout double.
3. Support doubles also after LHO's overcall (1♦–(1♥)–1♠–(2♥)–X = 3 spades); opener's other bids natural, also in the
   usual support-double auctions (raise, new suit, 1NT/2NT, cue-bid with 18+).
4. Advancing when they bid over partner's overcall (new suit, 1NT, negative double): raise 6–9 (4 trumps on less),
   jump raise weak, cue-bid 10+, notrump with stoppers, new suit natural, XX = 11+.
5. Opener after a negative double when they raise: the major partner showed, 3NT / cooperative X with 17+.

## Engine and judgment fixes

- Opener whose partner only passed: show a 5-5 second suit at the 2-level, or double with a singleton in their suit.
- Judgment: a raise needs 4+ points (or 9 trumps, or a 2-level preference to partner's 5-card suit); double with no
  fit but the balance of strength (25+, or 17+ and short in their suit) while they are at the 3-level or lower, not
  in a game-forcing auction; after our redouble, double them with 3+ cards in their suit; with a fit and 23+ after
  they compete, compete to the 3-level.
- Responsive double when partner doubled, they raised, and our suit would be at the 4-level (10+).
- Negative doubles now record the majors they promise, so later rounds see the fit.
- The general meaning of a double no longer treats their raise as an artificial bid.

## Result (3000 deals × 3 seeds, against the published version)

Contract quality unchanged within noise (games reached 703→706, 712→712, 695→694; bad trump fits 50→52, 46→47, 63→61).
Suspicious fallback calls (tools/fallbacks.mjs) 59 → 46; the rest are mostly sound passes the crude check flags.
