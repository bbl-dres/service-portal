# BBL Plattform — Prototype

A clickable **prototype** of a unified, process-oriented service platform for the Swiss Federal Office for Buildings and Logistics (Bundesamt für Bauten und Logistik, **BBL**). It brings the fragmented BBL intranet and five separate domain tools together behind one front door, aligned to the Swiss Confederation corporate design (**CD Bund**).

> ⚠️ **Demo with mock data.** Everything load-bearing — login, the process engine, the shared data core, and all external systems — is **simulated client-side**. No real authentication, data, or integrations. See [docs/expert-review.md](docs/expert-review.md) for the real-vs-mocked register.

> 🖼️ **Placeholder photography.** Buildings, media and news carry stock images from [Unsplash](https://unsplash.com) (a `photo` field = Unsplash photo id, rendered via `C.photo()`); they are **not** photographs of the real federal buildings. They load from `images.unsplash.com`, so the demo needs internet for images — without it every image degrades to the flat colour block the prototype used before, and nothing else changes.

## Run it

It's a **no-build, vanilla HTML/CSS/JS** app (ES modules), but ES modules + `fetch()` need HTTP — serve it, don't open `index.html` from disk:

```bash
cd service-portal
python -m http.server 8848
# open http://127.0.0.1:8848/
```

(Any static server works.) Tested in Edge/Chrome; Firefox/Safari current.

## What to try

- **Search-first home** ("Was benötigen Sie?") → the service catalog.
- **The hero flow:** Dienstleistungen → *Raumbedarf melden* → fill the wizard → submit → the new **Vorgang** appears under **Meine Vorgänge** with a live status pipeline. Linked building/project are cross-referenced.
- **Advance a case:** open a self-created Vorgang under *Meine Vorgänge* and use *Nächster Schritt (Demo)* to move it through its process steps.
- **Anwendungen** (software launcher), **Daten** (DCAT catalog), **Dokumente & Medien** (building document archive + Mediathek), **Wissen** (Weisungen catalog + news).

## Top-level navigation (7 areas)

Übersicht · Dienstleistungen · Anwendungen · Dokumente & Medien · Daten · Wissen · Meine Vorgänge.

## Structure

```
index.html                  # shell entry (links css/ + js/app.js)
css/      tokens.css         # CD Bund design tokens (colors, type, spacing…)
          app.css            # federal shell + component library (vanilla)
assets/   fonts/ icons/ swiss-logo-flag.svg swiss-logo-name.svg   # from the CD Bund design system
data/                        # the shared mock core (13 JSON files)
js/       app.js             # bootstrap: load core+engine, render shell, start router
          shell.js           # 3-row federal header + footer
          router.js          # hash router + nav
          core.js            # shared data core accessor (single source of truth)
          process-engine.js  # mock "Camunda": process defs, instances, status
          components.js       # shared UI helpers (C.*), incl. C.photo() placeholder images
          session.js         # mock session
  pages/  home · services · applications · documents-media · data · knowledge · my-cases
  apps/   space-request · fault-report · portfolio · projects · document-archive · mediathek · workspace · transaction
docs/                        # vision, sitemap, requirements, build plan, data model, expert review
bbl-intranet/                # source material analysed for the redesign (gitignored)
```

Each page/app is an ES module exporting `default async function render(ctx)`. The router injects `ctx` (`mount, params, query, core, engine, session, C, navigate, setTitle, setCrumbs`).

## CD Bund alignment

Design tokens, Noto Sans web fonts, the coat-of-arms/wordmark logo and the icon set are taken from the official Swiss Confederation design system (`swiss/designsystem`, CD Bund v1.0.5). Since that system ships as PostCSS/Tailwind source (no vanilla bundle), the tokens and components are re-implemented as plain CSS in `css/`. Swiss federal red `#d8232a`, secondary `#2f4356`.

## Documentation

See [docs/README.md](docs/README.md): the platform [vision](docs/platform-vision.md), [sitemap/IA](docs/sitemap.md), [requirements](docs/requirements.md), [build plan](docs/prototype-plan.md), [data model](docs/data-model.md), and the multi-persona [expert review](docs/expert-review.md).

## Known limitations (deferred to "production concerns")

Per the expert review: no real auth/SSO (eIAM/AGOV), no records management/GEVER retention, no RBAC/classification enforcement, no real process engine, FR/IT not translated (DE only; switcher stubbed), data is synthetic, and the shared core is read-mostly. These are intentionally out of scope for the demo and tracked in [docs/expert-review.md](docs/expert-review.md).
