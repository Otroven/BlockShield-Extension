# BlockShield-Extension
Real-time web digital copyright protection &amp; forgery detection extension using pHash and Blockchain

## Root Scripts

Run commands from the project root:

- `npm run chain:deploy`
  - Starts `anvil` automatically if not already running on `127.0.0.1:8545`
  - Deploys `OriginalContent` using Foundry script
  - Works on Windows/macOS/Linux (Node.js script)
  - Uses `RPC_URL` env var if set, otherwise defaults to `http://127.0.0.1:8545`
  - Uses `ANVIL_PRIVATE_KEY` env var if set, otherwise uses Anvil default first account key

- `npm run frontend:dev`
  - Runs `frontend` Vite dev server from root

- `npm run indexer:dev`
  - Runs the local similarity indexer API server
  - Requires `CONTRACT_ADDRESS` env var
  - Optional env vars: `RPC_URL` (default `http://127.0.0.1:8545`), `PORT` (default `8787`)

- `npm run indexer:start`
  - One-command indexer start with defaults
  - Defaults:
    - `CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3`
    - `RPC_URL=http://127.0.0.1:8545`
  - Override examples:
    - `npm run indexer:start -- --contract-address 0xYourAddress --rpc-url http://127.0.0.1:8545`
    - `npm run indexer:start -- --port 8787`
