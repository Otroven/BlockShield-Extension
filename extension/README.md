# BlockShield Browser Extension (MVP)

This extension scans images on the current web page and adds a badge:

- `original`: image hash exists on-chain and current page scope is whitelisted
- `suspected unauthorized use`: image hash exists on-chain but current page scope is not whitelisted
- `not registered`: no on-chain record for this image hash

## What it does

1. Detects `<img>` elements on the page.
2. Computes a perceptual hash (pHash) for each image.
3. Calls the `OriginalContent` contract:
   - `getContent(bytes32)` to check existence
   - `isScopeWhitelisted(bytes32,string)` for page scope and host scope
4. Renders an overlay badge per image.

## Install (unpacked)

1. Run `npm install` inside the `extension` directory.
2. Open `chrome://extensions` (or Edge extensions page).
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension` directory.

## Configure

Open the extension popup:

- `Contract address`: deployed `OriginalContent` contract
- `RPC URL`: JSON-RPC endpoint
- `Enable scanning`: on/off
- `Page scan`: manually run scanning for the current page

## Notes

- This is an MVP for hackathon/demo workflow.
- Hashing uses local `phash-js` runtime loaded from extension dependencies.
