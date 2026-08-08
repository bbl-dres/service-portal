# Plan Check implementation record

This folder adapts the drawing-normalization, geometry, validation and viewer
ideas from [`bbl-dres/plan-check`](https://github.com/bbl-dres/plan-check/tree/7320840a53dcd71859700fe4c90256cbdb6b01f3)
at commit `7320840a53dcd71859700fe4c90256cbdb6b01f3`. The source project is MIT licensed;
its copyright and permission notice are retained in
`PLAN_CHECK_REFERENCE_LICENSE`.

The portal adaptation is not a wholesale copy of the standalone application.
The prepared, currently unreachable checker replaces its global state, router,
translation layer, unscoped CSS and CDN exports with route-owned modules, a
disposable Web Worker, bounded pure normalization/rules, CD Bund components,
accessible controls and local report formats. The active route is
security-closed: it has no file control, constructs no parser, and requests no
Worker, vendor runtime, WASM or DWG bytes. The small local parser-client adapter
is statically imported but remains inert. If intake is eventually approved, raw
DWG bytes must remain in memory and must never be placed in a URL, browser
storage or an outbound request.

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

## Validation limits before enablement

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
- The dormant loading state has a visible in-place “Prüfung abbrechen” action
  with or without return context. It aborts the Worker request, preserves the
  selected file and metadata, restores the submit state, and moves focus to
  the restored submit action. The full enabled-route E2E must prove this
  contract with an approved runtime before intake is enabled.

The prepared result panels already use a consistent heading hierarchy, the
viewer actions are exposed as a named group, wheel zoom does not consume normal
page scrolling until the Canvas is focused (and never consumes Ctrl/Cmd wheel),
and progress/status changes have one live-announcement path. These contracts
remain covered with synthetic data while intake is closed.

The security-closed route test is not an enabled workflow test. Before changing
`PLAN_CHECK_INTAKE_ENABLED`, restore a full file-input/drop, controller,
progress/cancel, Worker, workbench, export, navigation-cleanup and failure-
recovery browser E2E around an approved runtime. The parser-only trusted golden
does not replace it.

The DWG parser candidate is separately licensed GPL-3.0 software. Version
0.7.9 was removed after a known decompressor vulnerability was confirmed in its
corresponding source, so the shipped route cannot accept files. Its rejected
checksums, source, license, security decision, and re-enable gate are recorded
under `../vendor/libredwg/`. See that directory before adding any parser binary.
Approval also requires a source build containing fix `3d0f9fc`, a pinned
candidate manifest and checksums, GPL/source-delivery approval, and a bounded
WASM maximum-memory configuration proven with adversarial decompression and
peak-memory tests. JavaScript result limits run after conversion and do not
bound decoder allocation.
