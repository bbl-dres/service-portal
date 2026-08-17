# Map glyph provenance

The two PBF files in this directory are the only glyph ranges currently used by
the portal's MapLibre style. They cover Unicode code points 0–255 for cluster
counts and the ASCII/Latin identifiers displayed beside property points.

Source: [`maplibre/demotiles`](https://github.com/maplibre/demotiles) at commit
[`ef4389e954d46e97cd9d3b0130881d9fb789ae2e`](https://github.com/maplibre/demotiles/tree/ef4389e954d46e97cd9d3b0130881d9fb789ae2e/font).
The MapLibre repository states that its PBFs were generated from the scripts and
source fonts in [`openmaptiles/fonts`](https://github.com/openmaptiles/fonts).
The Noto Sans source license was captured from commit
[`d48c5fce2fc58b55c98d353558d807cac45e7262`](https://github.com/openmaptiles/fonts/tree/d48c5fce2fc58b55c98d353558d807cac45e7262/noto-sans).

Licenses:

- `LICENSE-maplibre-demotiles.txt`: BSD 3-Clause license for the upstream asset repository.
- `LICENSE-Noto-Sans.txt`: SIL Open Font License 1.1 for Noto Sans.

SHA-256:

| File | SHA-256 |
| --- | --- |
| `Noto Sans Bold/0-255.pbf` | `f60ce4cb899455c2203bd8293b550394ade53ffce8032bf9cc7f59255e49259c` |
| `Noto Sans Regular/0-255.pbf` | `ef1f38a3f1978591e846e9eaddf8a54f7047f546fc6aaed7872cc53151a5de78` |

Do not replace these files from a moving branch or public tile endpoint. Pin the
upstream commit, update this provenance record and hashes, and rerun the focused
map and development-server tests.
