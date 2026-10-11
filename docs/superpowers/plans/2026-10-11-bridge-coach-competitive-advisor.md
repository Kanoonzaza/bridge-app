# Bridge Coach — Plan 6: Advisor in contested auctions

## Screen

- "Who opens?" now offers I'm opening / Partner / Left opp / Right opp.
- When we open, "Opponents: Always pass / Enter their calls". When they open, their calls are always entered.
- On an opponent's turn the bidding box (with Dbl/Rdbl) takes their call; the answer card says whose turn it is.
- `advisor-model.js`: `enteredTurn` decides which turns the user enters; everyone passes before the opening. `ourCalls` stores every entered call (ours and theirs). Saved state gains `compete`.

## Rules (`js/system/compete-advice.js`)

Decisions are attached to the Decoder entries of `competitive.js`, so both tabs read the same meanings:

| We opened | They opened |
|---|---|
| Responder after their overcall: cue-bid raise (10+), preemptive jump raise (5 trumps or 4 with shortness), raise, 1-level suit (1♠ after 1♥ needs 5), negative double, 2-level suit 5+ and 10+, 1NT/2NT/3NT with a stopper, weak jump shift, pass | Overcall: 1NT, Michaels, Unusual 2NT, weak jump overcall, 17+ double, 1- and 2-level overcalls, takeout double, pass (direct and balancing) |
| Responder after their double: Jordan 2NT, Drury (passed hand) or XX with 3-card support, raises, XX 10+, new suits | DONT over 1NT, advancing DONT and the overcaller's reply |
| Opener: support double/redouble, answer to a negative double (incl. penalty pass) | Over weak twos and 3-level preempts |
| Our 1NT: Lebensohl (fast denies, slow shows), systems on after a double | Advancing an overcall, a takeout double, Michaels, Unusual 2NT, a double of a weak two (Lebensohl) |

Choices: over partner's minor, a 4-card unbid major (negative double or suit) comes before raising the minor; advancer raises an overcall with 5+ dummy points.

Not covered (Advisor shows the options): later rounds of contested auctions, their interference after a 2/1 or over our 2♣ and weak twos.
