# Third-party notices

The root `LICENSE` covers original service-portal code. It does not relicense
third-party material.

## libredwg-web 0.7.9

Plan Check uses `@mlightcad/libredwg-web` 0.7.9, which is GPL-3.0 software. Its
generated JavaScript and WebAssembly files are bundled locally for the
non-production, browser-local DWG viewer and checker.

- bundled-file checksums, machine-readable provenance, and GPL text:
  [`js/vendor/libredwg/`](js/vendor/libredwg/);
- upstream project and corresponding release source:
  <https://github.com/mlightcad/libredwg-web/tree/v0.7.9>;
- tagged commit: `b70b5573a6bf2345e5fb10f2adff7fb74a8123c5`.

Users may select or drop local binary DWG files. The application reads those
bytes in browser memory and processes them in a disposable Web Worker; it does
not upload them to a service or store them in browser storage. The bundled BBL
reference drawing remains a deterministic regression fixture for the test suite.

The generated runtime and its corresponding source remain GPL-3.0 material;
the root MIT license does not relicense them. Anyone conveying or deploying
the runtime must preserve the GPL and notices and provide complete
corresponding source in a GPL-3.0-compliant manner. The tagged source, tarball,
artifact hashes, and local license copy are recorded in the vendor directory.

The checker is intended only for local, non-production parser and data-quality
testing. It does not create an authoritative plan version or professional
approval and must not be treated as a production records workflow.

## Adapted plan-check implementation

The Planprüfung normalisation, rule and viewer design adapts ideas from
`bbl-dres/plan-check` commit
`7320840a53dcd71859700fe4c90256cbdb6b01f3`, which is MIT licensed. Its retained
notice is [`js/plan-check/PLAN_CHECK_REFERENCE_LICENSE`](js/plan-check/PLAN_CHECK_REFERENCE_LICENSE),
and the adaptation record is [`js/plan-check/README.md`](js/plan-check/README.md).

## Other vendored or remotely loaded software

Other third-party libraries keep their own notices beside the relevant vendor
files or are loaded from their pinned upstream distributions. Those terms are
not replaced by the portal's MIT license. The technical review documents the
remaining runtime dependencies and release boundaries.
