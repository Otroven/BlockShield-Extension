# BlockShield Extension

BlockShield is a blockchain-assisted copyright protection project for image creators.
It combines on-chain originality registration with browser-side detection and an off-chain similarity indexer.

## Why this project exists

Digital creators increasingly face unauthorized reposting and slight image modifications (compression, crop, flip).
Traditional legal protection is expensive and slow.

BlockShield aims to:

- let creators prove originality on-chain with tamper-resistant records,
- let users scan the current page and mark registered, unauthorized, or similar images,
- prevent near-duplicate registrations before they are submitted.

## What is different

This is not an NFT mint, not reverse-image search, and not a legal copyright registry.

- The chain stores a **first claim**: who registered this pHash, when, and which page scopes they allow.
- The same image on a URL outside that list is **unauthorized placement**, not a new original.
- Near-duplicate registrations from another wallet are **not signed**: the frontend queries the off-chain Hamming-distance index and skips EIP-712 signing. The contract still only rejects an **identical** pHash.
- The extension does not crawl the web. It hashes the current tab on a **manual scan** (plus flip and crop variants) and reads those records.

## What is implemented

### 1) Smart Contract (`contract/original-content`)

- Registers a single pHash with EIP-712 signatures.
- Stores creator, timestamp, and allowed URL scopes on-chain.
- Emits events for content registration and whitelist updates.

### 2) Browser Extension (`extension`)

- Manual page scan mode to analyze images in the current tab.
- Computes the page image pHash plus flip and crop variants for comparison.
- Verifies exact on-chain matches and page scope whitelist status.
- Queries indexer API for nearest similarity when exact match is absent.
- Shows badges such as original, suspicious, similar suspicious, and unregistered.

### 3) Frontend (`frontend`)

- Blog-like demo app for content posting and on-chain registration.
- Same pinned `phash-js@0.3.0` as the extension (bundled locally, not CDN).
- MetaMask + EIP-712 flow for originality registration.
- Pre-registration similarity gate:
  - checks indexer candidates before on-chain write,
  - blocks submission if an earlier similar record belongs to another creator.

### 4) Indexer API (`indexer`)

- Syncs on-chain events to local index storage.
- Exposes:
  - `GET /health`
  - `POST /sync`
  - `POST /match`
- Handles common local reset scenarios (e.g. Anvil chain rollback/reset).

## Repository structure

- `contract/original-content`: Foundry smart contract workspace
- `frontend`: React + Vite app
- `extension`: Chrome extension (MV3)
- `indexer`: Node.js similarity indexer API
- `scripts`: root helper scripts for local run/deploy

See `CONTRIBUTING.md` for local setup and pull-request notes.

## Quick start (local demo)

### Prerequisites

- Node.js 20+
- Foundry (`forge`, `anvil`)
- MetaMask (for frontend flow)

### 1) Install dependencies

From project root:

```bash
npm --prefix frontend install
npm --prefix extension install
npm --prefix indexer install
```

### 2) Start the local stack

One terminal starts Anvil (if needed), deploys the contract, starts the indexer, and runs the frontend:

```bash
npm run dev:start
```

Default local contract address: `0x5FbDB2315678afecb367f032d93F642f64180aa3`.

To run pieces separately: `npm run chain:deploy`, `npm run indexer:start`, `npm run frontend:dev`.

### 3) Load extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked from `extension`.
4. In popup, set:
   - Contract address
   - RPC URL
   - Indexer API URL (`http://127.0.0.1:8787`)

## Demo scenario (for judges)

Sample images are in [`samples/`](./samples): `original.png` (wallet A) and `compressed.png` (wallet B, Hamming distance 15). Frontend `.env` and the extension default similarity threshold are `16`. Stay on one origin (`http://localhost:5173` or `http://127.0.0.1:5173`, not mixed). After wallet A registers, wait for the indexer sync (or `POST http://127.0.0.1:8787/sync`) before wallet B. If the extension was installed earlier, set the popup threshold to 16 or use 초기화.

1. Register `samples/original.png` with wallet A.
2. Try to register `samples/compressed.png` with wallet B.
3. Confirm frontend blocks registration by similarity gate.
4. Open the wallet A post with the extension and run a manual page scan.
5. Confirm badge/tooltip output for exact and similar cases.

## Full reset workflow

When local development state gets messy (chain restart, stale index, old dev servers), run:

```bash
npm run dev:restart
```

What this does:

- kills existing local dev processes on ports `5173`, `8787`, `8545`,
- removes `indexer/data/index.json`,
- redeploys contract (`chain:deploy`),
- starts indexer again,
- starts frontend dev server.

## Browser storage reset

### Frontend localStorage reset

Frontend demo data is persisted in browser `localStorage`.
You can clear BlockShield keys with:

- `http://localhost:5173/feed?resetStorage=1`

It removes keys starting with `blockshield:` and then clears the query parameter.

### Extension storage note

The extension uses `chrome.storage` (sync/local), which is separate from frontend `localStorage`.
If you need full extension reset, use:

- Extension popup values reset manually, or
- remove and re-load the unpacked extension.

## Root scripts

Run commands from project root:

- `npm run dev:start`
  - one-command local stack: Anvil + contract deploy + indexer + Vite frontend.
- `npm run chain:deploy`
  - starts `anvil` if needed,
  - deploys `OriginalContent` via Foundry script.
- `npm run frontend:dev`
  - starts frontend Vite dev server.
- `npm run indexer:dev`
  - runs indexer with explicit env vars.
- `npm run indexer:start`
  - one-command indexer start with local defaults.
- `npm run dev:restart`
  - full local reset + restart flow for chain/indexer/frontend.
- `npm run dev:stop`
  - stop Anvil, indexer, and the Vite frontend (ports `8545`, `8787`, `5173`).

## Limitations

- Page checks run only when the user starts a manual scan in the extension popup.
- Similarity matching depends on off-chain indexer availability.
- Cross-origin images can fail hashing when the browser blocks pixel access (CORS / canvas taint).
- Current dispute handling for already-registered suspicious entries is policy/UI level, not on-chain arbitration.
- Local demo defaults are tuned for development, not production hardening.

## License

This repository is licensed under the MIT License. See `LICENSE`.
Third-party components keep their own licenses; see `THIRD_PARTY_NOTICES.md`.
The current project version is in `VERSION`; release notes are in `CHANGELOG.md`.
GitHub Actions checks those stay in sync, and a `v*` tag creates a GitHub Release from the matching changelog section. See `CONTRIBUTING.md`.
