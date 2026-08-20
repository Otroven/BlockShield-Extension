# BlockShield Browser Extension (MVP)

This extension scans images on the current web page and adds a badge:

- `original`: image hash exists on-chain and current page scope is whitelisted
- `potential infringement`: image hash exists on-chain but current page scope is not whitelisted
- `not registered`: no on-chain record for this image hash

## What it does

1. Detects `<img>` elements on the page.
2. Computes a perceptual hash (aHash, 8x8) for each image.
3. Calls the `OriginalContent` contract:
   - `getContent(bytes32)` to check existence
   - `isScopeWhitelisted(bytes32,string)` for page scope and host scope
4. Renders an overlay badge per image.

## Install (unpacked)

1. Open `chrome://extensions` (or Edge extensions page).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` directory.

## Configure

Open the extension popup:

- `Contract address`: deployed `OriginalContent` contract
- `RPC URL`: JSON-RPC endpoint
- `Enable scanning`: on/off
- `Rescan tab`: manually re-run scanning

## Notes

- This is an MVP for hackathon/demo workflow.
- Hashing method here is local aHash implementation in the extension.
  If your dApp registration flow uses a different pHash algorithm, hashes may not match.
  For production, use the exact same hash pipeline across dApp and extension.
