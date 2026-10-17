# Bridge Coach

Practice app for our 2/1 Game Forcing partnership system: an Advisor that suggests a bid for your hand and a Decoder that explains any auction.

Live: https://kanoonzaza.github.io/bridge-app/

- Tests: `npm test` (Node 20+)
- Rules live in `js/system/`, in folders that follow the parts of the system notes; every entry links to the notes section that explains it. How the Advisor and Decoder use them: [docs/how-the-advisor-works.md](docs/how-the-advisor-works.md).
- Advisor: choose who opens (you, partner or an opponent) and whether the opponents always pass or you enter their calls.
- Table: bid and then play the cards with friends and robots (shared by code). Declarer plays dummy; the result and score follow, then the review against the Advisor. Card play: `js/table/play.js`. Robots choose cards by double-dummy simulation (`js/table/dd.js`, in a web worker): deal the hidden cards many ways consistent with the bidding and play, solve each with DDS (Bo Haglund's double dummy solver, WebAssembly build from `bridge-dds`, Apache-2.0, in `js/vendor/dds/`), and play the card that does best on average; the rule-based robot is the fallback.
- Simulation of judgment calls: where no agreement covers the hand, the Advisor and the table robots deal likely hidden hands, finish the auction each way and score it double dummy (`js/sim-bid.js`); the work runs in parallel on a pool of web workers, one per core. Offline checks: `node tools/ddcheck.mjs` (rule checker), `node tools/simcheck.mjs` (does simulation help?), `node tools/match.mjs <other-checkout>` (duplicate match between two versions of the Advisor, scored double dummy: the test for any rule change), `node tools/ddsituation.mjs "1H P 2H"` (every alternative call at one position, by hand type).
- For practice and study only; electronic aids are not allowed at the table.

## Release

The service worker names its cache after a hash of the cached files, so installed copies only update when something really changed.

1. `npm test`
2. `npm run stamp` (rewrites `CACHE` in `sw.js`; a test fails if you forget)
3. Commit
4. Push (GitHub Pages serves the repo root under `/bridge-app/`)
