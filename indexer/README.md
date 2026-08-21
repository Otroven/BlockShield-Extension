# BlockShield Indexer (MVP)

This service indexes `OriginalContent` contract events and exposes a simple API for nearest fingerprint matching.

## 1) Install

```bash
npm --prefix indexer install
```

## 2) Run

```bash
# One command (recommended)
npm run indexer:start

# Optional overrides
npm run indexer:start -- --contract-address 0xYourContractAddress --rpc-url http://127.0.0.1:8545
npm run indexer:start -- --port 8787
```

## 3) API

- `GET /health`
  - Returns sync state and indexed fingerprint count

- `POST /sync`
  - Manually trigger sync from chain

- `POST /match`
  - Request body:
    - `fingerprints: string[]` (`bytes32` hex values)
    - `threshold: number` (`0~64`)
  - Returns nearest match within threshold (or `null`)

## Notes

- Indexed data is stored in `indexer/data/index.json`.
- Service syncs on startup and repeats every `SYNC_INTERVAL_MS` (default `15000`).
- In extension popup, set `인덱서 API URL` to `http://127.0.0.1:8787`.
