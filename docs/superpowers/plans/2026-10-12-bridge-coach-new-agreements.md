# Bridge Coach — Plan 9: New agreements (proposed, to confirm with partner)

Added to the notes as "New agreements (proposed, Oct 2026)" and to the convention card.

| Agreement | Decoder | Advisor |
|---|---|---|
| Lead-directing doubles of their Stayman/transfers (1NT and 2NT) and key-card replies | meanings | X with a good suit (2 of the top 3, 5+; or AKQ) |
| Defense against their strong 2♣ (and after their 2♦ waiting) | X = lead, suits natural preemptive, jump = 7+, 2NT = minors | chooses among them |
| Responsive doubles after their raise to 2 or 3 over partner's takeout double or overcall | meanings | raise with support, X with 8+ and both unbid suits (or 10+ no suit), else a 5-card suit |
| Competing at the 3-level: Law of Total Tricks; maximal double | meanings for the maximal-double auctions | judgment competes to trumps − 6 and uses the maximal double as a game try with 23–24 combined |
| Vulnerability | — | new "Vulnerable" setting: vulnerable preempts and weak jump overcalls need 7+ HCP and two top honors; favorable allows 4+ HCP and competes one level higher |

Engine: `auction.vul` ('none' | 'NS' | 'EW' | 'both'); `situation.ctx.vul` is relative ('none' | 'we' | 'they' | 'both'). The "as if they had passed" fallback no longer applies once the opponents have outbid us.
