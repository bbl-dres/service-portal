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

## Bundled MapLibre glyphs (Noto Sans)

MapLibre labels use the bundled `Noto Sans Regular` and `Noto Sans Bold`
`0-255.pbf` ranges below [`assets/map-glyphs/`](assets/map-glyphs/). The files
were obtained from `maplibre/demotiles` commit
`ef4389e954d46e97cd9d3b0130881d9fb789ae2e` (BSD-3-Clause); that project records
the glyphs as generated from `openmaptiles/fonts`, whose Noto Sans source at
commit `d48c5fce2fc58b55c98d353558d807cac45e7262` is under the SIL Open Font
License 1.1.

The local asset manifest records the exact upstream links and SHA-256 hashes.
The directory also contains the complete
[demotiles BSD notice](assets/map-glyphs/LICENSE-maplibre-demotiles.txt) and
[Noto Sans OFL text](assets/map-glyphs/LICENSE-Noto-Sans.txt). The portal's root
MIT license does not replace either license.

## Report generators (jsPDF, jsPDF-AutoTable, SheetJS)

The Planprüfung PDF and Excel Prüfberichte are generated in the browser by three
libraries, loaded from `unpkg.com` only when a report is requested, over HTTPS
with SHA-384 Subresource Integrity, anonymous CORS and a no-referrer policy:

- [jsPDF](https://github.com/parallax/jsPDF/tree/v2.5.2) 2.5.2 — MIT;
- [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable/tree/v3.8.4) 3.8.4 — MIT;
- [SheetJS Community Edition](https://github.com/SheetJS/sheetjs/tree/v0.18.5) 0.18.5 — Apache-2.0.

The selected DWG is never sent to those hosts or to any other service: the file
is parsed locally, and the generators only receive the finished check result and
a raster snapshot of the plan that the browser has already drawn. A report can
therefore only be produced while the browser can reach the CDN; the local CSV
and JSON exports stay dependency-free and always available.

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
