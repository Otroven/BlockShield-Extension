# Frontend (React + Vite)

BlockShield blog-like React frontend with:

- Public feed and post detail pages
- Author post create/edit pages
- Local persistence for quick testing
- pHash generation (`phash-js`)
- MetaMask + EIP-712 registration to `OriginalContent`

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

## Local testing storage strategy

For local-only development, this project stores data in browser `localStorage`:

- posts: `blockshield:react-posts:v1`
- profile: `blockshield:react-profile:v1`
- web3 settings: `blockshield:web3-settings:v2`

This is the fastest option for UI/flow testing before API/DB is ready.
