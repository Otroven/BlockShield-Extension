# Demo images

Fixtures for the local judge scenario. Register these from the frontend; do not hot-link them from a third-party site.

| File | Wallet | Role |
| --- | --- | --- |
| `original.png` | A | Register as the original |
| `compressed.png` | B | Same picture after palette compression (Hamming distance 15); blocked when threshold is 16 |

Use one origin for the whole demo (`http://localhost:5173` or `http://127.0.0.1:5173`, not mixed). After wallet A registers, wait until the indexer has synced (or `POST /sync`) before wallet B. Frontend `.env` and the extension default threshold are both `16`. Re-load the unpacked extension or use 초기화 if an older install still has threshold `10`.

These files are demo fixtures for this repository, not production artwork.
