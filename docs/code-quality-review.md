# Cross-portal code review — 2026-08-22

Senior-developer review of both prototypes on the same footing as the design
alignment (`design-alignment.md`): investigate, document, decide, implement.
Scope requested by the product owner: bugs, race conditions, performance,
**consistent loading feedback** (the service portal's grey spinner as the
reference), duplication worth merging into reusable functions, dead code —
plus reviewer-chosen topics (escaping consistency, listener lifecycle,
`needs`/data-loading discipline, ARIA correctness).

The two apps deliberately remain **independent codebases** (different
ambition levels); alignment here means the same engineering standards and the
same loading vocabulary, never shared modules across the repos.

Finding ids: **F-T*n*** = tenant-portal, **F-S*n*** = service-portal. Every
implemented fix carries its id as a code comment at the call site.
Status: ✅ fixed in this review · 📋 documented, deliberately deferred.

---

## 1. tenant-portal (Mieterportal)

### Bugs

| # | Finding | Status |
|---|---|---|
| F-T1 | `icon('filter')` returned `''` — the ICONS map never registered the existing `Filter.svg`, so every filter-toggle button in the app (properties, downloads, inbox, queue, data tables) rendered without its glyph | ✅ one-line map entry (`js/lib.js`) |
| F-T4 | Inbox/queue in-page quick filter contradicted URL pagination: typing on page 2 rewrote the tbody with **all** matches while the footer still claimed «26–50 von 60» | ✅ shared `wireStatusFilter` shows all matches **and hides the pagination chrome** while a filter is active; clearing restores the page slice (`js/app.js`) |
| F-T5 | Doc-viewer prev/next collected `[data-doc-id]` triggers document-wide — including the *hidden* other view surface and a previous filter's stale gallery cards | ✅ triggers inside `[hidden]` ancestors are skipped |
| F-T6 | The Umzug form silently discarded five typed fields (extras, notes, phone) and the cleaning form one — `spec.fields` did not list them; checkbox values also rendered as `on` | ✅ field maps completed; `on` → «Ja» |
| F-T7 | `propertyAside` dereferenced `t.contacts.pfm` unguarded → TypeError blanked the Übersicht panel for a tenancy without contacts | ✅ optional chaining (aside + the three `sent` toasts) |
| F-T13 | `renderNewsList` declared a local `const state`, shadowing the imported state singleton | ✅ renamed `filterState` (38 tokens) |
| F-T17 | `#/home` redirect stamps `data-route` on a never-rendered page for one tick (route-generation counter vs queued hashchange) | 📋 cosmetic; visible only to the test readiness hook |

### Races & leaks

| # | Finding | Status |
|---|---|---|
| F-T14 | The info scroll-spy `IntersectionObserver` outlived its route — it disconnected only when *another* info page rendered | ✅ `teardownInfoSpy()` called from `handleHash` on every navigation |
| F-T15 | An in-flight swisstopo lookup survived leaving `#/properties`; its `.then` then touched the detached input | ✅ controller aborted in `handleHash`; `input.isConnected` guard |
| F-T16 | The queue text filter re-binds a document-level keydown handler per keystroke (`wireQueueShortcuts` remove+add) | 📋 correct (no stacking), just churn; a delegated handler reading rows lazily would be nicer |

### Loading UX (see §3 for the shared recipe)

| # | Finding | Status |
|---|---|---|
| F-T2 | **Cold boot was a blank white page** while 12 JSON files (~184 KB) loaded; only the failure path painted anything | ✅ portal busy state paints before `loadData` (`.boot-loading`) |
| F-T3 | Property/floor detail awaited ~470 KB of spatial geometry **before painting anything**, after `handleHash` had already torn down the previous page's maps — a dead click on cold cache | ✅ chrome + breadcrumb + busy state paint first; the fetch only feeds the plans further down |
| F-T20 | The image lightbox swapped `src` with no feedback — empty dark stage until decode | ✅ `aria-busy` ring on `.gallery__stage` (load/error settled) |
| F-T21 | The doc viewer built up to 10 sheet templates synchronously into a black overlay, on open and on every ←/→ | ✅ chrome paints with the busy state; sheets fill on the next frame |
| — | Maps (portfolio/locator/floor), swisstopo combobox, API-docs already had spinners; images ship `lazy` + dimensions throughout | reference ✔ |

### Security / robustness

| # | Finding | Status |
|---|---|---|
| F-T8 | `renderReviewerSplit` interpolated ~8 record fields unescaped (`a.id`, `a.type`, `a.submitterVe`, asset key, EGID, NAW class, attachment names) while sibling fields on the same lines were escaped | ✅ all through `P.escapeHtml` |
| F-T9 | `caseOverviewPanel` asset-key `<code>` unescaped (the EGID one line below was escaped) | ✅ |
| F-T10 | `queueRowHtml` put `a.id` raw into attributes, cell text and five inline `location.hash` handlers — while the aria-labels of the same values were escaped | ✅ `escapeHtml` + `escapeJs`, one shared `open` string |
| F-T11 | `caseRowHtml` onclick, map-popup and property-card hrefs built from unsanitised ids | ✅ `escapeJs`/`escapeHtml`/`encodeURIComponent` |
| F-T12 | `loadData` never checked `res.ok` (404s failed only because JSON parsing choked on the error page) and optional files swallowed failures silently — a malformed `i18n.json` blanked every label with no trace | ✅ explicit `res.ok`, `console.warn` on optional fallbacks |

### Dead code

| # | Finding | Status |
|---|---|---|
| F-T23 | Twelve unreachable `if (!P.state.user) …` guards — `handleHash` already gates every non-public route (and the guard even contradicted the gate: bounce vs. login view) | ✅ removed (two fell to the F-T3 rewrite, ten swept) |
| F-T24 | `openRoleMenu` + the `.role-switch-btn` CSS block: unreachable since the D43 role-row deletion; nothing called the programmatic hook | ✅ deleted (demo personas live in `t3lite.demoRole`) |
| F-T25 | The whole `.news-list*` CSS component (+ header block, + two «retired» comments) orphaned by the D46 rewrite onto the shared `.search-result*` renderers | ✅ deleted |
| F-T26 | `.top-header__action` (singular) styled a button that no longer exists — only the plural container has markup | ✅ deleted (+ its 3xl ramp reference) |
| F-T27 | 38 i18n keys unreferenced in any language (re-verified against literal `t()` calls, data-driven `titleKey`/`shortKey`/`doctype.*`/`info.*` lookups **and** prefix-built keys before deletion; `footer.accessibility` proved live and stayed) | ✅ deleted — ~150 strings translators no longer maintain |
| F-T28 | `PIPELINE_*` constants imported + re-exported on `window.portal` but never read there | ✅ references removed (the constants stay in `lib.js`, where `renderPipeline` uses them) |

### Duplication merged

| # | Finding | Status |
|---|---|---|
| F-T30 | `wireInboxFilters` / `wireQueueFilters` were the same function twice | ✅ one `wireStatusFilter({prefix, tbodyId, rows, rowHtml, colspan, matchText, afterDraw})` — which is also where F-T4 got fixed once |
| F-T31 | `caseTabHash` / `propertyTabHash` byte-identical | ✅ one `tabHash(base, key)` |
| F-T22 | Four identical zero-argument panel functions returning `'<div id="propTable"></div>'`, called with arguments none declared | ✅ collapsed into `renderPropertyTab` |
| F-T32 | `searchResultRow` / `searchResultCard` shared every line but the wrapper | ✅ one `searchResultItem(r, variant)` (+ hrefs now escaped) |
| F-T33 | Four hand-rolled hash builders (`searchHash`, news `hashFor`, `buildPropertiesHash`, downloads) that already disagree about `lang` handling | 📋 one `buildHash(base, params, defaults)` recommended; deferred — URL strings are load-bearing in tests and the four differ subtly by design (`lang` yes/no) |
| F-T34 | Three combobox controllers with the same keyboard contract but three blur delays and three active-index rules (~250 lines) | 📋 `wireCombobox({input, list, getItems, onPick})` recommended; deferred as the highest-risk refactor in the file |
| F-T35 | Three service intake forms are 60-line copies (shell, tenancy select, sticky footer, phone field) | 📋 render side could take the same `spec` the submit side already uses; F-T6 fixed the actual bug |

### Performance

| # | Finding | Status |
|---|---|---|
| F-T18 | ~30 `getComputedStyle` calls at module evaluation (map palettes), frozen against skin changes | 📋 lazy getters recommended; cost is small and the skin class is static in `index.html` |
| F-T19 | Properties live-search rebuilds the full results region (12 image cards + pagination) per keystroke, debounced 140 ms | 📋 tbody-only redraw à la `mountDataTable` recommended |

---

## 2. service-portal (Kundenportal)

The router lifecycle (`ctx.onUnmount`; `#main-content` **persists** for the
tab's life) is the contract every finding in §2.2 measures against.

### Bugs

| # | Finding | Status |
|---|---|---|
| F-S2 | Module-scope `aktuellPage` survived *navigations*, not just repaints — returning from `#/news` reopened the carousel mid-deck | ✅ reset at render start |
| F-S8 | Carousel dots: `role="tablist"` with non-tab children reads as an **empty tab list** to AT; dots also missed `type="button"` | ✅ `role="group"` + `type="button"` |
| F-S13 | `rows.length === 1 ? 'Treffer' : 'Treffer'` — dead ternary («Treffer» is invariant German; the branch was noise) | ✅ ternary dropped |
| F-S24 | `n.teaser.length` unguarded in the home carousel card: one teaser-less news record turned the whole home page into the router's error view | ✅ null-guarded |
| F-S26 | `pagination()` without `inputId` rendered `id="undefined"` — two paginations on a page collided; the id also skipped `escape()` | ✅ label-derived fallback id + escaped |
| F-S35 | `engine.load(source)` silently drops the argument of a concurrent second call | 📋 benign today (both callers pass `core`); noted as a fragile contract |

### Races & leaks

| # | Finding | Status |
|---|---|---|
| F-S1 | **The Aktuell-carousel click handler attached to the persistent `#main-content` without `ctx.onUnmount`** — every visit to `#/` stacked another handler (N section rebuilds per click, N pinned closures, work on every click on every other route, forever). Introduced with D51; the two listeners right below it used the contract correctly | ✅ named handler + `onUnmount` removal; scoped to `.news-section` |
| F-S9 | The carousel repaint (`outerHTML`) destroyed the activated control — focus fell to `<body>` silently (WCAG 2.4.3) | ✅ focus restored to the successor control (same dot / same arrow, fallback to the enabled one) |
| F-S10 | A source-checkbox tick re-rendered the **entire home page** (hero, tables, cards, carousel) to change one sentence — and re-entered `render`, stacking one more carousel listener each time | ✅ only the `.search-sources` control repaints + rewires |
| F-S18 | The suggest index `CACHE` was built after a swallowed `ensure().catch()` — a failed first keystroke locked in an **empty index for the session**, despite `core:data-loaded` existing for exactly this | ✅ cache dropped on `core:data-loaded` |

### Loading UX

| # | Finding | Status |
|---|---|---|
| F-S5 | Six of nine map surfaces (portfolio, projects, tenancies, workspace, media-library ×2) mounted an **empty grey box** for the whole MapLibre-CDN phase — the spinner only appeared after the library arrived; estate/room-booking/fpe-browse already pre-filled with `C.loading` | ✅ all six pre-fill with `C.loading({label:'Karte wird geladen…'})` (cleared by `buildings-map` as designed) |
| F-S19 | The my-cases favourites band dropped in below the table with no placeholder — a hard layout shift | ✅ slot holds the grey spinner; every early-exit clears it |
| F-S20 | The gallery lightbox swap showed a blank stage on cold images (pre-warm covers ±1 only; deep links and metadata jumps uncovered) | ✅ `aria-busy` ring on the stage |
| F-S25 | Query-only route changes bypass the router's spinner — correct for warm caches, an unexplained freeze on a cold first `?view=map` (CSS sheet + data) | 📋 a delayed (~150 ms) busy affordance recommended |
| F-S21 | Every detail-page hero was forced `loading="lazy"` (the LCP element) — `heroFigure` didn't forward the option `photo()` already supports | ✅ `loading` forwarded; services/digitalisation/application/catalog heroes now eager |
| F-S37 | The two `<img>` outliers without `loading`/`decoding` (shop product hero, floor-plan inspector preview) | ✅ attributes added |
| — | The `[aria-busy]` CSS state contract exists across ~14 component files but only plan-check ever *sets* it | 📋 adopt per-control busy on future async actions |

### Dead code

| # | Finding | Status |
|---|---|---|
| F-S15 | `sourceBox` — exported, barreled, on `C`, **zero call sites** (the adoption its comment planned never happened) | ✅ deleted; the referencing comment in architecture.js updated |
| F-S28 | `wireSearchField` exported with no external consumer | ✅ un-exported (stays module-internal) |
| F-S29 | `catalog` double-exported (named + default); nothing imports the named one | ✅ named export dropped |
| F-S30 | Verified-dead CSS: `.photo--scrim/--fill/--overlay-*`, the `.badge--clickable` block, `.separator--xl/--negative/--md`, `.link--block` (+adjacency), `.row--end`, `.grid--auto` (+print reset ref), `.hero__cta`, the dead `.notification-banner__actions .btn` selector | ✅ deleted (`.badge--base` deliberately kept: `badge()` accepts `size:'base'`, so the alias is reachable API) |
| F-S31 | Leftover empty `${ '' }` template interpolation in dataportal | ✅ removed |
| F-S36 | `sourceBox`/`notificationHtml` on `C` but missing from the barrel's named exports (app.js worked around it) | ✅ `notificationHtml` exported; `sourceBox` gone |

### Duplication

| # | Finding | Status |
|---|---|---|
| F-S14 | `js/crumbs.js` adopted by all 17 apps and zero pages; 31 hand-written `Startseite` literals; application.js kept a character-identical private copy of `APPLICATIONS` | ✅ application.js now imports the registry; 📋 the remaining page-module sweep is mechanical and recommended |
| F-S11/12 | The news page re-implements catalogue state parsing, the results header and pagination | 📋 **declined by design**: the news page renders the CD `newsList.vue` anatomy shared byte-for-byte with the tenant portal (design D46), and its German URL params (`herausgeber`, `von`, `bis`, `seite`) are the cross-portal contract — migrating to `C.catalogueBar` would undo that alignment. The a11y half of F-S12 (aria-disabled links on edge pages) **was** fixed: real disabled `<button>`s now, as `C.pagination` documents |
| F-S22 | `wireCatalogue` vs `wireCatalogueState` — two wirings of the same six behaviours, already drifted (fmore disclosure, panel persistence, delegation style) | 📋 fold into one parameterised wiring; medium risk, touches every catalogue |
| F-S23 | estate.js carries a third `[data-fmore]` disclosure with a label toggle the shared version lacks — same control, different behaviour on two routes | 📋 lift the label toggle into the shared wiring, delete the copy |

### Performance

| # | Finding | Status |
|---|---|---|
| F-S3 | The full search index (fold+tokenise+stem, several hundred rows) was rebuilt on **every** render — each checkbox tick, each answers toggle | ✅ module cache, invalidated on `core:data-loaded` (the suggest index's documented pattern) |
| F-S4 | Up to three full `runSearch` passes per render (complement probe + per-word no-results probe) | 📋 acceptable once F-S3 landed (the probes are `LIMIT 1`-shaped by design); revisit if the corpus grows |
| F-S6 | Portfolio `needs` eagerly loads 9 datasets (~150 KB+ of geojson) for a **list** view; 7 of 9 feed only detail tabs | 📋 convert to `needs(params)` like data.js/my-cases; deferred — portfolio's tabs read them in mixed places and deserve a careful pass |
| F-S7 | The home route blocked on `applications.json` (~85 KB) to resolve **four tile images** | ✅ off the `needs` list; cards render their placeholder tiles and the images patch in when the file lands |
| F-S16 | German-date regex parsing inside the sort comparator (~2·n·log n) | ✅ precomputed `Map`, linear |
| F-S17 | my-cases list loaded `buildings`+`projects` (detail-only); services loaded `documents` for a counter that exists only while searching | ✅ both `needs` are functions of params/query now |
| F-S27 | `engine.instances()` re-parsed and re-normalised localStorage on every call | ✅ memoised; invalidated by `saveLS` and the cross-tab `storage` event |
| F-S34 | `sessionStorage` scroll-map JSON round-trips 2-3× per navigation | 📋 micro; noted |

### Security

Posture is **good** (context-aware `js/security/urls.js`, consistent
`C.escape`/`safeLinkUrl`, every `JSON.parse` guarded). One consistency nit
fixed: `process-docs` rendered the same href escaped in one table and bare in
another (✅ `esc()` added). F-S32's other bare interpolations are provably
safe (encodeURIComponent/constants) and stay.

---

## 3. Loading-UX alignment (the shared recipe)

The product owner's reference is the **service portal's grey spinner**. That
recipe — one producer, muted-grey ink, reduced-motion kill switch, SR
announcement — is now the standard in both apps:

| | service-portal | tenant-portal |
|---|---|---|
| Producer | `C.loading({label})` → `.loading` + `Spinner.svg` + `.icon--spin` | `renderMapLoading(label)` → `.map-loading` (`role="status"`, sr-label) |
| Ink | `--color-text-muted` (text-600 `#4B5563`) | ✅ now `--color-gray-600` `#4B5563` (was black) |
| Page-level hold | router full-container spinner | ✅ new `.boot-loading` / `.busy-hold` wrappers |
| Reduced motion | `--duration-spin: .01ms` | inherits the transition tokens |
| Covered surfaces | route loads, 9/9 maps, BPMN, Swagger, plan-check, favourites band, lightbox | boot, spatial fetch, 3/3 maps, combobox, API docs, lightbox, doc viewer |
| Images | `C.photo` colour tile + lazy + reserved box | lazy + dimensions throughout; first 3 property cards eager |

Remaining, documented: service query-only route changes (F-S25); the broad
`[aria-busy]` CSS contract having one JS producer.

---

## 4. What deliberately stays as it is

- **Two independent codebases.** No shared modules were introduced across the
  repos; parity is in standards and vocabulary (busy states, escaping,
  lifecycle discipline), matching the two-ambition-levels setup.
- The **news pages keep their page-local state/hash code** (F-S11/12): their
  anatomy and URL scheme are the cross-portal design contract (D46), not an
  internal catalogue.
- `.badge--base`, `.notification__close`, `--hint`/`--alert` variants etc.
  stay as **DS-parity API surface** — reachable through component options,
  documented as such in the CSS.
- The tenant's `t3lite`/`portal` window namespaces and inline `onclick`
  wiring: idiomatic for its single-file architecture; the review normalised
  escaping inside them rather than rewiring the app.

## 5. Verification

- tenant: `npm test` (ESLint + domain units + CD token guard) green after
  every batch; full Playwright battery green — header-chrome 27/27,
  mobile-nav 12/12, prototype-notice 32/32, mobile-layouts 30/30,
  detail-tables, media-viewer 41/41, property-images 8/8, spatial-tree,
  search-improvements, responsive a11y sweep 0 failures.
- service: 21-script CDP battery green (routes, content, search, ui-state,
  login, banner, catalogue, tabs, forms, focus, html-contracts, css-layers,
  css-tokens 345 props, ramps, hero-layout, workspace, tenancies, portfolio,
  process-docs, metadata-catalog, lifecycle-hygiene).
- Two guard regressions caught **by the guards themselves** during the work
  (service css-token breakpoint convention; tenant eslint unused-vars) — both
  fixed before landing, which is those guards doing their job.
- One **pre-existing test/feature drift** surfaced by the full battery:
  `test-lifecycle-hygiene` expected an emptied search field to show zero
  options, but the deliberate examples-on-empty feature
  (`search-suggest.js showExamples`) renders the «Beispiele» rows —
  reproduced at pristine HEAD via a stash round-trip, so not introduced
  here. The check now asserts what it was written for: no **stale query
  results** may paint over the emptied field (examples are allowed).
