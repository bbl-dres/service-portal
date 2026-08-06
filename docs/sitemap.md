# BBL Kundenportal — Navigation & Routing

> **Part 1 is the target.** Where the code disagrees, the code is wrong.
> **Part 2 is the fact.** What the prototype does today, and the gap.
> **Updated:** 2026-07-29 · Evidence behind these decisions: [legacy-analysis.md](legacy-analysis.md) · Vision: [platform-vision.md](platform-vision.md)

Status markers: **✅** built to spec · **🔶** built, differs · **⬜** not built.

---

# Part 1 — Specification

## 1. Rules

### 1.1 path = place, query = state

> **The path names a _place_** — a page with its own breadcrumb and `h1`. **Query parameters carry only state within that one page.**

If a parameter changes *which page you are on* → path segment. If it only changes *what is shown on the same page* → query parameter.

- **Places:** `#/<area>` · `#/<area>/<section>` · `#/<area>/<id>` · `#/app/<name>[/<id>]`
- **State:** `?q` `?topic` `?page` `?view` `?sort` `?from`/`?to`
- **`?tab=`** is allowed only for facets of the *same object* (Vorgang detail, dashboard views, object details). It is **forbidden** for switching between standalone pages — those are places.
- **One exception:** `#/app/portfolio?id=<bbl_id>` uses a query parameter for identity, because `bbl_id` contains slashes (`1080/4840/AF`) that would break the path grammar. Deep-links into an app's list may use `?id=`; nothing else may.

### 1.2 The URL is English; the interface is localised

> Everything the portal **invents** in a URL — path segments, parameter names, enumerated values — is **English, in every language version**. Everything a user **reads** is in their language.

Planned languages: **DE · FR · IT · EN**. The prototype ships German only; the switcher is present but disabled rather than faked.

Multilingualism is *why* the URL must be English, not a complication of it: `?thema=` on a French page is neither French nor a stable key, and translating parameter names per language would mean four incompatible URL grammars and links that break when sender and recipient differ.

**Exception — content identifiers keep their source spelling.** `serviceId`, `appId`, dataset `id`, `bbl_id` are primary keys in `data/*.json` and the systems behind them, and they are language-neutral: a `serviceId` never translates, only its `title` does. So `#/services/stoerung-melden` stays as it is.

**Open:** how language is carried in the URL. Recommended is a path prefix (`#/de/services`), matching `admin.ch` and today's Kundenplattform — the only form where a shared link renders the same for the recipient. Until decided, read every route below as language-less.

**Other conventions:** lowercase kebab-case slugs, no umlauts · multi-value filters comma-joined in one parameter, never repeated keys · default values omitted from the URL · path ids built with `encodeURIComponent`, read with `C.safeDecode`.

### 1.3 Query parameters

One name per concept, across every catalogue.

| Parameter | Values | Used by |
|---|---|---|
| `q` | free text | every catalogue, `#/search` |
| `topic` | domain keys `A,B,U,O,G,C,D,E,F,H` | `#/services`, `#/data/catalog` |
| `audience` | `staff` · `customers` · `both` | `#/services`, `#/applications` |
| `area` | `buildings` · `logistics` · `central` | `#/applications` |
| `classification` | `internal` (only value in the data today) | `#/data/catalog` |
| `kind` | content type | `#/search` |
| `tag` | free tags | `#/data/catalog` |
| `type` | template kinds | `#/knowledge/templates` |
| `sort` | `title` · `topic` · `domain` · `date` · `kind` (catalogue-specific) | services · catalog · applications · search |
| `page` | 1-based integer | every paginated catalogue |
| `view` | `gallery` · `list` (default `gallery`, omitted) | every catalogue |
| `from` · `to` | years | `#/app/dataportal` |
| `tab` | in-page facets only, see §1.1 | Vorgang detail, dashboards, object details |
| `id` | deep-link into an app's list | `#/app/portfolio` |

## 2. Navigation

### 2.1 Five task areas

Each L1 is one **kind of thing** — never a system, an org unit, or an object type.

| # | Area | Route | Holds | Status |
|---|---|---|---|---|
| 1 | **Dienstleistungen** | `#/services` | only services you can *start* (§2.3) | ✅ |
| 2 | **Daten und Digitalisierung** | `#/data` | data catalogue, dashboards, applications, digitalisation | ✅ |
| 3 | **Wissen und Hilfsmittel** | `#/knowledge` | directives · templates · guides · process docs (§2.4) | ✅ |
| 4 | **News** | `#/news` | the newsroom, nothing else | ✅ |
| 5 | **Meine Vorgänge** | `#/my-cases` | personal cases, login-gated, always last | ✅ |

Five is the CD Bund ceiling — *"Try to limit mainmenus to 5"* (`designsystem/…/MainNavigation.vue:162`).

*Wissen and News are separate because a news feed is dated and read once, while the reference layer is consulted repeatedly, mid-task. The platform being replaced carries 120 documents and templates against 0 web forms — reference material is its largest content class.*

### 2.2 The tree

```
Startseite  #/                    (reached via the logo, not a nav item)
│   Search-first: open cases · frequent services · Themen · news
│
├── Dienstleistungen  #/services
│     Catalogue of startable services. Search, filters, gallery/list, pagination.
│     └── #/services/<serviceId>
│           CTA «Vorgang starten» (login-gated) or a link to the system that
│           performs it. Starting one creates a Vorgang → Meine Vorgänge.
│
├── Daten und Digitalisierung  #/data
│     ├── #/data/catalog (+ /<id>)      Datenbezug und API Verzeichnis (DCAT-AP-CH)
│     ├── #/data/digitalisation[/<sub>] strategy · vision · principles · superb · bim
│     ├── #/data/ict-projects           IKT-Vorhaben
│     └── #/applications (+ /<id>)      App catalogue → the micro-apps under #/app/…
│
├── Wissen und Hilfsmittel  #/knowledge
│     ├── #/knowledge/regulations       Gesetzliche Grundlagen und Vorgaben  (static)
│     ├── #/knowledge/templates         Vorlagen und Formulare
│     ├── #/knowledge/guides            Anleitungen und Schulungsunterlagen  (static)
│     └── #/knowledge/processes         Prozessdokumentation + FAQ           (static)
│
├── News  #/news  (+ /<id>)
│
└── Meine Vorgänge  #/my-cases          (login-gated)
      └── #/my-cases/<instanceId>       status stepper + tabs

Also: #/search · meta-nav «Notfall & Vorfälle» → #/services/sicherheitsvorfall-melden
```

**Global chrome** (rendered by `js/shell.js`, never by a page): top bar · brand row with global search, meta-nav and language switcher · main nav with CD `navy` drawers · breadcrumb · footer · prototype banner, data-outage band, `#live` region.

### 2.3 Dienstleistungen holds only startable things

`data/services.json` has a `type` field. This rule makes it load-bearing:

- **`type: action`** (16 entries) → stays in `#/services`.
- **`type: info`** (4 entries) → leaves. `beschaffung-einstieg` and `leistungsverrechnung` → **Wissen und Hilfsmittel**; `portfolio-einsicht` and `bauprojekt-informationen` → **Daten und Digitalisierung**, as entry points to the apps they describe.

The service/information distinction becomes **structural** rather than a badge. A tag reading "this is not actually a service" is weaker than not filing it under services.

### 2.4 Wissen und Hilfsmittel — four sections

| Section | Route | Shape |
|---|---|---|
| Gesetzliche Grundlagen und Vorgaben | `#/knowledge/regulations` | **static** — no detail route |
| Vorlagen und Formulare | `#/knowledge/templates` | catalogue (`q`, `type`) |
| Anleitungen und Schulungsunterlagen | `#/knowledge/guides` | static |
| Prozessdokumentation | `#/knowledge/processes` | static |

**Regulations is static and has no detail page.** A Weisung is a document issued elsewhere — BBL, BKB, KBOB, Fedlex — and the portal is never its authoritative renderer. Modelling directives as a catalogue with `version`/`bindingForce`/`supersededBy` built metadata the domain does not have. The page groups them **by normative tier** — Erlasse des Bundes → übergeordnete Vorgaben → Weisungen BBL — because that tier determines who may deviate from what; each row is a `C.downloadItem` pointing at the real document. `data/weisungen.json` is retired (§6).

**Templates is separate from guides** because templates are used, not read: the legacy platform's `/mustervorlagen-fuer-ikt-beschaffungen` is 12 contract templates and nothing else, `/dokumente-der-bkb` is 8 federal forms.

## 3. Route contract

| Route | Place | Query state | Module | Status |
|---|---|---|---|---|
| `#/` | Startseite | — | `pages/home.js` | ✅ |
| `#/search` | Globale Suche | `q, kind, sort, page, view` | `pages/search.js` | ✅ |
| `#/services` | Dienstleistungskatalog | `q, audience, topic, sort, page, view` | `pages/services.js` | 🔶 |
| `#/services/<serviceId>` | Dienstleistung | — | `pages/services.js` | ✅ |
| `#/data` | Daten und Digitalisierung | — | `pages/data.js` | ✅ |
| `#/data/catalog[/<id>]` | Datenbezug · Datensatz | `q, topic, classification, tag, sort, page, view` | `pages/catalog.js` | 🔶 |
| `#/data/digitalisation[/<sub>]` | Digitalisierung | — | `pages/digitalisation.js` | 🔶 |
| `#/data/ict-projects` | IKT-Vorhaben | — | `pages/ict-projects.js` | 🔶 |
| `#/applications` | Anwendungskatalog | `q, area, audience, sort, page, view` | `pages/applications.js` | 🔶 |
| `#/applications/<appId>` | Anwendung | — | `pages/application.js` | ✅ |
| `#/app/<name>[/<id>]` | Micro-apps | `tab` + app-specific | `apps/<name>.js` | ✅ |
| `#/knowledge` | Wissen und Hilfsmittel | — | `pages/knowledge.js` | 🔶 |
| `#/knowledge/regulations` | Gesetzliche Grundlagen | — | `pages/regulations.js` | ⬜ |
| `#/knowledge/templates` | Vorlagen und Formulare | `q, type, sort` | `pages/knowledge.js` | ⬜ |
| `#/knowledge/guides` | Anleitungen | — | `pages/knowledge.js` | ⬜ |
| `#/knowledge/processes` | Prozessdokumentation | — | `pages/knowledge.js` | ⬜ |
| `#/news[/<id>]` | News · Meldung | `page` | `pages/news.js` | ⬜ |
| `#/my-cases` | Meine Vorgänge | — | `pages/my-cases.js` | ✅ |
| `#/my-cases/<instanceId>` | Vorgang | `tab=data\|attachments\|history` | `pages/my-cases.js` | ✅ |

**Micro-apps** — all under `#/app/<name>`, all highlighting *Daten und Digitalisierung* except the three service flows, which highlight *Dienstleistungen* (`SECTION_OF` in `js/router.js`):

`portfolio` (hero) · `projects` (hero) · `dataportal` · `document-archive` · `media-library` · `workspace` · `room-booking` · `api-docs` · `transaction` · `tenancies` · `metadata-catalog` · `process-docs` — and the service flows `space-request` · `fault-report` · `building-create`.

### Routing rules

1. **Only `#/…` dispatches.** A bare `#` and in-page fragments (the skip link) must not route.
2. **Unknown route → a 404 place** with its own `h1` and a link home. Never a silent redirect to the Startseite.
3. **Descriptions are public, systems are gated.** Every catalogue and detail page stays readable when logged out — including each application's landing page (`#/applications/<id>`), which says what the application does, who may use it and how to get an account. Login is required for anything that *is* a system or *starts* a process:
   - **every specialist application** (`#/app/…`) — gated centrally in `js/router.js`, not per app; the application supplies only the wording via `export const loginText` (Nutzerentscheid 2026-08-06). Before that, five of seventeen brought their own gate and twelve were simply open.
   - `#/my-cases` and the CTA on a service detail page, which render `C.loginGate` **in place of the form**, keeping the surrounding page visible.

   The login button carries its destination (`C.loginButton({ next })` → `window.__login(next)`), so signing in from a service or application page **also opens the target** — it used to log you in and leave you to press the real button a second time.

4. **One access card.** `C.accessCard` answers «how do I get in?» on both the service and the application landing page, with the button on top and four derived states: no target → greyed out · external system → new tab, no login · internal + logged out → login-and-open · internal + logged in → link plus the session context.
5. **State change ≠ navigation.** If only the query changed on the same path, focus returns to the triggering control and the page does not scroll (WCAG 3.2.2). Real navigation scrolls to top and focuses the `h1`.
6. **Stale renders are dropped.** Every dispatch takes a ticket; a module that `await`s before writing must check `ctx.stale()` immediately before `mount.innerHTML =`.
7. **Renamed routes redirect, never 404** — shared links are exactly the ones that break — the map lives in `js/router.js` (`REDIRECTS`).

## 4. Page module contract

Every page and app is an ES module in `js/pages/` or `js/apps/`:

```js
export const needs = ['datasets'];              // optional — deferred data keys
export default async function render(ctx) { }   // required
```

| `ctx` key | Use |
|---|---|
| `mount` | the `#main-content` element — write your HTML here |
| `params` · `query` | path segments after the route base · `URLSearchParams` |
| `core` · `engine` · `session` | data core · mock process engine · login stub |
| `C` | shared component library (`js/components.js`) |
| `navigate(hash)` · `setTitle(t)` · `setCrumbs([…])` | navigation · document title · breadcrumb |
| `onUnmount(fn)` | register teardown — maps, observers, listeners, overlays |
| `stale()` | `true` if a newer navigation started; check before writing after an `await` |

1. **Declare deferred data in `needs`** — the router awaits `core.ensure(needs)` before `render`, so accessors never read a not-yet-loaded list and render "no entries" instead of data.
2. **Register every teardown** by calling `ctx.onUnmount(fn)`. The router only swaps `mount.innerHTML`; anything outliving that swap must clean itself up.
3. **Check `stale()` after any `await`**, or a slow render overwrites a newer page.
4. **Do not touch the chrome** — header, footer, breadcrumb container, live region and scroll-region wiring belong to the shell and router.
5. **One `h1` per place**, unbroken heading outline below it.
6. **Never render a failed load as zero.** `core.available(key)` distinguishes "empty" from "unavailable"; the shell shows an outage band.

## 5. Audience

One portal, two audiences, tagged rather than split into separate sites. **The platform is never public.**

| Tag | Who | `audience` |
|---|---|---|
| **(K) Kunden** | employees of *other* federal offices consuming BBL services | `customers` |
| **(P) Personal** | BBL's own staff | `staff` |
| **(B) Beide** | shared — incident reporting, news, templates, knowledge | `both` |

---

# Part 2 — Implementation status

## 6. As-is

**Part 1 is implemented.** The five-area navigation, the English URL vocabulary and the Wissen/News split all ship. Verified by `scripts/test-routes.mjs`: 22 routes render with the expected `h1`, 10 legacy redirects resolve to their target.

| Area | Route | Module |
|---|---|---|
| Dienstleistungen | `#/services` | `pages/services.js` — catalogue filtered to `type: action` |
| Daten und Digitalisierung | `#/data` | `pages/data.js` → `catalog.js` · `digitalisation.js` · `ict-projects.js` |
| Wissen und Hilfsmittel | `#/knowledge` | `pages/knowledge.js` → `regulations.js` |
| News | `#/news` | `pages/news.js` |
| Meine Vorgänge | `#/my-cases` | `pages/my-cases.js` |

**What changed in the code** (2026-07-29)

- `js/router.js` — `NAV` carries five areas; `PAGES` gained `news`; `APPS` renamed `mediathek` → `media-library`; new `REDIRECTS` table + `legacyTarget()`, applied at the top of `dispatch()` via `history.replaceState` so Back does not trap on the old path.
- `js/pages/knowledge.js` — rewritten: overview + `templates` (new, searchable) + `guides` + `processes`. News extracted to `js/pages/news.js`.
- `js/pages/regulations.js` (was `grundlagen.js`) — grouped by **normative tier** (Erlasse → übergeordnete Vorgaben → Weisungen BBL) rather than by topic.
- `data/weisungen.json` — **deleted**, with its four readers (`core.js`, `knowledge.js`, `search.js`, `services.js`).
- `data/templates.json` — **new**, 31 entries seeded from the legacy inventory (IKT contract templates, BKB forms, Werkzeugkasten tools, price lists).
- Module renames: `katalog.js` → `catalog.js`, `digitalisierung.js` → `digitalisation.js`, `ikt-vorhaben.js` → `ict-projects.js`, `apps/mediathek.js` → `apps/media-library.js`.
- Parameter and value renames per §1.3, including `data/applications.json` field `bereich` → `area` with English values, and `audience` `internal|external` → `staff|customers`.

## 7. Known gaps

| Gap | Note |
|---|---|
| `?classification` filters a field with a single value (`internal`) | `data/datasets.json` — the filter renders but cannot narrow. Either enrich the data or drop the facet |
| `?audience` on `#/applications` has a dead option | no application is tagged `customers` in `data/applications.json` |
| `#/search` defaults to `list`, every other catalogue to `gallery` | **deliberate** — CD shows search results as a list first (`searchResults.vue`). §1.3's "default `gallery`" is the catalogue rule; search documents its own default |
| `type: info` services keep their `#/services/<id>` detail route | they are out of the *catalogue* per §2.3 and surfaced from Wissen/Daten, but their detail URL is unchanged so shared links keep working |
| `scripts/test-portfolio.mjs` fails (26 checks) | **pre-existing**, verified identical against `HEAD` in a clean worktree — the app's default object-kind filter shows 21 of 41 objects and the test still expects 41 |
| `index.html` hard-codes `lang="de-CH"` | must track the active language once §1.2's language decision lands |

## 8. Tests

`scripts/test-routes.mjs` is new — it walks every route in §3 and every redirect in §6, asserting the `h1` and the absence of an error banner.

```bash
python -m http.server 8848 &
for t in routes tabs login catalogue forms content race apidocs media-library dashboard estate building-create; do
  APP_BASE='http://localhost:8848/#' node scripts/test-$t.mjs
done
```

12 of 13 suites pass; `test-portfolio` is the pre-existing failure above.

## 9. Open decisions

| # | Question | Note |
|---|---|---|
| 1 | **Language in the URL** — path prefix, query parameter, or session only? | §1.2; path prefix recommended, and it changes every route |
| 2 | **`#/app/transaction` has no identity** | a detail route with no id — either `#/app/transaction/<id>` or fold it into `#/my-cases/<id>` |
| 3 | **Content identifiers stay German** (`stoerung-melden`) | the one place the URL still mixes languages. Anglicising means renaming data and remapping deep links |
| 4 | **Catalogue coverage** | 23 legacy pages have no home yet, concentrated in Produktion (7) and Beschaffungs-Controlling (5). See [legacy-analysis.md §D.2](legacy-analysis.md) — a scope decision, not a build task |

## 10. Decisions taken

| # | Decision | Date |
|---|---|---|
| 1 | Unified portal — Kunden + Personal, audience-tagged, never public | 2026-06-15 |
| 2 | **Five** task areas (was four) | 2026-07-29 |
| 3 | Dienstleistungen holds only startable services | 2026-07-29 |
| 4 | The URL is English; the interface is localised (DE now; DE/FR/IT/EN planned) | 2026-07-29 |
| 5 | Regulations are static — no detail route, no `data/weisungen.json` | 2026-07-29 |
| 8 | `audience` values are `staff` / `customers` / `both` — the platform is never public | 2026-07-29 |
| 6 | Vorgänge really are created and tracked (mock engine, `localStorage`) | 2026-06 |
| 7 | Login is mocked AGOV / FedLogin; content public, actions gated | 2026-06 |

**Out of scope:** real SSO (eGate) · live backend data (E-Shop, SAP/SUPERB, InfoPers) · full content migration · FR/IT/EN translations · records management / GEVER · RBAC.
