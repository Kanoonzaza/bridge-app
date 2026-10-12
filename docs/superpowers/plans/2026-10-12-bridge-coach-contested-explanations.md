# Bridge Coach — explanations in contested auctions

**Goal:** every call in an auction gets an explanation, including later calls after the opponents interfere,
where no specific rule exists.

## What was built

- `js/general.js` — `describeCall(auction, i, rows)`: a general meaning for a call no rule covers, from the
  notes' general rules. Covers penalty-or-takeout doubles, doubles of artificial bids, redoubles, competitive
  and preemptive raises, cue-bids of their suit (cue raise, strong hand, slam try), control bids once a suit is
  agreed, RKCB 1430 replies, rebids of one's own suit, sign-offs in an agreed suit, free bids, new suits after a
  takeout double, notrump with stoppers, and calls to play.
- `explain(auction, entries, { general: true })` adds these meanings (marked `general`, with approximate `shows`
  and a notes anchor). The default `explain` is unchanged, so Advisor decisions do not move.
- Advisor: judgment answers say what the call tells partner (the rule partner will read it by, or its
  general meaning) instead of "Natural (general judgment)"; a "Partner has shown" summary under the auction.
- Decoder: general meanings with a link to the notes; the opponents' calls show "Probably: …" (their meaning in
  a standard system like ours); with no rule for the next call, the general options are listed.
- `tools/explained.mjs [deals] [seed] [general]` measures explanation coverage.

## Result

Our side's non-pass calls explained (600 deals): quiet 97.3% → 100%, contested 67.9% → 100%.
