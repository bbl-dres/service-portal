# libredwg-web rejected-candidate record

The Plan Check implementation was developed and compatibility-tested against
`@mlightcad/libredwg-web` **0.7.9**, but that generated JavaScript/WASM runtime
is intentionally **not included or enabled** in this repository. The published
0.7.9 source predates LibreDWG security fix `3d0f9fc` for
[CVE-2026-15520 / GHSA-67vr-6jq3-273m](https://github.com/advisories/ghsa-67vr-6jq3-273m),
a heap-buffer-overflow write in the R2004 decompressor. Because Plan Check is an
untrusted-file boundary and supported DWG versions use that path, UI isolation,
a worker, a timeout, or file pre-screening is not an adequate mitigation.

- Project: <https://github.com/mlightcad/libredwg-web>
- Release tag: <https://github.com/mlightcad/libredwg-web/releases/tag/v0.7.9>
- Tagged commit: `b70b5573a6bf2345e5fb10f2adff7fb74a8123c5`
- npm package: <https://www.npmjs.com/package/@mlightcad/libredwg-web/v/0.7.9>
- npm tarball: <https://registry.npmjs.org/@mlightcad/libredwg-web/-/libredwg-web-0.7.9.tgz>
- npm integrity: `sha512-tqjx0eCiR0CNI3TyO3LVYzl4ptuzSFm7asGn/C1YiJaEk7Vneto+lRrVUco85qw+PZDihaFLwWqdYIEse1swbA==`
- Package-declared license: `GPL-3.0`

The source prototype used the single-file 0.6.6 CDN build. Version 0.7.9 was
evaluated because it has an official release tag and corresponding source,
retains the `LibreDwg.create()` / `dwg_read_data()` / `convertEx()` /
`dwg_free()` API used by the adapter, and separates the module entry from its
WASM payload. Before the security finding, the official BBL reference drawing
successfully produced the pinned version/entity/layer/primitive/rule counts.
That compatibility result does not make the vulnerable binary releasable.

`CHECKSUMS.sha256` records the rejected files so they can be recognized during
review; the files themselves are absent. The npm archive omits a license file,
so `LICENSE` is the unmodified `COPYING` from the corresponding source tag. It
is retained as a provenance notice, not as evidence that a runtime is present.

Do not restore 0.7.9 or copy its files from another checkout. Re-enabling file
intake requires all of the following: a pinned browser build whose corresponding
LibreDWG source contains upstream fix
[`3d0f9fc`](https://github.com/LibreDWG/libredwg/commit/3d0f9fc2eddbd6579c99af3111c37c98f03475d0),
legal approval of its license and source-delivery obligations, replacement
checksums/provenance, a bounded WASM maximum-memory policy plus adversarial
decompression/peak-memory measurement (the JavaScript result budgets apply only
after conversion), malformed-input and fresh-runtime recovery tests, the trusted
BBL golden, privacy assertions, and the full Plan Check browser suite. An
approved isolated parsing service is the alternative when browser memory cannot
be bounded adequately.

The quarantined browser golden also requires a reviewed
`APPROVED-CANDIDATE.json` before it will start a Worker. That manifest is
intentionally absent today. A future manifest must identify the corresponding
source URL/commit, attest the exact upstream fix commit, record the reproducible
build recipe and license, and pin all three generated-file SHA-256 values. The
test refuses the known 0.7.9 fingerprints before loading any parser code. The
full opt-in upload/controller/workbench E2E must be restored as a separate gate
before changing `PLAN_CHECK_INTAKE_ENABLED`; the closed-route test does not
exercise those dormant interactions.
Upgrades must be explicit vendor changes, never a `latest` URL.
