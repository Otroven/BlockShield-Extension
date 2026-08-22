# Frontend (React + Vite)

BlockShield blog-like React frontend with:

- Public feed and post detail pages
- Author post create/edit pages
- Local persistence for quick testing
- pHash generation (`phash-js@0.3.0`, same pinned package as the extension)
- MetaMask + EIP-712 registration to `OriginalContent`

Vite copies `phash-js` dist files (`phash.js`, `magick.js`, `magick.wasm`) into `public/` on startup so hashing does not depend on a CDN.

## Run

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

If you use local anvil, copy env first:

```bash
cp .env.example .env
```

Used env values:

- `VITE_CONTRACT_ADDRESS`
- `VITE_CHAIN_ID`
- `VITE_RPC_URL`
- `VITE_INDEXER_URL`
- `VITE_SIMILARITY_THRESHOLD`

## Local testing storage strategy

For local-only development, this project stores data in browser `localStorage`:

- posts (current): `blockshield:react-posts:v2`

This is the fastest option for UI/flow testing before API/DB is ready.

### Reset local storage quickly

Open:

- `http://localhost:5173/feed?resetStorage=1`

This clears all `localStorage` keys that start with `blockshield:`.
