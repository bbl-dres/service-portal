# scripts/ — verification scripts

Dependency-free browser tests for the prototype, matching the app's no-build /
no-`node_modules` philosophy. They drive **headless Edge over the Chrome DevTools
Protocol** from Node (using the global `WebSocket`, Node ≥ 22) — no puppeteer.
Each test opens the real app, runs an in-page probe, and asserts on the result,
exiting non-zero on failure.

There are currently 29 supported `test-*.mjs` functional suites and 20 retained
`check-*.mjs` diagnostics. Every browser suite uses `APP_BASE` to select the
running app and exits non-zero on failure; the four pure-Node suites need no
server. The older diagnostics are classified
separately below because six are observation-only and deliberately do not act
as regression gates.

Paths owned by a script are resolved relative to `import.meta.url`; the scripts
therefore do not depend on the caller's current directory or on a particular
checkout location. Explicit paths supplied on the command line, such as
`fetch-swisstopo.mjs --datei/--aus`, remain relative to the caller by design.

**Sessions.** `openPage(cdp, url, { login })` decides which session the page
STARTS with, by writing (or clearing) `bbl_session_v1` before the first
application script runs. Left unset it is derived from the URL: routes under
`#/app/…` start **logged in**, because the specialist applications sit behind a
login gate (`js/router.js`). Two cases must say so explicitly:

- checking the **gate itself** → `{ login: false }` (see `test-tabs.mjs`);
- a gated route **outside** `#/app/…`, i.e. `#/my-cases` → `{ login: true }`.

Scripts that open one page and then walk routes by hash — `test-routes.mjs`,
`check-404.mjs`, and the three `review-*.mjs` — pass `{ login: true }` once at
the top.

## Prerequisites

1. **Dev server running.** From the repository root:
   ```
   node scripts/serve.mjs
   ```
2. **`APP_BASE` must match where the app is served.** The default,
   `http://127.0.0.1:8848/#`, matches `serve.mjs`. Override it when using another
   port or a server that mounts the app below a path:
   ```
   $env:APP_BASE='http://127.0.0.1:8848/#'; node scripts/test-tabs.mjs
   ```
3. **Edge** at the default install path, or override `EDGE_PATH`.

## Functional tests

The table calls out the broad and review-critical suites; the authoritative
inventory is `scripts/test-*.mjs`.

| Script | What it checks |
|---|---|
| `test-tabs.mjs` | D1 tab component (`C.tabBar`/`C.tabPanels`/`C.wireTabs`) across portfolio · projects · dataportal: panel toggling, `aria-selected`, roving `tabindex`, focus-follows-active, keyboard (Arrow/Home/End), hash sync. Plus the logged-out gates for the action apps. |
| `test-login.mjs` | Opens Room Booking with an explicitly empty session, verifies login persists and replaces the gate, then verifies logout clears storage and restores both the route gate and header without a subscription API. |
| `test-workspace.mjs` | Workspace portal: seven canonical objects, plan availability and overdue order state, shared adaptive CD hero/cards (one-image solo layout and five-image Tenancies parity), read-only floor preview URL/room/color/print/fullscreen behavior, editor/checker boundary, contextual process launches in new tabs, and desktop/mobile containment. |
| `test-floorplan-editor.mjs` | Standalone Plan-Editor: exact Workspace deep link, default uncolored/flat room tree and attribute-driven aggregation, independent disclosures, top-layer color menu hit-testing, CD-style menu keyboard patterns, edit-specific tool order, on-demand product/module library, structural menu and geometry lock, three-pane shell, canonical rooms and deterministic illustrative furniture, direct primary-button and touch panning with tap selection, persistent touch-sized 2D/3D/walk navigation with roving keyboard focus and view-specific actions, camera-aware 2D scale, data-driven Three.js orbit/walk controls with camera preservation, selection/URL state, product and structural room editing, inspector scroll preservation, module assignment, undo/redo, local save/publish/history/reload, core-data isolation, mutually exclusive 320px drawers with canvas-focused edit restoration, and editor-navigation restoration. |
| `test-floorplan-editor-model.mjs` | Pure Plan-Editor model/repository/commands: all canonical floor baselines, deterministic placements, catalogue-independent baseline token, detached edits, room/placement command invariants, strict local-working-copy round trips and rejection, immutable simulated publications, scoped removal, and bounded undo/redo. |
| `test-room-booking.mjs` | Room Booking on the one-page, direct-booking surface (`docs/room-booking-redesign.md`): search and sort behavior, one process snapshot per redraw, action-time conflict checks, favourites, dialogs, process creation, personal bookings, the `?room=` deep link, and desktop/mobile containment. |
| `test-building-create.mjs` | Building creation: neutral service-launch CTA/new-tab contract, stale address responses, selection invalidation, map/search state, required fields, and process creation. |
| `test-gallery-floorplan-state.mjs` | W-09/W-11 lifecycle regression: exact and stale gallery deep links, unknown image IDs, dialog focus, and tenancy floor-plan fullscreen/selection/focus preservation. |
| `test-anchor-search-state.mjs` | W-15/W-16/K-03 navigation regression: document-relative anchor thresholds, cross-catalogue query preservation, and exact global-search targets for application details and filtered documents. |
| `test-process-dates.mjs` | W-21/K-06 pure Node regression: local date/history/reference consistency plus concurrent process-file loading, independent failures, and successful retry. |
| `test-api-surface.mjs` | K-03 pure Node contract: exact ESM surfaces for session/links/crumbs/core/process engine/maps/components, removed object members, retained diagnostics, encoded search-link builders, and independent external/new-window launch contracts. |
| `test-ui-state.mjs` | W-03/W-04/W-05/W-22 state regression: catalogue debounce teardown, nested overlay ownership, route cleanup, action-menu ARIA, and mobile-shell reset. |
| `test-document-archive.mjs` | Bauwerksdokumentation: reduced six-column table, KBOB document types, filename extensions, plain building cells, and viewer metadata at desktop/mobile widths. |
| `test-catalogue.mjs` | D2 catalogue triplet (`C.catalogueHash`/`C.catalogueControls`/`C.wireCatalogue`) across services · applications · katalog: deep-link round-trips (q/view/filter), search-submit / view-switch / filter interactions, active-filter pill removal, the services multi-value `topic`, detail rendering, and neutral safe new-tab launch CTAs. |
| `test-route-needs.mjs` | K-05/K-04 route loading contract: fresh-page resource assertions prove that data routes load only their declared deferred data, generic dashboards load no estate GeoJSON, and the specialized Immobilien renderer loads each of its three master files exactly once. |
| `test-forms.mjs` | D3 form helpers (`C.field`/`C.select`/`C.val`/`C.readForm`) + the C5 fix across the three wizards: renders, a custom validation error attaches `input--error`+`aria-invalid`+badge to the previously class-less fields (`#org`/`#cc`/`#beschreibung`/`#datum`), and a valid submit creates a Vorgang. Logs in via the stub first. |
| `test-content.mjs` | D4 download-item + contact-box unification: the pages rendering `C.downloadItem` (grundlagen, anleitungen, digitalisierung, application entries, my-cases attachments) and `C.contactBox` (application, services detail) render with the expected items / mailto links and no exceptions. |
| `test-combobox.mjs` | Shared `createListboxController`: Arrow keys, active descendant, selection, Escape/Tab close behavior and cleanup for global suggestions and address search. |
| `test-apidocs.mjs` | Swagger adapter semantics, H2 hierarchy, stable accessible names/language, target sizes and focus styling. |
| `test-process-docs.mjs` | Process detail tabs plus the full-width BPMN viewer, vertical overlay controls, reset action and disabled/focus states. |
| `test-shop.mjs` | Shop catalogue, product/cart/checkout flows, global top-header cart and responsive category disclosure. |
| `test-race.mjs` | A2 router render-race: rapid navigation between an awaiting page (application detail) and another must always land on the last-requested page (the `ctx.stale()` guard drops stale renders), across several timings and both directions. |
| `test-dashboard.mjs` | Datenportal redesign and renderer boundary: exact seven-card routing, smoke coverage for all six generic dashboards, the specialized four-tab Immobilien route, Superset-style framing, dashboard/chart menus, fullscreen, and CSV/PNG export. Saves a screenshot to `$SHOT`. |
| `test-estate.mjs` | Immobilienportfolio record-based dashboard (`js/apps/estate.js`): the four tabs (Gebäude/Grundstücke/Bodenbedeckung/Entwicklung), KPIs, runtime-aggregated charts, the worldwide CARTO map with markers, and live filtering (Land=CH shrinks the building count). Saves a screenshot to `$SHOT`. |

Run every functional suite in PowerShell:

```powershell
Get-ChildItem scripts/test-*.mjs | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE) { exit $LASTEXITCODE }
}
```

## Focused diagnostics

The `check-*.mjs` files are retained probes from individual design and
refactoring waves. They overlap intentionally with the durable `test-*.mjs`
suites and are useful when changing the named surface, but they are not the
authoritative regression inventory. New long-lived coverage belongs in a
`test-*.mjs` suite.

| Status | Scripts | Contract |
|---|---|---|
| Asserted diagnostic | `check-404`, `check-banner`, `check-consistency`, `check-detail-layout`, `check-done`, `check-fixes`, `check-floorplan-section`, `check-focus`, `check-kv`, `check-pfcard`, `check-ramps`, `check-services`, `check-tenancy-aside`, `check-tree` | Focused assertion; exits non-zero on a detected mismatch. |
| Observation-only diagnostic | `check-layout`, `check-payload`, `check-pjcards`, `check-pj-gallery`, `check-projects`, `check-suggest` | Prints measurements or browser problems for manual interpretation; exit code is not a result. |
| Retained one-off assertion | `probe-portfolio-images.mjs` | Historical portfolio image/default-filter probe. It overlaps `test-portfolio.mjs` and is not part of the supported suite glob. |

All names in the table omit the `.mjs` suffix. Do not use a wildcard over
`check-*.mjs` as a CI gate: the observation-only group can report an anomaly
while still exiting zero.

The obsolete `check-hero.mjs` probe was removed: it targeted the retired
`.home-hero__figure` implementation and could only print `kein Bild` against the
current homepage. Its original code remains recoverable from Git history.

## Maintenance and reproduction scripts

These utilities are intentionally kept because they explain how generated data
or media was produced. They are not part of the functional regression run.
Repository-owned input and output paths are checkout-relative; network and
write effects are explicit here.

| Script | Status and purpose | Write/network effect |
|---|---|---|
| `serve.mjs` | Supported local development server. | Read-only; serves the repository on port 8848 by default. |
| `make-image-variants.mjs` | Supported home-hero image maintenance. | Overwrites the two generated WebP variants; requires the dev server and Edge. |
| `fetch-application-images.mjs` | Application-card image maintenance. | Downloads from Unsplash and writes only missing JPGs. |
| `fetch-swisstopo.mjs` | Reproducible address/cadastral research helper. | Calls public APIs; stdout-only unless `--aus <path>` is supplied. |
| `build-tenancy-data.mjs` | Deterministic tenancy fixture generator. | Overwrites `data/tenancies.json`, `data/floors.json`, and `data/spaces.json`. |
| `add-research-buildings.mjs` | Historical researched-building import. | `--pruefen` is read-only; without it, overwrites building, parcel, and child-register data. |
| `apply-research-data.mjs` | Historical real-building enrichment. | `--pruefen` is read-only; without it, overwrites building and parcel data. |
| `adopt-pdf-images.mjs` | Historical BBL-PDF image adoption. | `--pruefen` is read-only; without it, copies non-free images and overwrites `data/media.json`. |
| `extract-pdf-images.mjs` | Historical PDF extraction recipe. | Reads PDFs and writes extracted images/manifests below `research/pdf-bilder/`; requires `pdftotext`. |
| `fetch-building-images.mjs` | Historical free-building-image download. | Dry-run by default; `--write` downloads files and rewrites the image manifest. |
| `link-building-images.mjs` | Historical building/image association. | Dry-run by default; `--write` overwrites `data/buildings.geojson`. |
| `build-media-registry.mjs` | Historical media-registry rebuild. | Dry-run by default; `--write` may rename image files and overwrites four data files. |

Run mutating reproduction scripts only from a clean branch and review their
diff. In particular, the real-data and non-free-media scripts remain subject to
the publication and licensing decisions tracked in the code review.

### Historical image maintenance

The three older building-image pipelines are safe by default: running them
without a flag is a dry run and does not modify assets or data. `--write` is
required to reproduce their original mutating workflow. Review their fixed
source/target assumptions before enabling writes.

```powershell
node scripts/fetch-building-images.mjs --write
node scripts/link-building-images.mjs --write
node scripts/build-media-registry.mjs --write
```

`build-media-registry.mjs --pruefen` remains available as an explicit alias for
its dry-run mode.

## Design review

| Script | What it checks | Output / write effect |
|---|---|---|
| `review-routes.mjs` | Shared inventory of 69 representative routes and states plus the 320/768/1440 viewport matrix. | Read-only shared inventory. |
| `review-audit.mjs` | Overflow, H1/heading structure, IDs, names, image/table semantics and responsive target-size policy across 207 renders. | Overwrites `audit.json` in the selected review output directory. |
| `review-accessibility.mjs` | 200% reflow proxy, keyboard focus visibility, tab-order hazards, ARIA references, landmarks and accessible control names across 69 states. | Overwrites `accessibility.json` in the selected review output directory. |
| `review-screenshots.mjs` | Full-page screenshots for all 207 route/viewport combinations. | Requires `before`, `after`, or `current`; writes/overwrites 207 PNGs below that subdirectory. |

For an ordinary verification run, direct output to a temporary directory. The
`current` screenshot mode is accepted only with this override, so it cannot
silently alter the tracked baseline pair:

```powershell
$env:APP_BASE='http://127.0.0.1:8848/#'
$reviewOutput = Join-Path ([System.IO.Path]::GetTempPath()) ('service-portal-review-' + [guid]::NewGuid().ToString('N'))
$env:REVIEW_OUTPUT_DIR=$reviewOutput
node scripts/review-audit.mjs
node scripts/review-accessibility.mjs
node scripts/review-screenshots.mjs current
Remove-Item Env:REVIEW_OUTPUT_DIR
```

Without `REVIEW_OUTPUT_DIR`, the JSON generators overwrite the tracked files in
`docs/review-assets/`, while `before` and `after` write the tracked screenshot
pair. Refresh those artifacts only as one deliberate review operation from the
appropriate revisions. Never add a new route to only one side of the pair, and
update `docs/accessibility-review.md` together with any tracked refresh.

> The driver kills each launch's full Edge process tree on close (matched by its throwaway `--user-data-dir`), so repeated runs don't pile up zombie processes and starve the machine.

## `lib/cdp.mjs`

The shared CDP driver: `launch({ port, webgl })`, `openPage(cdp, url)` →
`{ evaluate, exceptions, consoleErrors, closeTarget }`, plus `APP_BASE` / `EDGE` /
`sleep`. `webgl: true` enables SwiftShader so MapLibre renders headless.

### Gotchas (baked into the helpers)

- **App base path is configurable** — the default matches `serve.mjs`; set
  `APP_BASE` for another port or mount path.
- **SPA renders async** (fetch + dynamic import): probes poll for a selector
  before asserting.
- **WebGL:** use `webgl: true` (SwiftShader); never `--disable-gpu`. Map markers
  are DOM elements, not GeoJSON layers (which don't tick headless).
- **`window.__login()` re-renders and destroys the JS execution context**, so a
  single `evaluate` spanning it rejects (`-32000`). Split into two evaluates with
  a delay — see `test-login.mjs`.
