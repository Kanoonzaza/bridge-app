# Bridge Coach

Practice app for our 2/1 Game Forcing partnership system: an Advisor that suggests a bid for your hand and a Decoder that explains any auction.

Live: https://kanoonzaza.github.io/bridge-app/

- Tests: `npm test` (Node 20+)
- Rules live in `js/system/`; every entry links to a section of the published system notes.
- For practice and study only; electronic aids are not allowed at the table.

## Release

The service worker names its cache after a hash of the cached files, so installed copies only update when something really changed.

1. `npm test`
2. `npm run stamp` (rewrites `CACHE` in `sw.js`; a test fails if you forget)
3. Commit
4. Push (GitHub Pages serves the repo root under `/bridge-app/`)
