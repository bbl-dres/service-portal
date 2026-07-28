# Code Review — BBL Kundenportal

_Senior engineering review of the whole repository with fresh eyes. Focus: performance, redundancy, bugs and race conditions, simplification._

**Method.** Six independent reviewers, one per lens — performance · bugs & races · redundancy · CSS health · data layer · tests — each required to verify every claim against the source and cite `file:line`, and to drop anything it could not confirm. Findings marked **reproduced** were additionally driven against the running app, not only read.

**Scope.** ~10 800 lines of JS across 40 ES modules · 3 019 lines of `css/app.css` · 24 JSON data files · 11 headless CDP suites.

---

## Verdict

The architecture is sound. The component layer is genuinely load-bearing — `C.card`, `C.table`, `C.catalogueBar`, `C.catalogueResults`, `C.mountDataTable` are used widely and correctly — and the data/session/storage layer is properly guarded. Nothing here argues for a rewrite.

Three root causes account for almost every serious finding:

1. **There is no teardown step.** The router replaces `#main-content.innerHTML` and does nothing else. Maps, observers, media-query listeners and overlays outlive the route that created them. One missing hook is the root cause of six findings, three of them high severity.
2. **The state arithmetic around the catalogue components was never factored out.** The components are shared; the ~45 lines of parse → filter → sort → paginate → build-hash glue between them is copy-pasted across five pages, and two explorers are near-verbatim copies of each other.
3. **Boot is serial and total.** Nothing renders until all 21 data files have loaded and normalised, including files only one route ever reads.

A fourth, quieter theme runs through the CSS and the tests: **several safeguards do not actually guard anything.** Two utility layers are outranked by the components they were meant to override, and the assertion that eleven suites rely on to mean "nothing broke" cannot observe a failed render. Details in §4 and §6.

---

## 0 · Status — fix pass of 2026-07-28

**12 of 12 suites green** (11 CDP + the new `test-data-integrity.mjs`). Each item below was measured before and after, several with a deliberately injected fault to prove the check is not vacuous.

| Item | State | Evidence |
|---|---|---|
| **H1** route teardown | fixed | `ctx.onUnmount(fn)`; cleanups drained at the top of `dispatch()`. Registered in portfolio, projects, estate, dataportal, mediathek (2×), building-create |
| **H2** `mountDataTable` observer leak | fixed | previous `wireScrollRegions` unwired before each redraw; returns a teardown |
| **H3** map render race | fixed | `mapTicket` token; a superseded map is removed instead of assigned. Uncovered a live comma-operator bug — `initEstateMap((el, points, parcels, focus))` passed only `focus` |
| **T1** blind assertion | fixed | `p.problems()` = exceptions + console errors + app error banner, applied to all 11 suites. `.error-summary` (form validation) excluded — it reports bad *input*, not a defect. Self-tested: clean → `[]`, form summary → `[]`, app banner → reported |
| **H10** engine fabricates definitions | fixed | `start()` returns `null` for an unknown defId instead of inventing steps; engine has core's failure register and feeds the shell band. Proven: `start('gibt-es-nicht')` → `null`, **0 records written**, error logged |
| **H11** dead service→process binding | fixed | `processDefId` is now read: the service page renders the actual process ("So läuft es ab", real step counts). `test-data-integrity.mjs` guards both directions + code literals; proven by simulating a rename (`buchung` → `buchung-neu`) → 2 failures |
| **H8** rail rendered as links | fixed | `plain-link` added. Inactive `#1f2937` (= `--color-text`), active primary-700, no underline — was: both primary, underlined |
| **H9** banner padding | fixed | doubled class; `32px 0` instead of `16px`, wrapper aligns with page chrome (offset 0) |
| **M12** placeholder tile cursor | fixed | base rule moved above its modifier; `zoom-in` / `default`. Latent in the current inventory (0 placeholder tiles), verified by attaching both classes directly |
| **M13** catbar chevron | fixed | `14px` (1em) instead of `19.6px`. `.btn .icon` left as-is: button icons scaling with the button is CD's intent, now documented at the rule |
| **H4** boot loads everything | fixed | `core.ensure()` + per-route `needs`. Boot **21 files / ~350 KB → 14 files / 118 KB (−66 %)**; `datasets` arrives with the catalogue, the six detail registers with the portfolio. Verified cold into a detail: Flächen 6 · Ausstattung 5 · Verträge 3 · Kosten 7 · Dokumente 4 · Kontakte 3 |
| **M17** orphaned instance | fixed | no empty pipeline and no "abgeschlossen"; an honest "Ablauf nicht verfügbar" notice. Verified with an injected orphan record |
| **M18** invisible dashboard failure | fixed | `dashData.ok()`; with the file removed: 0 cards + load-error message (was: 6 cards, no error — the first probe was fooled by the HTTP cache) |
| **M19** api-docs drops the name | fixed | `s.name` → `s.title`; services carry `title` on 20/20 |
| **M20** `readJSON` validates nothing | fixed | optional `valid` predicate; session requires a non-empty `name`. Verified: `bbl_session_v1 = 1` and `{org:'X'}` both → logged out |

**Open**, in the recommended order: H5 → H7 → H6 → M1 (the ~430-line consolidation block) · T2–T5 · M16, M21, M8–M10, L4, L5.

---

## 1 · Fixed during the review

**Stacked gallery listeners on the media detail page** — `js/apps/mediathek.js:343`

The click handler was bound to `mount`, which is the router's persistent `#main-content` node; `innerHTML` swaps never drop listeners bound to it, so every visit added another handler with its own captured items.

**Reproduced:** navigating `MED-001 → MED-002 → MED-004` and clicking the image opened **3 stacked lightboxes**. After the fix: 1. The handler now binds to the per-render `.container.section`, which is destroyed with its listener on each re-render.

Introduced in this session, so fixed immediately rather than filed.

---

## 2 · High severity

### H1 · No route teardown: MapLibre instances are never freed
`js/router.js:200-278` · leaks at `js/apps/estate.js:285`, `js/apps/dataportal.js:253`, `js/apps/portfolio.js:602,684`, `js/apps/mediathek.js:225,349`, `js/apps/building-create.js:451`

Each module frees its map only from *its own next render* (`freeMap()` / `freePfMap()` in a per-render closure starting at `null`). Navigating away strands a live `maplibregl.Map` — WebGL context, rAF loop, resize listeners, in-flight tiles. Mediathek is worse: it never keeps the handle (`initEstateMap(el, …).catch(…)`), so `map.remove()` is unreachable by construction.

Browsers cap live WebGL contexts around 16 and silently drop the oldest. After roughly a dozen map visits, earlier maps render blank until reload.

**Fix.** Give `ctx` an `onUnmount(fn)` registry that `dispatch()` drains at the start of the next dispatch; register `map.remove()` from every map-mounting module. The same hook resolves H3, M3, M4 and M5.

_Found independently by two reviewers · certain_

### H2 · `mountDataTable` leaks two observers per redraw
`js/components.js:1380` · observers created at `js/components.js:390-393`

`draw()` calls `wireScrollRegions(host)` and discards the returned unwire function. `host` is never replaced — only its `innerHTML` — so every previous `MutationObserver` and `ResizeObserver` stays attached.

Two observers per search submit, sort change, facet toggle and page change, unbounded. After _k_ interactions every subsequent `innerHTML` write wakes _k_ MutationObservers, each running its own `querySelectorAll` + `scrollWidth`/`clientWidth` pass — quadratic in interactions. A building detail page mounts up to six such tables (`js/apps/portfolio.js:590-593`).

The helper's contract is right and the router honours it (`js/router.js:261-262` keeps and calls `unwireScroll`); this one call site ignores it.

**Fix.** Keep the previous unwire in the closure, call it at the top of the next `draw()`, return it from `mountDataTable`.

_Verified: return value discarded at `components.js:1380`, kept at `router.js:262` · certain_

### H3 · `mountMap` race orphans the first map
`js/apps/portfolio.js:173-181` · identical at `js/apps/projects.js:146-151`

In the map view, typing in the search field or clicking a second tree node within ~1 s of the first map loading: `freePfMap()` runs synchronously while `pfMap` is still `null` (the first `initEstateMap` has not resolved), the container is replaced, and both promises then assign `pfMap` in resolution order. The earlier map keeps a WebGL context on a detached container forever. The same overwrite happens between `buildingDetail` and `parcelDetail`.

**Fix.** Take a render token in `mountMap`; on resolve, `map.remove()` if the token is stale or `!el.isConnected`, else push to a list `freePfMap()` drains.

_certain_

### H4 · Boot blocks on all 21 data files before anything renders
`js/app.js:25` with `js/core.js:102-133`

`boot()` awaits `core.load()` — 18 `FILES` entries plus three GeoJSON files, fully normalised — before `renderHeader()` and `initRouter()`. Time-to-first-content is the slowest of 21 requests plus ~350 KB of JSON parse, regardless of route. The home page pays for `datasets.json` (117 KB, read only by `#/data/katalog`), `application-pages.json` (18 KB) and ~86 KB of assets/costs/contracts read by one portfolio tab.

**Fix.** Render the shell and dispatch immediately. Split `core.load()` into a small critical set plus memoised per-key promises awaited by the accessors that need them.

_certain_

### H5 · The hash-catalogue pipeline is reimplemented in five modules
`js/pages/services.js:9-38,67-113` · `js/pages/applications.js:47-78,114-141` · `js/pages/katalog.js:24-71,109-138` · `js/apps/mediathek.js:46-75,145-199` · `js/pages/search.js:108-160,213-218`

The same 40–50 line block five times, differing only in parameter names: multi-value parsing (11 occurrences of the identical `split(',').filter(Boolean)` idiom), `view` coercion, page clamping (5×, plus a sixth at `document-archive.js:90-92`), sort validation (5×), the `base` + `hash()` pair (5×), the active-pill array led by the same search pill (4×), and the `catalogueBar → activeFilters → catalogueResults → announceCatalogue → wireCatalogue` quintet with matching id conventions (5×).

**Fix.** `C.mountHashCatalogue({ mount, query, base, route, all, dims, sorts, perPage, unit, card, listView, mapView, views })` beside the existing `C.mountDataTable`, which already does exactly this for the local-state case. **~140 lines.**

_certain_

### H6 · `portfolio.js` and `projects.js` are the same explorer, copied
`js/apps/portfolio.js:33-362` vs `js/apps/projects.js:9-314`

~180 near-identical lines, most character-for-character: `buildTree()`, `rowContent`/`node`, `treeHTML()`, `markTree()`, `setSelection()`, the sidebar click handler, the `renderMain()` skeleton including pagination, `selPill()`/`renderActiveFilters()`, and the whole filter wiring block — which appears a **third** time at `js/apps/document-archive.js:146-171`.

**Fix.** `C.mountExplorer(host, { objects, tree, filters, sorts, views, renderers })`; at minimum move the tree functions and the filter wiring. **~160 lines.**

_certain_

### H7 · `document-archive.js` hand-rolls `C.mountDataTable`
`js/apps/document-archive.js:42-171` vs the helper at `js/components.js:1304-1386`

The helper already provides local state, search predicate, facet matching, sort lookup, page clamping and slicing, the catbar with count/sort/facets, `C.table`, pagination, empty state, focus preservation and the live-region announce. This module rewrites all ~90 lines. The only gaps — debounced input, hash `replaceState` sync, `.doc-open` delegation — are additive options.

**Fix.** Replace with `C.mountDataTable(...)`; add `onChange(state)` and `debounce` to the helper. **~70 lines.**

_certain_

### H8 · The API-docs nav rail renders as red underlined links
`css/app.css:96-99` vs `:2102-2104` · call site `js/apps/api-docs.js:71`

`#main-content a:not(.btn):not(.card)…` — an eleven-`:not()` chain at specificity **(1,11,1)** — defeats `.api-rail__item` (0,1,0) and `.api-rail__item.is-active` (0,2,0) outright. The rail anchors carry none of the eleven escape classes, unlike `.quick-tile plain-link` and `.search-result__link plain-link`, which were patched individually.

Every rail entry renders in primary red with an underline instead of `--color-text` with none, and active/inactive are the same colour — only the left border and bold weight survive.

**Fix.** Add `plain-link` to the anchor (the existing convention), or `:not(.api-rail__item)` to the chain. The chain itself is the root cause — see §4.

_certain_

### H9 · `.notification` defeats `.notification-banner`'s padding
`css/app.css:308-310,314` vs `:1492-1496` · call site `js/components.js:140`

The banner element carries both classes. `.notification { padding:.5rem }` (0,1,0, line 1492) beats `.notification-banner { padding:1rem 0 }` (0,1,0, line 308) on source order, at every breakpoint. The banner gets uniform box padding instead of `Xrem 0`, so the inner `__wrapper` — which supplies its own `padding:0 1rem` — is double-indented and no longer aligns with the page chrome.

This is the *same collision* found and fixed for `position` earlier today; the comment at `:311-313` documents that fix. Only that one property was patched.

**Fix.** Extend the doubled-class selector to `padding`, or move the whole `.notification-banner` block below `.notification`.

_certain_

---

## 3 · Medium severity

| # | Finding | Where |
|---|---|---|
| **M1** | Dashboard shell duplicated — `DASHBOARD_MENU`, the whole layout markup, the 20-line collapse wiring (whose comment at `estate.js:348` admits _«identisch zu dataportal.js»_), and the `wireMenu` handler. **~60 lines** | `dataportal.js:23-321` · `estate.js:35-377` |
| **M2** | Expanding a tree node tears down and rebuilds the entire map — new WebGL context, all tiles refetched, camera reset so the user loses their position. Also per filter checkbox and per debounced search | `portfolio.js:336-354→185-194` |
| **M3** | `wireCharts` re-arms two root listeners per re-render on a node that is never replaced; each stale closure pins the previous detached tooltip | `charts.js:445,448` |
| **M4** | `matchMedia` change listeners accumulate one per page visit, each retaining the detached page subtree. `shell.js:340-345` already solves this with `AbortController` — these three sites don't use the house pattern | `dataportal.js:311` · `estate.js:370` · `grundlagen.js:188` |
| **M5** | Overlays survive a route change — gallery, doc-viewer and chart fullscreen have no `hashchange` listener. Browser Back leaves the overlay and its scroll lock over a re-rendered page | `gallery.js:284` · `doc-viewer.js:227` · `charts.js:479` |
| **M6** | Deep-linked gallery loses focus to the router: the gallery focuses its close button, then `focusHeading` focuses the `<h1>` behind the modal | `mediathek.js:207` · `router.js:269` |
| **M7** | Suggestion-list outside-click closer is `{ once: true }` — consumed by the first click *anywhere*, including inside the picker, after which the listbox can't be dismissed by clicking away and `aria-expanded` goes stale | `building-create.js:501` |
| **M8** | Five dead exports: `tile`, `tagItem`, `rerender`, `chevron`, `catalogueControls` (the superseded predecessor of `catalogueBar`, surviving only in prose). **~35 lines** | `components.js:97,174,353,871,1159` |
| **M9** | Two local reimplementations of `C.filterGroup`. Both use `data-dim` where the helper and every other caller use `data-fdim` — which is *why* the shared wiring can't be used here, and why the duplication persisted | `portfolio.js:239` · `estate.js:246` |
| **M10** | Six lookup tables defined 14×. Worst: the audience labels exist three times — in `C.audienceTag`, as `audienceOptions()`, as `AUDIENCES` — hand-synchronised | `components.js:81` · `services.js:190` · `applications.js:19` |
| **M11** | Wizard scaffolding copied across four process apps: confirmation screen ×4, clear-error-on-input ×2, `focusStepHeading` ×2, submit skeleton ×2. **~50 lines** | `space-request` · `fault-report` · `building-create` · `workspace` |
| **M12** | `.pf-mosaic__cell` base is declared *after* its own `--empty` modifier, so the modifier loses: placeholder tiles get `cursor:zoom-in` over an `aria-hidden` div with nothing behind them — exactly what the modifier exists to prevent | `css/app.css:2574,2576` |
| **M13** | `.btn .icon` (0,2,0) outranks every `.icon--*` size class and `.catbar__chev` (0,1,0). The catbar chevron paints at 1.4em instead of 1em; `.icon--base` is inert at ~15 call sites | `css/app.css:1084` vs `:423-428,2211` |
| **M14** | `.form__group__legend` declared three times with contradictory `font-weight`; the last (bold/lg) wins and the CD-parity intent stated twice above is dead. Latent — zero call sites | `css/app.css:1372,1378,1416` |
| **M15** | Token drift: `.docviewer__toolbar` hardcodes `#131b22`, the *default-skin* value of `--color-secondary-900` — but the app ships on `.body--intranet`, where it's `#1c3c7d`. Two different darks in one piece of chrome | `css/app.css:2988` vs `tokens.css:33,210` |

---

## 4 · The utility layers do not override anything

Two separate cases, same shape, both worth calling out on their own because they silently invert developer intent:

**`.text-center` / `.text-right` / `.text-left` sit at line ~356**, ahead of ~2 650 lines of components that outrank them at *equal* specificity purely by source order — `.btn__text`, `.tag-item__text`, `.accordion__title`, `.pf-tree__node`, `.toast`, `.empty`, `.docpage__p` and five more. The sibling spacing utilities `.mt-*` are declared *after* the component body (`:2848-2851`) and therefore work.

Mostly latent, but the evidence it recurs is already in the file: the 15-selector patch at `:1337-1342` exists solely because `table.table thead th` beat `.text-right`.

**Fix.** Move `.muted`, `.small` and the three text-align rules into the utilities block at the end. That also lets the table patch be deleted.

**`.mt-3` and `.pt-3` are emitted but never defined.** `shareUrlBlock`/`openShareModal` (`components.js:531,536,554,555`) use them; only `.mt-2/4/6/8/12` exist. The share dialog's spacing is silently a no-op.

### On `@layer` (the deferred S5-164)

I have twice suggested this session that CSS cascade layers would have prevented the specificity collisions we hit. **The reviewer checked that claim against all ten CSS findings and it does not hold up.**

Layers would fix **2 of 10**: H8 (a global rule losing to a component) and the text-align utilities above. Both are the "global/utility rule loses to a component" shape, which is exactly what layers are for — and for H8 it would let all eleven `:not()`s and both `plain-link` patches be deleted, since that chain exists only to simulate what a layer does natively.

Layers would **not** fix the other eight, because they are same-layer, source-order-within-components conflicts: H9, M12, M13, M14 are all component-vs-component, and layers do not reorder rules within a layer. For the two remaining `!important` uses, layers make reasoning *harder*, not easier — `!important` inverts layer precedence.

That is the dominant failure mode in this file. `@layer` is worth adopting for the link chain and the utility block specifically; it is not a fix for the class of bug this codebase actually keeps producing. The reliable fix for those remains ordering and naming discipline.

---

## 5 · Low severity

- **L1** Share dialog releases the gallery's scroll lock — both use `body.chart-overlay-open` as a boolean; the modal's close strips it from the still-open gallery. Make it a counter. `gallery.js:286` · `components.js:444`
- **L2** `estate.js` refetches three GeoJSON files `core` already holds — 3 requests, ~55 KB duplicate parse, a second full object allocation. `estate.js:51-74` vs `core.js:121-131`
- **L3** Hero mosaic requests `w=1600` for a cell CSS caps at ~380–450 px from 1280px up (≈16× the pixels); side thumbs ~3.4× oversized. `portfolio.js:762` vs `css/app.css:2514`
- **L4** ~110 rules for classes that appear nowhere in `js/` or `index.html` — `.subnav`, `.dash-hero*`, `.media-*`, `.pf-media*`, `.pf-marker`, `.pf-status--*`, `.card--list*`, `.ratio--*`, `.photo--*`. A second group is also unreferenced but carries explicit "Adoption: Item 7.x" deferral comments — leave those, and mark the rest the same way so the next audit can tell them apart
- **L5** Byte-identical duplicate rule and comment — `html:has(> body.chart-overlay-open)` appears twice. `css/app.css:2385,2390`
- **L6** Reset control written ten times in four inconsistent shapes; the `views` array literal written 8×, three of them identical to the default parameter at `components.js:1122`
- **L7** `!important` audit: 16 uses, 13 justified (`[hidden]`, reduced-motion, print). `.select--bare { margin-top:0 !important }` has no opponent and is dead weight. `.main-navigation … .clicked` is load-bearing but papers over a real 3-class specificity gap

---

## 6 · Tests: the green is weaker than it looks

This section matters more than its severity ratings suggest, because it changes how much the other sections can be trusted.

### T1 · The standard "nothing broke" assertion cannot observe a failed render
`scripts/*.mjs` — 11 suites assert `p.exceptions.length === 0`; exactly **one** also checks `consoleErrors`

`js/router.js:271-277` wraps every module render in `try/catch`: on throw it logs to `console.error` and paints a `.notification--error`. Nothing reaches `Runtime.exceptionThrown`, so the collected `exceptions[]` stays empty. **A page whose render throws outright produces a green "no exceptions" check.**

Only `test-tabs.mjs:98` also asserts `consoleErrors.length === 0`; only `test-race.mjs:19` looks for `.notification--error`.

I have reported "11/11 suites green" many times in this session. That statement was true but weaker evidence than I presented it as: for eight of those suites, the primary safety-net assertion could not have caught a render failure.

**Fix.** A shared `assertClean(page)` in `scripts/lib/cdp.mjs` checking all three: exceptions, console errors, and the absence of `.notification--error`.

### T2 · Three vacuous assertions, all added today

- **`emptyClickable === 0`** (`test-portfolio.mjs:141,174`) — the tested building has 5 images, so `heroBlock()` emits **zero** placeholder tiles and the selector matches nothing regardless of correctness. The neighbouring `sideTiles === 4` is satisfied by four *real* tiles, so the padding branch is never executed either. **Fix:** drive it with a ≤2-image object and assert `emptyCells === 4 - (mosaicCells - 1)` plus `aria-hidden`/`tagName`.
- **`check(r.n > 0)`** (`test-building-create.mjs:105`) — a literal tautology: it is the first statement inside `else` of `if (!r.n)`. **Fix:** delete.
- **`check(D.zoomBar)`** (`test-portfolio.mjs:176`) — asserts a node the skeleton emits unconditionally, given `.pf-lightbox` is already asserted. A markup-presence tautology.

### T3 · Dashboard export/share assertions accept failure as success
`test-dashboard.mjs:83,89` — `/kopiert|nicht möglich/` and `/heruntergeladen|fehlgeschlagen/` match **both** branches. Headless Edge routinely rejects `navigator.clipboard.writeText`, so the copy path is probably taking the failure branch on every run today, and `svgToPng` could throw unconditionally with the suite still green. **Fix:** assert the success string exactly, as the CSV check on line 88 already does.

### T4 · 22 checks are gated behind a live internet call and exit 0 when skipped
`test-building-create.mjs:102-213` — everything from keyboard selection through step-2 validation, the error summary, the Baujahr range branch, step 3 and the created Vorgang sits inside `else { … }` of the swisstopo reachability check. Offline, the suite prints "übersprungen" and exits **0**. None of those 22 checks need the network — only a selected address. **Fix:** split the network leg out; drive steps 2–3 from an injected selection; exit with a distinct code when skipping.

### T5 · Coverage gaps

**No suite at all:** `js/apps/mediathek.js` (357 lines, the most-churned module after portfolio), `js/apps/document-archive.js` (and therefore `js/doc-viewer.js`), `js/apps/transaction.js`, `js/pages/home.js`, `js/pages/search.js`, `js/pages/ikt-vorhaben.js`.

`js/gallery.js` is **partial** — open/exists/Esc only. No coverage of zoom stepping, pan, the metadata panel, `?bild=` URL sync, the Tab trap, or focus restoration, despite four of the last twenty commits touching it. This was flagged twice during the session; it remains the largest single gap.

Full per-module coverage table retained in the reviewer output; the modules above are the actionable set.

### T6 · Flakiness and driver crashes

~26 s of hard sleeps in `test-building-create` alone; `go()` blocks on a wall-clock timer rather than polling for the selector the next probe needs, and the 5 200 ms for a cold MapLibre CDN load is simultaneously too short on a slow link and wasted on a warm one. Four suites hard-depend on `unpkg.com`, `wmts.geo.admin.ch` and `cartocdn.com` with no skip path, so offline they go red as *product* failures. Several probes dereference possibly-null nodes, so a regression surfaces as `DRIVER ERROR` / exit 2 — indistinguishable from "Edge failed to launch", with no named failing check.

**Fix.** A `waitFor(page, expr)` poll helper in `lib/cdp.mjs`; guard each lookup and return `{ err }` as `test-tabs.mjs:79` already does; a `run-all.mjs` runner (there is none today).

---

## 7 · Checked and dropped

Recorded so they are not re-investigated:

- **`localStorage` is fully guarded** — centralised in `js/storage.js:7-37`; `session.js` and `process-engine.js` only go through it
- **Pagination boundaries are sound** — end controls are `aria-disabled` spans; handlers match `.pagination_items a` only. No page 0 / N+1 path
- **`shell.renderHeader` re-wiring is clean** — aborts previous global listeners via `AbortController` (`shell.js:343-345`)
- **All async delegators check `ctx.stale()`** before writing — `data.js:10`, `applications.js:36`, `dataportal.js:41,45`, `estate.js:105`, `api-docs.js:23`
- **`building-create`'s 300 ms debounce after navigation is harmless** — `renderList`/`redrawFacts` bail on the absent nodes
- **Linear scans in `core.js` are not worth a Map** — every dataset is 10–70 rows
- **`.api-method--*` / `.api-status--*` are not dead CSS** — built dynamically at `api-docs.js:83,94,98,146`
- **Four "duplicate" CSS selectors are legitimate** — `.footer-information__links`, `.back-to-top-btn`, `.card--clickable:hover .photo > img`, `.docpage__p` are each in distinct `@media`/`@supports` contexts

---

## 8 · Recommended order

1. **The teardown hook (H1)** — one change in `router.js` plus registrations. Resolves H1, H3, M3, M4, M5 and half of M2. Highest ratio of risk removed to code written.
2. **H2** — three lines; stops an unbounded quadratic leak.
3. **T1** — one shared `assertClean()`. Do this *before* the refactors below, so the suites can actually catch what they break.
4. **H8, H9, M12, M13** — the four live CSS collisions. Small, isolated, currently mis-rendering.
5. **H4** — lazy data loading; the largest user-visible win.
6. **H5 → H7 → H6 → M1** — the consolidation block, in that order: each makes the next smaller. **~430 lines removed.**
7. **T2–T5** — de-vacuum the assertions and add `test-gallery.mjs` + `test-mediathek.mjs`.
8. **M8, M9, M10, L4, L5** — cheap cleanups that shrink the surface the above must touch.

---

## 9 · Data and state layer

### H10 · `engine.start()` fabricates a process definition and persists the wrong record
`js/process-engine.js:16-19,34-59`

`core.load()` records every failed file in `FAILED` and the shell renders a red band from `core.failedAreas()`. **`engine.load()` has no equivalent**: a 404 on `process-definitions.json` sets `DEFS = []` and logs a warning. `AREA` has no key for definitions or instances, so nothing surfaces anywhere in the UI.

`start()` then takes its `(def && def.steps) || [{status:'eingereicht', …}]` fallback and **persists** an instance with `defName` set to the raw slug (`gebaeude-erfassung`), a one-step history and `audience:'internal'` — and returns it, so all four wizards show the green "Referenz BBL-2026-xxxx" success screen. The record is permanently wrong and is never reconciled when definitions load correctly next session.

With one missing or mistyped JSON file, users successfully "submit" cases that are silently detached from their process, with no error anywhere.

**Fix.** Give the engine the same failure register as core, and make `start()` return `null` when `definition(defId)` is undefined rather than inventing steps.

_certain_

### H11 · The declared service → process binding is dead data
`data/services.json` (`processDefId`) · `data/process-definitions.json` (`serviceId`) vs `fault-report.js:6-36`, `space-request.js:186`, `workspace.js:242`, `building-create.js:388`

`processDefId` appears on 10 of 20 services and `serviceId` on all 7 definitions — 17 declared edges, all referentially valid. **Neither field is read anywhere in `js/`** (0 grep hits for `processDefId`; `def.serviceId` never dereferenced). The service page routes purely through `s.target.href`, and each app then re-declares its defId as a string literal: `engine.start('raumbedarf')`, `'buchung'`, `'gebaeude-erfassung'`, plus fault-report's local `TYPES` table.

Two independent sources of truth. Renaming a defId in JSON leaves the data self-consistent while the apps keep starting the old id — which, per H10, then silently fabricates a definition. Adding a service with a `processDefId` gets no process behaviour at all.

**Fix.** Resolve the defId from the service record (`core.service(id).processDefId`), or drop both fields so the contract stops advertising a link it does not have.

_certain_

### Medium

| # | Finding | Where |
|---|---|---|
| **M16** | `core.available()` is honoured by **4 of 20** view modules. Search is the worst: a 404 across six sources renders "Die Suche nach «X» ergab keine Treffer" plus tips to rephrase. The buildings/parcels path never checks `available('buildings')` at all | `search.js:38-81`; honoured only in `applications`, `katalog`, `mediathek`, `services` |
| **M17** | An instance whose defId no longer exists renders as **completed** with an empty pipeline: `C.pipeline([], …)` emits an empty `<ol>`, and the else-branch prints "Vorgang abgeschlossen." while the badge still says `in_arbeit` | `my-cases.js:94-98,152,159` |
| **M18** | `dashboards.json` failure is invisible — not in `core.FILES`, no `AREA` key, no `available()`. The Datenportal degrades to a blank shell indistinguishable from an unpopulated portal | `dashboard-data.js:19-29` |
| **M19** | api-docs "Ausprobieren" reads `service.name`, which exists on **0 of 20** services (`title` on 20/20). `JSON.stringify` drops the `undefined`, so `GET /dienstleistungen` silently omits its most important field. The sibling `anwendungen.list` is correct — applications genuinely has `name`; the two entities disagree and the code assumed the applications shape | `api-docs.js:49-50` |
| **M20** | `readJSON` validates nothing. `session.js:13` treats any non-null value as a logged-in user, so a corrupt `bbl_session_v1` yields `isLoggedIn() === true` with `user().name === undefined` — which the wizards then persist as `requester: undefined`. `fetchJSON` grew a `shape` parameter for exactly this reason; `readJSON` never did | `storage.js:7-17` · `session.js:13` |
| **M21** | `my-cases.js:170` discards `engine.advance()`'s return and reloads. On quota-exceeded or private-mode storage, "Nächster Schritt" appears to no-op with no message — three of the four `engine.start` callers *do* check and call `C.flashError` | `my-cases.js:170` |

### Low

- **L8** `genRef()` draws from 9 000 values per year with no uniqueness check — ~13 % duplicate chance at 50 cases. `process-engine.js:24-28`
- **L9** `DATA_LABELS` drifted from the keys the forms write: fault-report writes `dringlichkeit`/`standort`, workspace writes `standort`; none are in the 31-entry map, so those rows render raw key names. Seeded records look right, which is why it went unnoticed. `my-cases.js:67-78`
- **L10** `data/data-products.json` is referenced at `core.js:28-30` and does not exist; 18 of 28 applications have `link.href === '#'` (no reachable entry point); 8 of 28 have no `application-pages` entry

### Verified negatives

- **Referential integrity across `data/` is clean** — 0 dangling references in `media.buildingId` (17/17 resolve, 12→buildings, 5→parcels), the 243 rows of `buildingId` across assets/contracts/costs/area-measurements/building-contacts/projects, `landcovers`, `documents.linkedTo`, `services.contact`, `instances.defId`, `weisungen.relatedServices`/`supersededBy`, all dashboard `topicId`/`dataset`/column refs, and all dataset `#/…` hrefs against the router's `PAGES`/`APPS`.
- **An id→Map in `core.js` would be immaterial** — largest collection is 69 rows; the only in-loop lookups cost ≤14×11 comparisons. Independently confirmed by the performance lens.

---

## 10 · Recommended order

1. **The teardown hook (H1)** — one change in `router.js` plus registrations. Resolves H1, H3, M3, M4, M5 and half of M2. Highest ratio of risk removed to code written.
2. **H2** — three lines; stops an unbounded quadratic leak.
3. **H10 + H11** — the process layer is the one place where a silent failure writes a *permanently wrong persisted record*. Everything else here is recoverable by reloading.
4. **T1** — one shared `assertClean()`. Do this *before* the refactors below, so the suites can catch what they break.
5. **H8, H9, M12, M13** — the four live CSS collisions. Small, isolated, currently mis-rendering.
6. **H4** — lazy data loading; the largest user-visible win.
7. **H5 → H7 → H6 → M1** — the consolidation block, in that order: each makes the next smaller. **~430 lines removed.**
8. **T2–T5** — de-vacuum the assertions; add `test-gallery.mjs` and `test-mediathek.mjs`.
9. **M16–M21, M8–M10, L4, L5** — failure-path honesty and cheap cleanups.

---

## Appendix · Counts

| | |
|---|---|
| Findings | 11 high · 21 medium · 10 low |
| Reproduced against the running app | 1 (fixed) |
| Verified negatives recorded | 10 |
| Estimated dead/duplicate code | ~430 lines JS · ~150 lines CSS |
| Modules with no test coverage | 6 (+2 partial-only: `gallery.js`, `doc-viewer.js`) |
