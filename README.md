# verify.maczo.co — maczo Provably-Fair Verifiers

The GitHub Pages host for **https://verify.maczo.co/**. It serves every maczo provably-fair verifier
under one domain:

| Path | Product | Engine |
|---|---|---|
| `/` | 🎡 Lucky Spin | 8-byte `uint64` words + rejection sampling |
| `/originals/` | 🎲 Originals (Dice, Mines, Plinko … 47 games) | 4-byte `uint32` words |

Each verifier is fully **offline / zero-dependency** — open the HTML, view source, nothing is sent
anywhere. The two products use **different** crypto engines (above); they share only this host, the
domain, and a common top-nav. Each keeps its own algorithm + resolvers.

## Assembled from the canonical sources (no drift)
- `/` (Lucky Spin) ← <https://github.com/maczo-co/lucky-spin>
- `/originals/` ← the shared engine <https://github.com/maczo-co/originals-verify> + the 47
  `https://github.com/maczo-co/originals-<game>` repos, built by `tools/verifier/build.py` in the
  Originals repo and assembled here by `tools/verifier/assemble_verify.py`.

Re-assemble: `gh repo clone maczo-co/lucky-spin <ls>` → `python tools/verifier/assemble_verify.py <ls> <out>`.

MIT © 2026 maczo
