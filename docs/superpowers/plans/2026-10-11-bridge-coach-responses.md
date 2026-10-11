# Bridge Coach — Plan 2: Responder's first bid

Rebuilt on 2026-10-11 after the first Plan 2 branch was lost with its container (it was never pushed).

## Scope

Responder's first bid after partner's 1♣ / 1♦ / 1♥ / 1♠ with the opponents passing, for an unpassed and a passed responder. Each call also gets a Decoder meaning.

## Files

| File | Holds |
|---|---|
| `js/system/resp-major.js` | `respondToMajor(e, M, passed)`: the decision order after 1♥/1♠, plus the entries (meanings, reasons, plans, close calls) |
| `js/system/resp-minor.js` | `respondToMinor(e, m, passed)`: the same after 1♣/1♦ |
| `tests/responses.test.js` | Known-answer hands from the notes, decoder meanings, and a 24,000-hand sweep (each opening × seat 1–4) |

Each entry's `pick` asks the decision function for the one answer, so two entries can never both match a hand.

## Agreements encoded

After 1♥/1♠ (unpassed): splinter (4+ trumps, singleton/void not A or K, 10–14 HCP; 1♠–4♥ is natural) → Jacoby 2NT (4+ trumps, 13+ dummy points, 10+ HCP) → 4M (5+ trumps, shortness, ≤ 9 HCP) → 3M limit raise (4+ trumps, 10–12 dummy points, 7+ HCP) → 2M (3+ trumps, 6–9 dummy points) → 1♠ over 1♥ (4+ spades, any strength) → 2/1 (13+ HCP or a good 12; 2♥ needs 5, 2♦ 4, 2♣ may be 3) → weak jump shift (6+ cards, 2–5 HCP) → forcing 1NT (6–12, with a plan for the second bid) → pass.

Passed responder: no splinter, Jacoby or 2/1. Drury 2♣ (3+ trumps, 10+ dummy points), 2♦ / 2♥ natural non-forcing (5+, 10+ HCP), 1NT not forcing.

After 1♣/1♦: minor splinter 3♥/3♠ (5+ support, 12–15, no 4-card major) → with 12+ and a longer 5+ minor, that minor first (1♣–1♦, 1♦–2♣) → 4-card major up the line, longer first, 5-5 spades; Walsh over 1♣ → balanced, no major, at most 4-card support: 1NT 6–10, 2NT 11–12, 3NT 13–15 → 3m weak raise (5–9, 5+, unbalanced) → weak jump shift → 1♦ over 1♣ → inverted raise (10+, 5+ clubs / 4+ diamonds) → 2♣ over 1♦ (2/1; passed hand: natural, non-forcing) → notrump by strength.

## Release checks

`npm test`, `npm run stamp`, browser check at 375 px: partner 1♠ seat 1 with ♠KT74 ♥A5 ♦KQ83 ♣J62 → 2NT; seat 3 with ♠KJ5 ♥Q842 ♦A73 ♣965 → 2♣ Drury; Decoder 1♦–P–2♦ → "Inverted raise".
