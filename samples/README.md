# Demo images

Fixtures for the local judge scenario. Register these from the frontend; do not hot-link them from a third-party site.

| File | Wallet | Role |
| --- | --- | --- |
| `original.png` | A | Register as the original |
| `compressed.png` | B | Same picture after compression; the similarity gate should block |

Use one origin for the whole demo (`http://localhost:5173` or `http://127.0.0.1:5173`, not mixed). After wallet A registers, wait until the indexer has synced (or `POST /sync`) before wallet B.

These files are demo fixtures for this repository, not production artwork.
