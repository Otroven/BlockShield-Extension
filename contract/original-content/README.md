# OriginalContent

Foundry workspace for the BlockShield originality registry.

The contract stores a perceptual hash (`pHash`) with the creator address, a timestamp, and URL scopes the creator allows. Registration uses an EIP-712 signature from that creator. The browser extension and indexer read these records; they do not write them.

## What is on-chain

- `pHash`: 32-byte fingerprint of the registered image
- `creator`: signer who registered it
- `createdAt`: block timestamp
- `isActive`: stored as `true` on register (no deactivate path yet)
- whitelist scopes: host or `host/path` strings the creator authorizes

There is no on-chain similarity search. Near-duplicate checks run off-chain in the indexer.

## Main functions

| Function | Role |
| --- | --- |
| `registerContent` | EIP-712 signed registration of one `pHash` and initial scopes |
| `updateWhitelist` | creator adds or removes a scope |
| `getContent` | returns the record or reverts if missing |
| `isScopeWhitelisted` | checks whether a page scope is allowed |
| `nonces` | per-creator EIP-712 nonce |

Scopes are normalized on-chain (lowercase, trimmed host/path). Invalid formats revert.

## Layout

- `src/IOriginalContent.sol`: events, errors, `ContentRecord`, interface
- `src/OriginalContent.sol`: implementation
- `script/DeployOriginalContent.s.sol`: local/script deploy
- `test/unit/OriginalContentUnitTest.t.sol`: unit tests

## Prerequisites

[Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `anvil`).

From this directory:

```bash
forge build
forge test
forge fmt
```

## Local deploy

From the **repository root** (starts Anvil if needed):

```bash
npm run chain:deploy
```

Default local address after a fresh Anvil deploy:

- `0x5FbDB2315678afecb367f032d93F642f64180aa3`

From this directory, against an already running node:

```bash
forge script script/DeployOriginalContent.s.sol:DeployOriginalContent \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key <anvil-key>
```

## License

MIT. See the repository `LICENSE`.
This workspace vendors `forge-std` under `lib/forge-std` (Apache-2.0 / MIT).
