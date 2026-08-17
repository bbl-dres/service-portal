# From Mockup to Production — Architecture Review & Target Architecture

> **Status:** Draft v1 for discussion · **Date:** 2026-08-07 · **Scope:** an assessment of the prototype's architecture as built, and a proposed architecture for a production-grade implementation of the same product.
> **Sits beside:** [platform-vision.md](platform-vision.md) (the north star) · [data-model.md](data-model.md) (the entities) · [code-review.md](code-review.md) (defect-level technical review).
> This document is **planning only.** Nothing here is a build instruction.

---

## Part I — The prototype as built

### 1. Shape

A static single-page application: no build step, no `node_modules`, no framework. ES modules loaded directly by the browser, hash routing, HTML produced by template literals, data read from `data/*.json` over `fetch`.

| | |
|---|---:|
| Tracked files | 1'101 |
| JS/MJS | 122 files, ~25'500 lines |
| `js/` application code | ~1.07 MB |
| `css/` (`app.css` + `tokens.css`) | ~326 KB |
| `data/` | 31 files, ~1.13 MB |
| `assets/` | 418 tracked files, ~48 MB |
| `docs/review-assets/` | 344 tracked files (342 PNGs), ~134 MB |
| Page modules / micro-apps | 9 / 16 |
| Verification scripts | 60 `test-*.mjs` (36 browser, 24 pure Node), 25 `check-*.mjs` |
| Runtime libraries | MapLibre GL 4.7.1, Swagger UI 5.17.14, bpmn-js 17.11.1 — pinned, lazy, from `unpkg.com` |

Boot is four requests: `services.json` + `reference-data.json` (everything the shell needs to draw), the shared `processes.json` registry, and `process-instances.json`, in one `Promise.all`. The process engine derives its portal definitions from the core-cached registry, and everything else is pulled per route.

### 2. The layers that actually exist

```
index.html            4 mount points: #main-header · #data-status · #main-content · #live · #main-footer
   │
js/app.js             boot: core.load() ‖ engine.load() → shell → global wiring → router
   │
js/routing/router.js  hash → routes.js (PAGES ×9, APPS ×17) → dynamic import → render(ctx)
   │                  + legacy redirects, login gate, scroll strategy, abort/cleanup ownership
   ├── js/ui/shell/        CD-Bund header/footer/drawer, re-rendered on session change
   ├── js/components.js    compatibility façade over grouped js/ui/components/*
   ├── js/core/index.js    data access: eager 2 files, deferred keys, failure register
   ├── js/process-engine.js  definitions + seeded instances from JSON, user cases in localStorage
   ├── js/core/session.js  mock AGOV/FedLogin, one demo user, no roles
   └── js/pages/* js/apps/*  the views
```

**The route contract** is the load-bearing abstraction, and it is a genuinely good one:

```js
export const needs = ['buildings', 'floors'];   // declarative data dependencies
export const loginText = '…';                   // wording for the central login gate
export default async function render(ctx) { … } // ctx = { mount, params, query, core, engine,
                                                //         session, C, onUnmount, stale,
                                                //         navigate, setTitle, setCrumbs }
```

Four things fall out of it that most prototypes never get:

- **`needs`** is a route-level data dependency declaration resolved *before* render. It is the same idea as a Remix/TanStack route loader.
- **`core.ensure(keys)`** memoises one in-flight promise per key, so ten callers produce one request. That is a hand-rolled query cache with `staleTime: Infinity`.
- **`ctx.stale()`** + a monotonic dispatch ticket kill the render race that async route modules otherwise always have.
- **`ctx.onUnmount(fn)`** gives routes a teardown hook, so maps, observers and media-query listeners do not outlive the view that made them.

**The failure model is unusually honest.** `core` keeps a `FAILED` set and exposes `available(key)` / `failedAreas()`; the shell paints a persistent banner; `C.empty()` distinguishes *"no entries"* from *"could not be loaded"*. Almost every production application in the wild renders a load failure as a plausible zero. This one refuses to. **This is a design rule worth carrying forward explicitly**, because no framework gives it to you by default.

**Golden-record discipline is real.** `buildings.geojson` (SAP RE-FX shape) is the single source for both the dashboard and the inventory; `normalizeBuilding()` / `normalizeParcel()` / `normalizeLandcover()` translate raw SAP/AV field names into the lean shape every view reads. That is an anti-corruption layer, already in the right place — at the data boundary, once, not per view.

**URL as state.** Search, filters, view mode, page, selected object, selected floor, selected image are all in the hash. Deep links reproduce a view. `C.catalogueState` / `C.wireCatalogueState` make that a shared contract across four catalogues rather than four dialects.

**Accessibility is deep, not decorative.** Persistent live region, focus management on route change, drill-in vs. state-change focus rules, `trapFocus`, roving tabindex on tabs, keyboard access for horizontally scrolling regions, error summaries wired to field ids. This is the expensive part of a federal product and it is already done and tested.

**The tests drive the real application in a real browser** (headless Edge over CDP, from Node, no puppeteer). They assert on behaviour, not on internals — which means they largely survive a reimplementation of those internals. They are the best-shaped asset in the repository for a rewrite.

### 3. What will not survive contact with production

Ordered by how much they cost to fix later.

**3.1 There is no production authorization boundary.** `js/core/session.js` is a client-side flag. The login gate lives in `js/routing/router.js`. `classification: 'VERTRAULICH'` is *derived in the browser* while normalizing building data in `js/core/index.js`. Every visitor, anonymous or not, can request the static datasets. In production, authentication and authorization must be server-side and data must be filtered before it leaves the server; the client gate can remain, but only as UX.

**3.2 There is no write path.** Every mutation goes to `localStorage`: cases (`bbl_vorgaenge_v1`), cart, favourites, search log. Instance ids are `Date.now() + Math.random()`. There is no concept of concurrency, versioning, conflict, retry, or partial failure. Every write in the product is currently a fiction — which is correct for a mockup and is the largest single gap to close.

**3.3 Everything is loaded whole and filtered in memory.** `spaces.json` is 239 KB for 728 rows. Real BBL scope is ~2'800 properties; spaces and assets are one to two orders of magnitude larger. No catalogue paginates, filters or sorts on a server. This is the constraint that breaks first and hardest, and it is not a frontend fix — it needs an API with query parameters behind it.

**3.4 The view layer is `innerHTML` with manual escaping.** 158 assignment sites, 693 `escape()` calls. It holds today because all data is trusted repository fixtures. The moment content is user-authored — a fault description, a document title, a comment, a supplier name from SAP — one missed `escape()` is stored XSS. It also blocks a strict CSP, and it is the reason there is no i18n layer: translation cannot be retrofitted into 158 template literals without rewriting them all.

**3.5 No internationalisation.** The product is DE-only; the requirement is DE/FR/IT. `core.t()` exists but only unwraps the DCAT catalogue's multilingual strings. Everything else — labels, validation messages, reference lists in `reference-data.json`, `knowledge-content.js` (113 items of editorial content in JS literals) — is German string literals. This is a view-layer rewrite, and it is the strongest single argument for changing the view technology rather than keeping it.

**3.6 The process engine is a linear step array.** `steps[]` with `status`/`label`/`role`/`kind`, advanced one index at a time. No gateways, no parallelism, no timers, no escalation, no task assignment, no four-eyes, no delegation, no reassignment. The vision's own seed processes cannot be expressed: the property-inventory change request needs four-eyes, the divestment needs seven milestones with role hand-offs. This is intentional in a mockup, and it is precisely why the vision names Camunda.

**3.7 `components.js` is a god-module.** 2'246 lines, ~90 exports, passed whole into every route as `ctx.C`. Every view depends on the entire surface, so nothing can be versioned, replaced or tested in isolation.

**3.8 Three competing state patterns** — URL as truth, module-local `state` with partial redraw, and DOM as implicit state — with no uniform transition between them. The code review traces findings W-03 … W-09 and W-19 directly to the seams between them.

**3.9 Supply chain and CSP.** Three libraries load at runtime from `unpkg.com` with no SRI. Map tiles and address search call swisstopo, CARTO and geo.admin.ch. A federal production deployment needs these self-hosted or allow-listed, with SRI and a CSP header — and inline styles inventoried, since they currently block one.

**3.10 Repository hygiene.** 344 review PNGs (~134 MB) and 418 asset files (~48 MB) are tracked in git; a clone is ~184 MiB before anyone writes a line. Separately, a stale git worktree from a previous session is sitting at `.claude/worktrees/great-lumiere-ac2713` holding a full second copy of the application — untracked, but on disk and confusing to greps.

### 4. Verdict on the prototype

It is a strong prototype and, more usefully, **an unusually precise specification**. It has settled the information architecture, the route contract, the domain vocabulary, the reference lists, the design-system alignment, the accessibility behaviour and the failure semantics — and it has 29 browser tests that describe all of it executably. Those decisions are the expensive ones. The parts that are missing (persistence, identity, authorization, scale, orchestration, i18n) are the parts a production stack supplies.

**So the production question is not "what do we rewrite?" but "what do we keep, and in what order do we replace the rest?"**

---

## Part II — Target architecture for production

### 5. One correction to the vision first

[platform-vision.md](platform-vision.md) §5 calls block F a **"shared domain core (single source of truth)."** For most of its content that is not achievable and should not be promised:

| Data | Actual master |
|---|---|
| Building, Parcel, Wirtschaftseinheit, Areas, Mietobjekt/Mietvertrag | **SAP RE-FX** |
| Construction projects | **SAP ePPM** (already stated in data-model.md §2 as cross-reference, not containment) |
| `egid` (building register), `egrid` (parcel) | **Federal registers** — GWR, AV/Grundbuch |
| Documents / records | **GEVER** |
| Persons, organisational units | **Admin-Directory / InfoPers** |

The platform is therefore a **read model over declared upstream masters, plus a write model for the capabilities it actually owns** — workspace planning, room booking, the service catalogue, the data catalogue, and the case/process layer. Writes that touch RE-FX data travel *through the process engine into SAP*, never straight into the local store.

Saying this explicitly changes the architecture (ingestion pipelines, not a database migration), the governance (data ownership stays where it is), and the political framing (BBL is not asking anyone to give up their system). It is the single most important thing to correct before a build.

### 6. Target architecture

```
                      ┌──────────────────────────────────────────────┐
   Browser            │  Portal SPA/SSR  ·  CD Bund  ·  DE/FR/IT     │
                      └──────────────────────┬───────────────────────┘
                                             │  HTTPS, session cookie
                      ┌──────────────────────▼───────────────────────┐
   Edge               │  BFF  —  OIDC client, session, CSP, rate      │
                      │  limit, response shaping, authz enforcement  │
                      └───┬──────────────┬──────────────┬────────────┘
                          │              │              │
        ┌─────────────────▼──┐ ┌─────────▼────────┐ ┌───▼──────────────┐
        │ Domain services    │ │ Process engine   │ │ Search & catalog │
        │ (modular monolith) │ │ Camunda (BPMN)   │ │ OpenSearch·DCAT  │
        │ estate · tenancy   │ │ user tasks·4-eyes│ │ perm-filtered    │
        │ projects · docs    │ │ timers·escalation│ └──────────────────┘
        │ workspace · catalog│ └─────────┬────────┘
        └────────┬───────────┘           │
                 │                       │
        ┌────────▼───────────────────────▼─────────────────────────────┐
        │ PostgreSQL + PostGIS (ODS)   ·   Object storage (docs/media) │
        └────────▲─────────────────────────────────────────────────────┘
                 │ ingestion — CDC / scheduled extracts / events
        ┌────────┴─────────────────────────────────────────────────────┐
        │ SAP RE-FX · SAP ePPM · GEVER · Admin-Directory · GWR · AV    │
        │ swisstopo / geo.admin.ch (consumed live, not copied)         │
        └──────────────────────────────────────────────────────────────┘
        Cross-cutting: AGOV/FedLogin · OpenTelemetry · CD Bund · WCAG 2.1 AA / eCH-0059
```

### 7. Layer by layer

#### 7.1 Identity and access — do this first

- **AGOV / FedLogin over OIDC.** Two audiences with different identity paths: BBL staff and federal-office customers (federated) vs. external parties such as brokers in the divestment process. The service catalogue already tags `audience: [staff, customers]` — that tag becomes the routing rule.
- **BFF pattern.** The browser holds an `HttpOnly`, `Secure`, `SameSite` session cookie; tokens never reach JavaScript. This is also what makes a strict CSP achievable.
- **Authorization is a server concern, expressed as policy.** The role vocabulary already exists in the portal branch of `data/processes.json` — *Antragstellende Stelle, Generalsekretariat, Portfoliomanagement BBL, BBL Bau, Objektbetrieb, FLM/IM/PFM*. That is the seed role model; harvest it rather than inventing one.
- **Classification becomes enforced data.** `INTERN` / `VERTRAULICH` moves out of `normalizeBuilding()` into a stored attribute on the record, applied as a filter in the query layer and in the document delivery path — and, critically, in the **search index** (see §7.5), which is where classification leaks usually happen.

#### 7.2 Domain services — a modular monolith, not microservices

The vision proposes microservices/micro-frontends. **Recommend against, at least initially.** Five services with one team is a distributed monolith: you inherit network partitions, distributed transactions and version skew, and you buy deployment independence nobody needs yet.

Recommend instead a **modular monolith** — one deployable, hard module boundaries, one schema per module, no cross-module table access, communication through published interfaces. Spring Modulith, .NET with enforced module boundaries, or NestJS modules all do this; the enforcement matters more than the language. Modules, straight out of [data-model.md](data-model.md):

| Module | Owns | Master |
|---|---|---|
| **estate** | Building, Parcel, Floor, Space, Area, Asset, Cost, Contract | read model of RE-FX |
| **tenancy** | Mietobjekt, Mietvertrag, occupancy | read model of RE-FX |
| **projects** | Project, SIA phase, BKP costs, milestones | read model of ePPM |
| **workspace** | Planning states, capacity assumptions, furniture orders | **own write model** |
| **booking** | Rooms, reservations, favourites | **own write model** |
| **documents** | Document/Plan/Media metadata, viewer tokens | GEVER + object storage |
| **catalog** | Services, applications, datasets, concepts, editorial content | **own write model** |
| **cases** | Process instances, task projections, case files | Camunda + own store |

Split a module out only when it earns it — a different release cadence, a different team, or a genuinely different runtime profile. The plan editor / plan check (§7.7) is the one candidate that plausibly earns it on day one.

#### 7.3 Process orchestration — Camunda, with process variables as references

- **Camunda 8 (Zeebe)** if the operating model tolerates its infrastructure; **Camunda 7** if a simpler embedded engine and on-prem licensing matter more. This is an operations decision, not an architecture one — the BPMN models are portable either way.
- **Seed models already exist.** The portal branch of `data/processes.json` plus the BPMN files behind `#/app/process-docs` in `assets/bpmn/`. The process-documentation app is already a BPMN viewer — in production it should read the *deployed* models, not a parallel copy, so documentation cannot drift from execution.
- **Process variables hold references, never copies.** `bbl_id`, `projectId`, `tenancyId` — the prototype already does this via `linkedEntities`. Keep the rule; it is what stops the engine from becoming a second, stale data store.
- **User tasks render in the portal.** Consume the Tasklist/Zeebe API but keep the CD Bund UI — the "Meine Vorgänge" and reviewer-inbox surfaces stay BBL's, not Camunda's.
- **`js/process-engine.js` keeps its interface.** `load / definitions / instances / start / advance / cancel` is already the right shape for an API client. That module becomes a thin HTTP client and every calling site is untouched.

#### 7.4 API — the OpenAPI draft is a real asset

`data/api-specs.json` already describes 17 resources and 47 endpoints with live examples drawn from the actual portal data. Promote it: **OpenAPI is the contract**, types and clients generated from it, and `#/app/api-docs` continues to render it — from the served spec rather than a fixture.

The non-negotiable addition is **server-side query**: `?q=&page=&size=&sort=&filter[…]` on every collection. The client-side catalogue contract (`q` / `page` / `view` / filters in the hash, via `C.catalogueState`) maps onto those parameters one-to-one, so **the URL contract and the deep links survive unchanged** — only the data source moves.

Geodata: stop shipping GeoJSON files. Serve **vector tiles from PostGIS** (Martin or pg_tileserv) or bbox-filtered GeoJSON endpoints. swisstopo WMTS and the address search stay external calls, proxied through the BFF so the CSP stays tight and the upstream keys stay server-side.

#### 7.5 Data, search and catalogue

- **PostgreSQL + PostGIS** as the operational data store. One database, schema per module.
- **Ingestion**, not migration: CDC or scheduled extracts from RE-FX and ePPM into the read models. `normalizeBuilding()` is the prototype of this transform — the same mapping, moved server-side, versioned, and with rejects that are visible rather than silently dropped (`.filter(x => x[ID])` today discards bad records without a trace).
- **Search.** `js/search/search-engine.js` is a pure-function fold-and-rank over ~380 entries, deliberately index-free. At production scale that becomes **OpenSearch/Elasticsearch** — or Postgres full-text with `unaccent` if the corpus stays small. Two properties must be carried over: the umlaut/`oe`-`ae`-`ue` folding on **both** query and haystack (a Swiss-keyboard reality the prototype got right), and colloquial-term mapping. Two must be added: **permission filtering inside the index**, and relevance tuning against the real search log.
- **DCAT-AP CH 2 catalogue.** Keep the model; it is correct and already carries `publications[]` with a real I14Y link. In production, publish the genuinely public datasets *to* I14Y rather than describing them twice.
- **The metadata catalogue** (business objects ↔ system tables, with the attribute-level mapping and reverse index) is a lineage layer. Either feed it from the real systems, or replace it with a data-catalogue product (OpenMetadata, DataHub, Collibra) and keep the portal view as a façade over its API. Do not hand-maintain it at scale.

#### 7.6 Frontend — the one decision worth arguing about

Three options:

**(a) Keep vanilla, add Vite + TypeScript.** Cheapest; preserves every line. But the view layer stays `innerHTML` strings, so §3.4 (XSS/CSP) and §3.5 (i18n) remain unsolved. This is a reasonable *interim* step and a poor destination.

**(b) Vue 3 + Nuxt — recommended.** The decisive argument is that **the CD Bund design system (`swiss/designsystem`) is itself Vue/Nuxt.** The prototype hand-ported its components into CSS plus string templates — a fork, maintained by hand, that drifts every time the federal design system moves. Adopting Nuxt turns the design system back into a dependency. It also brings, without extra work: automatic escaping, route-level code splitting (the shape `import(modPath)` already has), SSR for the public knowledge and service-catalogue pages, and `@nuxtjs/i18n` for DE/FR/IT.

**(c) React.** No advantage here, and it means porting CD Bund a second time.

Micro-frontends: **not initially.** With one shell, one design system and one team, module federation buys deployment independence you do not need and costs shared-state and version-skew problems you do not have. The prototype's dynamic route imports already give the only benefit that matters at this size — independent, lazily loaded route modules.

What to carry across, deliberately, because a framework will not give it to you:

| Prototype mechanism | Production equivalent |
|---|---|
| `export const needs` | route loader / prefetch |
| `core.ensure()` promise memoisation | TanStack Query (or Nuxt `useAsyncData`) |
| `FAILED` / `available()` / `failedAreas()` | **explicit design rule:** empty ≠ unavailable, per query, everywhere |
| `ctx.onUnmount` | component teardown — same discipline for maps, observers, listeners |
| `ctx.stale()` + dispatch ticket | navigation-scoped abort signals |
| Hash state contract, `legacyTarget` redirects | history routing + a redirect table (the shared links must keep working) |
| `js/links.js` deep-link builders | typed route helpers |
| The whole a11y layer | keep, and gate it in CI |

#### 7.7 The specialised applications

The workspace plan editor and plan check ([workspace-management-implementation.md](workspace-management-implementation.md) steps 2 and 3) are a different class of software: DWG/DXF ingestion, geometry editing, rule checking, potentially IFC. They should be

- a **separate service** for conversion and rule evaluation (headless DWG→GeoJSON/IFC, e.g. ODA/Teigha or FME), because that is heavy, licensed, and not a request/response concern; and
- a **separate frontend application** with a canvas/WebGL renderer, not part of the portal bundle.

The portal keeps the read-only preview it already has, and hands over via stable keys (`buildingId`, `floorId`, plan version) with a return target. The implementation plan already draws this boundary correctly — it is worth defending, because embedding a CAD editor in the portal bundle is the kind of decision that is very hard to reverse.

The present editor's browser document is only a feedback aggregate. It must not become the production API shape: `room` is an independently addressable entity with its own row version and building/floor entitlement; a `plan_revision` owns geometry/placement changes and references rooms by stable `roomId`. The authenticated API derives the actor, checks optimistic versions and lets PostgreSQL RLS enforce object scope, including denial of guessed cross-building room IDs. The browser may use returned capabilities to explain the UI, but it never authorizes a write. `js/floorplan-editor/repository.js` is the prototype seam that the API adapter replaces.

### 8. Cross-cutting concerns that are not optional in a federal context

- **Records management / GEVER.** A *Vorgang* is a Geschäftsfall subject to federal archiving obligations (BGA). A Camunda instance is not an archive and its history is not a record. Production needs an explicit boundary: when a process ends, the case file — decisions, attachments, audit trail — is exported into GEVER with a retention class. This is easy to defer and expensive to retrofit.
- **Data protection (DSG/revDSG).** `building-contacts.json` already holds 47 real-format addresses; booking and case data are personal data by definition. Needs a processing register, retention rules, a deletion path, and role-scoped access — not just a badge in the UI.
- **Accessibility (BehiG / eCH-0059 / WCAG 2.1 AA).** Already respected in the prototype. Put it in CI (axe or equivalent on the route matrix) so it stays true.
- **Observability.** OpenTelemetry across BFF, services and engine; process KPIs from Camunda (throughput, ageing, bottleneck steps) are a product feature, not just ops. `search-log.js` — deliberately a local notebook today — becomes real, declared analytics.
- **Public vs. authenticated delivery.** The application currently serves anonymous editorial content and gated operational data from one bundle. Consider splitting delivery (SSR public site + authenticated app), or at minimum enforce the split hard at the BFF.

---

## Part III — Getting there

### 9. Strangler sequence

The ordering matters more than the destination. **The frontend migration is last, not first** — the prototype's frontend is the most valuable and least risky part of it, and every earlier step is independently useful.

| # | Step | Result | Frontend change |
|---|---|---|---|
| 1 | **BFF in front of the static app.** Serve today's `data/*.json` unchanged from `/api/v1/*`. | A place to put auth, authz, CSP, rate limiting. | `fetchJSON('data/x.json')` → `fetchJSON('/api/v1/x')`. One module. |
| 2 | **Real identity + server-side authorization.** AGOV/FedLogin via OIDC, session cookie, responses filtered by role and classification. | The trust boundary exists. Client gate demoted to UX. | `session.js` becomes an API client. Router gate unchanged. |
| 3 | **Real process engine.** Camunda behind `/api/v1/process-instances`, seeded from the existing definitions and BPMN files. | Real cases, real tasks, real audit trail, four-eyes possible. | `process-engine.js` keeps its surface. Calling sites untouched. |
| 4 | **ODS + ingestion.** PostGIS, RE-FX/ePPM feeds, `normalizeBuilding` moved server-side. Server-side paging/filter/sort on every collection. Vector tiles. | Scale. Real data. | `core.js` deferred-key loading becomes paged queries; the hash contract is unchanged. |
| 5 | **Search service.** OpenSearch with permission filtering, seeded from the ODS. | Search that scales and does not leak. | `search-engine.js` becomes a client; folding rules move into the analyzer. |
| 6 | **Frontend migration, route by route.** Nuxt shell + CD Bund as a dependency; routes ported one at a time behind the same URLs. | i18n, automatic escaping, SSR, no design-system fork. | The 29 CDP suites are the acceptance criteria for each ported route. |
| 7 | **Plan editor / plan check** as a separate application and service. | The heavy, licensed, CAD-shaped work is isolated. | New surface; portal keeps its read-only preview. |

Steps 1–3 are worth doing even if the frontend never changes. Step 6 is affordable *only because* steps 1–5 removed the frontend's responsibility for data, identity and orchestration.

### 10. Decisions required before a build starts

| # | Decision | Why it blocks |
|---|---|---|
| A1 | **Who is master for building/parcel/tenancy data?** If SAP RE-FX stays master, the platform is a read model and the vision's "single source of truth" wording must change. | Determines whether step 4 is ingestion or migration — a different project. |
| A2 | **Camunda 7 or 8**, and who operates it. | Zeebe's infrastructure profile differs sharply from an embedded engine. |
| A3 | **Frontend stack:** Nuxt (recommended) vs. vanilla+Vite vs. other. | Decides whether the CD Bund fork is retired or maintained forever. |
| A4 | **Hosting and sovereignty**: on-prem, federal cloud, or hyperscaler under a federal contract. | Determines the whole operating model, and whether SaaS Camunda/OpenSearch are even options. |
| A5 | **Public/internal split** — one deployment or two. | Changes the BFF, the CSP and the SSR question. |
| A6 | **GEVER integration owner and retention classes.** | Legally mandatory, architecturally invasive if retrofitted. |
| A7 | **Data publication clearance** — [code-review.md §7](code-review.md) Q-01…Q-04 are still open on tenancy data, 47 contact addresses, and internal URLs. | Blocks the repository being public in its current form, independent of production. |

### 11. What to keep, in one list

Because the temptation in a rewrite is to throw all of it away:

1. The **information architecture** and the URL contract, including `legacyTarget` redirects.
2. The **route module contract** — `needs`, `render(ctx)`, `onUnmount`, `stale()`.
3. The **empty-vs-unavailable failure rule**, as an explicit, tested design rule.
4. The **domain vocabulary and reference lists** (`reference-data.json`, [bbl-vocabulary.md](bbl-vocabulary.md)) — these are agreed terminology, not code.
5. The **data model** and the Swiss join keys (`bbl_id`, `bbl_we`, `egid`, `egrid`).
6. The **DCAT catalogue model** and the metadata-catalogue concept.
7. The **role vocabulary** hiding in the process definitions.
8. The **accessibility behaviour**, wholesale.
9. The **29 CDP test suites**, as the acceptance criteria for every ported route.
10. The **OpenAPI draft** in `api-specs.json`, as the starting contract.

That list is the actual product of the last months of work. Everything else — the router, the string templates, the mock engine, the JSON files — is scaffolding that has already done its job.
