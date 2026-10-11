# Bridge Coach — Plan 4: Notrump, strong 2♣, weak twos, preempts, slam

| File | Covers |
|---|---|
| `js/system/notrump.js` | 1NT and 2NT responses (Stayman incl. garbage, Jacoby and Texas transfers, minor puppet, invitational 3m, quantitative 4NT, Gerber), opener's replies (Stayman, transfer with super-accept, puppet, invites, Texas), responder's next bid (Smolen, 5-4 invites, transfer continuations, 5-5 majors). 2♣–2♦–2NT uses the 2NT structure with a 22-point floor |
| `js/system/twos.js` | 2♣: 2♦ waiting or positive; opener's rebid; responder's second bid (second negative 3♣, 3♦ over 3♣, 3♥ over 3♦). Weak twos: raise, Ogust and replies, responder after Ogust. 3- and 4-level preempts. Gambling 3NT and pass-or-correct |
| `js/system/slam.js` | `agreedSuit(key)` decides whether 4NT is RKCB. RKCB 1430 replies and the asker's next bid wherever a suit is agreed (tail patterns); Gerber continuations |

Engine: entries may set `tail: true` to match the end of the auction (and `when(key)` for extra conditions); exact patterns always win over tail ones.

Choices: Texas with 10–15 points counting a point per card beyond six; good 6-card minor with 6–9 invites with 3m before the puppet; with 6+ major and 16+ transfer and bid 4M next; weak-two raise to 4M with 4 trumps up to 14 HCP; RKCB ambiguity (1 or 4, 0 or 3) resolved toward the lower count unless the asker holds none.

Not covered: queen ask and 5NT king replies (Decoder meaning only for 5NT), opener's later bids after 2♣ positives, interference over notrump and 2♣.
