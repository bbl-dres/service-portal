# Plan-check reference fixture

`CAD.V01-CAFM-Plan-DE.dwg` is the BBL CAD.V01 reference drawing copied from
`bbl-dres/plan-check` at commit
`7320840a53dcd71859700fe4c90256cbdb6b01f3`.

- Source path: <https://github.com/bbl-dres/plan-check/blob/7320840a53dcd71859700fe4c90256cbdb6b01f3/assets/test-files/CAD.V01-CAFM-Plan-DE.dwg>
- Source repository license: MIT (`LICENSE` at the same commit); no separate
  asset-specific license or restriction accompanies this reference file.

- Size: `381509` bytes
- SHA-256: `e69f34d37ed6a7c7223457a7478a534ecbfd4cac556ef693cb8060129299e0a9`
- DWG header: `AC1032`

It is retained as the deterministic browser-parser and end-to-end regression
fixture. Its size, header, and SHA-256 pin the expected golden input. Plan Check
users select or drop their own local binary DWG test files; those files are
processed in browser memory and never replace or modify this repository fixture.

This is the only fixture redistributed from the source project. Its second DWG,
`2011-DM-0-A04-6A1.dwg`, has no documented origin or asset-specific permission,
so it is intentionally excluded until its provenance is cleared.
