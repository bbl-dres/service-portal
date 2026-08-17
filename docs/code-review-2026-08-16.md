# JavaScript review and remediation — 16 August 2026

**Status:** implemented and regression-tested

**Baseline:** `6cf3b03`

**Scope:** all maintained code under `js/`, its data contracts, route lifecycle,
browser persistence, DOM and URL trust boundaries, and the tests needed to prove
the changes. The four vendored JavaScript artifacts were checked for provenance
and integration but were not reformatted or translated.

## Executive result

The current tree contains 124 maintained JavaScript modules (about 38,000 lines)
plus four vendored modules. This review found and fixed several real defects:
dirty routes could be replaced by a cross-tab logout, header replacement broke
breadcrumb controls, process data had divergent loaders and branch semantics,
bookmark and cart writes could report success after data loss, exports allowed
spreadsheet formulas, stale map work could move a discarded map, and catalogue
redraws retained listeners and state from prior renders.

The remediation also removed duplicate fetch/export/cart/print/tree code, two
obsolete facades, stale migration references, and historical comments that no
longer explained an invariant. Maintained comments now pass the English-source
gate. German interface copy, route compatibility values, domain labels, and
source-system field names remain unchanged because they are product data, not
implementation commentary.

This remains a static prototype. The work below improves the prototype's actual
correctness and failure behaviour; it does not turn local storage and a client-
side login demonstration into production authentication or transactions.

## Review method

The earlier `docs/code-review.md` and architecture documents were used as a map,
not as a finding list. The current implementation was traced again from:

1. bootstrap through core loading, engine loading, shell replacement, routing,
   redraw, and unmount;
2. every `fetch`, storage mutation, document-level listener, timer, Worker, map,
   and external-asset lifecycle;
3. HTML, attribute, URL, CSV/XLS, calendar, BPMN, GeoJSON, and JSON boundaries;
4. process, service, building, parcel, dashboard, workspace, shop, and catalogue
   identifiers and backlinks;
5. repeated app-local implementations that could be deleted or moved behind a
   small shared module.

The review deliberately excluded style redesign, changes to German UI copy, and
rewrites whose only benefit would be a different framework.

## Implemented findings

| ID | Severity | Finding and impact | Implemented disposition |
| --- | --- | --- | --- |
| JR-01 | High | Cross-tab session changes bypassed route blockers. A dirty floor-plan route could be torn down without its unsaved-work confirmation. | `app.js` now asks the router for permission before session-driven redraw and restores route chrome when navigation is denied. Same-tab and cross-tab logout share the same contract. |
| JR-02 | High | Bookmark toggles mutated memory and announced success even when storage was blocked or full. Concurrent tabs could also overwrite each other, and legacy data was deleted before migration was durable. | `core/bookmarks.js` now reloads and mutates under a short storage lease, verifies ownership before writing, rolls back failed writes, keeps legacy data for retry, and deduplicates malformed persisted entries. UI callers handle failure explicitly. |
| JR-03 | High | Shop checkout cleared the current cart after creating an order. Products added concurrently could be erased, while cleanup retry could create a duplicate case. | New `core/shop-cart.js` owns normalization and locked mutations. Checkout subtracts the exact ordered snapshot and retains `{record, orderedItems}` for an in-route cleanup retry. |
| JR-04 | High | Table export duplicated older CSV logic and allowed cells beginning with `=`, `+`, `-`, or `@` to become spreadsheet formulas. | `ui/export-table.js` delegates to the hardened shared exporter for CSV, XLS, and downloads. Adversarial export tests cover formula neutralization. |
| JR-05 | High | The merged process file still had three loading paths, old test/document references, branch-blind links, mixed business/portal counts, and weak definition validation. These produced broken search links, extra requests, and silently dropped malformed definitions. | Core is the single owner of `processes.json`; the engine loads through core, API docs reuse core, links carry `id` or `def` by branch, architecture/API examples filter the intended branch, and stable/canonical IDs plus definitions are validated before use. |
| JR-06 | Medium | The process engine could start concurrent loads and accept a stale completion. A failed boot followed by a successful deferred core reload left the engine failed until a page reload. | Concurrent loads share one in-flight operation. `app.js` reloads the engine when the core reports a recovered process dataset. Seeded instances and hostile local shadows are validated and reconciled. |
| JR-07 | Medium | Breadcrumb handlers closed over the original header node. Any login/logout header render detached that node and left the replacement inert, while closures retained the old subtree. | Breadcrumb delegation is attached to a stable owner and survives header replacement. Header-owned timers and search body state are cancelled during replacement. |
| JR-08 | Medium | Asynchronous cluster work could call `fitBounds`/`easeTo` after the route or map was replaced. Cluster clicks also requested every leaf with an unbounded limit. | `map/cluster-navigation.js` checks ownership after every async boundary. Exact bounds are capped at 500 leaves; larger clusters use expansion zoom. Active failures remain observable while removed/disconnected-map cancellations are suppressed. |
| JR-09 | Medium | Estate loaded and normalized four files independently of core. It duplicated requests, error policy, cache state, and record conversion. | Estate now uses `core.ensure()` and canonical building, parcel, land-cover, and contract accessors. Non-estate routes remain lazy. |
| JR-10 | Medium | Metadata redraws registered new table disposers without disposing the prior table. Global/tree keys also collided across branches, axes, scopes, and component instances. | Each pane has a replaceable table owner; sidebar state is host-scoped with `WeakMap`; record/attribute and landscape keys include their kind, branch, scope, and axis. Unknown synthetic node IDs are rejected. |
| JR-11 | Medium | BPMN parsing/fetching could reject the entire process route, accepted well-formed non-BPMN XML, reparsed the same asset on tab changes, and rendered source links outside the URL policy. | Process docs validate BPMN roots/processes, catch parser failures at the view boundary, cache successful parses, parse direct-child documentation, and route links/assets/mail through the relevant security policy. |
| JR-12 | Medium | Data boundaries accepted duplicate or non-canonical identifiers, malformed dashboard matrices, and impossible dates such as 31 February. Failures then appeared later as lookup or rendering bugs. | Core validates stable IDs in flat and nested records and unique GeoJSON building/parcel IDs; repeated land-cover parcel IDs remain intentional. Dashboard columns/rows and floor-plan task dates are validated at intake. |
| JR-13 | Medium | Building-create redraws accumulated document click handlers. Catalogue tables, print mode, header focus timers, maps, and other route resources had inconsistent replacement ownership. | Replaceable `AbortController`/disposer ownership was added where needed. New `ui/print-mode.js` gives workspace and tenancies one unmount-safe implementation. |
| JR-14 | Medium | Process and metadata grouping actions compared the wrong default axis or rebuilt hashes without preserving scope. Tree/landscape keyboard focus also drifted between two implementations. | Hash construction is scope-preserving, grouping defaults are consistent, and shared `ui/landscape-state.js` owns fold wiring and focus restoration. Root summaries cover both process branches. |
| JR-15 | Low | Dead compatibility layers and repeated small helpers obscured ownership: a favourites facade, a floor-plan Three facade, local chart/export/download code, duplicate cart code, and duplicate landscape/print wiring. | The two facades were deleted; callers use their real owners. Cart, print, export, chart, and landscape behaviours now have one tested implementation each. Unused imports, aliases, arguments, selectors, and synthetic rerender paths were removed. |
| JR-16 | Low | Migration drift left tests and documentation pointing to the deleted process-definition file. CSS manifests and test counts were also stale, and maintained code contained hundreds of German or historical comment findings. | References, manifests, counts, and architecture notes were updated. The English-code gate now passes across 267 maintained source files; comments retained in touched code explain current invariants in English. |

## Security conclusions

The browser-side trust boundaries are materially stronger after this pass:

- untrusted export cells cannot execute as spreadsheet formulas;
- process sources, BPMN assets, links, mail addresses, and map links use the
  existing URL policies instead of ad-hoc `new URL()` or string interpolation;
- core loaders reject malformed shapes and duplicate identifiers before data is
  exposed to applications;
- failed persistence does not produce a false-success UI;
- external MapLibre and BPMN packages remain version-pinned and integrity-
  checked by the shared asset loader;
- stale route/map operations cannot mutate the next route's DOM or camera.

No credible server-side authorization claim can be made for this repository.
The login gate and storage records are browser-controlled and must be treated as
demonstration state only.

## Performance and complexity conclusions

The most useful performance improvements came from removing work rather than
micro-optimising it:

- one cached process request replaces three independent reads on API-docs entry;
- estate no longer repeats four core fetch/normalize paths;
- successful BPMN XML is cached instead of fetched and parsed on every tab
  redraw;
- metadata tables dispose the previous instance immediately;
- map cluster leaf materialisation is bounded;
- shared cart, print, landscape, chart, and export modules replace parallel
  implementations that had already drifted.

The maintained-JavaScript diff removes about 426 more lines than it adds, even
after adding three reusable modules. Focused regression tests and this report
increase the repository-wide line count slightly. The two largest catalogue
applications remain sizeable, but their lifecycle, state, and parsing boundaries
are now separate enough for an incremental future split without changing routes.

## Deferred risks and decisions

These items were not hidden behind frontend-only fixes:

1. **Production identity and persistence.** Authentication, authorization,
   server validation, audit, durable transactions, and multi-user conflict
   resolution require backend services. Local-storage leases are best-effort
   coordination, not a security or transactional primitive.
2. **Checkout idempotency across reloads.** The in-route retry marker prevents a
   duplicate case while the route lives. A reload between order persistence and
   cart cleanup needs a backend idempotency key to guarantee exactly-once order
   creation.
3. **Plan Check resource policy.** Input size is capped at 50 MiB and parsing at
   120 seconds, but entity, primitive, vertex, validation-operation, and result
   ceilings are deliberately unlimited. A complex drawing can still consume
   substantial Worker CPU/memory. Product owners must choose hard ceilings or a
   server-side parser before production.
4. **Raw map popup capability.** `buildings-map.js` still accepts caller-composed
   `popup_html`. The current producer escapes its fields, but a structured popup
   model would make future callers safe by construction.
5. **External runtime assets.** The MapLibre renderer, raster basemap tiles,
   BPMN viewer, and other on-demand libraries still depend on external hosts.
   They have graceful loader failures but no offline copy. The two MapLibre
   glyph ranges are pinned and bundled locally. The remaining dependencies are
   an availability, privacy, and deployment-policy decision.
6. **Large feature modules.** `metadata-catalog.js`, `process-docs.js`, and the
   two editor controllers still carry substantial presentation logic. A later
   split should follow stable state/lifecycle boundaries rather than create more
   compatibility facades.
7. **Cross-tab logout with blocked navigation.** Preserving unsaved work means a
   denied cross-tab logout leaves the current prototype DOM mounted while the
   session state is signed out. A production app must combine navigation guards
   with server-enforced access and an explicit save/discard re-authentication
   flow.

### Follow-up queue

#### MAP-01 — Clustered maps depend on a failing demo glyph service

**Priority:** High  
**Status:** Implemented and verified on 2026-08-17.

Before remediation, `js/map/buildings-map.js` pointed `CARTO_STYLE.glyphs` at
`https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`. The shared
cluster-count and point-label symbol layers request the Noto Sans Bold and
Regular `0-255.pbf` ranges from that host. Requests from a local portal origin
currently fail CORS; a direct check also returned HTTP 429 without an
`Access-Control-Allow-Origin` header.

This does not fail only the text overlay. A browser probe on
`#/app/portfolio?view=map` found the `estate` GeoJSON source populated with 21
input features. At 1440 × 1200, two of four source tiles were `errored`; only
the two isolated Australia/Brazil points survived while all clusters, count
labels, and the other 19 records disappeared. A glyph-free control over the
same data rendered clusters and returned 17 leaves, confirming that the
Supercluster/navigation logic is sound. The basemap can remain visible, masking
the loss of hit-testing and navigation. Single-record detail maps generally
retain their circle but lose their ID label. The shared implementation affects
Portfolio, Immobilien dashboard, Tenancies, Projects, Media Library, Room
Booking, Workspace, and the floor-plan navigation map. The building-create
picker has no symbol layer and normally does not trigger this glyph defect.

The implemented remediation is:

1. Reproducibly generate or vendor the two required open-licensed
   `Noto Sans Regular` and `Noto Sans Bold` `0-255.pbf` ranges with license,
   provenance, and hashes. Current cluster counts and object IDs need only
   ASCII/Latin-1. Serve them from an absolute same-origin URL that also works
   below a deployment subpath, and give `.pbf` an explicit server MIME mapping.
   The MapLibre demotiles repository explicitly describes itself as demo/CI
   infrastructure and offers its font assets for offline use; it should not be
   a runtime production dependency.
2. Isolate optional symbol buckets from the geometry source, so a future font
   failure cannot take circle clusters and cluster navigation down with it. Add
   a neutral background below the raster basemap so local points and parcels
   retain a deliberate fallback surface when raster tiles are unavailable.
3. Add a pure style contract and a browser regression that require no demotiles
   URL, successful same-origin glyph
   responses, a loaded clustered source tile with render buckets, a visible
   count layer, and a cluster click that changes the camera. Add a failure-path
   assertion that geometry remains interactive when labels are unavailable.
   Broaden the existing map-error probe beyond protobuf parse keywords so
   `Failed to fetch`, CORS, HTTP status, and resource-URL failures cannot escape
   its map-specific assertion. Assert the complete represented record count,
   not just a canvas or registered layer, and require a visible degraded state
   rather than silently removing the loading indicator after twelve seconds.
4. Reassess a MapLibre upgrade separately. The style specification records
   local-font fallback without a `glyphs` URL only from GL JS 5.11.0; the portal
   currently pins 4.7.1, so omitting the URL is not a safe one-line fix.

Do not solve this by suppressing `[map]` errors or by using a no-CORS request:
neither restores the failed source tile. References:
[MapLibre glyph specification](https://maplibre.org/maplibre-style-spec/glyphs/),
[MapLibre demotiles repository](https://github.com/maplibre/demotiles).

Implementation evidence: `js/map/map-style.js` resolves the literal MapLibre
template against the module URL so deployment prefixes survive; the pinned PBFs,
licenses, upstream commits, and SHA-256 hashes live in `assets/map-glyphs/`.
`scripts/serve.mjs` serves them as `application/x-protobuf`. Geometry and symbols
use separate GeoJSON sources, a neutral background remains without raster tiles,
and active failures display `.map-degraded` while continuing to reach diagnostics.
`test-map-rendering.mjs` verifies 21/21 represented records, a rendered count,
same-origin responses, a trusted cluster click, and the glyph-blocked fallback.

#### MAP-02 — Picker map failure removes the required address control

**Priority:** Medium  
**Status:** Implemented and verified on 2026-08-17.

Previously, `initPickerMap` replaced the outer `#bc-picker`, whose children are
canvas and the mandatory address-search overlay. Its asset-loader failure path
replaced `container.innerHTML`, deleting the search field even though the map is
documented as optional and address selection is required. The remediation
renders the failure only inside `.map-picker__canvas`, preserves the combobox
and its listeners, and covers the behavior with an offline/blocked-CDN
building-create regression.

The loader and constructor failure paths now resolve and update only the canvas
holder. `test-building-create.mjs` blocks the pinned MapLibre CDN and proves the
required combobox, suggestion rendering, and listeners remain operational.

#### MAP-03 — Rapid cluster clicks can apply out of order

**Priority:** Medium  
**Status:** Implemented and verified on 2026-08-17.

Before remediation, `navigateCluster` correctly rejected completions after a
map lost ownership, but `isCurrent` identified only the map, not the click that
initiated the request. Two quick clicks on the same live map could therefore
resolve in reverse order and let the older request overwrite the newer camera.
The remediation
gives each map a cluster-navigation generation token, includes it in
`isCurrent`, and tests both leaf-bounds and expansion-zoom completion orders.

`createLatestNavigationGuard()` now belongs to the production navigation module;
each map owns one guard and begins a generation only after hit testing returns a
real cluster. The focused pure suite resolves old/new leaf and expansion requests
in reverse order and proves stale work can neither move the camera nor show a
failure toast.

#### UX-01 — Metadata facts diverge from the federal information-block pattern

**Priority:** Medium  
**Status:** Implemented on 2026-08-17.

The metadata record overview uses an auto-fit `.mc-detail__facts` grid with
17-rem section columns. Each section is also a size container, so the shared
`.kv` query can collapse its label/value rows based on the number of fact groups
rather than on the viewport. A live 1440 px check rendered the three-group SAP
table as three 319 px panels with stacked rows, while the two-group Heizzentrale
record used two 494.5 px panels with horizontal rows. The result is an unstable
row anatomy and several parallel mini-columns rather than a predictable reading
order.

The checked-in Swiss Federal Design System at
`C:\Users\david\Documents\GitHub\designsystem` uses `InfoBlock` as one serial
stream of divided rows. Its responsive grid places label and value side by side
at `md` (1:1) and `lg` (1:2), stacking only below `md`. There is no dedicated
**Original** or source-card pattern; publisher, reference, and related metadata
are ordinary information rows. Relevant sources are
`app/components/ch/components/InfoBlock.vue`,
`css/components/info-block.postcss`, and `css/layouts/grids.postcss` in that
repository.

The metadata-scoped implementation leaves the shared process detail unchanged:

1. Record fact sections render as one full-width, DOM-ordered stream and keep
   each `<dt>`/`<dd>` row horizontal from the design system's `md` breakpoint.
   Preserve the responsive small-screen stack and semantic definition-list
   association.
2. The standalone **Original** section is removed from business-object and data-table
   details, including `?id=heizzentrale` and `?table=sap-refx-vibdbe`. Fold any
   provenance that remains useful into the existing governance or technical
   facts instead of discarding it or retaining a separate shaded box. For the
   SAP table, prefer its concrete `systemName` (`SAP RE-FX`) over the current
   generic source-role product list. Render reconciliation dates as semantic
   `<time>` values and make new-window behavior available to assistive
   technology when retaining the safe repository link.
3. Metadata no longer emits `.mc-detail__wide`. The shared
   `sourceBox()` remains available for unaffected callers; this is not a global removal.
4. Focused checks at 320, 768, 1024, and 1440 px cover one fact stream,
   responsive 1-column/1:1/1:2 row tracks, long identifiers and safe external
   links, heading order, no **Original** box, no overflow, and no process-detail
   regression.

The current source rendering escapes values, validates its URL, and isolates
new tabs correctly; this item is design-system conformance and information
architecture, not a security defect. The focused rationale is recorded as D16
in `docs/design-review-metadata-process-docs-2026-08-17.md`.

#### UX-02 — Responsive metadata order disagrees with keyboard order

**Priority:** Medium  
**Status:** Implemented on 2026-08-17.

Below 1024 px, `explorer.css` visually places `.pf-main` before the hierarchy
tree, while metadata markup keeps `.pf-sidebar` first in the DOM. The
accessibility tree and Tab order follow the DOM, so focus enters the visually
lower tree before the visible tabs and detail. The existing browser check only
compares element positions and therefore certifies the visual order without
detecting the interaction mismatch.

Metadata detail markup is now main-first. Metadata-scoped grid areas place the
same hierarchy node to the left on desktop without moving or duplicating it.
Browser regressions at 320 and 768 px drive real Tab progression, while the
1024 px transition proves the focused tree node remains stable. This finding is
recorded as D17 in the focused design review.

## Verification evidence

The maintained test inventory is now 62 `test-*.mjs` suites (38 browser and 24
pure) plus 25 `check-*.mjs` probes.

- **24/24 pure suites pass**, including data integrity/resilience, URL and export
  security, process dates, map ownership, cart concurrency, print lifecycle, and
  developer-server security.
- **4/4 focused MAP runtime suites pass cleanly** against a fresh server:
  `test-map-rendering`, `test-estate`, `test-portfolio`, and
  `test-building-create`. The dedicated map suite proves same-origin glyph
  responses, 21/21 represented records, visible clusters/counts, trusted pointer
  navigation, retained geometry/navigation when glyph requests are blocked, and
  an observable degraded state without suppressing the active error.
- **24/25 checker scripts pass.** The remaining legacy design-contract probe
  reports the pre-existing application-card vertical padding difference
  (`24px` implemented versus `40px` in the design contract) at three viewports;
  it is outside this JavaScript review.
- `node --check` passes for all 236 JavaScript/MJS files under `js/` and
  `scripts/`.
- The English-code gate passes for 267 maintained source files.
- The CSS token gate passes for 34 stylesheets and 341 custom properties.
- Changed JSON parses, references to the deleted split process fixture are zero,
  and `git diff --check` reports no whitespace errors.

The remaining design-contract deviation is recorded explicitly so a green-looking
summary cannot mask unrelated visual debt.
