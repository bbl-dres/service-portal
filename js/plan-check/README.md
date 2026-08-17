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
`completeness.status = "incomplete"` result. That state is reported as its own
`INCOMPLETE_001` warning beside the results; it no longer suppresses them.
Nearly every production DWG contains a few entities the parser cannot render
(proxy objects, OLE frames, unsupported types), and treating that as "nothing
was checked" made the checker unusable on real files. Every rule that can be
evaluated is evaluated and scored; the UI, PDF and Excel reports
carry the score and the completeness note together. XREF validation preserves a
sticky aggregate count alongside its bounded diagnostic sample, so entries after
the sample limit cannot evade the rule.

There is no size ceiling. Entity, layer, block, primitive, vertex, operation and
result-transfer limits are all `Infinity` in `config.js`, and no code path
refuses a drawing for being large; the browser's own memory is the only bound,
and exceeding it surfaces as an ordinary parser failure. Remaining finite bounds
shape what a *report* shows (handle lists, metadata entries, message lengths) or
guarantee termination (block recursion depth, coordinate sanity), and each one
that drops something reports how much it dropped.

## Registers and the Canvas

Six registers share one Canvas. `rules`, `errors` and `layers` paint the whole
drawing and put findings or a highlighted layer on top of it. `rooms` and
`areas` paint the validation polygons **alone**: the CAD content behind them is
suppressed, and hit testing is suppressed with it, so a click cannot select an
entity nobody can see. Those registers answer a question about polygons, and the
drawing behind them buries the answer under walls, furniture and the title
block. This mirrors the reference checker's `drawBase` rule
(`bbl-dres/plan-check`, `js/renderer.js`). `metrics` reports the whole drawing
and takes the full workbench width instead of leaving an idle Canvas beside it.

Room and floor polygons carry their identity in the plan: AOID above, measured
area below, placed largest-polygon-first and skipped where a label would collide
with one already placed. Their register lists carry per-polygon visibility
checkboxes with a tri-state master, and the Canvas reads the same sets, so list
and plan can never disagree.

Status marks in the register rows are drawn in `view.js` rather than taken from
the CD icon set: those icons are hairline outlines built for 24 px headings and
are illegible at the 16 px of a dense row. The four marks are solid shapes with
distinct silhouettes — circle, triangle, check, dash — so an outcome is readable
without colour.

## Step 3: Freigabe

Submitting opens a real process instance through the portal's engine
(`planfreigabe` in the portal branch of `data/processes.json`), the same path every other
wizard uses, so the reference shown is the one that appears in the personal case
list. The summary restates only values the visitor entered or the checker
measured; nothing new is introduced on the last step. In this prototype the case
is created in browser storage only: nothing is transmitted to the
Flächenmanagement, and the screen says so.

## Validation and prototype limits

- The source contract does not provide an SIA use-category mapping. An
  unclassified room is counted as HNF by a stated convention, matching the
  reference checker, so the area balance is populated instead of empty.
  `metrics.categorySource === 'convention'` and `room.siaCategorySource` mark
  the value as derived, and every surface that shows HNF/NF/NGF says so. GF and
  KF stay measured. Categories are still never inferred from layer names.
- `DIM_002` reads real associativity from the dimension's extension dictionary:
  a dimension is associative when that dictionary holds an `ACAD_DIMASSOC`
  entry. Group code 70 is not used — bit 32 is set on every dimension that owns
  an anonymous block, so testing it would report all dimensions as
  non-associative. Where a drawing carries no dictionary table the rule reports
  itself `not-evaluated` rather than guessing.
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
