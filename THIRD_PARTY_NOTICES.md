# Third-party notices

The root `LICENSE` covers original service-portal code. It does not relicense
third-party material.

## libredwg-web 0.7.9

Plan Check was compatibility-tested against `@mlightcad/libredwg-web` 0.7.9,
which is GPL-3.0 software. The generated JavaScript and WebAssembly files are
not included: the candidate was rejected after its corresponding source was
found to predate the fix for CVE-2026-15520 / GHSA-67vr-6jq3-273m.

- rejected-file checksums, GPL text, security decision and re-enable criteria:
  [`js/vendor/libredwg/`](js/vendor/libredwg/);
- upstream project and corresponding release source:
  <https://github.com/mlightcad/libredwg-web/tree/v0.7.9>;
- tagged commit: `b70b5573a6bf2345e5fb10f2adff7fb74a8123c5`.

The local vendor record explains why 0.7.9 was evaluated instead of the
reference prototype's 0.6.6 CDN bundle and why it was then removed. Plan Check
file intake stays disabled until a fixed, pinned browser build is available and
the repository owner approves its licensing and corresponding-source process.
No parser runtime or `APPROVED-CANDIDATE.json` exists in the current tree.

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
