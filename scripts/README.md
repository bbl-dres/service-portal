# scripts/ — verification scripts

Dependency-free browser tests for the prototype, matching the app's no-build /
no-`node_modules` philosophy. They drive **headless Edge over the Chrome DevTools
Protocol** from Node (using the global `WebSocket`, Node ≥ 22) — no puppeteer.
Each test opens the real app, runs an in-page probe, and asserts on the result,
exiting non-zero on failure.

There are currently 20 `test-*.mjs` functional suites and 21
`check-*.mjs` focused layout probes. Every script follows the same contract:
`APP_BASE` selects the running app and a non-zero exit code means failure.

**Sessions.** `openPage(cdp, url, { login })` decides which session the page
STARTS with, by writing (or clearing) `bbl_session_v1` before the first
application script runs. Left unset it is derived from the URL: routes under
`#/app/…` start **logged in**, because the specialist applications sit behind a
login gate (`js/router.js`). Two cases must say so explicitly:

- checking the **gate itself** → `{ login: false }` (see `test-tabs.mjs`);
- a gated route **outside** `#/app/…`, i.e. `#/my-cases` → `{ login: true }`.

Scripts that open one page and then walk routes by hash — `test-routes.mjs`
and the three `review-*.mjs` — pass `{ login: true }` once at the top.

## Prerequisites

1. **Dev server running.** From wherever the app is served, e.g.:
   ```
   python -m http.server 8000
   ```
2. **`APP_BASE` must match where the app is served.** The default assumes the
   server is rooted at the user's home directory (so the app is at
   `/Documents/GitHub/service-portal/`). If you serve from the **repo root**,
   override it:
   ```
   APP_BASE=http://localhost:8000/# node scripts/test-tabs.mjs
   ```
3. **Edge** at the default install path, or override `EDGE_PATH`.

## Functional tests

The table calls out the broad and review-critical suites; the authoritative
inventory is `scripts/test-*.mjs`.

| Script | What it checks |
|---|---|
| `test-tabs.mjs` | D1 tab component (`C.tabBar`/`C.tabPanels`/`C.wireTabs`) across portfolio · projects · dataportal: panel toggling, `aria-selected`, roving `tabindex`, focus-follows-active, keyboard (Arrow/Home/End), hash sync. Plus the logged-out gates for the action apps. |
| `test-login.mjs` | Logs in via the `window.__login` stub and asserts the standalone Room Booking route renders its form instead of the login gate. |
| `test-workspace.mjs` | Standalone Workspace Management planning surface: no legacy tabs, live capacity scenario, floor-plan interaction, and desktop/mobile containment. |
| `test-room-booking.mjs` | Room Booking on the one-page, direct-booking surface (`docs/room-booking-redesign.md`): search bar, quick choices, group size, invalid time range, equipment filter, the favourites store, the floor-plan and map dialogs, the booking dialog and its validation, process creation, personal bookings, the `?room=` deep link, and desktop/mobile containment. |
| `test-document-archive.mjs` | Bauwerksdokumentation: reduced six-column table, KBOB document types, filename extensions, plain building cells, and viewer metadata at desktop/mobile widths. |
| `test-catalogue.mjs` | D2 catalogue triplet (`C.catalogueHash`/`C.catalogueControls`/`C.wireCatalogue`) across services · applications · katalog: deep-link round-trips (q/view/filter), search-submit / view-switch / filter interactions, active-filter pill removal, the services multi-value `topic`, and detail-view render. |
| `test-forms.mjs` | D3 form helpers (`C.field`/`C.select`/`C.val`/`C.readForm`) + the C5 fix across the three wizards: renders, a custom validation error attaches `input--error`+`aria-invalid`+badge to the previously class-less fields (`#org`/`#cc`/`#beschreibung`/`#datum`), and a valid submit creates a Vorgang. Logs in via the stub first. |
| `test-content.mjs` | D4 download-item + contact-box unification: the pages rendering `C.downloadItem` (grundlagen, anleitungen, digitalisierung, application entries, my-cases attachments) and `C.contactBox` (application, services detail) render with the expected items / mailto links and no exceptions. |
| `test-combobox.mjs` | Shared `createListboxController`: Arrow keys, active descendant, selection, Escape/Tab close behavior and cleanup for global suggestions and address search. |
| `test-apidocs.mjs` | Swagger adapter semantics, H2 hierarchy, stable accessible names/language, target sizes and focus styling. |
| `test-process-docs.mjs` | Process detail tabs plus the full-width BPMN viewer, vertical overlay controls, reset action and disabled/focus states. |
| `test-shop.mjs` | Shop catalogue, product/cart/checkout flows, global top-header cart and responsive category disclosure. |
| `test-race.mjs` | A2 router render-race: rapid navigation between an awaiting page (application detail) and another must always land on the last-requested page (the `ctx.stale()` guard drops stale renders), across several timings and both directions. |
| `test-dashboard.mjs` | Datenportal redesign on a generic sql-spec dashboard: the Superset-style grey-canvas/white-card framing, full-height filter panel, footer, dashboard toolbar menu (`copy link`) and per-chart menu (fullscreen overlay, CSV/PNG export). Saves a screenshot to `$SHOT`. |
| `test-estate.mjs` | Immobilienportfolio record-based dashboard (`js/apps/estate.js`): the three tabs (Gebäude/Grundstücke/Bodenbedeckung), KPIs, runtime-aggregated charts, the worldwide CARTO map with markers, and live filtering (Land=CH shrinks the building count). Saves a screenshot to `$SHOT`. |

Run every functional suite in PowerShell:

```powershell
Get-ChildItem scripts/test-*.mjs | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE) { exit $LASTEXITCODE }
}
```

## Design review

| Script | What it checks |
|---|---|
| `review-routes.mjs` | Shared inventory of 57 representative routes and states plus the 320/768/1440 viewport matrix. |
| `review-audit.mjs` | Overflow, H1/heading structure, IDs, names, image/table semantics and responsive target-size policy across 171 renders. |
| `review-accessibility.mjs` | 200% reflow proxy, keyboard focus visibility, tab-order hazards, ARIA references, landmarks and accessible control names across 57 states. |
| `review-screenshots.mjs` | Full-page `before`/`after` screenshots for all 171 route/viewport combinations. |

```powershell
$env:APP_BASE='http://127.0.0.1:8848/#'
node scripts/review-audit.mjs
node scripts/review-accessibility.mjs
node scripts/review-screenshots.mjs after
```

> The driver kills each launch's full Edge process tree on close (matched by its throwaway `--user-data-dir`), so repeated runs don't pile up zombie processes and starve the machine.

## `lib/cdp.mjs`

The shared CDP driver: `launch({ port, webgl })`, `openPage(cdp, url)` →
`{ evaluate, exceptions, consoleErrors, closeTarget }`, plus `APP_BASE` / `EDGE` /
`sleep`. `webgl: true` enables SwiftShader so MapLibre renders headless.

### Gotchas (baked into the helpers)

- **App base path is environment-specific** — see `APP_BASE` above.
- **SPA renders async** (fetch + dynamic import): probes poll for a selector
  before asserting.
- **WebGL:** use `webgl: true` (SwiftShader); never `--disable-gpu`. Map markers
  are DOM elements, not GeoJSON layers (which don't tick headless).
- **`window.__login()` re-renders and destroys the JS execution context**, so a
  single `evaluate` spanning it rejects (`-32000`). Split into two evaluates with
  a delay — see `test-login.mjs`.
