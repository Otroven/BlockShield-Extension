# BlockShield Browser Extension

Chrome Manifest V3 extension that inspects `<img>` elements on the current tab and shows a badge for originality status.

It does **not** crawl the web and it does not scan automatically. The user opens the popup and clicks **페이지 검사**. The intended demo target is the local BlockShield frontend (`http://localhost:5173`), not third-party sites.

## What it checks

For each image that is at least 32×32:

1. Compute a pHash of the displayed image with local `phash-js@0.3.0` (ImageMagick WASM bundled in the extension).
2. Also hash two variants generated in-page: horizontal flip, and a centered 85% crop.
3. Ask the background worker to verify those hashes:
   - exact match on `OriginalContent.getContent(bytes32)`
   - page host/path whitelist via `isScopeWhitelisted(bytes32,string)`
   - if no exact match, nearest neighbor from the indexer (`POST /match`) using Hamming distance
4. Draw a badge on the image. Hover shows creator address and, for similar hits, distance.

## Badge statuses

| Badge | Meaning |
| --- | --- |
| 검증 중 | Hash/RPC/indexer request in flight |
| 원본 확인 | On-chain record exists and the current page host or host/path is whitelisted |
| 등록 원본(미승인 스코프) | Record exists, but this page is not in the creator allow-list (`scopePolicy=neutral`) |
| 도용 의심 | Same as above when `scopePolicy=strict` (default) |
| 유사 도용 의심 | No exact hash, but indexer (or local cache) found a neighbor within the Hamming threshold |
| 미등록 | No on-chain or similar record |
| 검증 실패 | Fetch/canvas/pHash/RPC error (including CORS on foreign origins) |
| 건너뜀 | Missing `src` or image smaller than 32×32 |

Exact-match fingerprints are stored in `chrome.storage.local` as a small similarity cache (max 2000 entries) so a later scan can still compare if the indexer is down.

## Files

- `manifest.json`: MV3 permissions, content scripts, WASM worker assets
- `popup.html` / `src/popup.js` / `src/popup.css`: settings UI
- `src/content.js`: page scan, variant hashes, badges
- `src/background.js`: `eth_call` to the contract, indexer client, Hamming distance
- `src/phash-worker-shim.js`: rewrite ImageMagick worker URLs to `chrome.runtime.getURL(...)`

## Install (unpacked)

From the repository root:

```bash
npm --prefix extension install
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** and select the `extension` directory (the folder that contains `manifest.json`).
4. Keep the local chain, indexer, and frontend running. See the root README.

## Popup settings

| Field | Default | Role |
| --- | --- | --- |
| 검증 활성화 | on | If off, badges are cleared and scans no-op |
| 컨트랙트 주소 | Anvil default `0x5FbDB2315678afecb367f032d93F642f64180aa3` | `OriginalContent` |
| RPC URL | `http://127.0.0.1:8545` | `eth_call` endpoint |
| 인덱서 API URL | `http://127.0.0.1:8787` | Similarity API; leave empty to skip remote match |
| 스코프 불일치 표시 | 도용 의심 (`strict`) | `neutral` shows a softer “미승인 스코프” badge |
| 유사도 임계값 | `16` (0–64) | Max Hamming distance for “유사 도용 의심” (`samples/compressed.png` is distance 15 from `original.png`) |
| 저장 | — | Writes `chrome.storage.sync` and notifies open tabs |
| 페이지 검사 | — | Manual rescan of the active tab |
| 초기화 | — | Restore defaults and clear local similarity cache |

Settings live in `chrome.storage.sync`. The similarity cache lives in `chrome.storage.local` and is separate from the frontend `localStorage`.

## Local demo flow

1. Register an image on the frontend with wallet A (on-chain).
2. Open that post in the same origin and run **페이지 검사** → 원본 확인.
3. Open the same image on a path that is not whitelisted → 도용 의심 (or 미승인 스코프).
4. Register/block a near-duplicate with wallet B on the frontend (similarity gate).
5. Scan a flipped or cropped copy on a demo page → 유사 도용 의심 when distance ≤ threshold.

## Limits

- Manual scan only. New images after a scan are not watched until the next click.
- Same-origin images (the local Vite app) hash reliably. Cross-origin pixels may fail browser CORS / canvas taint checks.
- Similarity search needs the indexer process, unless a previous exact match already filled the local cache.
- pHash must stay on `phash-js@0.3.0`, matching the frontend pin, or registered hashes will not match scanned hashes.

## License

MIT. See the repository `LICENSE`.
