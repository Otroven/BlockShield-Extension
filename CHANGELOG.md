# Changelog

The current release is the single line in [`VERSION`](./VERSION).
GitHub Actions checks that this file, the latest CHANGELOG section, and package/`manifest.json` versions match.
Pushing tag `vX.Y.Z` (same as `VERSION`) publishes a GitHub Release from that CHANGELOG section.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- GitHub Actions: version consistency check on PRs, GitHub Release from CHANGELOG on `v*` tags.
- Root README section on what is different (first-claim, URL scopes, pre-registration gate, manual scan).
- `samples/` demo images (`original.png`, `compressed.png`) for the judge scenario.
- `npm run dev:stop` to kill the local Anvil, indexer, and Vite processes.
- `npm run dev:start` to bring up Anvil, indexer, and Vite in one terminal.
- Demo Hamming threshold `16` (frontend `.env` + extension default) so `samples/compressed.png` is caught.

## [1.1.0] - 2026-08-22

### Changed

- Frontend hashing uses the same pinned `phash-js@0.3.0` package as the extension (no jsDelivr CDN).
- Contract README documents `OriginalContent` instead of the Foundry Counter template.
- Root README describes manual page scan, flip/crop variants, and local-demo limits.

### Removed

- Unused `registerContentBundle` / fingerprint-linking path from the contract, tests, and indexer.
- Unused OpenZeppelin submodule and ISC license on the extension package.
- Placeholder `npm test` script on the extension that always exited 1.

### Added

- Contract unit tests for missing-record reads, host-only scopes, scope-format rejects, and signature edge cases.
- `CONTRIBUTING.md`.
- Root `VERSION` file aligned with this changelog.

## [1.0.0] - 2026-08-03

- EIP-712 `registerContent` with allowed URL scopes and whitelist updates.
- React demo app with MetaMask registration and pre-registration similarity gate.
- Chrome MV3 extension with manual page scan and visual badges.
- Off-chain indexer (`/health`, `/sync`, `/match`) over Hamming distance.

[Unreleased]: https://github.com/Otroven/BlockShield-Extension/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Otroven/BlockShield-Extension/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Otroven/BlockShield-Extension/releases/tag/v1.0.0
