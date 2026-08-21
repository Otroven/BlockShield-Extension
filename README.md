# BlockShield Extension

BlockShield is a blockchain-assisted copyright protection project for image creators.
It combines on-chain originality registration with browser-side detection and an off-chain similarity indexer.

## Why this project exists

Digital creators increasingly face unauthorized reposting and slight image modifications (compression, crop, color tweaks).
Traditional legal protection is expensive and slow.

BlockShield aims to:

- let creators prove originality on-chain with tamper-resistant records,
- detect suspiciously similar images in real browsing contexts,
- prevent near-duplicate registrations before they are submitted.

## What is implemented

### 1) Smart Contract (`contract/original-content`)

- Registers canonical content with EIP-712 signatures.
- Supports `registerContentBundle` to link multiple fingerprints to one canonical content.
- Resolves linked fingerprints to canonical records for content and whitelist checks.
- Emits events for content registration and fingerprint linking.

### 2) Browser Extension (`extension`)

- Manual page scan mode to analyze images in the current tab.
- Computes fingerprint bundles (original + transformed variants).
- Verifies exact on-chain matches and page scope whitelist status.
- Queries indexer API for nearest similarity when exact match is absent.
- Shows badges such as original, suspicious, similar suspicious, and unregistered.

### 3) Frontend (`frontend`)

- Blog-like demo app for content posting and on-chain registration.
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

### 2) Deploy contract to local chain

```bash
npm run chain:deploy
```

Default local contract address:

- `0x5FbDB2315678afecb367f032d93F642f64180aa3`

### 3) Start indexer

```bash
npm run indexer:start
```

Optional overrides:

```bash
npm run indexer:start -- --contract-address 0xYourAddress --rpc-url http://127.0.0.1:8545 --port 8787
```

### 4) Run frontend

```bash
npm run frontend:dev
```

### 5) Load extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked from `extension`.
4. In popup, set:
   - Contract address
   - RPC URL
   - Indexer API URL (`http://127.0.0.1:8787`)

## Demo scenario (for judges)

1. Register original image with wallet A.
2. Try to register very similar image with wallet B.
3. Confirm frontend blocks registration by similarity gate.
4. Open pages with extension enabled and run manual page scan.
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

## Limitations

- Similarity matching depends on off-chain indexer availability.
- Current dispute handling for already-registered suspicious entries is policy/UI level, not on-chain arbitration.
- Local demo defaults are tuned for development, not production hardening.

## License

This repository is licensed under the MIT License. See `LICENSE`.
Third-party components keep their own licenses; see `THIRD_PARTY_NOTICES.md`.
