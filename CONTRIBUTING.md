# Contributing

BlockShield is an MIT-licensed demo for on-chain image originality checks. Useful contributions keep the **local four-part stack** working together: contract, frontend, indexer, extension.

## Local setup

Prerequisites: Node.js 20+, Foundry (`forge`, `anvil`), MetaMask.

From the repository root:

```bash
npm --prefix frontend install
npm --prefix extension install
npm --prefix indexer install
npm run chain:deploy
npm run indexer:start
npm run frontend:dev
```

Load the unpacked Chrome extension from `extension/` and point the popup at the local contract, `http://127.0.0.1:8545`, and `http://127.0.0.1:8787`.

Full reset:

```bash
npm run dev:restart
```

Frontend demo posts: `http://localhost:5173/feed?resetStorage=1`.

## Tests

```bash
cd contract/original-content
forge test
forge coverage --match-path test/unit/OriginalContentUnitTest.t.sol
```

There are no automated tests for the frontend, extension, or indexer yet. Please exercise the judge demo path in the root README before opening a PR:

1. Register with wallet A.
2. Block a similar image from wallet B.
3. Run a manual page scan and confirm badges.

## Scope

Please keep changes aligned with the current product:

- Images only (pHash), not video or text.
- Manual extension scan, not background crawling.
- Same `phash-js@0.3.0` on frontend and extension.

## Pull requests

- One concern per PR when possible.
- Do not commit `frontend/public/phash.js`, `magick.js`, or `magick.wasm` (copied at Vite startup).
- Do not commit indexer `data/index.json` or contract `out/` / `cache/`.
- Update `CHANGELOG.md` under **Unreleased** for user-visible changes.

## Versioning

`VERSION` is the source of truth. GitHub Actions keeps it honest:

- On pull requests / `main`: `.github/workflows/version-check.yml` runs `npm run version:check`.
- On tag `vX.Y.Z`: `.github/workflows/release.yml` checks that the tag equals `VERSION`, then creates a GitHub Release from the matching CHANGELOG section.

For everyday PRs, only add bullets under **Unreleased**. When cutting a release:

1. Move **Unreleased** entries into a new `## [x.y.z] - YYYY-MM-DD` section and leave an empty **Unreleased** heading.
2. Put `x.y.z` in `VERSION`.
3. Run `npm run version:sync` to copy that version into package/`manifest.json` files and regenerate CHANGELOG compare links.
4. Run `npm run version:check`.
5. Commit, then tag `vX.Y.Z` and push the tag.


## License

By contributing you agree that your changes are licensed under the MIT License (`LICENSE`).
