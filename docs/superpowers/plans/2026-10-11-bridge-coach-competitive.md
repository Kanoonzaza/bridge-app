# Bridge Coach — Plan 5: Competitive auctions (Decoder)

`js/system/competitive.js` generates Decoder-only entries (no advisor picks) for contested auctions. Opponents' calls are bracketed in the situation key, so none of these can match an uncontested auction.

| Section | Auctions |
|---|---|
| Overcalls | Their 1-level suit: takeout X, 1NT 15–18 (balancing 11–14), simple and weak jump overcalls, Michaels, Unusual 2NT |
| DONT | Their 1NT, direct and balancing; advancing and the overcaller's reply |
| Weak twos, preempts | X, 2NT 15–18, cue for a stopper, natural suits; Lebensohl advances after partner doubles a weak two |
| Advancing | Partner's overcall (raise, preemptive jump raise, cue-bid 10+, 1NT/2NT, new suit NF), takeout double, Michaels, Unusual 2NT |
| Our opening, they overcall | Negative doubles through 3♠ (meaning depends on the unbid majors and the level), raises (inverted minors off), cue-bid limit raise, 1NT, new suits (2/1 off), weak jump shifts |
| They double our opening | XX 10+, 1-level forcing, 2-level weak, Jordan 2NT, preemptive raise, Drury for a passed hand |
| Support X / XX | Through 2 of responder's major |
| Our 1NT | Lebensohl after a 2-level overcall (incl. the follow-ups after 2NT–3♣), systems on after a double |
| Our 2♣ | Pass 0–3, double 4+, natural positives |
| RKCB | Their double or 5-level bid over our 4NT |

Added to the notes: 1NT after their overcall = natural 8–10 with a stopper; weak jump shifts also apply in competition.

The Advisor still assumes the opponents pass (stage 1 scope).
