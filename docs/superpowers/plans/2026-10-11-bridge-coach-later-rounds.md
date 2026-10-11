# Bridge Coach — Plan 8: Later rounds (contested and uncontested) and strong 2♣

## General judgment (`js/judgment.js`)

Used when no specific rule covers a situation. From the auction it takes partner's minimum strength (the rules' `shows`, or a default for the first action: opening 12, 1NT 15, 2♣ 22; response 6, 2/1 10, 2♣ positive 8, 2♦ waiting 0; overcall 8, takeout double 12, advance 5) and shown suit lengths, then:

1. after their redouble of partner's takeout double, run to the longest suit;
2. a fit (8+ trumps, or an agreed suit) and 33+ combined → RKCB; no fit and 33+ → 6NT;
3. they bid over our game and we have 25+ → penalty double;
4. 25+ → game (major fit → 4M; minor fit → 5m only with 28+, else 3NT with a stopper);
5. no fit, 23+ and length with an honor in their suit → penalty double;
6. a fit → compete to the level of the Law of Total Tricks (trumps − 6);
7. game-forcing or forcing auctions never pass: 3NT with a stopper, a 5-card suit, or a suit already bid;
8. a 6-card suit with 10+ competes; with a fit and 23–24 invite; otherwise pass.

The supporting hand counts dummy points; the hand with the long trumps counts length.

## Engine fallbacks (in order)

partner placed game → pass; "as if they had passed" only when our calls keep the same shape and strength, and not to pass when they have outbid us; partner only passed → opener/responder compete or pass; general judgment; defending with 14 or less → pass; last resort: 15+ shows a 5-card suit once or doubles with 17+, else pass.

## Specific rules added

- Strong 2♣: opener after a positive (raise to set trumps, 2NT/3NT balanced, natural suits); responder's raise now shows 4+ HCP.
- Cue-bid raises are forcing; responder bids game directly when the cue-bid would be at the 4-level; opener's cue after a negative double is answered.
- Slam steps in round-3 rules (raises, opposite 2NT, Stayman) and answers to quantitative 4NT.

## Measuring

`node tools/coverage.mjs` (uncovered situations: 0%) and `node tools/quality.mjs [deals] [seed] [examples]` (grades final contracts). On 3 × 1000 deals: the side with 26+ HCP reaches game in 92–96% of deals; remaining issues are judgment calls. `node tools/trace.mjs` prints the source and reasons of every call of a deal.
