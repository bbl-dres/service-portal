# libredwg-web artifact and provenance record

Plan Check bundles `@mlightcad/libredwg-web` **0.7.9** for local,
non-production DWG viewing, parser compatibility checks, completeness
diagnostics, and technical rules. Users may select or drop local binary DWG
files. The application reads those files into browser memory and processes
them in a disposable module Worker; no DWG bytes are uploaded to a service,
written to a URL, or stored in browser storage.

The parser client requires a `.dwg` name, a non-empty safe-integer size no
greater than 50 MiB, an exact post-read byte count, and a valid `AC10xx` header.
The Worker repeats the byte-count and header checks before importing the local
JavaScript/WebAssembly engine. A fresh Worker is created for each parse and is
terminated after result, failure, cancellation, or timeout. The bundled BBL
reference drawing is a deterministic regression fixture for the test suite;
it is not the route's user input.

## Artifact provenance

- Project: <https://github.com/mlightcad/libredwg-web>
- Release: `0.7.9`
- Release tag: <https://github.com/mlightcad/libredwg-web/releases/tag/v0.7.9>
- Tagged commit and corresponding source:
  <https://github.com/mlightcad/libredwg-web/tree/b70b5573a6bf2345e5fb10f2adff7fb74a8123c5>
- npm tarball:
  <https://registry.npmjs.org/@mlightcad/libredwg-web/-/libredwg-web-0.7.9.tgz>
- npm integrity:
  `sha512-tqjx0eCiR0CNI3TyO3LVYzl4ptuzSFm7asGn/C1YiJaEk7Vneto+lRrVUco85qw+PZDihaFLwWqdYIEse1swbA==`
- Tarball SHA-256:
  `ab965aec46d03d5c8cb646a8d220a806cd1a04a9c46be1ad1993e1da35d33364`
- Package-declared license: `GPL-3.0`

The three runtime artifacts were restored without network access from the
integrity-addressed npm tarball already present in the local npm cache. Their
hashes exactly match the earlier audit record in `CHECKSUMS.sha256`.
`RUNTIME-MANIFEST.json` is the machine-readable package, source, npm, and
artifact record. The npm archive omits a license file, so `LICENSE` is the
unmodified `COPYING` from the corresponding source tag.

The generated runtime and its corresponding source are GPL-3.0 material. The
portal's root MIT license does not relicense them. Anyone conveying or deploying
these files must preserve the GPL and notices and make complete corresponding
source available in a GPL-3.0-compliant manner. The tagged commit above is the
recorded corresponding-source location; verify that the chosen distribution
method fulfils the source-delivery obligation before publishing a copy.

## Scope

This browser integration is a non-production test tool, not an authoritative
plan-ingestion, approval, or records system. A future production implementation
would require a separately approved parser deployment and licensing model,
authenticated intake, server-side validation, persistence, audit, and
operational controls.

Upgrades must be explicit vendor changes, never a `latest` URL.
