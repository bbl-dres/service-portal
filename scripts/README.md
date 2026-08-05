# scripts/ — verification scripts

Dependency-free browser tests for the prototype, matching the app's no-build /
no-`node_modules` philosophy. They drive **headless Edge over the Chrome DevTools
Protocol** from Node (using the global `WebSocket`, Node ≥ 22) — no puppeteer.
Each test opens the real app, runs an in-page probe, and asserts on the result,
exiting non-zero on failure.

> These grew out of verifying specific code-review fixes. A proper test strategy
> (a runner, CI, broader coverage) is a later task — for now they are runnable,
> reusable smoke tests worth keeping.
>
> Die Tabellen unten decken die ÄLTEREN Suiten ab; inzwischen gibt es je
> `test-*.mjs`-Suite und `check-*.mjs`-Layoutprobe eine Datei mehr, als hier
> steht — massgebend ist `ls scripts/test-*.mjs scripts/check-*.mjs`. Alle
> folgen demselben Muster (APP_BASE-Umgebungsvariable, Exit ≠ 0 bei Fehlern);
> Neuzugang der Konsistenz-Review: `check-consistency.mjs` (skin-bewusste
> Computed-Style-Proben, docs/design-review.md).

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

## Tests

| Script | What it checks |
|---|---|
| `test-tabs.mjs` | D1 tab component (`C.tabBar`/`C.tabPanels`/`C.wireTabs`) across portfolio · projects · dataportal: panel toggling, `aria-selected`, roving `tabindex`, focus-follows-active, keyboard (Arrow/Home/End), hash sync. Plus the logged-out gates for the action apps. |
| `test-login.mjs` | Logs in via the `window.__login` stub and asserts the standalone Room Booking route renders its form instead of the login gate. |
| `test-workspace.mjs` | Standalone Workspace Management planning surface: no legacy tabs, live capacity scenario, floor-plan interaction, and desktop/mobile containment. |
| `test-room-booking.mjs` | Room Booking: search, list/floor-plan views, location and room context, invitees, process creation, personal bookings, and desktop/mobile containment. |
| `test-document-archive.mjs` | Bauwerksdokumentation: reduced six-column table, KBOB document types, filename extensions, plain building cells, and viewer metadata at desktop/mobile widths. |
| `test-catalogue.mjs` | D2 catalogue triplet (`C.catalogueHash`/`C.catalogueControls`/`C.wireCatalogue`) across services · applications · katalog: deep-link round-trips (q/view/filter), search-submit / view-switch / filter interactions, active-filter pill removal, the services multi-value `topic`, and detail-view render. |
| `test-forms.mjs` | D3 form helpers (`C.field`/`C.select`/`C.val`/`C.readForm`) + the C5 fix across the three wizards: renders, a custom validation error attaches `input--error`+`aria-invalid`+badge to the previously class-less fields (`#org`/`#cc`/`#beschreibung`/`#datum`), and a valid submit creates a Vorgang. Logs in via the stub first. |
| `test-content.mjs` | D4 download-item + contact-box unification: the pages rendering `C.downloadItem` (grundlagen, anleitungen, digitalisierung, application entries, my-cases attachments) and `C.contactBox` (application, services detail) render with the expected items / mailto links and no exceptions. |
| `test-race.mjs` | A2 router render-race: rapid navigation between an awaiting page (application detail) and another must always land on the last-requested page (the `ctx.stale()` guard drops stale renders), across several timings and both directions. |
| `test-dashboard.mjs` | Datenportal redesign on a generic sql-spec dashboard: the Superset-style grey-canvas/white-card framing, full-height filter panel, footer, dashboard toolbar menu (`copy link`) and per-chart menu (fullscreen overlay, CSV/PNG export). Saves a screenshot to `$SHOT`. |
| `test-estate.mjs` | Immobilienportfolio record-based dashboard (`js/apps/estate.js`): the three tabs (Gebäude/Grundstücke/Bodenbedeckung), KPIs, runtime-aggregated charts, the worldwide CARTO map with markers, and live filtering (Land=CH shrinks the building count). Saves a screenshot to `$SHOT`. |

Run:
```
node scripts/test-tabs.mjs
node scripts/test-login.mjs
node scripts/test-catalogue.mjs
node scripts/test-forms.mjs
node scripts/test-content.mjs
node scripts/test-race.mjs
node scripts/test-dashboard.mjs
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
