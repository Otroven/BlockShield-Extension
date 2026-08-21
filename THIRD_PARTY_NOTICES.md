# Third-Party Notices

This project includes or depends on third-party open source components.
Those components remain under their respective licenses.
The top-level BlockShield source is MIT (`LICENSE`).

This file is the inventory for redistribution and license review.
Do not treat `node_modules/` or generated `magick.wasm` copies as the source of truth;
install from the lockfiles listed below.

## Direct runtime dependencies

| Component | Used in | License | Upstream |
| --- | --- | --- | --- |
| `ethers` | frontend, indexer | MIT | https://github.com/ethers-io/ethers.js |
| `phash-js` `0.3.0` | frontend, extension | MIT | https://www.npmjs.com/package/phash-js |
| `react` / `react-dom` | frontend | MIT | https://github.com/facebook/react |
| `react-router-dom` | frontend | MIT | https://github.com/remix-run/react-router |

Pin and hashes: `frontend/package-lock.json`, `extension/package-lock.json`, `indexer/package-lock.json`.

## Bundled with `phash-js` (image hashing)

`phash-js` hashes images in the browser via ImageMagick compiled to WebAssembly.
Vite copies those files into `frontend/public/` at dev/build time (gitignored).
The unpacked Chrome extension loads them from `extension/node_modules/phash-js/dist/`.

| Component | Files | License | Upstream |
| --- | --- | --- | --- |
| `wasm-imagemagick` | `magick.js`, `magick.wasm` | Apache-2.0 | https://github.com/KnicKnic/WASM-ImageMagick |
| ImageMagick | compiled into the WASM above | ImageMagick License (Apache-2.0-based) | https://imagemagick.org/script/license.php |

`wasm-imagemagick` is a third-party WASM rebuild and is not affiliated with the ImageMagick project.

## Vendored contract tooling

| Component | Path | License |
| --- | --- | --- |
| `forge-std` | `contract/original-content/lib/forge-std` | Apache-2.0 OR MIT |

License texts: `contract/original-content/lib/forge-std/LICENSE-APACHE` and `LICENSE-MIT`.

OpenZeppelin Contracts are **not** a dependency. `OriginalContent` does not import them.
Do not add `contract/original-content/lib/openzeppelin-contracts` to git or to a source archive.

## Development-only (not shipped in the extension package)

| Component | Used in | License |
| --- | --- | --- |
| `vite` | frontend build | MIT |
| `@vitejs/plugin-react` | frontend build | MIT |

Transitive npm packages keep the licenses recorded in each `package-lock.json`.
Common examples: `@noble/curves` / `@noble/hashes` (MIT, via ethers), `esbuild` (MIT, via Vite).

## What not to submit or commit

These are local install/build artifacts, not project source:

- `**/node_modules/`
- `frontend/dist/`
- `frontend/public/phash.js`, `magick.js`, `magick.wasm`
- `indexer/data/index.json`
- `contract/*/cache`, `contract/*/out`, `contract/*/broadcast`
- leftover `lib/openzeppelin-contracts` trees

## Notes

- Keep this file in any zip or tarball sent for license review.
- If you redistribute a packaged extension or frontend build, include this file and the MIT `LICENSE`.
- Apache-2.0 components (`wasm-imagemagick`, optional `forge-std` Apache choice) require retaining their notices; this file plus the vendored `forge-std` license files satisfy that for the source tree.
