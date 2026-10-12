# Bridge Coach — dark mode and live tables

## Dark mode
- Header switch: Auto (follow the phone) → Dark → Light; saved per phone, applied before first paint
  (inline script in index.html), status-bar colour follows.
- CSS: dark tokens under `prefers-color-scheme: dark` unless `data-theme="light"`, and under `data-theme="dark"`.

## Table tab (live bidding)
- `js/table/model.js`: pure table logic — seats (open / human / robot / always pass), boards with duplicate
  dealer and vulnerability rotation, legal-call and turn checks, robot calls by the engine, next board, bid again.
- `js/table/sync.js`: transports with one interface (`uid`, `watch`, `change` as an atomic transaction):
  Firebase Realtime Database with anonymous sign-in (SDK from gstatic, loaded only for tables), an in-memory hub
  (tests) and a local two-tab mode (`?sync=local`) for trying tables without Firebase.
- `js/table/review.js`: after the auction — the Advisor's auction for the same cards, each human call compared
  with the Advisor's call, the final contract.
- `js/ui/table.js`: lobby (name, start with Robots / Always pass / Players, join by code), invite link
  (`?table=CODE` opens the Table tab), seats, auction grid, own hand only, optional meanings, the Advisor's bid
  on request, review with all four hands, next board.
- North-South is the home pair (creator South, partner North); only they choose the opponents.
  With "Players", the other pair sits East-West; their calls are explained as "Probably" (our system)
  until their convention card is added.
- Robots: every phone at the table tries the robot's call; the transaction lets exactly one through.

## Pending
- Firebase config from the user (`js/config.js` `FIREBASE`), then a live test on two phones.
- The other pair's system (their convention card) for robots and explanations on their side.
