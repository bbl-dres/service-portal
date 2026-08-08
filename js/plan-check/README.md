# Plan Check implementation record

This folder adapts the drawing-normalization, geometry, validation and viewer
ideas from [`bbl-dres/plan-check`](https://github.com/bbl-dres/plan-check/tree/7320840a53dcd71859700fe4c90256cbdb6b01f3)
at commit `7320840a53dcd71859700fe4c90256cbdb6b01f3`. The source project is MIT licensed;
its copyright and permission notice are retained in
`PLAN_CHECK_REFERENCE_LICENSE`.

The portal adaptation is not a wholesale copy of the standalone application.
It replaces the reference application's global state, router, translation
layer, unscoped CSS and CDN exports with route-owned modules, a disposable Web
Worker, bounded pure normalization/rules, CD Bund components, accessible
controls and local report formats.

The active route accepts caller-selected local binary DWG files for
non-production parser, completeness, and rule testing. A file picker and drop
target pass the selected `File` to the parser-client `parse(file)` API. The
client requires a `.dwg` name, a non-empty safe-integer size no greater than
50 MiB, an exact post-read byte count, and a valid `AC10xx` header. The Worker
repeats the byte-count and header checks before importing the locally bundled
engine. Raw bytes remain in memory and are never placed in a URL, browser
storage, or an outbound request. The repository-owned
`CAD.V01-CAFM-Plan-DE.dwg` remains a deterministic test golden, not an input
restriction or a user-facing sample action.

## Normalization limits

Nested block references are composed as affine transforms. Points, straight
segments and polygon vertices therefore retain their exact placement under
rotation, mirroring and non-uniform scale. A transformed circle is emitted as
an ellipse, while non-uniformly transformed arcs and bulged polyline segments
are converted to bounded straight-segment approximations (at most 64 segments
per source arc). The diagnostics counters `approximatedNonUniformArcs` and
`approximatedNonUniformPolylines` expose those conversions.

The renderer's text primitive stores only an anchor, height and rotation. It
cannot encode horizontal stretch, shear or mirrored glyph outlines, nor can a
single scalar polyline width encode direction-dependent width after a
non-uniform transform. Anchors, baselines and text height are transformed, but
the remaining glyph/width distortion is intentionally approximate;
`approximatedNonUniformText` records affected text instances. Exact rendering
of those cases would require extending the renderer primitive model.

Normalization currently bounds cyclic/deep `INSERT` expansion and records
unknown or unsupported entities. A skipped cyclic, depth-limited, malformed or
unresolved block branch, a non-renderable/unsupported/invisible entity, invalid
or out-of-range geometry, truncated STYLE/LAYOUT/HATCH/DIMENSION metadata, or a
converter-reported unknown entity produces a structured
`completeness.status = "incomplete"` result. Findings observed in the supported
subset remain in the diagnostic error list, but every canonical rule is
`not-evaluated` and the overall score is `null`; a partial drawing can never
receive a normal score. XREF validation instead preserves a sticky aggregate
count alongside its bounded diagnostic sample, so entries after the sample
limit cannot evade the rule. The UI, CSV and JSON reports expose completeness
instead of presenting an ordinary quality score. Hard expansion, primitive and
vertex output limits throw `RESOURCE_LIMIT`, so no partial result is returned.

## Validation and prototype limits

- The source contract does not provide an authoritative SIA use-category
  mapping. Room polygon area is reported separately; HNF, NNF, VF, FF, NF, NGF
  and KF remain unavailable until every room has an authoritative category.
  Categories must not be inferred from layer names or defaulted to HNF.
- `DIM_002` is deliberately `not-evaluated`. Group code 70 describes the
  dimension type, not associativity; the check needs actual `DIMASSOC` object
  linkage before it can pass or fail.
- AOID associations retain every normalized `R_AOID` text occurrence rather
  than only the room's chosen display label. `AOID_002` therefore detects one
  identifier associated with multiple distinct room polygons, while duplicate
  texts inside one polygon remain the separate `AOID_004` finding. `AOID_006`
  is evaluated only for aligned TEXT/ATTRIB sources that provide distinct
  insertion and alignment points; without that source evidence the rule is
  explicitly `not-evaluated`.
- The loading state has a visible in-place “Prüfung abbrechen” action
  with or without return context. It aborts the Worker request, preserves the
  context metadata, restores file selection, and returns focus to the upload
  control.

The active result panels use a consistent heading hierarchy, the
viewer actions are exposed as a named group, wheel zoom does not consume normal
page scrolling until the Canvas is focused (and never consumes Ctrl/Cmd wheel),
and progress/status changes have one live-announcement path. These contracts
are covered by the upload browser workflow, the deterministic fixture golden,
and synthetic core tests.

The route test exercises file selection and drop, validation failures, the
result workbench, exports, retry, cleanup, skins, and reflow. The parser golden
independently pins artifact and fixture hashes, verifies the real 0.7.9 result,
and asserts zero external requests. `PLAN_CHECK_INTAKE_ENABLED=true` is the
explicit contract for this browser-local testing tool.

The bundled DWG parser is separately licensed GPL-3.0 software. Exact artifact
hashes, source, license, and package provenance are recorded under
`../vendor/libredwg/`. The portal's MIT license does not relicense those files,
and anyone conveying them must satisfy the GPL-3.0
complete-corresponding-source obligations.

The checker remains a non-production test tool. Its browser result is not a
legal, professional, plan-approval, or records-system decision, and JavaScript
result limits do not turn the local workflow into an authoritative ingestion
service. A future production design still needs authenticated upload,
server-side validation, immutable plan/result versions, roles, audit, retention,
and an approved parser deployment and licensing model.
