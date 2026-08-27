# BBL Kundenportal (Service Portal)

<p align="center">
  <img src="assets/images/social1.jpg" width="100%" alt="BBL Kundenportal, service portal prototype"/>
</p>

<p>
  <a href="THIRD_PARTY_NOTICES.md"><img src="https://img.shields.io/badge/License-MIT%20%2B%20third--party-blue.svg" alt="License: MIT plus third-party terms"/></a>
  <img src="https://img.shields.io/badge/status-prototype-orange.svg" alt="Status: Prototype"/>
  <a href="https://github.com/swiss/designsystem"><img src="https://img.shields.io/badge/CD%20Bund-aligned-D8232A.svg" alt="CD Bund aligned"/></a>
  <a href="https://bbl-dres.github.io/service-portal/"><img src="https://img.shields.io/badge/demo-live-brightgreen.svg" alt="Live demo"/></a>
</p>

> [!CAUTION]
> **This is an unofficial prototype for demonstration purposes only.**
> The repository is intended to contain only fictional or publicly releasable data, and not every function is fully implemented. The current [technical review](docs/code-review-2026-08-16.md) records implemented findings and remaining production risks. The prototype is not intended for production use.

The BBL service portal is a process-oriented prototype for the [Federal Office for Buildings and Logistics (BBL)](https://www.bbl.admin.ch). It brings services, cases, specialist applications, property information, documents, and data access together in one interface based on the Swiss Confederation design system.

## Demo

**Live demo:** https://bbl-dres.github.io/service-portal/

## Scope

- Service catalogue, guided forms, and case tracking
- Property inventory, building documentation, media, and project views
- Workspace planning, browser-local floor-plan editing and DWG checking, room booking, and the BBL intranet shop
- Application and data catalogues, dashboards, process documentation, and knowledge content

## Technical overview

- Static single-page application with hash routing
- Vanilla JavaScript ES modules, HTML, and layered CSS: no build step, package manager, runtime framework, or installed dependencies
- Static JSON and GeoJSON repository fixtures shared across the portal and its micro-apps
- UI patterns and tokens aligned with the official [`swiss/designsystem`](https://github.com/swiss/designsystem)
- Pinned MapLibre GL JS, Swagger UI, bpmn-js, jsPDF and SheetJS assets are loaded only when needed over HTTPS, with SHA-384 Subresource Integrity, anonymous CORS, and no-referrer policy
- Maps draw the CARTO Positron vector style; the keyless raster endpoint it replaced now stamps «API KEY REQUIRED» into the tile image itself
- Three.js is vendored locally; route-specific CSS is also loaded lazily and awaited before a micro-app renders
- Plan Check accepts local DWG files for non-production parsing and completeness testing with bundled `libredwg-web` 0.7.9; selected files stay in the browser and are not uploaded to a service. The 40 rules are evaluated and scored even when parts of a drawing cannot be normalised, and no drawing is refused for its size. PDF and Excel Prüfberichte are generated locally from the finished result
- Dependency-free Node/CDP browser checks documented in [`scripts/README.md`](scripts/README.md)

### JavaScript structure

```text
js/
├── app.js                 # shell bootstrap
├── core/                  # data loading, storage, session, shared state and CDN loader
├── routing/               # route table, lifecycle-aware router and lazy CSS loader
├── ui/                    # reusable components, shell and presentation helpers
├── map/                   # map slots, building maps and cluster navigation
├── search/                # indexing, suggestions and local diagnostic log
├── floorplan-editor/      # editor model, commands, rendering and controllers
├── plan-check/            # non-production local DWG checker, reports and viewer
├── apps/                  # specialist micro-app entry points
├── pages/                 # portal page renderers
├── security/              # URL/resource policies and untrusted-text boundaries
└── *.js                   # stable shared APIs and compatibility facades
```

Root modules such as `components.js`, `links.js`, and `format.js` keep stable
imports for existing consumers; `components.js` is the compatibility facade
over the grouped `ui/components/` implementation.

The basemap style, its vector tiles, its glyphs and its sprite, plus geocoding,
address search and some stylesheet-owned fonts, remain dynamic third-party
resources and cannot be covered by the top-level SRI hashes. Clustered maps keep
interactive geometry on a source separate from its labels, so a label-provider
failure costs the count text and never the clusters or their navigation.
Basemap views and live searches require network access and can be affected by
provider availability or policy changes.
The app reports these failures; a production deployment should review the
residual risks and self-host where appropriate; see the
[technical review](docs/code-review-2026-08-16.md).

The Planprüfung route runs in three steps — Standort und Datei, Datenqualität,
Freigabe — and accepts local binary DWG files for viewing, parser compatibility
checks, completeness diagnostics, and the prototype's technical rules. Submitting
for approval opens a case in browser storage only; nothing is transmitted and no
formal plan approval is granted. Files are read into browser memory and processed in a disposable Web
Worker; they are not sent to a server, placed in the URL, or stored in browser
storage. The bundled BBL reference drawing remains a deterministic regression
fixture, while users select or drop their own local DWG test files.
The checker is a non-production test tool and does not create an authoritative
plan version, persisted review, or professional approval.

The local parser is `libredwg-web` 0.7.9. Its GPL-3.0 terms, exact artifacts,
checksums, package provenance, and recorded corresponding source are described in
[`js/vendor/libredwg/README.md`](js/vendor/libredwg/README.md) and
[Third-party notices](THIRD_PARTY_NOTICES.md).

## Run locally

No build tools, no dependencies — just static files. From the repo root:

```bash
# Python
python -m http.server 8000

# Node
npx http-server

# PHP
php -S localhost:8000
```

Then open <http://localhost:8000/>. The root redirects to the main app.

## Documentation

Architecture, requirements, data models, design reviews, and implementation notes are collected in [`docs/`](docs/README.md).

## License

Original portal code is licensed under the [MIT License](LICENSE). Vendored and
adapted third-party material remains under its own terms. In particular, the
bundled `libredwg-web` runtime is GPL-3.0 software and is not relicensed by
the portal's MIT license. Anyone conveying the runtime must preserve its
license and notices and satisfy the GPL-3.0 complete-corresponding-source
obligations. Review [Third-party notices](THIRD_PARTY_NOTICES.md) before copying,
deploying, or distributing the repository.

## Technology acknowledgements and attribution

The table below records the principal technologies, specifications, reference
sources, and hosted services used by this prototype. Versions are those pinned
or explicitly targeted by this repository; a managed service has no deployable
version pinned here. This summary does not replace upstream license or NOTICE
files, provider terms, or [Third-party notices](THIRD_PARTY_NOTICES.md).
Alignment with a federal design reference is not official accreditation or
endorsement, and software licenses do not grant rights to Swiss Government
brand elements.

| Name and link | Version | License / terms | Short description |
| --- | --- | --- | --- |
| [Web platform: HTML, CSS, and ECMAScript modules](https://developer.mozilla.org/en-US/docs/Web) | Living standards | Standards terms; browser implementations retain their own licenses | Dependency-free runtime foundation, including the DOM, Fetch, SVG, Canvas, WebGL, Web Workers, and Web Storage. |
| [Swiss Confederation Design System](https://github.com/swiss/designsystem) | Design baseline `1.0.5` (`cbedbb9`); icon sources `1.0.45` (`5f03f257`) | [ISC declared for 1.0.5](https://github.com/swiss/designsystem/blob/cbedbb9/package.json); [MIT for 1.0.45](https://github.com/swiss/designsystem/blob/v1.0.45/LICENSE); Swiss Government branding excluded | Design reference for adapted tokens, layouts, and component patterns; 218 of 221 shipped SVG icons match the 1.0.45 source set. No upstream runtime framework is imported. |
| [Lucide](https://github.com/lucide-icons/lucide/tree/1.31.0) | `lucide-static` `1.31.0` | [ISC with retained Feather MIT notice](assets/icons/lucide/LICENSE.txt) | Locally bundled, checksum-recorded 24 px stroke icons for trees and pipeline status; no runtime icon service or package is loaded. |
| [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic) | `2.015` | [SIL Open Font License 1.1](https://github.com/notofonts/latin-greek-cyrillic/blob/main/OFL.txt) | Self-hosted variable WOFF2 typeface used by the portal interface. |
| [Three.js](https://github.com/mrdoob/three.js/tree/r184) | `0.184.0` / r184 | [MIT](js/vendor/three.LICENSE.txt) | Locally vendored 3D and walk-view renderer for the floor-plan editor. |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js/tree/v4.7.1) | `4.7.1` | [BSD-3-Clause and bundled notices](https://github.com/maplibre/maplibre-gl-js/blob/v4.7.1/LICENSE.txt) | SRI-pinned, lazily loaded renderer for interactive maps. |
| [Swagger UI](https://github.com/swagger-api/swagger-ui/tree/v5.17.14) | `5.17.14` | [Apache-2.0](https://github.com/swagger-api/swagger-ui/blob/v5.17.14/LICENSE); upstream NOTICE applies | SRI-pinned, lazily loaded renderer for the OpenAPI documentation. |
| [bpmn-js](https://github.com/bpmn-io/bpmn-js/tree/v17.11.1) | `17.11.1` | [bpmn.io License](https://bpmn.io/license/) | SRI-pinned BPMN viewer; its built-in bpmn.io watermark and link must remain visible and unchanged. |
| [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3) | `3.0.3` | [Apache-2.0 specification](https://github.com/OAI/OpenAPI-Specification/blob/3.0.3/LICENSE) | Machine-readable API contracts displayed through Swagger UI. |
| [Business Process Model and Notation](https://www.omg.org/spec/BPMN/2.0.2/) | `2.0` | OMG specification terms; not a bundled software package | Process diagrams plus an independently derived accessible process-step view. |
| [GeoJSON](https://www.rfc-editor.org/rfc/rfc7946) | RFC 7946 | IETF document terms; not a bundled software package | Static geospatial fixtures and map interchange. |
| [iCalendar](https://www.rfc-editor.org/rfc/rfc5545) | RFC 5545 / `VERSION:2.0` | IETF document terms; not a bundled software package | Browser-generated room-booking calendar exports. |
| [Node.js](https://nodejs.org/) | `>=22` | [MIT and bundled third-party notices](https://github.com/nodejs/node/blob/main/LICENSE) | Local development server, maintenance scripts, and dependency-free verification suites; not a browser runtime dependency. |
| [Microsoft Edge and Chrome DevTools Protocol](https://learn.microsoft.com/en-us/microsoft-edge/devtools-protocol/) | System-installed; unpinned | Microsoft software terms; [CDP is BSD-3-Clause](https://github.com/ChromeDevTools/devtools-protocol/blob/master/LICENSE) | Headless regression, accessibility, and interaction testing without Puppeteer. |
| [unpkg](https://unpkg.com/) | Managed service; package versions pinned above | Delivery-service terms; each delivered package retains its own license | HTTPS delivery for MapLibre GL JS, Swagger UI, bpmn-js, jsPDF and SheetJS, with SHA-384 Subresource Integrity. |
| [CARTO Positron vector style](https://github.com/CartoDB/basemap-styles) and [OpenStreetMap](https://www.openstreetmap.org/copyright) | Managed services and continuously updated data; style, tiles, glyphs and sprite unpinned | [CARTO terms](https://carto.com/legal/); OSM data under ODbL 1.0; provider terms apply | Runtime vector basemap for every MapLibre view, plus its glyph ranges and sprite; rendered maps retain provider attribution. Replaced the keyless raster endpoint, whose tiles now arrive with an «API KEY REQUIRED» watermark rendered into the image. |
| [swisstopo / geo.admin.ch API](https://docs.geo.admin.ch/) | Managed service; API version not pinned | [Federal Spatial Data Infrastructure terms](https://www.geo.admin.ch/en/general-terms-of-use-fsdi) | Live Swiss address and geodata search used by location workflows. |
| [GitHub Pages](https://pages.github.com/) | Managed service | [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service); repository content retains its own licenses | Static hosting for the public prototype demonstration. |
| [bbl-dres/plan-check](https://github.com/bbl-dres/plan-check/tree/7320840a53dcd71859700fe4c90256cbdb6b01f3) | Commit `7320840a53dcd71859700fe4c90256cbdb6b01f3` | [MIT](js/plan-check/PLAN_CHECK_REFERENCE_LICENSE) | Reference implementation whose checker concepts and official BBL test fixture were adapted for Planprüfung. |
| [jsPDF](https://github.com/parallax/jsPDF/tree/v2.5.2) and [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable/tree/v3.8.4) | `2.5.2` / `3.8.4` | [MIT](https://github.com/parallax/jsPDF/blob/v2.5.2/LICENSE); [MIT](https://github.com/simonbengtsson/jsPDF-AutoTable/blob/v3.8.4/LICENSE) | SRI-pinned, lazily loaded generator for the Planprüfung PDF-Prüfbericht. |
| [SheetJS Community Edition](https://github.com/SheetJS/sheetjs/tree/v0.18.5) | `0.18.5` | [Apache-2.0](https://github.com/SheetJS/sheetjs/blob/v0.18.5/LICENSE) | SRI-pinned, lazily loaded generator for the Planprüfung Excel-Prüfbericht. |
| [`libredwg-web`](https://github.com/mlightcad/libredwg-web/tree/v0.7.9) | `0.7.9`, bundled locally | [GPL-3.0](js/vendor/libredwg/LICENSE); corresponding-source obligations apply | JavaScript/WASM DWG parser used by the non-production, browser-local viewer and checker. See the [artifact and provenance record](js/vendor/libredwg/README.md). |
