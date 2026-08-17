# Senior JavaScript code review

> Superseded by the implemented follow-up review dated 16 August 2026:
> [code-review-2026-08-16.md](code-review-2026-08-16.md).

**Review date:** 8 August 2026

**Current implementation:** Planprüfung feature work based on `f79d72b`

**Scope:** maintained JavaScript, route and UI contracts, static data boundaries, local developer server, and the tests that exercise them

## Executive summary

The portal is now a substantially safer and easier-to-navigate vanilla-JavaScript codebase. The review found lifecycle races, weak data and storage boundaries, duplicated catalogue logic, oversized mixed-responsibility modules, and several browser-side injection surfaces. The six implementation commits listed below address the technically decidable findings without removing a route, view, interaction, brand skin, or the dependency-free runtime model.

The reviewed portal refactor has no unresolved regression in its established routes. Planprüfung now accepts local binary DWG files for non-production parsing, completeness diagnostics, and technical checks with bundled `libredwg-web` 0.7.9. Selected bytes remain in browser memory and are processed by a disposable Worker; the bundled BBL plan remains a deterministic golden fixture for the test suite rather than an input restriction. Route rendering now has cancellation and cleanup ownership; shared loaders reject malformed data and failed assets predictably; implementation identifiers and comments are English; UI, routing, core, map, search, and security responsibilities have explicit homes; duplicated collection and catalogue operations share small tested helpers; confirmed dead code is gone; and untrusted text, attributes, URLs, exports, calendar files, CDN assets, and the local server have defined trust boundaries.

This is still a static prototype, not a production service. Its login is a client-side demonstration gate, browser storage is the persistence layer, repository fixtures stand in for server responses, and `scripts/serve.mjs` is a local test server. Consequently, this review does **not** claim real authentication, authorization, transactional writes, server-side validation, auditability, or multi-user consistency. Those items remain deliberately tracked rather than disguised by frontend-only substitutes.

## Review scope and principles

The review followed these constraints:

- no framework, package manager, build step, or runtime dependency was introduced;
- German interface copy, stable hashes, query values, and source-system field names remain compatibility data;
- maintained implementation names, comments, diagnostics, files, and DOM hooks use English;
- dynamic class stems and template-generated identifiers were treated as live until proven otherwise;
- changes were split into independently bisectable commits and verified after each phase;
- production-only work was separated from defects observable in the current prototype.

The principal runtime flow is:

```text
index.html
  -> js/app.js
  -> core and process-engine initialization
  -> shell initialization
  -> hash router dispatch
  -> route data/CSS loading
  -> page or micro-app render(ctx)
  -> registered route cleanup on the next dispatch
```

## Current architecture and target boundaries

The refactor established the following ownership model. It is both the current structure and the target for new work: new code should extend the owning area rather than recreate a root-level utility or enlarge the compatibility façade.

```text
js/
  app.js                         bootstrap only
  components.js                  narrow compatibility re-export
  process-engine.js              prototype case definitions and instances
  collections.js                collection-safe shared operations
  domain.js, format.js           domain lookup and display formatting
  links.js, crumbs.js            stable route/link compatibility
  export.js                      CSV/table export boundary

  routing/
    routes.js                    route, redirect, section and gate registry
    router.js                    dispatch, cancellation, lifecycle and focus
    css-loader.js                route-scoped stylesheet loading

  core/
    index.js                     data registry and public accessors
    fetch-json.js                fetch/status/shape boundary
    storage.js                   failure-tolerant browser storage boundary
    session.js                   prototype session state
    dashboard-data.js            dashboard validation and query operations
    external-assets.js           authenticated CDN asset loader
    bookmarks.js                 persisted typed favourites

  security/
    urls.js                      link, resource, asset, mail and phone policy
    untrusted-text.js            source-specific text normalization

  ui/
    components/                  primitives, content, forms, navigation,
                                 feedback, overlays and catalogue behavior
    shell/                       header, footer and shell composition
    charts.js, gallery.js,
    floorplan.js, fullscreen.js  focused reusable UI adapters

  map/                           MapLibre loading, map slots and cluster actions
  search/                        index, suggestions and normalized search log
  pages/                         public route renderers
  apps/                          independently routed micro-apps
    room-booking/                calendar and booking rules
  plan-check/                    worker parser, bounded normalization, rules,
                                 reports, accessible view and Canvas viewer
  floorplan-editor/              editor model, commands, canvas and Three adapter
  vendor/                        third-party provenance, pinned artifacts and licenses
```

The key runtime contracts are now explicit:

- `render(ctx)` owns only its current route. It checks `ctx.stale()` before a late DOM commit, passes `ctx.signal` to abortable work, and registers resources with `ctx.onUnmount()`.
- Core loaders validate HTTP status and top-level shape before caching. Callers receive a rejected promise, never an error page parsed as data.
- Browser-storage writes return success explicitly. A workflow must not display success after a failed write.
- UI components accept text by default. Deliberate markup parameters are named `*Html`; URL and attribute contexts use the security helpers.
- Route compatibility values may remain German, while internal identifiers remain English and are guarded by `scripts/check-english-code.mjs`.

### Planprüfung addendum

The standalone `#/app/plan-check` micro-app establishes a browser-local DWG
testing boundary. The route adapter validates optional building/floor context,
while bounded normalization, 40 technical checks, report generation, and the
Canvas viewer remain testable pure modules. A file picker and drop target feed
the same local parser path; no remote-URL or clipboard intake is exposed.

The parser-client adapter accepts a `.dwg` `File` with a non-empty safe-integer
size no greater than 50 MiB. It checks the exact post-read byte count and an
`AC10xx` header before constructing a Worker. The Worker repeats byte-count and
header validation before importing vendor JavaScript/WebAssembly. Each parse
uses a fresh Worker, and result, error, cancellation, timeout, retry, or route
cleanup terminates it. Raw file bytes are not placed in a URL, browser storage,
or outbound request.

`@mlightcad/libredwg-web` 0.7.9 has a tagged source revision, keeps the reference
implementation's API, and parses the official BBL fixture compatibly. The exact
generated JS/WASM artifacts are bundled locally; `js/vendor/libredwg/` records
their hashes, corresponding source, package provenance, and GPL-3.0 license.
The deterministic fixture remains a regression golden for the test suite.

Normalization marks cyclic/depth-limited blocks, unsupported or non-renderable
entities, invalid geometry, truncated rule metadata, and converter-reported
unknown entities incomplete; every canonical
rule then becomes not evaluated and the score stays null. AOID rules retain raw
text occurrences and only evaluate alignment where the source exposes distinct
points. Remaining domain gates are real `DIMASSOC` linkage and authoritative SIA
area categories; the arbitrary-file E2E also exercises cancellation.
The checker is not an approval or records system: it creates only local
print/CSV/JSON evidence (not GeoJSON without a known CRS), not an
authoritative plan version, persisted review, signature, or backend release.
The current checker is a non-production test tool, not a legal, professional,
plan-approval, or records-system decision.

## Findings and disposition

Line references below are current representative anchors at `e0f7f3c`; a row
may describe additional call sites covered by the same contract and tests.

### Bugs

| Severity | Current location | Symptom and cause | Disposition |
| --- | --- | --- | --- |
| High | `js/routing/router.js:21-66,491-527`; `js/core/session.js:18-47` | Back/Forward jumps or logout could bypass unsaved-work guards and leave route/session state inconsistent. Navigation entry points did not share one permission path. | **Resolved.** Hash changes, programmatic navigation, history restoration, and logout use the same synchronous blocker contract. |
| Medium | `js/ui/fullscreen.js:5-38`; `js/map/cluster-navigation.js:4-27` | Rejected fullscreen and asynchronous cluster actions produced unhandled promise rejections or silent failures. | **Resolved.** Both adapters catch platform failures and report actionable UI feedback. |

### Races and lifecycle

| Severity | Current location | Symptom and cause | Disposition |
| --- | --- | --- | --- |
| High | `js/routing/router.js:260-324,330-482` | A slower earlier route could commit after a newer navigation; listeners, observers, maps, timers, or overlays could outlive their owner. Async rendering had no single cancellation and teardown contract. | **Resolved.** Dispatch tickets, `AbortController`, stale checks, idempotent cleanup, and a shared finalization path now govern every route outcome. |
| High | `js/map/buildings-map.js:123-284`; `js/ui/gallery.js:56-270`; `js/apps/tenancies.js:63-68,688-795` | Re-rendering or leaving a route could retain maps, overlay locks, observers, tables, and global listeners. Ownership was spread across local redraw functions. | **Resolved.** Resource setup returns or registers teardown; partial redraws preserve owned subtrees and dispose replaced resources. |
| Medium | `js/process-engine.js:97-136`; `js/apps/process-docs.js:321-529` | One failed independent resource could hide all process content; failed or stale BPMN construction could leave a partial viewer. | **Resolved.** Independent data uses `Promise.allSettled`; viewer creation and destruction are guarded and stale renders do not commit. |

### Data and error handling

| Severity | Current location | Symptom and cause | Disposition |
| --- | --- | --- | --- |
| High | `js/core/fetch-json.js:7-16`; `js/core/index.js:172-219`; `js/core/dashboard-data.js:19-106` | Non-2xx responses, wrong top-level shapes, duplicate dashboard identifiers, and hostile DOM identifiers could fail deep inside a renderer or corrupt cache state. Trust was deferred to consumers. | **Resolved.** Fetch and dataset boundaries validate status, shape, uniqueness, and safe identifiers before caching. |
| High | `js/core/storage.js:11-40`; `js/process-engine.js:31-65`; `js/apps/shop.js:639-659` | Corrupt or unavailable browser storage could break startup, while failed case/cart writes could still be announced as successful. Reads and writes did not communicate failure consistently. | **Resolved.** Storage access is guarded and result-bearing; callers validate stored records and only announce persisted outcomes. |
| Medium | `js/search/search-log.js:21-69` | A crafted `bbl.searchlog` value could inject non-numeric hit counts into a table or poison aggregation. Only the outer array was checked. | **Resolved.** Each record is normalized at the storage boundary and display remains escaped. |
| Medium | `js/apps/room-booking/calendar.js:14-67`; `js/format.js:25-47` | Invalid calendar components, control characters, and ambiguous date conversion could create malformed ICS output or timezone-dependent display. | **Resolved.** Calendar values are range-checked, ICS text/parameters are escaped, and date-only formatting avoids an accidental UTC round trip. |
| Medium | `js/ui/floorplan.js:88-137`; `js/apps/tenancies.js:17-44`; `js/apps/space-request.js:18-21` | `NaN`, infinite geometry, unknown booking states, or invalid sharing factors could reach SVG and calculations. Repository fixtures were assumed to be numerically sound. | **Resolved.** Values are normalized to finite domain ranges and enums before rendering or arithmetic. |
| Medium | `js/core/fetch-json.js:7-16`; `js/routing/router.js:330-482` | Network and lazy-load failures could surface as console-only errors or leave a loading shell. | **Resolved.** Errors have stable typed boundaries and every route ends in content, a gate, not-found, or visible error feedback. |

### Security

| Severity | Current location | Symptom and cause | Disposition |
| --- | --- | --- | --- |
| High | `js/security/urls.js:35-99`; representative sinks in `js/ui/components/content.js:382-404` | Fixture, query, map, search, or storage values could reach `href`, `src`, CSS/resource, ID, class, or HTML contexts without a context-specific policy. Generic string interpolation blurred trust boundaries. | **Resolved.** Links are relative or HTTPS by policy, assets are prefix-restricted, mail/phone values have dedicated helpers, DOM tokens are normalized, and unsafe targets render inert. |
| High | `js/ui/components/primitives.js:13-158`; `js/ui/components/content.js:45-117`; `js/ui/components/feedback.js:121-151` | Component parameters that looked like text sometimes accepted markup, making escaping dependent on every caller. | **Resolved.** Text is escaped by default; intentional markup has an explicit `*Html` contract; tag, modifier, state, size, and class inputs use allowlists. |
| High | `js/core/external-assets.js:8-139`; consumers at `js/apps/api-docs.js:31-59` and `js/map/buildings-map.js:12-40` | Pinned CDN versions alone did not authenticate executable bytes, and a late stylesheet failure could follow script execution. | **Resolved.** Exact SHA-384 SRI, anonymous CORS, no-referrer policy, single-flight loading, timeout cleanup, retry, and style-before-script sequencing protect direct assets. |
| High | `scripts/serve.mjs:46-151` | The local server could expose hidden files or accept unsafe path/Host/method inputs. It lacked a clearly bounded static-file policy. | **Only partly resolved — see the second pass below.** Decoding and containment checks, loopback Host allowlisting, GET/HEAD-only handling, compression negotiation, `Vary`, and `nosniff` are tested. The dot-path denial, however, tested one SPELLING of a hidden name rather than the property: `/GIT~1/config` reached `.git/config` through an NTFS 8.3 alias. Closed on 11 August by deciding on the resolved real path. |
| Medium | `js/export.js:28-66`; `js/apps/room-booking/calendar.js:14-47` | Exported cells could be interpreted as spreadsheet formulas; calendar values could inject properties through CR/LF or parameters. | **Resolved.** Formula-leading cells are neutralized and CSV/ICS encoding has adversarial regression coverage. |
| Medium | `js/apps/process-docs.js:342-350,472-512`; `js/ui/floorplan.js:88-137`; `js/apps/shop.js:240-430` | BPMN paths, SVG properties, and product identifiers originated in data but were used as resource paths or DOM attributes. | **Resolved.** BPMN files are confined to their asset directory and extension; SVG/product fields are finite, enumerated, tokenized, and escaped. |

### Architecture

| Severity | Current location | Symptom and cause | Disposition |
| --- | --- | --- | --- |
| High | `js/components.js:1-5`; implementations in `js/ui/components/primitives.js:1-216` and sibling modules | One 2,000-plus-line file mixed HTML primitives, forms, overlays, navigation, catalogue state, and event wiring. That hid ownership and made unrelated changes collide. | **Resolved.** Concern modules now own the implementations; `js/components.js` is only a narrow compatibility façade. |
| Medium | `js/routing/routes.js:7-188`; `js/routing/router.js:260-482`; `js/ui/shell/header.js:1-599`; `js/ui/shell/footer.js:1-81` | Route metadata, dispatch mechanics, redirects, gates, header behavior, and footer markup were interleaved. | **Resolved.** Declarative route data, lifecycle mechanics, and shell pieces are separate without changing hashes. |
| Low | `js/core/index.js:19-75`; `js/routing/routes.js:83-135` | Data and route registries still encode separate dimensions of application capability. A single mega-registry would reduce some repetition but increase coupling between data and navigation. | **No change proposed now.** Keep the registries explicit; add a cross-registry assertion if drift becomes observable. |

### Complexity and duplication

| Severity | Current location | Symptom and cause | Disposition |
| --- | --- | --- | --- |
| Medium | `js/collections.js:8-33`; `js/ui/components/catalogue.js:418-462` | Repeated deduplication, grouping, filtering, and catalogue state code had slightly different empty/null behavior. | **Resolved.** Small shared helpers define one behavior and have focused unit plus route regression coverage. |
| Medium | `js/apps/room-booking/rules.js:85-97`; `js/floorplan-editor/three-controls.js:20-119`; `js/floorplan-editor/three-scene.js:12-181` | Calendar rules and Three scene/control concerns were buried in large controllers. | **Partially resolved.** Stable rule, scene, and control seams were extracted. The remaining closure-bound controllers are deliberately tracked below. |

### Dead code

| Severity | Current location | Symptom and cause | Disposition |
| --- | --- | --- | --- |
| Medium | Contract evidence at `scripts/test-api-surface.mjs:1-162` and `scripts/test-data-integrity.mjs:1-238` | Unused exports, helpers, branches, imports, and obsolete application records increased the apparent API and audit surface. | **Resolved.** Only references disproved across `js/**`, `index.html`, and `data/**` were removed in `f7ab8ce`. |
| Low | Representative dynamic API at `js/ui/components/content.js:52-117` | Static grep can misclassify generated names such as `card--${variant}` or `status--${state}` as dead. | **Retained by policy.** A matching interpolation stem is evidence of use; uncertain rules or hooks stay annotated until runtime coverage proves otherwise. |
| Low | `scripts/README.md:154-221`; review artifacts under `docs/review-assets/` | Historical probes and binary evidence are expensive, but deleting them or rewriting history is a repository-governance action, not a safe code cleanup. | **Deferred.** See the deliberate-undone tracker. |

## Commit sequence

The sequence is intentionally bisectable. Step 7 is the commit containing this document; its self-referential hash is intentionally not embedded here because adding it would change that hash.

| Step | Commit | Purpose |
| ---: | --- | --- |
| 1 | `8e4ece8` | Fix route lifecycle, storage/fetch boundaries, malformed data handling, and observable workflow failures. |
| 2 | `82dfcd0` | Mechanically convert maintained implementation language, filenames, hooks, comments, and diagnostics to English, with no logic change and with German UI/source compatibility values preserved. |
| 3 | `0e50a87` | Purely move and split routing, core, map, search, shell, component, room-booking, and Three responsibilities; update module paths without changing behavior. |
| 4 | `c716005` | Consolidate collection and catalogue behavior behind shared tested helpers. |
| 5 | `f7ab8ce` | Remove only code and obsolete data confirmed dead by repository-wide consumer, export, and dynamic-stem audits. |
| 6 | `e0f7f3c` | Harden browser trust boundaries, external assets, exports, local storage, asynchronous platform APIs, and the local server. |
| 7 | **This documentation commit** | Bring the developer guide and review record in line with the implemented architecture and measured verification. |

## Verification evidence

The acceptance run at `e0f7f3c` was clean. It included:

- all ten requested CDP suites: `apidocs`, `catalogue`, `content`, `dashboard`, `estate`, `forms`, `login`, `portfolio`, `race`, and `tabs`;
- `scripts/test-routes.mjs`: all 39 canonical routes and 13 legacy redirects, including authenticated micro-app routes;
- lifecycle and failure coverage: router races/cleanup, route data needs, network resilience, login/logout, UI state, gallery/floorplan state, and CSS loading/layers;
- security coverage: URL classifiers and sinks, HTML contracts, external-asset SRI/ordering/retry, CSV, ICS, fullscreen, map clusters, search-log storage, and local-server traversal/Host/method behavior;
- data and API coverage: data integrity/resilience, search, formatting, collections, process dates/docs, and API-surface/linkage checks;
- both brand skins and the existing responsive/accessibility route matrix remained in the browser review scope;
- `node --check` across all maintained `.js` and `.mjs` sources, with no unresolved import, console error, CSS 404, or lazy-style ordering failure;
- `scripts/check-english-code.mjs`, which allows German user-facing strings and compatibility keys but rejects German implementation identifiers, hooks, comments, and developer diagnostics.

These tests establish the prototype behavior represented in this repository. They are not evidence of production authentication, browser compatibility beyond the exercised environment, real service availability, penetration testing, load capacity, or legal permission to publish data and media.

The Planprüfung feature adds three always-run acceptance layers for the local
file contract: pure geometry, normalization, rule, reporting, viewer, resource
limit, configuration and parser-client boundary checks; a browser route test
covering authentication, validated context handoff, picker/drop intake,
validation failures, the real result workbench, retry, cleanup, skins, reduced
motion and 320 px reflow; and a self-serving parser golden. The golden verifies
the manifest, fixture and runtime hashes, runs the exact local runtime with zero
external requests, and pins AC1032, 3,504 entities, 17 layers, zero
converter-reported unknown entities,
3,557 render primitives, 30 rooms, one area and 40 rules. Two unsupported and
ten non-renderable entities correctly make completeness `incomplete`, keep the
score `null`, and leave the canonical rules not evaluated. That golden pins one
known input while the browser and core suites cover the general file contract.

## Domain glossary for implementation names

German remains correct in the UI. The English column is the preferred implementation vocabulary; quoted route/query/source keys remain unchanged where compatibility requires them.

| German domain term | Preferred implementation term | Note |
| --- | --- | --- |
| Vorgang | case | A workflow instance, not a generic process definition. |
| Liegenschaft | property | Use `estate` only for the portfolio/dashboard product name. |
| Wirtschaftseinheit (WE) | business entity | Keep `WE` only in visible labels or source data. |
| Verwaltungseinheit (VE) | administrative unit | Keep `VE` only in visible labels or source data. |
| Weisung | directive | A binding instruction/document. |
| Raumbedarf | space request | The portal workflow/app; use `space requirement` for the measured need itself. |
| Störungsmeldung | fault report | The submitted record; `report fault` is the action. |
| Dienstleistung | service | Portal service catalogue entry. |
| Anwendung | application | A linked application or routed micro-app. |
| Datensatz | dataset | A catalogue dataset, not a generic row. |
| Bauprojekt | construction project | Use `project` after the construction context is established. |
| Objekt | property record / entity | Avoid generic `object` when the property-domain meaning is intended. |
| Gebäude | building | A built asset. |
| Grundstück / Parzelle | parcel | Preserve EGRID and source-specific parcel identifiers. |
| Geschoss | floor | Use `level` only for the numeric/ordering attribute. |
| Raum | room / space | Use `room` for a bookable/enclosed room and `space` for floor-plan geometry. |
| Grundriss | floor plan | Two words as a noun; `floorplan` remains only in established filenames/hooks. |
| Fläche | area | Qualify as gross, usable, rentable, or surrounding area where known. |
| Geschossfläche (GF) | floor area (SIA GF) | Do not silently equate different SIA/DIN measures. |
| Mietverhältnis | tenancy | The contractual occupancy record. |
| Mietende | tenants | People or organisations renting space. |
| Raumbuchung | room booking | The booking application/workflow. |
| Belegung | occupancy | Use `booking` for an individual reservation. |
| Bauwerksdokumentation | building documentation | The archive/product area. |
| Veräusserung | disposal / transaction | Use `transaction` for the routed prototype app. |
| Beschaffung | procurement | Procurement content and processes. |
| Benutzerorganisation (BO) | user organisation | Preserve `BO` in quoted BBL process labels. |
| Immobilienmanagement (IM) | property management | Preserve `IM` in quoted BBL process labels. |
| Objektmanagement (OM) | facility/property operations | Choose the narrower term from context; preserve `OM` in source labels. |
| Bauherrschaft | client / owner | Prefer `client` for the project role; do not assume legal ownership. |

## Deliberately undone: decision and production tracker

| Item | Why it was not implemented in this refactor | Required next decision or work |
| --- | --- | --- |
| Real eIAM/AGOV authentication, RBAC, and classification enforcement | A static client cannot establish identity, enforce authorization, or protect classified records. The current session, route gate, and browser-derived labels are explicitly demonstrative. | Select the eIAM/AGOV identity flow and backend authorization model; enforce permissions and classification before data leaves the server, at every resource and action. |
| Backend persistence and server validation | Local JSON and browser storage have no authoritative server, schema migration, transactional boundary, or cross-device state. Frontend validation is only usability and defense in depth. | Define service contracts and schemas; validate and authorize all reads/writes server-side; give failures stable machine-readable types. |
| Compare-and-swap, multi-user concurrency, and audit | There is no shared record version, atomic update, immutable event log, or actor identity. Pretending to add these in local storage would be misleading. | Choose version/ETag semantics, conflict UX, transaction boundaries, retention, and tamper-evident audit requirements. |
| Publication approval for data and URLs | The repository contains realistic property, contact, organisational, and destination data. Code cannot determine whether each record is synthetic, public, internal, or approved. | Data owners provide a publication allowlist and canonical source; replace or remove anything not approved. Treat history remediation as a separate authorized operation. |
| Media licensing and redistribution | File presence and metadata do not prove copyright, model/property release, attribution, or redistribution rights. Automated deletion could also remove approved material. | Record owner, source, license, attribution, and publication approval per asset; replace or withdraw unresolved media. Decide history treatment separately. |
| Strict CSP and complete local vendoring | Direct MapLibre, Swagger UI, and bpmn-js assets now use exact SRI, but nested fonts and dynamic map tiles/glyphs are fetched by those libraries and cannot be authenticated with SRI in the same way. Inline styles and remote endpoints also affect CSP design. | Decide whether to self-host libraries, fonts, styles, tiles, sprites, and glyphs; inventory inline style requirements; deploy CSP as an HTTP response header and test it in the target hosting environment. |
| Map privacy and external availability | Remote tile/geocoding calls expose network metadata and can fail outside the controlled demonstration environment. The repository has no service agreement or offline tile source. | Select approved providers, privacy terms, attribution, availability targets, fallback behavior, and optionally a self-hosted map stack. |
| Safe and authoritative plan intake, approval, and LibreDWG licensing | The browser-local checker accepts caller-selected files only for non-production testing. It has no backend record, authoritative version, signature, reviewer identity, retention policy, or release transaction. The bundled parser remains GPL-3.0 software with complete-corresponding-source obligations. | For any future production workflow, approve a parser deployment and GPL/source-delivery model; then design authenticated upload, isolation, server validation, immutable versions, roles, audit, retention, and approval/rejection workflow. |
| Further splitting of closure-bound editor controllers | `js/floorplan-editor/controller.js`, `views.js`, and parts of `three-viewer.js` share mutable interaction, scene, history, and disposal state. A mechanical split would create hidden coupling without reducing it. | First define an explicit editor state/event boundary and add interaction/performance fixtures; then extract one state owner at a time. |
| Review binaries and Git history | Screenshots, PDFs, historical probes, and old commits are evidence or shared history. Removal and history rewriting are destructive governance decisions outside a JavaScript refactor. | Set retention and artifact-storage policy, identify canonical evidence, obtain explicit approval, and communicate any history rewrite to every consumer. |

## Conclusion

Within its declared prototype boundary, the application has a coherent module model, defensible browser-side trust boundaries, and regression evidence for its routes and principal interactions. Future feature work should preserve the route lifecycle, text-by-default component contracts, validated data/storage boundaries, and English implementation vocabulary. Production work should begin with identity, server authority, publication approval, and deployment policy—not with more client-side simulation.

---

# Senior technical review, second pass

**Review date:** 11 August 2026

**Method:** ten independent expert reviewers over distinct dimensions — controller
monolith, Three.js layer, model/commands/repository, view duplication, cross-app
duplication, editor correctness, CSS architecture, test quality, security boundaries,
accessibility and consistency — each followed by an adversarial verifier instructed to
refute what it could and to judge whether a real finding was worth acting on. A lead
pass merged findings that arrived from several dimensions; a completeness critic then
looked for what ten dimensions would miss. 22 agents, 123 findings surviving
verification.

**Scope:** the whole repository, weighted towards the plan editor, which had just taken
a large round of changes.

## What the review found that this document got wrong

The first review (8 August) closed a finding titled «hidden repository and environment
paths are never runtime assets» and recorded it as resolved and tested. It was neither.

`scripts/serve.mjs` refused any path segment beginning with a dot. NTFS keeps 8.3
aliases that contain **no dot**, so the refusal was one spelling of the name. Reproduced
on the review machine: `/.git/config` correctly returned 404 while **`/GIT~1/config`
returned 200 and 1038 bytes of the real file, including remote URLs**. `/GITIGN~1`
disclosed the same way. `serve.mjs` documents a LAN bind mode, in which any peer on the
network could read it. The gate had only ever asserted the dotted spelling, which is why
this passed for three days of review and every run since.

The decision is now taken on the resolved real path — `realpathSync.native` normalises
the alias back to its long name and follows symlinks, so both spellings and any in-root
link land in the same branch. The gate asserts the alias form at the resolver and at the
HTTP boundary.

The lesson generalises past this one bug: **a gate that asserts a spelling tests the
spelling, not the property.**

## The finding that had to be fixed first

`scripts/lib/cdp.mjs` read only `result.value` from `Runtime.evaluate` and never
`exceptionDetails` — and `Runtime.exceptionThrown`, which the harness does listen for,
does not fire for `Runtime.evaluate`. A probe that threw therefore resolved to
`undefined`, and the assertion downstream failed with an empty detail under a name that
described something else. Since most of the editor suite is template-literal probes that
`node --check` cannot parse, this hid an unknown amount.

Fixing it surfaced exactly one silently-broken probe, in `check-pj-gallery.mjs`: a regex
carrying a single-escaped slash, which in a template literal emits a bare slash that
closes the regex early. The probe had never run. Its diagnostic was also wrong once it
did run — a number-slash-number search over `document.body` matched the object's SAP key
rather than the gallery counter.

`problems()` also never drained its buffers and only ever reported index 0, so one early
console error failed every later `checkProblems` call under its own unrelated name.

## Data integrity

| Nr. | Befund | Entscheid / Umsetzung |
| --- | --- | --- |
| R1 | **Every cross-room furniture move in the 3D model was silently rejected.** The 3D commit validated the document while `roomId` still named the room the object came from, and `validPlacement` requires a placement's centre to lie inside the room its `roomId` names. The object snapped back and blamed the new position. The 2D path always assigned first, which is why only 3D was affected. Reported independently by two reviewers. | Room assigned before validation. |
| R2 | An interrupted 3D widget drag never told the controller: `pointercancel` and `lostpointercapture` went straight to `endInteraction`. The mutation already applied stayed in the document, outside history and outside `dirty`, and the rollback snapshot survived to become the rollback target of the NEXT drag. | Both paths report a cancelled gesture; the snapshot is cleared on viewer teardown and on leaving edit mode. |
| R3 | The 2D placement-drag epilogue had `if (placement)` with no `else`. A selection that vanished mid-gesture skipped the whole branch: no restore, no `dirty` recompute, nothing redrawn. | The missing branch restores; the redraw is hoisted so it always runs. |

## The library dialog, and what «modal» has to mean

The dialog introduced in the previous round declared `aria-modal="true"` and enforced
none of it. Three reviewers found this independently, which is a fair signal.

- Tab walked into the header, the tree, the footer's project links and the stage — all
  under an opaque scrim. A container that claims modality without enforcing it is worse
  than one that claims nothing: a screen reader stops describing the rest of the page
  while the keyboard still goes there.
- The editor's shortcuts stayed live behind it. **Backspace deleted the selected object
  out of view.** A first fix guarded only events from outside the dialog, which missed
  the normal case: product tiles are buttons, so focus sits on one, and from there the
  whole ladder still ran — `r` rotated, `v`/`h` switched tool and tore the dialog down
  mid-gesture.
- The dialog had **no surface**. Measured: content and body backgrounds both
  transparent, title text white. The design system keeps modal content transparent with
  white header chrome and expects the caller to supply the light box through a card; the
  card had been omitted, so the product grid rendered on the scrim. That also explains
  the reported overflow: a full-bleed tab strip was bleeding against padding that did
  not exist.

Every sibling of the dialog now goes `inert`, the dialog owns the keyboard wherever
focus sits, and the body carries the card. Asserted, including five destructive keys
pressed with focus on a tile.

## WebGL lifecycle

`dispose()` ended at `renderer.dispose()`, which frees Three's objects but not the GL
context, while every rail toggle, view switch and — after the previous round — every
armed product and every placement ran the full `draw()`, disposing the viewer and
building a new renderer. Chromium keeps roughly sixteen live contexts and kills the
oldest, so a run of placements could pull the context out from under the viewer in use.

- `forceContextLoss()` before `dispose()`, with a `disposed` guard on the
  `webglcontextlost` handler, which that call synthesises on the canvas being torn down.
- A narrow `updatePlacements` that moves existing groups, replacing `updateDocument` on
  the drag path. `updateDocument` rebuilt every room slab, outline and wall, a fresh
  grid, and one 512×128 canvas plus a CanvasTexture per room label — on every pointer
  move, on a floor with up to 43 spaces.
- The library dialog moved into its own host so opening, closing and arming redraw the
  work area instead of the shell.

Measured: one WebGL context now serves entering 3D, opening the library, arming a
product and a run of placements. Asserted by canvas identity.

## Complexity

| Nr. | Befund | Entscheid / Umsetzung |
| --- | --- | --- |
| R4 | One commit ritual — push, re-clone, recompute `dirty`, sync chrome, announce — written out at four gesture sites, with the rollback written out at fourteen. The newest copy put validation one line too early, which is R1. | `commitGesture` and `rollbackGesture`. `editHistory.push(editorDocument)` now appears exactly once, and validation lives inside the commit, so a caller cannot order it wrongly. This is the extraction a bug had already paid for. |
| R5 | 27 `.fpe-swatch--*` rules restated what `colors.js` already holds in each colour's `css` field, plus a base rule that painted an unrecognised token in the «Arbeit» blue — a wrong answer where a neutral one belongs. | Deleted. The fill is derived through `swatchCss(token)`; the base rule falls back to the unassigned grey. Verified across all five colour modes. |
| R6 | `check-css-tokens.mjs` skipped `--*` declarations in its colour check, so a raw palette or a private layering scale declared as a custom property passed a gate whose entire purpose is to forbid it. | The gate inspects custom properties, distinguishing palette owners (the token sheet, the skins, the two floor-plan sheets that own a domain palette mirrored in `colors.js`) from everyone else. A first version reported 51 legitimate palette definitions; a gate that noisy gets switched off. |
| R7 | Two private z-index scales the extended gate found at once: `--shopping-z-overlay:30/--shopping-z-image:40`, and a five-rung `19/20/30/50/80` scale in the editor. A test pinned the literal `30`. | Both on the documented `--z-local-*` rungs — the editor sets `isolation:isolate`, so only ordering ever mattered. The test asserts ordering. |
| R8 | The object registers render `C.table` directly rather than through `mountDataTable`, and had not brought its `preserveFocus` guard: every keystroke in a register search destroyed the input and dropped focus. | The guard applied. |
| R9 | `C.announceCatalogue` called positionally against an options-object signature, so every filter change in the plan editor's portfolio announced «undefined von undefined undefined». | One options object. |
| R10 | Left behind by the previous round: the stage's keyboard help still branched on the deleted `distance`/`area` tools, so the merged measuring tool advertised the panning keys; `colorMenuHTML()` returned nothing in edit mode, leaving the «Farbe» trigger a control pointing at an element that did not exist and `colorMenuOpen` stuck true, which swallowed the next Escape; `dataset.widget` was written once and never cleared. | All three corrected and asserted. |

## Two traps recorded so they are not walked into again

**Backticks in generated markup.** A backtick inside an HTML comment inside a template
literal parses as a tagged template and throws at runtime. `node --check` passes and the
surface silently stops rendering. This cost time three times in one session.

**Escape layers.** Writing a regex word boundary through a non-raw Python string
produced a literal 0x08 byte in `check-css-tokens.mjs`, leaving the new layering rule
**silently inert** — it matched nothing and the gate reported success. It was caught only
by testing the rule against known inputs rather than trusting a green run, which is the
same discipline the harness finding above is about.

## Deliberately not done

- **The `--fpe-module-*` scale hand-copies values that already exist in the room-use
  palette.** A cosmetic dedup across eleven colour values with no way to verify the
  result visually from a headless run. Left as a note.
- **Splitting the 2,700-line editor suite.** The seam is real, but moving it in the same
  pass as this many behavioural fixes would make a regression hard to attribute.
- **Shared `detailLayout` and plan-state badge helpers.** Eight and nine call sites
  across apps that this round did not otherwise touch.
- **Further extraction from `controller.js`.** The camera subsystem is the clean next
  seam. The commit protocol was extracted because a defect had already been paid for by
  its absence; the rest has not earned it yet, and the first review's deferral of exactly
  this is what produced R1 — so the note is: extract when a bug shows the duplication is
  load-bearing, not on line count alone.
