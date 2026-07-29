# Code review — Performance

> **Scope:** loading behaviour and runtime performance of the prototype.
> **Date:** 2026-07-29 · **Method:** measured, not estimated — headless Edge over CDP; see §8 to reproduce.
> **Verdict:** rendering is fast and the architecture is sound. The cost is almost entirely in **what is fetched before anything appears**, and it is fetched in the wrong order.

---

## 1. The headline

Under conditions a federal workstation over VPN would actually see — **4× CPU throttle, 1.5 Mbit/s, 60 ms latency** — the portal shows its first content after **~7.7 seconds**.

```
   0 ms  navigate
4500 ms  CSS fertig                          (213 KB unkomprimiert)
4589 ms  erster data/*-Request               ← startet erst nach den JS-Modulen
7673 ms  letzter der 13 data/*-Requests
7996 ms  first-contentful-paint              ← erst hier sieht jemand etwas
```

Nothing renders before **all 13 data files** have landed, because `js/app.js` opens with:

```js
await Promise.all([core.load(), engine.load()]);   // 275 KB, 13 Requests
shell.renderHeader(header);                        // erst danach
initRouter();
```

One blocking gate in front of the entire application. The home page needs **five** of those thirteen files.

Unthrottled on localhost the same chain takes 216 ms — which is why this has not been noticed.

---

## 2. Where the bytes are

Full first load, measured (uncompressed, as the dev server delivers it):

| Type | Requests | Size | Share |
|---|---:|---:|---:|
| **Font** | 2 | **1138 KB** | **48 %** |
| Image | 18 | 540 KB | 23 % |
| Fetch (`data/*`) | 13 | 275 KB | 12 % |
| Stylesheet | 2 | 226 KB | 10 % |
| Script | 10 | 173 KB | 7 % |
| Document / other | 2 | 2 KB | — |
| **Total** | **47** | **2354 KB** | |

Largest single resources:

```
  569.3 KB  assets/fonts/NotoSans-Regular.ttf
  569.1 KB  assets/fonts/NotoSans-Bold.ttf
  510.7 KB  assets/images/BBL-FE21_O-01.avif
  213.2 KB  css/app.css
   87.5 KB  js/components.js
   78.9 KB  data/parcels.geojson
   66.3 KB  data/buildings.geojson
   55.1 KB  data/media.json
```

**Compression reorders this, which matters for prioritisation.** Text compresses; fonts and images barely do:

| | raw | gzip | brotli |
|---|---:|---:|---:|
| `css/app.css` | 213.0 | 56.5 | 47.3 |
| `js/components.js` | 87.3 | 29.7 | 26.1 |
| `data/datasets.json` | 114.9 | 22.0 | 18.2 |
| `data/parcels.geojson` | 78.8 | 17.0 | 12.3 |
| `data/media.json` | 54.9 | **4.2** | 3.2 |
| `NotoSans-Regular.ttf` | 569 | **281** | — |

On a properly configured host: **fonts and images become ~85 % of transferred bytes**, and all the JSON together drops under 60 KB.

> The dev server compresses nothing, so §1 is a worst case — but it is the number the prototype produces today, and `python -m http.server` is what the README recommends.

---

## 3. Data loading — what each route actually needs

Worth restructuring less for bytes than for **request count inside the blocking gate**.

### 3.1 Eager payload and its readers

| Key | Size | Read by |
|---|---:|---|
| `parcels` | 78.8 KB | `apps/portfolio`, `apps/media-library` |
| `buildings` | 66.1 KB | 10 micro-apps + `pages/my-cases` |
| `media` | 54.9 KB | **`apps/media-library` only** |
| `applications` | 29.6 KB | `pages/applications`, `application`, `data`, `search`, `services` |
| `services` | 12.7 KB | `shell`, `pages/home`, `search`, `services` |
| `projects` | 5.3 KB | `apps/projects`, `media-library`, `pages/my-cases` |
| `reference` | 4.3 KB | `shell` + 8 modules |
| `documents` | 4.2 KB | `apps/document-archive`, `portfolio`, `pages/search`, `services` |
| `news` | 3.4 KB | `pages/home`, `news`, `search` |
| `catalogLabels` | 1.4 KB | **`pages/catalog` only** |
| `contacts` | 1.0 KB | `apps/fault-report`, `pages/application`, `services` |
| **Total** | **262 KB** | + 11 KB Prozess-Engine = **13 Requests** |

Every reader in **bold** is a lazily-imported route module. `media.json` (55 KB) and `catalog-labels.json` are fetched on every visit to serve one page each; `parcels.geojson` (79 KB) serves two `#/app/*` routes.

### 3.2 What the shell actually needs

Before the router dispatches, only `js/shell.js` touches the core — and it reads exactly two keys:

- `core.ref().domains` — the Dienstleistungen drawer
- `core.services()` — which domains have a startable service

**17 KB of the 275 KB.** Everything else belongs to a route.

### 3.3 Per-route need

| Route | Needs | Currently waits for |
|---|---|---:|
| `#/` | services, news, reference, engine | 275 KB |
| `#/knowledge/*` | **nothing** — fully static | 275 KB |
| `#/news` | news | 275 KB |
| `#/services` | services, applications, documents, contacts, reference | 275 KB |
| `#/app/portfolio` | buildings, parcels, projects, documents, reference (+147 KB deferred) | 275 KB |

The six *Wissen und Hilfsmittel* pages and the five *Digitalisierung* sub-pages read **no data at all** and still wait for the full boot.

### 3.4 Recommendation

Move `media`, `parcels`, `buildings`, `projects`, `documents` and `catalogLabels` into `DEFERRED`, declared via `needs` on the route modules that read them. The machinery already exists and is proven: `core.ensure()`, the `needs` contract and the router's pre-render gate serve seven keys today.

| | now | after |
|---|---:|---:|
| Eager requests | 13 | **5** |
| Eager bytes | 275 KB | **~60 KB** |
| `#/knowledge/*` blocked on | 275 KB | ~28 KB (shell only) |

Handle in the same change:

- `pages/my-cases.js` reads `core.building()` for linked entities → add `needs: ['buildings']`.
- `pages/services.js` reads `applications` + `documents` **only** for the "Auch in: …" hint. That hint should not gate the page — declare the need or drop the hint.
- `pages/search.js` reads five keys and already declares `datasets`; it would need the full set. Search is legitimately the one route that wants everything.
- `apps/document-archive.js` and `apps/portfolio.js` already declare `needs` — extend, do not replace.

---

## 4. Listener leaks — measured, not suspected

Each visit installs listeners that are never removed. Counted by patching `addEventListener` and visiting each route **5×**, returning to `#/news` in between:

| Route | matchMedia | document | window | Heap after |
|---|---:|---:|---:|---:|
| `#/knowledge/it` | **+5** | 0 | **+5** | 7 MB |
| `#/data/digitalisation/strategy` | **+5** | 0 | **+5** | 7 MB |
| `#/app/dataportal/energie-klima` | **+5** | +1 | 0 | 2 MB |
| `#/app/building-create` | 0 | **+20** | **+10** | 9 MB |

Exactly one set per visit — linear growth, no ceiling.

**`js/pages/anchor-nav.js` is the worst, because it is the most-used.** It backs all six Wissen pages and all five Digitalisierung sub-pages:

```js
// :89 — nie abgemeldet
const wide = window.matchMedia('(min-width:768px)');
wide.addEventListener('change', sync);

// :119 — räumt sich selbst auf, aber erst beim NÄCHSTEN Scroll-Ereignis
window.addEventListener('scroll', onScroll, { passive: true });
```

The scroll listener self-removes (`:113` checks whether `.anchor-nav` is still mounted) — but only when a scroll actually fires. Navigate away without scrolling and it stays. The `matchMedia` listener has no cleanup at all, and it closes over `mount`, so every stale listener pins a detached DOM subtree.

`js/apps/dataportal.js:325` and `js/apps/estate.js:374` carry the identical `matchMedia` bug. Both files *do* call `ctx.onUnmount(…)` — but only to dispose the MapLibre instance.

`js/apps/building-create.js` is heaviest: **4 document + 2 window listeners per visit**, heap 2 MB → 9 MB over five visits. Its `onUnmount` likewise frees only the map.

**Fix:** the router already passes `ctx.onUnmount` and runs cleanups before the next dispatch (`js/router.js:211`). These four call sites simply need to use it. One `AbortController` per render — the pattern `js/shell.js` already uses for the header — closes all of them in a line each.

---

## 5. Fonts, CSS, images

**Fonts — 1138 KB for two weights.** Raw `.ttf`, full Unicode coverage, unsubsetted. Four files ship (2.3 MB on disk); two load, and the two italics are declared in `@font-face` but never used (`document.fonts` reports both `unloaded`).

- `.woff2` instead of `.ttf`: ~55 % smaller for identical glyphs.
- Subset to `latin` + `latin-ext` — this is a DE/FR/IT/EN portal: **~30 KB per weight**.
- Together: **1138 KB → ~60 KB.** The single largest win available, with no behaviour change.

**CSS — 213 KB unminified.** Roughly half is the German rationale commentary, which is genuinely valuable *in source*. Serving it is the problem, not writing it. gzip already reaches 56 KB; minification would reach ~35 KB. For a no-build project the honest answer is to enable compression on the host and leave the source alone.

**Images — 540 KB over 18 requests**, dominated by a 511 KB AVIF hero on the home page. Already a modern format, simply oversized for its display box. A `srcset` with a ~120 KB variant for typical viewports removes ~400 KB from the most-visited route.

---

## 6. What is already right

Worth stating, because it bounds what should change:

- **Rendering is not a problem.** Hash change → new `h1`, unthrottled:

  | Route | ms | DOM nodes |
  |---|---:|---:|
  | `#/my-cases` | 11 | 11 |
  | `#/news` | 15 | 123 |
  | `#/services` | 22 | 243 |
  | `#/knowledge/it` | 25 | 448 |
  | `#/app/dataportal` | 33 | 79 |
  | `#/app/portfolio` | **39** | **851** |

  The heaviest view renders in 39 ms. `innerHTML` with template strings is right at this scale; a framework would add weight and remove nothing.

- **The deferral machinery is well built.** `core.ensure()` memoises per key (`PENDING`), so ten callers make one request; failures land in the same `FAILED` register as boot failures and surface in the outage band. §3.4 is about *using* it more, not building anything.

- **The router's cleanup contract exists and works** — ticket-based stale-render guard, `onUnmount` before the next dispatch, scroll-region rewiring. §4 is four call sites ignoring an existing facility.

- **Heap stays at 2–3 MB** in normal use; the growth in §4 appears only under repeated visits to the four leaking routes.

- **No N+1 scans in render paths.** The `filter`-inside-`map` occurrences all operate on collections under ~50 items.

---

## 7. Priorities

| # | Change | Effort | Effect |
|---|---|---|---|
| 1 | **Subset fonts to woff2** (latin + latin-ext) | S | **−1.08 MB** — 46 % of total payload |
| 2 | **Enable gzip/brotli** on the host; note it in the README | S | −250 KB across CSS, JS and JSON |
| 3 | **`srcset` for the home hero** | S | −400 KB on the most-visited route |
| 4 | **Fix the four listener leaks** via `ctx.onUnmount` / `AbortController` | S | removes unbounded growth on the most-used pages |
| 5 | **Move six keys to `DEFERRED`** (§3.4) | M | boot 13 → 5 requests, 275 → 60 KB |
| 6 | **Render the shell before `core.load()` resolves** | M | first paint stops depending on data at all |

1–4 are small, local and independently shippable. 5 is what the architecture was built for. 6 is the structural fix: with 5 done, `boot()` can render the shell against `reference` + `services` alone and let each route pull its own data — at which point §1's 7.7 s collapses to roughly the cost of the CSS.

**Not recommended:** a build step, a framework, virtualised lists, or `requestIdleCallback` scheduling. The measurements do not support any of them.

---

## 8. Reproducing

Probes were written ad hoc against `scripts/lib/cdp.mjs` and removed after use.

```bash
python -m http.server 8848
# CDP: Network.enable
#      Emulation.setCPUThrottlingRate      { rate: 4 }
#      Network.emulateNetworkConditions    { latency: 60, downloadThroughput: 1.5 Mbit/s }
# lesen: performance.getEntriesByType('resource' | 'paint' | 'navigation')
```

Listener counts: patch `MediaQueryList.prototype.addEventListener`, `document.addEventListener`
and `window.addEventListener` with counters, then visit each route five times.
