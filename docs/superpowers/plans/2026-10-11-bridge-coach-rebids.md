# Bridge Coach — Plan 3: Opener's rebid and responder's second bid

## Scope

Uncontested auctions, the second round:

| File | Situations |
|---|---|
| `js/system/rebids.js` | Opener's rebid after every first response: 1-level new suits (raises, splinters, 1-level suits, 1NT/2NT/3NT, own-suit rebids, lower new suits, reverses, jump shifts), 1m–1NT, 1M–1NT (forcing, and passed hand), 1M–2M (help-suit and general game tries), 1M–3M, Jacoby 2NT replies, replies to splinters, Drury replies, inverted and weak minor raises, 1m–2NT, 2/1 rebids (fast arrival, stopper rule for 2NT), passed-hand 2-level suits, and pass after weak jump shifts and games |
| `js/system/resp-rebids.js` | Responder's second bid: XYZ (all ten 1-level / 1NT-rebid auctions), fourth suit forcing after a lower new suit, responder after a reverse (2NT relay), and responder after 1M–1NT–rebid |

Each situation is one decision function plus a call table (meanings for the Decoder). An entry's `pick` asks the decision for the one answer, so exactly one entry matches a hand; the sweep tests check that for every situation and that every answer has a Decoder meaning.

## Choices made where the notes were silent or inconsistent

- After a 2/1, a balanced opener rebids 2NT only with the unbid suits stopped; otherwise rebids the major (matches worked auction 1; the notes table now says so).
- Opener raises responder's major by support points: 12–15 → 2M, 16–18 → 3M, 19+ → 4M; splinter with 19+ support points, 15+ HCP and a singleton/void (not A or K).
- Help-suit game try in the side suit with the most losers (3+ cards, 2+ losers); none → 3M.
- XYZ: invitational hands (11–12, or 10 with 5♠4♥ or a 6-card major) start with 2♣; 13+ with a good 6-card suit jumps, balanced bids 3NT, otherwise 2♦.

## Not yet covered

Opener's third bid; continuations after 2/1, Jacoby and inverted raises beyond the first rebid; 1NT/2♣/weak-two/preempt responses; slam (Plan 4–5); competitive auctions (Decoder meanings in Plan 5).
